'use strict';
const { createClient } = require('@libsql/client');
const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function createDatabase(options = {}) {
  const configuredUrl = options.url ?? process.env.TURSO_DATABASE_URL;
  const token = options.authToken ?? process.env.TURSO_AUTH_TOKEN;
  const remote = Boolean(configuredUrl && !configuredUrl.startsWith('file:'));
  if (remote && !token) throw new Error('TURSO_AUTH_TOKEN is missing. Set it in Render Environment.');
  if (!configuredUrl && (token || process.env.RENDER === 'true')) {
    throw new Error('TURSO_DATABASE_URL is missing. Refusing to use temporary local storage on Render.');
  }
  let url = configuredUrl;
  if (!url) {
    const filename = options.localPath || process.env.MEDIQUEUE_SQLITE_PATH || path.join(__dirname, '..', 'database', 'mediqueue.db');
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    url = pathToFileURL(path.resolve(filename)).href;
  }
  const client = createClient({ url, ...(remote ? {authToken: token} : {}) });
  const context = new AsyncLocalStorage();
  let tail = Promise.resolve();
  async function exclusive(fn) {
    const prior = tail;
    let release;
    tail = new Promise(resolve => { release = resolve; });
    await prior;
    try { return await fn(); } finally { release(); }
  }
  function execute(sql, args = []) {
    const state = context.getStore();
    if (state) {
      if (state.finished) throw new Error('Transaction has finished.');
      return state.tx.execute({ sql, args });
    }
    return exclusive(() => client.execute({ sql, args }));
  }
  const db = {
    remote,
    prepare(sql) {
      return {
        async get(...args) { return (await execute(sql, args)).rows[0]; },
        async all(...args) { return (await execute(sql, args)).rows; },
        async run(...args) {
          const result = await execute(sql, args);
          return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid };
        }
      };
    },
    async exec(sql) {
      const command = sql.trim().replace(/;$/, '').toUpperCase();
      const state = context.getStore();
      // Existing booking/permission handlers run inside one managed transaction.
      if (/^(BEGIN(?: IMMEDIATE)?|COMMIT|ROLLBACK)$/.test(command)) {
        if (!state) throw new Error('Explicit SQL transaction requires db.transaction().');
        if (command === 'ROLLBACK') state.rollback = true;
        return;
      }
      if (state) throw new Error('Schema changes must run outside request transactions.');
      return exclusive(() => client.executeMultiple(sql));
    },
    async transaction(fn) {
      if (context.getStore()) return fn();
      let effects = [];
      const value = await exclusive(async () => {
        const tx = await client.transaction('write');
        const state = { tx, effects: [], rollback: false, finished: false };
        try {
          const result = await context.run(state, fn);
          if (state.rollback) await tx.rollback();
          else { await tx.commit(); effects = state.effects; }
          return result;
        } catch (error) {
          try { await tx.rollback(); } catch {}
          throw error;
        } finally { state.finished = true; tx.close(); }
      });
      // Run outside the transaction context, and only after a successful commit.
      for (const effect of effects) {
        try { await effect(); } catch (error) { console.error('Post-commit notification failed:', error.code || error.name); }
      }
      return value;
    },
    rollback() { const state = context.getStore(); if (state) state.rollback = true; },
    afterCommit(fn) { const state = context.getStore(); if (state) state.effects.push(fn); else return fn(); },
    async close() { return exclusive(() => client.close()); }
  };
  return db;
}

// Delay JSON responses until writes commit. Authorization middleware runs first.
function atomicRoute(db, handler) {
  return async function(req, res, next) {
    const originalJson = res.json;
    let body, sent = false;
    res.json = function(value) { body = value; sent = true; return this; };
    try {
      await db.transaction(async () => {
        await handler(req, res, next);
        if (res.statusCode >= 400) db.rollback();
      });
      res.json = originalJson;
      if (sent) return res.json(body);
    } catch (error) {
      res.json = originalJson;
      next(error);
    }
  };
}
module.exports = { createDatabase, atomicRoute };
