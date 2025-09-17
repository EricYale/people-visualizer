import fs from "fs";

const inputFile = "../data/ct_worksheets.csv";
const outputFile = "../data/worksheet_locations.csv";

async function transformData() {
    const input = fs.readFileSync(inputFile, "utf8").split("\n");
    const output = [];
    output.push('"worksheetId","location"');

    // 1. Gather all unique CRNs
    const crnSet = new Set();
    for (let i = 1; i < input.length; i++) { // skip header
        const line = input[i]?.trim();
        if (!line) continue;
        const match = line.match(/^"?(\d+)"?,?"?([^"]*)"?$/);
        if (!match) continue;
        const crns = match[2].split(",").map(s => s.trim()).filter(Boolean);
        crns.forEach(crn => crnSet.add(crn));
    }
    const allCrns = Array.from(crnSet);

    // 2. Make a single GraphQL query for all CRNs
    const crnToLocation = await getLocationsForCrns(allCrns);

    // 3. Generate output using the lookup map
    for (let i = 1; i < input.length; i++) { // skip header
        const line = input[i]?.trim();
        if (!line) continue;
        const match = line.match(/^"?(\d+)"?,?"?([^"]*)"?$/);
        if (!match) continue;
        const worksheetId = match[1];
        const crns = match[2].split(",").map(s => s.trim()).filter(Boolean);
        const locations = crns
            .map(crn => crnToLocation[crn])
            .filter(loc => loc != null);
        if (locations.length === 0) continue;
        output.push(`${worksheetId},"${locations.join(",")}"`);
    }

    fs.writeFileSync(outputFile, output.join("\n"), "utf8");
}

async function getLocationsForCrns(crns) {
    if (crns.length === 0) return {};
    const query = `
    query ($crns: [Int!]) {
        listings(
            where: { 
                _and: [
                    { crn: { _in: $crns } }, 
                    { season_code: { _eq: "202503" } }
                ]
            }
        ) {
            crn
            course {
                course_meetings {
                    location {
                        building_code
                    }
                }
            }
        }
    }
    `;
    try {
        const res = await fetch("https://api.coursetable.com/ferry/v1/graphql", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables: { crns: crns.map(c => parseInt(c, 10)) },
            }),
        });
        const data = await res.json();
        const listings = data?.data?.listings || [];
        const crnToLocation = {};
        for (const listing of listings) {
            const crn = String(listing.crn);
            const meetings = listing?.course?.course_meetings || [];
            // Use the first non-null building_code
            let code = null;
            for (const meeting of meetings) {
                if (meeting?.location?.building_code) {
                    code = meeting.location.building_code;
                    break;
                }
            }
            if (code) {
                crnToLocation[crn] = code;
            }
        }
        return crnToLocation;
    } catch (e) {
        return {};
    }
}

// Update to call the async transformData
(async () => { await transformData(); })();

/*
Example GraphQL query:
{
  listings(
    where: { 
      _and: [
        { crn: { _eq: $crn } }, 
        { season_code: { _eq: "202503" } }
      ]
    }
  ) {
    crn
    course_id
    season_code
    course {
      title
      course_meetings {
        days_of_week
        start_time
        location {
          building_code
        }
      }
    }
  }
}


Example fetch request:
const data = await fetch("https://api.coursetable.com/ferry/v1/graphql", {
    method: "POST",
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        query: query,
        variables: {crn},
    }),
});

/*
Input file format:

"worksheetId","combined_crns"
1,"17385,17896,18402,18968,20856"
2,"17450,18853,18884,20977,23063"
3,"20762,22307,22986,23229,23362"
4,"26879,26978,27241,27406,28082,28788,28791"
5,"21230,21814,23074,23219,24629,24833,25138"
6,"27500,30756,30765,30777"
7,"11243"
8,"17372,18117,18250,19919,20451"
9,"10373"
10,"18299"
11,"17277,18257,18969,18974,19463,19948"
12,"28107,29515,29527,29532"
13,"10063,10136,10423,10433,10806,10808,10809,10810,10977,11008,11411,11423,11425,11430,11432,11913,12639,12651,12833,13319"
14,"26444"

Output file format:
"worksheetId","location"
1,"HLH17,LC,AKW,AKW,WTS"
2,"LC,HLH17,WTS,AKW,ML"
*/
