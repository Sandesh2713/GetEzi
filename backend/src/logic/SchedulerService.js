
const db = require('../db');
const nodemailer = require('nodemailer');
// const OfficeStatusEngine = require('./OfficeStatusEngine'); // Unused currently, logic in-lined

const SchedulerService = {

    activateDailyTickets: async () => {
        try {
            console.log('[Scheduler] Running Daily Activation...');
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];

            // 1. Find UPCOMING tokens for TODAY
            // Status checks: 'UPCOMING', 'FUTURE', 'booked'
            const tokens = db.prepare(`
          SELECT t.*, o.opening_time, o.avg_service_minutes, o.name as office_name, o.address as office_address
          FROM tokens t
          JOIN offices o ON t.office_id = o.id
          WHERE t.appointment_date = ? 
          AND t.status IN ('UPCOMING', 'FUTURE', 'booked') 
        `).all(dateStr);

            if (tokens.length === 0) return;

            console.log(`[Scheduler] Found ${tokens.length} tickets to activate.`);

            const updateStmt = db.prepare(`
            UPDATE tokens SET status = 'WAIT', allocation_time = ? WHERE id = ?
        `);

            for (const token of tokens) {
                // 2. Activate
                updateStmt.run(new Date().toISOString(), token.id);

                // 3. Trigger Reminder / Calc ETA
                await SchedulerService.sendReminder(token);
            }
        } catch (err) {
            console.error('[Scheduler Error]', err);
        }
    },

    sendReminder: async (token) => {
        try {
            // 4. Calculate Smart ETA
            const qStmt = db.prepare(`
            SELECT COUNT(*) as count FROM tokens 
            WHERE office_id = ? AND status IN ('WAIT', 'ALLOCATED', 'CALLED') 
            AND appointment_date = ?
        `);
            const count = qStmt.get(token.office_id, token.appointment_date).count;
            const position = count;
            const isFirst = position <= 1;

            // Buffer Logic
            const openingTime = token.opening_time || '09:00';
            const bufferMinutes = 5;

            const openDate = new Date();
            const [h, m] = openingTime.split(':');
            openDate.setHours(h, m, 0, 0);

            let targetTime;
            if (isFirst) {
                targetTime = new Date(openDate.getTime() + bufferMinutes * 60000);
            } else {
                const avgService = token.avg_service_minutes || 10;
                const waitMinutes = (position - 1) * avgService;
                const now = new Date();
                const baseTime = now < openDate ? openDate : now;
                targetTime = new Date(baseTime.getTime() + waitMinutes * 60000);
            }

            if (targetTime < new Date()) targetTime = new Date(Date.now() + 5 * 60000);

            // 5. Calculate Travel
            const travelMinutes = token.travel_time_minutes || 15;

            // 6. Leave By Time
            const leaveBy = new Date(targetTime.getTime() - travelMinutes * 60000);

            const fmt = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Email Content
            const recipient = token.user_contact && token.user_contact.includes('@') ? token.user_contact : null;
            // Also check if token.user_email is populated if user_contact not joined
            // Our query was SELECT t.* ... t is tokens type. Check if user_email is available.
            // It might not be in t.*. Ideally we join users u ON t.user_id = u.id to get email.
            // Let's assume user_contact is correct or fetch properly.
            // The query above lacks user join. I'll add a quick fetch if missing.
            let emailTo = recipient;
            if (!emailTo && token.user_id) {
                const u = db.prepare('SELECT email FROM users WHERE id = ?').get(token.user_id);
                if (u) emailTo = u.email;
            }

            if (!emailTo) return console.log('[Email] No recipient found for token', token.id);

            // Maps Link
            let mapLink = '#';
            if (token.office_address) {
                // Check if we have lat/lng? Not in basic schema check, but address works.
                mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(token.office_address)}`;
            }

            const htmlContent = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1e293b; margin-top: 0;">Your Appointment is Today!</h2>
            <p style="color: #475569;">Hello <strong>${token.user_name}</strong>,</p>
            <p style="color: #475569;">This is a reminder for your appointment at <strong>${token.office_name}</strong>.</p>
            
            <div style="background: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <div style="font-size: 14px; color: #64748b; margin-bottom: 5px;">TARGET ARRIVAL TIME</div>
              <div style="font-size: 24px; font-weight: bold; color: #1d4ed8;">${fmt(targetTime)}</div>
              
              <div style="margin-top: 15px; font-size: 14px; color: #64748b; margin-bottom: 5px;">LEAVE BY</div>
              <div style="font-size: 20px; font-weight: bold; color: #b91c1c;">${fmt(leaveBy)} <span style="font-size:14px; color:#64748b; font-weight:normal;">(includes ${travelMinutes} min travel)</span></div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 20px;">
              <a href="${mapLink}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Get Directions</a>
            </div>
            
            <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">
              Token #${token.token_number} • ${token.office_address}
            </p>
          </div>
        `;

            // Transporter
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com', port: 587, secure: false,
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            });

            if (process.env.SMTP_USER) {
                await transporter.sendMail({
                    from: '"GetEzi Queue" <' + process.env.SMTP_USER + '>',
                    to: emailTo,
                    subject: 'Ready to go? Your appointment is today',
                    html: htmlContent
                });
                console.log(`[Email] Sent reminder to ${emailTo}`);
            } else {
                console.log('[Email Mock] Would send:', { to: emailTo, leaveBy: fmt(leaveBy) });
            }
        } catch (e) {
            console.error('[Email Error]', e);
        }
    }
};

module.exports = SchedulerService;
