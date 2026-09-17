# Clime task tracker

Single-file static web app (`index.html`) that tracks recurring Ops, Compliance and Client Services tasks for Clime. Hosted on GitHub Pages. No build step, no dependencies beyond Google Fonts (IBM Plex Sans), which has a system fallback.

## What it does
- **Day tab**: checklist for the selected day. Shows scheduled (weekly / fortnightly / monthly) items, then daily items. Ticking a task prompts for the person's name ("Done by"), picked from the remembered people list or typed; the name can be changed later. An "Outstanding from earlier" group (unticked scheduled items from the previous 31 days) exists in code but is switched off via `SHOW_OUTSTANDING=false` at the user's request.
- **Month tab**: calendar grid showing scheduled items as chips (daily items deliberately not shown). Click a day to open it.
- **Adhoc log tab**: log occurrences of adhoc items (IDR, EDR, Breaches, Unlisted Transactions, Contributory Scheme Redemptions) with date and note; mark closed; delete.
- **Schedule tab**: reference table of every task by frequency and team, with accountable / responsible shown under each task when set.
- **Tasks tab**: users add their own tasks (name, description, team, frequency, day of week or day of month) and set an **Accountable** and **Responsible** person on any task. Every task, built-in or added, can be edited. Added tasks can be deleted; built-in tasks are "removed" (hidden) instead and can be restored, and edited built-in tasks can be reset to their standard definition. Added tasks flow into the Day, Month, Adhoc and Schedule views like built-in ones. A **People** list at the bottom shows every remembered name (from ticks and accountable / responsible) with the option to remove one from the pick list.
- **Activity tab**: recent commits to the shared data file on GitHub (message, author, time, link).
- **Admin tab**: password gated (SHA-256 of the password is in `ADMIN_HASH`; the unlock is remembered per browser tab in sessionStorage). Shows the changelog: every tick, untick, "done by" name, task add / edit / delete / remove / restore / reset, adhoc add / close / delete, people-list removal and import, plus the GitHub commits, newest first, with a filter and CSV download. This is a deterrent, not security: the page source and the data file are readable by anyone with access to them.
- Left rail: selected date with prev/next/today, team filter toggles (persisted), progress for the day, **Shared storage** status with Sync now and Set up / Settings, export/import of state as JSON.

## Shared storage (GitHub as the backend)
The page can keep the shared sections of state in one JSON file in a GitHub repository, written through the REST Contents API with a per-user fine-grained personal access token (Contents: read and write on that repository only). Settings live in `localStorage` under `clime-sync-v1` (`owner`, `repo`, `branch` default `tracker-data`, `path` default `data/tracker.json`, `token`, `name`, `minutes`). The last copy known to be on GitHub is kept under `clime-sync-base-v1` as `{ sha, data }`.

`runSync()` does everything: GET the file (404 means first run, which also creates the branch from the default branch), three-way merge base / local / remote per section (`mergeMaps` for keyed objects, `mergeById` for `custom` by `id`, `adhoc` by `ts` and `log` by `id`, `mergeSets` for `hidden` and `people`; local edits win on the same key), PUT a commit only when the merged result differs from what is on GitHub (compared with `canon()`, ignoring key order), then adopt the merged copy locally and store it as base. A 409 or 422 from the PUT means someone else committed first, so it re-runs. Triggers: `save()` schedules a sync 2.5 s after the last local change; a timer every `minutes`; tab becoming visible if the last sync is over a minute old; coming back online; Sync now; startup. `rerenderSafely()` postpones a re-render while someone is typing in a field. Team filters (`teams`) are never synced. Commit messages are `<name>: <summary>` built by `describeChanges()`.

Using a non-Pages branch for the data file avoids a Pages rebuild per data commit. A public repository makes the data file public.

## Source of truth
`source/Clime_Task_Tracking_Calendar.xlsx` is the original spreadsheet. Built-in task definitions live in the `TASKS` array in `index.html`; edit there to change the standard set. Fields: `id`, `team` (ops | comp | cs), `freq` (daily | weekly | fortnightly | monthly | adhoc), `dow` for weekly (1 = Mon), `dom` for monthly (1 | 15 | 30), `name`, optional `desc`. User-added tasks use the same shape, live in `state.custom`, and get ids prefixed `custom-`. Edits to built-in tasks are stored as full definitions in `state.overrides[id]` (dropped automatically if the edit matches the default again); removed built-ins are listed in `state.hidden`. Always read tasks through `allTasks()`, which applies overrides and hides removed tasks, never `TASKS` directly.

## Date rules (confirmed with the user)
- Daily tasks appear on weekdays only.
- 1st and 15th shift to the next business day if they fall on a weekend.
- 30th: if the 30th is a weekday, use it; if it is a weekend or the month has no 30th, use the last business day of the month (so a Saturday 30th resolves to Friday 29th, never into the next month).
- Fortnightly items are shown on the (shifted) 1st and 15th rather than on a rolling 14-day cycle.
- No public holiday handling yet. Candidate enhancement: bake in a Victorian public holiday list and treat those days like weekends.

## Persistence
`localStorage` under key `clime-tracker-v1`:
```json
{
  "done": { "YYYY-MM-DD|taskId": 1 | "Name of who did it" },
  "adhoc": [ { "ts", "task", "date", "note", "closed" } ],
  "teams": { "ops": true, "comp": true, "cs": true },
  "custom": [ { "id": "custom-…", "team", "freq", "dow"?, "dom"?, "name", "desc"? } ],
  "roles": { "taskId": { "a": "Accountable person", "r": "Responsible person" } },
  "overrides": { "builtinId": { "id", "team", "freq", "dow"?, "dom"?, "name", "desc"? } },
  "hidden": [ "builtinId" ],
  "people": [ "Name" ],
  "log": [ { "id", "t": "ISO time", "who", "ev", "what", "task"?, "date"? } ]
}
```
`log` is the changelog, appended by `logEvent()` before each `save()`, capped at `LOG_MAX` (3000) entries, and shared through GitHub like the rest. GitHub commits are not stored in it; the Admin view merges them in from the commits API at display time.
A `done` value of `1` means ticked with no name yet (older data); a string is the name of the person who ticked it. `isDone()` treats both as done, `doneBy()` returns the name or "". `rememberPerson()` adds a name to `people` (case-insensitive dedupe). `custom`, `roles`, `overrides`, `hidden` and `people` are optional so older exports still import. `fromStored()` normalises any stored or imported object. Deleting an added task also removes its ticks, roles and adhoc log entries; removing a built-in task keeps them so a restore is lossless.
State is per browser. Export/import exists for handover. If shared team state is needed, a backend (or a hosted artifact with a DB) would replace this.

## Style notes
- Three team colours: Ops teal `--ops`, Compliance amber `--comp`, Client Services plum `--cs`, each with a `-bg` tint for chips.
- No em dashes in UI copy or comments (user preference). Use commas, periods or en dashes.
- Australian English spelling.

## Deploying
Push to a GitHub repo, enable Pages from the root of `main`. `index.html` is the entry point.

## Ideas not yet built
- Public holidays (VIC)
- Bring back "Outstanding from earlier" (flip `SHOW_OUTSTANDING`) if wanted later
- A server-side proxy so people do not each need a GitHub token (today: GitHub is the backend, one token per person)
- Notes per task per day
