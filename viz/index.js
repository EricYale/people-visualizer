mapboxgl.accessToken = "pk.eyJ1IjoiZXJpY3lvb24iLCJhIjoiY21mbmY3dHYwMDVwMTJpcHpqYm1tMTY0ZiJ9.XKi84DFdNdO3LtPhbI-Aow";
const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/ericyoon/cmfnfi6hy001m01ry3icabmla",
    // style: "mapbox://styles/mapbox/standard",
    projection: "mercator",
    zoom: 15.5,
    center: [-72.9278636, 41.3105904],
    bearing: -60
});


map.on("style.load", () => {
    
});

function loadPoints(sampleSize) {
    
}