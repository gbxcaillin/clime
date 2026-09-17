/**
 * Clime task tracker: Google Sheet storage.
 *
 * Paste this into Extensions > Apps Script of a blank Google Sheet, set the TEAM_PASSWORD script property,
 * then Deploy > New deployment > Web app, "Execute as: Me", "Who has access: Anyone". Copy the web app URL
 * into the tracker's Settings (left rail, Set up). Full steps are in sheets/README.md.
 *
 * The tracker page calls this script with:
 *   GET  ?action=ping&key=...          -> { ok, version, stamp, updatedAt, updatedBy, sheetUrl }
 *   GET  ?action=version&key=...       -> same as ping (used for the once-a-minute check; stamp also
 *                                         reflects row counts, so rows deleted by hand are noticed)
 *   GET  ?action=state&key=...         -> { ok, version, updatedAt, updatedBy, sheetUrl, data: { ...tabs as JSON } }
 *   POST (text/plain JSON body) { key, action: "put", baseVersion, updatedBy, message, data }
 *        -> { ok, version } or { ok: false, conflict: true, version } when someone else saved first
 *
 * Data is kept in plain tabs so people can read and filter it directly. Every save rewrites the tabs from
 * the page's merged copy and bumps the version number on the Meta tab. Editing a value by hand also bumps
 * the version (onEdit below), so connected pages pick hand edits up within a minute.
 */

var TABS = {
  Meta:   ["key", "value"],
  Ticks:  ["date", "task", "who"],
  Adhoc:  ["ts", "task", "date", "note", "closed"],
  Tasks:  ["id", "kind", "team", "freq", "dow", "dom", "name", "desc"],
  Roles:  ["task", "accountable", "responsible"],
  Hidden: ["id"],
  People: ["name"],
  Log:    ["id", "time", "who", "event", "details", "task", "date"]
};

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || "ping";
  try {
    checkKey_(p.key);
    if (action === "state") return json_(readAll_());
    return json_(meta_());
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) {
    return json_({ ok: false, error: "Body is not JSON" });
  }
  try {
    checkKey_(body.key);
    if (body.action !== "put") throw new Error("Unknown action");
    if (!body.data || typeof body.data !== "object") throw new Error("Missing data");
    var lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      var current = meta_();
      if (Number(body.baseVersion || 0) !== current.version) {
        return json_({ ok: false, conflict: true, version: current.version });
      }
      writeAll_(body.data, body.updatedBy || "", body.message || "");
      return json_(meta_());
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ---------- helpers ---------- */

function checkKey_(key) {
  var want = PropertiesService.getScriptProperties().getProperty("TEAM_PASSWORD");
  if (!want) throw new Error("TEAM_PASSWORD is not set. In Apps Script open Project Settings, Script Properties, and add it.");
  if (String(key || "") !== want) throw new Error("Wrong team password");
}

function json_(obj) {
  if (obj.ok === undefined) obj.ok = true;
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, TABS[name].length).setValues([TABS[name]]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var width = TABS[name].length;
  return sh.getRange(2, 1, last - 1, width).getValues();
}

// Replace a tab's rows. Cells are formatted as plain text first so dates and ids are stored verbatim.
function setRows_(name, rows) {
  var sh = sheet_(name);
  var width = TABS[name].length;
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, Math.max(width, sh.getLastColumn())).clearContent();
  if (!rows.length) return;
  var range = sh.getRange(2, 1, rows.length, width);
  range.setNumberFormat("@");
  range.setValues(rows.map(function (r) { return r.map(cell_); }));
}

