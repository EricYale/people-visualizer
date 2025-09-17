import fs from "fs";
import dotenv from "dotenv";

import { v1 as placesV1 } from '@googlemaps/places';
const { PlacesClient } = placesV1;

dotenv.config();

const client = new PlacesClient();

const abbrev_to_longlat = {};

async function fetchLongLatOfAbbrev() {
    const abbrevFile = "./resources/building_abbreviations.csv";
    const lines = fs.readFileSync(abbrevFile, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
        const [abbrev, name] = line.split(",").map(s => s.trim());
        if (!abbrev || !name) continue;
        try {
            const textQuery = `${name}, Yale University, New Haven, CT`;
            const response = await client.searchText({
                textQuery
            }, {
                otherArgs: {
                    headers: {
                        'X-Goog-FieldMask': 'places.displayName,places.id,places.location'
                    }
                }
            });
            const candidates = response[0].places;
            if (!candidates || candidates.length === 0 || !candidates[0].location) {
                console.error(`Could not find long/lat for building: ${abbrev} (${name})`);
                process.exit(1);
            }
            const loc = candidates[0].location;
            abbrev_to_longlat[abbrev] = [loc.latitude, loc.longitude];
            console.log(`Found long/lat for building: ${abbrev} (${name}) -> (${loc.latitude}, ${loc.longitude})`);
        } catch (err) {
            console.error(`Error fetching long/lat for building: ${abbrev} (${name})`);
            console.error(err);
            process.exit(1);
        }
    }
}

async function main() {
    await fetchLongLatOfAbbrev();

    const inputFile = "../data/worksheet_locations_filtered.csv";
    const outputFile = "../data/worksheet_longlat.csv";
    const input = fs.readFileSync(inputFile, "utf8").split("\n");
    const output = [];
    if (input.length > 0) output.push(input[0]); // header

    for (let i = 1; i < input.length; i++) {
        const line = input[i].trim();
        if (!line) continue;
        const match = line.match(/^"?(\d+)"?,?"?([^"]*)"?$/);
        if (!match) continue;
        const worksheetId = match[1];
        const abbrevs = match[2].split(",").map(s => s.trim()).filter(Boolean);
        const longlats = abbrevs.map(abbrev => {
            const coords = abbrev_to_longlat[abbrev];
            if (!coords) {
                console.error(`No long/lat found for building code: ${abbrev}`);
                process.exit(1);
            }
            return `(${coords[0]},${coords[1]})`;
        });
        output.push(`${worksheetId},"${longlats.join(",")}"`);
    }

    fs.writeFileSync(outputFile, output.join("\n"), "utf8");
}

main();