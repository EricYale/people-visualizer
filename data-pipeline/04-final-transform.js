import fs from "fs";

// Read place-long-lat.csv and build a mapping from abbrev to {lat, lng}
const placeFile = "../data/place_long_lat.csv";
const placeLines = fs.readFileSync(placeFile, "utf8").split("\n").filter(Boolean);
const placeMap = {};
for (let i = 1; i < placeLines.length; i++) { // skip header
    const [abbrev, lat, lng] = placeLines[i].split(",");
    if (abbrev && lat && lng) {
        placeMap[abbrev] = [Number(lng), Number(lat)]; // [longitude, latitude]
    }
}

const wsFile = "../data/worksheet_locations_filtered.csv";
const wsLines = fs.readFileSync(wsFile, "utf8").split("\n").filter(Boolean);

const worksheets = [];
for (let i = 1; i < wsLines.length; i++) { // skip header
    const line = wsLines[i].trim();
    if (!line) continue;
    const match = line.match(/^"?(\d+)"?,?"?([^"]*)"?$/);
    if (!match) continue;
    const locations = match[2].split(",").map(s => s.trim()).filter(Boolean);
    const stops = [];
    for (const loc of locations) {
        if (placeMap[loc]) {
            stops.push(placeMap[loc]);
        } else {
            // If any location is missing, skip this worksheet
            console.error(`Missing coordinates for building code: ${loc}`);
            stops.length = 0;
            break;
        }
    }
    if (stops.length > 0) {
        worksheets.push(stops);
    }
}

fs.writeFileSync("../data/worksheets_final.json", JSON.stringify(worksheets), "utf8");
