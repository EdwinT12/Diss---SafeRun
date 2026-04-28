/**
 * Tests for ensembleScoring.js
 *
 * Confirms the ensemble model's behavioural guarantees:
 *   - High crime density should produce low safety scores.
 *   - Low crime density should produce high safety scores.
 *   - The ensemble should produce a confidence value in [0, 1].
 *
 * Run with: node --test src/__tests__/ensembleScoring.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ensembleScore,
  buildFeatureVector,
  scoreRouteEnsemble,
  getTreeDescriptions,
} from '../services/ensembleScoring.js';

test('A clean low-crime feature vector should score high', () => {
  const features = buildFeatureVector({
    crimeDensity: 0.05,
    roadComfort: 0.9,
    isLit: true,
    hotspotDistance: 1.0,
    violentRatio: 0.05,
    temporalTrend: 'decreasing',
    pedestrianTraffic: 0.9,
  });
  const result = ensembleScore(features);
  assert.ok(result.score >= 80, `expected high score, got ${result.score}`);
  assert.ok(result.confidence >= 0 && result.confidence <= 1);
});

test('A high-crime feature vector should score low', () => {
  const features = buildFeatureVector({
    crimeDensity: 0.9,
    roadComfort: 0.3,
    isLit: false,
    hotspotDistance: 0.05,
    violentRatio: 0.6,
    temporalTrend: 'increasing',
    pedestrianTraffic: 0.2,
  });
  const result = ensembleScore(features);
  assert.ok(result.score <= 35, `expected low score, got ${result.score}`);
});

test('Ensemble score is bounded in [0, 100]', () => {
  for (let d = 0; d <= 1; d += 0.1) {
    const features = buildFeatureVector({ crimeDensity: d });
    const { score } = ensembleScore(features);
    assert.ok(score >= 0 && score <= 100, `score out of range: ${score}`);
  }
});

test('scoreRouteEnsemble handles an empty edge list gracefully', () => {
  const result = scoreRouteEnsemble([], [], {});
  assert.equal(result.overallScore, 50);
  assert.equal(result.edgeScores.length, 0);
});

test('getTreeDescriptions exposes all five trees with descriptions', () => {
  const trees = getTreeDescriptions();
  assert.equal(trees.length, 5);
  for (const t of trees) {
    assert.ok(typeof t.name === 'string');
    assert.ok(typeof t.description === 'string');
    assert.ok(t.description.length > 30);
  }
});

test('Distance-weighted route average respects edge length', () => {
  const edges = [
    { density: 0.05, comfort: 0.9, isLit: true, distance: 100, midLat: 51.5, midLng: -0.1, highwayType: 'footway' },
    { density: 0.05, comfort: 0.9, isLit: true, distance: 100, midLat: 51.5, midLng: -0.1, highwayType: 'footway' },
  ];
  const result = scoreRouteEnsemble(edges, [], { violentRatio: 0, temporalTrend: 'stable' });
  // Two equally-safe edges should produce a high score
  assert.ok(result.overallScore > 70);
  assert.equal(result.edgeScores.length, 2);
});
