import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSavedRoutes, deleteSavedRoute } from '../services/routeGenerator';
import { getSafetyLabel } from '../services/safetyScoring';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const routeStyle = { color: '#112d3a', weight: 3, opacity: 0.8 };

export default function HistoryPage() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(null);

  useEffect(() => {
    if (!user) return;
    loadRoutes();
  }, [user]);

  async function loadRoutes() {
    setLoading(true);
    try {
      const data = await getSavedRoutes(user.id);
      setRoutes(data);
    } catch (err) {
      console.error('Failed to load routes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(routeId) {
    if (!confirm('Delete this saved route?')) return;
    try {
      await deleteSavedRoute(routeId);
      setRoutes((prev) => prev.filter((r) => r.id !== routeId));
      if (selectedRoute?.id === routeId) setSelectedRoute(null);
    } catch (err) {
      console.error('Failed to delete route:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-5 h-5 border-2 border-brand/20 border-t-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent mb-2">Your routes</p>
      <h1 className="text-2xl font-bold text-brand mb-8">Route History</h1>

      {routes.length === 0 ? (
        <div className="border border-border bg-white p-16 text-center">
          <p className="text-text-secondary mb-1">No saved routes yet</p>
          <p className="text-text-muted text-sm">Generate a route from the Dashboard and save it.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            {routes.map((route) => (
              <div
                key={route.id}
                onClick={() => setSelectedRoute(route)}
                className={`p-4 border cursor-pointer transition-all duration-200 ${
                  selectedRoute?.id === route.id
                    ? 'border-brand bg-brand/[0.02]'
                    : 'border-border bg-white hover:border-border-strong'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-brand flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{Math.round(route.safety_score)}</span>
                    </div>
                    <span className="text-sm font-semibold text-brand">
                      {getSafetyLabel(route.safety_score)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(route.id); }}
                    className="text-text-muted hover:text-red-500 bg-transparent border-none p-1 transition-colors duration-200"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span>{route.distance_km} km</span>
                  <span>{new Date(route.created_at).toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            {selectedRoute ? (
              <div className="sticky top-20">
                <div className="h-80 border border-border overflow-hidden">
                  <MapContainer
                    key={selectedRoute.id}
                    center={[selectedRoute.start_lat, selectedRoute.start_lng]}
                    zoom={14}
                    className="h-full w-full"
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap'
                    />
                    {selectedRoute.route_geojson && (
                      <GeoJSON data={selectedRoute.route_geojson} style={routeStyle} />
                    )}
                  </MapContainer>
                </div>

                {selectedRoute.explanation?.segments && (
                  <div className="mt-4 border border-border bg-white p-4">
                    <h4 className="text-xs font-semibold text-brand uppercase tracking-wider mb-3">Highlights</h4>
                    <div className="space-y-2">
                      {selectedRoute.explanation.segments.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <div className="w-3 h-3 bg-accent/10 flex items-center justify-center shrink-0 mt-1">
                            <svg className="w-2 h-2 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-80 border border-border bg-white">
                <p className="text-text-muted text-sm">Select a route to preview</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
