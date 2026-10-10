import { useEffect, useState } from "react";
import {
  MapContainer,
  useMap,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
} from "react-leaflet";
import { Link } from "react-router-dom";
import type { Project } from "./model";
import { useStore } from "./store";
export const colors: Record<string, string> = {
  Planned: "#7592b6",
  Ongoing: "#2979e8",
  Delayed: "#e7a128",
  Completed: "#19a58f",
};
function FitProjects({ projects }: { projects: Project[] }) {
  const map = useMap();
  const { data } = useStore();
  const bounds = JSON.stringify(
    projects.flatMap((p) => {
      const road = data.roads.find((r) => r.id === p.roadId);
      return [
        ...(road?.coordinates || []),
        ...(p.lat !== undefined && p.lng !== undefined ? [[p.lat, p.lng]] : []),
      ];
    }),
  );
  useEffect(() => {
    const points = JSON.parse(bounds);
    if (points.length)
      map.fitBounds(points, { padding: [28, 28], maxZoom: 15 });
  }, [map, bounds]);
  return null;
}
export function CityMap({
  projects,
  conflicted = [],
}: {
  projects: Project[];
  conflicted?: string[];
}) {
  const { data } = useStore();
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
        <FitProjects projects={projects} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setFailed(true) }}
        />
        {projects.map((p) => {
          const color = conflicted.includes(p.id)
            ? "#ed695f"
            : colors[p.status];
          const road = data.roads.find((r) => r.id === p.roadId);
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
                    {p.isIllustrative && <small> - Illustrative project</small>}
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
