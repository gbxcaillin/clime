# Clime task tracker

Static single-page tracker for Clime's recurring Ops, Compliance and Client Services tasks. Open `index.html` locally or host on GitHub Pages.

See `CLAUDE.md` for the spec, date rules, data model and roadmap.

## Sharing the tracker between people (GitHub storage)

Out of the box each browser keeps its own copy. To have one shared copy that everyone sees, the page can store its data as a JSON file in a GitHub repository. Every change becomes a commit, and the page checks for new commits on a timer (10 minutes by default), whenever you come back to the tab, and right after your own changes.

Setup, once per person:

1. Create a fine-grained personal access token at GitHub: Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token. Under Repository access choose only this repository. Under Repository permissions set Contents to Read and write. Pick an expiry you are comfortable with.
2. Open the tracker, click Set up under Shared storage in the left rail, enter the repository as `owner/name`, your name, and the token, then Save and connect.

Notes:

- The data lives on the `tracker-data` branch in `data/tracker.json` by default. Using a branch other than the Pages branch means data commits do not trigger a Pages rebuild each time.
- The branch and file are created automatically on the first connection.
- The token is stored only in that person's browser. Anyone holding a token can commit to the repository, so treat it like a password. Disconnect from the same dialog to remove it.
- If the repository is public, the data file (task names, who ticked what, adhoc notes) is public too. Use a private repository for real data. GitHub Pages on a private repository needs a paid GitHub plan; the alternative is for each person to open `index.html` from a local copy while still sharing data through the private repository.
- Concurrent edits are merged rather than overwritten. If two people change the same item at once, the last one to sync wins for that item only.
- The Activity tab lists recent commits to the data file. The Admin tab (password protected) shows a full changelog of who ticked, named, added, edited or removed what, and when, including the GitHub commits.
