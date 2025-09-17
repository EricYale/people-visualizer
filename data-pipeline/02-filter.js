import fs from "fs";

const inputFile = "../data/worksheet_locations.csv";
const outputFile = "../data/worksheet_locations_filtered.csv";

function filterRows() {
    const input = fs.readFileSync(inputFile, "utf8").split("\n");
    const output = [];
    if (input.length > 0) output.push(input[0]); // header

    for (let i = 1; i < input.length; i++) {
        const line = input[i].trim();
        if (!line) continue;
        const match = line.match(/^"?(\d+)"?,?"?([^"]*)"?$/);
        if (!match) continue;
        const locations = match[2].split(",").map(s => s.trim()).filter(Boolean);
        if (locations.length >= 3 && locations.length <= 7) {
            output.push(line);
        }
    }

    fs.writeFileSync(outputFile, output.join("\n"), "utf8");
}

filterRows();
