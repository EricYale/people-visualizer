# People Visualizer: Notes for LLMs

I am making a project to visualize student movement around a college campjus throughout the day.

My website will have a Mapbox map using MapboxGL library. Points will be drawn over the map using a HTML5 canvas.

## Data Pipeline
The data source I am using is course registration worksheet data. This is detailed in `data-pipeline/llms.md`. But for development of the frontend, all you need to know is that there is a file called `data.js` that sets `window.WORKSHEETS_DATA` to the following JSON structure:
    1. The outermost array represents a list of all worksheets.
    2. Each worksheet is an array of stops (places).
    3. Each stop is an object:
        - `l`: building code (not used by the web app)
        - `t`: start time (24-hour string, like `15:30`)
        - `d`: bitwise join of days of week (integer, 1=Sunday, 2=Monday, 4=Tuesday, ..., 64=Saturday)
        - `coords`: `[longitude, latitude]`

## Navigation
Dots on the visualization should move according to the following rules:
- During class, a dot should navigate to its classroom. Assume a class lasts until the next one starts, unless it's the last one of the day.
- Before their first class and after their last class each day, a dot should navigate to the one of the `RESIDENTIAL_COLLEGES` specified in `constants.js`. This is to simulate them sleeping/eating.
- To enable human-like movement, dots use roads. To achieve this, when they leave a classroom/residential college, they will linearly interpolate to the nearest intersection. Then, they will continuously navigate to intersections on the path, until they get to the closest intersection to their destination classroom/residential college. Then they will linearly interpolate to the building.
    - Pathfinding will be done with `javascript-astar` library, which can be retrieved with this CDN url: `https://cdnjs.cloudflare.com/ajax/libs/javascript-astar/0.4.1/astar.min.js`
    - Intersections will be obtained using the OpenStreetMap API. Use `osm-api-js` library
        - Assume this library is called from a secure environment. Use "basicAuth" to login to OSM API.
