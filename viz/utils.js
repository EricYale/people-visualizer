function timeStrToMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

function stopIsToday(stop, day) {
    const dayBit = 1 << ((day + 1) % 7);
    return (stop.d & dayBit) !== 0;
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Helper: pick a random residential college from RESIDENTIAL_COLLEGES
function getRandomResidential() {
    if (!RESIDENTIAL_COLLEGES || !RESIDENTIAL_COLLEGES.length) return null;
    const idx = Math.floor(Math.random() * RESIDENTIAL_COLLEGES.length);
    return RESIDENTIAL_COLLEGES[idx];
}

function pad2(n) { return n < 10 ? "0" + n : n; }

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
