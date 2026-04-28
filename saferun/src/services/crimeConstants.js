/**
 * Crime category weights and labels.
 *
 * Higher weight = more impact on safety score.
 * Violent and personal crimes weighted higher than property crimes.
 * Based on severity ranking from the Home Office Crime Severity Index.
 */

export const CRIME_WEIGHTS = {
  'violent-crime': 3.0,
  'robbery': 2.5,
  'possession-of-weapons': 2.5,
  'theft-from-the-person': 2.0,
  'public-order': 1.5,
  'anti-social-behaviour': 1.2,
  'criminal-damage-arson': 1.0,
  'other-crime': 1.0,
  'drugs': 0.8,
  'vehicle-crime': 0.5,
  'burglary': 0.5,
  'other-theft': 0.5,
  'shoplifting': 0.3,
  'bicycle-theft': 0.3,
};

export const CRIME_LABELS = {
  'violent-crime': 'Violent Crime',
  'robbery': 'Robbery',
  'possession-of-weapons': 'Weapons Possession',
  'theft-from-the-person': 'Theft from Person',
  'public-order': 'Public Order',
  'anti-social-behaviour': 'Anti-social Behaviour',
  'criminal-damage-arson': 'Criminal Damage / Arson',
  'other-crime': 'Other Crime',
  'drugs': 'Drugs',
  'vehicle-crime': 'Vehicle Crime',
  'burglary': 'Burglary',
  'other-theft': 'Other Theft',
  'shoplifting': 'Shoplifting',
  'bicycle-theft': 'Bicycle Theft',
};

export function getCrimeWeight(category) {
  return CRIME_WEIGHTS[category] || 1.0;
}
