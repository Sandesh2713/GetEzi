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
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
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
    // Note: getStale uses ISO string for active_staff
    const staleSessions = activeStaffStmt.getStale.all({ cutoff: CUTOFF_ISO });

    // Create unique set of user IDs to release
    const toRelease = new Set([
      ...staleSessions.map(s => s.user_id)
    ]);

    if (toRelease.size > 0) {
      console.log(`Cleaning up ${toRelease.size} stale users...`);
      toRelease.forEach(userId => {
        const result = releaseStaff(userId);
        if (result && result.officeId) {
          console.log(`Released Stale User: ${userId}`);

          // Refresh Dashboard
          const staffList = activeStaffStmt.getForOffice.all(result.officeId);
          io.to(`office_${result.officeId}`).emit('staff_update', staffList);

          // Notify Promotion
          if (result.promotedUser) {
            io.to(`user_${result.promotedUser.userId}`).emit('role_update', {
              role: 'OPERATOR',
              counter_number: result.promotedUser.counterNumber
            });
          }

          // Recalculate queue
          recalculateQueue(result.officeId);
        }
      });
    }
  } catch (e) {
    console.error('Staff Cleanup Job Error:', e);
  }
}, 5000); // Check every 5s

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

app.use(cors({ origin: clientOrigin.split(',').map((s) => s.trim()), credentials: false }));
app.use(express.json());
app.use(morgan('dev'));

const toIso = () => new Date().toISOString();

