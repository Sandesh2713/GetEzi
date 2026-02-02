const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const db = require('./db');
const bcrypt = require('bcryptjs');
const OfficeStatusEngine = require('./logic/OfficeStatusEngine');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const ExcelJS = require('exceljs');
const emailTemplates = require('./email_templates');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 4000;
const adminKey = process.env.ADMIN_KEY || 'changeme-admin-key';
const clientOrigin = process.env.CLIENT_ORIGIN || '*';
const jwtSecret = process.env.JWT_SECRET || 'super-secret-jwt-key';
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

/* --- Socket.IO Setup --- */
const io = new Server(server, {
  cors: {
    origin: clientOrigin.split(',').map(s => s.trim()),
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_office', (officeId) => {
    socket.join(`office_${officeId}`);
    // Emit initial status?
  });

  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('admin_heartbeat', (userId) => {
    try {
      if (!userId) return;
      const now = Date.now();

      activeStaffStmt.updateHeartbeat.run({
        now: new Date(now).toISOString(),
        socket_id: socket.id,
        user_id: userId
      });
      // No more pulse or counter locks. Pure session tracking.

    } catch (e) { console.error('Heartbeat Error:', e); }
  });
});

// --- Automatic Staff Cleanup (Ghost Counter Prevention) ---
// --- Automatic Staff Cleanup (Ghost Counter Prevention) ---
setInterval(() => {
  try {
    const NOW = Date.now();
    const CUTOFF_MS = NOW - 30000; // 30s grace (User Req)
    const CUTOFF_ISO = new Date(CUTOFF_MS).toISOString();

    // 1. Find Stale Counters (Ghost Desks) - Driven by Active Staff now
    // If active_staff is stale, we release them, which frees the counter.
    // So we don't query countersStmt.getStale anymore.

    // 2. Find Stale Spectators (Ghost Sessions)
    const staleSessions = activeStaffStmt.getStale.all({ cutoff: CUTOFF_ISO });
    const toRelease = new Set([...staleSessions.map(s => s.user_id)]);

    if (toRelease.size > 0) {
      toRelease.forEach(userId => releaseStaff(userId));
    }
  } catch (e) {
    console.error('Staff Cleanup Job Error:', e);
  }
}, 5000);


// --- Strict No-Show Automation (Every 1 min) ---
cron.schedule('* * * * *', () => {
  try {
    const offices = officesStmt.getAll.all();
    const nowMs = Date.now();
    const nowIso = new Date().toISOString();

    offices.forEach(office => {
      // Get active tokens for today
      const tokens = tokensStmt.getForOffice.all(office.id)

        .filter(t => t.status !== 'COMPLETED' && t.status !== 'cancelled' && t.status !== 'no-show' && t.status !== 'history');

      tokens.forEach(t => {
        // Requirement: If Customer has NOT arrived by ETA + 5 mins
        if (t.expected_arrival_time && t.presence_status !== 'ARRIVED') {
          const etaTime = new Date(t.expected_arrival_time).getTime();
          const gracePeriod = 5 * 60 * 1000; // 5 minutes

          if (nowMs > (etaTime + gracePeriod)) {
            console.log(`[Auto No-Show] Token ${t.token_number} missed ETA ${t.expected_arrival_time} by >5m.`);

            // Mark as NO-SHOW
            tokensStmt.updateStatus.run({
              id: t.id,
              status: 'no-show',
              allocation_time: t.allocation_time,
              service_start_time: null,
              expected_completion_time: null,
              called_at: null,
              completed_at: nowIso, // Terminated at now
              now: nowIso,
              eta: null,
              assigned_counter: null,
              called_by_counter: null,
              appointment_date: t.appointment_date
            });

            // Email Notification
            const recipientEmail = (t.user_contact && t.user_contact.includes('@')) ? t.user_contact : t.user_email;
            if (recipientEmail) {
              sendEmail(recipientEmail, 'Missed Appointment - GetEzi', emailTemplates.tokenNoShow(t.user_name, t.token_number, office.name));
            }

            // Trigger Refresh
            recalculateQueue(office.id);
            io.to(`office_${office.id}`).emit('token_update', { id: t.id, status: 'no-show' });
          }
        }
      });
    });
  } catch (e) {
    console.error('No-Show Cron Error:', e);
  }
});

/* --- Smart Daily Scheduler (Every 5 mins) --- */
const SchedulerService = require('./logic/SchedulerService');
cron.schedule('*/5 * * * *', () => {
  SchedulerService.activateDailyTickets();
});

/* --- Email Helper --- */
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: smtpUser, pass: smtpPass },
});

const sendEmail = async (to, subject, htmlContent) => {
  console.log('--- EMAIL SENDING START ---');
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('SMTP Configured:', !!smtpUser && !!smtpPass);

  if (!smtpUser || !smtpPass) return console.log('Mock Email (Missing Config):', { to, subject });

  try {
    // Generate Check: Content Security (though templates handle escaping, double check is good practice)
    if (!htmlContent || typeof htmlContent !== 'string') {
      console.warn('sendEmail received invalid content');
      return;
    }

    // Generate Plain Text Fallback
    const textContent = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style blocks
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();

    const mailOptions = {
      from: `"GetEzi Team" <${smtpUser}>`,
      to,
      subject,
      html: htmlContent,
      text: textContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (err) {
    console.error('Error sending email:', err);
  }
};

/* --- Restored Endpoints to MATCH App.jsx expectation --- */

// OTP Routes (Missing)
const emailVerificationsStmt = {
  upsert: db.prepare(`INSERT INTO email_verifications (email, otp, expires_at) VALUES (@email, @otp, @expires_at) ON CONFLICT(email) DO UPDATE SET otp = @otp, expires_at = @expires_at`),
  get: db.prepare(`SELECT * FROM email_verifications WHERE email = ?`),
  delete: db.prepare(`DELETE FROM email_verifications WHERE email = ?`),
};

app.post('/api/auth/send-otp', async (req, res) => {
  const { email, type } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
  // Send OTP via HTML Email
  emailVerificationsStmt.upsert.run({ email, otp, expires_at: expiresAt });
  try {
    const html = emailTemplates.otp(otp);
    await sendEmail(email, 'Your Verification Code - GetEzi', html);
  } catch (err) {
    console.error("Failed to send OTP email:", err);
  }

  res.json({ message: 'OTP sent' });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const record = emailVerificationsStmt.get.get(email);
  if (!record || record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
  usersStmt.insert.run({ id: uuidv4(), name: 'Verified User', email, hash: 'temp', role: 'customer', created_at: toIso() }); // Stub

  // Email Notification: Welcome
  sendEmail(email, 'Welcome to GetEzi!', emailTemplates.welcomeCustomer('Verified User'));

  res.json({ success: true });
});

app.post('/api/auth/reset-password', (req, res) => {
  // Stub
  res.json({ success: true });
});

// CORS Configuration - Allow localhost origins for development
const allowedOrigins = clientOrigin === '*'
  ? ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174']
  : clientOrigin.split(',').map((s) => s.trim());


// 🔥 DEV TUNNEL SAFE CORS
app.use(cors({
  origin: "*",
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"]
}));

// Handle preflight
app.options(/.*/, cors());


app.use(express.json());
app.use(morgan('dev'));

const toIso = () => new Date().toISOString();

// Middleware: Authenticate Token
// Middleware: Authenticate Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  // console.log('[AuthDebug] Header:', authHeader); // Debug log
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('[AuthError] Token verification failed:', err.message);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Middleware: Strict Office Guard
const requireOffice = (req, res, next) => {
  if (!req.user || !req.user.office_id) {
    return res.status(403).json({ error: 'Access Denied: No Office Context' });
  }
  next();
};

const requireRole = (roles) => (req, res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};



/* --- Database Statements --- */
const officesStmt = {
  getById: db.prepare(`SELECT * FROM offices WHERE id = ?`),
  getAll: db.prepare(`SELECT * FROM offices ORDER BY created_at DESC`),
  insert: db.prepare(`
    INSERT INTO offices (
      id, name, service_type, daily_capacity, available_today, operating_hours, latitude, longitude, avg_service_minutes, owner_id, created_at, counter_count, max_allocated,
      address, opening_time, closing_time, lunch_start, lunch_end, auto_noshow_enabled, working_days, allow_sunday
    )
    VALUES (
      @id, @name, @service_type, @daily_capacity, @daily_capacity, @operating_hours, @latitude, @longitude, @avg_service_minutes, @owner_id, @created_at, @counter_count, @max_allocated,
      @address, @opening_time, @closing_time, @lunch_start, @lunch_end, @auto_noshow_enabled, @working_days, @allow_sunday
    )
  `),
  updateStats: db.prepare(`UPDATE offices SET avg_service_minutes = @avg WHERE id = @id`),
  updateConfig: db.prepare(`UPDATE offices SET counter_count = @n, max_allocated = @m WHERE id = @id`),
  updateState: db.prepare(`UPDATE offices SET state = @state, pause_started_at = @time WHERE id = @id`),
  updateTimings: db.prepare(`
    UPDATE offices SET 
      address = @address, latitude = @latitude, longitude = @longitude,
      opening_time = @opening_time, closing_time = @closing_time,
      lunch_start = @lunch_start, lunch_end = @lunch_end, lunch_flex_minutes = @lunch_flex_minutes,
      auto_noshow_enabled = @auto_noshow_enabled, auto_noshow_grace_minutes = @auto_noshow_grace_minutes,
      working_days = @working_days, allow_sunday = @allow_sunday, daily_capacity = @daily_capacity
    WHERE id = @id
  `),
};

const tokensStmt = {
  getById: db.prepare(`SELECT * FROM tokens WHERE id = ?`),
  getForOffice: db.prepare(`
    SELECT t.*, u.dob, u.gender, u.email as user_email
    FROM tokens t
    LEFT JOIN users u ON t.user_id = u.id 
    WHERE t.office_id = ? 
    ORDER BY t.created_at ASC
  `),
  insert: db.prepare(`
    INSERT INTO tokens (id, office_id, user_id, user_name, user_contact, status, token_number, created_at, lat, lng, travel_time_minutes, service_type, customer_address, appointment_date)
    VALUES (@id, @office_id, @user_id, @user_name, @user_contact, @status, @token_number, @created_at, @lat, @lng, @travel_time_minutes, @service_type, @customer_address, @appointment_date)
  `),
  updateStatus: db.prepare(`
    UPDATE tokens SET 
      status = @status, 
      allocation_time = COALESCE(@allocation_time, allocation_time),
      service_start_time = COALESCE(@service_start_time, service_start_time),
      expected_completion_time = COALESCE(@expected_completion_time, expected_completion_time),
      last_updated_at = @now,
      called_at = COALESCE(@called_at, called_at),
      completed_at = COALESCE(@completed_at, completed_at),
      eta_minutes = @eta,
      assigned_counter = COALESCE(@assigned_counter, assigned_counter),
      called_by_counter = COALESCE(@called_by_counter, called_by_counter),
      appointment_date = COALESCE(@appointment_date, appointment_date)
    WHERE id = @id
  `),
  countByDate: db.prepare(`SELECT COUNT(*) as count FROM tokens WHERE office_id = ? AND appointment_date = ? AND status NOT IN ('cancelled', 'no-show')`),
  getMaxTokenNum: db.prepare(`SELECT COALESCE(MAX(token_number), 0) as maxNum FROM tokens WHERE office_id = ?`),
  markArrived: db.prepare(`UPDATE tokens SET presence_status = 'ARRIVED', arrival_confirmed_at = @now WHERE id = @id`),
  updateEligibility: db.prepare(`UPDATE tokens SET eligibility_time = @time WHERE id = @id`),
  getForUser: db.prepare(`
    SELECT t.*, o.name as office_name, o.address as office_address
    FROM tokens t
    LEFT JOIN offices o ON t.office_id = o.id
    WHERE t.user_id = ? AND t.status NOT IN ('COMPLETED', 'cancelled', 'no-show', 'history')
    ORDER BY t.created_at ASC
  `),
};

// --- VALIDATION HELPERS ---
const isHoliday = (officeId, dateStr) => {
  return !!officeHolidaysStmt.checkDate.get(officeId, dateStr);
};

const isClosedDay = (office, dateStr) => {
  const date = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = days[date.getDay()];

  // Special Sunday Logic (overrides working_days)
  if (dayName === 'Sun') {
    return !office.allow_sunday;
  }

  // Default working days if not set
  const workingDays = (office.working_days || 'Mon,Tue,Wed,Thu,Fri,Sat').split(',').map(d => d.trim());

  if (!workingDays.includes(dayName)) return true;
  return false;
};

const isCapacityFull = (officeId, dateStr, capacity) => {
  if (!capacity || capacity <= 0) return false;
  const count = tokensStmt.countByDate.get(officeId, dateStr).count;
  return count >= capacity;
};

const usersStmt = {
  getById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  getByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  insert: db.prepare(`INSERT INTO users (id, name, email, password_hash, role, created_at, is_verified) VALUES (@id, @name, @email, @hash, @role, @created_at, 0)`),
  insert: db.prepare(`INSERT INTO users (id, name, email, password_hash, role, created_at, is_verified) VALUES (@id, @name, @email, @hash, @role, @created_at, 0)`),
  updateRetention: db.prepare(`UPDATE users SET history_retention_days = ? WHERE id = ?`),
  getRetention: db.prepare(`SELECT history_retention_days FROM users WHERE id = ?`),
  updateStats: db.prepare(`
    UPDATE users SET 
      total_tokens = total_tokens + 1,
      total_completed = total_completed + @completed_inc,
      total_no_show = total_no_show + @no_show_inc,
      average_delay_minutes = (average_delay_minutes * total_tokens + @delay) / (total_tokens + 1),
      last_activity_at = @now
    WHERE id = @id
  `),
  updateActivity: db.prepare(`UPDATE users SET last_activity_at = @now WHERE id = @id`),
  update: db.prepare(`
    UPDATE users SET
      name = @name,
      email = @email,
      phone = @phone,
      dob = @dob,
      age = @age,
      gender = @gender,
      blood_type = @blood_type,
      address = @address,
      city = @city,
      state = @state,
      zip_code = @zip_code,
      emergency_contact_name = @emergency_contact_name,
      emergency_contact_phone = @emergency_contact_phone,
      allergies = @allergies,
      medical_notes = @medical_notes
    WHERE id = @id
  `)
};

tokensStmt.updatePrediction = db.prepare(`
    UPDATE tokens SET 
      arrival_score = @score,
      arrival_status = @status,
      expected_arrival_time = @expected_time
    WHERE id = @id
  `);
tokensStmt.updateTravelTime = db.prepare(`UPDATE tokens SET travel_time_minutes = @travel WHERE id = @id`);


const historyStmt = {
  archive: db.prepare(`
    INSERT INTO token_history (id, office_id, user_id, user_name, user_contact, status, token_number, note, created_at, called_at, completed_at, service_type, archived_at, eta_minutes, travel_time_minutes, allocation_time, service_start_time, expected_completion_time, counter_number)
    SELECT id, office_id, user_id, user_name, user_contact, status, token_number, note, created_at, called_at, completed_at, service_type, @archivedAt, eta_minutes, travel_time_minutes, allocation_time, service_start_time, expected_completion_time, called_by_counter
    FROM tokens
    WHERE appointment_date IS NULL OR appointment_date <= @today
  `),
  deleteArchivedTokens: db.prepare(`DELETE FROM tokens WHERE appointment_date IS NULL OR appointment_date <= @today`), // Wipes active tokens table (respecting future)
  cleanupOldHistory: db.prepare(`DELETE FROM token_history WHERE archived_at < ?`), // Global fallback
  cleanupForOffice: db.prepare(`DELETE FROM token_history WHERE office_id = ? AND archived_at < ?`),
  getAll: db.prepare(`SELECT * FROM token_history ORDER BY created_at DESC LIMIT 1000`), // Limit for safety
  getByFilter: db.prepare(`SELECT * FROM token_history WHERE office_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at DESC`),
};



/* --- Helpers (Restored) --- */

const activeStaffStmt = {
  getForOffice: db.prepare(`SELECT * FROM active_staff WHERE office_id = ? ORDER BY role, counter_number`),
  getByUser: db.prepare(`SELECT * FROM active_staff WHERE user_id = ?`),
  insert: db.prepare(`INSERT OR REPLACE INTO active_staff (user_id, office_id, role, counter_number, login_time) VALUES (@user_id, @office_id, @role, @counter_number, @login_time)`),
  delete: db.prepare(`DELETE FROM active_staff WHERE user_id = ?`),
  countOperators: db.prepare(`SELECT COUNT(*) as count FROM active_staff WHERE office_id = ? AND role = 'OPERATOR'`),
  getOldestSpectator: db.prepare(`SELECT * FROM active_staff WHERE office_id = ? AND role = 'SPECTATOR' ORDER BY login_time ASC LIMIT 1`),
  updateRole: db.prepare(`UPDATE active_staff SET role = 'OPERATOR', counter_number = ? WHERE user_id = ?`),
  updateHeartbeat: db.prepare(`UPDATE active_staff SET last_seen = @now, socket_id = @socket_id WHERE user_id = @user_id`),
  getStale: db.prepare(`SELECT * FROM active_staff WHERE last_seen < @cutoff`)
};

const officeHolidaysStmt = {
  checkDate: db.prepare(`SELECT id, reason FROM office_holidays WHERE office_id = ? AND date = ?`),
  add: db.prepare(`INSERT OR IGNORE INTO office_holidays (id, office_id, date, reason, created_at) VALUES (@id, @office_id, @date, @reason, @created_at)`),
  remove: db.prepare(`DELETE FROM office_holidays WHERE id = @id AND office_id = @office_id`),
  list: db.prepare(`SELECT * FROM office_holidays WHERE office_id = ? ORDER BY date ASC`)
};


// --- STAFF LOGIC REMOVED (countersStmt, syncCounters, assignStaffRole, releaseStaff) ---
// Now using Static Assignment in 'users' table.

const getActiveStaffCount = (officeId) => {
  // Count staff who are currently online (active_staff) AND have assigned_counter <= active_counters
  const office = officesStmt.getById.get(officeId);
  if (!office) return 0;

  let sessions = [];
  try {
    sessions = activeStaffStmt.getForOffice.all(officeId);
  } catch (e) {
    console.error("FATAL: getActiveStaffCount -> activeStaffStmt.getForOffice.all failed", e);
    return 0;
  }

  return sessions.filter(s => {
    const u = usersStmt.getById.get(s.user_id);
    return u && u.assigned_counter && u.assigned_counter <= (office.active_counters || 1);
  }).length;
};

const getNextTokenNumber = (officeId, dateStr) => {
  // If dateStr is not provided, default to today
  let checkDate = dateStr;
  if (!checkDate) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    checkDate = `${y}-${m}-${d}`;
  }

  const stmt = db.prepare('SELECT MAX(token_number) as maxNum FROM tokens WHERE office_id = ? AND appointment_date = ?');
  const result = stmt.get(officeId, checkDate);
  return (result.maxNum || 0) + 1;
};

const enrichTokens = (tokens) => {
  const now = Date.now();
  return tokens.map(t => {
    let time_state = 'FUTURE';
    let service_start_time = t.service_start_time;

    if (service_start_time) {
      const tTime = new Date(service_start_time).getTime();
      if (tTime < now) {
        time_state = 'PAST';
        // HARD GUARANTEE: Do not send past timestamps
        service_start_time = null;
      } else if (tTime - now < 60000) {
        time_state = 'NOW';
      }
    }

    // Clear time state for terminal statuses
    if (['COMPLETED', 'cancelled', 'no-show', 'history'].includes(t.status)) {
      time_state = null;
    }

    return { ...t, time_state, service_start_time };
  });
};

/* --- Helpers --- */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const toRad = x => x * Math.PI / 180;
  const R = 6371e3; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); // returns meters
};

