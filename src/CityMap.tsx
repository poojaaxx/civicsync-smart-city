import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
} from "react-leaflet";
import { Link } from "react-router-dom";
import type { Project } from "./model";
import { roads } from "./seed";
export const colors: Record<string, string> = {
  Planned: "#7592b6",
  Ongoing: "#2979e8",
  Delayed: "#e7a128",
  Completed: "#19a58f",
};
export function CityMap({
  projects,
  conflicted = [],
}: {
  projects: Project[];
  conflicted?: string[];
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="map-wrap">
      {failed && (
        <div className="map-warning" role="status">
          Map tiles unavailable. Project markers and the project list remain
          accessible.
        </div>
      )}
      <MapContainer
        center={[11.018, 76.98]}
        zoom={13}
        scrollWheelZoom={false}
        className="city-map"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setFailed(true) }}
        />
        {projects.map((p) => {
          const color = conflicted.includes(p.id)
            ? "#ed695f"
            : colors[p.status];
          const road = roads.find((r) => r.id === p.roadId);
          return (
            <span key={p.id}>
              {road && (
                <Polyline
                  positions={road.coordinates}
                  pathOptions={{ color, weight: 5, opacity: 0.65 }}
                />
              )}
              {p.lat !== undefined && p.lng !== undefined && (
                <CircleMarker
                  center={[p.lat, p.lng]}
                  radius={9}
                  pathOptions={{
                    color: "white",
                    weight: 3,
                    fillColor: color,
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <strong>{p.name}</strong>
                    <p>
                      {p.department}
                      <br />
                      {p.status} · {p.progress}%<br />
                      {p.start} → {p.end}
                    </p>
                    <Link to={`/projects/${p.id}`}>
                      View project & timeline →
                    </Link>
                  </Popup>
                </CircleMarker>
              )}
            </span>
          );
        })}
      </MapContainer>
      <div className="map-legend">
        {Object.entries(colors).map(([s, c]) => (
          <span key={s}>
            <i style={{ background: c }} />
            {s}
          </span>
        ))}
        <span>
          <i style={{ background: "#ed695f" }} />
          Conflict
        </span>
      </div>
    </div>
  );
}
