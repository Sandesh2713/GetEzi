const db = require('../src/db');

const officeId = db.prepare('SELECT id FROM offices LIMIT 1').get()?.id;
if (!officeId) {
    console.log("No office found.");
    process.exit();
}

console.log(`Checking Office: ${officeId}`);

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const dateStr = `${year}-${month}-${day}`;
console.log(`Date: ${dateStr}`);

// 1. List all active tokens
const tokens = db.prepare(`
    SELECT token_number, status, appointment_date, created_at 
    FROM tokens 
    WHERE office_id = ? 
    ORDER BY token_number ASC
`).all(officeId);

console.table(tokens);

// 2. Run Count Query
const countStmt = db.prepare(`
        SELECT COUNT(*) as count 
        FROM tokens 
        WHERE office_id = ? 
        AND status IN ('WAIT', 'ALLOCATED') 
        AND (appointment_date = ? OR appointment_date IS NULL)
`);

const result = countStmt.get(officeId, dateStr);
console.log("People Ahead Count:", result.count);