const calculateTravelETA = (distanceMeters) => {
  if (!distanceMeters) return 1;

  // Fallback: 60km/h => 1000m = 1 minute
  // travelMinutes = (distanceKm / 60) * 60 = distanceKm
  const km = distanceMeters / 1000;
  const mins = Math.ceil(km);
  return Math.max(1, mins); // No upper cap mentioned by user, but keeping min 1 is safe
};

// Travel Time Calculation (Simple Constant Speed)
const calculateTravelTime = async (originLat, originLng, destLat, destLng) => {
  console.log(`[DEBUG] Travel Calc: Origin(${originLat},${originLng}) -> Dest(${destLat},${destLng})`);
  if (originLat == null || originLng == null || destLat == null || destLng == null) {
    console.log('[DEBUG] Missing Coordinates for Travel Calc');
    return null;
  }

  // 1. Calculate Distance (Haversine)
  const meters = haversineDistance(originLat, originLng, destLat, destLng);
  console.log(`[DEBUG] Distance: ${meters} meters`);

  // 2. Calculate Travel Time (60 km/h)
  const minutes = calculateTravelETA(meters);

  return {
    minutes,
    distanceKm: (meters / 1000).toFixed(1),
    source: 'Haversine (Constant 60km/h)'
  };
};

const EtaService = {
  // Travel Time (OSRM -> Haversine Fallback)
  // Note: Using 'fetch' (Node 18+)
  getTravelTime: async (originLat, originLng, destLat, destLng) => {
    // Use the comprehensive helper now
    const result = await calculateTravelTime(originLat, originLng, destLat, destLng);
    return result ? result.minutes : 1; // Default to 1 min if fail
  },

  adjustForLunch: (startTimeMs, office) => {
    if (!office.lunch_start || !office.lunch_end) return new Date(startTimeMs);

    const date = new Date(startTimeMs);
    const dateStr = date.toISOString().split('T')[0];

    const lunchStart = new Date(`${dateStr}T${office.lunch_start}:00`);
    const lunchEnd = new Date(`${dateStr}T${office.lunch_end}:00`);

    if (date >= lunchStart && date < lunchEnd) {
      return lunchEnd;
    }
    return date;
  },

  processQueue: async (office, tokens) => {
    // 1. Sort: Created At (FIFO)
    const activeTokens = tokens.filter(t => ['WAIT', 'ALLOCATED', 'CALLED'].includes(t.status));
    activeTokens.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // 2. Count Active Counters
    const activeStaff = getActiveStaffCount(office.id);
    const N = Math.max(1, activeStaff);
    const serviceTime = office.avg_service_minutes || 10;

    // Process in Parallel
    const tokenPromises = activeTokens.map(async (token, index) => {
      const et = { ...token };

      // Determine Position 0-based index in FILTERED list (activeTokens)
      // Note: index IS the position in the queue
      let positionIndex = index;

      // A. Travel Time (Async)
      // Check if we need to fetch travel time
      let travel = et.travel_time_minutes;
      let didFetch = false;

      // Only fetch if missing AND we have coords AND office has coords
      if (!travel && et.lat && et.lng && office.latitude && office.longitude) {
        // Optimistic: Check Haversine first. If very close, skip OSRM?
        // No, user wants OSRM.
        // We will fetch OSRM.
        try {
          const fetchedTravel = await EtaService.getTravelTime(et.lat, et.lng, office.latitude, office.longitude);
          if (fetchedTravel) {
            travel = fetchedTravel;
            didFetch = true;
          }
        } catch (e) { /* fallback */ }

        if (!travel) {
          // Local Fallback
          const distMeters = haversineDistance(et.lat, et.lng, office.latitude, office.longitude);
          travel = calculateTravelETA(distMeters, null);
        }
      }

      et.travel_time_minutes = travel || 1; // Default minimum 1 min

      // SAVE to DB if fetched
      if (didFetch && et.travel_time_minutes) {
        try {
          tokensStmt.updateTravelTime.run({ travel: et.travel_time_minutes, id: et.id });
        } catch (dbErr) {
          console.error("Failed to persist travel time:", dbErr);
        }
      }

      // B. Queue Wait
      if (et.status === 'CALLED') {
        et.wait_minutes = 0;
        et.eta = 0;
        et.expected_arrival = new Date().toISOString();
      } else {
        const pos = positionIndex + 1; // 1-based

        // NEW FORMULA: batch = floor((pos - 1) / N)
        const batch = Math.floor((pos - 1) / N);
        const waitMins = batch * serviceTime;

        // Lunch Adjust
        const now = Date.now();
        const estStart = new Date(now + waitMins * 60000);
        const adjStart = EtaService.adjustForLunch(estStart.getTime(), office);

        const finalWaitMs = adjStart.getTime() - now;
        const finalWaitMins = Math.max(0, Math.ceil(finalWaitMs / 60000));

        et.wait_minutes = finalWaitMins;
        et.eta = finalWaitMins + et.travel_time_minutes;
        et.expected_arrival = new Date(Date.now() + et.eta * 60000).toISOString();
      }
      return et;
    });

    const enriched = await Promise.all(tokenPromises);
    return enriched;
  }
};
const recalculateQueue = async (officeId) => {
  // DEBUG CHECKS
  if (!tokensStmt || !tokensStmt.getForOffice) {
    console.error("FATAL: tokensStmt or tokensStmt.getForOffice is undefined!");
    return;
  }
  if (!activeStaffStmt || !activeStaffStmt.getForOffice) {
    console.error("FATAL: activeStaffStmt or activeStaffStmt.getForOffice is undefined!");
    return;
  }

  const office = officesStmt.getById.get(officeId);
  if (!office) return;

  let allTokens = [];
  try {
    // FIX: Use Local Date (en-CA gives YYYY-MM-DD)
    const today = new Date().toLocaleDateString('en-CA');
    allTokens = tokensStmt.getForOffice.all(officeId).filter(t => !t.appointment_date || t.appointment_date === today);
  } catch (e) {
    console.error("FATAL: recalculateQueue -> tokensStmt.getForOffice.all failed", e);
    throw e;
  }

  // Sort by created_at (FIFO)
  const activeTokens = allTokens.filter(t => ['WAIT', 'ALLOCATED', 'CALLED'].includes(t.status));

  // 1. Define Capacity
  const N = getActiveStaffCount(officeId);
  const M = N * 3; // Max allocated tokens

  // 2. Identify Groups & Promote
  const calledTokens = activeTokens.filter(t => t.status === 'CALLED');
  let allocatedTokens = activeTokens.filter(t => t.status === 'ALLOCATED');
  let waitTokens = activeTokens.filter(t => t.status === 'WAIT');

  // --- 1.2 Auto-Swap for Optimization ---
  allocatedTokens.forEach(badToken => {
    if (badToken.presence_status === 'ARRIVED') return;
    const score = calculateArrivalScore(badToken);
    if (score < 0.25) {
      const candidateIdx = waitTokens.findIndex(t => t.presence_status === 'ARRIVED');
      if (candidateIdx >= 0) {
        const goodToken = waitTokens[candidateIdx];
        console.log(`Auto-Swapping Token ${badToken.token_number} (Lazy) with ${goodToken.token_number} (Arrived)`);
        const now = toIso();

        tokensStmt.updatePrediction.run({ id: badToken.id, score: score, status: 'SWAPPED_WAIT', expected_time: null });
        tokensStmt.updateStatus.run({
          id: badToken.id, status: 'WAIT', allocation_time: null, service_start_time: null,
          expected_completion_time: null, called_at: null, completed_at: null, now: now,
          eta: null, assigned_counter: null, called_by_counter: null, appointment_date: null
        });

        tokensStmt.updateStatus.run({
          id: goodToken.id, status: 'ALLOCATED', allocation_time: now, service_start_time: null,
          expected_completion_time: null, called_at: null, completed_at: null, now: now,
          eta: null, assigned_counter: badToken.assigned_counter, called_by_counter: null, appointment_date: null
        });

        waitTokens.splice(candidateIdx, 1);
      }
    }
  });

  // Re-fetch to be safe after swaps
  const freshTokens = tokensStmt.getForOffice.all(officeId);
  allocatedTokens = freshTokens.filter(t => t.status === 'ALLOCATED');
  waitTokens = freshTokens.filter(t => t.status === 'WAIT');

  // --- 1.5 Grace Period Logic (Auto No-Show) ---
  if (allocatedTokens.length > 0 && office.auto_noshow_enabled) {
    allocatedTokens.forEach((token) => {
      if (token.presence_status !== 'ARRIVED') {
        const nowMs = Date.now();
        if (!token.eligibility_time) {
          tokensStmt.updateEligibility.run({ id: token.id, time: toIso() });
          token.eligibility_time = toIso();
        }

        let elgTime = 0;
        try {
          elgTime = new Date(token.eligibility_time).getTime();
          if (isNaN(elgTime)) throw new Error('Invalid Date');
        } catch (e) {
          elgTime = nowMs;
          tokensStmt.updateEligibility.run({ id: token.id, time: toIso() });
        }

        const graceMinutes = office.auto_noshow_grace_minutes || 5;
        const GRACE_PERIOD_MS = graceMinutes * 60 * 1000;

        if (nowMs - elgTime > GRACE_PERIOD_MS) {
          console.log(`Auto No-Show for Token ${token.token_number} (Grace: ${graceMinutes}m)`);
          tokensStmt.updateStatus.run({
            id: token.id, status: 'no-show', allocation_time: token.allocation_time, service_start_time: null,
            expected_completion_time: null, called_at: null, completed_at: toIso(), now: toIso(),
            eta: null, assigned_counter: null, called_by_counter: null, appointment_date: null
          });
          const recipientEmail = (token.user_contact && token.user_contact.includes('@')) ? token.user_contact : token.user_email;
          if (recipientEmail) {
            sendEmail(recipientEmail, 'Missed Appointment - GetEzi', emailTemplates.tokenNoShow(token.user_name, token.token_number, office.name));
          }
        }
      }
    });
  }

  let currentOccupancy = calledTokens.length + allocatedTokens.length;
  let slotsOpen = M - currentOccupancy;

  // --- SMART ASSIGNMENT LOGIC REMOVED ---
  // Single Global Queue: Tokens stay in WAIT until called by ANY counter.
  // This allows strict FIFO based on booking time across all counters.
  // Tokens are filtered by 'ARRIVED' in the call-next endpoint.
  // The original `if (slotsOpen > 0 && waitTokens.length > 0)` block and its contents have been removed.
  // The following lines were part of the `toPromote.forEach` loop, which is now removed.
  // They are kept here as a comment to indicate where they were.
  /*
  const recipientEmail = (token.user_contact && token.user_contact.includes('@')) ? token.user_contact : (token.user_id ? usersStmt.getById.get(token.user_id)?.email : null);
    if (recipientEmail) {
      // Calculate ETA for email (Exact Service Time)
      // Heuristic: This token is joining the allocated/wait list.
      // We can estimate wait based on current allocation count.
      const pendingCount = allocatedTokens.length; // Before this token
      // Token is roughly at position pendingCount (0-based) relative to service.
      const estimatedBatch = Math.floor(pendingCount / Math.max(1, N));
      const estimatedWaitMins = estimatedBatch * (office.avg_service_minutes || 10);

      const estStart = new Date(Date.now() + estimatedWaitMins * 60000);
      const adjStart = EtaService.adjustForLunch(estStart.getTime(), office);
      const serviceEta = adjStart.toISOString();

      sendEmail(recipientEmail, 'Time to Leave - GetEzi', emailTemplates.travelInstruction(
        token.user_name, token.token_number, office.name, office.address || '',
        office.latitude, office.longitude, now,
        new Date(new Date(now).getTime() + (token.travel_time_minutes || 15) * 60000).toISOString(),
        serviceEta
      ));
    }
  */
  // End of Recalculate Logic

  // --- ETA CALCULATION (Dynamic) ---
  const allTokensWithUpdates = tokensStmt.getForOffice.all(officeId);
  const processedTokens = await EtaService.processQueue(office, allTokensWithUpdates);

  // PERSIST DYNAMIC ETA TO DB
  // This ensures polling clients get the fresh value
  const updateEtaStmt = db.prepare('UPDATE tokens SET eta_minutes = @eta WHERE id = @id');
  processedTokens.forEach(t => {
    if (typeof t.eta === 'number') {
      updateEtaStmt.run({ eta: t.eta, id: t.id });
    }
  });

  const finalTokens = enrichTokens(processedTokens);

  // Fetch & Enrich Active Staff
  const staffRaw = activeStaffStmt.getForOffice.all(officeId);
  const active_staff = staffRaw.map(s => {
    const u = usersStmt.getById.get(s.user_id);
    return { ...s, name: u ? u.name : 'Unknown' };
  });

  // Emit Global Update
  io.to(`office_${officeId}`).emit('queue_update', {
    officeId,
    tokens: finalTokens,
    active_staff,
    stats: {
      wait: waitTokens.length,
      allocated: allocatedTokens.length,
      called: calledTokens.length,
      M, N,
      serviceTime: office.avg_service_minutes || 10
    }
  });

  return finalTokens;
};


