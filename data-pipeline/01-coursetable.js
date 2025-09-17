
import fs from "fs";

const inputFile = "../data/worksheets_raw.json";
const outputFile = "../data/worksheets_ct_data.json";

async function transformData() {
    const input = JSON.parse(fs.readFileSync(inputFile, "utf8"));
    // input: [ [ [crn, crn, ...] ], ... ]
    // output: [ [ [ {l, t, d}, ... ] ], ... ]
    const allCrns = new Set();
    for (const worksheet of input) {
        for (const crnArr of worksheet) {
            for (const crn of crnArr) {
                allCrns.add(String(crn));
            }
        }
    }
    const crnToData = await getLocationsForCrns(Array.from(allCrns));
    const output = [];
    for (const worksheet of input) {
        const worksheetData = [];
        for (const crnArr of worksheet) {
            const dataArr = crnArr.map(crn => crnToData[String(crn)]).filter(obj => obj != null);
            worksheetData.push(dataArr);
        }
        output.push(worksheetData);
    }
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), "utf8");
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
                    days_of_week
                    start_time
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
        const crnToData = {};
        for (const listing of listings) {
            const crn = String(listing.crn);
            const meetings = listing?.course?.course_meetings || [];
            // Use the first non-null meeting with all fields
            let obj = null;
            for (const meeting of meetings) {
                if (meeting?.location?.building_code && meeting?.start_time && meeting?.days_of_week != null) {
                    obj = {
                        l: meeting.location.building_code,
                        t: meeting.start_time,
                        d: meeting.days_of_week
                    };
                    break;
                }
            }
            if (obj) {
                crnToData[crn] = obj;
            }
        }
        return crnToData;
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
