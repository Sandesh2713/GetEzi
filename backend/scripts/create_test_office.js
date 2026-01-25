const db = require('../src/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const createTestOffice = () => {
    const email = 'test_247@example.com';
    const password = 'password123';
    const name = 'Test Office 24x7';

    // 1. Check if exists
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existing) {
        console.log('Test user already exists.');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        return;
    }

    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();

    // 2. Create User
    db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, created_at, is_verified)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(userId, name, email, passwordHash, 'office_owner', now);

    // 3. Create Office
    const officeId = uuidv4();
    db.prepare(`
    INSERT INTO offices (
      id, name, service_type, daily_capacity, available_today, 
      operating_hours, opening_time, closing_time, 
      working_days, allow_sunday,
      latitude, longitude, avg_service_minutes, owner_id, created_at, 
      counter_count, max_allocated, address, auto_noshow_enabled, state
    )
    VALUES (
      @id, @name, @service_type, @daily_capacity, @daily_capacity, 
      @operating_hours, @opening_time, @closing_time, 
      @working_days, @allow_sunday,
      @latitude, @longitude, @avg_service_minutes, @owner_id, @created_at, 
      @counter_count, @max_allocated, @address, @auto_noshow_enabled, 'LIVE'
    )
  `).run({
        id: officeId,
        name: name,
        service_type: 'General,Priority 24x7',
        daily_capacity: 500,
        operating_hours: '00:00-23:59',
        opening_time: '00:00',
        closing_time: '23:59',
        working_days: 'Mon,Tue,Wed,Thu,Fri,Sat',
        allow_sunday: 1,
        latitude: 12.9716,
        longitude: 77.5946,
        avg_service_minutes: 5,
        owner_id: userId,
        created_at: now,
        counter_count: 5,
        max_allocated: 500,
        address: '123 Test St, 24x7 Zone',
        auto_noshow_enabled: 0
    });

    console.log('=== Test Office Created ===');
    console.log(`Office: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('Timings: 24x7 (Mon-Sun, 00:00 - 23:59)');
};

createTestOffice();
