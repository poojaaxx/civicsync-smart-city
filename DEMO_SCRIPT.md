# CivicSync judge demo — 3 to 4 minutes

## Before recording

This script describes the explicit **local demo**. On the login screen click **Explore local demo** when Supabase is unconfigured. With Supabase configured, use separate real citizen/officer/admin accounts instead of the role switcher, and import illustrative projects from Accounts if needed. Follow AUTH_SETUP.md first.

- Run `npm ci` and `npm run dev`; open http://127.0.0.1:5173.
- Use a fresh browser profile or remove only the `civicsync-demo-v1` storage key and reload. Do not reset records you need without exporting first.
- Confirm City Administrator demo role and a 7-day window. Expect 10 projects and 3 seeded alerts.
- Check map tiles load; choose a 1440px-wide browser for the main demonstration.
- Have the dates below ready. This is a reproducible fixed-date scenario, not a live government feed.

## 0:00–0:25 — The problem

“Why is the same road dug up again a week after it was repaired? Often, the departments involved never saw each other's plans. Citizens see the disruption but cannot see the schedule or the accountable authority. CivicSync brings those plans into one shared view: One City. One Map. Smarter Public Works.”

Show the overview, computed KPIs, and map. Explain that all projects are illustrative and persistence is browser-local.

## 0:25–0:50 — Transparency on the map

Open City map. Find **Avinashi water main renewal**, click its marker, and open details. Show department, contractor, expected completion, and public timeline.

“The map is connected to stored project coordinates. Water work on this demo segment is scheduled for October 15–18, 2026. Now let's see what happens when another department proposes excavation here.”

## 0:50–1:35 — Create a real conflict

Create a project:

| Field                 | Value                                                    |
| --------------------- | -------------------------------------------------------- |
| Name                  | Judge demo cable works                                   |
| Department            | Electricity Department                                   |
| Work type             | Underground cable                                        |
| Contractor            | Demo contractor                                          |
| Responsible authority | Demo electricity engineer                                |
| Description           | Illustrative cable excavation for the judge walkthrough. |
| Road segment          | Avinashi Road · Peelamedu                                |
| Dates                 | 2026-10-16 through 2026-10-19                            |
| Excavation            | Checked                                                  |
| Status / progress     | Planned / 0                                              |

Point to **2 potential conflicts** in the live preview: the new record intersects both seeded Avinashi projects. Save, then open Coordination.

“The alert is computed from road identity and dates. Matching verified segments are strong evidence; nearby points alone are not. Each result shows why it was detected and what to do next.”

## 1:35–2:15 — Resolve the underlying schedule

Select an alert involving the new project. Add “Move cable work beyond the coordination window.” Mark manually resolved to show that **still detected** remains visible.

“An acknowledgment is not a scheduling fix.”

Edit **Judge demo cable works**, changing dates to **2026-11-15 through 2026-11-19**. The live preview now shows no conflicts. Save; return to Coordination. Active count returns from 5 to 3; Cleared shows 2.

“The conflict disappears because the plan changed—not because someone dismissed a notification. The project timeline preserves the schedule change.”

## 2:15–3:00 — Citizen accountability

Switch to Citizen role. Explore works, then submit a report:

- Category: Unsafe excavation.
- Location: Avinashi Road.
- Description: The trench needs barriers near the pedestrian crossing.
- Optional photograph: a nonsensitive JPEG, PNG, or WebP under 1 MB.

Copy the generated reference. Switch to City Administrator; open Citizen reports. Progress the new report through Under Review → In Progress → Resolved. Switch to Citizen and track the reference to show the updated result. Reload if time allows to prove persistence.

“Residents can follow an issue from submission to resolution. This demo saves locally; it does not send a complaint to the municipality.”

## 3:00–3:30 — Close with technical credibility

“CivicSync uses deterministic spatial and scheduling rules, not opaque AI. It ships with automated engine, persistence, and workflow tests, a responsive interface, and a deployable build. The next step is a shared authenticated backend, authoritative road data, and department ownership. The goal is simple: coordinate before excavation, and make public works understandable to the people affected.”

Show the documentation/testing checklist briefly. State actual team roles and verified deployment URL if available.

## Recording notes

Record a 3–4 minute screen capture with narration using your preferred screen recorder. Avoid private tabs, names, and account tokens. Review the video for readable text and audible narration; add its final link to the hackathon submission. A script is supplied here; no finished narrated video is claimed.
