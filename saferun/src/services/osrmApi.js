const OSRM_BASE = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';

export async function getWalkingRoute(coordinates, options = {}) {
  const coordString = coordinates.map((c) => `${c[0]},${c[1]}`).join(';');
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    alternatives: options.alternatives !== false ? 'true' : 'false',
    steps: 'true',
  });

  const url = `${OSRM_BASE}/${coordString}?${params}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`OSRM request failed: ${res.status}`);
  }

  const data = await res.json();

  if (data.code !== 'Ok') {
    throw new Error(`OSRM error: ${data.code} - ${data.message || 'Unknown error'}`);
  }

  return data;
}

export async function getRoundTripRoute(start, waypoints) {
  const coords = [
    [start.lng, start.lat],
    ...waypoints.map((wp) => [wp.lng, wp.lat]),
    [start.lng, start.lat], // return to start
  ];

  return getWalkingRoute(coords);
}

export async function getSimpleRoute(from, to) {
  const coords = [
    [from.lng, from.lat],
    [to.lng, to.lat],
  ];

  return getWalkingRoute(coords, { alternatives: false });
}
