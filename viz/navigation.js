const cy = cytoscape();

function initializeGraph(intersections, roads) {
    const nodes = intersections.map(i => ({
        group: "nodes",
        data: { id: i.id.toString() },
        position: { x: i.lon, y: i.lat }
    }));
    const edges = [];
    for(const road of roads) {
        for(let i = 0; i < road.nodes.length - 1; i++) {
            edges.push({
                group: "edges",
                data: {
                    id: `${road.nodes[i]}-${road.nodes[i+1]}`,
                    source: road.nodes[i].toString(),
                    target: road.nodes[i+1].toString()
                }
            });
        }
    }
    cy.add(nodes);
    cy.add(edges);
}

function nearestIntersection(lng, lat, intersections) {
    let minDist = Infinity, nearest = null;
    intersections.forEach(n => {
        const d = haversine(lat, lng, n.lat, n.lon);
        if (d < minDist) {
            minDist = d;
            nearest = n;
        }
    });
    return nearest;
}

function findPath(fromId, toId) {
    const aStar = cy.elements().aStar({
        root: `#${fromId}`,
        goal: `#${toId}`,
    });
    if(!aStar.found) return [ fromId, toId ]
    return aStar.path.map(ele => ele.id());
}
