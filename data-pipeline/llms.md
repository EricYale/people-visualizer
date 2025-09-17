# Data Pipeline Technical Description

## Stage 1: Course Locations (`01-course-locations.js`)
- Reads `../data/ct_worksheets.csv` which contains worksheet IDs and comma-separated CRNs.
- Gathers all unique CRNs from the input file.
- Makes a single GraphQL request to the Coursetable API to fetch building codes for all CRNs for season_code "202503".
- Maps each CRN to its building code (using the first non-null building_code from course meetings).
- For each worksheet, outputs a line to `../data/worksheet_locations.csv` with the worksheetId and a comma-separated list of building codes (locations) for its CRNs.
- Skips CRNs with no building code.
- Output format: `"worksheetId","location"` (e.g., `1,"HLH17,LC,AKW,AKW,WTS"`).

## Stage 2: Filter (`02-filter.js`)
- Reads `../data/worksheet_locations.csv`.
- For each line (excluding header), splits the locations by comma.
- Only includes lines where the number of locations is between 3 and 7 (inclusive).
- Writes the filtered lines to `../data/worksheet_locations_filtered.csv`.
- Output format is unchanged from stage 1.

## Stage 3: Place Long/Lat Lookup (`03-long-lat.js`)
- Reads all building abbreviations and names from `./resources/building_abbreviations.csv`.
- Uses the `@googlemaps/places` SDK and the Google API key from `.env` to look up the latitude and longitude for each building name (querying as "NAME, Yale University, New Haven, CT").
- Writes a CSV to `../data/place-long-lat.csv` with columns: `abbrev,lat,lng`.
- If any building cannot be geocoded, prints an error and exits.

## Stage 4: Worksheet Location Expansion + JSON Conversion (`04-final-transform.js`)
- Using `../data/place-long-lat.csv`, look up the long/lat coordinates for each of the stops on each worksheet in `../data/worksheet_locations_filtered.csv`.
- Convert the CSV file into a JSON file called `../data/worksheets_final.json` with the following structure:
    1. The outermost array will represent a list of all worksheets.
    2. The 1st nested array will represent a single worksheet, with a list of places.
    3. The 2nd nested array will represent a place, with the first element being the longitude and the second element being the latitude.
