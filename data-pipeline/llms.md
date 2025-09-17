
# Data Pipeline Technical Description - Notes for LLMs

## Stage 0: CSV to JSON (`00-csv-to-json.js`)
- Reads `../data/ct_worksheets.csv` which contains worksheet IDs and comma-separated CRNs.
- Converts the data to JSON format:
    - Output: `../data/worksheets_raw.json`
    - Format: An array of worksheets, where each worksheet is an array containing a single array of CRN numbers (as integers):
        ```json
        [
            [ [17385,17896,18402,18968,20856] ],
            [ [17450,18853,18884,20977,23063] ],
            ...
        ]
        ```

## Stage 1: CourseTable Data (`01-coursetable.js`)
- Reads `../data/worksheets_raw.json` (output of Stage 0).
- Gathers all unique CRNs from all worksheets.
- Makes a single GraphQL request to the Coursetable API to fetch building codes, days of week, and start times for all CRNs for season_code "202503".
- Maps each CRN to an object with:
    - `l`: building code (string)
    - `t`: start time (24-hour string, e.g. "13:00")
    - `d`: bitwise join of days of week (integer, 1=Sunday, 2=Monday, 4=Tuesday, ..., 64=Saturday)
- For each worksheet, outputs a JSON array of these objects for its CRNs:
    - Output: `../data/worksheets_ct_data.json`
    - Format: An array of worksheets, where each worksheet is an array containing a single array of objects:
        ```json
        [
          [ [ {"l": "HLH17", "t": "13:00", "d": 6}, ... ] ],
          ...
        ]
        ```

## Stage 2: Filter (`02-filter.js`)
- Reads `../data/worksheets_ct_data.json`.
- For each worksheet, counts the total number of stops (objects).
- Only includes worksheets where the number of stops is between 3 and 7 (inclusive).
- Writes the filtered worksheets to `../data/worksheet_ct_filtered.json`.
- Output format is unchanged from stage 1 (JSON array of arrays of objects with `l`, `t`, `d`).

## Stage 3: Place Long/Lat Lookup (`03-long-lat.js`)
- Reads all building abbreviations and names from `../data/building_abbreviations.csv` and `../data/building_abbreviations_manual.csv`.
- Uses the `@googlemaps/places` SDK and the Google API key from `.env` to look up the longitude and latitude for each building name (querying as "NAME, Yale University, New Haven, CT").
- Writes a JSON file to `../data/place_long_lat.json` with the format:
    - `{ "ABBREV": [longitude, latitude], ... }`
- If any building cannot be geocoded, logs an error and sets its value to `null`.

## Stage 4: Worksheet Location Expansion + Final JSON (`04-final-transform.js`)
- Reads `../data/place_long_lat.json` and `../data/worksheet_ct_filtered.json`.
- For each worksheet, looks up the longitude/latitude coordinates for each building code (`l` field).
- If any location is missing, skips the worksheet.
- Outputs a JSON file `../data/worksheets_final.json` with the following structure:
    1. The outermost array represents a list of all worksheets.
    2. Each worksheet is an array of stops (places).
    3. Each stop is an object:
        - `l`: building code
        - `t`: start time (24-hour string)
        - `d`: bitwise join of days of week
        - `coords`: `[longitude, latitude]`
