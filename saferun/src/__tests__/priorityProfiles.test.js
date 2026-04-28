/**
 * Tests for priorityProfiles.js
 *
 * Confirms that switching priority mode actually changes algorithm
 * parameters in the way the design promises (more data, wider KDE,
 * stronger crime penalty for "Maximum Safety", etc.).
 *
 * Run with: node --test src/__tests__/priorityProfiles.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getPriorityProfile,
  getPriorityExplanation,
} from '../services/priorityProfiles.js';

test('Maximum Safety pulls more months and uses a wider bandwidth than Distance Focused', () => {
  const max = getPriorityProfile('maximum_safety');
  const dist = getPriorityProfile('efficiency_focused');

  assert.ok(max.monthsToFetch > dist.monthsToFetch);
  assert.ok(max.kdeBandwidthScale > dist.kdeBandwidthScale);
});

test('Maximum Safety applies a far stronger crime penalty than Distance Focused', () => {
  const max = getPriorityProfile('maximum_safety');
  const dist = getPriorityProfile('efficiency_focused');

  assert.ok(max.safetyAlpha > dist.safetyAlpha);
  assert.ok(max.costExponent > dist.costExponent);
});

test('distanceTolerance is wider for Maximum Safety than Distance Focused', () => {
  const max = getPriorityProfile('maximum_safety');
  const dist = getPriorityProfile('efficiency_focused');

  const maxRange = max.distanceTolerance.max - max.distanceTolerance.min;
  const distRange = dist.distanceTolerance.max - dist.distanceTolerance.min;
  assert.ok(maxRange > distRange);
});

test('Each profile carries a non-empty explanation list for the UI', () => {
  for (const mode of ['maximum_safety', 'balanced', 'efficiency_focused']) {
    const lines = getPriorityExplanation(mode);
    assert.ok(Array.isArray(lines));
    assert.ok(lines.length >= 5, `${mode} explanation too short: ${lines.length}`);
  }
});

test('Unknown priority falls back to balanced rather than throwing', () => {
  const fallback = getPriorityProfile('not-a-real-mode');
  const balanced = getPriorityProfile('balanced');
  assert.equal(fallback.label, balanced.label);
});

test('Ensemble weight overrides sum to roughly 1 for each profile', () => {
  for (const mode of ['maximum_safety', 'balanced', 'efficiency_focused']) {
    const profile = getPriorityProfile(mode);
    const total = Object.values(profile.ensembleWeightOverrides)
      .reduce((sum, w) => sum + w, 0);
    assert.ok(Math.abs(total - 1) < 0.05, `${mode} ensemble weights sum=${total}`);
  }
});
