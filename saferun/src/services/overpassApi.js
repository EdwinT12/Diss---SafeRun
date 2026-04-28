// Thin wrapper around the public Overpass API. Pulls every pedestrian-walkable
// way inside a bounding box and hands the nodes/ways to the graph builder.

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export async function fetchRoadNetwork(bounds) {
  const { minLat, maxLat, minLng, maxLng } = bounds;
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;

  // Query for pedestrian-accessible ways
  // Includes: footway, path, pedestrian, residential, living_street,
  //           tertiary, secondary, primary, cycleway, track, steps, service
  const query = `
    [out:json][timeout:30];
    (
      way["highway"~"^(footway|path|pedestrian|residential|living_street|tertiary|secondary|primary|cycleway|track|steps|service|unclassified)$"](${bbox});
    );
    out body;
    >;
    out skel qt;
  `;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass API error: ${res.status}`);
  }

  const data = await res.json();
  return parseOverpassResponse(data);
}

function parseOverpassResponse(data) {
  const nodes = new Map();
  const ways = [];

  for (const element of data.elements) {
    if (element.type === 'node') {
      nodes.set(element.id, {
        id: element.id,
        lat: element.lat,
        lng: element.lon,
      });
    } else if (element.type === 'way' && element.nodes && element.nodes.length >= 2) {
      ways.push({
        id: element.id,
        nodeIds: element.nodes,
        tags: element.tags || {},
      });
    }
  }

  return { nodes, ways };
}

export function extractWayProperties(tags) {
  return {
    highwayType: tags.highway || 'unknown',
    isLit: tags.lit === 'yes',
    surface: tags.surface || 'unknown',
    isOneWay: tags.oneway === 'yes',
    name: tags.name || null,
    footAccess: tags.foot !== 'no',
    isTunnel: tags.tunnel === 'yes',
    isBridge: tags.bridge === 'yes',
    width: parseFloat(tags.width) || null,
    maxspeed: parseInt(tags.maxspeed) || null,
  };
}

export function wayComfortScore(properties) {
  let score = 0.5;

  // Highway type preference for pedestrians
  const typeScores = {
    'footway': 0.9,
    'pedestrian': 0.95,
    'path': 0.75,
    'living_street': 0.85,
    'residential': 0.7,
    'cycleway': 0.65,
    'service': 0.6,
    'unclassified': 0.55,
    'tertiary': 0.45,
    'secondary': 0.35,
    'primary': 0.25,
    'track': 0.5,
    'steps': 0.4,
  };
  score = typeScores[properties.highwayType] || 0.5;

  // Lighting bonus
  if (properties.isLit) score = Math.min(1, score + 0.1);

  // Surface quality
  const goodSurfaces = ['paved', 'asphalt', 'concrete', 'paving_stones', 'sett'];
  const badSurfaces = ['unpaved', 'gravel', 'dirt', 'mud', 'sand'];
  if (goodSurfaces.includes(properties.surface)) score = Math.min(1, score + 0.05);
  if (badSurfaces.includes(properties.surface)) score = Math.max(0, score - 0.1);

  // Tunnel penalty (enclosed spaces, poor visibility)
  if (properties.isTunnel) score = Math.max(0, score - 0.2);

  // Narrow width penalty
  if (properties.width && properties.width < 1.5) score = Math.max(0, score - 0.1);

  // High-speed traffic penalty (relevant for roads without separated footpaths)
  if (properties.maxspeed && properties.maxspeed > 50) score = Math.max(0, score - 0.15);

  return Math.round(score * 100) / 100;
}

export function expandBounds(center, radiusKm) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

export function expandBoundsForTwoPoints(pointA, pointB, bufferKm = 1.0) {
  const minLat = Math.min(pointA.lat, pointB.lat);
  const maxLat = Math.max(pointA.lat, pointB.lat);
  const minLng = Math.min(pointA.lng, pointB.lng);
  const maxLng = Math.max(pointA.lng, pointB.lng);

  const midLat = (minLat + maxLat) / 2;
  const latDelta = bufferKm / 111;
  const lngDelta = bufferKm / (111 * Math.cos((midLat * Math.PI) / 180));

  return {
    minLat: minLat - latDelta,
    maxLat: maxLat + latDelta,
    minLng: minLng - lngDelta,
    maxLng: maxLng + lngDelta,
  };
}
