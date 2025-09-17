const MINUTES_TIME_SKIP = 2;
const TIMEOUT = 50;
const FUDGE_FACTOR = 0;
const NUM_DOTS = 50;
const STEP_SIZE = 0.0002;

let timer = {
    day: 0,
    hour: 8,
    minute: 0
};

let timerInterval = null;

let map = null;
let dots = [];

let osmIntersections = [];
let osmRoads = [];
const osmIntersectionsById = {};


// Fetch OSM intersections and roads for navigation using Overpass API via fetch
async function fetchOSMData(center, blockRadius = 0.005) {
    // Center the OSM query within ~5 city blocks of the map's center
    // const [lng, lat] = center;
    // const minLat = lat - blockRadius;
    // const maxLat = lat + blockRadius;
    // const minLng = lng - blockRadius;
    // const maxLng = lng + blockRadius;

    // const query = `
    //     [out:json][timeout:25];
    //     (
    //         node["highway"="traffic_signals"](${minLat},${minLng},${maxLat},${maxLng});
    //         node["highway"="crossing"](${minLat},${minLng},${maxLat},${maxLng});
    //         node["highway"="turning_circle"](${minLat},${minLng},${maxLat},${maxLng});
    //         node["highway"="stop"](${minLat},${minLng},${maxLat},${maxLng});
    //         node["highway"="mini_roundabout"](${minLat},${minLng},${maxLat},${maxLng});
    //         way["highway"](${minLat},${minLng},${maxLat},${maxLng});
    //     );
    //     out body;
    //     >;
    //     out skel qt;`;
    // const url = "https://overpass-api.de/api/interpreter";
    // const response = await fetch(url, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/x-www-form-urlencoded" },
    //     body: `data=${encodeURIComponent(query)}`
    // });
    // if (!response.ok) {
    //     throw new Error("Overpass API request failed: " + response.status);
    // }
    // const result = await response.json();
    
    result = OVERPASS_DATA;

    const nodes = (result.elements || []).filter(e => e.type === "node");
    const ways = (result.elements || []).filter(e => e.type === "way");
    osmIntersections = nodes.map(n => ({ id: n.id, lat: n.lat, lon: n.lon }));
    osmRoads = ways.map(w => ({ id: w.id, nodes: w.nodes }));
    initializeGraph(osmIntersections, osmRoads);
    for(const node of osmIntersections) osmIntersectionsById[node.id] = node;
}

function updateTimeOverlay() {
    const overlay = document.getElementById("time-overlay");
    const day = DAYS[timer.day];
    const time = pad2(timer.hour) + ":" + pad2(timer.minute);
    overlay.textContent = `${day} ${time}`;
}

function advanceTimer() {
    timer.minute += MINUTES_TIME_SKIP;
    if (timer.minute >= 60) {
        timer.minute = 0;
        timer.hour++;
    }
    if (timer.hour >= 19) {
        timer.hour = 8;
        timer.day++;
        atMidnight();
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
    atMidnight();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(advanceTimer, TIMEOUT);
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
    while (sample.length < NUM_DOTS && used.size < data.length) {
        const idx = Math.floor(Math.random() * data.length);
        if (!used.has(idx)) {
            used.add(idx);
            sample.push(data[idx]);
        }
    }
    dots = sample.map(ws => {
        const residential = getRandomResidential();
        return {
            worksheet: ws,
            lng: residential[0],
            lat: residential[1],
            classesForToday: [],
            hasGoneHome: false,
            path: [],
            residential,
            fudgeCoords: {
                lat: (Math.random() - 0.5) * FUDGE_FACTOR,
                lng: (Math.random() - 0.5) * FUDGE_FACTOR
            },
        }
    });
    update();
}

function atMidnight() {
    // Compute the classes each dot needs to go to for today
    for(const dot of dots) {
        dot.classesForToday = dot.worksheet.filter(stop => stopIsToday(stop, timer.day)).sort((a, b) => timeStrToMinutes(a.t) - timeStrToMinutes(b.t));
        dot.hasGoneHome = false;
    }
}

function update() {
    for(const dot of dots) {
        // Step 1. Check if the dot needs to go to the next class for today
        const nextClass = dot.classesForToday[0];
        if (!nextClass) {
            if(!dot.hasGoneHome) {
                navigateDotTo(dot, ...dot.residential);
                dot.hasGoneHome = true;
            }
        } else {
            const nextClassTime = timeStrToMinutes(nextClass.t);
            const currentTime = timer.hour * 60 + timer.minute;
            if(nextClassTime <= currentTime) {
                dot.classesForToday.shift();
                navigateDotTo(dot, ...nextClass.coords);
            }
        }

        // Step 2: move dot in direction of its path
        moveDot(dot);

        // Step 3: change point's fudge factor
        const newFudgeLat = (Math.random() - 0.5) * FUDGE_FACTOR;
        const newFudgeLng = (Math.random() - 0.5) * FUDGE_FACTOR;
        dot.fudgeCoords.lat = (dot.fudgeCoords.lat + newFudgeLat) / 2;
        dot.fudgeCoords.lng = (dot.fudgeCoords.lng + newFudgeLng) / 2;
    }
}

function navigateDotTo(dot, destLng, destLat) {
    const bestPath = findPath(nearestIntersection(dot.lng, dot.lat, osmIntersections).id, nearestIntersection(destLng, destLat, osmIntersections).id);
    const latLongPath = bestPath
        .filter(id => id in osmIntersectionsById)
        .map(id => ({
            lat: osmIntersectionsById[id].lat,
            lng: osmIntersectionsById[id].lon
        }));
    dot.path = latLongPath;
}

function moveDot(dot) {
    const nextNode = dot.path[0];
    if (!nextNode) return;

    const dx = nextNode.lng - dot.lng;
    const dy = nextNode.lat - dot.lat;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < STEP_SIZE) {
        dot.lng = nextNode.lng;
        dot.lat = nextNode.lat;
        dot.path.shift();
        return;
    }

    const angle = Math.atan2(dy, dx);
    dot.lng += Math.cos(angle) * STEP_SIZE;
    dot.lat += Math.sin(angle) * STEP_SIZE;
}

function render() {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const mapDiv = document.getElementById("map");
    canvas.width = mapDiv.offsetWidth;
    canvas.height = mapDiv.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#fcb103";
    dots.forEach(dot => {
        if (dot.lng == null || dot.lat == null) return;
        const pixel = map.project([dot.lng + dot.fudgeCoords.lng, dot.lat + dot.fudgeCoords.lat]);
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, 5, 0, 2 * Math.PI);
        ctx.fill();
    });
}

initializeMap();