const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// ===== RENDER SAFE STORAGE =====
// Always create DB inside project folder – NOT root "/data"
const dataDir = path.resolve(__dirname, '../data');

// Create directory only if not exists (prevents permission crash)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'queue.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// ================= TABLES =================
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
  called_by_counter INTEGER
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS queue_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  event TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  office_id TEXT
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
  eta_minutes INTEGER,
  travel_time_minutes INTEGER,
  allocation_time TEXT,
  service_start_time TEXT,
  expected_completion_time TEXT
);

CREATE TABLE IF NOT EXISTS email_verifications (
  email TEXT PRIMARY KEY,
  otp TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  office_id TEXT NOT NULL,
  counter_number INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS active_staff (
  user_id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL,
  role TEXT DEFAULT 'operator',
  counter_number INTEGER,
  login_time TEXT,
  last_seen TEXT,
  socket_id TEXT
);
`);

// ===== SAFE MIGRATIONS =====
const migrations = [
  "ALTER TABLE tokens ADD COLUMN customer_address TEXT",
  "ALTER TABLE tokens ADD COLUMN user_id TEXT",
  "ALTER TABLE tokens ADD COLUMN lat REAL",
  "ALTER TABLE tokens ADD COLUMN lng REAL",
  "ALTER TABLE tokens ADD COLUMN travel_time_minutes INTEGER",
  "ALTER TABLE tokens ADD COLUMN service_type TEXT",
  "ALTER TABLE tokens ADD COLUMN arrival_score REAL",
  "ALTER TABLE tokens ADD COLUMN arrival_status TEXT",
  "ALTER TABLE tokens ADD COLUMN expected_arrival_time TEXT",
  "ALTER TABLE tokens ADD COLUMN presence_status TEXT DEFAULT 'PENDING'",
  "ALTER TABLE tokens ADD COLUMN arrival_confirmed_at TEXT",

  "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'",
  "ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN admin_key TEXT",
  "ALTER TABLE users ADD COLUMN history_retention_days INTEGER DEFAULT 30",

  "ALTER TABLE offices ADD COLUMN owner_id TEXT",
  "ALTER TABLE offices ADD COLUMN address TEXT",
  "ALTER TABLE offices ADD COLUMN opening_time TEXT DEFAULT '09:00'",
  "ALTER TABLE offices ADD COLUMN closing_time TEXT DEFAULT '17:00'",
  "ALTER TABLE offices ADD COLUMN lunch_start TEXT DEFAULT '13:00'",
  "ALTER TABLE offices ADD COLUMN lunch_end TEXT DEFAULT '13:30'",
  "ALTER TABLE offices ADD COLUMN lunch_flex_minutes INTEGER DEFAULT 30",
  "ALTER TABLE offices ADD COLUMN auto_noshow_enabled INTEGER DEFAULT 0",
  "ALTER TABLE offices ADD COLUMN auto_noshow_grace_minutes INTEGER DEFAULT 5",
];

for (const sql of migrations) {
  try { db.exec(sql); } catch (e) { /* ignore if exists */ }
}

module.exports = db;