// AI Prediction Engine
const calculateArrivalScore = (token, user) => {
  const now = Date.now();
  const allocated = token.allocation_time ? new Date(token.allocation_time).getTime() : now;
  const etaTime = token.expected_arrival_time ? new Date(token.expected_arrival_time).getTime() : (now + (token.travel_time_minutes || 15) * 60000);

  // 1. Reliability Score (History)
  let reliability = 1.0; // Default buffer for new users
  if (user && user.total_tokens > 0) {
    reliability = user.total_completed / user.total_tokens;
  }

  // 2. Activity Score
  let activity = 0.2;
  if (user && user.last_activity_at) {
    const timeSinceActive = (now - new Date(user.last_activity_at).getTime()) / 60000;
    if (timeSinceActive < 3) activity = 1.0;
    else if (timeSinceActive < 10) activity = 0.6;
  }

  // 3. Time Progress / Lateness
  let timeProgress = 1.0;
  let latenessPenalty = 0.0;

  const minutesUntilEta = (etaTime - now) / 60000;

  if (minutesUntilEta < -5) {
    // Late by >5 mins
    latenessPenalty = Math.min(1.0, Math.abs(minutesUntilEta) / 15); // Max penalty at 15 mins late
  }

  // Formula
  let score = (0.35 * reliability) + (0.25 * activity) + (0.25 * timeProgress) - (0.15 * latenessPenalty);

  // Clamp
  return Math.max(0, Math.min(1, score));
};

const ensureOffice = (id) => {
  const office = officesStmt.getById.get(id);
  if (!office) throw { status: 404, message: 'Office not found' };
  return office;
};

/* --- Endpoints --- */
app.get('/health', (req, res) => res.json({ status: 'ok', time: toIso() }));