function cell_(v) { return v === null || v === undefined ? "" : v; }
function str_(v) {
  if (v === null || v === undefined) return "";
  if (Object.prototype.toString.call(v) === "[object Date]") return isoDate_(v);
  return String(v);
}
function isoDate_(d) {
  var p = function (n) { return (n < 10 ? "0" : "") + n; };
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function num_(v) { var n = Number(v); return isFinite(n) && v !== "" && v !== null ? n : null; }

function meta_() {
  var m = {};
  rows_("Meta").forEach(function (r) { m[str_(r[0])] = r[1]; });
  var version = num_(m.version) || 0;
  // row counts per data tab: cheap, and they change when rows are added or deleted by hand
  var counts = Object.keys(TABS).filter(function (n) { return n !== "Meta"; }).map(function (n) { return Math.max(0, sheet_(n).getLastRow() - 1); });
  return {
    ok: true,
    version: version,
    stamp: version + ":" + counts.join(","),
    updatedAt: str_(m.updatedAt),
    updatedBy: str_(m.updatedBy),
    message: str_(m.message),
    sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl()
  };
}

function readAll_() {
  var data = { done: {}, adhoc: [], custom: [], overrides: {}, roles: {}, hidden: [], people: [], log: [] };

  rows_("Ticks").forEach(function (r) {
    var date = str_(r[0]), task = str_(r[1]), who = str_(r[2]).trim();
    if (date && task) data.done[date + "|" + task] = who || 1;
  });
  rows_("Adhoc").forEach(function (r) {
    var ts = num_(r[0]), task = str_(r[1]), date = str_(r[2]);
    if (ts && task && date) data.adhoc.push({ ts: ts, task: task, date: date, note: str_(r[3]), closed: str_(r[4]) || null });
  });
  rows_("Tasks").forEach(function (r) {
    var id = str_(r[0]), kind = str_(r[1]);
    if (!id || !str_(r[6])) return;
    var t = { id: id, team: str_(r[2]), freq: str_(r[3]), name: str_(r[6]) };
    if (num_(r[4])) t.dow = num_(r[4]);
    if (num_(r[5])) t.dom = num_(r[5]);
    if (str_(r[7])) t.desc = str_(r[7]);
    if (kind === "edited") data.overrides[id] = t; else data.custom.push(t);
  });
  rows_("Roles").forEach(function (r) {
    var task = str_(r[0]), a = str_(r[1]), who = str_(r[2]);
    if (task && (a || who)) data.roles[task] = { a: a, r: who };
  });
  rows_("Hidden").forEach(function (r) { var id = str_(r[0]); if (id) data.hidden.push(id); });
  rows_("People").forEach(function (r) { var n = str_(r[0]).trim(); if (n) data.people.push(n); });
  rows_("Log").forEach(function (r) {
    var id = str_(r[0]), t = str_(r[1]), ev = str_(r[3]);
    if (!id || !t || !ev) return;
    var e = { id: id, t: t, who: str_(r[2]), ev: ev, what: str_(r[4]) };
    if (str_(r[5])) e.task = str_(r[5]);
    if (str_(r[6])) e.date = str_(r[6]);
    data.log.push(e);
  });

  var m = meta_();
  m.data = data;
  return m;
}

function writeAll_(d, updatedBy, message) {
  var done = d.done || {};
  setRows_("Ticks", Object.keys(done).map(function (k) {
    var i = k.indexOf("|");
    return [k.slice(0, i), k.slice(i + 1), typeof done[k] === "string" ? done[k] : ""];
  }));
  setRows_("Adhoc", (d.adhoc || []).map(function (e) { return [e.ts, e.task, e.date, e.note || "", e.closed || ""]; }));
  var tasks = (d.custom || []).map(function (t) { return taskRow_(t, "added"); });
  Object.keys(d.overrides || {}).forEach(function (id) { tasks.push(taskRow_(d.overrides[id], "edited", id)); });
  setRows_("Tasks", tasks);
  setRows_("Roles", Object.keys(d.roles || {}).map(function (id) { return [id, d.roles[id].a || "", d.roles[id].r || ""]; }));
  setRows_("Hidden", (d.hidden || []).map(function (id) { return [id]; }));
  setRows_("People", (d.people || []).map(function (n) { return [n]; }));
  setRows_("Log", (d.log || []).map(function (e) { return [e.id, e.t, e.who || "", e.ev, e.what || "", e.task || "", e.date || ""]; }));

  var version = (meta_().version || 0) + 1;
  setRows_("Meta", [
    ["version", version],
    ["updatedAt", new Date().toISOString()],
    ["updatedBy", updatedBy],
    ["message", message]
  ]);
}

function taskRow_(t, kind, id) {
  return [id || t.id, kind, t.team, t.freq, t.dow || "", t.dom || "", t.name, t.desc || ""];
}

/**
 * Simple trigger: runs when someone edits a cell by hand. Bumps the version so pages notice the change on
 * their next check. Row deletions do not always fire this, which is why the stamp above also carries row
 * counts. Script writes never trigger it, so saves from the page do not double-bump.
 */
function onEdit(e) {
  try {
    var sh = e && e.range && e.range.getSheet && e.range.getSheet();
    var name = sh && sh.getName ? sh.getName() : "";
    if (!name || name === "Meta" || !TABS[name]) return;
    bumpVersion_("edited by hand in the " + name + " tab");
  } catch (err) {}
}
// Installable trigger option (Triggers > Add trigger > onChange > From spreadsheet > On change) for
// structural edits such as deleting rows. Optional: the row-count stamp already covers deletions.
function onChange(e) {
  try { bumpVersion_("changed by hand in the sheet"); } catch (err) {}
}
function bumpVersion_(message) {
  var version = (meta_().version || 0) + 1;
  setRows_("Meta", [
    ["version", version],
    ["updatedAt", new Date().toISOString()],
    ["updatedBy", "(sheet edit)"],
    ["message", message]
  ]);
}

/** Run once from the editor to create the tabs and check the password property. */
function setup() {
  Object.keys(TABS).forEach(sheet_);
  var pw = PropertiesService.getScriptProperties().getProperty("TEAM_PASSWORD");
  Logger.log(pw ? "Tabs ready. TEAM_PASSWORD is set." : "Tabs ready. TEAM_PASSWORD is NOT set yet: Project Settings > Script Properties.");
}
