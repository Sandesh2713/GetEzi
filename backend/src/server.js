const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const db = require('./db');
const bcrypt = require('bcryptjs');
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

      // 1. Update Session (Spectators + Operators)
      activeStaffStmt.updateHeartbeat.run({
        now: new Date(now).toISOString(),
        socket_id: socket.id,
        user_id: userId
      });

      // 2. Pulse Counter (If Operator) - Keeps Lock Alive
      countersStmt.pulse.run(now, userId);

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

    // 1. Find Stale Counters (Ghost Desks - Critical)
    const staleCounters = countersStmt.getStale.all(CUTOFF_MS);

    // 2. Find Stale Spectators (Ghost Sessions)
    // Note: getStale uses ISO string for active_staff
    const staleSessions = activeStaffStmt.getStale.all({ cutoff: CUTOFF_ISO });

    // Create unique set of user IDs to release
    const toRelease = new Set([
      ...staleCounters.map(c => c.user_id),
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

/* --- Database Statements --- */
const officesStmt = {
  getById: db.prepare(`SELECT * FROM offices WHERE id = ?`),
  getAll: db.prepare(`SELECT * FROM offices ORDER BY created_at DESC`),
  insert: db.prepare(`
    INSERT INTO offices (id, name, service_type, daily_capacity, available_today, operating_hours, latitude, longitude, avg_service_minutes, owner_id, created_at, counter_count, max_allocated)
    VALUES (@id, @name, @service_type, @daily_capacity, @daily_capacity, @operating_hours, @latitude, @longitude, @avg_service_minutes, @owner_id, @created_at, @counter_count, @max_allocated)
  `),
  updateStats: db.prepare(`UPDATE offices SET avg_service_minutes = @avg WHERE id = @id`),
  updateConfig: db.prepare(`UPDATE offices SET counter_count = @n, max_allocated = @m WHERE id = @id`),
  updateState: db.prepare(`UPDATE offices SET state = @state, pause_started_at = @time WHERE id = @id`),
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

const countersStmt = {
  // Sync
  deleteExcess: db.prepare(`DELETE FROM counters WHERE office_id = ? AND counter_number > ?`),
  insert: db.prepare(`INSERT OR IGNORE INTO counters (office_id, counter_number) VALUES (?, ?)`),

  // Claim
  checkOwner: db.prepare(`SELECT * FROM counters WHERE user_id = ?`),
  findFree: db.prepare(`SELECT id FROM counters WHERE office_id = ? AND user_id IS NULL ORDER BY counter_number ASC LIMIT 1`),
  claim: db.prepare(`UPDATE counters SET user_id = ? WHERE id = ?`),

  // Release
  release: db.prepare(`UPDATE counters SET user_id = NULL WHERE user_id = ?`)
};

const syncCounters = (officeId, maxCounters) => {
  // 1. Remove excess (if availability reduced)
  // Be careful: if a user is assigned to a high counter, they lose it? 
  // User req doesn't specify, but implies consistency. 
  // For now we wipe excess.
  countersStmt.deleteExcess.run(officeId, maxCounters);

  // 2. Add missing
  for (let c = 1; c <= maxCounters; c++) {
    countersStmt.insert.run(officeId, c);
  }
};

const assignStaffRole = (officeId, userId, maxCounters) => {
  // 0. Ensure counters exist
  syncCounters(officeId, maxCounters);

  let assignedRole = 'SPECTATOR';
  let assignedCounter = null;

  // Transaction for Atomicity
  const txn = db.transaction(() => {
    // 1. Check if user already owns a counter (Reconnect/Refresh safety)
    const existing = countersStmt.checkOwner.get(userId);
    if (existing) {
      if (existing.office_id === officeId.toString()) { // Ensure same office
        return { role: 'OPERATOR', counter_number: existing.counter_number };
      } else {
        // User moved office? Release old lock.
        countersStmt.release.run(userId);
      }
    }

    // 2. Try to grab first free counter
    // "SELECT FOR UPDATE" equivalent in SQLite transaction
    const free = countersStmt.findFree.get(officeId);
    if (free) {
      countersStmt.claim.run(userId, free.id);
      return { role: 'OPERATOR', counter_number: db.prepare('SELECT counter_number FROM counters WHERE id = ?').get(free.id).counter_number };
    }

    // 3. Fallback
    return { role: 'SPECTATOR', counter_number: null };
  });

  return txn();
};

const releaseStaff = (userId) => {
  // 1. Get current staff info for context (before delete)
  const staff = activeStaffStmt.getByUser.get(userId);
  if (!staff) return null;

  // 2. Remove from Active Staff (Session)
  activeStaffStmt.delete.run(userId);

  // 3. Release Counter Lock
  countersStmt.release.run(userId);

  // 4. Promotion Logic
  let promotedUser = null;

  // Only promote if we actually freed a spot? 
  // Technically countersStmt.release ensures a spot is free (if they had one).
  // We check if there's a spectator waiting.
  const spectator = activeStaffStmt.getOldestSpectator.get(staff.office_id);

  if (spectator) {
    // Try to assign them a role (Atomic Claim)
    // We need office max counters? Use a default or fetch office.
    // Ideally pass it in, but here we don't have it.
    // Fetch office config:
    const office = officesStmt.getById.get(staff.office_id);
    const N = office ? (office.counter_count || 1) : 1;

    const assignment = assignStaffRole(staff.office_id, spectator.user_id, N);

    if (assignment.role === 'OPERATOR') {
      // Update their session in active_staff
      activeStaffStmt.updateRole.run(assignment.counter_number, spectator.user_id);

      promotedUser = {
        userId: spectator.user_id,
        newRole: 'OPERATOR',
        counterNumber: assignment.counter_number
      };
    }
  }

  return {
    officeId: staff.office_id,
    promotedUser
  };
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
  const office = officesStmt.getById.get(officeId);
  if (!office) return;

  const allTokens = tokensStmt.getForOffice.all(officeId);
  // Sort by created_at (FIFO)
  const activeTokens = allTokens.filter(t => ['WAIT', 'ALLOCATED', 'CALLED'].includes(t.status));

  // 1. Define Capacity
  const N = office.counter_count || 1;
  const M = N * 3;

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
        // Actually, since we modified DB, maybe safer to return and let next trigger handle?
        // But to be safe, we just mark badToken as processed to avoid double swap in same loop?
        // For simplicity, we assume one swap per tick is fine or splice.
      }
    }
  });

  // Re-fetch to be safe after swaps
  const freshTokens = tokensStmt.getForOffice.all(officeId);
  allocatedTokens = freshTokens.filter(t => t.status === 'ALLOCATED');
  waitTokens = freshTokens.filter(t => t.status === 'WAIT');

  // --- 1.5 Grace Period Logic (Auto No-Show) ---
  if (allocatedTokens.length > 0) {
    // Only enforced on the very first token to prevent blocking? 
    // Or strictly all allocated tokens have a timer?
    // Prompt: "When a token becomes eligible to be called" -> Allocation Time.
    // We check ALL allocated tokens that are NOT_ARRIVED.
    allocatedTokens.forEach((token, idx) => {
      if (token.presence_status !== 'ARRIVED') {
        const nowMs = Date.now();
        if (!token.eligibility_time) {
          // First time seen as allocated/eligible? 
          // Ideally set when status becomes ALLOCATED.
          // Backfill if missing (migration safety).
          tokensStmt.updateEligibility.run({ id: token.id, time: toIso() });
          token.eligibility_time = toIso();
        }

        const elgTime = new Date(token.eligibility_time).getTime();
        const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 mins

        if (nowMs - elgTime > GRACE_PERIOD_MS) {
          // Mark No-Show
          console.log(`Auto No-Show for Token ${token.token_number}`);
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
          const office = officesStmt.getById.get(officeId);
          const recipientEmail = (token.user_contact && token.user_contact.includes('@')) ? token.user_contact : token.user_email;
          if (recipientEmail) {
            sendEmail(recipientEmail, 'Missed Appointment - GetEzi', emailTemplates.tokenNoShow(token.user_name, token.token_number, office.name));
          }
          // Since we modified list in-place via DB, we should probably restart recalculate or accept slight staleness until next run?
          // We mark it, next run cleans it up.
        }
      }
    });
    // Re-fetch after potential no-shows? 
    // recalculateQueue calls itself recursively? No, infinite loop danger.
    // We proceed. no-show tokens are filtered out next time.
  }

  let currentOccupancy = calledTokens.length + allocatedTokens.length;
  let slotsOpen = M - currentOccupancy;

  if (slotsOpen > 0 && waitTokens.length > 0) {
    const toPromote = waitTokens.slice(0, slotsOpen);

    // --- SMART ASSIGNMENT LOGIC ---
    // Count load per counter (1..N)
    // Load = Count(Allocated tokens assigned to counter X)
    const counterLoad = {};
    for (let c = 1; c <= N; c++) counterLoad[c] = 0;

    allocatedTokens.forEach(t => {
      if (t.assigned_counter && t.assigned_counter <= N) {
        counterLoad[t.assigned_counter]++;
      }
    });

    toPromote.forEach(token => {
      // Find counter with min load
      let bestCounter = 1;
      let minLoad = Infinity;

      for (let c = 1; c <= N; c++) {
        if (counterLoad[c] < minLoad) {
          minLoad = counterLoad[c];
          bestCounter = c;
        }
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
    const serviceStart = new Date(serviceStartTs).toISOString();

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

    try {
      recalculateQueue(id); // Ensure state
    } catch (e) {
      console.error("Recalculate Error:", e);
      return res.status(500).json({ error: 'Queue Calculation Failed: ' + e.message });
    }

    const allTokens = tokensStmt.getForOffice.all(id);

    // SECURITY: Strict Operator Check
    const staff = activeStaffStmt.getByUser.get(req.user.id);
    if (!staff || staff.role !== 'OPERATOR') {
      return res.status(403).json({ error: 'Access Denied: Spectators cannot control the queue.' });
    }

    if (staff.counter_number !== cNum) {
      return res.status(403).json({ error: `You are assigned to Counter ${staff.counter_number}, not ${cNum}.` });
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
  if (req.user.role === 'admin') {
    const staff = activeStaffStmt.getByUser.get(req.user.id);
    if (!staff || staff.role !== 'OPERATOR') {
      return res.status(403).json({ error: 'Access Denied: Spectators cannot control the queue.' });
    }
    // Optional: Check if token was called by this counter?
    // For now, allow any operator to complete/cancel to prevent deadlocks.
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
app.post('/api/tokens/:id/cancel', (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) return res.status(404).json({ error: 'Not found' });

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
app.post('/api/tokens/:id/no-show', (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) return res.status(404).json({ error: 'Not found' });

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

// Arrive
app.post('/api/tokens/:id/arrive', (req, res) => {
  const token = tokensStmt.getById.get(req.params.id);
  if (!token) return res.status(404).json({ error: 'Not found' });

  db.transaction(() => {
    tokensStmt.markArrived.run({ id: token.id, now: toIso() });
  })();

  recalculateQueue(token.office_id);

  res.json({ success: true });
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

  // Sync atomic counters table
  syncCounters(id, N);

  recalculateQueue(id);
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
  const staff = activeStaffStmt.getByUser.get(req.user.id);
  if (!staff || staff.role !== 'OPERATOR') {
    return res.status(403).json({ error: 'Access Denied: Spectators cannot control the queue.' });
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
  const staff = activeStaffStmt.getByUser.get(req.user.id);
  if (!staff || staff.role !== 'OPERATOR') {
    return res.status(403).json({ error: 'Access Denied: Spectators cannot control the queue.' });
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

    // Fetch Active Staff Role for Admin
    let operationalRole = user.role;
    let assignedCounter = null;
    if (user.role === 'admin') {
      const activeStaff = activeStaffStmt.getByUser.get(user.id);
      if (activeStaff) {
        operationalRole = activeStaff.role;
        assignedCounter = activeStaff.counter_number;
      }
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        operational_role: operationalRole,
        assigned_counter: assignedCounter,
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
  const { email, password } = req.body;
  const user = usersStmt.getByEmail.get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Activity
  usersStmt.updateStats.run({
    id: user.id,
    completed_inc: 0,
    no_show_inc: 0,
    delay: 0,
    now: toIso()
  });

  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, jwtSecret, { expiresIn: '7d' });

  // --- STAFF LOGIC ---
  let assignedRole = user.role;
  let assignedCounter = null;

  if (user.role === 'admin') {
    const office = officesStmt.getAll.all()[0];
    if (office) {
      // Logic: Assign based on availability
      const existingStaff = activeStaffStmt.getByUser.get(user.id);

      if (existingStaff) {
        assignedRole = existingStaff.role;
        assignedCounter = existingStaff.counter_number;
        // Do NOT update database; keep session alive
      } else {
        const result = assignStaffRole(office.id, user.id, office.counter_count || 1);
        assignedRole = result.role;
        assignedCounter = result.counter_number;

        // Persist new session
        activeStaffStmt.insert.run({
          user_id: user.id,
          office_id: office.id,
          role: result.role,
          counter_number: result.counter_number,
          login_time: toIso()
        });
      }

      // Notify Dashboard of new staff
      const staffList = activeStaffStmt.getForOffice.all(office.id);
      io.to(`office_${office.id}`).emit('staff_update', staffList);
    }
  }

  res.json({
    token,
    user: {
      ...user,
      operational_role: assignedRole, // 'OPERATOR' or 'SPECTATOR'
      assigned_counter: assignedCounter
    }
  });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // Release Staff
  if (req.user.role === 'admin') {
    const result = releaseStaff(req.user.id);
    if (result && result.officeId) {
      // Refresh Dashboard for everyone
      const staffList = activeStaffStmt.getForOffice.all(result.officeId);
      io.to(`office_${result.officeId}`).emit('staff_update', staffList);

      // Recalculate queue (capacity changed)
      recalculateQueue(result.officeId);

      // Notify promoted user
      if (result.promotedUser) {
        io.to(`user_${result.promotedUser.userId}`).emit('role_update', {
          role: 'OPERATOR',
          counter_number: result.promotedUser.counterNumber
        });
      }
    }
  }
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

app.get('/api/offices', (req, res) => {
  const offices = officesStmt.getAll.all();
  res.json({ offices });
});

app.post('/api/offices', (req, res) => {
  const { name, serviceType, dailyCapacity, operatingHours, latitude, longitude, avgServiceMinutes, counterCount, ownerId } = req.body;
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
    max_allocated: M
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
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  const { userId, retentionDays } = req.body;
  if (!userId || !retentionDays) return res.status(400).json({ error: 'Missing fields' });

  usersStmt.updateRetention.run(retentionDays, userId);
  res.json({ success: true, retentionDays });
});

// Get Token History (Filtered)
app.get('/api/admin/token-history', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  // Use req.user.id to ensure they only see THEIR office? 
  // Code seems to rely on selectedOfficeId passed in query. 
  // Ideally we verify ownership, but for now Role check is better than broken Key check.

  const { officeId, start, end, status } = req.query;
  const startDate = start ? new Date(start).toISOString() : new Date(0).toISOString();
  const endDate = end ? new Date(end).toISOString() : new Date().toISOString();

  let data = historyStmt.getByFilter.all(officeId, startDate, endDate);

  if (status && status !== 'all') {
    data = data.filter(t => t.status.toLowerCase() === status.toLowerCase());
  }

  res.json({ history: data });
});

// Export Token History (Excel)
app.get('/api/admin/token-history/export', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  const { officeId, start, end } = req.query;
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

// 404/Error
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

server.listen(port, () => {
  console.log(`Queue System Active on ${port}`);
});
