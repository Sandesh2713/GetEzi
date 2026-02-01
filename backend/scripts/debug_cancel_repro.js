
const db = require('../src/db');

// Mock Data logic from server.js
const tokensStmt = {
    getById: db.prepare('SELECT * FROM tokens WHERE id = ?')
};
const usersStmt = {
    getById: db.prepare('SELECT * FROM users WHERE id = ?')
};

// Inspect Latest Token
const token = db.prepare('SELECT * FROM tokens ORDER BY id DESC LIMIT 1').get();
console.log('Token:', token);

if (!token) {
    console.log('Token not found');
    process.exit(1);
}

// Simulate Request User (Customer)
// based on previous debugs, user id might be related to the token's user_id
const reqUser = { id: token.user_id };
console.log('Req User:', reqUser);

// Re-run the logic that failed
try {
    const staffUser = usersStmt.getById.get(reqUser.id);
    console.log('Staff User Lookup:', staffUser);

    const isOwner = token.user_id === reqUser.id;
    console.log('Is Owner Check:', isOwner, `(Token User ID: ${token.user_id} vs Req User ID: ${reqUser.id})`);

    const isStaff = staffUser && ['staff', 'office_owner', 'admin'].includes(staffUser.role);
    console.log('Is Staff Check:', isStaff);

    if (!isStaff && !isOwner) {
        console.log('Would return 403');
    } else {
        console.log('Access GRANTED. Attempting DB Update...');

        // Mock toIso
        const toIso = () => new Date().toISOString();

        // RUN THE QUERY
        // This mirrors server.js line 1370 exactly
        db.transaction(() => {
            tokensStmt.updateStatus.run({
                id: token.id,
                status: 'cancelled',
                completed_at: toIso(),
                called_at: token.called_at,
                allocation_time: token.allocation_time,
                service_start_time: null,
                expected_completion_time: null,
                now: toIso(),
                eta: null,
                appointment_date: null
                // MISSING: assigned_counter, called_by_counter
            });
        })();
        console.log('Update Success!');
    }

} catch (err) {
    console.error('CRASHED:', err);
}
