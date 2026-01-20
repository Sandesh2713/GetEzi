const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'queue.db');

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Initialize tables for offices, tokens, and users (lightweight user store for contact details).
db.exec(`
CREATE TABLE IF NOT EXISTS offices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  daily_capacity INTEGER NOT NULL DEFAULT 0,
  available_today INTEGER NOT NULL DEFAULT 0,
  operating_hours TEXT DEFAULT '',
  latitude REAL,
  longitude REAL,
  avg_service_minutes INTEGER DEFAULT 10,
  owner_id TEXT,
  created_at TEXT NOT NULL,
  history_gaps TEXT DEFAULT '[]',
  last_call_time TEXT,
  service_count INTEGER DEFAULT 0,
  consecutive_slow_count INTEGER DEFAULT 0,
  average_velocity REAL DEFAULT 5.0,
  average_velocity REAL DEFAULT 5.0,
  is_paused INTEGER DEFAULT 0,
  state TEXT DEFAULT 'LIVE',
  pause_started_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'customer',
  dob TEXT,
  gender TEXT,
  age INTEGER,
  age INTEGER,
  is_verified INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  total_no_show INTEGER DEFAULT 0,
  average_delay_minutes REAL DEFAULT 0,
  last_activity_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT NOT NULL,
  user_contact TEXT,
  status TEXT NOT NULL,
  position INTEGER,
  token_number INTEGER,
  eta_minutes INTEGER,
  note TEXT,
  created_at TEXT NOT NULL,
  called_at TEXT,
  completed_at TEXT,
  lat REAL,
  lng REAL,
  travel_time_minutes INTEGER,
  service_type TEXT,
  customer_address TEXT,
  arrival_score REAL,
  arrival_status TEXT,
  expected_arrival_time TEXT,
  assigned_counter INTEGER,
  called_by_counter INTEGER,
  FOREIGN KEY (office_id) REFERENCES offices(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

try {
  db.exec("ALTER TABLE tokens ADD COLUMN customer_address TEXT");
} catch (e) { /* Column likely exists */ }

db.exec(`
CREATE TABLE IF NOT EXISTS queue_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  event TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (token_id) REFERENCES tokens(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS token_history (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT NOT NULL,
  user_contact TEXT,
  status TEXT NOT NULL,
  token_number INTEGER,
  note TEXT,
  created_at TEXT NOT NULL,
  called_at TEXT,
  counter_number INTEGER,
  completed_at TEXT,
  service_type TEXT,
  archived_at TEXT NOT NULL,
  FOREIGN KEY (office_id) REFERENCES offices(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS email_verifications (
  email TEXT PRIMARY KEY,
  otp TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
`);

// Migrations for existing tables
try { db.exec(`ALTER TABLE tokens ADD COLUMN user_id TEXT REFERENCES users(id)`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN lat REAL`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN lng REAL`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN travel_time_minutes INTEGER`); } catch (e) { }
try { db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN service_type TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN owner_id TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0`); } catch (e) { }
try { db.exec(`ALTER TABLE users ADD COLUMN admin_key TEXT`); } catch (e) { }

// History Archival & Retention
try { db.exec(`ALTER TABLE users ADD COLUMN history_retention_days INTEGER DEFAULT 30`); } catch (e) { }
try { db.exec(`ALTER TABLE token_history ADD COLUMN eta_minutes INTEGER`); } catch (e) { }
try { db.exec(`ALTER TABLE token_history ADD COLUMN travel_time_minutes INTEGER`); } catch (e) { }
try { db.exec(`ALTER TABLE token_history ADD COLUMN allocation_time TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE token_history ADD COLUMN service_start_time TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE token_history ADD COLUMN expected_completion_time TEXT`); } catch (e) { }

// New Columns for Queue Logic Rebuild
try { db.exec(`ALTER TABLE offices ADD COLUMN counter_count INTEGER DEFAULT 1`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN max_allocated INTEGER DEFAULT 3`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN allocation_time TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN service_start_time TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN expected_completion_time TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN last_updated_at TEXT`); } catch (e) { }

// AI Arrival Prediction Schema
try { db.exec(`ALTER TABLE users ADD COLUMN total_tokens INTEGER DEFAULT 0`); } catch (e) { }
try { db.exec(`ALTER TABLE users ADD COLUMN total_completed INTEGER DEFAULT 0`); } catch (e) { }
try { db.exec(`ALTER TABLE users ADD COLUMN total_no_show INTEGER DEFAULT 0`); } catch (e) { }
try { db.exec(`ALTER TABLE users ADD COLUMN average_delay_minutes REAL DEFAULT 0`); } catch (e) { }
try { db.exec(`ALTER TABLE users ADD COLUMN last_activity_at TEXT`); } catch (e) { }

try { db.exec(`ALTER TABLE tokens ADD COLUMN arrival_score REAL`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN arrival_status TEXT`); } catch (e) { }
// expected_arrival_time already exists in schema but let's ensure it covers all bases if needed, 
// though 'expected_completion_time' was there, 'expected_arrival_time' is specific to this feature.
try { db.exec(`ALTER TABLE tokens ADD COLUMN expected_arrival_time TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN presence_status TEXT DEFAULT 'PENDING'`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN arrival_confirmed_at TEXT`); } catch (e) { }

// Office Pause Schema
try { db.exec(`ALTER TABLE offices ADD COLUMN state TEXT DEFAULT 'LIVE'`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN pause_started_at TEXT`); } catch (e) { }

// Office Location & Timings Schema
try { db.exec(`ALTER TABLE offices ADD COLUMN address TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN latitude REAL`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN longitude REAL`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN opening_time TEXT DEFAULT '09:00'`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN closing_time TEXT DEFAULT '17:00'`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN lunch_start TEXT DEFAULT '13:00'`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN lunch_end TEXT DEFAULT '13:30'`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN lunch_flex_minutes INTEGER DEFAULT 30`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN auto_noshow_enabled INTEGER DEFAULT 0`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN auto_noshow_grace_minutes INTEGER DEFAULT 5`); } catch (e) { }
try { db.exec(`ALTER TABLE offices ADD COLUMN current_status TEXT DEFAULT 'OPEN'`); } catch (e) { }

// Counter Support Schema
try { db.exec(`ALTER TABLE tokens ADD COLUMN assigned_counter INTEGER`); } catch (e) { }
try { db.exec(`ALTER TABLE tokens ADD COLUMN called_by_counter INTEGER`); } catch (e) { }
try { db.exec(`ALTER TABLE token_history ADD COLUMN counter_number INTEGER`); } catch (e) { }

// NEW: Staff Table (Strict Separation)
db.exec(`
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  office_id TEXT NOT NULL,
  counter_number INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (office_id) REFERENCES offices(id)
);
`);

// MIGRATION: Backfill Staff Table
try {
  const existingStaff = db.prepare("SELECT * FROM users WHERE role = 'staff' AND office_id IS NOT NULL").all();
  const insertStaff = db.prepare("INSERT OR IGNORE INTO staff (id, user_id, office_id, counter_number, created_at) VALUES (@id, @user_id, @office_id, @counter_number, @created_at)");
  const { v4: uuidv4 } = require('uuid');

  existingStaff.forEach(u => {
    insertStaff.run({
      id: uuidv4(),
      user_id: u.id,
      office_id: u.office_id,
      counter_number: u.assigned_counter || 1,
      created_at: new Date().toISOString()
    });
  });
} catch (e) { console.error('Staff Backfill Error:', e); }

// MIGRATION: Notifications Office Scope
try { db.exec(`ALTER TABLE notifications ADD COLUMN office_id TEXT REFERENCES offices(id)`); } catch (e) { }

// Drop obsolete tables or fields if strict cleanup desired (Optional, keeping safe for now)
// NEW: Active Staff Session Table (Real-time Status)
db.exec(`
CREATE TABLE IF NOT EXISTS active_staff (
  user_id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL,
  role TEXT DEFAULT 'operator',
  counter_number INTEGER,
  login_time TEXT,
  last_seen TEXT,
  socket_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (office_id) REFERENCES offices(id)
);
`);

// db.exec(`DROP TABLE IF EXISTS active_staff;`); // We might repurpose active_staff or just use staff table

module.exports = db;
