// Builds an adjacency graph from an OSM node/way set and runs a modified
// Dijkstra (or A*) over it. Edge cost = distance * (1 + alpha * density^k) *
// prefMult / comfort. Alpha and k come from the active priority profile, so
// the same code is used for everything from the no-safety baseline up to
// max-safety.

import { haversineKm, getDensityAtPoint } from './crimeAnalysis.js';
import { extractWayProperties, wayComfortScore } from './overpassApi.js';

export function buildGraph(nodes, ways, kdeGrid, options = {}) {
  const {
    safetyAlpha = 5.0,
    costExponent = 2.0,            // Profile-controlled: density exponent
    kdeResolution = 0.001,
    preferences = {},
    preferenceMultiplierScale = 1.0, // Profile-controlled: how strong user prefs are
    roadTypeMultipliers = {},        // Profile-controlled: per road-type cost multipliers
  } = options;

  const adjacency = new Map();
  let edgeCount = 0;
  let totalDensity = 0;
  let maxEdgeDensity = 0;

  for (const way of ways) {
    const props = extractWayProperties(way.tags);

    if (!props.footAccess) continue;

    const comfort = wayComfortScore(props);

    // Apply user preference modifiers scaled by profile
    let prefMultiplier = 1.0;
    if (preferences.prefer_lit_areas && !props.isLit) {
      prefMultiplier *= 1 + 0.3 * preferenceMultiplierScale;
    }
    if (preferences.avoid_narrow_paths && props.width && props.width < 2) {
      prefMultiplier *= 1 + 0.5 * preferenceMultiplierScale;
    }
    if (preferences.avoid_parks && props.highwayType === 'path') {
      prefMultiplier *= 1 + 0.4 * preferenceMultiplierScale;
    }

    // Apply profile-specific road type multiplier
    const roadMult = roadTypeMultipliers[props.highwayType] || 1.0;
    prefMultiplier *= roadMult;

    // Build edges between consecutive nodes in the way
    for (let i = 0; i < way.nodeIds.length - 1; i++) {
      const fromId = way.nodeIds[i];
      const toId = way.nodeIds[i + 1];
      const fromNode = nodes.get(fromId);
      const toNode = nodes.get(toId);

      if (!fromNode || !toNode) continue;

      // Physical distance in metres
      const distKm = haversineKm(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
      const distM = distKm * 1000;

      // Crime density at the midpoint of the edge (KDE interpolation)
      const midLat = (fromNode.lat + toNode.lat) / 2;
      const midLng = (fromNode.lng + toNode.lng) / 2;
      const density = getDensityAtPoint(midLat, midLng, kdeGrid, kdeResolution);

      if (density > maxEdgeDensity) maxEdgeDensity = density;
      totalDensity += density;

      // Combined cost:
      // cost = distance * (1 + alpha * density^exponent) * prefMultiplier / comfort
      // Exponent is profile-controlled: higher = steeper non-linear avoidance
      // (non-linear response inspired by Levy et al. 2018)
      const crimePenalty = 1 + safetyAlpha * Math.pow(density, costExponent);
      const comfortFactor = Math.max(comfort, 0.1); // Avoid division by zero
      const cost = distM * crimePenalty * prefMultiplier / comfortFactor;

      const edgeData = {
        to: toId,
        cost,
        distance: distM,
        density,
        comfort,
        crimePenalty,
        wayId: way.id,
        wayName: props.name,
        highwayType: props.highwayType,
        isLit: props.isLit,
      };

      // Add edge in both directions (undirected graph for pedestrians)
      if (!adjacency.has(fromId)) adjacency.set(fromId, []);
      adjacency.get(fromId).push(edgeData);

      if (!props.isOneWay) {
        if (!adjacency.has(toId)) adjacency.set(toId, []);
        adjacency.get(toId).push({ ...edgeData, to: fromId });
      }

      edgeCount++;
    }
  }

  return {
    adjacency,
    nodeMap: nodes,
    edgeCount,
    stats: {
      totalNodes: adjacency.size,
      totalEdges: edgeCount,
      maxEdgeDensity,
      avgEdgeDensity: edgeCount > 0 ? totalDensity / edgeCount : 0,
      safetyAlpha,
    },
  };
}

// Standard Dijkstra over the safety-weighted graph. Returns the path, the
// edges along it, and a few aggregate stats. Null if there's no route.
export function dijkstra(adjacency, sourceId, targetId) {
  const dist = new Map();
  const prev = new Map();
  const prevEdge = new Map();
  const visited = new Set();

  // Min-heap priority queue
  const pq = new MinHeap();

  dist.set(sourceId, 0);
  pq.push({ node: sourceId, cost: 0 });

  while (pq.size() > 0) {
    const { node: u, cost: uCost } = pq.pop();

    if (visited.has(u)) continue;
    visited.add(u);

    if (u === targetId) break;

    const neighbours = adjacency.get(u);
    if (!neighbours) continue;

    for (const edge of neighbours) {
      if (visited.has(edge.to)) continue;

      const newCost = uCost + edge.cost;
      const currentCost = dist.get(edge.to);

      if (currentCost === undefined || newCost < currentCost) {
        dist.set(edge.to, newCost);
        prev.set(edge.to, u);
        prevEdge.set(edge.to, edge);
        pq.push({ node: edge.to, cost: newCost });
      }
    }
  }

  // Reconstruct path
  if (!prev.has(targetId) && sourceId !== targetId) return null;

  const path = [];
  const edges = [];
  let current = targetId;
  let totalDistance = 0;
  let totalDensity = 0;

  while (current !== sourceId) {
    path.unshift(current);
    const edge = prevEdge.get(current);
    if (edge) {
      edges.unshift(edge);
      totalDistance += edge.distance;
      totalDensity += edge.density;
    }
    current = prev.get(current);
    if (current === undefined) return null;
  }
  path.unshift(sourceId);

  return {
    path,
    edges,
    totalCost: dist.get(targetId) || 0,
    totalDistance,
    avgDensity: edges.length > 0 ? totalDensity / edges.length : 0,
  };
}

// A* with a haversine heuristic. Same return shape as dijkstra. Falls back to
// dijkstra if the target node has no coordinates (which would break the
// heuristic and turn A* into a worse Dijkstra anyway).
export function aStarSearch(adjacency, sourceId, targetId, nodeMap) {
  const targetNode = nodeMap.get(targetId);
  if (!targetNode) return dijkstra(adjacency, sourceId, targetId);

  const gScore = new Map();
  const fScore = new Map();
  const prev = new Map();
  const prevEdge = new Map();
  const visited = new Set();
  const pq = new MinHeap();

  gScore.set(sourceId, 0);
  const sourceNode = nodeMap.get(sourceId);
  const h0 = sourceNode ? haversineKm(sourceNode.lat, sourceNode.lng, targetNode.lat, targetNode.lng) * 1000 : 0;
  fScore.set(sourceId, h0);
  pq.push({ node: sourceId, cost: h0 });

  while (pq.size() > 0) {
    const { node: u } = pq.pop();

    if (visited.has(u)) continue;
    visited.add(u);

    if (u === targetId) break;

    const neighbours = adjacency.get(u);
    if (!neighbours) continue;

    for (const edge of neighbours) {
      if (visited.has(edge.to)) continue;

      const tentativeG = (gScore.get(u) || 0) + edge.cost;
      const currentG = gScore.get(edge.to);

      if (currentG === undefined || tentativeG < currentG) {
        gScore.set(edge.to, tentativeG);
        prev.set(edge.to, u);
        prevEdge.set(edge.to, edge);

        const toNode = nodeMap.get(edge.to);
        const h = toNode ? haversineKm(toNode.lat, toNode.lng, targetNode.lat, targetNode.lng) * 1000 : 0;
        const f = tentativeG + h;
        fScore.set(edge.to, f);
        pq.push({ node: edge.to, cost: f });
      }
    }
  }

  // Reconstruct path (same as dijkstra)
  if (!prev.has(targetId) && sourceId !== targetId) return null;

  const path = [];
  const edges = [];
  let current = targetId;
  let totalDistance = 0;
  let totalDensity = 0;

  while (current !== sourceId) {
    path.unshift(current);
    const edge = prevEdge.get(current);
    if (edge) {
      edges.unshift(edge);
      totalDistance += edge.distance;
      totalDensity += edge.density;
    }
    current = prev.get(current);
    if (current === undefined) return null;
  }
  path.unshift(sourceId);

  return {
    path,
    edges,
    totalCost: gScore.get(targetId) || 0,
    totalDistance,
    avgDensity: edges.length > 0 ? totalDensity / edges.length : 0,
  };
}

// Make a loop of roughly the requested distance by stitching together a few
// A* legs through waypoints arranged around the start. The seed perturbs the
// starting bearing so consecutive Regenerate clicks don't all return the
// same loop.
export function generateCircularRoute(graph, start, targetDistanceM, seed = 0) {
  const { adjacency, nodeMap } = graph;

  // Find nearest graph node to start
  const startNodeId = findNearestNode(nodeMap, start.lat, start.lng);
  if (!startNodeId) return null;

  // Generate waypoint candidates at different bearings
  const numWaypoints = targetDistanceM < 3000 ? 3 : 4;
  const waypointDistance = targetDistanceM / (2 * Math.PI) * 0.8; // Radius of the loop
  const baseAngle = (seed * 37) % 360; // Vary start angle with seed

  const candidates = [];
  const angleStep = 360 / 8; // 8 candidate directions

  for (let i = 0; i < 8; i++) {
    const bearing = (baseAngle + i * angleStep) % 360;
    const bearingRad = bearing * Math.PI / 180;
    const dLat = (waypointDistance / 1000 / 111) * Math.cos(bearingRad);
    const dLng = (waypointDistance / 1000 / (111 * Math.cos(start.lat * Math.PI / 180))) * Math.sin(bearingRad);

    const wpLat = start.lat + dLat;
    const wpLng = start.lng + dLng;
    const wpNodeId = findNearestNode(nodeMap, wpLat, wpLng);

    if (wpNodeId && wpNodeId !== startNodeId) {
      // Get safety score at this waypoint
      const wpNode = nodeMap.get(wpNodeId);
      candidates.push({
        nodeId: wpNodeId,
        lat: wpNode.lat,
        lng: wpNode.lng,
        bearing,
      });
    }
  }

  if (candidates.length < numWaypoints) {
    // Fallback: use whatever we have
    if (candidates.length < 2) return null;
  }

  // Try multiple waypoint combinations and pick the best route
  const combinations = selectWaypointCombinations(candidates, numWaypoints, 5);
  let bestRoute = null;
  let bestScore = -Infinity;

  for (const combo of combinations) {
    // Sort waypoints by bearing for clockwise traversal
    const sorted = [...combo].sort((a, b) => a.bearing - b.bearing);

    // Build the full loop: start -> wp1 -> wp2 -> ... -> start
    const segments = [];
    let totalDist = 0;
    let totalDensitySum = 0;
    let totalEdges = 0;
    let valid = true;

    const fullPath = [startNodeId];
    const points = [startNodeId, ...sorted.map(w => w.nodeId), startNodeId];

    for (let i = 0; i < points.length - 1; i++) {
      const seg = aStarSearch(adjacency, points[i], points[i + 1], nodeMap);
      if (!seg) { valid = false; break; }
      segments.push(seg);
      totalDist += seg.totalDistance;
      totalDensitySum += seg.avgDensity * seg.edges.length;
      totalEdges += seg.edges.length;
      // Avoid adding the first node of each segment (it's the last node of previous)
      fullPath.push(...seg.path.slice(1));
    }

    if (!valid) continue;

    const avgDensity = totalEdges > 0 ? totalDensitySum / totalEdges : 0;
    const distanceRatio = totalDist / targetDistanceM;

    // Score: penalise both deviation from target distance and high density
    let score = 100 * (1 - avgDensity);
    if (distanceRatio < 0.6 || distanceRatio > 1.5) score -= 30;
    else if (distanceRatio < 0.75 || distanceRatio > 1.35) score -= 15;
    else if (distanceRatio < 0.85 || distanceRatio > 1.2) score -= 5;

    if (score > bestScore) {
      bestScore = score;
      bestRoute = {
        path: fullPath,
        segments,
        totalDistance: totalDist,
        avgDensity,
        waypoints: sorted,
      };
    }
  }

  return bestRoute;
}

// Pick a few candidate waypoint sets that have decent angular spread, so the
// loops we try aren't all bunched on one side of the start.
function selectWaypointCombinations(candidates, numWaypoints, maxCombinations) {
  const n = Math.min(numWaypoints, candidates.length);
  const combos = [];

  // Strategy 1: Pick best angular distribution
  for (let startIdx = 0; startIdx < Math.min(candidates.length, maxCombinations); startIdx++) {
    const selected = [candidates[startIdx]];
    const remaining = candidates.filter((_, i) => i !== startIdx);

    while (selected.length < n && remaining.length > 0) {
      // Pick the candidate with the best minimum angular separation
      let bestIdx = -1;
      let bestMinAngle = -1;

      for (let i = 0; i < remaining.length; i++) {
        let minAngle = 360;
        for (const s of selected) {
          const diff = Math.abs(remaining[i].bearing - s.bearing);
          const normDiff = diff > 180 ? 360 - diff : diff;
          minAngle = Math.min(minAngle, normDiff);
        }
        if (minAngle > bestMinAngle) {
          bestMinAngle = minAngle;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        selected.push(remaining[bestIdx]);
        remaining.splice(bestIdx, 1);
      } else {
        break;
      }
    }

    if (selected.length >= 2) {
      combos.push(selected);
    }
  }

  return combos;
}

// Node Utilities

/**
 * Find the nearest graph node to a given lat/lng.
 */
export function findNearestNode(nodeMap, lat, lng) {
  let nearestId = null;
  let nearestDist = Infinity;

  for (const [id, node] of nodeMap) {
    const d = (node.lat - lat) ** 2 + (node.lng - lng) ** 2;
    if (d < nearestDist) {
      nearestDist = d;
      nearestId = id;
    }
  }

  return nearestId;
}

// Node IDs to [lng, lat] pairs. GeoJSON / Leaflet ordering.
export function pathToCoordinates(path, nodeMap) {
  return path
    .map((id) => {
      const node = nodeMap.get(id);
      return node ? [node.lng, node.lat] : null;
    })
    .filter(Boolean);
}

// Group consecutive edges by street name and roll up their stats. Used by
// the Segments tab in the insights panel.
export function analysePathSegments(edges, nodeMap) {
  if (!edges || edges.length === 0) return [];

  // Group edges by street name
  const segments = [];
  let currentSegment = null;

  for (const edge of edges) {
    const name = edge.wayName || 'Unnamed path';
    if (!currentSegment || currentSegment.name !== name) {
      if (currentSegment) segments.push(currentSegment);
      currentSegment = {
        name,
        highwayType: edge.highwayType,
        isLit: edge.isLit,
        distance: 0,
        totalDensity: 0,
        edgeCount: 0,
        maxDensity: 0,
        comfort: edge.comfort,
      };
    }
    currentSegment.distance += edge.distance;
    currentSegment.totalDensity += edge.density;
    currentSegment.edgeCount++;
    if (edge.density > currentSegment.maxDensity) {
      currentSegment.maxDensity = edge.density;
    }
  }
  if (currentSegment) segments.push(currentSegment);

  return segments.map((seg) => ({
    name: seg.name,
    highwayType: seg.highwayType,
    isLit: seg.isLit,
    distanceM: Math.round(seg.distance),
    avgDensity: seg.edgeCount > 0 ? seg.totalDensity / seg.edgeCount : 0,
    maxDensity: seg.maxDensity,
    comfort: seg.comfort,
    safetyScore: Math.round(Math.max(0, (1 - seg.totalDensity / seg.edgeCount) * 100)),
  }));
}

// Min-Heap (Priority Queue)

class MinHeap {
  constructor() {
    this.heap = [];
  }

  size() {
    return this.heap.length;
  }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].cost <= this.heap[i].cost) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].cost < this.heap[smallest].cost) smallest = left;
      if (right < n && this.heap[right].cost < this.heap[smallest].cost) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}
