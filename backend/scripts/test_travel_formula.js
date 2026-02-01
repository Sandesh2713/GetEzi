
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
    return Math.max(1, mins);
};

// 1. Bangalore (12.9716, 77.5946) to Delhi (28.6139, 77.2090) ~ 1700km
const origin = { lat: 12.9716, lng: 77.5946 };
const dest = { lat: 28.6139, lng: 77.2090 };

const dist = haversineDistance(origin.lat, origin.lng, dest.lat, dest.lng);
console.log(`Distance: ${dist} meters (${dist / 1000} km)`);

const eta = calculateTravelETA(dist);
console.log(`Calculated Travel ETA: ${eta} minutes (${(eta / 60).toFixed(1)} hours)`);

// 2. Test 1500km exact
const dist1500 = 1500 * 1000;
const eta1500 = calculateTravelETA(dist1500);
console.log(`1500km ETA: ${eta1500} minutes`);
