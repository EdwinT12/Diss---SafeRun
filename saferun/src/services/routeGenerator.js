import * as turf from '@turf/turf';
import { getRoundTripRoute, getWalkingRoute } from './osrmApi.js';
import { fetchCrimesForArea, getLatestMonth } from './crimeApi.js';
import {
  buildSafetyGrid,
  scorePath,
  applyEnvironmentalScores,
  getWeights,
  buildCrimeBreakdown,
  analyseRouteDecisions,
} from './safetyScoring.js';
import {
  computeKDE,
  detectHotspots,
  computeSpatialStats,
  fetchMultiMonthCrimes,
  haversineKm,
} from './crimeAnalysis.js';
import { fetchRoadNetwork, expandBounds, expandBoundsForTwoPoints } from './overpassApi.js';
import {
  buildGraph,
  generateCircularRoute,
  aStarSearch,
  findNearestNode,
  pathToCoordinates,
  analysePathSegments,
} from './graphRouter.js';
import { scoreRouteEnsemble, getTreeDescriptions } from './ensembleScoring.js';
import { getPriorityProfile, getPriorityExplanation } from './priorityProfiles.js';
import { supabase } from './supabaseClient.js';

// Top-level entry point. Drives the seven-stage pipeline: data fetch -> KDE
// -> spatial stats -> env data -> graph + Dijkstra/A* -> ensemble -> insights.
// Works for both loops (no destination) and A->B routes. onProgress fires
// once per stage so the loading modal can narrate what's going on.
export async function generateSafeRoute(start, distanceKm, preferences = {}, seed = 0, destination = null, onProgress = null) {
  // Per-stage timings captured on the user's machine. Surfaced in the
  // Performance tab so we can quote real numbers in the report.
  const timings = {};
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  let lastTick = t0;

  const progress = async (step, detail) => {
    onProgress?.({ step, detail });
    // Yield to allow React to re-render and show the progress update
    await new Promise((r) => setTimeout(r, 0));
    // Record the elapsed time for the *previous* stage. The first call
    // sets the baseline only.
    const now = (typeof performance !== 'undefined' ? performance : Date).now();
    if (step > 1) timings[`step${step - 1}_ms`] = Math.round(now - lastTick);
    lastTick = now;
  };

  const safetyPriority = preferences.safety_priority || 'balanced';
  const routeType = destination ? 'point-to-point' : 'circular';

  // Load the full algorithmic profile for this priority mode
  // This changes behaviour at every stage of the pipeline
  const profile = getPriorityProfile(safetyPriority);
  const weights = profile.compositeWeights;

  // Step 1: Get latest available month and fetch multi-month crime data
  // Data depth is controlled by priority profile (3-9 months)
  await progress(1, `Loading ${profile.label} profile, fetching ${profile.monthsToFetch} months of crime data`);

  let latestMonth;
  try {
    latestMonth = await getLatestMonth();
  } catch {
    latestMonth = getDefaultMonth();
  }

  // For point-to-point, compute the actual distance between start and destination
  // and use the midpoint for crime data fetching to cover the full corridor
  const actualDistanceKm = destination
    ? haversineKm(start.lat, start.lng, destination.lat, destination.lng)
    : distanceKm;

  const midpoint = destination
    ? { lat: (start.lat + destination.lat) / 2, lng: (start.lng + destination.lng) / 2 }
    : start;

  let crimeData = [];
  let fetchedMonths = [];

  // Fetch crime data at key points along the corridor for point-to-point
  const fetchPoints = destination
    ? [start, midpoint, destination]
    : [start];

  try {
    // Fetch from all points to ensure corridor coverage
    const allResults = await Promise.all(
      fetchPoints.map((pt) =>
        fetchMultiMonthCrimes(
          fetchCrimesForArea,
          pt.lat,
          pt.lng,
          latestMonth,
          profile.monthsToFetch
        ).catch(() => ({ crimes: [], months: [] }))
      )
    );

    // Merge and deduplicate crime records
    const seenIds = new Set();
    for (const result of allResults) {
      for (const crime of result.crimes) {
        const key = `${crime.category}-${crime.latitude}-${crime.longitude}-${crime.month}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          crimeData.push(crime);
        }
      }
      if (result.months.length > 0) fetchedMonths = result.months;
    }
  } catch (err) {
    console.error('Multi-month crime fetch failed, falling back to single month:', err);
    try {
      crimeData = await fetchCrimesForArea(start.lat, start.lng, latestMonth);
      fetchedMonths = [latestMonth];
    } catch {
      crimeData = [];
    }
  }

  // Step 2: Build KDE safety grid with temporal decay
  await progress(2, `Building Kernel Density Estimation surface, ${crimeData.length} crimes, Gaussian kernel with Silverman bandwidth`);
  // For point-to-point, use a radius that covers the full route corridor
  const radiusKm = destination
    ? Math.max(actualDistanceKm / 2 + 1, 2)
    : Math.max(distanceKm / 2, 1.5);

  const { grid: safetyGrid, kdeGrid, hotspots, stats: kdeStats } = buildSafetyGrid(
    crimeData,
    midpoint,  // Center the grid on the midpoint for point-to-point
    radiusKm,
    latestMonth
  );

  // Step 3: Compute spatial statistics for insights
  await progress(3, `Computing spatial statistics, Nearest Neighbour Index (Clark & Evans 1954), hotspot clustering`);
  const spatialStats = computeSpatialStats(crimeData);

  // Step 4: Fetch environmental data (optional)
  await progress(4, 'Fetching environmental data, lighting, road surfaces, pedestrian infrastructure');
  let envData = [];
  try {
    const { data } = await supabase
      .from('environmental_data')
      .select('*')
      .limit(100);
    envData = data || [];
  } catch {
    // Environmental data is optional
  }

  // Apply environmental scores with profile-specific weights
  const enhancedGrid = applyEnvironmentalScores(safetyGrid, envData, weights);

  // Step 5: Try graph-based routing first, fall back to OSRM
  await progress(5, 'Building weighted graph from OSM network, running modified Dijkstra/A* with safety-weighted edges');
  // All routing parameters come from the priority profile
  let routeResult;
  try {
    routeResult = await generateGraphRoute(
      start,
      distanceKm,
      destination,
      kdeGrid,
      profile.safetyAlpha,
      preferences,
      seed,
      enhancedGrid,
      profile
    );
  } catch (err) {
    console.warn('Graph routing failed, falling back to OSRM:', err.message);
    routeResult = await generateOSRMRoute(
      start,
      distanceKm,
      destination,
      enhancedGrid,
      seed,
      profile
    );
  }

  if (!routeResult) {
    throw new Error('Could not generate a safe route for this area. Try a different starting point or distance.');
  }

  // Step 6: Ensemble scoring (Random Forest-inspired)
  await progress(6, 'Running Random Forest ensemble, 5 decision trees scoring route safety, computing confidence');
  const violentCategories = ['violent-crime', 'robbery', 'possession-of-weapons'];
  const violentCount = crimeData.filter((c) => violentCategories.includes(c.category)).length;
  const violentRatio = crimeData.length > 0 ? violentCount / crimeData.length : 0;

  // Determine temporal trend from multi-month data
  const temporalTrend = computeTemporalTrend(crimeData, fetchedMonths);

  const ensembleResult = scoreRouteEnsemble(
    routeResult._edges || [],
    hotspots,
    { violentRatio, temporalTrend },
    profile.ensembleWeightOverrides
  );

  // Use ensemble score if available, otherwise keep grid-based score
  if (ensembleResult.edgeScores.length > 0) {
    routeResult.safetyScore = ensembleResult.overallScore;
    routeResult.ensembleResult = ensembleResult;
  }

  // Step 7: Build comprehensive insights
  await progress(7, 'Compiling route insights, crime breakdown, segment analysis, temporal trends');
  const crimeBreakdown = buildCrimeBreakdown(crimeData);
  const routeAnalysis = analyseRouteDecisions(routeResult.routeCoords, enhancedGrid);

  // Close out the timing for the final stage and compute the total.
  const tEnd = (typeof performance !== 'undefined' ? performance : Date).now();
  timings.step7_ms = Math.round(tEnd - lastTick);
  timings.total_ms = Math.round(tEnd - t0);

  routeResult.insights = {
    crimeBreakdown,
    routeAnalysis,
    dataMonth: latestMonth,
    fetchedMonths,
    totalCrimesInArea: crimeData.length,
    gridCellsAnalysed: enhancedGrid.size,
    safetyPriority,
    weights,
    routeType,
    environmentalDataPoints: envData.length,
    spatialStats,
    kdeStats,
    hotspots,
    safetyAlpha: profile.safetyAlpha,
    algorithm: routeResult._algorithm || 'osrm',
    graphStats: routeResult._graphStats || null,
    segmentAnalysis: routeResult._segmentAnalysis || [],
    ensembleResult,
    treeDescriptions: getTreeDescriptions(),
    violentRatio: Math.round(violentRatio * 100),
    temporalTrend,
    profile: {
      label: profile.label,
      description: profile.description,
      monthsToFetch: profile.monthsToFetch,
      safetyAlpha: profile.safetyAlpha,
      costExponent: profile.costExponent,
      hotspotBufferKm: profile.hotspotBufferKm,
      temporalDecayLambda: profile.temporalDecayLambda,
      distanceTolerance: profile.distanceTolerance,
      kdeBandwidthScale: profile.kdeBandwidthScale,
    },
    priorityExplanation: getPriorityExplanation(safetyPriority),
    performance: timings,
  };

  return routeResult;
}

// Tries the proper graph router (OSM + safety-weighted Dijkstra/A*).
async function generateGraphRoute(start, distanceKm, destination, kdeGrid, safetyAlpha, preferences, seed, safetyGrid, profile = {}) {
  // Fetch OSM road network - for point-to-point, cover the entire corridor
  const bounds = destination
    ? expandBoundsForTwoPoints(start, destination, 1.0)
    : expandBounds(start, Math.max(distanceKm * 0.7, 1.5));
  const { nodes, ways } = await fetchRoadNetwork(bounds);

  if (nodes.size < 50 || ways.length < 20) {
    throw new Error('Insufficient road network data for graph routing');
  }

  // Build weighted graph with profile-specific parameters
  const graph = buildGraph(nodes, ways, kdeGrid, {
    safetyAlpha,
    costExponent: profile.costExponent || 2.0,
    kdeResolution: profile.kdeResolution || 0.001,
    preferences,
    preferenceMultiplierScale: profile.preferenceMultiplierScale || 1.0,
    roadTypeMultipliers: profile.roadTypeMultipliers || {},
  });

  let result;
  if (destination) {
    // Point-to-point routing with A*
    result = generatePointToPointGraph(graph, start, destination);
  } else {
    // Circular route generation
    result = generateCircularRoute(graph, start, distanceKm * 1000, seed);
  }

  if (!result) throw new Error('Graph router could not find a valid route');

  // Convert to coordinates
  const coords = pathToCoordinates(result.path, graph.nodeMap);
  if (coords.length < 2) throw new Error('Route too short');

  // Score route against safety grid
  const { overallScore, segmentScores, explanation } = scorePath(coords, safetyGrid);

  // Per-segment analysis
  const allEdges = result.segments
    ? result.segments.flatMap(s => s.edges)
    : (result.edges || []);
  const segmentAnalysis = analysePathSegments(allEdges, graph.nodeMap);

  // Add midpoint coordinates to edges for ensemble scoring
  const edgesWithMidpoints = allEdges.map((edge) => {
    const fromNode = graph.nodeMap.get(edge.to); // approximate
    return { ...edge, midLat: fromNode?.lat, midLng: fromNode?.lng };
  });

  return {
    _algorithm: 'graph-dijkstra',
    _graphStats: graph.stats,
    _segmentAnalysis: segmentAnalysis,
    _edges: edgesWithMidpoints,
    _routesEvaluated: 1,
    geoJSON: {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
      properties: {
        distance: result.totalDistance / 1000,
        safetyScore: overallScore,
        avgDensity: result.avgDensity,
      },
    },
    distanceKm: Math.round(result.totalDistance / 10) / 100,
    durationMin: Math.round((result.totalDistance / 1000) / 5.5 * 60), // ~5.5 km/h running pace
    safetyScore: Math.round(overallScore * 10) / 10,
    explanation,
    segmentScores,
    routeCoords: coords,
  };
}

// A* between the nearest graph nodes to start and destination.
function generatePointToPointGraph(graph, start, destination) {
  const { adjacency, nodeMap } = graph;

  const startNodeId = findNearestNode(nodeMap, start.lat, start.lng);
  const endNodeId = findNearestNode(nodeMap, destination.lat, destination.lng);

  if (!startNodeId || !endNodeId) return null;

  const result = aStarSearch(adjacency, startNodeId, endNodeId, nodeMap);
  return result;
}

// OSRM fallback. Only kicks in when the graph build or search throws.
async function generateOSRMRoute(start, distanceKm, destination, safetyGrid, seed, profile = {}) {
  if (destination) {
    return generateOSRMPointToPoint(start, destination, safetyGrid);
  }
  return generateOSRMCircular(start, distanceKm, safetyGrid, seed);
}

async function generateOSRMCircular(start, distanceKm, safetyGrid, seed) {
  const waypoints = generateWaypoints(start, distanceKm, safetyGrid, seed);

  const coords = [
    [start.lng, start.lat],
    ...waypoints.map((wp) => [wp.lng, wp.lat]),
    [start.lng, start.lat],
  ];

  const osrmResult = await getWalkingRoute(coords);
  if (!osrmResult.routes || osrmResult.routes.length === 0) return null;

  return pickBestOSRMRoute(osrmResult.routes, safetyGrid, distanceKm);
}

async function generateOSRMPointToPoint(start, destination, safetyGrid) {
  const coords = [
    [start.lng, start.lat],
    [destination.lng, destination.lat],
  ];

  const osrmResult = await getWalkingRoute(coords, { alternatives: true });
  if (!osrmResult.routes || osrmResult.routes.length === 0) return null;

  return pickBestOSRMRoute(osrmResult.routes, safetyGrid, null);
}

function pickBestOSRMRoute(routes, safetyGrid, targetDistanceKm) {
  let bestRoute = null;
  let bestScore = -Infinity;

  for (const route of routes) {
    const coords = route.geometry.coordinates;
    const distanceKm = route.distance / 1000;
    const { overallScore, segmentScores, explanation } = scorePath(coords, safetyGrid);

    let distancePenalty = 0;
    if (targetDistanceKm) {
      const ratio = distanceKm / targetDistanceKm;
      if (ratio < 0.7 || ratio > 1.4) distancePenalty = 20;
      else if (ratio < 0.8 || ratio > 1.3) distancePenalty = 10;
    }

    const adjustedScore = overallScore - distancePenalty;

    if (adjustedScore > bestScore) {
      bestScore = adjustedScore;
      bestRoute = {
        _algorithm: 'osrm-fallback',
        _routesEvaluated: routes.length,
        geoJSON: {
          type: 'Feature',
          geometry: route.geometry,
          properties: {
            distance: distanceKm,
            duration: route.duration,
            safetyScore: overallScore,
          },
        },
        distanceKm: Math.round(distanceKm * 100) / 100,
        durationMin: Math.round(route.duration / 60),
        safetyScore: Math.round(overallScore * 10) / 10,
        explanation,
        segmentScores,
        routeCoords: coords,
      };
    }
  }

  return bestRoute;
}

// Used by the OSRM fallback. Sticks waypoints out at compass bearings, scores
// them against the safety grid, and prefers the higher-scoring ones.
function generateWaypoints(start, distanceKm, safetyGrid, seed = 0) {
  const waypointDistance = distanceKm / 4;
  const directions = [0, 45, 90, 135, 180, 225, 270, 315];
  const offset = (seed * 22.5) % 360;

  const candidates = directions.map((bearing) => {
    const adjustedBearing = (bearing + offset) % 360;
    const point = turf.destination(
      turf.point([start.lng, start.lat]),
      waypointDistance,
      adjustedBearing,
      { units: 'kilometers' }
    );
    const [lng, lat] = point.geometry.coordinates;

    const key = `${(Math.round(lat / 0.002) * 0.002).toFixed(4)},${(Math.round(lng / 0.002) * 0.002).toFixed(4)}`;
    const cell = safetyGrid.get(key);
    const score = cell ? cell.compositeScore : 50;

    return { lat, lng, score, bearing: adjustedBearing };
  });

  candidates.sort((a, b) => b.score - a.score);
  return selectLoopWaypoints(candidates);
}

function selectLoopWaypoints(candidates) {
  if (candidates.length < 2) return candidates;

  const selected = [candidates[0]];

  for (const candidate of candidates.slice(1)) {
    const angleDiff = Math.abs(candidate.bearing - selected[0].bearing);
    const normalizedDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
    if (normalizedDiff >= 80 && normalizedDiff <= 200) {
      selected.push(candidate);
      break;
    }
  }

  if (selected.length < 2) selected.push(candidates[1]);

  if (candidates.length >= 4) {
    for (const candidate of candidates.slice(2)) {
      const angle1 = Math.abs(candidate.bearing - selected[0].bearing);
      const angle2 = Math.abs(candidate.bearing - selected[1].bearing);
      const norm1 = angle1 > 180 ? 360 - angle1 : angle1;
      const norm2 = angle2 > 180 ? 360 - angle2 : angle2;
      if (norm1 >= 50 && norm2 >= 50) {
        selected.push(candidate);
        break;
      }
    }
  }

  selected.sort((a, b) => a.bearing - b.bearing);
  return selected;
}

// Route persistence (unchanged)

export async function saveRoute(userId, routeData, start, preferences) {
  const { error } = await supabase.from('saved_routes').insert({
    user_id: userId,
    start_lat: start.lat,
    start_lng: start.lng,
    distance_km: routeData.distanceKm,
    route_geojson: routeData.geoJSON,
    safety_score: routeData.safetyScore,
    explanation: {
      segments: routeData.explanation,
      overall_summary: `Route comfort score: ${routeData.safetyScore}/100`,
    },
    preferences,
  });

  if (error) throw error;
}

export async function getSavedRoutes(userId) {
  const { data, error } = await supabase
    .from('saved_routes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteSavedRoute(routeId) {
  const { error } = await supabase
    .from('saved_routes')
    .delete()
    .eq('id', routeId);

  if (error) throw error;
}

function getDefaultMonth() {
  const now = new Date();
  now.setMonth(now.getMonth() - 2);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Quick rising / falling / stable label by comparing the average per-month
// count in the recent half of the window vs the older half. Needs at least
// three months of data, otherwise we just return 'stable'.
function computeTemporalTrend(crimes, months) {
  if (!months || months.length < 3) return 'stable';

  // Count crimes per month
  const countsPerMonth = {};
  for (const m of months) countsPerMonth[m] = 0;
  for (const c of crimes) {
    const m = c.month;
    if (m && countsPerMonth[m] !== undefined) countsPerMonth[m]++;
  }

  // Split into recent half and older half
  const sorted = [...months].sort();
  const mid = Math.floor(sorted.length / 2);
  const olderMonths = sorted.slice(0, mid);
  const recentMonths = sorted.slice(mid);

  const olderAvg = olderMonths.reduce((s, m) => s + countsPerMonth[m], 0) / Math.max(olderMonths.length, 1);
  const recentAvg = recentMonths.reduce((s, m) => s + countsPerMonth[m], 0) / Math.max(recentMonths.length, 1);

  if (olderAvg === 0) return 'stable';
  const changeRatio = (recentAvg - olderAvg) / olderAvg;

  if (changeRatio > 0.15) return 'increasing';
  if (changeRatio < -0.15) return 'decreasing';
  return 'stable';
}
