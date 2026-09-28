"""Build the task assignment workbook people fill in by hand (templates/Clime_Task_Assignments.xlsx).

Sheet "Tasks" lists every standard task with its frequency, the day it is due, and the default accountable /
responsible people. Sheet "Lists" holds the drop-down options. Run: python3 scripts/make_assignment_sheet.py
"""
import re, sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

# ---- pull the standard tasks straight out of index.html so the two never drift ----
html = open("index.html", encoding="utf-8").read()
block = html[html.index("const TASKS = ["):html.index("];", html.index("const TASKS = ["))]
TASKS = []
for m in re.finditer(r"\{([^}]*)\}", block):
    fields = {k: (n if n else v) for k, v, n in re.findall(r'(\w+):\s*(?:"([^"]*)"|(\d+))', m.group(1))}
    if fields.get("id"): TASKS.append(fields)

TEAM = {"ops": "Ops", "comp": "Compliance", "cs": "Client Services"}
DAYS = {"1": "Monday", "2": "Tuesday", "3": "Wednesday", "4": "Thursday", "5": "Friday"}
DOM = {"1": "1st", "15": "15th", "30": "30th"}
FREQ = {"daily": "Daily", "weekly": "Weekly", "fortnightly": "Fortnightly", "monthly": "Monthly", "adhoc": "Adhoc"}
DEFAULT_ROLES = {"ops": ("Michael", "Matt Henry"), "comp": ("Michael", "Diara"), "cs": ("Diara", "")}

def due(t):
    f = t["freq"]
    if f == "weekly": return DAYS.get(t.get("dow", ""), "")
    if f == "monthly": return DOM.get(t.get("dom", ""), "")
    if f == "fortnightly": return "1st and 15th"
    if f == "daily": return "Every weekday"
    return "As needed"

order_team = ["ops", "comp", "cs"]; order_freq = ["daily", "weekly", "fortnightly", "monthly", "adhoc"]
TASKS.sort(key=lambda t: (order_team.index(t["team"]), order_freq.index(t["freq"]), int(t.get("dow", 0) or 0), int(t.get("dom", 0) or 0)))

