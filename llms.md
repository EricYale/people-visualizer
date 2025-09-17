# People Visualizer: Notes for LLMs

I am making a project to visualize student movement around a college campjus throughout the day.

My website will have a Mapbox map using MapboxGL library. Points will be drawn over the map using a HTML5 canvas.

## Data Pipeline
The data source I am using is course registration worksheet data. This is detailed in `data-pipeline/llms.md`. But for development of the frontend, all you need to know is that there is a JSON file called `../data/worksheets_final.json` with the following structure:
    1. The outermost array will represent a list of all registration worksheets, i.e. people.
    2. The 1st nested array will represent a single worksheet, with a list of places.
    3. The 2nd nested array will represent a place, with the first element being the longitude and the second element being the latitude.
We assume that 