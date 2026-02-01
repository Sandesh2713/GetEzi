const db = require('../src/db');
const officeId = db.prepare('SELECT id FROM offices LIMIT 1').get()?.id;

// 1. Check Office Config
const office = db.prepare('SELECT avg_service_minutes FROM offices WHERE id = ?').get(officeId);
console.log('Office Config:', office);

// 2. Check CALLED tokens
const called = db.prepare(`SELECT * FROM tokens WHERE office_id = ? AND status = 'CALLED'`).all(officeId);
console.log('CALLED Tokens:', called);
