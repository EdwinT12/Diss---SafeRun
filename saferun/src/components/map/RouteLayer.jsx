import { GeoJSON, CircleMarker, Tooltip } from 'react-leaflet';

const routeStyle = {
  color: '#112d3a',
  weight: 4,
  opacity: 0.85,
  lineCap: 'square',
  lineJoin: 'bevel',
};

export default function RouteLayer({ geoJSON }) {
  if (!geoJSON) return null;

  const coords = geoJSON.geometry?.coordinates || [];
  const startCoord = coords[0];
  const endCoord = coords[coords.length - 1];

  return (
    <>
      <GeoJSON
        key={JSON.stringify(geoJSON).slice(0, 100)}
        data={geoJSON}
        style={routeStyle}
      />

      {startCoord && (
        <CircleMarker
          center={[startCoord[1], startCoord[0]]}
          radius={7}
          pathOptions={{ color: '#112d3a', fillColor: '#10b981', fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            Start / Finish
          </Tooltip>
        </CircleMarker>
      )}

      {endCoord && startCoord &&
        (Math.abs(endCoord[0] - startCoord[0]) > 0.0001 ||
          Math.abs(endCoord[1] - startCoord[1]) > 0.0001) && (
          <CircleMarker
            center={[endCoord[1], endCoord[0]]}
            radius={7}
            pathOptions={{ color: '#112d3a', fillColor: '#112d3a', fillOpacity: 1, weight: 2 }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]}>
              End
            </Tooltip>
          </CircleMarker>
        )}
    </>
  );
}
