import type { Database, Project, RoadSegment } from "./model";
export const roads: RoadSegment[] = [
  {
    id: "av-01",
    name: "Avinashi Road · Peelamedu",
    verified: true,
    isIllustrative: true,
    coordinates: [
      [11.025, 77.005],
      [11.027, 77.012],
    ],
  },
  {
    id: "tr-01",
    name: "Trichy Road · Ramanathapuram",
    verified: true,
    isIllustrative: true,
    coordinates: [
      [10.994, 76.995],
      [10.991, 77.003],
    ],
  },
  {
    id: "db-01",
    name: "D.B. Road · R.S. Puram",
    verified: true,
    isIllustrative: true,
    coordinates: [
      [11.008, 76.95],
      [11.014, 76.95],
    ],
  },
  {
    id: "mt-01",
    name: "Mettupalayam Road · Saibaba Colony",
    verified: true,
    isIllustrative: true,
    coordinates: [
      [11.04, 76.95],
      [11.046, 76.947],
    ],
  },
  {
    id: "ra-01",
    name: "Race Course Road",
    verified: true,
    isIllustrative: true,
    coordinates: [
      [10.999, 76.977],
      [11.003, 76.981],
    ],
  },
  {
    id: "sa-01",
    name: "Sathy Road · Ganapathy",
    verified: true,
    isIllustrative: true,
    coordinates: [
      [11.041, 76.986],
      [11.048, 76.99],
    ],
  },
];
export function seedDatabase(): Database {
  const specs = [
    [
      "Avinashi water main renewal",
      0,
      "Water Department",
      "Pipeline",
      "Ongoing",
      45,
      "2026-10-15",
      "2026-10-18",
      true,
    ],
    [
      "Peelamedu underground power link",
      0,
      "Electricity Department",
      "Underground cable",
      "Planned",
      0,
      "2026-10-17",
      "2026-10-20",
      true,
    ],
    [
      "Ramanathapuram stormwater upgrade",
      1,
      "Municipal Corporation",
      "Drainage",
      "Delayed",
      32,
      "2026-10-01",
      "2026-10-25",
      true,
    ],
    [
      "Trichy Road surface restoration",
      1,
      "Roads & Highways",
      "Road resurfacing",
      "Planned",
      0,
      "2026-10-20",
      "2026-10-30",
      false,
    ],
    [
      "R.S. Puram pedestrian corridor",
      2,
      "Municipal Corporation",
      "Footpath",
      "Ongoing",
      68,
      "2026-09-15",
      "2026-11-10",
      false,
    ],
    [
      "Saibaba Colony water connections",
      3,
      "Water Department",
      "Pipeline",
      "Planned",
      0,
      "2026-11-01",
      "2026-11-05",
      true,
    ],
    [
      "Mettupalayam cable protection",
      3,
      "Electricity Department",
      "Underground cable",
      "Planned",
      0,
      "2026-11-10",
      "2026-11-15",
      true,
    ],
    [
      "Race Course LED streetlights",
      4,
      "Electricity Department",
      "Street lighting",
      "Completed",
      100,
      "2026-08-01",
      "2026-09-15",
      false,
    ],
    [
      "Ganapathy junction improvement",
      5,
      "Roads & Highways",
      "Road resurfacing",
      "Ongoing",
      74,
      "2026-09-20",
      "2026-11-01",
      false,
    ],
    [
      "Race Course footpath renewal",
      4,
      "Municipal Corporation",
      "Footpath",
      "Planned",
      0,
      "2026-12-01",
      "2026-12-20",
      false,
    ],
  ] as const;
  const projects: Project[] = specs.map((s, i) => ({
    id: `CS-${String(i + 1).padStart(3, "0")}`,
    isIllustrative: true,
    name: s[0],
    roadId: roads[s[1]].id,
    roadName: roads[s[1]].name,
    lat: roads[s[1]].coordinates[0][0] + (i === 1 ? 0.0005 : 0),
    lng: roads[s[1]].coordinates[0][1],
    department: s[2],
    type: s[3],
    status: s[4],
    progress: s[5],
    start: s[6],
    end: s[7],
    excavation: s[8],
    contractor: `Illustrative Infrastructure ${(i % 3) + 1}`,
    authority: `Demo ${s[2]} Engineer`,
    description:
      "Illustrative public infrastructure work to improve safe, reliable city services. This is a fictional project for the CivicSync demonstration.",
    delayReason:
      s[4] === "Delayed"
        ? "Utility clearance pending; revised schedule under review."
        : "",
    updates: [
      {
        id: `u-${i}`,
        at: "2026-09-01T09:00:00Z",
        department: s[2],
        description:
          "Project announced in the illustrative city works register.",
      },
      ...(s[5] > 0
        ? [
            {
              id: `p-${i}`,
              at: "2026-10-01T09:00:00Z",
              department: s[2],
              description:
                s[4] === "Completed"
                  ? "Work completed and handed over."
                  : s[4] === "Delayed"
                    ? "Delay reported: utility clearance pending."
                    : `Work started; latest reported progress ${s[5]}%.`,
            },
          ]
        : []),
    ],
  }));
  return {
    version: 1,
    departments: [
      { id: "water", name: "Water Department" },
      { id: "electricity", name: "Electricity Department" },
      { id: "roads", name: "Roads & Highways" },
      { id: "municipal", name: "Municipal Corporation" },
    ],
    roads,
    projects,
    windowDays: 7,
    coordination: {},
    complaints: [
      {
        id: "REP-DEMO001",
        category: "Unsafe excavation",
        location: roads[1].name,
        projectId: "CS-003",
        description:
          "Illustrative report: temporary barriers need attention near the footpath.",
        status: "Under Review",
        createdAt: "2026-10-05T10:30:00Z",
        updates: [
          { at: "2026-10-05T10:30:00Z", status: "Submitted" },
          { at: "2026-10-06T08:00:00Z", status: "Under Review" },
        ],
      },
    ],
  };
}
