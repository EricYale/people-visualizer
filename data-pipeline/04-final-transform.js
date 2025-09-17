import fs from "fs";

// Read place-long-lat.json and build a mapping from abbrev to [lng, lat]
const placeFile = "../data/place_long_lat.json";
const placeMap = JSON.parse(fs.readFileSync(placeFile, "utf8"));

const wsFile = "../data/worksheet_ct_filtered.json";
const worksheetsInput = JSON.parse(fs.readFileSync(wsFile, "utf8"));

const worksheets = [];
for (const worksheet of worksheetsInput) {
    const stops = [];
    let missing = false;
    for (const arr of worksheet) {
        for (const obj of arr) {
            // obj: { l, t, d }
            if (placeMap[obj.l]) {
                stops.push({
                    l: obj.l,
                    t: obj.t,
                    d: obj.d,
                    coords: placeMap[obj.l]
                });
            } else {
                // If any location is missing, skip this worksheet
                console.error(`Missing coordinates for building code: ${obj.l}`);
                missing = true;
                break;
            }
        }
        if (missing) break;
    }
    if (!missing && stops.length > 0) {
        worksheets.push(stops);
    }
}

fs.writeFileSync("../data/worksheets_final.json", JSON.stringify(worksheets, null, 2), "utf8");
