import fs from "fs";

const inputFile = "../data/ct_worksheets.csv";
const outputFile = "../data/worksheets_raw.json";

function csvToJson() {
    const input = fs.readFileSync(inputFile, "utf8").split("\n");
    const output = [];
    for (let i = 1; i < input.length; i++) { // skip header
        const line = input[i]?.trim();
        if (!line) continue;
        const match = line.match(/^"?(\d+)"?,?"?([^"]*)"?$/);
        if (!match) continue;
        const crns = match[2].split(",").map(s => parseInt(s.trim(), 10)).filter(Number.isFinite);
        output.push([crns]);
    }
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), "utf8");
}

csvToJson();
