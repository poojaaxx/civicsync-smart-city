# Visual asset provenance

Captured on 10 October 2026 from https://civicsync-smart-city.vercel.app/ using Playwright and Microsoft Edge. The owner signed in interactively as City Administrator, Department Officer and Citizen. Login screens were never captured; each session was signed out afterward. Screenshot capture performed no database mutations.

- `civicsync-dashboard.png`: hero copy of the actual administrator dashboard.
- `screenshots/`: eight real 1600 x 1100 viewport captures. The department officer sees the shared city dashboard; project editing remains department-scoped.
- `gifs/conflict-detection.gif`: 47-55 seconds of the existing final walkthrough.
- `gifs/citizen-reporting.gif`: 125-133 seconds of the same walkthrough.

GIFs are eight seconds, 1100 x 619, sampled at four frames per second with a shared 128-color palette. Identical frames may be merged while preserving duration. They sit inside collapsed sections to keep the README quiet. The map is shown as a readable static screenshot; its original video excerpt offered little useful motion. PNG optimization is lossless. No interface, project outcome or successful interaction was invented. The original MP4 was not re-encoded or changed.

Account identities are masked. Only the seeded illustrative project pair is shown in the conflict screenshot; unrelated cards and coordination notes are masked. The complaint screenshot shows the known nonpersonal demonstration report. No credentials, email addresses, developer tools or unrelated private complaints appear. All eight screenshots and representative frames from both excerpts were visually reviewed.

## Verification scope

The current unit/component/database suite passed 69 tests in 12 files. Five isolated browser tests, TypeScript checks and production build passed. Vite reported a bundle-size advisory. These browser tests use the local demo; production behavior shown in the MP4 has separate evidence in the root audit and submission checklist.

The full working-folder `npm run lint` encounters errors in untracked recording scratch files. Lint passes for the repository when excluding `demo/.work/**` and the pre-existing untracked `scripts/record-demo.mjs`; those files are not part of this publication. Changed Markdown is formatted with Prettier. No application, SQL, authentication or dependency-manifest changes are included.

The MP4 SHA-256 remains `15e29ce392ddac7dd657a086b25bde4fe5c6a5c95272448abd2715d116b91e6f`.