// Create Token (Book)
// --- Holiday Management ---
app.get('/api/offices/:id/holidays', (req, res) => {
  try {
    const holidays = officeHolidaysStmt.list.all(req.params.id);
    res.json(holidays);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/offices/:id/holidays', authenticateToken, requireOffice, requireRole(['office_owner', 'admin']), (req, res) => {
  try {
    const { date, reason, type } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });
    const id = uuidv4();
    officeHolidaysStmt.add.run({
      id,
      office_id: req.params.id,
      date, // YYYY-MM-DD
      reason: reason || 'Holiday',
      type: type || 'OFFICE',
      created_at: toIso()
    });
    res.status(201).json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/offices/:id/holidays/:holidayId', authenticateToken, requireOffice, requireRole(['office_owner', 'admin']), (req, res) => {
  try {
    const { id, holidayId } = req.params;
    officeHolidaysStmt.remove.run({ id: holidayId, office_id: id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create Token (Book)
app.post('/api/offices/:id/book', async (req, res) => {
  try {
    const { id } = req.params; console.log('[BOOK] Request Body:', req.body);
    const office = ensureOffice(id);
    const { customerName, customerContact, customerEmail, lat, lng, userId, serviceType, customerAddress, travelTime: clientTravelTime, appointmentDate } = req.body;

    // --- 1. APPOINTMENT DATE VALIDATION (STRICT) ---
    // User requires: IF date == today: ACTIVE (WAIT). IF date > today: UPCOMING (FUTURE).

    // Normalize Date to Local YYYY-MM-DD
    let dateStr = appointmentDate;
    if (!dateStr) {
      // Default to TODAY if not provided
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }

    const now = new Date();
    const serverYear = now.getFullYear();
    const serverMonth = String(now.getMonth() + 1).padStart(2, '0');
    const serverDay = String(now.getDate()).padStart(2, '0');
    const todayStr = `${serverYear}-${serverMonth}-${serverDay}`;

    const isFuture = dateStr > todayStr;
    const isActive = dateStr === todayStr;

    console.log(`[DEBUG] Booking: Date=${dateStr}, Today=${todayStr}, Future=${isFuture}`);

    // Constraints Checks
    // 1. Holiday
    if (isHoliday(id, dateStr)) return res.status(400).json({ error: 'Office is closed on this date (Holiday).' });

    // 2. Closed Day
    if (isClosedDay(office, dateStr)) return res.status(400).json({ error: 'Office is closed on this day of the week.' });

    // 3. Status Check (If Active)
    if (isActive) {
      const status = OfficeStatusEngine.getStatus(office);
      if (status.status === 'CLOSED') return res.status(400).json({ error: status.message });
    }

    // 4. Capacity
    if (isCapacityFull(id, dateStr, office.daily_capacity)) return res.status(400).json({ error: 'Daily capacity reached.' });

    if (!customerName || !customerEmail) return res.status(400).json({ error: 'Name and Email are required' });
    if ((!lat || !lng) && !customerAddress) return res.status(400).json({ error: 'Valid Location required' });

    // --- TRAVEL TIME CALCULATION ---
    // Calculated for ALL tickets to save data, but used differently.
    // User Rule: "ETA must be calculated ONLY for today's tickets."
    let travelTime = 1;
    let travelData = null;

    if (lat != null && lng != null && office.latitude != null && office.longitude != null) {
      travelData = await calculateTravelTime(lat, lng, office.latitude, office.longitude);
      if (travelData) travelTime = travelData.minutes;
    }

    let eta = null;
    let etaMinutes = null;
    let queueWaitMinutes = 0;

    if (isActive) {
      // Active Ticket: Calculate ETA based on Queue Length
      // 1. Get number of people ahead (Waiting + Allocated)
      const queueCountStmt = db.prepare(`
        SELECT COUNT(*) as count 
        FROM tokens 
        WHERE office_id = ? 
        AND status IN ('WAIT', 'ALLOCATED') 
        AND (appointment_date = ? OR appointment_date IS NULL)
      `);
      const qResult = queueCountStmt.get(id, dateStr);
      const peopleAhead = qResult ? qResult.count : 0;

      // 2. Calculate Queue Wait Time
      const serviceTime = office.avg_service_minutes || 15;
      const activeCounters = office.active_counters || 1;
      // Simple throughput estimation:
      queueWaitMinutes = Math.ceil((peopleAhead * serviceTime) / activeCounters);

      // 3. User ETA = Max(QueueWait, TravelTime)
      // If Queue is 60m and Travel is 10m -> Service in 60m.
      // If Queue is 5m and Travel is 20m -> Service in 20m (Immediate upon arrival).
      const finalWaitMinutes = Math.max(queueWaitMinutes, travelTime);

      etaMinutes = finalWaitMinutes;
      eta = new Date(Date.now() + finalWaitMinutes * 60000).toISOString();
    }
    // Future Ticket: ETA is null.

    // --- INSERT TOKEN ---
    // Status: WAIT if Active, FUTURE if Future
    const initialStatus = isActive ? 'WAIT' : 'FUTURE';

    const token = {
      id: uuidv4(),
      office_id: id,
      user_id: userId || null,
      user_name: customerName,
      user_email: customerEmail, // New Schema field? Or map to existing?
      user_contact: customerContact || customerEmail, // Fallback
      token_number: getNextTokenNumber(id, dateStr), // Deterministic Number
      status: initialStatus,
      created_at: toIso(),
      service_type: serviceType || office.service_type || 'General',
      appointment_date: dateStr,

      // Location / Map
      latitude: lat || null,
      longitude: lng || null,
      user_address: customerAddress || '',

      // Modifiers
      is_priority: 0,
      note: req.body.note || '',

      // Time Data
      eta_minutes: etaMinutes, // Null if future
      travel_time_minutes: travelTime,
      expected_completion_time: eta, // We use this field for ETA usually

      // Strict Arrival
      presence_status: 'ABSENT', // Default
      arrival_confirmed_at: null
    };

    db.prepare(`
      INSERT INTO tokens (
        id, office_id, user_id, user_name, user_contact, token_number, status, created_at, 
        service_type, appointment_date, lat, lng, customer_address, note,
        eta_minutes, travel_time_minutes, expected_completion_time, presence_status
      ) VALUES (
        @id, @office_id, @user_id, @user_name, @user_contact, @token_number, @status, @created_at,
        @service_type, @appointment_date, @latitude, @longitude, @user_address, @note,
        @eta_minutes, @travel_time_minutes, @expected_completion_time, @presence_status
      )
    `).run(token);

    // --- Email Notification ---
    if (customerEmail) {
      const emailSubject = isActive ? 'Booking Confirmed - GetEzi' : 'Appointment Scheduled - GetEzi';

      // Construct Rich Travel Data for Email
      let emailTravelData = null;
      if (isActive && travelData) {
        emailTravelData = {
          travelTime: travelTime,
          distanceKm: travelData.distance || 0,
          avgWaitMinutes: typeof queueWaitMinutes !== 'undefined' ? queueWaitMinutes : 0,
          totalMinutes: etaMinutes,
          arrivalTime: eta,
          googleDirections: `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${office.latitude},${office.longitude}`,
          googleView: `https://www.google.com/maps/search/?api=1&query=${office.latitude},${office.longitude}`
        };
      }

      // Args: (name, tokenNumber, officeName, address, time, serviceEta, travelData)
      const emailTemplate = emailTemplates.bookingConfirmation(
        customerName,
        token.token_number,
        office.name,
        office.address || `Lat: ${office.latitude}, Lng: ${office.longitude}`,
        dateStr,
        eta,
        emailTravelData
      );

      sendEmail(customerEmail, emailSubject, emailTemplate);
    }

    // Trigger Update
    // If Active, update Queue. If Future, update Future list (if we pushed that via socket, but usually on-demand).
    if (isActive) {
      recalculateQueue(id);

      // Notify Admin/Staff
      io.to(`office_${id}`).emit('queue_update', {
        officeId: id,
        type: 'NEW_BOOKING',
        token
      });
    }

    res.status(201).json(token);
  } catch (err) {
    console.error('Booking Endpoint Fatal Error:', err);
    res.status(500).json({ error: 'System Error: ' + String(err.message) });
  }
});


// Call Specific Counter
app.post('/api/offices/:id/counters/:counterId/call', authenticateToken, (req, res) => {
  const { id, counterId } = req.params;
  const cNum = parseInt(counterId);

  try {
    const office = ensureOffice(id);
    if (office.state && office.state !== 'LIVE') {
      return res.status(400).json({ error: `Office is currently ${office.state}. Resume to call next.` });
    }

    // [New] Check Lunch Status
    const status = OfficeStatusEngine.getStatus(office);
    if (status.status === 'LUNCH_BREAK' && !req.body.force) {
      // We allow force override, but warn by default (or just return error if strict)
      // User requirement: "When status = LUNCH_BREAK -> Block call-next button"
      // Frontend handles button state, but backend should enforce.
      return res.status(400).json({ error: status.message });
    }

    try {
      recalculateQueue(id); // Ensure state
    } catch (e) {
      console.error("Recalculate Error:", e);
      return res.status(500).json({ error: 'Queue Calculation Failed: ' + e.message });
    }

    const allTokens = tokensStmt.getForOffice.all(id);

    // SECURITY: Strict Operator Check
    const staffUser = usersStmt.getById.get(req.user.id);
    if (!staffUser || staffUser.role !== 'staff') {
      return res.status(403).json({ error: 'Access Denied: Only staff can control the queue.' });
    }
    if (staffUser.assigned_counter !== cNum) {
      return res.status(403).json({ error: `You are assigned to Counter ${staffUser.assigned_counter}, not ${cNum}.` });
    }
    // Check if staff is actively logged in for this office
    const activeStaffSession = activeStaffStmt.getByUser.get(req.user.id);
    if (!activeStaffSession || activeStaffSession.office_id !== id) {
      return res.status(403).json({ error: 'Access Denied: Not an active staff member for this office.' });
    }


    const busyToken = allTokens.find(t => t.status === 'CALLED' && t.called_by_counter === cNum);
    if (busyToken && !req.body.force) {
      return res.status(400).json({ error: `Counter ${cNum} is already serving Token #${busyToken.token_number}. Complete it first.` });
    }

    // Find Logic - STRICT GLOBAL QUEUE (User Req: Date/Time)
    // 1. Filter by Date (Today Only)
    // FIX: Use Consistent Local Date
    const nowCtx = new Date();
    const serverYear = nowCtx.getFullYear();
    const serverMonth = String(nowCtx.getMonth() + 1).padStart(2, '0');
    const serverDay = String(nowCtx.getDate()).padStart(2, '0');
    const today = `${serverYear}-${serverMonth}-${serverDay}`;

    // Also include tokens with appointment_date matching today OR null (walk-ins)
    const todaysTokens = allTokens.filter(t => !t.appointment_date || t.appointment_date === today);

    console.log(`[DEBUG CALL-NEXT] Total Tokens: ${allTokens.length}, Today (${today}): ${todaysTokens.length}`);

    // 2. Select Eligible Candidates
    // - Must be WAIT (or ALLOCATED if we support manual pre-assign, but mostly WAIT now)
    // - Must be ARRIVED (Strict Presence)
    // - Must NOT be served/cancelled
    let candidates = todaysTokens.filter(t =>
      ['WAIT', 'ALLOCATED'].includes(t.status) &&
      t.presence_status === 'ARRIVED'
    );

    console.log(`[DEBUG CALL-NEXT] Filtered Candidates: ${candidates.length}`);
    if (candidates.length === 0) {
      console.log('--- WHY NO CANDIDATES? ---');
      todaysTokens.forEach(t => {
        console.log(`Token #${t.token_number}: Status=${t.status}, Presence=${t.presence_status}, Eligible=${['WAIT', 'ALLOCATED'].includes(t.status) && t.presence_status === 'ARRIVED'}`);
      });
      console.log('--------------------------');
    }

    // 3. Sort Strictly by Appointment Time / FIFO
    // Primary: Appointment Date/Time? (Actually date is filtered to today)
    // Secondary: Created At (Booking Timestamp) - FIFO
    candidates.sort((a, b) => {
      // If we had specific time slots, we'd sort by that first.
      // Here we rely on created_at which usually proxies booking time.
      return new Date(a.created_at) - new Date(b.created_at);
    });

    console.log(`Debug Call: cNum=${cNum}, Pool=${candidates.length}`);

    let nextToken = null;
    if (candidates.length > 0) {
      nextToken = candidates[0]; // Pick the oldest arrived
    } else {
      return res.status(404).json({ error: 'No arrived customers waiting in queue.' });
    }

    if (!nextToken) {
      return res.status(404).json({ error: `No tokens waiting for Counter ${cNum}.` });
    }

    const now = toIso();
    try {
      db.transaction(() => {
        tokensStmt.updateStatus.run({
          id: nextToken.id,
          status: 'CALLED',
          called_at: now,
          completed_at: null,
          allocation_time: nextToken.allocation_time,
          service_start_time: now,
          expected_completion_time: null,
          now,
          eta: 0,
          assigned_counter: cNum,
          called_by_counter: cNum,
          appointment_date: null
        });
      })();
    } catch (e) {
      console.error("DB Update Error:", e);
      return res.status(500).json({ error: 'Database Update Failed: ' + e.message });
    }

    try {
      recalculateQueue(id);
    } catch (e) { console.error("Post-Recalc Error:", e); /* Non-fatal? */ }

    if (nextToken.user_id) {
      try {
        io.to(`user_${nextToken.user_id}`).emit('notification', {
          message: `Token ${nextToken.token_number}: Please go to Counter ${cNum}!`
        });
      } catch (e) { }
    }

    res.json(nextToken);
  } catch (err) {
    console.error('Call Endpoint Fatal Error:', err);
    res.status(500).json({ error: 'System Error: ' + String(err.message) });
  }
});

// Original Call Next (Router / Legacy / Smart Auto)
app.post('/api/offices/:id/call-next', (req, res) => {
  // If user calls this, we try to determine "Best Counter" to call for?
  // Or just 404 saying "Use specific counter call".
  // Let's auto-pick the first available counter?
  return res.status(400).json({ error: "Please use specific counter call button." });
});

// Complete (Updated to clear counter)

// Complete
// Complete
app.post('/api/tokens/:id/complete', authenticateToken, (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) return res.status(404).json({ error: 'Not found' });

  // SECURITY: Strict Operator Check
  // Allow if user is owner OR if admin operator
  const staffUser = usersStmt.getById.get(req.user.id);
  if (!staffUser || (staffUser.role !== 'staff' && staffUser.role !== 'office_owner')) {
    return res.status(403).json({ error: 'Access Denied: Only staff or office owners can complete tokens.' });
  }
  // If staff, check if they are active for this office
  if (staffUser.role === 'staff') {
    const activeStaffSession = activeStaffStmt.getByUser.get(req.user.id);
    if (!activeStaffSession || activeStaffSession.office_id !== token.office_id) {
      return res.status(403).json({ error: 'Access Denied: Not an active staff member for this office.' });
    }
  }


  db.transaction(() => {
    tokensStmt.updateStatus.run({
      id: token.id,
      status: 'COMPLETED',
      completed_at: toIso(),
      called_at: token.called_at,
      allocation_time: token.allocation_time,
      service_start_time: token.service_start_time,
      expected_completion_time: toIso(),
      now: toIso(),
      eta: null,
      assigned_counter: token.assigned_counter || null,
      called_by_counter: token.called_by_counter || null,
      appointment_date: null
    });

    if (token.user_id) {
      usersStmt.updateStats.run({
        id: token.user_id,
        completed_inc: 1,
        no_show_inc: 0,
        delay: 0,
        now: toIso()
      });
    }
  })();

  recalculateQueue(token.office_id);

  // Email Notification: Completed
  const recipientEmail = (token.user_contact && token.user_contact.includes('@')) ? token.user_contact : (token.user_email && token.user_email.includes('@') ? token.user_email : (token.user_id ? usersStmt.getById.get(token.user_id)?.email : null));
  if (recipientEmail) {
    const office = officesStmt.getById.get(token.office_id);
    sendEmail(recipientEmail, 'Service Completed - GetEzi', emailTemplates.tokenCompleted(
      token.user_name,
      token.token_number,
      office.name
    ));
  }

  res.json({ success: true });
});

// Cancel
app.post('/api/tokens/:id/cancel', authenticateToken, (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) return res.status(404).json({ error: 'Not found' });

  // SECURITY: Strict Operator Check OR Token Owner
  const staffUser = usersStmt.getById.get(req.user.id);
  const isOwner = token.user_id === req.user.id;
  const isStaff = staffUser && ['staff', 'office_owner', 'admin'].includes(staffUser.role);

  if (!isStaff && !isOwner) {
    return res.status(403).json({ error: 'Access Denied: Only staff or office owners can cancel tokens.' });
  }

  db.transaction(() => {
    tokensStmt.updateStatus.run({
      id: token.id,
      status: 'cancelled',
      completed_at: toIso(), // Mark as terminal
      called_at: token.called_at,
      allocation_time: token.allocation_time,
      service_start_time: null,
      expected_completion_time: null,
      now: toIso(),
      eta: null,
      appointment_date: null,
      assigned_counter: null,
      called_by_counter: null
    });
  })();

  recalculateQueue(token.office_id);

  // Email Notification: Cancelled
  const recipientEmail = (token.user_contact && token.user_contact.includes('@')) ? token.user_contact : (token.user_email && token.user_email.includes('@') ? token.user_email : (token.user_id ? usersStmt.getById.get(token.user_id)?.email : null));
  if (recipientEmail) {
    const office = officesStmt.getById.get(token.office_id);
    sendEmail(recipientEmail, 'Token Cancelled - GetEzi', emailTemplates.tokenCancelled(
      token.user_name,
      token.token_number,
      office.name,
      'Cancelled by user or admin'
    ));
  }

  // Socket Notification
  if (token.user_id) {
    io.to(`user_${token.user_id}`).emit('notification', {
      message: `Token #${token.token_number} has been cancelled.`,
      type: 'error'
    });
  }

  res.json({ success: true });
});

// No-Show (Swap with next token logic)
app.post('/api/tokens/:id/no-show', authenticateToken, (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) return res.status(404).json({ error: 'Not found' });

  // SECURITY: Strict Operator Check
  const staffUser = usersStmt.getById.get(req.user.id);
  if (!staffUser || (staffUser.role !== 'staff' && staffUser.role !== 'office_owner' && staffUser.role !== 'admin')) {
    return res.status(403).json({ error: 'Access Denied: Only staff or office owners can mark no-show.' });
  }

  try {
    const swapResult = db.transaction(() => {
      // 1. Find the next eligible token (T2)
      // Filter: Same office, Status WAIT/ALLOCATED, Not T1
      // Sort: CreatedAt (FIFO)
      const allTokens = tokensStmt.getForOffice.all(token.office_id);

      // We need to find the one that is logically "next"
      // Since T1 was likely just called or is being processed, we look for WAIT/ALLOCATED
      // We sort by created_at to find the head of the pending queue
      const candidates = allTokens.filter(t =>
        ['WAIT', 'ALLOCATED'].includes(t.status) &&
        t.presence_status === 'ARRIVED' &&
        t.id !== token.id
      ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      const nextToken = candidates[0]; // T2

      // === NEW: LOG NO-SHOW EVENT ===
      // Since we reset the token status to WAIT (not no-show), we must log this event explicitly to count it.
      // Use a unique ID for history to avoid conflict with active token.
      const historyId = `${token.id}_noshow_${Date.now()}`;
      db.prepare(`
        INSERT INTO token_history (id, office_id, user_id, user_name, user_contact, status, token_number, note, created_at, called_at, completed_at, service_type, archived_at, eta_minutes, travel_time_minutes, allocation_time, service_start_time, expected_completion_time, counter_number)
        VALUES (?, ?, ?, ?, ?, 'no-show', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        historyId, token.office_id, token.user_id, token.user_name, token.user_contact,
        token.token_number, token.note, toIso(), token.called_at, toIso(),
        token.service_type, toIso(), token.eta_minutes, token.travel_time_minutes,
        token.allocation_time, token.service_start_time, null, token.called_by_counter
      );
      // ==============================

      if (nextToken) {
        // SWAP Logic
        const t1Num = token.token_number;
        const t1Created = token.created_at;
        const t2Num = nextToken.token_number;
        const t2Created = nextToken.created_at;

        // Reset T1 (The No-Show) -> Becomes T2's position (Back in Queue)
        tokensStmt.updateStatus.run({
          id: token.id,
          status: 'WAIT',
          completed_at: null,
          called_at: null,
          allocation_time: null,
          service_start_time: null,
          expected_completion_time: null,
          now: toIso(),
          eta: null,
          assigned_counter: null,
          called_by_counter: null,
          appointment_date: token.appointment_date
        });

        // Swap Physical Identifiers
        db.prepare('UPDATE tokens SET token_number = ?, created_at = ? WHERE id = ?').run(t2Num, t2Created, token.id);
        db.prepare('UPDATE tokens SET token_number = ?, created_at = ? WHERE id = ?').run(t1Num, t1Created, nextToken.id);

        return { swapped: true, newNumber: t2Num, swappedWith: t1Num };
      } else {
        // No swap target (End of queue)
        tokensStmt.updateStatus.run({
          id: token.id,
          status: 'WAIT',
          completed_at: null,
          called_at: null,
          allocation_time: null,
          service_start_time: null,
          expected_completion_time: null,
          now: toIso(),
          eta: null,
          assigned_counter: null,
          called_by_counter: null,
          appointment_date: token.appointment_date
        });
        return { swapped: false };
      }
    })();

    if (token.user_id) {
      usersStmt.updateStats.run({
        id: token.user_id,
        completed_inc: 0,
        no_show_inc: 1,
        delay: 0,
        now: toIso()
      });

      const msg = swapResult.swapped
        ? `You missed your turn! You have been swapped to Token #${swapResult.newNumber}.`
        : `You missed your turn! You have been placed back in the queue.`;

      io.to(`user_${token.user_id}`).emit('notification', { message: msg, type: 'alert' });
    }

    recalculateQueue(token.office_id);

    // Emit 'queue_update' or 'token_swap' - standard update is fine as positions changed
    io.to(`office_${token.office_id}`).emit('queue_update', { type: 'swap' });

    res.json({ success: true, swapped: swapResult.swapped });

  } catch (err) {
    console.error('No-Show Error:', err);
    res.status(500).json({ error: 'System Error: ' + err.message });
  }
});

// Arrive (Office Owner/Staff confirmation)
app.post('/api/tokens/:id/arrive', authenticateToken, (req, res) => {
  try {
    const token = tokensStmt.getById.get(req.params.id);
    if (!token) return res.status(404).json({ error: 'Not found' });

    // SECURITY: Strict Operator Check
    const staffUser = usersStmt.getById.get(req.user.id);
    if (!staffUser || (staffUser.role !== 'staff' && staffUser.role !== 'office_owner' && staffUser.role !== 'admin')) {
      // Allow customer to mark THEMSELVES as arrived?
      // IF current user is the token owner, allow it.
      if (req.user.id !== token.user_id) {
        return res.status(403).json({ error: 'Access Denied.' });
      }
    }

    db.transaction(() => {
      tokensStmt.markArrived.run({ id: token.id, now: toIso() });
    })();

    recalculateQueue(token.office_id);

    res.json({ success: true });
  } catch (err) {
    console.error('Arrive Endpoint Error:', err);
    res.status(500).json({ error: 'System Error: ' + err.message });
  }
});

// Recall Customer (Re-notify)
app.post('/api/tokens/:id/recall', authenticateToken, (req, res) => {
  try {
    const token = tokensStmt.getById.get(req.params.id);
    if (!token) return res.status(404).json({ error: 'Not found' });

    // SECURITY: Strict Operator Check
    const staffUser = usersStmt.getById.get(req.user.id);
    if (!staffUser || (staffUser.role !== 'staff' && staffUser.role !== 'office_owner' && staffUser.role !== 'admin')) {
      return res.status(403).json({ error: 'Access Denied: Only staff or office owners can recall tokens.' });
    }

    // 1. Socket Notification
    if (token.user_id) {
      io.to(`user_${token.user_id}`).emit('notification', {
        message: `Recall: Please proceed to Counter ${token.assigned_counter} immediately!`,
        type: 'alert'
      });
    }

    // 2. Email Notification
    const recipientEmail = (token.user_contact && token.user_contact.includes('@')) ? token.user_contact : (token.user_email && token.user_email.includes('@') ? token.user_email : (token.user_id ? usersStmt.getById.get(token.user_id)?.email : null));
    if (recipientEmail) {
      const office = officesStmt.getById.get(token.office_id);
      sendEmail(recipientEmail, 'Recall Alert - GetEzi', `
        <div style="font-family: sans-serif; padding: 20px; text-align: center;">
          <h2 style="color: #d32f2f;">Please Proceed to Counter ${token.assigned_counter}</h2>
          <p>Hello ${token.user_name},</p>
          <p>We are waiting for you at <strong>${office.name}</strong>.</p>
          <p>Your token <strong>#${token.token_number}</strong> has been called again.</p>
          <p>Please arrive immediately to avoid cancellation.</p>
        </div>
      `);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Recall Endpoint Error:', err);
    res.status(500).json({ error: 'System Error: ' + err.message });
  }
});

// STAFF QUEUE VIEW
app.get('/api/offices/:id/staff-queue', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Auth Check
  const staffUser = usersStmt.getById.get(req.user.id);
  if (!staffUser || (staffUser.role !== 'staff' && staffUser.role !== 'office_owner' && staffUser.role !== 'admin')) {
    return res.status(403).json({ error: 'Access Denied' });
  }

  try {
    const allTokens = tokensStmt.getForOffice.all(id);

    const nowCtx = new Date();
    const serverYear = nowCtx.getFullYear();
    const serverMonth = String(nowCtx.getMonth() + 1).padStart(2, '0');
    const serverDay = String(nowCtx.getDate()).padStart(2, '0');
    const today = `${serverYear}-${serverMonth}-${serverDay}`;

    const upNext = allTokens.filter(t => {
      // Active Queue Logic
      const isToday = t.appointment_date === today || t.appointment_date === null;
      const isActiveStatus = ['WAIT', 'ALLOCATED', 'CALLED'].includes(t.status);
      return isToday && isActiveStatus;
    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const future = allTokens.filter(t => {
      const isFuture = t.appointment_date > today;
      const isFutureStatus = t.status === 'FUTURE';
      return isFuture || isFutureStatus;
    }).sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));

    const completedCount = allTokens.filter(t => {
      const isToday = t.appointment_date === today || t.appointment_date === null;
      return isToday && t.status === 'COMPLETED';
    }).length;

    // Count active no-shows (if any, though logic usually clears them)
    const activeNoShowCount = allTokens.filter(t => {
      const isToday = t.appointment_date === today || t.appointment_date === null;
      return isToday && t.status === 'no-show';
    }).length;

    // Count historical no-shows (events logged today)
    const historyNoShowCount = db.prepare('SELECT COUNT(*) as count FROM token_history WHERE office_id = ? AND status = \'no-show\' AND date(created_at) = ?').get(id, today).count;

    const noShowCount = activeNoShowCount + historyNoShowCount;

    const cancelledCount = allTokens.filter(t => {
      const isToday = t.appointment_date === today || t.appointment_date === null;
      return isToday && t.status === 'cancelled';
    }).length;

    res.json({ upNext, future, stats: { served: completedCount, noShow: noShowCount, cancelled: cancelledCount } });
  } catch (e) {
    console.error("Staff Queue Fetch Error:", e);
    res.status(500).json({ error: "Failed to fetch queue" });
  }
});

// Admin: Config Counters
// Admin: Config Counters
// Admin: Config Counters

// --- CALENDAR API ---
app.get('/api/offices/:id/calendar', (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);
  const { month } = req.query; // YYYY-MM

  if (!month) return res.status(400).json({ error: 'Month parameter (YYYY-MM) required' });

  const office = ensureOffice(id);
  const [year, m] = month.split('-').map(Number);

  // Generate days in month
  const daysInMonth = new Date(year, m, 0).getDate();
  const calendar = []; // { date, status: AVAILABLE|BUSY|FULL|HOLIDAY|CLOSED_SUNDAY|CLOSED_WEEKDAY, booked, capacity }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, m - 1, d); // Local time construction to avoid UTC shifts
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];

    // 1. Check Holiday
    const holiday = officeHolidaysStmt.checkDate.get(id, dateStr);
    if (holiday) {
      calendar.push({ date: dateStr, status: 'HOLIDAY', reason: holiday.reason });
      continue;
    }

    // 2. Check Sunday / Working Day
    const workingDays = (office.working_days || 'Mon,Tue,Wed,Thu,Fri,Sat').split(',').map(s => s.trim());
    const isSunday = dateObj.getDay() === 0;

    if (isSunday && !office.allow_sunday) {
      calendar.push({ date: dateStr, status: 'CLOSED_SUNDAY' });
      continue;
    }
    if (!isSunday && !workingDays.includes(dayOfWeek)) {
      calendar.push({ date: dateStr, status: 'CLOSED_WEEKDAY' });
      continue;
    }

    // 3. Check Capacity
    const capacity = office.daily_capacity || 50;
    const { count } = tokensStmt.countByDate.get(id, dateStr);

    let status = 'AVAILABLE';
    if (count >= capacity) status = 'FULL';
    else if (count >= capacity * 0.7) status = 'BUSY';

    calendar.push({ date: dateStr, status, booked: count, capacity });
  }

  res.json({ calendar });
});

// Duplicate handlers removed.
// The primary handlers at lines 859 and 878 must be fixed instead.
// I will apply the fix to the primary handlers in a separate chunk.
// Here I am removing the duplicates.

// Extended Config (Supports Counters + Calendar settings)
app.patch('/api/offices/:id/config', authenticateToken, (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);

  if (req.user.role !== 'admin' && req.user.role !== 'office_owner') return res.sendStatus(403);

  const { counterCount, workingDays, allowSunday, dailyCapacity, avgServiceMinutes } = req.body;
  const updates = [];
  const params = { id };

  if (counterCount !== undefined) {
    // Legacy support: update active_counters
    db.prepare('UPDATE offices SET active_counters = ? WHERE id = ?').run(counterCount, id);
    // Also trigger queue recalc if counters changed?
    // For now simplistic update
  }

  if (workingDays !== undefined) {
    updates.push("working_days = @workingDays");
    params.workingDays = workingDays;
  }

  if (allowSunday !== undefined) {
    updates.push("allow_sunday = @allowSunday");
    params.allowSunday = allowSunday ? 1 : 0;
  }

  if (dailyCapacity !== undefined) {
    updates.push("daily_capacity = @dailyCapacity");
    params.dailyCapacity = dailyCapacity;
  }

  if (avgServiceMinutes !== undefined) {
    updates.push("avg_service_minutes = @avgServiceMinutes");
    params.avgServiceMinutes = avgServiceMinutes;
  }

  if (updates.length > 0) {
    db.prepare(`UPDATE offices SET ${updates.join(', ')} WHERE id = @id`).run(params);
  }

  // Trigger update
  io.to(`office_${id}`).emit('office_update', { id, ...params, counterCount });

  recalculateQueue(id);
  res.json({ success: true });
});

// Admin: Config Active Counters
app.post('/api/offices/:id/active-counters', authenticateToken, (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);
  const { activeCounters } = req.body;
  const N = parseInt(activeCounters);

  if (isNaN(N) || N < 0) return res.status(400).json({ error: 'Invalid count' });

  // SECURITY: Only Office Owner
  if (req.user.role !== 'office_owner' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access Denied' });
  }

  db.prepare('UPDATE offices SET active_counters = ? WHERE id = ?').run(N, id);

  // Refresh Queue to update who is enabled/disabled
  recalculateQueue(id);

  // Notify staff
  const staffList = activeStaffStmt.getForOffice.all(id);
  io.to(`office_${id}`).emit('staff_update', staffList);

  res.json({ success: true });
});

