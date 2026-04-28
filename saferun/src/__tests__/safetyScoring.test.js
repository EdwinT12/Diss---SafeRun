/**
 * Tests for safetyScoring.js
 *
 * Run with: node --test src/__tests__/safetyScoring.test.js
 *
 * Uses the built-in node:test runner that ships with Node 20+, so no
 * extra dependency installs are required to run the suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getSafetyLabel,
  buildCrimeBreakdown,
  scorePath,
  CRIME_WEIGHTS,
} from '../services/safetyScoring.js';
import { getCrimeWeight } from '../services/crimeConstants.js';

test('getSafetyLabel maps numeric scores to the right label', () => {
  assert.equal(getSafetyLabel(95), 'Excellent');
  assert.equal(getSafetyLabel(85), 'Excellent');
  assert.equal(getSafetyLabel(72), 'Very Good');
  assert.equal(getSafetyLabel(60), 'Good');
  assert.equal(getSafetyLabel(40), 'Fair');
  assert.equal(getSafetyLabel(0), 'Fair');
});

test('CRIME_WEIGHTS reflects the Home Office severity ordering', () => {
  // Violent and weapons crimes should outweigh property crimes
  assert.ok(CRIME_WEIGHTS['violent-crime'] > CRIME_WEIGHTS['burglary']);
  assert.ok(CRIME_WEIGHTS['robbery'] > CRIME_WEIGHTS['shoplifting']);
  assert.ok(CRIME_WEIGHTS['possession-of-weapons'] > CRIME_WEIGHTS['bicycle-theft']);
});

test('getCrimeWeight returns the default 1.0 for unknown categories', () => {
  assert.equal(getCrimeWeight('not-a-real-category'), 1.0);
  assert.equal(getCrimeWeight('violent-crime'), 3.0);
});

test('buildCrimeBreakdown aggregates and sorts categories by impact', () => {
  const sample = [
    { category: 'violent-crime' },
    { category: 'violent-crime' },
    { category: 'shoplifting' },
    { category: 'shoplifting' },
    { category: 'shoplifting' },
    { category: 'burglary' },
  ];

  const result = buildCrimeBreakdown(sample);

  assert.equal(result.total, 6);
  assert.equal(result.categories.length, 3);
  // Violent crime has weight 3.0 * 2 = 6 impact, which beats 3 * 0.3 = 0.9
  assert.equal(result.categories[0].category, 'violent-crime');
  assert.ok(result.categories[0].impact > result.categories[1].impact);
});

test('scorePath returns sensible defaults for an empty grid', () => {
  const route = [
    [-0.10, 51.50],
    [-0.11, 51.51],
  ];
  const grid = new Map(); // empty
  const { overallScore, segmentScores } = scorePath(route, grid);

  // With no grid coverage, the scorer falls back to a neutral 75
  assert.ok(overallScore > 0);
  assert.equal(segmentScores.length, route.length);
});

test('scorePath uses cell composite scores when the grid covers the route', () => {
  const route = [[-0.100, 51.500]];
  // Build a grid cell at the snapped key the scorer will look for
  const grid = new Map();
  grid.set('51.5000,-0.1000', {
    lat: 51.5,
    lng: -0.1,
    density: 0.1,
    crimeScore: 90,
    compositeScore: 90,
  });

  const { overallScore } = scorePath(route, grid);
  assert.ok(overallScore >= 80, `expected score >= 80, got ${overallScore}`);
});
