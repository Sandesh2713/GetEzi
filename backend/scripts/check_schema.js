
const db = require('../src/db');
const info = db.pragma('table_info(offices)');
console.table(info);
