# CivicSync

**One City. One Map. Smarter Public Works.**

An operational public works coordination demo for **BITS AND BYTES 2026**, IIITDM Kancheepuram, CivicTech domain.

## Problem and solution

Official problem statement supplied in the project brief: **“Improving Transparency and Coordination in Public Works Projects.”**

Residents need visibility into construction, deadlines, and accountability. Departments need to detect overlapping excavation and avoid repeated disruption. CivicSync combines a city project register, interactive map, explainable scheduling engine, public timelines, and trackable citizen reports.

**All projects, contractors, road-segment verification, and complaints are illustrative. Nothing is submitted to a municipality.** Data persists in local browser storage on the same origin. This is not a shared government database or authenticated production service.

## Run locally

Requires Node.js 22.12+ (verified on Node 24) and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The first visit loads ten fictional Coimbatore projects, three deliberate conflicts, and one report. No API keys, paid APIs, or environment variables are required.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
npm run test:e2e
```

Browser tests use installed Microsoft Edge in headless mode. On other operating systems, install Playwright Chromium (`npx playwright install chromium`) and remove `channel: 'msedge'` from `playwright.config.ts`. The suite starts Vite automatically if needed. Screenshots are written to `test-results/`.

## Features

- Dashboard: computed project counts, active and delayed work, live conflicts, cleared alerts, citizen reports, department/status/activity/severity charts, recent updates, upcoming construction, and attention list.
- Interactive OpenStreetMap with stored project coordinates, illustrative road polylines, status colors, conflict markers, popups, and project detail links. Project lists remain usable when tiles are unavailable.
- Project creation, editing, schedule and progress changes, required delay reasons, deletion confirmation, filters, unique IDs, and chronological public history.
- Deterministic coordination checks with live previews, configurable 0/3/7/14/30-day windows, explanations, recommendations, notes, acknowledgments, and cleared history.
- Citizen project search, optional nearby search (approximately 5 km), complaints with image attachments, generated tracking references, and status history.
- Sequential complaint lifecycle: Submitted → Under Review → In Progress → Resolved.
- Demo roles: citizens browse/report/track; officers edit projects and coordinate/report updates; administrators additionally delete projects and access the full operations interface. These are interface permissions, **not security**.
- Responsive sidebar, keyboard focus, skip navigation, reduced-motion support, empty states, validation, error boundary, and explicit storage failure messages.
- JSON export from the dashboard for a portable project/report snapshot.

## Architecture and technologies

React + TypeScript + Vite; React Router for routes; Lucide React for icons; Recharts for charts; React Leaflet + Leaflet with OpenStreetMap tiles. Custom responsive CSS implements the design system (Tailwind is not used).

`src/model.ts` defines relationships; `seed.ts` provides fictional records; `engine.ts` holds pure coordination rules and validation; `repository.ts` provides the `DataRepository` boundary; `store.tsx` manages transactional saves and snapshots detected conflicts. Feature modules render dashboard, projects, coordination, and citizen workflows. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Conflict methodology

1. Validate strict ISO dates; exclude completed records and self-comparisons.
2. Match verified road segment IDs first. Different nonempty segment IDs never match through proximity.
3. Without authoritative IDs, matching normalized road names **and** Haversine distance ≤150 m produce only a Low location-review alert. Proximity alone proves nothing.
4. Compare inclusive dates. A shared endpoint is an overlap. Gap is the difference in UTC calendar days between the later start and earlier finish.
5. Critical: overlapping excavation by different departments on a verified segment. High: repeated excavation across departments within the coordination window, or potentially duplicate work types. Medium: other verified overlaps. Low: unverified location candidates.
6. One stable alert per pair, with an additional duplicate-work explanation if appropriate. Matching work types indicate potential duplication, not proven waste.
7. Recompute on edits and window changes. Manual resolution records an acknowledgment but keeps an active scheduling clash visible. Cleared records are previously captured alerts no longer meeting the rules. Clearance can follow schedule, completion, deletion, or rule changes; it is not proof of a physically completed joint plan.

A verified segment can match without coordinates. Unverified locations with missing/invalid coordinates do not match. Invalid scheduling inputs are rejected in the editor and ignored defensively by the engine. Runtime is O(n²), suitable for this demo portfolio.

## Persistence, environment and future Supabase adapter

The `civicsync-demo-v1` localStorage key holds versioned JSON. A failed storage write leaves the previous state intact. Photographs accept JPEG/PNG/WebP up to 1 MB and are stored as data URLs, subject to browser quotas. Avoid private or sensitive information.

`.env.example` documents that this release needs no variables. Adding Supabase credentials **does not enable a backend**. Before a shared production deployment, replace the repository boundary with async server operations, authenticated sessions, authoritative server validation, row-level policies for assigned departments and administrators, private object storage, migrations, and server-side role enforcement. Never place service-role credentials in `VITE_*` variables. The demo role switcher must not authorize production writes.

To reset the demo, use browser developer tools → Application → Local Storage → delete `civicsync-demo-v1`, then reload. Export first if data is needed. Different ports/domains use independent storage; clearing browser data removes the demo records. Reload reads persisted state; simultaneous tabs do not synchronize automatically.

## Deployment to Vercel

The production artifact is `dist/`. `vercel.json` includes SPA rewrites so detail pages work on refresh.

1. Push this folder to your GitHub repository (exclude node_modules, caches, test output, and secrets).
2. Sign into Vercel with your own account and select **Add New → Project → Import Git Repository**.
3. Select Vite; build command `npm run build`; output directory `dist`; use Node 22.12+ / 24. No environment variables are needed.
4. Deploy and open the resulting public URL.
5. Verify a direct `/coordination` load, map tiles, project creation and reload, then report submission and tracking on that same origin.

No public deployment is claimed. Account authentication and a verified public URL are still required. For Netlify use the same build/output settings plus an SPA redirect `/* /index.html 200` in its redirect configuration.

## Testing

Vitest tests cover schedule overlap, non-overlap, unrelated roads, repeated excavation, self-comparison, invalid dates, missing coordinates, severity, duplicate work, stable IDs, Haversine distance, validation, persistence, corrupt storage, quota errors, and citizen submission/tracking. React Testing Library exercises report interactions. Playwright covers project creation, automatic clashes, acknowledgment vs clearance, rescheduling, complaint status persistence, map loading, route refresh, and mobile layout/navigation.

See [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md) for executed checks and remaining submission steps. A build passing is not a claim of production-grade security or municipal integration.

## Suggested team responsibilities

Assign actual member names before submission; none are invented here.

- Platform/engine: data model, scheduling rules, backend roadmap.
- Frontend/UX: map, responsive screens, accessible workflows.
- Quality/deployment: test scenarios, deployment verification, demo reset.
- Product/presentation: problem framing, impact, video recording, submission.

See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for a reproducible 3–4 minute presentation.

## Limitations and future work

No real authentication, shared backend, municipality integration, notifications, measured cost savings, or engineering certification. Seed road geometry is approximate and illustrative, not cadastral/GIS authority data. Planned dates are a fixed October–December 2026 scenario; status is explicitly reported, not inferred from today. Monthly activity includes any project whose stored schedule intersects the month. Tile and optional font loading need internet; fallback fonts and project lists remain available. Local storage is not suitable for sensitive citizen data. The app is not an offline PWA. Production-scale spatial indexing, verified road geometry, multi-tab synchronization, audited workflow permissions, multilingual content, and accessible table alternatives for every chart are future improvements.

## Open-source and external services

React (MIT), Vite (MIT), TypeScript (Apache-2.0), React Router (MIT), Lucide (ISC), Recharts (MIT), Leaflet (BSD-2-Clause), React Leaflet (Hippocratic-2.1), Vitest (MIT), Testing Library (MIT), Playwright (Apache-2.0), ESLint (MIT). Check installed package licenses before redistribution. [OpenStreetMap](https://www.openstreetmap.org/copyright) data and attribution, public OSM tile service; [Google Fonts](https://fonts.google.com/) for DM Sans and Manrope with system fallbacks. Respect external service policies for production traffic.

Framework setup follows the official [Vite guide](https://vite.dev/guide/) and [React Leaflet documentation](https://react-leaflet.js.org/). This repository contains no generated proprietary media and no paid API requirement.

## Disclosure

This implementation was produced with AI coding assistance. Review the event's actual submission and AI-disclosure rules, add team attribution, and describe assistance honestly. No claim is made that the organizers have approved this implementation or its eligibility.
