/**
 * Tests for graphRouter.js
 *
 * Run with: node --test src/__tests__/graphRouter.test.js
 *
 * These tests build a small synthetic graph and confirm that Dijkstra
 * picks the cheapest path even when a longer-distance route has a much
 * lower crime weight.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dijkstra, findNearestNode, pathToCoordinates } from '../services/graphRouter.js';
import { haversineKm } from '../services/crimeAnalysis.js';

test('haversineKm gives ~0 km for identical points', () => {
  const d = haversineKm(51.5, -0.1, 51.5, -0.1);
  assert.ok(d < 0.0001, `expected ~0, got ${d}`);
});

test('haversineKm matches a known distance between two London points', () => {
  // Tower of London <-> St Paul's Cathedral, ~1.4 km in a straight line
  const towerLat = 51.5081, towerLng = -0.0759;
  const stPaulsLat = 51.5138, stPaulsLng = -0.0984;
  const d = haversineKm(towerLat, towerLng, stPaulsLat, stPaulsLng);
  assert.ok(d > 1.3 && d < 1.7, `expected ~1.4 km, got ${d}`);
});

test('findNearestNode picks the closest node from a small map', () => {
  const nodes = new Map([
    [1, { id: 1, lat: 51.50, lng: -0.10 }],
    [2, { id: 2, lat: 51.55, lng: -0.05 }],
    [3, { id: 3, lat: 51.60, lng: 0.00 }],
  ]);

  const id = findNearestNode(nodes, 51.501, -0.101);
  assert.equal(id, 1);
});

test('dijkstra finds the safest path even when it is longer in raw distance', () => {
  // Build a tiny adjacency map.
  // Direct edge A -> C is short but very high crime cost.
  // Detour A -> B -> C is longer but has a low crime cost, so the modified
  // Dijkstra should prefer the detour.
  const adjacency = new Map();
  adjacency.set('A', [
    { to: 'C', cost: 500, distance: 100, density: 0.9, comfort: 0.5 }, // direct, dangerous
    { to: 'B', cost: 60, distance: 60, density: 0.05, comfort: 0.9 },  // safe, cheap
  ]);
  adjacency.set('B', [
    { to: 'A', cost: 60, distance: 60, density: 0.05, comfort: 0.9 },
    { to: 'C', cost: 70, distance: 70, density: 0.05, comfort: 0.9 },  // safe, cheap
  ]);
  adjacency.set('C', [
    { to: 'A', cost: 500, distance: 100, density: 0.9, comfort: 0.5 },
    { to: 'B', cost: 70, distance: 70, density: 0.05, comfort: 0.9 },
  ]);

  const result = dijkstra(adjacency, 'A', 'C');
  assert.notEqual(result, null);
  assert.deepEqual(result.path, ['A', 'B', 'C']);
  assert.equal(result.totalCost, 130); // 60 + 70
  assert.equal(result.totalDistance, 130);
});

test('dijkstra returns null when there is no path', () => {
  const adjacency = new Map();
  adjacency.set('A', [{ to: 'B', cost: 1, distance: 1, density: 0, comfort: 1 }]);
  adjacency.set('B', []);
  adjacency.set('C', []); // disconnected

  const result = dijkstra(adjacency, 'A', 'C');
  assert.equal(result, null);
});

test('pathToCoordinates converts node ids to [lng, lat] pairs', () => {
  const nodeMap = new Map([
    ['n1', { lat: 51.50, lng: -0.10 }],
    ['n2', { lat: 51.51, lng: -0.11 }],
  ]);
  const coords = pathToCoordinates(['n1', 'n2'], nodeMap);
  assert.deepEqual(coords, [
    [-0.10, 51.50],
    [-0.11, 51.51],
  ]);
});
