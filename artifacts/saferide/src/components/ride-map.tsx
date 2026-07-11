import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = { lat: number; lng: number };
export type RiskPoint = MapPoint & {
  severity: "low" | "medium" | "high";
  label: string;
};

const riderIcon = L.divIcon({
  className: "",
  html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 0 8px rgba(34,197,94,.8)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitBounds({
  positions,
  riskPoints,
  fitAll,
}: {
  positions: MapPoint[];
  riskPoints: RiskPoint[];
  fitAll: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    const pts = [
      ...positions.map((p) => [p.lat, p.lng] as [number, number]),
      ...riskPoints.map((p) => [p.lat, p.lng] as [number, number]),
    ];
    if (pts.length < 2) return;
    if (fitAll || positions.length > 2) {
      map.fitBounds(pts, { padding: [28, 28] });
    }
  }, [map, positions, riskPoints, fitAll]);
  return null;
}

function Recenter({ current }: { current?: MapPoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (current?.lat != null) {
      map.panTo([current.lat, current.lng], { animate: true, duration: 0.4 });
    }
  }, [map, current?.lat, current?.lng]);
  return null;
}

export function RideMap({
  track = [],
  riskPoints = [],
  current,
  height = 240,
  fitAll = false,
}: {
  track?: MapPoint[];
  riskPoints?: RiskPoint[];
  current?: MapPoint | null;
  height?: number;
  fitAll?: boolean;
}) {
  const center = useMemo((): [number, number] => {
    if (current?.lat != null) return [current.lat, current.lng];
    if (track[0]) return [track[0].lat, track[0].lng];
    return [0.33, 32.58];
  }, [current, track]);

  const line = track.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <div className="rounded-xl overflow-hidden border border-card-border" style={{ height }}>
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {line.length > 1 && (
          <Polyline positions={line} pathOptions={{ color: "#16a34a", weight: 4 }} />
        )}
        {/* Soft risk heat under markers — readable “heatmap” without extra deps */}
        {riskPoints.map((p, i) => (
          <CircleMarker
            key={`heat-${p.lat}-${p.lng}-${i}`}
            center={[p.lat, p.lng]}
            radius={p.severity === "high" ? 28 : p.severity === "medium" ? 22 : 16}
            pathOptions={{
              stroke: false,
              fillColor: p.severity === "high" ? "#e74c3c" : p.severity === "medium" ? "#e67e22" : "#f1c40f",
              fillOpacity: 0.22,
            }}
          />
        ))}
        {riskPoints.map((p, i) => (
          <CircleMarker
            key={`${p.lat}-${p.lng}-${i}`}
            center={[p.lat, p.lng]}
            radius={p.severity === "high" ? 9 : 7}
            pathOptions={{
              color: p.severity === "high" ? "#c0392b" : "#d35400",
              fillColor: p.severity === "high" ? "#e74c3c" : "#e67e22",
              fillOpacity: 0.85,
            }}
          >
            <Popup>{p.label}</Popup>
          </CircleMarker>
        ))}
        {current?.lat != null && (
          <Marker position={[current.lat, current.lng]} icon={riderIcon} />
        )}
        <Recenter current={current} />
        <FitBounds positions={track} riskPoints={riskPoints} fitAll={fitAll} />
      </MapContainer>
    </div>
  );
}
