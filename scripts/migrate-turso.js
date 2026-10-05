'use strict';
// Run locally before the first Turso deployment. Source files are read-only.
try { require('node:process').loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@libsql/client');
const fs = require('node:fs');
const path = require('node:path');
const tables = ['patients','staff_accounts','visits','staff_shifts','staff_actions','staff_department_permissions','appointment_slots','appointments'];
const quote = name => '"' + name.replaceAll('"', '""') + '"';
async function importDatabase({url, authToken, database, queue}) {
  if (!url) throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your local .env first.');
  if (!url.startsWith('file:') && !authToken) throw new Error('TURSO_AUTH_TOKEN is missing.');
  if (!fs.existsSync(database)) throw new Error('Source database not found: choose your original database/mediqueue.db.');
  const source = new DatabaseSync(database, {readOnly:true});
  const target = createClient({url, ...(url.startsWith('file:') ? {} : {authToken})});
  let tx;
  try {
    // Use stored configuration when importing an already upgraded local database.
    const hasState = source.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='queue_state'").get();
    const stored = hasState ? source.prepare('SELECT data FROM queue_state WHERE id=1').get() : null;
    if (!stored && !fs.existsSync(queue)) throw new Error('Source data/queue.json is missing. Restore it before importing queues.');
    const state = stored ? JSON.parse(stored.data) : JSON.parse(fs.readFileSync(queue,'utf8'));
    if (!Array.isArray(state.departments)) throw new Error('Invalid source queue configuration.');
    await target.executeMultiple(fs.readFileSync(path.join(__dirname,'../lib/schema.sql'),'utf8'));
    tx = await target.transaction('write');
    for (const name of tables) {
      const count = await tx.execute('SELECT COUNT(*) AS n FROM '+quote(name));
      if (count.rows[0].n) throw new Error('Target already contains application data. Import stopped; nothing overwritten. Use a fresh Turso database for this one-time import.');
    }
    const priorState = await tx.execute('SELECT data FROM queue_state WHERE id=1');
    if (priorState.rows.length) throw new Error('Target already has queue settings. Import stopped; nothing overwritten.');
    const statements = []; const counts = {};
    for (const name of tables) {
      if (!source.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)) continue;
      const rows = source.prepare('SELECT * FROM '+quote(name)).all();
      counts[name] = rows.length;
      const targetColumns = new Set((await tx.execute('PRAGMA table_info('+quote(name)+')')).rows.map(row=>row.name));
      for (const row of rows) {
        const columns = Object.keys(row).filter(key=>targetColumns.has(key));
        statements.push({sql:'INSERT INTO '+quote(name)+'('+columns.map(quote).join(',')+') VALUES('+columns.map(()=>'?').join(',')+')',args:columns.map(key=>row[key])});
      }
    }
    statements.push({sql:'INSERT INTO queue_state(id,data) VALUES(1,?)',args:[JSON.stringify(state)]});
    await tx.batch(statements);
    await tx.commit();
    return counts;
  } catch(error) {
    if (tx) { try { await tx.rollback(); } catch {} }
    throw error;
  } finally { if(tx)tx.close(); source.close(); target.close(); }
}
module.exports={importDatabase};
if (require.main === module) {
  const root=path.join(__dirname,'..');
  const args=process.argv.slice(2);
  if(!args.includes('--confirm-empty-target')) {
    console.error('Back up database/mediqueue.db and data/queue.json, then run: npm run migrate:turso -- --confirm-empty-target');
    process.exitCode=1;
  } else {
    const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
    importDatabase({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN,database:option('--database',path.join(root,'database','mediqueue.db')),queue:option('--queue',path.join(root,'data','queue.json'))})
      .then(counts=>console.log('Import complete. Password hashes, account IDs, queues and settings preserved. Rows imported:',counts))
      .catch(error=>{console.error('Import stopped:',error.message);process.exitCode=1;});
  }
}
