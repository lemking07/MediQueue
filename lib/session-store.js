'use strict';
const session = require('express-session');
module.exports = class DatabaseSessionStore extends session.Store {
  constructor(db) { super(); this.db = db; }
  get(sid, callback) {
    this.db.prepare('SELECT data FROM app_sessions WHERE sid=? AND expires_at>?').get(sid, Date.now())
      .then(row => callback(null, row ? JSON.parse(row.data) : null)).catch(callback);
  }
  set(sid, value, callback = () => {}) {
    const expires = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 8*60*60*1000;
    this.db.prepare('INSERT INTO app_sessions(sid,data,expires_at) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at')
      .run(sid, JSON.stringify(value), expires).then(() => callback()).catch(callback);
  }
  touch(sid, value, callback = () => {}) {
    const expires = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 8*60*60*1000;
    this.db.prepare('UPDATE app_sessions SET expires_at=? WHERE sid=?').run(expires, sid).then(() => callback()).catch(callback);
  }
  destroy(sid, callback = () => {}) {
    this.db.prepare('DELETE FROM app_sessions WHERE sid=?').run(sid).then(() => callback()).catch(callback);
  }
};
