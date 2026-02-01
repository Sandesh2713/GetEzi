const db = require('../src/db');
const officeId = db.prepare('SELECT id FROM offices LIMIT 1').get()?.id;

// Check active_counters specifically
const office = db.prepare('SELECT active_counters, counter_count FROM offices WHERE id = ?').get(officeId);
console.log('Office Config Counters:', office);