// Admin: Pause Office
// Admin: Pause Office
app.post('/api/offices/:id/pause', authenticateToken, (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);
  const { reason } = req.body; // 'LUNCH', 'BREAK', 'MAINTENANCE'

  const office = officesStmt.getById.get(id);
  if (!office) return res.status(404).json({ error: 'Office not found' });

  // SECURITY: Strict Operator Check
  const staffUser = usersStmt.getById.get(req.user.id);
  if (!staffUser || (staffUser.role !== 'staff' && staffUser.role !== 'office_owner' && staffUser.role !== 'admin')) {
    return res.status(403).json({ error: 'Access Denied: Only staff or office owners can pause the queue.' });
  }
  // If staff, check if they are active for this office
  if (staffUser.role === 'staff') {
    const activeStaffSession = activeStaffStmt.getByUser.get(req.user.id);
    if (!activeStaffSession || activeStaffSession.office_id !== id) {
      return res.status(403).json({ error: 'Access Denied: Not an active staff member for this office.' });
    }
  }

  const now = toIso();

  db.transaction(() => {
    officesStmt.updateState.run({
      id,
      state: reason || 'PAUSED',
      time: now
    });
  })();

  // Emit Update
  const updatedOffice = officesStmt.getById.get(id);
  io.to(`office_${id}`).emit('office_state', {
    state: updatedOffice.state,
    pause_started_at: updatedOffice.pause_started_at
  });

  // Notify Waiters
  const tokens = tokensStmt.getForOffice.all(id).filter(t => ['WAIT', 'ALLOCATED'].includes(t.status));
  tokens.forEach(t => {
    if (t.user_id) {
      io.to(`user_${t.user_id}`).emit('notification', {
        message: `Office is now ${reason || 'Paused'}. Queue is paused.`
      });
    }
  });

  res.json({ success: true, state: updatedOffice.state });
});

// Admin: Resume Office
// Admin: Resume Office
app.post('/api/offices/:id/resume', authenticateToken, (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);

  // SECURITY: Strict Operator Check
  const staffUser = usersStmt.getById.get(req.user.id);
  if (!staffUser || (staffUser.role !== 'staff' && staffUser.role !== 'office_owner' && staffUser.role !== 'admin')) {
    return res.status(403).json({ error: 'Access Denied: Only staff or office owners can resume the queue.' });
  }
  // If staff, check if they are active for this office
  if (staffUser.role === 'staff') {
    const activeStaffSession = activeStaffStmt.getByUser.get(req.user.id);
    if (!activeStaffSession || activeStaffSession.office_id !== id) {
      return res.status(403).json({ error: 'Access Denied: Not an active staff member for this office.' });
    }
  }

  db.transaction(() => {
    officesStmt.updateState.run({
      id,
      state: 'LIVE',
      time: null
    });
  })();

  const updatedOffice = officesStmt.getById.get(id);
  io.to(`office_${id}`).emit('office_state', {
    state: 'LIVE',
    pause_started_at: null
  });

  recalculateQueue(id);
  res.json({ success: true, state: 'LIVE' });
});

