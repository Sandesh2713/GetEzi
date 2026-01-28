
// Test Script for ETA Logic
const toRad = x => x * Math.PI / 180;

// Replicating the logic to be implemented in server.js
const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371e3; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const calculateTravelETA = (distanceMeters, osrmSeconds = null) => {
    if (osrmSeconds !== null && osrmSeconds !== undefined) {
        const mins = Math.ceil(osrmSeconds / 60);
        return Math.max(1, Math.min(mins, 180));
    }

    // Fallback: 60km/h => 1km = 1 min => 1000m = 1 min
    const km = distanceMeters / 1000;
    const mins = Math.ceil(km);
    return Math.max(1, Math.min(mins, 180));
};

// Test Cases
const runTest = (name, actual, expected) => {
    const pass = actual === expected;
    console.log(`${pass ? '✔' : '✖'} ${name}: Got ${actual}, Expected ${expected}`);
};

console.log('--- Testing ETA Logic ---');

// 1. Distance Based (Fallback)
runTest('500m (0.5km)', calculateTravelETA(500), 1);
runTest('1000m (1km)', calculateTravelETA(1000), 1);
runTest('1200m (1.2km)', calculateTravelETA(1200), 2);
runTest('5000m (5km)', calculateTravelETA(5000), 5);
runTest('12000m (12km)', calculateTravelETA(12000), 12);

// 2. OSRM Based
runTest('OSRM 30s', calculateTravelETA(0, 30), 1);
runTest('OSRM 60s', calculateTravelETA(0, 60), 1);
runTest('OSRM 1800s (30m)', calculateTravelETA(0, 1800), 30);
runTest('OSRM 3600s (60m)', calculateTravelETA(0, 3600), 60);

// 3. Validation Bounds
runTest('Zero Distance', calculateTravelETA(0), 1); // Min 1
runTest('Huge Distance (200km)', calculateTravelETA(200000), 180); // Max 180 (Wait, 200km at 60km/h is 200 mins -> Cap 180)

console.log('--- End Tests ---');
