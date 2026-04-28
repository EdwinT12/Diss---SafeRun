// Each priority mode bundles the parameters that get passed into every stage
// of the pipeline (data depth, KDE width, alpha, ensemble weights, road type
// multipliers, distance tolerance, etc.). Selecting a mode in the UI just
// loads one of these.

export function getPriorityProfile(priority) {
  const profiles = {
    // MAXIMUM SAFETY
    // Aggressively avoids any area with elevated crime.
    // Willing to add significant extra distance for safety.
    // Uses wider KDE bandwidth to capture broader risk patterns.
    // Applies stronger temporal weighting on recent crimes.
    // Ensemble shifts weight toward violent crime & hotspot trees.
    maximum_safety: {
      label: 'Maximum Safety',
      description: 'Aggressively avoids elevated-risk areas. Willing to add significant extra distance for route comfort.',

      // Data collection
      monthsToFetch: 9,                    // More historical data for robust analysis

      // KDE parameters
      kdeBandwidthScale: 1.4,              // Wider bandwidth = smoother surface, captures broader risk
      kdeResolution: 0.0008,               // Finer grid for more precise avoidance

      // Hotspot avoidance
      hotspotThreshold: 0.5,               // Lower threshold = more hotspots detected
      hotspotBufferKm: 0.3,                // 300m buffer zone around each hotspot centroid

      // Graph routing
      safetyAlpha: 12.0,                   // Very aggressive crime penalty
      costExponent: 2.5,                   // Higher exponent = steeper non-linear avoidance
      preferenceMultiplierScale: 1.8,      // User toggles have stronger effect

      // Ensemble tree weight redistribution
      ensembleWeightOverrides: {
        CrimeDensityTree: 0.30,            // Increased from 0.25
        EnvironmentTree: 0.15,             // Decreased (less relevant at max safety)
        ViolentCrimeTree: 0.30,            // Increased - violent crime is paramount
        HotspotProximityTree: 0.15,        // Slightly increased
        TemporalTrendTree: 0.10,           // Slightly decreased
      },

      // Temporal analysis
      temporalDecayLambda: 0.1,            // Slower decay = older crimes still relevant

      // Distance tolerance
      distanceTolerance: { min: 0.5, max: 1.8 }, // Accept 50%-180% of target distance
      distancePenaltyWeight: 0.3,          // Low penalty for distance deviation

      // Composite scoring weights
      compositeWeights: { crime: 0.75, env: 0.25 },

      // Road type preferences (multipliers applied to edge cost)
      roadTypeMultipliers: {
        'primary': 2.0,                    // Strongly avoid busy roads
        'secondary': 1.6,
        'tertiary': 1.3,
        'path': 1.5,                       // Avoid isolated paths
        'track': 2.0,                      // Avoid tracks (poorly maintained)
        'steps': 1.8,                      // Avoid steps (potential ambush points)
        'pedestrian': 0.7,                 // Prefer pedestrian zones
        'footway': 0.8,
        'residential': 0.85,
        'living_street': 0.75,
      },

      // Waypoint generation (OSRM fallback)
      waypointSafetyBias: 0.9,            // Heavily bias toward safest waypoints
      candidateRouteCount: 5,              // Generate more candidates to find safest
    },

    // BALANCED
    // Moderate avoidance of high-crime areas.
    // Reasonable extra distance acceptable.
    // Standard KDE bandwidth.
    // Equal weight across ensemble trees.
    // Good compromise for most users.
    balanced: {
      label: 'Balanced',
      description: 'Balanced approach weighing safety and route efficiency equally. Suitable for most runs.',

      monthsToFetch: 6,
      kdeBandwidthScale: 1.0,
      kdeResolution: 0.001,
      hotspotThreshold: 0.6,
      hotspotBufferKm: 0.15,
      safetyAlpha: 5.0,
      costExponent: 2.0,
      preferenceMultiplierScale: 1.0,

      ensembleWeightOverrides: {
        CrimeDensityTree: 0.25,
        EnvironmentTree: 0.20,
        ViolentCrimeTree: 0.25,
        HotspotProximityTree: 0.15,
        TemporalTrendTree: 0.15,
      },

      temporalDecayLambda: 0.15,
      distanceTolerance: { min: 0.7, max: 1.4 },
      distancePenaltyWeight: 0.5,
      compositeWeights: { crime: 0.6, env: 0.4 },

      roadTypeMultipliers: {
        'primary': 1.5,
        'secondary': 1.3,
        'tertiary': 1.1,
        'path': 1.2,
        'track': 1.5,
        'steps': 1.3,
        'pedestrian': 0.8,
        'footway': 0.85,
        'residential': 0.9,
        'living_street': 0.8,
      },

      waypointSafetyBias: 0.6,
      candidateRouteCount: 3,
    },

    // BASELINE (SHORTEST PATH)
    // No safety weighting at all. Acts as an evaluation
    // baseline, the same map view and the same insights
    // panel, but the graph router falls back to a pure
    // shortest-path search (safetyAlpha = 0). Crime data is
    // still fetched so the resulting route can be *scored*
    // for safety, even though safety did not influence its
    // selection. This is what makes the comparative
    // evaluation in the dissertation honest: every mode
    // including the baseline goes through the same scoring
    // pipeline, only the routing cost function changes.
    shortest_path: {
      label: 'Baseline (Shortest Path)',
      description: 'No safety weighting. Used as an evaluation baseline so SafeRun routes can be compared against a pure shortest-path benchmark.',

      monthsToFetch: 3,                    // Just enough data to score the resulting route
      kdeBandwidthScale: 1.0,
      kdeResolution: 0.001,
      hotspotThreshold: 0.6,
      hotspotBufferKm: 0.15,

      // The two key parameters: zero crime penalty, linear
      // (no exponent boost), pure distance routing.
      safetyAlpha: 0.0,
      costExponent: 1.0,
      preferenceMultiplierScale: 0.0,      // User toggles disabled for the baseline

      // Ensemble weights are kept neutral so the *score*
      // still reflects every signal, only the *routing*
      // ignores safety.
      ensembleWeightOverrides: {
        CrimeDensityTree: 0.25,
        EnvironmentTree: 0.20,
        ViolentCrimeTree: 0.25,
        HotspotProximityTree: 0.15,
        TemporalTrendTree: 0.15,
      },

      temporalDecayLambda: 0.15,
      distanceTolerance: { min: 0.85, max: 1.15 },
      distancePenaltyWeight: 0.8,
      compositeWeights: { crime: 0.6, env: 0.4 },

      // No road-type preference at all, every road type is
      // treated equally for the baseline.
      roadTypeMultipliers: {
        'primary': 1.0,
        'secondary': 1.0,
        'tertiary': 1.0,
        'path': 1.0,
        'track': 1.0,
        'steps': 1.0,
        'pedestrian': 1.0,
        'footway': 1.0,
        'residential': 1.0,
        'living_street': 1.0,
      },

      waypointSafetyBias: 0.0,
      candidateRouteCount: 1,
    },

    // EFFICIENCY FOCUSED
    // Minimises distance while still avoiding the worst areas.
    // Narrow KDE bandwidth for precise, localised avoidance.
    // Lower crime penalty - only avoids genuine hotspots.
    // Ensemble shifts weight toward environmental/comfort trees.
    // Tight distance tolerance.
    efficiency_focused: {
      label: 'Distance Focused',
      description: 'Prioritises efficient distance while still steering away from the most elevated-risk areas.',

      monthsToFetch: 3,                    // Less data = faster, focused on recent only
      kdeBandwidthScale: 0.7,              // Narrow bandwidth = precise, localised avoidance
      kdeResolution: 0.0015,               // Coarser grid (faster computation)
      hotspotThreshold: 0.75,              // Higher threshold = only the worst hotspots
      hotspotBufferKm: 0.05,               // Small buffer
      safetyAlpha: 2.0,                    // Low crime penalty
      costExponent: 1.5,                   // Gentler non-linear curve
      preferenceMultiplierScale: 0.6,      // User toggles have softer effect

      ensembleWeightOverrides: {
        CrimeDensityTree: 0.15,            // Reduced crime weight
        EnvironmentTree: 0.30,             // Increased environment (comfort matters more)
        ViolentCrimeTree: 0.20,            // Still avoid violent crime
        HotspotProximityTree: 0.10,        // Low hotspot weight
        TemporalTrendTree: 0.25,           // Recent trends matter most
      },

      temporalDecayLambda: 0.25,           // Fast decay = only very recent crimes matter
      distanceTolerance: { min: 0.85, max: 1.15 }, // Tight distance match
      distancePenaltyWeight: 0.8,          // Strong penalty for distance deviation
      compositeWeights: { crime: 0.4, env: 0.6 },

      roadTypeMultipliers: {
        'primary': 1.1,                    // Minor avoidance only
        'secondary': 1.05,
        'tertiary': 1.0,
        'path': 1.0,
        'track': 1.2,
        'steps': 1.1,
        'pedestrian': 0.9,
        'footway': 0.9,
        'residential': 0.95,
        'living_street': 0.9,
      },

      waypointSafetyBias: 0.3,            // Less safety bias = more direct routes
      candidateRouteCount: 2,
    },
  };

  return profiles[priority] || profiles.balanced;
}

