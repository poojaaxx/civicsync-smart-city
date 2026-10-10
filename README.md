# CivicSync

**One City. One Map. Smarter Public Works.**

Public works coordination for **BITS AND BYTES 2026**, IIITDM Kancheepuram, CivicTech. Official problem statement supplied in the brief: **“Improving Transparency and Coordination in Public Works Projects.”**

CivicSync gives residents project visibility and report tracking, and helps departments detect overlapping excavation before schedules create repeated disruption.

## Account access

CivicSync now includes **Supabase email/password authentication and a shared PostgreSQL backend**. Start with [AUTH_SETUP.md](AUTH_SETUP.md) to activate it in your Supabase project. Hosted accounts and email delivery require that setup; no live tenant is preconfigured.

- Citizen signup with email confirmation, sign-in, sign-out and password reset.
- New accounts always start as Citizens. Signup metadata cannot assign privileges.
- Administrators assign officer departments and administrator access from the Accounts screen.
- Officers can edit only projects in their assigned department and manage linked reports.
- Citizens can read only their own reports. Knowing someone else's reference ID grants no access.
- Database RLS governs reads. Direct client writes are denied; authenticated transactional functions enforce mutations, validation and permissions.
- Shared changes persist across browsers and devices. Refresh data or reload to see another user's latest changes.

| Role               | Permissions                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Citizen            | Browse works, submit reports, track own reports                                                                               |
| Department Officer | Citizen abilities, edit assigned department projects, review coordination involving that department, update linked complaints |
| City Administrator | Manage all projects/reports, delete projects, change coordination window, assign account access                               |

The login screen is the default entry. Without Supabase configuration, account actions are disabled and **Explore local demo** is available explicitly. The demo is isolated browser-local sample data and does not create accounts. Once Supabase is configured, the demo role switcher is not available.

## Install and run

Node.js 22.12+ (verified on Node 24), npm:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. For real access, create an ignored `.env.local` using the configuration in AUTH_SETUP.md, enter your Supabase URL and **public publishable key**, run all SQL migrations, configure auth URLs, and restart Vite. See [AUTH_SETUP.md](AUTH_SETUP.md) for the exact steps, including bootstrapping your first administrator.

Never use service-role/secret keys or database passwords in frontend variables. A configuration guard rejects privileged keys before Vite builds a bundle. Passwords are handled by Supabase Auth, not stored by CivicSync.

## Features

- Computed operations dashboard: project/status/conflict/report counts, department and status charts, monthly schedule activity, severity, attention list, upcoming work, recent updates and JSON export.
- Interactive OpenStreetMap with stored project markers, stored road lines, status colors, conflict markers, popups and project detail links. Tile failure leaves the project list usable.
- Project CRUD, validation, dates, coordinates, department/contractor/authority, progress, delay reasons and append-only shared project history.
- Explainable conflict detection, live schedule previews, coordination notes, manual acknowledgments, configurable windows and cleared alert history.
- Citizen search, optional nearby search, report categories, photograph attachment, reference tracking and sequential lifecycle: Submitted → Under Review → In Progress → Resolved.
- Responsive layout, keyboard focus, skip navigation, reduced-motion support, loading/error/empty states and explicit failure feedback.

The optional sample portfolio contains ten fictional Coimbatore projects, three deliberate conflicts and one local demo report. Shared databases start empty; an administrator can explicitly import the fictional projects and illustrative road segments from Accounts. Projects and road geometry in the sample portfolio are not authoritative municipal records. Reports are not automatically transmitted to a municipality.

## Supabase and demonstration data

| Feature                                  | Connected mode                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Accounts and permissions                 | Supabase Auth and protected profiles                                                                     |
| Projects and public timelines            | PostgreSQL projects and project_updates; validated CRUD                                                  |
| Departments and road geometry            | PostgreSQL catalogs, with administrator add forms                                                        |
| Dashboard, map, filters and exports      | Derived from the authorized database snapshot                                                            |
| Citizen reports and tracking             | Owned database rows with protected photographs and server status history                                 |
| Coordination notes, reviews and settings | Database records; conflict detection remains the existing client-side engine using stored projects/roads |
| Optional fictional portfolio             | Explicit admin import; every sample project/road labeled illustrative                                    |
| Unconfigured local demo                  | Browser-only sample data, isolated from hosted accounts                                                  |

Map tiles come from OpenStreetMap, not Supabase. There is no automatic municipal feed or realtime subscription. Refresh data reloads other users' changes. See [AUTH_SETUP.md](AUTH_SETUP.md) for migration order, administrator bootstrap and hosted verification.

## Conflict methodology

The pure engine compares pairs of noncompleted projects with valid inclusive date ranges. Matching verified stored road-segment IDs are preferred. Different nonempty segment IDs do not match through proximity. Without IDs, matching normalized road names plus Haversine distance ≤150 m produce only an uncertain Low location-review alert.

