const db = require('../db');

console.log('Starting System Reset...');

try {
    // Disable foreign keys to allow indiscriminate deletion
    db.pragma('foreign_keys = OFF');

    const tables = [
        'users',
        'offices',
        'tokens',
        'token_history',
        'queue_events',
        'notifications',
        'staff',
        'email_verifications',
        'active_staff'
    ];

    tables.forEach(table => {
        try {
            db.prepare(`DELETE FROM ${table}`).run();
            console.log(`Cleared table: ${table}`);

            // Reset Auto Increment if applicable
            try {
                db.prepare(`DELETE FROM sqlite_sequence WHERE name='${table}'`).run();
            } catch (e) { }
        } catch (err) {
            if (!err.message.includes('no such table')) {
                console.error(`Error clearing ${table}:`, err.message);
            }
        }
    });

    db.pragma('foreign_keys = ON');

    // Optional: Vacuum to reclaim space
    db.exec('VACUUM');

    console.log('System Reset Complete. All data wiped.');
} catch (err) {
    console.error('Fatal Reset Error:', err);
}