// Bullet points shown in the Algorithm tab so the user can see what the
// selected mode actually changes. Plain English, no jargon dump.
export function getPriorityExplanation(priority) {
  const explanations = {
    shortest_path: [
      'Pure shortest-path routing, safetyAlpha = 0, no road-type preference, no user preference multipliers',
      'Crime data is still fetched (3 months) so the resulting route can be scored for safety after the fact',
      'Used as an evaluation baseline against which the three safety-weighted modes can be compared',
      'Routes generated in this mode will be the shortest possible distance for the requested loop or A→B query',
    ],
    maximum_safety: [
      'Analyses 9 months of historical crime data for comprehensive risk assessment',
      'Wider KDE bandwidth captures broader spatial risk patterns around crime clusters',
      'Applies a 300m buffer zone around each detected crime hotspot',
      'Routes can be up to 80% longer than requested to avoid elevated-risk areas',
      'Ensemble model heavily weights violent crime and hotspot proximity trees',
      'Isolated paths, steps, and busy roads are penalised by road-type multipliers',
      'Temporal decay is slower (lambda=0.1) so older incidents still influence routing',
    ],
    balanced: [
      'Analyses 6 months of crime data with moderate temporal decay',
      'Standard KDE bandwidth balances precision with spatial smoothing',
      'Routes can be up to 40% longer than requested for safety gains',
      'Equal weight given to all 5 ensemble decision trees',
      'Moderate road-type preferences applied',
      'Good compromise between route comfort and distance efficiency',
    ],
    efficiency_focused: [
      'Analyses only 3 most recent months for fast, current-focused routing',
      'Narrow KDE bandwidth targets only the most localised risk concentrations',
      'Only the highest-density crime clusters trigger avoidance',
      'Routes stay within 15% of requested distance',
      'Ensemble model weights environmental comfort and temporal trends higher',
      'Rapid temporal decay (lambda=0.25) ensures only recent data drives decisions',
    ],
  };

  return explanations[priority] || explanations.balanced;
}
