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

## Stage 3: Long/Lat Lookup (`03-long-lat.js`)
- Reads all building abbreviations and names from `./resources/building_abbreviations.csv`.
- Uses the `@googlemaps/places` SDK and the Google API key from `.env` to look up the latitude and longitude for each building name (querying as "NAME, Yale University, New Haven, CT").
- Memoizes results in the `abbrev_to_longlat` map.
- If any building cannot be geocoded, prints an error and exits.
- Reads `../data/worksheet_locations_filtered.csv`.
- For each worksheet, replaces each building code with its `(lat,lng)` pair (in parentheses, comma-separated).
- Writes the result to `../data/worksheet_longlat.csv`.
- Output format: `"worksheetId","location"` where location is e.g. `"(41.3123,-72.9254),(41.3134,-72.9265),..."`.
