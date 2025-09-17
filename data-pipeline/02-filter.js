
import fs from "fs";

const inputFile = "../data/worksheets_ct_data.json";
const outputFile = "../data/worksheet_ct_filtered.json";


function filterRows() {
    const input = JSON.parse(fs.readFileSync(inputFile, "utf8"));
    const output = [];
    for (const worksheet of input) {
        let total = 0;
        for (const arr of worksheet) {
            total += arr.length;
        }
        if (total >= 5 && total <= 7) {
            output.push(worksheet);
        }
    }
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), "utf8");
}

filterRows();