- **Critical:** overlapping excavation by different departments on a matching verified segment.
- **High:** repeated cross-department excavation within the window, or potentially duplicate work types.
- **Medium:** other verified schedule overlaps.
- **Low:** uncertain location candidates.

The window supports 0/3/7/14/30 days. A shared endpoint counts as overlap. Each pair has a stable ID, explanation, evidence and recommendation. Matching work types suggest potential duplication, not proven waste. Invalid dates and self-comparisons are skipped defensively.

Manual resolution records an acknowledgment without suppressing detection. Previously captured alerts clear when current rules no longer detect them, including schedule, completion, deletion or window changes. This is not certification of engineering safety or completed joint work. Computation is O(n²), appropriate for this portfolio.

## Architecture and stack

React, TypeScript, Vite, React Router, Lucide, Recharts, Leaflet/React Leaflet, OpenStreetMap and custom responsive CSS. Supabase supplies Auth and PostgreSQL. Vitest/Testing Library test application behavior; PGlite executes the SQL migration and permission tests against embedded PostgreSQL; Playwright exercises browser workflows.

- `src/auth.tsx`, `supabase.ts`, `auth-config.ts`: account/session lifecycle and public configuration.
- `src/cloud.ts`: shared reads and record-level diff operations.
- `src/store.tsx`: asynchronous saves, conflict snapshots and refresh/error handling.
- `src/repository.ts`: isolated local demo persistence.
- `src/engine.ts`: pure conflict/validation logic.
- `supabase/migrations/`: schema, RLS and authenticated transactional write functions.
- Feature screens: dashboard, projects, map, coordination, citizens and Accounts.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the trust boundaries and mutation flow.

## Verification

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

Browser tests use installed Microsoft Edge and start an isolated Vite server on port 5180 with blank Supabase variables, so they do not use or mutate your configured project. On other systems, install Playwright Chromium and remove `channel: 'msedge'` from `playwright.config.ts`. To test an already-running preview, set `CIVICSYNC_TEST_URL` to its origin.

Tests cover conflict edge cases, persistence, citizen interactions, auth requests/errors, configuration guards, mutation diffs, PostgreSQL role escalation denial, RLS report privacy, department restrictions, status validation, stale writes and atomic rollback. Mocked auth form tests do **not** demonstrate live email delivery. Complete the two-account hosted checklist in AUTH_SETUP.md after configuring your tenant.

## Deployment

Vercel: import the existing GitHub repository; framework Vite; build `npm run build`; output `dist`; Node 22.12+ / 24. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel before rebuilding. `vercel.json` supports direct SPA route loads, including `/auth/reset`.

Configure Supabase redirect URLs for the deployed origin, verify email confirmation/reset and the two-account permission scenarios, then record the public URL. The production login is available at https://civicsync-smart-city.vercel.app/. See AUDIT_REPORT.md for checks actually performed and authenticated workflows still requiring verification.

## Limits and next steps

The shared database is functional once configured, but no external municipal integration, email notification workflow, realtime subscription, production GIS import or cost-savings measurement is implemented. Conflict computation still runs client-side from project records; database authorization does not depend on its alerts. The optional sample road catalog is illustrative; connected mode reads its catalog from Supabase.

Photographs are bounded data URLs inside RLS-protected report rows. This is suitable for modest initial usage; migrate to private object storage/signed URLs at scale. An atomic RLS-protected snapshot loads the full authorized portfolio without REST row-limit truncation; introduce pagination before large deployments. Local demo storage is separate per origin and is not synchronized with Supabase. SQL migrations and schema changes require trusted project administration. Configure SMTP, rate limits, HTTPS, retention, backups and operational monitoring before a public launch.

## Team and submission

Assign actual names to platform/engine, frontend/UX, quality/deployment and presentation responsibilities. No team identities are invented.

[DEMO_SCRIPT.md](DEMO_SCRIPT.md) provides a 3–4 minute walkthrough. [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md) tracks remaining setup, deployment and recording. A narrated demo video is not included.

This implementation uses AI coding assistance. Review the event's actual eligibility and disclosure rules and describe assistance honestly; organizer approval is not claimed.

## Libraries and external services

React, Vite, TypeScript, React Router, Lucide, Recharts, Leaflet, React Leaflet, Supabase JS, Vitest, Testing Library, PGlite, Playwright, ESLint and Prettier. Review installed package licenses before redistribution. [OpenStreetMap attribution](https://www.openstreetmap.org/copyright) is displayed on the map. Optional Google Fonts use system-font fallbacks. Respect map-tile and hosted-service policies and account limits.

References: [Vite](https://vite.dev/guide/), [React Leaflet](https://react-leaflet.js.org/), [Supabase authentication](https://supabase.com/docs/guides/auth/quickstarts/react), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Final audit

See [AUDIT_REPORT.md](AUDIT_REPORT.md) for PASS/FAIL/UNVERIFIED/PENDING evidence and the required additive authorization migration 003. The read-only production smoke check can be repeated with `node scripts/audit-production.mjs`; it does not sign in or create production records.
