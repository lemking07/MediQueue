'use strict';
try { require('node:process').loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const { createDatabase } = require('../lib/database');
(async () => {
  const db = createDatabase();
  try {
    await db.prepare('SELECT 1 AS connected').get();
    console.log(db.remote ? 'Connected to Turso successfully.' : 'Connected to local SQLite. Turso URL is not configured.');
    const names = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('patients','staff_accounts','visits','queue_state') ORDER BY name").all();
    console.log('Application tables:', names.map(row => row.name).join(', ') || 'None yet. Import existing data or start the upgraded server.');
  } finally { await db.close(); }
})().catch(error => { console.error('Database check failed:', error.code || error.name); process.exitCode = 1; });
