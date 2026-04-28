import { computeKDE, detectHotspots, getDensityAtPoint } from './crimeAnalysis.js';
import {
  CRIME_WEIGHTS as _CRIME_WEIGHTS,
  CRIME_LABELS as _CRIME_LABELS,
  getCrimeWeight,
} from './crimeConstants.js';

// Re-exported so other modules can import from a single place.
export const CRIME_WEIGHTS = _CRIME_WEIGHTS;
export const CRIME_LABELS = _CRIME_LABELS;

// Build the safety grid for a circular area around a centre point. The
// underlying KDE work happens in crimeAnalysis.js; this function wraps it
// so the rest of the pipeline can ask for a ready-to-use grid.
export function buildSafetyGrid(crimeData, center, radiusKm = 3, currentMonth = null) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));

  const bounds = {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };

  // KDE resolution: ~111m per cell for detailed analysis
  const kdeResolution = 0.001;

  // Compute KDE crime density surface
  const { grid: kdeGrid, bandwidth, stats: kdeStats } = computeKDE(
    crimeData,
    bounds,
    kdeResolution,
    currentMonth
  );

  // Detect crime hotspots from the KDE surface
  const hotspots = detectHotspots(kdeGrid, 0.6);

  // Build legacy-compatible grid (for backwards compatibility with scoring)
  const cellSize = 0.002;
  const grid = new Map();
  let maxDensity = 0;

  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += cellSize) {
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += cellSize) {
      const density = getDensityAtPoint(lat, lng, kdeGrid, kdeResolution);
      if (density > maxDensity) maxDensity = density;

      const key = gridKey(lat, lng, cellSize);
      grid.set(key, {
        lat: snapToGrid(lat, cellSize),
        lng: snapToGrid(lng, cellSize),
        density,
        crimeScore: 0,
        compositeScore: 0,
      });
    }
  }

  // Normalise: 100 = safest (lowest density), 0 = highest density
  for (const cell of grid.values()) {
    cell.crimeScore = maxDensity > 0
      ? 100 * (1 - cell.density / maxDensity)
      : 100;
    cell.compositeScore = cell.crimeScore;
  }

  return {
    grid,
    kdeGrid,
    hotspots,
    bounds,
    stats: {
      ...kdeStats,
      hotspotsDetected: hotspots.length,
    },
  };
}

// Walk the route, look up each sample point in the grid, and average.
export function scorePath(routeCoords, safetyGrid, cellSize = 0.002) {
  if (!routeCoords || routeCoords.length === 0) {
    return { overallScore: 0, segmentScores: [], explanation: [] };
  }

  const segmentScores = [];
  let totalScore = 0;
  let scoredPoints = 0;

  const step = Math.max(1, Math.floor(routeCoords.length / 100));

  for (let i = 0; i < routeCoords.length; i += step) {
    const [lng, lat] = routeCoords[i];
    const key = gridKey(lat, lng, cellSize);
    const cell = safetyGrid.get(key);
    const score = cell ? cell.compositeScore : 75;
    segmentScores.push({ lat, lng, score });
    totalScore += score;
    scoredPoints++;
  }

  const overallScore = scoredPoints > 0 ? totalScore / scoredPoints : 0;
  const explanation = generateExplanation(segmentScores, overallScore);

  return { overallScore, segmentScores, explanation };
}

// Mix SafeStats environmental scores into the grid alongside the crime score.
export function applyEnvironmentalScores(safetyGrid, envData, weights = { crime: 0.6, env: 0.4 }) {
  // envData is an array of { lsoa_code, safety_score, ... } with geographic coverage
  // For simplicity, we apply a borough-level average if individual LSOA mapping isn't available
  if (!envData || envData.length === 0) return safetyGrid;

  const avgEnvScore = envData.reduce((sum, d) => sum + (d.safety_score || 50), 0) / envData.length;

  for (const [, cell] of safetyGrid) {
    cell.environmentalScore = avgEnvScore;
    cell.compositeScore = (cell.crimeScore * weights.crime) + (avgEnvScore * weights.env);
  }

  return safetyGrid;
}

// Crime/env weight split for the legacy composite scorer.
export function getWeights(safetyPriority) {
  switch (safetyPriority) {
    case 'maximum_safety':
      return { crime: 0.7, env: 0.3 };
    case 'efficiency_focused':
      return { crime: 0.4, env: 0.3 };
    case 'balanced':
    default:
      return { crime: 0.6, env: 0.4 };
  }
}

