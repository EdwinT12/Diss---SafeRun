import { useState } from 'react';

const SAFETY_OPTIONS = [
  {
    value: 'maximum_safety',
    label: 'Maximum Safety',
    desc: '9 months data, wider KDE, 300m hotspot buffer, aggressive crime avoidance',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    desc: '6 months data, standard KDE, balanced distance vs safety trade-off',
  },
  {
    value: 'efficiency_focused',
    label: 'Distance Focused',
    desc: '3 months recent data, precise avoidance of worst areas only',
  },
  {
    value: 'shortest_path',
    label: 'Baseline (Shortest Path)',
    desc: 'No safety weighting. Pure shortest path. Use for evaluation comparison only.',
  },
];

export default function RouteForm({
  startPoint,
  destination,
  onGenerate,
  onRegenerate,
  hasRoute,
  loading,
  preferences,
  onPreferencesChange,
  routeType,
  onRouteTypeChange,
  onSetDestinationMode,
  isSettingDestination,
  onStartFromPostcode,
  onDestinationFromPostcode,
  onUseMyLocation,
}) {
  const [distance, setDistance] = useState(preferences?.max_distance_km || 5);
  const [safetyPriority, setSafetyPriority] = useState(preferences?.safety_priority || 'balanced');
  const [preferLitAreas, setPreferLitAreas] = useState(preferences?.prefer_lit_areas ?? true);
  const [avoidParks, setAvoidParks] = useState(preferences?.avoid_parks ?? false);
  const [avoidNarrowPaths, setAvoidNarrowPaths] = useState(preferences?.avoid_narrow_paths ?? false);
  const [startPostcode, setStartPostcode] = useState('');
  const [destPostcode, setDestPostcode] = useState('');
  const [postcodeLoading, setPostcodeLoading] = useState(null);
  const [postcodeError, setPostcodeError] = useState('');

  function buildPrefs() {
    return {
      max_distance_km: distance,
      safety_priority: safetyPriority,
      prefer_lit_areas: preferLitAreas,
      avoid_parks: avoidParks,
      avoid_narrow_paths: avoidNarrowPaths,
    };
  }

  function handleGenerate() {
    const prefs = buildPrefs();
    onPreferencesChange?.(prefs);
    onGenerate(distance, prefs);
  }

  function handleRegenerate() {
    onRegenerate(distance, buildPrefs());
  }

  async function handlePostcodeLookup(postcode, type) {
    const trimmed = postcode.trim();
    if (!trimmed) return;
    setPostcodeError('');
    setPostcodeLoading(type);

    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.status !== 200 || !data.result) {
        setPostcodeError('Postcode not found. Please check and try again.');
        return;
      }
      const latlng = { lat: data.result.latitude, lng: data.result.longitude };
      if (type === 'start') {
        onStartFromPostcode(latlng);
        setStartPostcode('');
      } else {
        onDestinationFromPostcode(latlng);
        setDestPostcode('');
      }
    } catch {
      setPostcodeError('Could not look up postcode. Check your connection.');
    } finally {
      setPostcodeLoading(null);
    }
  }

  const isCircular = routeType === 'circular';

  return (
    <div className="space-y-6">
      {/* Route type selector */}
      <div>
        <label className="block text-xs font-semibold text-brand mb-2.5 uppercase tracking-wider">
          Route Type
        </label>
        <div className="grid grid-cols-2 gap-0 border border-border">
          <button
            type="button"
            onClick={() => onRouteTypeChange('circular')}
            className={`py-2.5 text-sm font-semibold transition-all duration-200 ${
              isCircular
                ? 'bg-brand text-white'
                : 'bg-white text-text-secondary hover:bg-brand/[0.04]'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Loop
            </span>
          </button>
          <button
            type="button"
            onClick={() => onRouteTypeChange('point-to-point')}
            className={`py-2.5 text-sm font-semibold transition-all duration-200 ${
              !isCircular
                ? 'bg-brand text-white'
                : 'bg-white text-text-secondary hover:bg-brand/[0.04]'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              A to B
            </span>
          </button>
        </div>
      </div>

      {/* Start point */}
      <div>
        <label className="block text-xs font-semibold text-brand mb-1.5 uppercase tracking-wider">
          Start Point
        </label>
        {startPoint ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary font-mono">
              {startPoint.lat.toFixed(5)}, {startPoint.lng.toFixed(5)}
            </p>
            <button
              type="button"
              onClick={() => onUseMyLocation?.('start')}
              className="text-xs text-brand font-semibold hover:underline"
            >
              Relocate
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Enter postcode (e.g. SW1A 1AA)"
                value={startPostcode}
                onChange={(e) => setStartPostcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePostcodeLookup(startPostcode, 'start')}
                className="flex-1 px-3 py-2 text-sm border border-border focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handlePostcodeLookup(startPostcode, 'start')}
                disabled={postcodeLoading === 'start' || !startPostcode.trim()}
                className="px-3 py-2 text-xs font-semibold bg-brand text-white hover:bg-brand/90 disabled:opacity-40 transition-colors"
              >
                {postcodeLoading === 'start' ? '...' : 'Go'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUseMyLocation?.('start')}
                className="flex items-center gap-1.5 text-xs text-brand font-semibold hover:underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Use my location
              </button>
              <span className="text-[10px] text-text-muted">or click the map</span>
            </div>
          </div>
        )}
      </div>

      {/* Destination (for point-to-point) */}
      {!isCircular && (
        <div>
          <label className="block text-xs font-semibold text-brand mb-1.5 uppercase tracking-wider">
            Destination
          </label>
          {destination ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary font-mono">
                {destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}
              </p>
              <button
                type="button"
                onClick={onSetDestinationMode}
                className="text-xs text-brand font-semibold hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Enter postcode (e.g. E1 6AN)"
                  value={destPostcode}
                  onChange={(e) => setDestPostcode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePostcodeLookup(destPostcode, 'destination')}
                  className="flex-1 px-3 py-2 text-sm border border-border focus:border-brand focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handlePostcodeLookup(destPostcode, 'destination')}
                  disabled={postcodeLoading === 'destination' || !destPostcode.trim()}
                  className="px-3 py-2 text-xs font-semibold bg-brand text-white hover:bg-brand/90 disabled:opacity-40 transition-colors"
                >
                  {postcodeLoading === 'destination' ? '...' : 'Go'}
                </button>
              </div>
              <button
                type="button"
                onClick={onSetDestinationMode}
                className={`w-full py-2 text-xs border transition-all duration-200 ${
                  isSettingDestination
                    ? 'border-accent bg-accent/10 text-accent font-semibold'
                    : 'border-border text-text-muted hover:border-brand hover:text-brand'
                }`}
              >
                {isSettingDestination ? 'Click on the map...' : 'Or click on the map'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Postcode error */}
      {postcodeError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">
          {postcodeError}
        </div>
      )}

      {/* Distance (for circular routes) */}
      {isCircular && (
        <div>
          <label className="block text-xs font-semibold text-brand mb-3 uppercase tracking-wider">
            Distance - {distance} km
          </label>
          <input
            type="range"
            min="1"
            max="15"
            step="0.5"
            value={distance}
            onChange={(e) => setDistance(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-text-muted mt-1.5 font-medium">
            <span>1 km</span>
            <span>15 km</span>
          </div>
        </div>
      )}

      {/* Safety priority */}
      <div>
        <label className="block text-xs font-semibold text-brand mb-2.5 uppercase tracking-wider">
          Safety Priority
        </label>
        <div className="space-y-1.5">
          {SAFETY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSafetyPriority(opt.value)}
              className={`w-full flex items-center gap-3 p-3 border text-left transition-all duration-200 ${
                safetyPriority === opt.value
                  ? 'border-brand bg-brand/[0.03]'
                  : 'border-border hover:border-border-strong'
              }`}
            >
              <div className={`w-3.5 h-3.5 border-2 flex items-center justify-center shrink-0 ${
                safetyPriority === opt.value ? 'border-brand bg-brand' : 'border-gray-300'
              }`}>
                {safetyPriority === opt.value && (
                  <div className="w-1.5 h-1.5 bg-white" />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-brand leading-tight">{opt.label}</div>
                <div className="text-xs text-text-secondary mt-0.5">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div>
        <label className="block text-xs font-semibold text-brand mb-2.5 uppercase tracking-wider">
          Preferences
        </label>
        <div className="space-y-0 border border-border divide-y divide-border">
          <Toggle label="Prefer well-lit areas" checked={preferLitAreas} onChange={setPreferLitAreas} />
          <Toggle label="Avoid parks after dark" checked={avoidParks} onChange={setAvoidParks} />
          <Toggle label="Avoid narrow paths" checked={avoidNarrowPaths} onChange={setAvoidNarrowPaths} />
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!startPoint || loading || (!isCircular && !destination)}
          className="btn-primary w-full py-3.5 text-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white animate-spin" />
              Analysing area...
            </span>
          ) : (
            'Generate Safe Route'
          )}
        </button>

        {hasRoute && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={loading}
            className="btn-outline w-full py-3 text-sm"
          >
            Regenerate Route
          </button>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-3 cursor-pointer hover:bg-brand/[0.02] transition-colors duration-150"
      onClick={() => onChange(!checked)}
    >
      <span className="text-sm text-text-secondary">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
        className={`relative w-9 h-5 transition-colors duration-200 ${
          checked ? 'bg-brand' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
