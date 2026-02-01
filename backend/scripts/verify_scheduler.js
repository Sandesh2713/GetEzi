
const db = require('../src/db');
const SchedulerService = require('../src/logic/SchedulerService');
const { v4: uuidv4 } = require('uuid');

async function runTest() {
    console.log('--- STARTING SCHEDULER VERIFICATION ---');

    // 1. Get an Office
    const office = db.prepare('SELECT * FROM offices LIMIT 1').get();
    if (!office) { console.error('No office found'); process.exit(1); }

    // 2. Create a Test Token (UPCOMING, Today)
    const today = new Date().toISOString().split('T')[0];
    const tokenId = uuidv4();

    // We need a user. Let's use an existing one or create dummy.
    // Fetch last user
    const user = db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 1').get();
    if (!user) { console.error('No user found'); process.exit(1); }

    console.log(`Creating Test Token for ${today} (UPCOMING)...`);
    db.prepare(`
        INSERT INTO tokens (id, office_id, user_id, user_name, user_contact, status, token_number, created_at, appointment_date, service_type)
        VALUES (?, ?, ?, ?, ?, 'UPCOMING', 999, ?, ?, 'Test Service')
    `).run(tokenId, office.id, user.id, 'Test User', 'test@example.com', new Date().toISOString(), today);

    // 3. Verify Initial State
    const tBefore = db.prepare('SELECT status FROM tokens WHERE id = ?').get(tokenId);
    console.log('Status Before:', tBefore.status);

    if (tBefore.status !== 'UPCOMING') {
        console.error('Failed to create UPCOMING token');
        process.exit(1);
    }

    // 4. Run Scheduler Logic
    console.log('Running activateDailyTickets()...');
    await SchedulerService.activateDailyTickets();

    // 5. Verify Final State
    const tAfter = db.prepare('SELECT status, allocation_time FROM tokens WHERE id = ?').get(tokenId);
    console.log('Status After:', tAfter.status);

    if (tAfter.status === 'WAIT') {
        console.log('SUCCESS: Token transitioned to WAIT.');
    } else {
        console.error('FAILURE: Token did not transition.');
    }

    // Cleanup
    db.prepare('DELETE FROM tokens WHERE id = ?').run(tokenId);
}

runTest();
