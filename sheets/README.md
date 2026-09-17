# Shared storage in a Google Sheet

The tracker can keep everyone's data in one Google Sheet. Nobody needs a token or a GitHub account: a small Apps Script attached to the sheet reads and writes it on your behalf, and the page talks to that script. Users only enter a team password once.

## One-time setup (about five minutes, done by the sheet owner)

1. Create a blank Google Sheet. Name it something like "Clime task tracker data".
2. In the sheet open **Extensions > Apps Script**. Delete the sample code, paste the whole of `Code.gs` from this folder, and save (the disk icon or Ctrl+S).
3. Set the team password: in Apps Script open **Project Settings** (the gear icon), scroll to **Script Properties**, click **Add script property**, name `TEAM_PASSWORD`, value your chosen password, then **Save script properties**.
4. Optional but recommended: back in the editor pick the `setup` function in the toolbar dropdown and click **Run**. Approve the permission prompt (the script only touches this sheet). This creates the tabs and confirms the password is set.
5. Click **Deploy > New deployment**. Choose type **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
6. Open the tracker, click **Set up** under Shared storage in the left rail, choose **Google Sheet**, paste the URL, enter the team password and your name, and click **Save and connect**.

Give the other people the tracker link and the team password. Each of them does step 6 in their own browser.

## Updating the script later

If `Code.gs` changes, paste the new version into Apps Script, then **Deploy > Manage deployments**, edit the existing deployment, choose **New version**, and **Deploy**. Keeping the same deployment keeps the same URL, so nobody has to reconnect.

## How it behaves

- Every change made in the tracker is saved locally first, then sent to the sheet a couple of seconds later.
- While the tab is visible the page asks the sheet about once a minute whether anything changed, and pulls when it has. It also syncs when you return to the tab, after your own changes, and when you press **Sync now**.
- Two people changing things at the same time are merged, not overwritten. If a save lands on a version someone else has just replaced, the page re-reads, merges and saves again.
- The tabs (Ticks, Adhoc, Tasks, Roles, Hidden, People, Log, Meta) are plain data and can be read, filtered or corrected by hand. Rows that do not make sense are skipped rather than breaking the page.
- Hand edits reach the connected browsers. Editing a value bumps the version (the script's `onEdit` runs on any hand edit), and adding or deleting rows changes the row counts the page also checks, so either is picked up by the next once-a-minute check. A value edit made while `onEdit` could not run (for example a paste that Sheets treats as a bulk change) is still picked up by Sync now, the full sync timer, and the next save from any browser. Optional: add an installable trigger for `onChange` (Triggers, Add trigger, function `onChange`, event source From spreadsheet, event type On change) to also bump the version on structural changes.
- The whole set of tabs is rewritten on every save from the page. A hand edit made in the few seconds between a browser reading the sheet and saving back can be overwritten, so avoid editing the sheet while people are actively ticking.
- The sheet's own **File > Version history** keeps a full history of the data over time. The tracker's Admin tab shows the changelog of who ticked, added, edited or removed what.

## Security notes

- The web app must be deployed with access set to **Anyone** so that a static page can reach it. The team password is what keeps others out. Change it by editing the script property; everyone then re-enters it in Settings.
- The password is stored in each user's browser. It is compared inside the script, so it does not appear in the page source.
- The script runs with the sheet owner's permission but can only reach the sheet it is attached to.
- Apps Script has daily quotas that are far above what a small team polling once a minute uses.
