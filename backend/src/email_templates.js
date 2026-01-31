const layout = (content) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; background-color: #ffffff; color: #333; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
  <div style="background-color: #000; padding: 20px; text-align: center;">
    <h1 style="color: #fff; margin: 0;">GetEzi</h1>
  </div>
  <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
    ${content}
  </div>
  <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666;">
    <p>© ${new Date().getFullYear()} GetEzi Queue Management System. All rights reserved.</p>
  </div>
</div>
</body>
</html>
`;

// Helper to prevent HTML Injection
const escapeHtml = (text) => {
  if (!text) return text;
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const bookingConfirmation = (name, tokenNumber, officeName, address, time, serviceEta, travelData) => {
  const {
    travelTime, distanceKm, googleDirections, googleView, appleMaps,
    avgWaitMinutes, totalMinutes, arrivalTime
  } = travelData || {};

  return layout(`
  <div style="background:#ffffff;padding:24px;border-radius:12px">

    <h2>You're Booked at ${escapeHtml(officeName)}</h2>

    <p><b>Token:</b> ${escapeHtml(tokenNumber)}</p>
    <p><b>Date:</b> ${new Date(time).toLocaleDateString()}</p>
    <p><b>Address:</b> ${escapeHtml(address)}</p>

    <hr style="border:0;border-top:1px solid #eee;margin:20px 0;"/>

    <h3 style="margin-bottom:12px;color:#555;">ETA Details</h3>
    ${avgWaitMinutes ? `<p style="margin:8px 0;">⏳ Avg Wait Time: <b>${avgWaitMinutes} mins</b></p>` : ''}
    ${travelTime ? `<p style="margin:8px 0;">🚗 Travel Time: <b>${travelTime} mins</b></p>` : ''}
    ${distanceKm ? `<p style="margin:8px 0;">📏 Distance: <b>${distanceKm} km</b></p>` : ''}
    
    <div style="background:#f4f4f4;padding:12px;border-radius:8px;margin:12px 0;">
      ${totalMinutes ? `<p style="margin:0;font-size:16px;">⏱️ Total ETA: <b>${totalMinutes} mins</b></p>` : ''}
      ${arrivalTime ? `<p style="margin:8px 0 0 0;font-size:16px;">🏁 Target Arrival: <b>${new Date(arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></p>` : ''}
    </div>

    ${serviceEta ? `<p style="margin-top:20px;color:#666;">🔔 Expected Service: <b>${new Date(serviceEta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></p>` : ''}

    <div style="margin-top:18px">

      ${googleDirections ? `
      <a href="${googleDirections}"
         style="background:#000;color:#fff;padding:12px 18px;
         border-radius:8px;text-decoration:none;margin-right:8px;display:inline-block;">
         Get Directions
      </a>` : ''}

      ${googleView ? `
      <a href="${googleView}"
         style="background:#eee;color:#000;padding:12px 18px;
         border-radius:8px;text-decoration:none;display:inline-block;">
         View on Map
      </a>` : ''}

    </div>

  </div>
`);
};

const travelInstruction = (name, tokenNumber, officeName, address, lat, lng, travelStart, arrival, serviceEta) => layout(`
  <h2 style="color: #1a73e8;">Time to Leave!</h2>
  <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
  <p>It is time to start traveling to <strong>${escapeHtml(officeName)}</strong> for your appointment.</p>
  <div style="background-color: #e8f0fe; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Token:</strong> #${escapeHtml(tokenNumber)}</p>
    <p><strong>Est. Travel Time:</strong> ${Math.round((new Date(arrival) - new Date(travelStart)) / 60000)} mins</p>
    <p><strong>Target Arrival:</strong> ${new Date(arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
    ${serviceEta ? `<p><strong>Expected Turn:</strong> ${new Date(serviceEta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>` : ''}
  </div>
  <p><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" style="display: inline-block; background-color: #1a73e8; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 5px;">Get Directions</a></p>
`);

const tokenCompleted = (name, tokenNumber, officeName) => layout(`
  <h2 style="color: #137333;">Service Completed</h2>
  <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
  <p>Your service at <strong>${escapeHtml(officeName)}</strong> (Token #${escapeHtml(tokenNumber)}) has been completed.</p>
  <p>Thank you for using GetEzi.</p>
`);

const tokenCancelled = (name, tokenNumber, officeName, reason) => layout(`
  <h2 style="color: #d93025;">Token Cancelled</h2>
  <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
  <p>Your token #${escapeHtml(tokenNumber)} at <strong>${escapeHtml(officeName)}</strong> has been cancelled.</p>
  ${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ''}
`);

const tokenNoShow = (name, tokenNumber, officeName) => layout(`
  <h2 style="color: #e37400;">Missed Appointment</h2>
  <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
  <p>We missed you for token #${escapeHtml(tokenNumber)} at <strong>${escapeHtml(officeName)}</strong>. Your token has been marked as a no-show.</p>
  <p>Please book a new token if you still require service.</p>
`);

const welcomeCustomer = (name) => layout(`
  <h2>Welcome to GetEzi!</h2>
  <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
  <p>Thank you for creating a customer account. You can now book tokens and manage your appointments with ease.</p>
`);

const welcomeAdmin = (name) => layout(`
  <h2>Welcome to GetEzi Partner!</h2>
  <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
  <p>Thank you for registering your office. You can now manage your queue and serve customers efficiently.</p>
`);

const otp = (code) => layout(`
  <h2 style="color: #333;">Verification Code</h2>
  <p>Your OTP code is:</p>
  <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
    ${escapeHtml(code)}
  </div>
  <p>This code is valid for 5 minutes. Do not share it with anyone.</p>
`);

const resetPassword = (url) => layout(`
  <h2 style="color: #333;">Reset Password</h2>
  <p>You requested a password reset. Click the link below to reset your password:</p>
  <p style="text-align: center; margin: 20px 0;">
    <a href="${url}" style="display: inline-block; background-color: #1a73e8; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 5px; font-weight: bold;">Reset Password</a>
  </p>
  <p>If you didn't request this, please ignore this email.</p>
`);

module.exports = {
  bookingConfirmation,
  travelInstruction,
  tokenCompleted,
  tokenCancelled,
  tokenNoShow,
  welcomeCustomer,
  welcomeAdmin,
  otp,
  resetPassword
};
