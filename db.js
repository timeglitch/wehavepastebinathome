const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('pastes.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS pastes (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT NOT NULL,
    language TEXT DEFAULT 'plaintext',
    created_at INTEGER NOT NULL,
    expires_at INTEGER
  )
`);

const insert = db.prepare(`
  INSERT INTO pastes (id, title, content, language, created_at, expires_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const get = db.prepare(`SELECT * FROM pastes WHERE id = ?`);
const del = db.prepare(`DELETE FROM pastes WHERE id = ?`);
const expire = db.prepare(`DELETE FROM pastes WHERE expires_at IS NOT NULL AND expires_at < ?`);

module.exports = {
  insert({ id, title, content, language, created_at, expires_at }) {
    insert.run(id, title ?? null, content, language ?? 'plaintext', created_at, expires_at ?? null);
  },
  get(id) {
    const row = get.get(id);
    if (!row) return null;
    if (row.expires_at && row.expires_at < Date.now()) {
      del.run(id);
      return null;
    }
    return row;
  },
  cleanup() {
    expire.run(Date.now());
  },
};
