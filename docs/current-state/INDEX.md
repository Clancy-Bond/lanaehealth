# Current state: index

This directory captures point-in-time snapshots of v2 surfaces produced by
the parallel section sessions. Each session writes one file under
`sessions/` and one or more files under `audits/` for the surface(s) it
owns.

## Convention

| Folder | What goes here |
|---|---|
| `sessions/` | Briefs and route-layout summaries. One file per surface. The first thing a follow-up session reads. |
| `audits/` | Detailed findings, state-coverage tables, visual deltas, and open questions. |
| `frames/` | Screen recordings sliced into per-second frames. Optional. Not all sessions produce these. |

`known-issues.md` is owned by the home / foundation session and lists
cross-cutting bugs (e.g., the dark-chrome lateral bleed). Section sessions
reference items by number rather than duplicating them.

## Surfaces with current entries

- Login / Auth -> [`sessions/login.md`](./sessions/login.md), [`audits/login.md`](./audits/login.md)

When other section sessions land they will add entries here.
