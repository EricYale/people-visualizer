let timer = {
    day: 0,
    hour: 0,
    minute: 0
};

let timerInterval = null;

let map = null;
let dots = [];


// OSM navigation data
let intersections = [];
let roads = [];
let navGraph = null; // { nodes: {id: {id,lat,lon,edges:[{to,cost}]}}, idToIdx: {}, idxToId: [] }

// Build navigation graph from OSM intersections and roads
function buildNavGraph(intersections, roads) {
    const nodes = {};
    const idToIdx = {};
    const idxToId = [];
    intersections.forEach((n, i) => {
        nodes[n.id] = { id: n.id, lat: n.lat, lon: n.lon, edges: [] };
        idToIdx[n.id] = i;
        idxToId.push(n.id);
    });
    // For each road, add edges between consecutive nodes if both are intersections
    roads.forEach(way => {
        for (let i = 0; i < way.nodes.length - 1; ++i) {
            const a = way.nodes[i], b = way.nodes[i+1];
            if (nodes[a] && nodes[b]) {
                const dist = haversine(nodes[a].lat, nodes[a].lon, nodes[b].lat, nodes[b].lon);
                nodes[a].edges.push({ to: b, cost: dist });
                nodes[b].edges.push({ to: a, cost: dist });
            }
        }
    });
    return { nodes, idToIdx, idxToId };
}

// Haversine distance in meters
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Find nearest intersection to (lng,lat)
function nearestIntersection(lng, lat) {
    let minDist = Infinity, nearest = null;
    intersections.forEach(n => {
        const d = haversine(lat, lng, n.lat, n.lon);
        if (d < minDist) {
            minDist = d;
            nearest = n;
        }
    });
    return nearest;
}

// Find path (array of intersection ids) using astar
function findPath(fromId, toId) {
    if (!navGraph) return [];
    const graph = new Graph(Object.values(navGraph.nodes).map(n => n.edges.map(e => e.cost === 0 ? 1 : e.cost)));
    const startIdx = navGraph.idToIdx[fromId];
    const endIdx = navGraph.idToIdx[toId];
    if (startIdx == null || endIdx == null) return [];
    console.log(graph.grid.length, startIdx, endIdx);
    const pathIdxs = astar.search(graph, graph.grid[startIdx], graph.grid[endIdx]);
    // Convert pathIdxs to intersection ids
    return [fromId, ...pathIdxs.map(n => navGraph.idxToId[n.y])];
}

