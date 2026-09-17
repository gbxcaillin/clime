# Clime task tracker

Single-file static web app (`index.html`) that tracks recurring Ops, Compliance and Client Services tasks for Clime. Hosted on GitHub Pages. No build step, no dependencies beyond Google Fonts (IBM Plex Sans), which has a system fallback.

## What it does
- **Day tab**: checklist for the selected day. Shows scheduled (weekly / fortnightly / monthly) items, then daily items, then an "Outstanding from earlier" group listing unticked scheduled items from the previous 31 days.
- **Month tab**: calendar grid showing scheduled items as chips (daily items deliberately not shown). Click a day to open it.
- **Adhoc log tab**: log occurrences of adhoc items (IDR, EDR, Breaches, Unlisted Transactions, Contributory Scheme Redemptions) with date and note; mark closed; delete.
- **Schedule tab**: reference table of every task by frequency and team.
- Left rail: selected date with prev/next/today, team filter toggles (persisted), progress for the day, export/import of state as JSON.

## Source of truth
`source/Clime_Task_Tracking_Calendar.xlsx` is the original spreadsheet. Task definitions live in the `TASKS` array in `index.html`; edit there to add or change tasks. Fields: `id`, `team` (ops | comp | cs), `freq` (daily | weekly | fortnightly | monthly | adhoc), `dow` for weekly (1 = Mon), `dom` for monthly (1 | 15 | 30), `name`, optional `desc`.

## Date rules (confirmed with the user)
- Daily tasks appear on weekdays only.
- 1st and 15th shift to the next business day if they fall on a weekend.
- 30th: if the 30th is a weekday, use it; if it is a weekend or the month has no 30th, use the last business day of the month (so a Saturday 30th resolves to Friday 29th, never into the next month).
- Fortnightly items are shown on the (shifted) 1st and 15th rather than on a rolling 14-day cycle.
- No public holiday handling yet. Candidate enhancement: bake in a Victorian public holiday list and treat those days like weekends.

## Persistence
`localStorage` under key `clime-tracker-v1`:
```json
{ "done": { "YYYY-MM-DD|taskId": 1 }, "adhoc": [ { "ts", "task", "date", "note", "closed" } ], "teams": { "ops": true, "comp": true, "cs": true } }
```
State is per browser. Export/import exists for handover. If shared team state is needed, a backend (or a hosted artifact with a DB) would replace this.

## Style notes
- Three team colours: Ops teal `--ops`, Compliance amber `--comp`, Client Services plum `--cs`, each with a `-bg` tint for chips.
- No em dashes in UI copy or comments (user preference). Use commas, periods or en dashes.
- Australian English spelling.

## Deploying
Push to a GitHub repo, enable Pages from the root of `main`. `index.html` is the entry point.

## Ideas not yet built
- Public holidays (VIC)
- Assignee per task / initials on tick
- Shared state via a small backend
- Notes per task per day