// Build the bullet points shown in the route panel. Always positive-framed:
// no "this area is bad" labels, ever.
function generateExplanation(segmentScores, overallScore) {
  const highlights = [];

  // Calculate what percentage of the route is in well-scored areas
  const safeSegments = segmentScores.filter((s) => s.score >= 70).length;
  const safePercent = Math.round((safeSegments / segmentScores.length) * 100);

  if (safePercent >= 80) {
    highlights.push('This route follows well-connected streets with good community activity levels');
  } else if (safePercent >= 60) {
    highlights.push('Most of this route follows areas with regular foot traffic');
  }

  if (overallScore >= 80) {
    highlights.push('The area around this route has low incident reports');
  }

  highlights.push('Route follows established pedestrian pathways');

  // Identify the best segment
  const bestSegment = segmentScores.reduce((best, s) => (s.score > best.score ? s : best), segmentScores[0]);
  if (bestSegment && bestSegment.score >= 85) {
    highlights.push('Includes stretches through particularly well-connected areas');
  }

  return highlights;
}

// 0-100 score to a four-bucket label.
export function getSafetyLabel(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 55) return 'Good';
  return 'Fair';
}

// --- Internal helpers ---

function gridKey(lat, lng, cellSize) {
  return `${snapToGrid(lat, cellSize).toFixed(4)},${snapToGrid(lng, cellSize).toFixed(4)}`;
}

function snapToGrid(value, cellSize) {
  return Math.round(value / cellSize) * cellSize;
}

// getCrimeWeight is imported from crimeConstants above

// Group crimes by category, weight by severity, sort by impact.
export function buildCrimeBreakdown(crimeData) {
  const categories = {};
  let total = 0;

  for (const crime of crimeData) {
    const cat = crime.category || crime.category;
    if (!categories[cat]) {
      categories[cat] = { count: 0, weight: getCrimeWeight(cat), label: CRIME_LABELS[cat] || cat };
    }
    categories[cat].count++;
    total++;
  }

  // Sort by weighted impact (count * weight)
  const sorted = Object.entries(categories)
    .map(([key, val]) => ({
      category: key,
      label: val.label,
      count: val.count,
      weight: val.weight,
      impact: Math.round(val.count * val.weight),
      percentage: total > 0 ? Math.round((val.count / total) * 100) : 0,
    }))
    .sort((a, b) => b.impact - a.impact);

  return { categories: sorted, total };
}

// How many high-risk cells did the route dodge, and how much of it sits on
// safe cells. Powers the "Route Selection" block in the Overview tab.
export function analyseRouteDecisions(routeCoords, safetyGrid, cellSize = 0.002) {
  const passedCells = new Set();
  const allCells = [];
  let highRiskAvoided = 0;
  let lowRiskUsed = 0;

  // Collect all grid cells and their scores
  for (const [key, cell] of safetyGrid) {
    allCells.push({ key, ...cell });
  }

  // Mark cells the route passes through
  const step = Math.max(1, Math.floor(routeCoords.length / 200));
  for (let i = 0; i < routeCoords.length; i += step) {
    const [lng, lat] = routeCoords[i];
    const key = gridKey(lat, lng, cellSize);
    passedCells.add(key);
  }

  // Count high-risk cells avoided
  for (const cell of allCells) {
    const key = `${cell.lat.toFixed(4)},${cell.lng.toFixed(4)}`;
    if (cell.compositeScore < 40 && !passedCells.has(key)) {
      highRiskAvoided++;
    }
    if (cell.compositeScore >= 70 && passedCells.has(key)) {
      lowRiskUsed++;
    }
  }

  // Calculate what % of route is on safe cells
  let safePoints = 0;
  let totalPoints = 0;
  for (let i = 0; i < routeCoords.length; i += step) {
    const [lng, lat] = routeCoords[i];
    const key = gridKey(lat, lng, cellSize);
    const cell = safetyGrid.get(key);
    totalPoints++;
    if (cell && cell.compositeScore >= 65) safePoints++;
  }

  const safePercentage = totalPoints > 0 ? Math.round((safePoints / totalPoints) * 100) : 0;

  return {
    totalGridCells: allCells.length,
    cellsOnRoute: passedCells.size,
    highRiskAvoided,
    lowRiskUsed,
    safePercentage,
  };
}