// Update User Profile (Full Update)
app.put('/api/users/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Security: Only allow updating own profile
  if (req.user.id !== id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access Denied' });
  }

  const {
    name, email, phone, dob, age, gender, bloodType,
    address, city, state, zipCode,
    emergencyContactName, emergencyContactPhone,
    allergies, medicalNotes
  } = req.body;

  try {
    usersStmt.update.run({
      id,
      name,
      email,
      phone,
      dob,
      age,
      gender,
      blood_type: bloodType,
      address,
      city,
      state,
      zip_code: zipCode,
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,
      allergies,
      medical_notes: medicalNotes
    });

    const updatedUser = usersStmt.getById.get(id);
    res.json({ success: true, user: updatedUser });

  } catch (err) {
    console.error('Update User Error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Endpoint: Get Tokens by User (Strict Split)
app.get('/api/users/:userId/tokens', authenticateToken, (req, res) => {
  const { userId } = req.params; console.log('[GET_TOKENS] Fetching for:', userId);

  // Security: Only view own tokens
  if (req.user.id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access Denied' });
  }

  try {
    const tokens = tokensStmt.getForUser.all(userId);

    // Strict Separation Logic
    const nowCtx = new Date();
    const serverYear = nowCtx.getFullYear();
    const serverMonth = String(nowCtx.getMonth() + 1).padStart(2, '0');
    const serverDay = String(nowCtx.getDate()).padStart(2, '0');
    const today = `${serverYear}-${serverMonth}-${serverDay}`;

    // Active: Today AND (WAIT, ALLOCATED, CALLED)
    // Note: status might be 'WAIT' even if future if migration failed? No, strict booking prevents that.
    // We trust 'appointment_date' as source of truth for grouping?
    // User Rule: "Only ACTIVE tickets can show ETA". "ACTIVE -> tickets for TODAY only".

    const active = tokens.filter(t => {
      const isToday = t.appointment_date === today;
      const isActiveStatus = ['WAIT', 'ALLOCATED', 'CALLED'].includes(t.status);
      return isToday && isActiveStatus;
    }).map(t => {
      // Enrich with Live ETA if needed (though Recalc should have updated DB)
      // We ensure ETA fields are populated
      return t;
    }).sort((a, b) => {
      // Sort by ETA ascending
      // expected_arrival might be null? Use eta_minutes
      return (a.eta_minutes || 9999) - (b.eta_minutes || 9999);
    });

    // Upcoming: Future Date OR Status = FUTURE
    const upcoming = tokens.filter(t => {
      const isFuture = t.appointment_date > today;
      const isFutureStatus = t.status === 'FUTURE';
      // Include both conditions to be safe
      return isFuture || isFutureStatus;
    }).sort((a, b) => {
      // Sort by Date ascending
      return a.appointment_date.localeCompare(b.appointment_date);
    });

    res.json({ active, upcoming });

  } catch (err) {
    console.error('Error fetching user tokens:', err);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// Admin: Emergency Shutdown
app.post('/api/offices/:id/shutdown', authenticateToken, (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);

  // SECURITY: Only Office Owner or Admin
  if (req.user.role !== 'office_owner' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access Denied: Only office owners can perform emergency shutdown.' });
  }

  const now = toIso();

  db.transaction(() => {
    officesStmt.updateState.run({
      id,
      state: 'OFFLINE',
      time: now
    });
  })();

  // Emit Update
  const updatedOffice = officesStmt.getById.get(id);
  io.to(`office_${id}`).emit('office_state', {
    state: updatedOffice.state,
    pause_started_at: updatedOffice.pause_started_at
  });

  // CRITICAL BROADCAST: Notify EVERYONE
  // 1. Notify Staff
  try {
    const activeStaff = activeStaffStmt.getForOffice.all(id);
    activeStaff.forEach(s => {
      io.to(`user_${s.user_id}`).emit('system_shutdown', {
        message: 'EMERGENCY: System is shutting down immediately. Please secure your station.'
      });
    });
  } catch (e) {
    console.error('Shutdown Staff Notify Error:', e);
  }

  // 2. Notify Customers (Active Tokens)
  try {
    const tokens = tokensStmt.getForOffice.all(id).filter(t => ['WAIT', 'ALLOCATED', 'CALLED'].includes(t.status));
    tokens.forEach(t => {
      if (t.user_id) {
        io.to(`user_${t.user_id}`).emit('system_shutdown', {
          message: 'NOTICE: The office has gone OFFLINE for emergency/maintenance. Please check back later.'
        });
      }
    });
  } catch (e) {
    console.error('Shutdown Customer Notify Error:', e);
  }

  res.json({ success: true, state: 'OFFLINE' });
});




// Public: Get Office Status (Original Path was /api/offices/:id)
// App.jsx calls /api/offices/:id for details
app.get('/api/offices/:id', async (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);
  try {
    const office = ensureOffice(id);
    const rawTokens = tokensStmt.getForOffice.all(id);
    // Dynamic ETA Calculation
    const processedTokens = await EtaService.processQueue(office, rawTokens);
    const tokens = enrichTokens(processedTokens);

    // Fetch Active Staff with Names
    const staffRaw = activeStaffStmt.getForOffice.all(id);
    const active_staff = staffRaw.map(s => {
      const u = usersStmt.getById.get(s.user_id);
      return { ...s, name: u ? u.name : 'Unknown' };
    });

    // Add extra stats expected by frontend
    const queueCount = tokens.filter(t => t.status === 'WAIT' || t.status === 'queued').length;
    res.json({ office: { ...office, queueCount }, tokens, active_staff });
  } catch (e) {
    console.error('GET /api/offices/:id Error:', e);
    if (e.message === 'Office not found') {
      res.status(404).json({ error: 'Office not found' });
    } else {
      res.status(500).json({ error: 'Internal Server Error: ' + e.message });
    }
  }
});

// Update Office Timings
app.put('/api/offices/:id/timings', authenticateToken, (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);
  const office = ensureOffice(id);

  // Get user from database
  const user = usersStmt.getById.get(req.user.id);
  if (!user) {
    console.error('User not found for ID:', req.user.id);
    return res.status(401).json({ error: 'User not found. Please log in again.' });
  }

  // Permission check: Allow if user is admin OR office_owner
  // For office_owner, verify they own this office (with type-safe comparison)
  if (user.role === 'admin') {
    // Admins can update any office timings
  } else if (user.role === 'office_owner') {
    // Office owners can only update their own office
    // Handle potential type mismatch (string vs number) in ID comparison
    const ownerIdStr = String(office.owner_id || '');
    const userIdStr = String(user.id || '');

    if (office.owner_id && ownerIdStr !== userIdStr) {
      console.error(`Permission denied: Office owner ${user.id} tried to update office ${id} owned by ${office.owner_id}`);
      return res.status(403).json({ error: 'Only the office owner can update timings.' });
    }
  } else {
    // All other roles are denied
    console.error(`Permission denied: User ${user.id} (role: ${user.role}) tried to update office ${id}`);
    return res.status(403).json({ error: 'Access Denied: Only office owners and admins can update timings.' });
  }

  const {
    address, latitude, longitude,
    opening_time, closing_time,
    lunch_start, lunch_end, lunch_flex_minutes,
    auto_noshow_enabled, auto_noshow_grace_minutes
  } = req.body;

  try {
    officesStmt.updateTimings.run({
      id,
      address: address || '',
      latitude: latitude || null,
      longitude: longitude || null,
      opening_time: opening_time || '09:00',
      closing_time: closing_time || '17:00',
      lunch_start: lunch_start || null,
      lunch_end: lunch_end || null,
      lunch_flex_minutes: lunch_flex_minutes || 30,
      auto_noshow_enabled: auto_noshow_enabled ? 1 : 0,
      auto_noshow_grace_minutes: auto_noshow_grace_minutes || 5
    });

    res.json({ success: true });
  } catch (e) {
    console.error("Update Timings Error:", e);
    res.status(500).json({ error: 'Failed to update timings' });
  }
});

// App.jsx calls /api/offices/:id/status? Maybe, but definitely calls :id
// We keep :id/status alias if needed, but :id is primary.

// Availability PATCH
app.patch('/api/offices/:id/availability', (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);
  const { availableToday } = req.body;
  // This was used to manually set availability.
  // We can support it by updating the DB.
  db.prepare('UPDATE offices SET available_today = ? WHERE id = ?').run(availableToday, id);
  res.json({ success: true });
});

// Pause / Resume
app.post('/api/offices/:id/pause', (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);
  const { paused } = req.body;
  db.prepare('UPDATE offices SET is_paused = ? WHERE id = ?').run(paused ? 1 : 0, id);
  res.json({ success: true, is_paused: paused });
});

// Notifications
const notificationsStmt = {
  getForUser: db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`),
  markRead: db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ?`),
  insert: db.prepare(`INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (@id, @user_id, @message, 0, @created_at)`)
};


app.get('/api/notifications', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json({ notifications: [] });
  const notifications = notificationsStmt.getForUser.all(userId);
  res.json({ notifications });
});

app.post('/api/notifications/:id/read', (req, res) => {
  notificationsStmt.markRead.run(req.params.id);
  res.json({ success: true });
});

// History
app.get('/api/history', authenticateToken, (req, res) => {
  // Return completed/archived tokens
  // Matching column count: 18 columns in token_history
  const history = db.prepare(`
    SELECT * FROM token_history 
    UNION ALL 
    SELECT 
      id, office_id, user_id, user_name, user_contact, status, token_number, note, created_at, called_at, completed_at, service_type, 
      NULL as archived_at, 
      eta_minutes, travel_time_minutes, allocation_time, service_start_time, expected_completion_time
    FROM tokens 
    WHERE status IN ('COMPLETED', 'cancelled', 'no-show', 'history')
    ORDER BY created_at DESC LIMIT 100
  `).all();

  // Map simplified
  const mapped = history.map(h => ({
    ...h,
    archived_at: h.archived_at || h.completed_at || h.created_at
  }));

  res.json({ history: mapped });
});

