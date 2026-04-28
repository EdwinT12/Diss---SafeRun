// Five hand-tuned decision trees that each look at a different facet of
// safety (raw density, environment, violent ratio, hotspot distance, trend).
// The ensemble takes a weighted average and uses the variance between trees
// as a confidence signal. Without labelled training data a learned model
// would just be window-dressing, so the trees are expert rules.
const DECISION_TREES = [
  // Tree 1: Crime density focused (Rosser et al. 2016)
  {
    name: 'CrimeDensityTree',
    weight: 0.25,
    evaluate: (features) => {
      if (features.crimeDensity < 0.1) return 95;
      if (features.crimeDensity < 0.3) {
        return features.isLit ? 80 : 70;
      }
      if (features.crimeDensity < 0.5) {
        return features.violentRatio < 0.3 ? 60 : 45;
      }
      if (features.crimeDensity < 0.7) {
        return features.isLit ? 40 : 30;
      }
      return features.violentRatio > 0.4 ? 10 : 20;
    },
  },

  // Tree 2: Environmental safety (Lozano Dominguez & Mateo Sanguino 2021)
  {
    name: 'EnvironmentTree',
    weight: 0.2,
    evaluate: (features) => {
      let score = features.roadComfort * 100;
      if (features.isLit) score += 15;
      if (features.hotspotDistance > 0.5) score += 10;
      if (features.pedestrianTraffic > 0.7) score += 10;
      return Math.min(100, Math.max(0, score));
    },
  },

  // Tree 3: Violent crime prioritiser (Home Office CSI)
  {
    name: 'ViolentCrimeTree',
    weight: 0.25,
    evaluate: (features) => {
      if (features.violentRatio > 0.5 && features.crimeDensity > 0.3) return 15;
      if (features.violentRatio > 0.4 && features.crimeDensity > 0.2) return 35;
      if (features.violentRatio > 0.3) {
        return features.isLit ? 55 : 45;
      }
      if (features.violentRatio > 0.15) return 70;
      return 90;
    },
  },

  // Tree 4: Hotspot proximity (spatial autocorrelation)
  {
    name: 'HotspotProximityTree',
    weight: 0.15,
    evaluate: (features) => {
      if (features.hotspotDistance < 0.1) return 15;
      if (features.hotspotDistance < 0.2) return 35;
      if (features.hotspotDistance < 0.3) {
        return features.isLit ? 55 : 45;
      }
      if (features.hotspotDistance < 0.5) return 70;
      return 90;
    },
  },

  // Tree 5: Temporal trend aware (Rishe et al. 2024)
  {
    name: 'TemporalTrendTree',
    weight: 0.15,
    evaluate: (features) => {
      const base = 100 - features.crimeDensity * 80;
      if (features.temporalTrend === 'increasing') return Math.max(0, base - 15);
      if (features.temporalTrend === 'decreasing') return Math.min(100, base + 10);
      return base;
    },
  },
];

