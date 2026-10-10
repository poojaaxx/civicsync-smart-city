# Submission checklist

## Implemented and verified locally

- [x] React + TypeScript application with responsive navigation and distinct labeled demo roles.
- [x] Ten fictional projects and three deliberate initial conflicts across Coimbatore.
- [x] Live deterministic conflict detection, Haversine checks, verified segment matching, configurable window, explainable severity, notes and clearance history.
- [x] Project creation/editing, schedule updates, progress, status, delay explanations, deletion confirmation and public timelines.
- [x] Interactive map with real OpenStreetMap tiles and connected project records.
- [x] Citizen reporting, photograph persistence, tracking references and sequential status updates.
- [x] Dashboard metrics and charts derived from data.
- [x] Local data survives reload; storage failures preserve prior data.
- [x] TypeScript check, ESLint, 62 unit/integration tests (including PostgreSQL permissions) and production build executed successfully.
- [x] Five Playwright browser scenarios passed in Microsoft Edge: account entry and explicit demo isolation; full coordination/report workflow; real map/refresh/mobile; validation/role restrictions/photo/deletion; forced tile-failure fallback.
- [x] Desktop and mobile screenshots visually inspected; table overflow corrected.
- [x] No paid API or secrets required.
- [x] Vercel build configuration and SPA rewrites included.
- [x] README, architecture, and reproducible 3–4 minute demo script supplied.

## Before public submission — owner actions still needed

- [ ] Add actual team names, responsibilities, contact information, and repository license decision.
- [ ] Review the official event eligibility and AI-assistance disclosure requirements. The app is not an organizer-endorsed product.
- [ ] Commit and push the latest integration to the existing GitHub repository. Do not include dependencies, caches, private data, or secrets.
- [ ] Authenticate to Vercel and import the repository. Framework: Vite; build: `npm run build`; output: `dist`; set the two public Supabase variables for real accounts.
- [ ] Verify the public URL and a direct `/coordination` refresh. No public deployment URL has been verified in this workspace.
- [ ] Repeat the walkthrough on the deployed origin; its browser storage is separate from localhost.
- [ ] Record and review the 2–5 minute narrated demonstration using DEMO_SCRIPT.md. No finished narrated video is included.
- [ ] Submit the GitHub, verified deployment, and video links.

## Demo readiness

- [ ] Reset only the demo storage key in a disposable browser profile; initial totals should be 10 projects and 3 conflicts.
- [ ] Keep the window at 7 days. Create Judge demo cable works on Avinashi Road, October 16–19, 2026; expect 2 new alerts.
- [ ] Shift that new project to November 15–19, 2026; expect both new alerts to clear.
- [ ] Submit a citizen issue, retain the generated reference, update through all statuses, and track again.
- [ ] Say explicitly that records are fictional, roles are demo access, and reports are local—not delivered to a municipality.

## Production work beyond this demo

- [x] Authenticated backend integration and assignment-based server authorization implemented; owner activation remains required.
- [ ] Authoritative road/GIS data and field validation.
- [ ] Private attachment storage, retention policy, accessibility audit and operational monitoring.
- [ ] Capacity planning and indexed conflict computation for large datasets.
