import fs from "fs";
import dotenv from "dotenv";
import { v1 as placesV1 } from '@googlemaps/places';
const { PlacesClient } = placesV1;
dotenv.config();

const client = new PlacesClient();

async function main() {
    const abbrevFiles = [
        "../data/building_abbreviations.csv",
        "../data/building_abbreviations_manual.csv"
    ];
    const outputFile = "../data/place_long_lat.csv";
    const output = ["abbrev,lat,lng"];
    for (const abbrevFile of abbrevFiles) {
        if (!fs.existsSync(abbrevFile)) continue;
        const lines = fs.readFileSync(abbrevFile, "utf8").split("\n").filter(Boolean);
        for (const line of lines) {
            const [abbrev, name] = line.split(",").map(s => s.trim());
            if (!abbrev || !name) continue;
            try {
                const textQuery = `${name}, Yale University, New Haven, CT`;
                const response = await client.searchText({
                    textQuery,
                }, {
                    otherArgs: {
                        headers: {
                            "X-Goog-FieldMask": "places.location",
                        }
                    }
                });
                const candidates = response[0].places;
                if (!candidates || candidates.length === 0 || !candidates[0].location) {
                    console.error(`Could not find long/lat for building: ${abbrev} (${name})`);
                    output.push(`${abbrev},,`);
                    continue;
                }
                const loc = candidates[0].location;
                output.push(`${abbrev},${loc.latitude},${loc.longitude}`);
                console.log(`Fetched long/lat for building: ${abbrev} (${name})`);
            } catch (err) {
                console.error(`Error fetching long/lat for building: ${abbrev} (${name})`);
                output.push(`${abbrev},,`);
            }
        }
    }
    fs.writeFileSync(outputFile, output.join("\n"), "utf8");
}

main();