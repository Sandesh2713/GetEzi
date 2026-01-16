
const db = require('./src/db');
const { v4: uuidv4 } = require('uuid');

// Mock Data
const OFFICE_ID = 'office-repro';
const USER_A = 'user-a';
const USER_B = 'user-b';

console.log('--- START REPRO ---');

// 1. Setup Office & Counters
// Disable FK for cleanup
db.pragma('foreign_keys = OFF');
db.prepare('DELETE FROM queue_events').run();
db.prepare('DELETE FROM token_history').run();
db.prepare('DELETE FROM tokens').run();
db.prepare('DELETE FROM active_staff').run();
db.prepare('DELETE FROM counters').run();
db.prepare('DELETE FROM offices').run();
db.pragma('foreign_keys = ON');

db.prepare(`
  INSERT INTO offices (id, name, service_type, created_at, counter_count, max_allocated)
  VALUES (?, 'Test Office', 'General', ?, 2, 6)
`).run(OFFICE_ID, new Date().toISOString());

// Sync Counters (simulate startup or first load)
// We manually populate counters to match server logic
const sync = () => {
    db.prepare('DELETE FROM counters WHERE office_id = ?').run(OFFICE_ID);
    db.prepare('INSERT INTO counters (office_id, counter_number) VALUES (?, 1)').run(OFFICE_ID);
    db.prepare('INSERT INTO counters (office_id, counter_number) VALUES (?, 2)').run(OFFICE_ID);
};
sync();

console.log('Counters initialized: 2');

// Mock assignStaffRole (Copy-pasted logic for testing)
const assignStaffRole = (officeId, userId) => {
    const countersStmt = {
        checkOwner: db.prepare(`SELECT * FROM counters WHERE admin_id = ?`),
        tryClaim: db.prepare(`
            UPDATE counters 
            SET admin_id = @adminId
            WHERE id = (
              SELECT id FROM counters 
              WHERE office_id = @officeId AND admin_id IS NULL 
              ORDER BY counter_number ASC LIMIT 1
            )
        `),
        getCounterByOwner: db.prepare(`SELECT counter_number FROM counters WHERE admin_id = ?`),
        release: db.prepare(`UPDATE counters SET admin_id = NULL WHERE admin_id = ?`)
    };

    try {
        db.prepare('BEGIN IMMEDIATE').run();

        // 1. Check if user already owns a counter
        const existing = countersStmt.checkOwner.get(userId);
        if (existing) {
            if (existing.office_id === officeId) {
                db.prepare('COMMIT').run();
                return { role: 'OPERATOR', counter_number: existing.counter_number, notes: 'Existing' };
            } else {
                countersStmt.release.run(userId);
            }
        }

        // 2. Try to claim
        const result = countersStmt.tryClaim.run({ adminId: userId, officeId });

        let res;
        if (result.changes === 1) {
            const row = countersStmt.getCounterByOwner.get(userId);
            res = { role: 'OPERATOR', counter_number: row.counter_number, notes: 'New Claim' };
        } else {
            res = { role: 'SPECTATOR', counter_number: null, notes: 'Full' };
        }
        db.prepare('COMMIT').run();
        return res;
    } catch (e) {
        try { db.prepare('ROLLBACK').run(); } catch (e2) { }
        console.error(e);
        return { error: e.message };
    }
};

// TEST 1: User A Login
console.log('\n--- Test 1: User A Login ---');
const resA = assignStaffRole(OFFICE_ID, USER_A);
console.log('User A:', resA);


// TEST 2: User B Login
console.log('\n--- Test 2: User B Login ---');
const resB = assignStaffRole(OFFICE_ID, USER_B);
console.log('User B:', resB);

// TEST 3: User A Login Again (Same Creds)
console.log('\n--- Test 3: User A Login Again ---');
const resA2 = assignStaffRole(OFFICE_ID, USER_A);
console.log('User A (Again):', resA2);

// TEST 4: User C Login (Should fail/Spectator)
console.log('\n--- Test 4: User C Login (Overflow) ---');
const resC = assignStaffRole(OFFICE_ID, 'user-c');
console.log('User C:', resC);

// DUMP TABLE
console.log('\n--- DB State ---');
const rows = db.prepare('SELECT * FROM counters').all();
console.table(rows);
