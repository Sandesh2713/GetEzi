const db = require('../src/db');
const tokenNum = 13; // Focus on reported token

const officeId = db.prepare('SELECT id FROM offices LIMIT 1').get()?.id;
console.log(`Checking Office: ${officeId}`);

const token = db.prepare(`
    SELECT * 
    FROM tokens 
    WHERE office_id = ? AND token_number = ?
`).get(officeId, tokenNum);

console.log("Token Details:", token);

// Check head of queue
const head = db.prepare(`
    SELECT COUNT(*) as ahead 
    FROM tokens 
    WHERE office_id = ? 
    AND status IN ('WAIT', 'ALLOCATED')
    AND created_at < ?
`).get(officeId, token.created_at);

console.log("People Strictly Ahead:", head.ahead);