# ---- lists ----
FREQ_LIST = ["Daily", "Weekly", "Fortnightly", "Monthly", "Adhoc"]
TEAM_LIST = ["Ops", "Compliance", "Client Services"]
DUE_LIST = ["Every weekday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "1st", "15th", "30th", "1st and 15th", "As needed"]
PEOPLE = ["Michael", "Matt Henry", "Diara", "Matt Deane"]

wb = Workbook()
ws = wb.active; ws.title = "Tasks"
lists = wb.create_sheet("Lists")

FONT = "Arial"
base = Font(name=FONT, size=10)
bold = Font(name=FONT, size=10, bold=True)
head_fill = PatternFill("solid", fgColor="1C2430")
head_font = Font(name=FONT, size=10, bold=True, color="FFFFFF")
fill_in = PatternFill("solid", fgColor="FFF9C4")   # yellow: for you to fill in
locked = PatternFill("solid", fgColor="EEEEEE")     # grey: do not edit
thin = Side(style="thin", color="D5DBE3"); border = Border(left=thin, right=thin, top=thin, bottom=thin)

# ---- Lists sheet ----
lists["A1"], lists["B1"], lists["C1"], lists["D1"] = "Frequency", "Team", "Date / day to be completed by", "People"
for c in "ABCD": lists[f"{c}1"].font = head_font; lists[f"{c}1"].fill = head_fill
for col, values in zip("ABCD", [FREQ_LIST, TEAM_LIST, DUE_LIST, PEOPLE]):
    for i, v in enumerate(values, start=2):
        lists[f"{col}{i}"] = v; lists[f"{col}{i}"].font = base
lists["F1"] = "These lists feed the drop-downs on the Tasks sheet. Add a name under People to offer it in the Accountable and Responsible drop-downs."
lists["F1"].font = Font(name=FONT, size=10, italic=True, color="5A6676")
for col, w in zip("ABCD", [14, 18, 30, 18]): lists.column_dimensions[col].width = w
lists.column_dimensions["F"].width = 90

# ---- Tasks sheet ----
HEADERS = ["Task", "Description", "Team", "Frequency", "Date / day to be completed by", "Accountable", "Responsible", "Tool id (do not edit)"]
ws["A1"] = ("Fill in the yellow cells. Task, Frequency, Date / day, Accountable and Responsible are what the tracker reads. "
            "Team, Frequency, Date / day, Accountable and Responsible have drop-downs (lists on the Lists sheet); you can still type a new name or day. "
            "Add new tasks in the blank yellow rows. Leave the grey Tool id column alone; it lets the tracker match rows to existing tasks.")
ws["A1"].font = Font(name=FONT, size=10, italic=True, color="5A6676"); ws["A1"].alignment = Alignment(wrap_text=True, vertical="top")
ws.merge_cells("A1:H1"); ws.row_dimensions[1].height = 48

HEAD_ROW = 2
for i, h in enumerate(HEADERS, start=1):
    c = ws.cell(row=HEAD_ROW, column=i, value=h); c.font = head_font; c.fill = head_fill; c.border = border
    c.alignment = Alignment(vertical="center", wrap_text=True)
ws.row_dimensions[HEAD_ROW].height = 30

r = HEAD_ROW + 1
for t in TASKS:
    a, rr = DEFAULT_ROLES[t["team"]]
    row = [t["name"], t.get("desc", ""), TEAM[t["team"]], FREQ[t["freq"]], due(t), a, rr, t["id"]]
    for i, v in enumerate(row, start=1):
        c = ws.cell(row=r, column=i, value=v); c.font = base; c.border = border
        if i == 8: c.fill = locked; c.font = Font(name=FONT, size=9, color="8A96A6")
        elif i in (6, 7) and not v: c.fill = fill_in
    r += 1
FIRST_BLANK = r
BLANK_ROWS = 30
for _ in range(BLANK_ROWS):
    for i in range(1, 9):
        c = ws.cell(row=r, column=i); c.font = base; c.border = border
        c.fill = locked if i == 8 else fill_in
    r += 1
LAST = r - 1

# drop-downs, covering the filled rows and the blank rows below them
def dv(rng, col_letter, count, allow_other, prompt):
    v = DataValidation(type="list", formula1=f"=Lists!${col_letter}$2:${col_letter}${count + 1}", allow_blank=True)
    v.showErrorMessage = not allow_other
    v.errorTitle = "Pick from the list"; v.error = "Choose one of the options in the drop-down."
    v.showInputMessage = True; v.promptTitle = "Choose"; v.prompt = prompt
    ws.add_data_validation(v); v.add(rng)
n = LAST
dv(f"C{HEAD_ROW+1}:C{n}", "B", len(TEAM_LIST), False, "Ops, Compliance or Client Services")
dv(f"D{HEAD_ROW+1}:D{n}", "A", len(FREQ_LIST), False, "Daily, Weekly, Fortnightly, Monthly or Adhoc")
dv(f"E{HEAD_ROW+1}:E{n}", "C", len(DUE_LIST), True, "Weekday for weekly tasks; 1st, 15th or 30th for monthly. You can type another value.")
dv(f"F{HEAD_ROW+1}:F{n}", "D", len(PEOPLE), True, "Pick a name or type a new one")
dv(f"G{HEAD_ROW+1}:G{n}", "D", len(PEOPLE), True, "Pick a name or type a new one")

for col, w in zip("ABCDEFGH", [40, 40, 16, 13, 28, 16, 16, 18]): ws.column_dimensions[col].width = w
ws.freeze_panes = f"A{HEAD_ROW+1}"
ws.auto_filter.ref = f"A{HEAD_ROW}:H{LAST}"

out = sys.argv[1] if len(sys.argv) > 1 else "templates/Clime_Task_Assignments.xlsx"
wb.save(out)
print(f"wrote {out}: {len(TASKS)} tasks, {BLANK_ROWS} blank rows, header on row {HEAD_ROW}")