// Ask every tree, take a weighted vote, return the score plus a confidence
// figure derived from how much the trees disagree.
export function ensembleScore(features, weightOverrides = null) {
  let weightedSum = 0;
  let totalWeight = 0;
  const treeVotes = [];

  for (const tree of DECISION_TREES) {
    const vote = tree.evaluate(features);
    const clampedVote = Math.max(0, Math.min(100, vote));
    // Use profile-specific weight override if provided
    const w = (weightOverrides && weightOverrides[tree.name] != null)
      ? weightOverrides[tree.name]
      : tree.weight;
    weightedSum += clampedVote * w;
    totalWeight += w;
    treeVotes.push({ name: tree.name, vote: clampedVote, weight: w });
  }

  const score = totalWeight > 0 ? weightedSum / totalWeight : 50;

  // Confidence: based on agreement between trees (lower variance = higher confidence)
  const votes = treeVotes.map((t) => t.vote);
  const mean = votes.reduce((s, v) => s + v, 0) / votes.length;
  const variance = votes.reduce((s, v) => s + (v - mean) ** 2, 0) / votes.length;
  const stdDev = Math.sqrt(variance);
  const confidence = Math.max(0, Math.min(1, 1 - stdDev / 50));

  return {
    score: Math.round(score * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    treeVotes,
  };
}

// Clamp every feature into the expected range so the trees don't have to
// defend themselves against rubbish input.
export function buildFeatureVector({
  crimeDensity = 0,
  roadComfort = 0.5,
  isLit = false,
  hotspotDistance = 1.0,
  violentRatio = 0,
  temporalTrend = 'stable',
  pedestrianTraffic = 0.5,
}) {
  return {
    crimeDensity: Math.max(0, Math.min(1, crimeDensity)),
    roadComfort: Math.max(0, Math.min(1, roadComfort)),
    isLit,
    hotspotDistance: Math.max(0, hotspotDistance),
    violentRatio: Math.max(0, Math.min(1, violentRatio)),
    temporalTrend,
    pedestrianTraffic: Math.max(0, Math.min(1, pedestrianTraffic)),
  };
}

// Score every edge along a finished route, then take a distance-weighted
// average. Returns the per-edge breakdown too because the Insights modal
// needs it for the segments / model tabs.
export function scoreRouteEnsemble(edges, hotspots = [], crimeStats = {}, weightOverrides = null) {
  if (!edges || edges.length === 0) {
    return { overallScore: 50, confidence: 0, edgeScores: [], featureImportance: {} };
  }

  const violentRatio = crimeStats.violentRatio || 0;
  const temporalTrend = crimeStats.temporalTrend || 'stable';

  const edgeScores = edges.map((edge) => {
    // Compute distance to nearest hotspot
    let minHotspotDist = 10;
    if (hotspots.length > 0 && edge.midLat && edge.midLng) {
      for (const hs of hotspots) {
        const d = Math.sqrt(
          (edge.midLat - hs.centroid.lat) ** 2 +
          (edge.midLng - hs.centroid.lng) ** 2
        ) * 111;
        if (d < minHotspotDist) minHotspotDist = d;
      }
    }

    const features = buildFeatureVector({
      crimeDensity: edge.density || 0,
      roadComfort: edge.comfort || 0.5,
      isLit: edge.isLit || false,
      hotspotDistance: minHotspotDist,
      violentRatio,
      temporalTrend,
      pedestrianTraffic: getPedestrianTrafficProxy(edge.highwayType),
    });

    return {
      ...ensembleScore(features, weightOverrides),
      distance: edge.distance,
      features,
    };
  });

  // Distance-weighted average
  let totalWeightedScore = 0;
  let totalDist = 0;
  let totalConfidence = 0;

  for (const es of edgeScores) {
    const d = es.distance || 1;
    totalWeightedScore += es.score * d;
    totalConfidence += es.confidence * d;
    totalDist += d;
  }

  const overallScore = totalDist > 0 ? totalWeightedScore / totalDist : 50;
  const avgConfidence = totalDist > 0 ? totalConfidence / totalDist : 0;

  // Feature importance: average absolute contribution of each feature
  const featureImportance = computeFeatureImportance(edgeScores);

  return {
    overallScore: Math.round(overallScore * 10) / 10,
    confidence: Math.round(avgConfidence * 100) / 100,
    edgeScores,
    featureImportance,
    treesUsed: DECISION_TREES.length,
  };
}

// Cheap feature-importance via correlation between each feature and the
// final score across all edges in the route. Not strictly Random Forest's
// permutation importance, but good enough for the Model tab.
function computeFeatureImportance(edgeScores) {
  if (edgeScores.length === 0) return {};

  // Average features across all edges
  const featureNames = ['crimeDensity', 'roadComfort', 'isLit', 'hotspotDistance', 'violentRatio'];
  const importance = {};

  for (const name of featureNames) {
    // Compute correlation between feature and score
    const pairs = edgeScores.map((es) => ({
      feature: name === 'isLit' ? (es.features.isLit ? 1 : 0) : es.features[name],
      score: es.score,
    }));

    const meanF = pairs.reduce((s, p) => s + p.feature, 0) / pairs.length;
    const meanS = pairs.reduce((s, p) => s + p.score, 0) / pairs.length;

    let covFS = 0, varF = 0;
    for (const p of pairs) {
      covFS += (p.feature - meanF) * (p.score - meanS);
      varF += (p.feature - meanF) ** 2;
    }

    const correlation = varF > 0 ? Math.abs(covFS / (pairs.length * Math.sqrt(varF / pairs.length) * stdDev(pairs.map(p => p.score)))) : 0;
    importance[name] = Math.round(Math.min(1, correlation) * 100) / 100;
  }

  // Normalise to sum to 1
  const total = Object.values(importance).reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const key of Object.keys(importance)) {
      importance[key] = Math.round((importance[key] / total) * 100) / 100;
    }
  }

  return importance;
}

function stdDev(values) {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function getPedestrianTrafficProxy(highwayType) {
  const traffic = {
    'pedestrian': 0.95,
    'footway': 0.8,
    'living_street': 0.85,
    'residential': 0.7,
    'path': 0.4,
    'cycleway': 0.5,
    'tertiary': 0.6,
    'secondary': 0.5,
    'primary': 0.3,
    'service': 0.4,
    'track': 0.2,
    'steps': 0.3,
  };
  return traffic[highwayType] || 0.5;
}

// Tree names + plain-English descriptions, surfaced in the Model tab.
export function getTreeDescriptions() {
  return DECISION_TREES.map((t) => ({
    name: t.name,
    weight: t.weight,
    description: getTreeDescription(t.name),
  }));
}

function getTreeDescription(name) {
  const desc = {
    CrimeDensityTree: 'Evaluates the KDE-derived crime density at each point, adjusted for lighting conditions. Based on Rosser et al. (2016) spatial crime analysis methodology.',
    EnvironmentTree: 'Assesses environmental factors including road surface quality, lighting infrastructure, pedestrian infrastructure, and distance from identified hotspots.',
    ViolentCrimeTree: 'Specifically weights the proportion of violent crime categories using Home Office Crime Severity Index classifications.',
    HotspotProximityTree: 'Penalises proximity to detected crime hotspots using spatial autocorrelation analysis from the KDE surface.',
    TemporalTrendTree: 'Adjusts scores based on whether crime in the area is trending upward, downward, or stable over the analysed time period.',
  };
  return desc[name] || 'Decision tree for safety evaluation.';
}
