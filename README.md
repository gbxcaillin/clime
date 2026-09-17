# Clime task tracker

Static single-page tracker for Clime's recurring Ops, Compliance and Client Services tasks. Open `index.html` locally or host on GitHub Pages.

See `CLAUDE.md` for the spec, date rules, data model and roadmap.

## Sharing the tracker between people

Out of the box each browser keeps its own copy. To have one shared copy that everyone sees, connect the page to shared storage from **Set up** under Shared storage in the left rail. Two backends are supported:

- **Google Sheet (recommended).** The data lives in tabs of a Google Sheet. A small Apps Script attached to the sheet does the reading and writing, so users only need a team password, not a token. Setup for the sheet owner takes about five minutes and is described in [`sheets/README.md`](sheets/README.md). Each user then picks Google Sheet in Set up, pastes the web app URL, and enters the team password and their name.
- **GitHub repository (fallback).** The data lives in a JSON file on a branch of this repository and every change becomes a commit. Each user needs their own fine-grained personal access token. Steps below.

In both modes the page saves locally first, sends the change a couple of seconds later, checks for other people's changes about once a minute while the tab is open (a cheap version check), does a full sync on a timer (10 minutes by default), and also syncs when you return to the tab and when you press Sync now. Other people's changes normally show up within a minute. Concurrent edits are merged rather than overwritten; if two people change the same item at once, the last one to sync wins for that item only.

The Activity tab shows the recent changes (or commits, in GitHub mode). The Admin tab (password protected) shows the full changelog of who ticked, named, added, edited or removed what, and when, with a filter and CSV download.

### GitHub mode setup, once per person

1. Create a fine-grained personal access token at GitHub: Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token. Under Repository access choose only this repository. Under Repository permissions set Contents to Read and write. Pick an expiry you are comfortable with.
2. Open the tracker, click Set up, choose GitHub repository, enter the repository as `owner/name`, your name and the token, then Save and connect. Do this in every browser you use; the token is stored per browser.

Notes for GitHub mode:

- The data lives on the `tracker-data` branch in `data/tracker.json` by default. Using a branch other than the Pages branch means data commits do not trigger a Pages rebuild each time. The branch and file are created automatically on the first connection.
- The token is stored only in that person's browser. Anyone holding a token can commit to the repository, so treat it like a password. Disconnect from the same dialog to remove it.
- If the repository is public, the data file (task names, who ticked what, adhoc notes) is public too. Use a private repository for real data. GitHub Pages on a private repository needs a paid GitHub plan.
