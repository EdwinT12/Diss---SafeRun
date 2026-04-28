import { useState, useCallback, useRef } from 'react';
import MapView from '../components/map/MapView';
import RouteForm from '../components/route/RouteForm';
import RouteExplanation from '../components/route/RouteExplanation';
import RouteInsights from '../components/route/RouteInsights';
import RouteLoadingModal from '../components/route/RouteLoadingModal';
import PreferencesPanel from '../components/preferences/PreferencesPanel';
import { generateSafeRoute, saveRoute } from '../services/routeGenerator';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const [startPoint, setStartPoint] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const seedRef = useRef(0);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState(null);
  const [routeType, setRouteType] = useState('circular');
  const [clickMode, setClickMode] = useState('start');
  const mapRef = useRef(null);

  const handleStartChange = useCallback((latlng) => {
    setStartPoint(latlng);
    setRouteData(null);
    setError('');
  }, []);

  const handleDestinationChange = useCallback((latlng) => {
    setDestination(latlng);
    setClickMode('start');
    setRouteData(null);
    setError('');
  }, []);

  const handleRouteTypeChange = useCallback((type) => {
    setRouteType(type);
    setRouteData(null);
    setError('');
    if (type === 'circular') {
      setDestination(null);
      setClickMode('start');
    }
  }, []);

  // Postcode -> latlng for start point
  const handleStartFromPostcode = useCallback((latlng) => {
    setStartPoint(latlng);
    setRouteData(null);
    setError('');
  }, []);

  // Postcode -> latlng for destination
  const handleDestinationFromPostcode = useCallback((latlng) => {
    setDestination(latlng);
    setClickMode('start');
    setRouteData(null);
    setError('');
  }, []);

  // Use browser geolocation
  const handleUseMyLocation = useCallback((target) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (target === 'start') {
          setStartPoint(latlng);
        } else {
          setDestination(latlng);
          setClickMode('start');
        }
        setRouteData(null);
        setError('');
      },
      () => {
        setError('Could not get your location. Please enable location services or enter a postcode.');
      }
    );
  }, []);

  const handleProgress = useCallback((info) => {
    setPipelineProgress(info);
  }, []);

  async function handleGenerate(distance, prefs) {
    if (!startPoint) return;
    if (routeType === 'point-to-point' && !destination) return;
    setLoading(true);
    setError('');
    setPipelineProgress({ step: 1, detail: 'Initialising pipeline...' });
    seedRef.current = 0;

    try {
      const dest = routeType === 'point-to-point' ? destination : null;
      const result = await generateSafeRoute(startPoint, distance, prefs, seedRef.current, dest, handleProgress);
      setRouteData(result);
      setMobilePanel(true);
    } catch (err) {
      setError(err.message || 'Failed to generate route.');
    } finally {
      setLoading(false);
      setPipelineProgress(null);
    }
  }

  async function handleRegenerate(distance, prefs) {
    if (!startPoint) return;
    setLoading(true);
    setError('');
    setPipelineProgress({ step: 1, detail: 'Initialising pipeline...' });
    seedRef.current += 1;

    try {
      const dest = routeType === 'point-to-point' ? destination : null;
      const result = await generateSafeRoute(startPoint, distance, prefs, seedRef.current, dest, handleProgress);
      setRouteData(result);
    } catch (err) {
      setError(err.message || 'Failed to regenerate route.');
    } finally {
      setLoading(false);
      setPipelineProgress(null);
    }
  }

  async function handleSaveRoute() {
    if (!routeData || !user) return;
    setSaving(true);
    try {
      await saveRoute(user.id, routeData, startPoint, preferences);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setError('Failed to save route.');
    } finally {
      setSaving(false);
    }
  }

  function openInGoogleMaps(coords) {
    if (!coords || coords.length < 2) return;
    // Google Maps directions URL supports up to ~25 waypoints
    // Sample evenly along the route to preserve the exact path as closely as possible
    const maxWaypoints = 23; // Google allows origin + destination + ~23 waypoints
    const start = coords[0];
    const end = coords[coords.length - 1];

    let waypointCoords = [];
    if (coords.length > maxWaypoints + 2) {
      const step = (coords.length - 1) / (maxWaypoints + 1);
      for (let i = 1; i <= maxWaypoints; i++) {
        const idx = Math.round(step * i);
        if (idx > 0 && idx < coords.length - 1) {
          waypointCoords.push(coords[idx]);
        }
      }
    } else {
      waypointCoords = coords.slice(1, -1);
    }

    // coords are [lng, lat], Google Maps expects lat,lng
    const origin = `${start[1]},${start[0]}`;
    const dest = `${end[1]},${end[0]}`;
    const waypoints = waypointCoords.map((c) => `${c[1]},${c[0]}`).join('|');

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${encodeURIComponent(waypoints)}&travelmode=walking`;
    window.open(url, '_blank');
  }

  function exportGPX(coords, distanceKm) {
    if (!coords || coords.length < 2) return;
    const now = new Date().toISOString();
    const trackPoints = coords
      .map((c) => `      <trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>`)
      .join('\n');

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SafeRun"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>SafeRun Route, ${distanceKm} km</name>
    <time>${now}</time>
  </metadata>
  <trk>
    <name>SafeRun Safe Route</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saferun-route-${distanceKm}km.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sidebar = (
    <div className="space-y-6">
      <RouteForm
        startPoint={startPoint}
        destination={destination}
        onGenerate={handleGenerate}
        onRegenerate={handleRegenerate}
        hasRoute={!!routeData}
        loading={loading}
        preferences={preferences}
        onPreferencesChange={setPreferences}
        routeType={routeType}
        onRouteTypeChange={handleRouteTypeChange}
        onSetDestinationMode={() => setClickMode('destination')}
        isSettingDestination={clickMode === 'destination'}
        onStartFromPostcode={handleStartFromPostcode}
        onDestinationFromPostcode={handleDestinationFromPostcode}
        onUseMyLocation={handleUseMyLocation}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {routeData && (
        <>
          <div className="border-t border-border pt-5">
            <RouteExplanation routeData={routeData} />
          </div>

          {/* Algorithm badge */}
          {routeData.insights?.algorithm && (
            <div className="flex items-center gap-2 px-3 py-2 bg-brand/[0.03] border border-border text-xs">
              <span className="text-text-muted">Algorithm:</span>
              <span className="font-semibold text-brand">
                {routeData.insights.algorithm === 'graph-dijkstra'
                  ? 'Graph-based Dijkstra/A*'
                  : 'OSRM Pedestrian Router'}
              </span>
            </div>
          )}

          <button
            onClick={() => setShowInsights(true)}
            className="w-full py-2.5 text-sm font-semibold bg-brand/[0.04] border border-brand/20 text-brand hover:bg-brand hover:text-white transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Why this route?
          </button>
          <button
            onClick={handleSaveRoute}
            disabled={saving}
            className="btn-outline w-full py-2.5 text-sm"
          >
            {saving ? 'Saving...' : saveSuccess ? 'Route Saved' : 'Save Route'}
          </button>

          {/* Export / Navigate buttons */}
          <div className="space-y-2">
            <button
              onClick={() => exportGPX(routeData.routeCoords, routeData.distanceKm)}
              className="w-full py-2.5 text-sm font-semibold border border-brand/20 bg-brand/[0.04] text-brand hover:bg-brand hover:text-white transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export GPX (Exact Route)
            </button>
            <p className="text-[10px] text-text-muted text-center">
              Import into Strava, Komoot, Garmin or any running app
            </p>
            <button
              onClick={() => openInGoogleMaps(routeData.routeCoords)}
              className="w-full py-2 text-xs font-medium border border-border text-text-secondary hover:border-brand hover:text-brand transition-all duration-200 flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Open in Google Maps
            </button>
            <p className="text-[10px] text-text-muted text-center">
              Approximate, Google may recalculate parts of the route
            </p>
          </div>
        </>
      )}

      <PreferencesPanel onPreferencesLoaded={setPreferences} />
    </div>
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row">
      {/* Sidebar - desktop */}
      <div className="hidden md:block w-[380px] shrink-0 border-r border-border bg-white overflow-y-auto">
        <div className="p-5">{sidebar}</div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          ref={mapRef}
          startPoint={startPoint}
          destination={destination}
          onStartChange={handleStartChange}
          onDestinationChange={handleDestinationChange}
          routeGeoJSON={routeData?.geoJSON}
          routeCoords={routeData?.routeCoords}
          clickMode={clickMode}
        />

        {/* Click mode indicator */}
        {clickMode === 'destination' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-accent text-white px-4 py-2 text-sm font-semibold shadow-lg">
            Click on the map to set destination
          </div>
        )}

        {/* Mobile toggle */}
        <div className="md:hidden absolute bottom-5 left-4 right-4 z-[1000]">
          <button
            onClick={() => setMobilePanel(!mobilePanel)}
            className="btn-primary w-full py-3.5 text-sm shadow-lg"
          >
            {mobilePanel ? 'Show Map' : routeData ? 'View Route Details' : 'Route Options'}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobilePanel && (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-[1001] bg-white border-t border-border shadow-2xl max-h-[75vh] overflow-y-auto">
          <div className="flex justify-center py-2">
            <button
              onClick={() => setMobilePanel(false)}
              className="w-10 h-1 bg-gray-300 border-none"
            />
          </div>
          <div className="px-5 pb-8">{sidebar}</div>
        </div>
      )}

      {/* Route Insights modal */}
      {showInsights && routeData?.insights && (
        <RouteInsights insights={routeData.insights} onClose={() => setShowInsights(false)} />
      )}

      {/* Pipeline loading modal */}
      {pipelineProgress && (
        <RouteLoadingModal
          currentStep={pipelineProgress.step}
          detail={pipelineProgress.detail}
        />
      )}
    </div>
  );
}
