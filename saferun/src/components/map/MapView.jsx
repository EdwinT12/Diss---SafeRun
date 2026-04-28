import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import StartMarker from './StartMarker';
import DestinationMarker from './DestinationMarker';
import RouteLayer from './RouteLayer';

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function LocateButton({ onLocate }) {
  const map = useMap();

  function handleLocate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.flyTo(latlng, 15);
        onLocate(latlng);
      },
      () => {
        alert('Could not get your location. Please enable location services.');
      }
    );
  }

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: 80 }}>
      <div className="leaflet-control">
        <button
          onClick={handleLocate}
          className="bg-white border-2 border-gray-300 rounded-lg w-10 h-10 flex items-center justify-center shadow-md hover:bg-gray-50 cursor-pointer"
          title="Use my location"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function FitPoints({ startPoint, destination }) {
  const map = useMap();
  const prevRef = useRef(null);

  useEffect(() => {
    const key = JSON.stringify({ startPoint, destination });
    if (key === prevRef.current) return;
    prevRef.current = key;

    if (startPoint && destination) {
      // Fit bounds to show both points
      const bounds = [
        [startPoint.lat, startPoint.lng],
        [destination.lat, destination.lng],
      ];
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (startPoint) {
      map.flyTo([startPoint.lat, startPoint.lng], 15);
    } else if (destination) {
      map.flyTo([destination.lat, destination.lng], 15);
    }
  }, [startPoint, destination, map]);

  return null;
}

function FitRouteBounds({ routeCoords }) {
  const map = useMap();
  const prevCoordsRef = useRef(null);

  useEffect(() => {
    if (routeCoords && routeCoords.length > 0 && routeCoords !== prevCoordsRef.current) {
      prevCoordsRef.current = routeCoords;
      const bounds = routeCoords.map((c) => [c[1], c[0]]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [routeCoords, map]);

  return null;
}

export default function MapView({
  startPoint,
  destination,
  onStartChange,
  onDestinationChange,
  routeGeoJSON,
  routeCoords,
  clickMode,
}) {
  function handleMapClick(latlng) {
    if (clickMode === 'destination' && onDestinationChange) {
      onDestinationChange(latlng);
    } else {
      onStartChange(latlng);
    }
  }

  return (
    <MapContainer
      center={[51.505, -0.09]}
      zoom={13}
      className="h-full w-full rounded-lg"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onMapClick={handleMapClick} />
      <LocateButton onLocate={onStartChange} />
      <FitPoints startPoint={startPoint} destination={destination} />
      {startPoint && (
        <StartMarker position={startPoint} onDragEnd={onStartChange} />
      )}
      {destination && (
        <DestinationMarker position={destination} onDragEnd={onDestinationChange} />
      )}
      {routeGeoJSON && <RouteLayer geoJSON={routeGeoJSON} />}
      {routeCoords && <FitRouteBounds routeCoords={routeCoords} />}
    </MapContainer>
  );
}
