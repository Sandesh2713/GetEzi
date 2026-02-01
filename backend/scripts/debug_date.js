const appointmentDate = '2026-02-02'; // Tomorrow
const serverDate = new Date().toISOString().split('T')[0];
const isFuture = appointmentDate > serverDate;

console.log(`Appointment: ${appointmentDate}`);
console.log(`Server Date (UTC): ${serverDate}`);
console.log(`Is Future? ${isFuture}`);

// Check Migration Logic emulation
const now = new Date(); // Local system time
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const today = `${year}-${month}-${day}`;

console.log(`Migration Today Limit: ${today}`);
console.log(`Would migrate? ${appointmentDate <= today}`);
