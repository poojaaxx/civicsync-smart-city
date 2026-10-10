# CivicSync hackathon demonstration

[Download the MP4](CivicSync_Hackathon_Demo.mp4) for BITS AND BYTES 2026, IIITDM Kancheepuram.

Recorded from https://civicsync-smart-city.vercel.app/ on 2026-10-10 with real, separately authenticated Administrator, Department Officer and Citizen accounts. Duration: 179.98 seconds. Resolution: 1920x1080. Size: 3,062,958 bytes (2.92 MiB). H.264 MP4 with English explanatory captions; no audio narration.

| Time      | Actual application workflow                                                              |
| --------- | ---------------------------------------------------------------------------------------- |
| 0:00-0:20 | Introduction and city map                                                                |
| 0:20-0:45 | Administrator statistics and project statuses                                            |
| 0:45-1:35 | Saved overlapping excavation projects; Critical conflict and coordination recommendation |
| 1:35-2:00 | Officer progress update and saved coordination note                                      |
| 2:00-2:35 | Citizen complaint submission and persisted Under Review status after refresh             |
| 2:35-3:00 | Map, dashboard and conclusion with deployed URL                                          |

The footage consists of actual browser captures with captions and privacy masks. Login screens, credentials and account emails are excluded. Unrelated coordination cards are masked. The staff complaint list was not recorded. The visible complaint is nonpersonal test content. Sample geometry and projects are illustrative, not official municipal records. Data is refreshed explicitly; this video does not claim realtime subscriptions.

All four projects created across recording attempts were deleted afterward. Three clearly labeled test roads and the demonstration complaint remain in the database; the app has no deletion action for these records. All recording sessions were signed out. Earlier unsuccessful takes are not included.

Verification: `node scripts/verify-demo.mjs` checks duration/resolution and decodes eight review frames using installed Microsoft Edge. Set `CIVICSYNC_RECORDING_DIR` to a writable scratch folder, otherwise it uses ignored `demo/.work`. Review frames were visually inspected. See the root submission checklist for remaining deployment and security-verification items.