// Analytics Endpoint
app.get('/api/offices/:id/analytics', authenticateToken, (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'office_owner') {
    // Allow checking analytics if owner
    // Add strict check if needed
  }

  try {
    const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM token_history WHERE office_id = ?').get(id).count +
      db.prepare('SELECT COUNT(*) as count FROM tokens WHERE office_id = ?').get(id).count;

    const today = new Date().toISOString().split('T')[0];
    const completedToday = db.prepare(`
        SELECT COUNT(*) as count 
        FROM token_history 
        WHERE office_id = ? AND status = 'COMPLETED' AND date(completed_at) = ?
    `).get(id, today).count +
      db.prepare(`
        SELECT COUNT(*) as count 
        FROM tokens 
        WHERE office_id = ? AND status = 'COMPLETED' AND date(completed_at) = ?
    `).get(id, today).count;

    // Calculate Avg Wait Time (Created to Called)
    // We can fetch relevant timestamps and average them in JS or use SQL
    // Using simple SQL AVG on generated column or extracting epoch
    // SQLite doesn't have TIMEDIFF easy for avg, so let's fetch subset or use julianday
    // (julianday(called_at) - julianday(created_at)) * 24 * 60 = minutes
    const avgWaitRow = db.prepare(`
        SELECT AVG((julianday(called_at) - julianday(created_at)) * 1440) as avg_min
        FROM token_history
        WHERE office_id = ? AND called_at IS NOT NULL AND created_at IS NOT NULL
    `).get(id);

    // Also consider active table 'tokens' for completed ones? Usually they move to history fast?
    // Let's include tokens table completed ones too for accuracy if they linger
    // For simplicity, history is the main source for stats.

    const avgWaitTime = Math.round(avgWaitRow.avg_min || 0);

    res.json({
      totalCustomers,
      completedToday,
      avgWaitTime
    });

  } catch (e) {
    console.error('Analytics Error:', e);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Admin: Export Data
app.get('/api/admin/export', authenticateToken, async (req, res) => {
  const { start, end, format, officeId } = req.query; // officeId optional for Super Admin, required/inferred for Owner
  const requestingUser = req.user;

  if (requestingUser.role !== 'office_owner' && requestingUser.role !== 'admin') {
    return res.status(403).json({ error: 'Access Denied' });
  }

  // Determine Office Scope
  let targetOfficeId = officeId;
  if (requestingUser.role === 'office_owner') {
    // Force owner to their office(s). For now assume single office or passed ID.
    // If no ID passed, try to finding their office.
    if (!targetOfficeId) {
      const office = db.prepare('SELECT id FROM offices WHERE owner_id = ?').get(requestingUser.id);
      if (office) targetOfficeId = office.id;
    }
    // Verify ownership
    const office = officesStmt.getById.get(targetOfficeId);
    if (!office || office.owner_id !== requestingUser.id) {
      // Allow if admin, but we are in owner block
      if (requestingUser.role !== 'admin') return res.status(403).json({ error: 'Access Denied to this office data.' });
    }
  }

  try {
    const query = `
      SELECT 
        user_name, user_contact, token_number, status, service_type, 
        created_at, called_at, completed_at, counter_number as assigned_counter, office_id
      FROM token_history 
      WHERE (@officeId IS NULL OR office_id = @officeId)
        AND date(created_at) BETWEEN @start AND @end
      UNION ALL 
      SELECT 
        user_name, user_contact, token_number, status, service_type, 
        created_at, called_at, completed_at, assigned_counter, office_id
      FROM tokens 
      WHERE (@officeId IS NULL OR office_id = @officeId)
        AND status IN ('COMPLETED', 'cancelled', 'no-show', 'history')
        AND date(created_at) BETWEEN @start AND @end
      ORDER BY created_at DESC
    `;

    const rows = db.prepare(query).all({
      officeId: targetOfficeId || null,
      start: start || '2000-01-01',
      end: end || '2099-12-31'
    });

    if (format === 'csv') {
      // CSV Generation
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report_${start}_${end}.csv"`);

      // BOM for Excel compatibility with UTF-8 CSVs
      res.write('\uFEFF');
      res.write('Token,Customer,Contact,Service,Status,Counter,Created,Called,Completed\n');

      rows.forEach(r => {
        const line = [
          r.token_number,
          `"${(r.user_name || '').replace(/"/g, '""')}"`,
          `"${(r.user_contact || '').replace(/"/g, '""')}"`,
          r.service_type,
          r.status,
          r.assigned_counter,
          r.created_at,
          r.called_at || '',
          r.completed_at || ''
        ].join(',');
        res.write(line + '\n');
      });
      res.end();

    } else {
      // Excel (XLSX) Generation using ExcelJS
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Token Report');

      sheet.columns = [
        { header: 'Token #', key: 'token', width: 10 },
        { header: 'Customer Name', key: 'name', width: 20 },
        { header: 'Contact', key: 'contact', width: 20 },
        { header: 'Service Type', key: 'service', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Counter', key: 'counter', width: 10 },
        { header: 'Created At', key: 'created', width: 22 },
        { header: 'Called At', key: 'called', width: 22 },
        { header: 'Completed At', key: 'completed', width: 22 }
      ];

      rows.forEach(r => {
        sheet.addRow({
          token: r.token_number,
          name: r.user_name,
          contact: r.user_contact,
          service: r.service_type,
          status: r.status,
          counter: r.assigned_counter,
          created: r.created_at,
          called: r.called_at,
          completed: r.completed_at
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="report_${start}_${end}.xlsx"`);
      await workbook.xlsx.write(res);
      res.end();
    }

  } catch (err) {
    console.error('Export Error:', err);
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});

// Auth Routes
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = usersStmt.getById.get(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Fetch Active Staff Role for Admin/Staff
    let operationalRole = user.role;
    let assignedCounter = user.assigned_counter || null; // From users table
    let officeId = user.office_id || null; // From users table

    if (user.role === 'staff' || user.role === 'office_owner') {
      const activeStaff = activeStaffStmt.getByUser.get(user.id);
      if (activeStaff) {
        // If active session exists, use its office_id
        officeId = activeStaff.office_id;
      }
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        operational_role: operationalRole, // This will be 'staff' or 'office_owner'
        assigned_counter: assignedCounter,
        office_id: officeId, // The office they are currently active in
        is_verified: user.is_verified,
        phone: user.phone,
        dob: user.dob,
        gender: user.gender,
        age: user.age,
        history_retention_days: user.history_retention_days || 30
      }
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, adminKey: key } = req.body;
  const user = usersStmt.getByEmail.get(email);

  if (email === 'admin' && password === 'admin') {
    const token = jwt.sign({ id: 'admin', role: 'admin', name: 'Super Admin' }, jwtSecret);
    return res.json({ token, user: { id: 'admin', name: 'Super Admin', role: 'admin' } });
  }

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Handle Admin Key Promotion logic if needed
  if (key === adminKey && user.role !== 'admin') {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', user.id);
    user.role = 'admin';
  }

  let role = user.role;
  let officeId = null;
  let counterNumber = null;

  // Resolve Context based on Role
  if (role === 'office_owner') {
    // Fetch their primary office
    const office = db.prepare('SELECT id FROM offices WHERE owner_id = ?').get(user.id);
    if (office) officeId = office.id;
  } else if (role === 'staff') {
    // 1. Try fields on users table first (New System)
    if (user.office_id) {
      officeId = user.office_id;
      counterNumber = user.assigned_counter;
    }
    // 2. Fallback to old 'staff' table logic if needed (Legacy Support)
    else {
      const staffRecord = db.prepare('SELECT office_id, counter_number FROM staff WHERE user_id = ?').get(user.id);
      if (staffRecord) {
        officeId = staffRecord.office_id;
        counterNumber = staffRecord.counter_number;
      }
    }
  }

  // --- STAFF LOGIN RESTRICTIONS ---
  if (role === 'staff' && officeId) {
    const today = new Date().toISOString().split('T')[0];
    // Check Holiday
    if (isHoliday(officeId, today)) {
      return res.status(403).json({ error: 'Login Blocked: Office is closed for Holiday.' });
    }
    // Check Closed Day
    const office = officesStmt.getById.get(officeId);
    if (office && isClosedDay(office, today)) {
      return res.status(403).json({ error: 'Login Blocked: Office is closed today.' });
    }
  }

  // Generate Scoped Token
  const payload = {
    id: user.id,
    role: role,
    office_id: officeId,
    counter_number: counterNumber
  };

  const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

  // Track Activity
  usersStmt.updateStats.run({
    id: user.id,
    completed_inc: 0,
    no_show_inc: 0,
    delay: 0,
    now: toIso()
  });

  // --- ACTIVATE STAFF SESSION ---
  if (role === 'staff' && officeId) {
    try {
      activeStaffStmt.insert.run({
        user_id: user.id,
        office_id: officeId,
        role: 'operator', // Default to operator if they have a counter? Or 'spectator'? 
        // Users table has assigned_counter, so let's assume they are effectively operators.
        // But wait, 'operator' usually means actively calling. 
        // For now, let's map 'staff' role to 'operator' if counter is assigned, else 'spectator'.
        counter_number: counterNumber || 0,
        login_time: toIso()
      });

      // Notify Owner
      const freshList = db.prepare(`SELECT u.id, u.name, u.email, u.assigned_counter FROM users u WHERE u.office_id = ? AND u.role = 'staff'`).all(officeId);
      // We also need to map the "Active" status for the real-time list, but the list logic does that via join/check.
      // But simply emitting the list triggers the frontend to fetch?
      // Wait, frontend fetch logic (GET /staff) does the joining.
      // So just emitting anything is enough to trigger a re-fetch if we wire it.
      // But better: Emit the simple signal or the full list? 
      // My previous edit emitted `staff_list_update`.
      io.to(`office_${officeId}`).emit('staff_list_update', freshList);

    } catch (e) {
      console.error("Failed to activate staff session:", e);
    }
  }

  res.json({
    token,
    user: {
      ...user,
      office_id: officeId,
      assigned_counter: counterNumber,
    }
  });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // Simple Logout: Remove from active_staff
  const userId = req.user.id;
  const session = activeStaffStmt.getByUser.get(userId);

  if (session) {
    activeStaffStmt.delete.run(userId);
    // Notify office
    const staffList = activeStaffStmt.getForOffice.all(session.office_id);
    io.to(`office_${session.office_id}`).emit('staff_update', staffList);
  }

  res.json({ success: true });
});

// --- STAFF MANAGEMENT (Office Owner Only) ---

// Get All Staff for Office
app.get('/api/offices/:id/staff-list', authenticateToken, (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);
  if (req.user.role !== 'office_owner' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });

  // Fetch users who are linked to this office and have role 'staff'
  const staff = db.prepare(`SELECT id, name, email, role, assigned_counter, created_at FROM users WHERE office_id = ? AND role = 'staff'`).all(id);
  res.json({ staff });
});

// Add Staff


// Register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone, role, adminKey, dob, gender, officeDetails } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const existing = usersStmt.getByEmail.get(email);
  if (existing) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  // Validate Admin/Owner Key
  // If role is office_owner, we may not need a key, OR strictly require one.
  // For now, allowing open registration for 'office_owner' per user flow requests.
  if (role === 'admin' && adminKey !== 'admin-secret') { // Replace with env var
    // return res.status(403).json({ error: 'Invalid Admin Key' });
  }

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = toIso();

  try {
    // Transactional Insert
    const createTx = db.transaction(() => {
      usersStmt.insert.run({
        id, name, email, hash: passwordHash, phone, role,
        dob, gender, age: null, is_verified: 0, admin_key: adminKey,
        created_at: now
      });

      // Create Office if details provided
      if (role === 'office_owner' && officeDetails) {
        const officeId = uuidv4();
        officesStmt.insert.run({
          id: officeId,
          name: officeDetails.name || `${name}'s Office`,
          service_type: officeDetails.serviceType || 'General',
          daily_capacity: officeDetails.dailyCapacity || 100,
          available_today: officeDetails.dailyCapacity || 100, // Reset daily
          operating_hours: `${officeDetails.openingTime || '09:00'}-${officeDetails.closingTime || '17:00'}`,
          latitude: 0, longitude: 0,
          avg_service_minutes: officeDetails.avgServiceMinutes || 10,
          owner_id: id,
          created_at: now,
          counter_count: officeDetails.counterCount || 1,
          max_allocated: 3,
          address: officeDetails.address || '',
          opening_time: officeDetails.openingTime || '09:00',
          closing_time: officeDetails.closingTime || '17:00',
          lunch_start: officeDetails.lunchStart || '',
          lunch_end: officeDetails.lunchEnd || '',
          auto_noshow_enabled: officeDetails.autoNoShow ? 1 : 0
        });
      }

      // Create Email Verification
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      // Send Email (Mock)
      // console.log(`OTP for ${email}: ${otp}`);
      // For demo, auto-verify for dev speed if needed, but user flow has OTP step.
      // We will insert OTP record.
      db.prepare('REPLACE INTO email_verifications (email, otp, expires_at) VALUES (?, ?, ?)').run(
        email, otp, new Date(Date.now() + 600000).toISOString()
      );
      return otp; // Return for debug/log
    });

    const otp = createTx();
    console.log(`[DEV] Reg OTP for ${email}: ${otp}`);

    const user = { id, name, email, role, is_verified: 0 };
    // Issue token but is_verified=0 will block access in App.jsx
    const token = jwt.sign({ id, role, email }, jwtSecret, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// Remove Staff
app.delete('/api/offices/:id/staff/:staffId', authenticateToken, (req, res) => {
  const { id, staffId } = req.params;
  if (req.user.role !== 'office_owner' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });

  // Ensure staff belongs to this office
  const target = usersStmt.getById.get(staffId);
  if (!target || target.office_id !== id) return res.status(404).json({ error: 'Staff not found in this office' });

  // Delete user (or soft delete? For now hard delete per prompt "Remove staff")
  db.prepare('DELETE FROM active_staff WHERE user_id = ?').run(staffId);
  db.prepare('DELETE FROM users WHERE id = ?').run(staffId);

  // Refresh dashboard
  const staffList = activeStaffStmt.getForOffice.all(id);
  io.to(`office_${id}`).emit('staff_update', staffList);

  res.json({ success: true });
});

// Get All Staff (Registered)
app.get('/api/offices/:id/staff', (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);

  // Fetch from users table where role is staff and office_id matches
  // Note: Schema might need office_id on users if not already present. 
  // Based on staff table migration in db.js, we should join or query 'staff' table or 'users' with office_id.
  // Assuming 'users' has office_id for simplicity as per Register logic.

  try {
    const allStaff = db.prepare(`
      SELECT u.id, u.name, u.email, u.assigned_counter, u.role
      FROM users u
      WHERE u.office_id = ? AND (u.role = 'staff' OR u.role = 'operator')
    `).all(id);

    // Enrich with Active Status from active_staff
    const activeSessions = activeStaffStmt.getForOffice.all(id);
    const activeUserIds = new Set(activeSessions.map(s => s.user_id));

    const enrichedStaff = allStaff.map(s => ({
      ...s,
      status: activeUserIds.has(s.id) ? 'Active' : 'Offline',
      counter: s.assigned_counter ? `Counter #${s.assigned_counter}` : 'Unassigned'
    }));

    res.json({ staff: enrichedStaff });
  } catch (e) {
    console.error('Get Staff Error:', e);
    // Fallback/Empty
    res.json({ staff: [] });
  }
});

// Update Staff Details
app.put('/api/offices/:id/staff/:staffId', authenticateToken, (req, res) => {
  const { id, staffId } = req.params;
  const { name, email, counter } = req.body;

  if (req.user.role !== 'office_owner' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access Denied' });
  }

  try {
    // 1. Update User Profile
    db.prepare(`
      UPDATE users 
      SET name = COALESCE(@name, name), 
          email = COALESCE(@email, email),
          assigned_counter = COALESCE(@counter, assigned_counter)
      WHERE id = @staffId AND office_id = @id
    `).run({ name, email, counter: parseInt(counter), staffId, id });

    // 2. If valid active session exists, update it too (optional but good for consistency)
    // Could force logout or just update active_staff row if beneficial.

    // Refresh List for all
    // We can't easily push to dashboard unless we have socket room, which we do.
    // Fetch fresh list
    const freshList = db.prepare(`SELECT u.id, u.name, u.email, u.assigned_counter FROM users u WHERE u.office_id = ? AND u.role = 'staff'`).all(id);
    io.to(`office_${id}`).emit('staff_list_update', freshList); // Specific event

    res.json({ success: true });
  } catch (e) {
    console.error('Update Staff Error:', e);
    res.status(500).json({ error: 'Failed to update staff' });
  }
});

// Create New Staff (With Validation)
app.post('/api/offices/:id/staff', authenticateToken, (req, res) => {
  const { id } = req.params; console.log('[BOOK] Request Body:', req.body);
  const { name, email, counter, password } = req.body;

  if (req.user.role !== 'office_owner' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access Denied' });
  }

  if (!password) return res.status(400).json({ error: 'Password is required for new staff.' });

  try {
    // 1. Validate Capacity
    const office = officesStmt.getById.get(id);
    if (!office) return res.status(404).json({ error: 'Office not found' });

    const staffCount = db.prepare(`SELECT COUNT(*) as count FROM users WHERE office_id = ? AND role = 'staff'`).get(id).count;

    if (staffCount >= office.active_counters) {
      return res.status(400).json({ error: 'Cannot add more staff than active counters.' });
    }

    // 2. Create User
    const { v4: uuidv4 } = require('uuid');
    const newId = uuidv4();

    // Hash Password
    const hash = bcrypt.hashSync(password, 10);

    // Check if email unique
    const existing = usersStmt.getByEmail.get(email);
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    // Insert
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, office_id, assigned_counter, created_at, is_verified)
      VALUES (@id, @name, @email, @hash, 'staff', @office_id, @counter, @created_at, 1)
    `).run({
      id: newId,
      name,
      email,
      hash,
      office_id: id,
      counter: parseInt(counter),
      created_at: new Date().toISOString()
    });

    // Refresh List
    const freshList = db.prepare(`SELECT u.id, u.name, u.email, u.assigned_counter FROM users u WHERE u.office_id = ? AND u.role = 'staff'`).all(id);
    io.to(`office_${id}`).emit('staff_list_update', freshList);

    res.json({ success: true, staffId: newId });

  } catch (e) {
    console.error('Create Staff Error:', e);
    res.status(500).json({ error: 'Failed to create staff' });
  }
});



app.get('/api/offices', (req, res) => {
  const { owner } = req.query;

  if (owner === 'me') {
    // Manual Auth Check
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    let user;
    try {
      user = jwt.verify(token, jwtSecret);
    } catch (e) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    // Return only offices owned by the logged-in user
    const myOffices = db.prepare('SELECT * FROM offices WHERE owner_id = ? ORDER BY created_at DESC').all(user.id);
    return res.json({ offices: myOffices });
  }

  // Public endpoint (for customers) - Ideally should filter only 'LIVE' offices or nearby
  const offices = officesStmt.getAll.all();
  res.json({ offices });
});

app.post('/api/offices', (req, res) => {
  const {
    name, serviceType, dailyCapacity, operatingHours, latitude, longitude, avgServiceMinutes, counterCount, ownerId,
    address, openingTime, closingTime, lunchStart, lunchEnd, autoNoShow
  } = req.body;
  // Basic validation or auth check (ownerId usually from token in real app, but simplified here)

  const N = parseInt(counterCount) || 1;
  const M = N * 3;

  const office = {
    id: uuidv4(),
    name,
    service_type: serviceType,
    daily_capacity: Number(dailyCapacity),
    operating_hours: operatingHours,
    latitude: latitude || null,
    longitude: longitude || null,
    avg_service_minutes: Number(avgServiceMinutes) || 10,
    owner_id: ownerId || null, // In production, grab from req.user
    created_at: toIso(),
    counter_count: N,
    max_allocated: M,
    address: address || '',
    opening_time: openingTime || '09:00',
    closing_time: closingTime || '17:00',
    lunch_start: lunchStart || '',
    lunch_end: lunchEnd || '',
    auto_noshow_enabled: autoNoShow ? 1 : 0
  };

  try {
    officesStmt.insert.run(office);
    res.status(201).json({ office });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Update Retention Settings
app.put('/api/admin/settings', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'office_owner') return res.status(403).json({ error: 'Admins only' });

  const { userId, retentionDays } = req.body;
  if (!userId || !retentionDays) return res.status(400).json({ error: 'Missing fields' });

  usersStmt.updateRetention.run(retentionDays, userId);
  res.json({ success: true, retentionDays });
});

// Get Token History (Filtered)
app.get('/api/admin/token-history', authenticateToken, requireOffice, (req, res) => {
  // Allow office_owner and admin (and maybe staff if permitted)
  // requireOffice ensures req.user.office_id exists

  const officeId = req.user.office_id; // STRICT ISOLATION
  const { start, end, status } = req.query;
  const startDate = start ? new Date(start).toISOString() : new Date(0).toISOString();
  const endDate = end ? new Date(end).toISOString() : new Date().toISOString();

  let data = historyStmt.getByFilter.all(officeId, startDate, endDate);

  if (status && status !== 'all') {
    data = data.filter(t => t.status.toLowerCase() === status.toLowerCase());
  }

  res.json({ history: data });
});

// Export Token History (Excel)
app.get('/api/admin/token-history/export', authenticateToken, requireOffice, async (req, res) => {
  if (req.user.role !== 'office_owner') return res.status(403).json({ error: 'Access Denied' });

  const officeId = req.user.office_id; // STRICT ISOLATION
  const { start, end } = req.query;
  const startDate = start ? new Date(start).toISOString() : new Date(0).toISOString();
  const endDate = end ? new Date(end).toISOString() : new Date().toISOString();

  const data = historyStmt.getByFilter.all(officeId, startDate, endDate);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Token History');

  // Columns: Token ID, User Name, User Email, Office Name (Need lookup?), Status, ETA, Service Start, Completion, Total Time, Created Date
  sheet.columns = [
    { header: 'Token No', key: 'token_number', width: 10 },
    { header: 'Customer Name', key: 'user_name', width: 20 },
    { header: 'Contact', key: 'user_contact', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Service Type', key: 'service_type', width: 20 },
    { header: 'Created At', key: 'created_at', width: 25 },
    { header: 'Called At', key: 'called_at', width: 25 },
    { header: 'Completed At', key: 'completed_at', width: 25 },
    { header: 'Wait Time (Min)', key: 'wait_time', width: 15 },
    { header: 'Service Duration (Min)', key: 'service_duration', width: 15 },
  ];

  data.forEach(t => {
    const created = t.created_at ? new Date(t.created_at) : null;
    const called = t.called_at ? new Date(t.called_at) : null;
    const completed = t.completed_at ? new Date(t.completed_at) : null;

    const waitTime = (created && called) ? Math.round((called - created) / 60000) : 0;
    const serviceDuration = (called && completed) ? Math.round((completed - called) / 60000) : 0;

    sheet.addRow({
      token_number: t.token_number,
      user_name: t.user_name,
      user_contact: t.user_contact,
      status: t.status,
      service_type: t.service_type,
      created_at: created ? created.toLocaleString() : '',
      called_at: called ? called.toLocaleString() : '',
      completed_at: completed ? completed.toLocaleString() : '',
      wait_time: waitTime,
      service_duration: serviceDuration
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=token_history_${officeId}_${Date.now()}.xlsx`);

  res.end();
});

/* --- AI Prediction Loop --- */
const recalculateArrivalLikelihood = (officeId) => {
  const office = officesStmt.getById.get(officeId);
  if (!office) return;

  const tokens = tokensStmt.getForOffice.all(officeId).filter(t => t.status === 'ALLOCATED');
  if (tokens.length === 0) return;

  const now = Date.now();
  let changes = false;

  tokens.forEach(token => {
    // Skip if arrived
    if (token.presence_status === 'ARRIVED') return;

    let user = null;
    if (token.user_id) user = usersStmt.getById.get(token.user_id);

    const score = calculateArrivalScore(token, user);

    // Classify
    let status = 'PROBABLE_NO_SHOW';
    if (score >= 0.75) status = 'LIKELY_TO_ARRIVE';
    else if (score >= 0.40) status = 'ON_THE_WAY';

    // Auto No-Show Check
    // If score < 0.25 AND time > expected + 5 mins grace
    const uniqueEta = token.expected_arrival_time;
    if (score < 0.25 && uniqueEta) {
      const etaTime = new Date(uniqueEta).getTime();
      if (now > etaTime + 5 * 60000) {
        // Trigger No-Show
        console.log(`AI Auto No-Show: Token ${token.token_number} (Score: ${score.toFixed(2)})`);
        tokensStmt.updateStatus.run({
          id: token.id,
          status: 'no-show',
          allocation_time: token.allocation_time,
          service_start_time: null,
          expected_completion_time: null,
          called_at: null,
          completed_at: toIso(),
          now: toIso(),
          eta: null,
          appointment_date: null
        });
        // Update Stats
        if (token.user_id) {
          usersStmt.updateStats.run({ id: token.user_id, completed_inc: 0, no_show_inc: 1, delay: 0, now: toIso() });
        }
        changes = true;
        return; // Stop processing this token
      }
    }

    // Update DB if score changed sufficiently to avoid trashing DB? 
    // Just update. SQLite WAL is fast.
    tokensStmt.updatePrediction.run({
      id: token.id,
      score,
      status,
      expected_time: token.expected_arrival_time || new Date(now + (token.travel_time_minutes || 15) * 60000).toISOString()
    });
    changes = true;
  });

  if (changes) {
    io.to(`office_${officeId}`).emit('queue_update', {
      officeId,
      tokens: enrichTokens(tokensStmt.getForOffice.all(officeId))
      // We could send just the updates but full refresh is safer for sync
    });
  }
};

// Run Prediction Loop every 30s
setInterval(() => {
  try {
    const offices = officesStmt.getAll.all();
    offices.forEach(o => recalculateArrivalLikelihood(o.id));
  } catch (e) {
    console.error('Prediction Loop Error:', e);
  }
}, 30000);

/* --- Cron Jobs --- */

// Daily Archival (Midnight)
cron.schedule('0 0 * * *', () => {
  console.log('Running Daily Archival...');
  try {
    const now = toIso();
    const today = now.split('T')[0];
    const info = historyStmt.archive.run({ archivedAt: now, today });
    historyStmt.deleteArchivedTokens.run({ today }); // Pass today
    console.log(`Archived ${info.changes} tokens.`);
    io.emit('queue_update', { all: true }); // Resync all clients
  } catch (err) {
    console.error('Archival Failed:', err);
  }
});

// Daily Cleanup (1:00 AM) - Respects Retention
cron.schedule('0 1 * * *', () => {
  console.log('Running History Cleanup...');
  try {
    const offices = officesStmt.getAll.all();
    for (const office of offices) {
      if (!office.owner_id) continue;

      const owner = usersStmt.getById.get(office.owner_id);
      const retentionDays = owner?.history_retention_days || 30;

      const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000)).toISOString();

      const res = historyStmt.cleanupForOffice.run(office.id, cutoffDate);
      if (res.changes > 0) {
        console.log(`Cleaned ${res.changes} old tokens for Office ${office.name} (Retention: ${retentionDays}d)`);
      }
    }
  } catch (err) {
    console.error('Cleanup Failed:', err);
  }
});

// --- REMINDERS ---

// 1. Next Day Reminder (8 PM)
cron.schedule('0 20 * * *', () => {
  console.log('Running Next Day Reminders...');
  try {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    // We need a way to find tokens by date globally or iterate.
    // Efficient way: query tokens table directly.
    const tokens = db.prepare(`SELECT * FROM tokens WHERE appointment_date = ? AND status IN ('WAIT', 'ALLOCATED')`).all(tomorrow);

    tokens.forEach(t => {
      const recipientEmail = (t.user_contact && t.user_contact.includes('@')) ? t.user_contact : (t.user_id ? usersStmt.getById.get(t.user_id)?.email : null);
      if (recipientEmail) {
        // Assuming we have a template or generic message
        sendEmail(recipientEmail, 'Reminder: Appointment Tomorrow - GetEzi', emailTemplates.bookingConfirmation(
          t.user_name, t.token_number, 'Your Office', '', t.created_at
        ).replace('Booking Confirmed', 'Appointment Reminder').replace('Your booking has been confirmed', 'This is a reminder for your appointment tomorrow'));
        // Better to have dedicated template but reusing for now to save space
      }
    });
  } catch (e) { console.error("Reminder Job Error:", e); }
});

// 2. Midnight Migration (FUTURE -> WAIT)
const runMigration = () => {
  console.log('Running Migration (FUTURE -> WAIT)...');
  try {
    // Use Local Date (YYYY-MM-DD) correctly relative to server timezone
    // This ensures if it's Jan 26th locally, we process Jan 26th's bookings.
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    // Also catch any PAST dates that are still FUTURE (e.g. yesterday's missed ones)
    const info = db.prepare(`
        UPDATE tokens
        SET status = 'WAIT', allocation_time = NULL 
        WHERE appointment_date <= ? AND status = 'FUTURE'
      `).run(today);

    if (info.changes > 0) {
      console.log(`Migrated ${info.changes} tokens to Active Queue for/before ${today}`);
      // Trigger Recalc
      const offices = db.prepare('SELECT id FROM offices WHERE state = "LIVE"').all();
      offices.forEach(o => {
        try { recalculateQueue(o.id); } catch (e) { }
      });
    }
  } catch (e) { console.error("Migration Error:", e); }
};

// Run immediately on startup to catch missed jobs
runMigration();

cron.schedule('0 0 * * *', () => {
  runMigration();
});

// 2. Same Day Reminder (7 AM)
cron.schedule('0 7 * * *', () => {
  console.log('Running Same Day Reminders...');
  try {
    const today = new Date().toISOString().split('T')[0];
    const tokens = db.prepare(`SELECT * FROM tokens WHERE appointment_date = ? AND status IN ('WAIT', 'ALLOCATED')`).all(today);

    tokens.forEach(t => {
      const recipientEmail = (t.user_contact && t.user_contact.includes('@')) ? t.user_contact : (t.user_id ? usersStmt.getById.get(t.user_id)?.email : null);
      if (recipientEmail) {
        sendEmail(recipientEmail, 'Reminder: Appointment Today - GetEzi', `
           <div style="font-family: sans-serif; padding: 20px;">
             <h2>Appointment Today</h2>
             <p>Hello ${t.user_name},</p>
             <p>This is a reminder that you have an appointment/token <strong>#${t.token_number}</strong> scheduled for today.</p>
             <p>Please check the app for live status.</p>
           </div>
         `);
      }
    });
  } catch (e) { console.error("Same Day Reminder Job Error:", e); }
});

// Debug Endpoint
app.get('/api/debug-stmts', (req, res) => {
  res.json({
    tokensStmt: !!tokensStmt,
    tokensStmt_getForOffice: !!(tokensStmt && tokensStmt.getForOffice),
    activeStaffStmt: !!activeStaffStmt,
    activeStaffStmt_getForOffice: !!(activeStaffStmt && activeStaffStmt.getForOffice)
  });
});

// 404/Error
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// --- STRICT NO-SHOW ENFORCER ---
// Checks every minute for tickets that missed their ETA + Grace Period
setInterval(() => {
  try {
    const GRACE_MINUTES = 5;
    const now = new Date();
    const graceCutoff = new Date(now.getTime() - GRACE_MINUTES * 60000).toISOString();

    // Find Late Tokens (WAITING for Today, Not Arrived, ArrivalTime < Cutoff)
    // We use expected_completion_time as the "Arrival Time" field per new schema usage
    const lateTokens = db.prepare(`
      SELECT * FROM tokens 
      WHERE status = 'WAIT' 
      AND presence_status != 'ARRIVED' 
      AND expected_completion_time < ?
    `).all(graceCutoff);

    if (lateTokens.length > 0) {
      console.log(`[NO-SHOW] Found ${lateTokens.length} late tickets. Moving to end of queue...`);

      const updateStmt = db.prepare(`
        UPDATE tokens 
        SET created_at = ?, expected_completion_time = NULL 
        WHERE id = ?
      `);

      db.transaction(() => {
        lateTokens.forEach(t => {
          // Move to End: Reset created_at to NOW.
          // This pushes them to the bottom of the "ORDER BY created_at" list.
          // We clear expected_completion_time so they don't get punished again immediately 
          // (RecalculateQueue will assign new ETA).
          updateStmt.run(toIso(), t.id);

          // Notify
          io.to(`user_${t.user_id}`).emit('notification', {
            message: `You missed your arrival time! You have been moved to the end of the queue.`,
            type: 'alert'
          });
        });
      })();

      // Trigger Queue Recalc
      const distinctOffices = [...new Set(lateTokens.map(t => t.office_id))];
      distinctOffices.forEach(oid => recalculateQueue(oid));
    }
  } catch (e) {
    console.error('No-Show Enforcer Error:', e);
  }
}, 60000); // Run every 1 minute


server.listen(port, () => {
  console.log(`Queue System Active on ${port}`);
});