// Fetch OSM intersections and roads for navigation using Overpass API via fetch
async function fetchOSMData(center, blockRadius = 0.005) {
    // center: [lng, lat], blockRadius: ~5 city blocks in degrees
    const [lng, lat] = center;
    const minLat = lat - blockRadius;
    const maxLat = lat + blockRadius;
    const minLng = lng - blockRadius;
    const maxLng = lng + blockRadius;
    // Overpass QL for intersections and roads
    const query = `
        [out:json][timeout:25];
        (
            node["highway"="traffic_signals"](${minLat},${minLng},${maxLat},${maxLng});
            node["highway"="crossing"](${minLat},${minLng},${maxLat},${maxLng});
            node["highway"="turning_circle"](${minLat},${minLng},${maxLat},${maxLng});
            node["highway"="stop"](${minLat},${minLng},${maxLat},${maxLng});
            node["highway"="mini_roundabout"](${minLat},${minLng},${maxLat},${maxLng});
            way["highway"](${minLat},${minLng},${maxLat},${maxLng});
        );
        out body;
        >;
        out skel qt;`;
    const url = "https://overpass-api.de/api/interpreter";
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`
    });
    if (!response.ok) {
        throw new Error("Overpass API request failed: " + response.status);
    }
    const result = await response.json();
    // Parse intersections and roads
    const nodes = (result.elements || []).filter(e => e.type === "node");
    const ways = (result.elements || []).filter(e => e.type === "way");
    intersections = nodes.map(n => ({ id: n.id, lat: n.lat, lon: n.lon }));
    roads = ways.map(w => ({ id: w.id, nodes: w.nodes }));
    navGraph = buildNavGraph(intersections, roads);
    console.log("Loaded intersections:", intersections.length, "roads:", roads.length, "navGraph nodes:", Object.keys(navGraph.nodes).length);
}


// Helper: pick a random residential college from RESIDENTIAL_COLLEGES
function getRandomResidential() {
    if (!window.RESIDENTIAL_COLLEGES || !window.RESIDENTIAL_COLLEGES.length) return null;
    const idx = Math.floor(Math.random() * window.RESIDENTIAL_COLLEGES.length);
    return window.RESIDENTIAL_COLLEGES[idx];
}

// Helper: get current target (lng,lat) for a dot based on time
function getCurrentTarget(dot, currentMins) {
    // If no stops today, go to residential
    if (!dot.todaysStops.length) {
        if (!dot.residential) dot.residential = getRandomResidential();
        return dot.residential ? dot.residential.coords : null;
    }
    // Before first class
    if (currentMins < timeStrToMinutes(dot.todaysStops[0].t)) {
        if (!dot.residential) dot.residential = getRandomResidential();
        return dot.residential ? dot.residential.coords : null;
    }
    // After last class
    if (currentMins >= timeStrToMinutes(dot.todaysStops[dot.todaysStops.length-1].t)) {
        if (!dot.residential) dot.residential = getRandomResidential();
        return dot.residential ? dot.residential.coords : null;
    }
    // During class: find which stop
    for (let i = 0; i < dot.todaysStops.length; ++i) {
        if (currentMins < timeStrToMinutes(dot.todaysStops[i].t)) {
            // Previous stop is current class
            return dot.todaysStops[i-1].coords;
        }
    }
    // Fallback: last class
    return dot.todaysStops[dot.todaysStops.length-1].coords;
}

// Move dot along its path
function moveDot(dot) {
    if (!dot.nav.path || dot.nav.path.length === 0) return;
    // If on path between intersections
    if (dot.nav.state === 'on_path') {
        const fromId = dot.nav.path[dot.nav.pathIdx];
        const toId = dot.nav.path[dot.nav.pathIdx+1];
        const from = navGraph.nodes[fromId];
        const to = navGraph.nodes[toId];
        if (!from || !to) return;
        // Move dot towards 'to' at speed
        const dist = haversine(dot.lat, dot.lng, to.lat, to.lon);
        if (dist < dot.nav.speed) {
            // Arrived at next intersection
            dot.lng = to.lon;
            dot.lat = to.lat;
            dot.nav.pathIdx++;
            if (dot.nav.pathIdx >= dot.nav.path.length-1) {
                dot.nav.state = 'to_dest';
            }
        } else {
            // Interpolate
            const frac = dot.nav.speed / dist;
            dot.lng += (to.lon - dot.lng) * frac;
            dot.lat += (to.lat - dot.lat) * frac;
        }
    } else if (dot.nav.state === 'to_intersection') {
        // Move from current position to nearest intersection
        const to = navGraph.nodes[dot.nav.path[0]];
        const dist = haversine(dot.lat, dot.lng, to.lat, to.lon);
        if (dist < dot.nav.speed) {
            dot.lng = to.lon;
            dot.lat = to.lat;
            dot.nav.state = 'on_path';
            dot.nav.pathIdx = 0;
        } else {
            const frac = dot.nav.speed / dist;
            dot.lng += (to.lon - dot.lng) * frac;
            dot.lat += (to.lat - dot.lat) * frac;
        }
    } else if (dot.nav.state === 'to_dest') {
        // Move from last intersection to destination
        const to = dot.nav.to;
        const dist = haversine(dot.lat, dot.lng, to[1], to[0]);
        if (dist < dot.nav.speed) {
            dot.lng = to[0];
            dot.lat = to[1];
            dot.nav.state = 'idle';
        } else {
            const frac = dot.nav.speed / dist;
            dot.lng += (to[0] - dot.lng) * frac;
            dot.lat += (to[1] - dot.lat) * frac;
        }
    }
}

function update() {
    const currentMins = timer.hour * 60 + timer.minute;
    dots.forEach(dot => {
        // Find today's stops, sorted by time
        if (!dot.todaysStops || dot.todaysDay !== timer.day) {
            dot.todaysStops = (dot.worksheet.filter(stop => stopIsToday(stop, timer.day))
                .sort((a, b) => timeStrToMinutes(a.t) - timeStrToMinutes(b.t)));
            dot.todaysDay = timer.day;
            dot.residential = null; // reset residential on new day
        }
        // Determine target
        const target = getCurrentTarget(dot, currentMins);
        if (!target) {
            dot.lng = null;
            dot.lat = null;
            dot.nav.state = 'idle';
            return;
        }
        // If dot is not placed, place at target
        if (dot.lng == null || dot.lat == null) {
            dot.lng = target[0];
            dot.lat = target[1];
            dot.nav.state = 'idle';
            return;
        }
        // If already at target, do nothing
        if (Math.abs(dot.lng - target[0]) < 1e-6 && Math.abs(dot.lat - target[1]) < 1e-6) {
            dot.nav.state = 'idle';
            return;
        }
        // If idle or target changed, plan new path
        if (dot.nav.state === 'idle' || !dot.nav.to || dot.nav.to[0] !== target[0] || dot.nav.to[1] !== target[1]) {
            // Plan path: current pos -> nearest intersection -> path -> nearest intersection to target -> target
            const startInt = nearestIntersection(dot.lng, dot.lat);
            const endInt = nearestIntersection(target[0], target[1]);
            if (!startInt || !endInt) {
                // fallback: jump to target
                dot.lng = target[0];
                dot.lat = target[1];
                dot.nav.state = 'idle';
                return;
            }
            const path = findPath(startInt.id, endInt.id);
            dot.nav = {
                state: 'to_intersection',
                path: path,
                pathIdx: 0,
                from: [dot.lng, dot.lat],
                to: target,
                speed: 0.00015 // ~15m per tick (tune as needed)
            };
        }
        // Move along path
        moveDot(dot);
    });
}

function pad2(n) { return n < 10 ? "0" + n : n; }

function updateTimeOverlay() {
    const overlay = document.getElementById("time-overlay");
    const day = DAYS[timer.day];
    const time = pad2(timer.hour) + ":" + pad2(timer.minute);
    overlay.textContent = `${day} ${time}`;
}

function advanceTimer() {
    timer.minute += 5;
    if (timer.minute >= 60) {
        timer.minute = 0;
        timer.hour++;
    }
    if (timer.hour >= 24) {
        timer.hour = 0;
        timer.day++;
    }
    if (timer.day >= 7) {
        timer.day = 0;
    }
    updateTimeOverlay();
    update();
    render();
}

function startSimulationTimer() {
    updateTimeOverlay();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(advanceTimer, 27);
}

async function initializeMap() {
    mapboxgl.accessToken = "pk.eyJ1IjoiZXJpY3lvb24iLCJhIjoiY21mbmY3dHYwMDVwMTJpcHpqYm1tMTY0ZiJ9.XKi84DFdNdO3LtPhbI-Aow";
    map = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/ericyoon/cmfnfi6hy001m01ry3icabmla",
        projection: "mercator",
        zoom: 15.5,
        center: [-72.9278636, 41.3105904],
        bearing: -60
    });
    map.on("style.load", async () => {
        // Fetch OSM intersections/roads for navigation
        await fetchOSMData(map.getCenter().toArray());
        setTimeout(() => {
            initializeDots();
            render();
            startSimulationTimer();
        }, 300);
    });
}

function initializeDots() {
    const data = window.WORKSHEETS_DATA;
    if (!data || !Array.isArray(data)) return;
    const sample = [];
    const used = new Set();
    while (sample.length < 500 && used.size < data.length) {
        const idx = Math.floor(Math.random() * data.length);
        if (!used.has(idx)) {
            used.add(idx);
            sample.push(data[idx]);
        }
    }
    dots = sample.map(ws => ({
        worksheet: ws,
        lng: null,
        lat: null,
        todaysStops: [],
        todaysDay: -1,
        nav: {
            state: 'idle', // 'idle', 'to_intersection', 'on_path', 'to_dest'
            path: [], // array of intersection ids
            pathIdx: 0, // current index in path
            from: null, // {lng,lat}
            to: null,   // {lng,lat}
            speed: 1.5 // meters per tick (adjust as needed)
        }
    }));
    update();
}

function render() {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const mapDiv = document.getElementById("map");
    canvas.width = mapDiv.offsetWidth;
    canvas.height = mapDiv.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#FF0000";
    dots.forEach(dot => {
        if (dot.lng == null || dot.lat == null) return;
        const pixel = map.project([dot.lng, dot.lat]);
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, 5, 0, 2 * Math.PI);
        ctx.fill();
    });
}

initializeMap();