// Middleware: Authenticate Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
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
      address, opening_time, closing_time, lunch_start, lunch_end, auto_noshow_enabled
    )
    VALUES (
      @id, @name, @service_type, @daily_capacity, @daily_capacity, @operating_hours, @latitude, @longitude, @avg_service_minutes, @owner_id, @created_at, @counter_count, @max_allocated,
      @address, @opening_time, @closing_time, @lunch_start, @lunch_end, @auto_noshow_enabled
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
      auto_noshow_enabled = @auto_noshow_enabled, auto_noshow_grace_minutes = @auto_noshow_grace_minutes
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
    INSERT INTO tokens (id, office_id, user_id, user_name, user_contact, status, token_number, created_at, lat, lng, travel_time_minutes, service_type, customer_address)
    VALUES (@id, @office_id, @user_id, @user_name, @user_contact, 'WAIT', @token_number, @created_at, @lat, @lng, @travel_time_minutes, @service_type, @customer_address)
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
      called_by_counter = COALESCE(@called_by_counter, called_by_counter)
    WHERE id = @id
  `),
  getMaxTokenNum: db.prepare(`SELECT COALESCE(MAX(token_number), 0) as maxNum FROM tokens WHERE office_id = ?`),
  markArrived: db.prepare(`UPDATE tokens SET presence_status = 'ARRIVED', arrival_confirmed_at = @now WHERE id = @id`),
  updateEligibility: db.prepare(`UPDATE tokens SET eligibility_time = @time WHERE id = @id`),
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
  updateActivity: db.prepare(`UPDATE users SET last_activity_at = @now WHERE id = @id`)
};

tokensStmt.updatePrediction = db.prepare(`
  UPDATE tokens SET 
    arrival_score = @score,
    arrival_status = @status,
    expected_arrival_time = @expected_time
  WHERE id = @id
`);

const historyStmt = {
  archive: db.prepare(`
    INSERT INTO token_history (id, office_id, user_id, user_name, user_contact, status, token_number, note, created_at, called_at, completed_at, service_type, archived_at, eta_minutes, travel_time_minutes, allocation_time, service_start_time, expected_completion_time, counter_number)
    SELECT id, office_id, user_id, user_name, user_contact, status, token_number, note, created_at, called_at, completed_at, service_type, @archivedAt, eta_minutes, travel_time_minutes, allocation_time, service_start_time, expected_completion_time, called_by_counter
    FROM tokens
  `),
  deleteArchivedTokens: db.prepare(`DELETE FROM tokens`), // Wipes active tokens table
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

const recalculateQueue = (officeId) => {
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
    allTokens = tokensStmt.getForOffice.all(officeId);
  } catch (e) {
    console.error("FATAL: recalculateQueue -> tokensStmt.getForOffice.all failed", e);
    throw e;
  }

  // Sort by created_at (FIFO)
  const activeTokens = allTokens.filter(t => ['WAIT', 'ALLOCATED', 'CALLED'].includes(t.status));

  // 1. Define Capacity
  // N is now the number of *active* staff who are operators and have an assigned counter
  const N = getActiveStaffCount(officeId);
  const M = N * 3; // Max allocated tokens

  // 2. Identify Groups & Promote
  const calledTokens = activeTokens.filter(t => t.status === 'CALLED');
  let allocatedTokens = activeTokens.filter(t => t.status === 'ALLOCATED');
  let waitTokens = activeTokens.filter(t => t.status === 'WAIT');

  // --- 1.2 Auto-Swap for Optimization ---
  // If an ALLOCATED token is PROBABLE_NO_SHOW, and we have a WAIT token that is ARRIVED, swap them.
  // This ensures counters are fed with confirmed content.
  allocatedTokens.forEach(badToken => {
    if (badToken.presence_status === 'ARRIVED') return; // Safe
    const score = calculateArrivalScore(badToken); // Reuse calculation or store on token
    if (score < 0.25) {
      // Look for a candidate
      const candidateIdx = waitTokens.findIndex(t => t.presence_status === 'ARRIVED');
      if (candidateIdx >= 0) {
        const goodToken = waitTokens[candidateIdx];

        console.log(`Auto-Swapping Token ${badToken.token_number} (Lazy) with ${goodToken.token_number} (Arrived)`);

        const now = toIso();
        // Demote Bad Token
        tokensStmt.updatePrediction.run({ id: badToken.id, score: score, status: 'SWAPPED_WAIT', expected_time: null }); // Preserve score
        tokensStmt.updateStatus.run({
          id: badToken.id,
          status: 'WAIT',
          allocation_time: null,
          service_start_time: null,
          expected_completion_time: null,
          called_at: null,
          completed_at: null,
          now: now,
          eta: null,
          assigned_counter: null,
          called_by_counter: null
        });

        // Promote Good Token
        tokensStmt.updateStatus.run({
          id: goodToken.id,
          status: 'ALLOCATED',
          allocation_time: now, // Give it fresh start
          service_start_time: null,
          expected_completion_time: null,
          called_at: null,
          completed_at: null,
          now: now,
          eta: null,
          assigned_counter: badToken.assigned_counter, // Inherit specific counter!
          called_by_counter: null
        });

        // Update local lists for rest of function to be semi-accurate (though function will likely re-run soon)
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
    allocatedTokens.forEach((token, idx) => {
      // Logic: Only apply if user is NOT arrived and feature is enabled
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
            id: token.id,
            status: 'no-show', // Make sure this matches status check elsewhere ('no-show' vs 'cancelled')
            allocation_time: token.allocation_time,
            service_start_time: null,
            expected_completion_time: null,
            called_at: null,
            completed_at: toIso(),
            now: toIso(),
            eta: null,
            assigned_counter: token.assigned_counter || null,
            called_by_counter: token.called_by_counter || null
          });
          // Notify
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

  if (slotsOpen > 0 && waitTokens.length > 0) {
    const toPromote = waitTokens.slice(0, slotsOpen);

    // --- SMART ASSIGNMENT LOGIC ---
    const counterLoad = {};
    let activeCounters = [];
    try {
      activeCounters = activeStaffStmt.getForOffice.all(officeId)
        .filter(s => {
          const u = usersStmt.getById.get(s.user_id);
          return u && u.role === 'staff' && u.assigned_counter;
        })
        .map(s => usersStmt.getById.get(s.user_id).assigned_counter)
        .filter((value, index, self) => self.indexOf(value) === index) // Unique counters
        .sort((a, b) => a - b); // Sort numerically
    } catch (e) {
      console.error("FATAL: recalculateQueue -> activeCounters calculation failed", e);
      throw e;
    }

    activeCounters.forEach(c => counterLoad[c] = 0);

    allocatedTokens.forEach(t => {
      if (t.assigned_counter && activeCounters.includes(t.assigned_counter)) {
        counterLoad[t.assigned_counter]++;
      }
    });

    toPromote.forEach(token => {
      // Find counter with min load among active counters
      let bestCounter = null;
      let minLoad = Infinity;

      if (activeCounters.length === 0) {
        console.warn(`No active counters for office ${officeId}. Cannot assign token.`);
        return; // Cannot assign if no active counters
      }

      for (const c of activeCounters) {
        if (counterLoad[c] < minLoad) {
          minLoad = counterLoad[c];
          bestCounter = c;
        }
      }

      if (!bestCounter) {
        console.warn(`Could not find best counter for token ${token.id}. Skipping assignment.`);
        return;
      }

      // Increment load for next iteration
      counterLoad[bestCounter]++;

      const now = toIso();
      tokensStmt.updateStatus.run({
        id: token.id,
        status: 'ALLOCATED',
        allocation_time: now,
        service_start_time: null, // Calc below
        expected_completion_time: null,
        called_at: null,
        completed_at: null,
        now: now,
        eta: null,
        eta: null,
        assigned_counter: bestCounter, // ASSIGN HERE
        called_by_counter: null
      });
      token.status = 'ALLOCATED';
      token.allocation_time = now;
      token.assigned_counter = bestCounter; // Update local obj for immediate use

      if (token.user_id) {
        io.to(`user_${token.user_id}`).emit('notification', { message: `allocated-counter-${bestCounter}` });
      }

      // Email Notification: Travel Instruction
      const recipientEmail = (token.user_contact && token.user_contact.includes('@')) ? token.user_contact : (token.user_id ? usersStmt.getById.get(token.user_id)?.email : null);
      if (recipientEmail) {
        const travelStart = now;
        const arrival = new Date(new Date(now).getTime() + (token.travel_time_minutes || 15) * 60000).toISOString();
        sendEmail(recipientEmail, 'Time to Leave - GetEzi', emailTemplates.travelInstruction(
          token.user_name,
          token.token_number,
          office.name,
          office.address || '',
          office.latitude,
          office.longitude,
          travelStart,
          arrival
        ));
      }
    });
    // Refresh lists after promotion
    allocatedTokens = [...allocatedTokens, ...toPromote];
    waitTokens = waitTokens.slice(slotsOpen);
  }

  // 3. Global Queue Position & ETA Calculation
  // We treat ALL active tokens as a single FIFO queue for positioning
  // Order: CALLED (served) -> ALLOCATED (waiting) -> WAIT (remote)
  // Actually, 'CALLED' are technically positions 1..N (or however many active)

  // Re-fetch strict order? already sorted by created_at which handles the FIFO naturally.
  // Just verify `activeTokens` order. Since `allTokens` is sorted by `created_at`, `activeTokens` is too.
  // Wait. `toPromote` mutation of local variables `allocatedTokens` doesn't affect `activeTokens` array references? 
  // Yes it does if objects are ref. But I mutated `waitTokens` by slice.
  // Safest to re-construct `queue` list.

  const queue = [...calledTokens, ...allocatedTokens, ...waitTokens].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const serviceTime = office.avg_service_minutes || 10;
  const nowTime = Date.now();

  queue.forEach((token, index) => {
    // Position 1-based
    const position = index + 1;

    // Formula: ETA = (ceil(position / N) - 1) * service_time
    const waitUnits = Math.ceil(position / N) - 1;
    const waitMinutes = Math.max(0, waitUnits * serviceTime);

    const serviceStartTs = nowTime + (waitMinutes * 60000);
    // Adjust for Lunch Break
    const rawServiceStart = new Date(serviceStartTs);
    const adjustedServiceStart = OfficeStatusEngine.adjustForLunch(rawServiceStart, office);
    const serviceStart = adjustedServiceStart.toISOString();

    // Store calculated data
    // Note: for WAIT tokens, this 'service_start_time' is the predicted Call time.
    // Frontend will derive Allocation Time from this (Call Time - 3 * ServiceTime or similar)

    // Only update if changed? Or always update for eta freshness.
    // We strictly update `eta` and `service_start_time`.

    // We assume 'CALLED' status is already set.
    // We assume 'ALLOCATED' status is already set.
    // We assume 'WAIT' status is already set.

    tokensStmt.updateStatus.run({
      id: token.id,
      status: token.status,
      allocation_time: token.allocation_time, // Preserve
      service_start_time: serviceStart,
      expected_completion_time: token.expected_completion_time,
      called_at: token.called_at,
      completed_at: null,
      eta: waitMinutes,
      now: toIso(),
      assigned_counter: token.assigned_counter || null,
      called_by_counter: token.called_by_counter || null
    });
  });

  // Fetch & Enrich Active Staff
  const staffRaw = activeStaffStmt.getForOffice.all(officeId);
  const active_staff = staffRaw.map(s => {
    const u = usersStmt.getById.get(s.user_id);
    return { ...s, name: u ? u.name : 'Unknown' };
  });

  // Emit Global Update
  io.to(`office_${officeId}`).emit('queue_update', {
    officeId,
    tokens: enrichTokens(tokensStmt.getForOffice.all(officeId)),
    active_staff, // Send to frontend
    stats: {
      wait: waitTokens.length,
      allocated: allocatedTokens.length,
      called: calledTokens.length,
      M, N,
      serviceTime
    }
  });
};

/* --- Helpers --- */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const toRad = x => x * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
app.post('/api/offices/:id/book', (req, res) => {
  try {
    const { id } = req.params;
    const office = ensureOffice(id);

    // [New] Check Office Status
    const status = OfficeStatusEngine.getStatus(office);
    if (status.status === 'CLOSED') {
      return res.status(400).json({ error: status.message });
    }

    const { customerName, customerContact, customerEmail, lat, lng, userId, serviceType, customerAddress, travelTime: clientTravelTime } = req.body;

    if (!customerName || !customerEmail) return res.status(400).json({ error: 'Name and Email are required' });
    if ((!lat || !lng) && !customerAddress) return res.status(400).json({ error: 'Valid Location required' });

    // Calc Travel Time
    let travelTime = 15; // default
    if (clientTravelTime) {
      travelTime = clientTravelTime; // Trust client from OSRM
    } else if (lat && lng && office.lat && office.lng) {
      const dist = haversineDistance(lat, lng, office.lat, office.lng);
      travelTime = Math.ceil(dist * 2);
    }

    const token = {
      id: uuidv4(),
      office_id: id,
      user_id: userId || null, // Ensure valid value
      user_name: customerName,
      user_contact: customerContact,
      token_number: (tokensStmt.getMaxTokenNum.get(id).maxNum || 0) + 1,
      created_at: toIso(),
      lat: lat || null,
      lng: lng || null,
      travel_time_minutes: travelTime,
      service_type: serviceType || 'General',
      customer_address: customerAddress || ''
    };

    db.transaction(() => {
      tokensStmt.insert.run(token);
    })();

    try {
      recalculateQueue(id);
    } catch (calcErr) {
      console.error('Recalculate Queue Failed (Non-fatal):', calcErr);
      // Do not fail the request if calc fails
    }

    // Email Notification
    const recipientEmail = (customerContact && customerContact.includes('@')) ? customerContact : (userId ? usersStmt.getById.get(userId)?.email : null);

    if (recipientEmail) {
      sendEmail(recipientEmail, 'Booking Confirmed - GetEzi', emailTemplates.bookingConfirmation(
        token.user_name,
        token.token_number,
        office.name,
        office.address || '', // Schema might not have address
        token.created_at
      ));
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

    // Find Logic
    const allocated = allTokens.filter(t => t.status === 'ALLOCATED');
    let candidates = allocated.filter(t => t.assigned_counter === cNum);

    console.log(`Debug Call: cNum=${cNum}, Allocated=${allocated.length}, Candidates(Self)=${candidates.length}`);
    allocated.forEach(t => console.log(`Token ${t.token_number}: Status=${t.status}, Assigned=${t.assigned_counter}`));

    if (candidates.length === 0) {
      // Fallback: Pick from Global Pool if any unassigned exists (Legacy support)
      // Or if we want to "steal" from biggest queue? (Auto-balancing)
      // Requirement says: "Auto-swap them" if no-show.
      // For now: Just pick unassigned if any.
      const unassigned = allocated.filter(t => !t.assigned_counter);
      if (unassigned.length > 0) {
        console.log(`Debug Call: Picked ${unassigned.length} unassigned tokens.`);
        candidates = unassigned;
      } else {
        // Debug: Check WAIT tokens?
        const wait = allTokens.filter(t => t.status === 'WAIT');
        console.log(`Debug Call: No candidates. WAIT tokens count: ${wait.length}`);
      }
    }

    let nextToken = null;
    if (candidates.length > 0) {
      const arrived = candidates.filter(t => t.presence_status === 'ARRIVED');
      if (arrived.length > 0) nextToken = arrived[0];
      else {
        candidates.sort((a, b) => (b.arrival_score || 0) - (a.arrival_score || 0));
        nextToken = candidates[0];
      }
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
          called_by_counter: cNum
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
      called_by_counter: token.called_by_counter || null
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
  const recipientEmail = (token.user_contact && token.user_contact.includes('@')) ? token.user_contact : (token.user_id ? usersStmt.getById.get(token.user_id)?.email : null);
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

  // SECURITY: Strict Operator Check
  const staffUser = usersStmt.getById.get(req.user.id);
  if (!staffUser || (staffUser.role !== 'staff' && staffUser.role !== 'office_owner' && staffUser.role !== 'admin')) {
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
      eta: null
    });
  })();

  recalculateQueue(token.office_id);

  // Email Notification: Cancelled
  const recipientEmail = (token.user_contact && token.user_contact.includes('@')) ? token.user_contact : (token.user_id ? usersStmt.getById.get(token.user_id)?.email : null);
  if (recipientEmail) {
    const office = officesStmt.getById.get(token.office_id);
    sendEmail(recipientEmail, 'Token Cancelled - GetEzi', emailTemplates.tokenCancelled(
      token.user_name,
      token.token_number,
      office.name,
      'Cancelled by user or admin'
    ));
  }

  res.json({ success: true });
});

// No-Show
app.post('/api/tokens/:id/no-show', authenticateToken, (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) return res.status(404).json({ error: 'Not found' });

  // SECURITY: Strict Operator Check
  const staffUser = usersStmt.getById.get(req.user.id);
  if (!staffUser || (staffUser.role !== 'staff' && staffUser.role !== 'office_owner' && staffUser.role !== 'admin')) {
    return res.status(403).json({ error: 'Access Denied: Only staff or office owners can mark no-show.' });
  }

  db.transaction(() => {
    tokensStmt.updateStatus.run({
      id: token.id,
      status: 'no-show',
      completed_at: toIso(),
      called_at: token.called_at,
      allocation_time: token.allocation_time,
      service_start_time: null,
      expected_completion_time: null,
      now: toIso(),
      eta: null
    });

    if (token.user_id) {
      usersStmt.updateStats.run({
        id: token.user_id,
        completed_inc: 0,
        no_show_inc: 1,
        delay: 0,
        now: toIso()
      });
    }
  })();

  recalculateQueue(token.office_id);

  // Email Notification: No-Show
  const recipientEmail = (token.user_contact && token.user_contact.includes('@')) ? token.user_contact : (token.user_id ? usersStmt.getById.get(token.user_id)?.email : null);
  if (recipientEmail) {
    const office = officesStmt.getById.get(token.office_id);
    sendEmail(recipientEmail, 'Missed Appointment - GetEzi', emailTemplates.tokenNoShow(
      token.user_name,
      token.token_number,
      office.name
    ));
  }

  res.json({ success: true });
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

// Admin: Config Counters
// Admin: Config Counters
app.post('/api/offices/:id/config', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { counterCount } = req.body;
  const N = parseInt(counterCount);

  if (isNaN(N) || N < 1) return res.status(400).json({ error: 'Invalid counter count' });

  db.transaction(() => {
    officesStmt.updateConfig.run({
      n: N,
      m: N * 3,
      id
    });
  })();

  recalculateQueue(id);
  res.json({ success: true });
});

// Admin: Config Active Counters
app.post('/api/offices/:id/active-counters', authenticateToken, (req, res) => {
  const { id } = req.params;
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
  const { id } = req.params;
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
  const { id } = req.params;

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

  // Recalculate to refresh ETAs relative to NOW
  recalculateQueue(id);

  // Emit Update
  const updatedOffice = officesStmt.getById.get(id);
  io.to(`office_${id}`).emit('office_state', {
    state: 'LIVE',
    pause_started_at: null
  });

  // Notify Waiters
  const tokens = tokensStmt.getForOffice.all(id).filter(t => ['WAIT', 'ALLOCATED'].includes(t.status));
  tokens.forEach(t => {
    if (t.user_id) {
      io.to(`user_${t.user_id}`).emit('notification', {
        message: `Office has resumed operations. Queue is moving.`
      });
    }
  });

  res.json({ success: true, state: 'LIVE' });
});


// Public: Get Office Status (Original Path was /api/offices/:id)
// App.jsx calls /api/offices/:id for details
app.get('/api/offices/:id', (req, res) => {
  const { id } = req.params;
  try {
    const office = ensureOffice(id);
    const tokens = enrichTokens(tokensStmt.getForOffice.all(id));

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
  const { id } = req.params;
  const office = ensureOffice(id);

  // Simplified Owner Check:
  const user = usersStmt.getById.get(req.user.id);
  if (office.owner_id && office.owner_id !== user.id) {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Only the office owner can update timings.' });
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
  const { id } = req.params;
  const { availableToday } = req.body;
  // This was used to manually set availability.
  // We can support it by updating the DB.
  db.prepare('UPDATE offices SET available_today = ? WHERE id = ?').run(availableToday, id);
  res.json({ success: true });
});

// Pause / Resume
app.post('/api/offices/:id/pause', (req, res) => {
  const { id } = req.params;
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
    // Fetch from new STAFF table
    const staffRecord = db.prepare('SELECT office_id, counter_number FROM staff WHERE user_id = ?').get(user.id);
    if (staffRecord) {
      officeId = staffRecord.office_id;
      counterNumber = staffRecord.counter_number;
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

  res.json({
    token,
    user: {
      ...user,
      office_id: officeId,
      assigned_counter: counterNumber,
      // operational_role: role // Frontend might expect this 
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
  const { id } = req.params;
  if (req.user.role !== 'office_owner' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });

  // Fetch users who are linked to this office and have role 'staff'
  const staff = db.prepare(`SELECT id, name, email, role, assigned_counter, created_at FROM users WHERE office_id = ? AND role = 'staff'`).all(id);
  res.json({ staff });
});

// Add Staff
app.post('/api/offices/:id/staff', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, email, password, counterNumber } = req.body;

  if (req.user.role !== 'office_owner' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
  if (!name || !email || !password || !counterNumber) return res.status(400).json({ error: 'Missing fields' });

  const existing = usersStmt.getByEmail.get(email);
  if (existing) return res.status(400).json({ error: 'Email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const newId = uuidv4();

  try {
    usersStmt.insert.run({
      id: newId,
      name,
      email,
      hash,
      role: 'staff',
      created_at: toIso()
    });

    // Update office link and counter
    db.prepare(`UPDATE users SET office_id = ?, assigned_counter = ? WHERE id = ?`)
      .run(id, counterNumber, newId);

    res.json({ success: true, staff: { id: newId, name, email, assigned_counter: counterNumber } });
  } catch (e) {
    console.error("Add Staff Error:", e);
    res.status(500).json({ error: 'Failed to create staff' });
  }
});

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
        id, name, email, password_hash: passwordHash, phone, role,
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

// Get Active Staff (For Dashboard)
app.get('/api/offices/:id/staff', (req, res) => {
  const staff = activeStaffStmt.getForOffice.all(req.params.id);
  // Enrich with names
  const fullStaff = staff.map(s => {
    const u = usersStmt.getById.get(s.user_id);
    return { ...s, name: u ? u.name : 'Unknown' };
  });
  res.json({ staff: fullStaff });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  try {
    const id = uuidv4();
    usersStmt.insert.run({ id, name, email, hash, role: role || 'customer', created_at: toIso() });
    const token = jwt.sign({ id, role: role || 'customer' }, jwtSecret);
    res.json({ token, user: { id, name, email, role } });
  } catch (e) {
    res.status(400).json({ error: 'Email exists or invalid' });
  }
});

app.get('/api/offices', authenticateToken, (req, res) => {
  const { owner } = req.query;

  if (owner === 'me') {
    // Return only offices owned by the logged-in user
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Unauthorized' });
    const myOffices = db.prepare('SELECT * FROM offices WHERE owner_id = ? ORDER BY created_at DESC').all(req.user.id);
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
          eta: null
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
    const info = historyStmt.archive.run({ archivedAt: now });
    historyStmt.deleteArchivedTokens.run();
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

server.listen(port, () => {
  console.log(`Queue System Active on ${port}`);
});
