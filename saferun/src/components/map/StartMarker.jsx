import { useMemo, useRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const startIcon = L.divIcon({
  html: `<div style="
    background-color: #10b981;
    width: 24px;
    height: 24px;
    border: 2px solid #112d3a;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  ">
    <div style="width: 8px; height: 8px; background: white;"></div>
  </div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function StartMarker({ position, onDragEnd }) {
  const markerRef = useRef(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          onDragEnd(marker.getLatLng());
        }
      },
    }),
    [onDragEnd]
  );

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lng]}
      icon={startIcon}
      draggable={true}
      eventHandlers={eventHandlers}
    >
      <Popup>
        <span className="text-xs font-semibold text-brand">Start point</span>
        <br />
        <span className="text-[10px] text-text-muted">Drag to reposition</span>
      </Popup>
    </Marker>
  );
}
