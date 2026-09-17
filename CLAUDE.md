# Clime task tracker

Single-file static web app (`index.html`) that tracks recurring Ops, Compliance and Client Services tasks for Clime. Hosted on GitHub Pages. No build step, no dependencies beyond Google Fonts (IBM Plex Sans), which has a system fallback.

## What it does
- **Day tab**: checklist for the selected day. Shows scheduled (weekly / fortnightly / monthly) items, then daily items. Ticking a task prompts for the person's name ("Done by"), picked from the remembered people list or typed; the name can be changed later. An "Outstanding from earlier" group (unticked scheduled items from the previous 31 days) exists in code but is switched off via `SHOW_OUTSTANDING=false` at the user's request.
- **Month tab**: calendar grid showing scheduled items as chips (daily items deliberately not shown). Click a day to open it.
- **Adhoc log tab**: log occurrences of adhoc items (IDR, EDR, Breaches, Unlisted Transactions, Contributory Scheme Redemptions) with date and note; mark closed; delete.
- **Schedule tab**: reference table of every task by frequency and team, with accountable / responsible shown under each task when set.
- **Tasks tab**: users add their own tasks (name, description, team, frequency, day of week or day of month) and set an **Accountable** and **Responsible** person on any task. Every task, built-in or added, can be edited. Added tasks can be deleted; built-in tasks are "removed" (hidden) instead and can be restored, and edited built-in tasks can be reset to their standard definition. Added tasks flow into the Day, Month, Adhoc and Schedule views like built-in ones. A **People** list at the bottom shows every remembered name (from ticks and accountable / responsible) with the option to remove one from the pick list.
- **Activity tab**: recent changes from the shared changelog with a link to the Google Sheet and who last saved, or, in GitHub mode, recent commits to the data file (message, author, time, link).
- **Admin tab**: password gated (SHA-256 of the password is in `ADMIN_HASH`; the unlock is remembered per browser tab in sessionStorage). Shows the changelog: every tick, untick, "done by" name, task add / edit / delete / remove / restore / reset, adhoc add / close / delete, people-list removal and import, plus the GitHub commits, newest first, with a filter and CSV download. This is a deterrent, not security: the page source and the data file are readable by anyone with access to them.
- Left rail: selected date with prev/next/today, team filter toggles (persisted), progress for the day, **Shared storage** status with Sync now and Set up / Settings, export/import of state as JSON.

## Shared storage (Google Sheet, or GitHub as fallback)
The page can keep the shared sections of state in one place that everyone reads and writes. Two backends share one sync loop; `sync.mode` picks one.

- **sheet** (default): a Google Sheet with the Apps Script in `sheets/Code.gs` deployed as a web app (Execute as the owner, access Anyone) and a `TEAM_PASSWORD` script property. The page calls `GET ?action=version|state&key=` and `POST` (text/plain JSON, no preflight) `{ key, action:"put", baseVersion, updatedBy, message, data }`. The script keeps one tab per section (Ticks, Adhoc, Tasks with kind added/edited, Roles, Hidden, People, Log) plus Meta (version, updatedAt, updatedBy, message), rewrites all tabs on every put under a script lock, and answers `{ conflict:true }` when `baseVersion` is stale. Cells are text-formatted before writing so dates and ids stay verbatim; Date objects typed by hand are read back as yyyy-mm-dd; rows missing key fields are skipped. Setup steps for the sheet owner are in `sheets/README.md`. Updating the script means Deploy, Manage deployments, New version, so the URL stays the same.
- **github**: one JSON file on a branch of the repository via the REST Contents API with a per-user fine-grained token (Contents: read and write). Settings fields `owner`, `repo`, `branch` (default `tracker-data`), `path` (default `data/tracker.json`), `token`.

Settings live in `localStorage` under `clime-sync-v1` (`mode`, `url`, `key`, the GitHub fields, `name`, `minutes`); a saved config without `mode` is treated as github if it has a token. The last copy known to be stored is kept under `clime-sync-base-v1` as `{ ver, data }` (`ver` is the sheet version number or the GitHub blob sha).

`runSync()` is backend-agnostic: `remoteGet(conditional)` returns `{ notModified } | { found:false } | { found, ver, data }` (sheet: a `version` call first when nothing changed locally; GitHub: `If-None-Match` with the last ETag, 304 is free of rate limits); three-way merge base / local / remote per section (`mergeMaps` for keyed objects, `mergeById` for `custom` by `id`, `adhoc` by `ts` and `log` by `id`, `mergeSets` for `hidden` and `people`; local edits win on the same key); `remotePut(merged, remote, ver)` saves only when the merged result differs from what is stored (compared with `canon()`, ignoring key order) and throws `{ conflict:true }` when someone else saved first, which schedules a retry; then the merged copy is adopted locally and stored as base. Triggers: `save()` schedules a sync 2.5 s after the last local change; a quick check every `CHECK_MS` (60 s) while the tab is visible; a full timer sync every `minutes`; tab becoming visible if the last sync is over a minute old; coming back online; Sync now; startup. `rerenderSafely()` postpones a re-render while someone is typing in a field; `flushRender()` runs it on focusout or within 2 s of the field going away. Team filters (`teams`) are never synced. Save messages are `<name>: <summary>` built by `describeChanges()`.

The Activity tab shows the shared changelog (sheet mode, with a link to the sheet and the last save) or the commit list (GitHub mode). In GitHub mode, using a non-Pages branch for the data file avoids a Pages rebuild per commit, and a public repository makes the data file public.

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
- Server-side merging inside the Apps Script (today the page merges and sends the whole state, which is fine for a small team)
- Notes per task per day
