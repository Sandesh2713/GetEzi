const Database = require('better-sqlite3');
const db = new Database('./data/queue.db');

const rows = db.prepare('SELECT * FROM tokens ORDER BY created_at DESC LIMIT 1').all();
console.log('Latest Token:', rows);

const office = db.prepare('SELECT id, name FROM offices LIMIT 1').get();
console.log('Office ID:', office);
