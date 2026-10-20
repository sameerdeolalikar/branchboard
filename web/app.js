"use strict";
const $ = (id) => document.getElementById(id),
  clone = (x) => structuredClone(x),
  NS = "http://www.w3.org/2000/svg";
let doc = null,
  analysis = null,
  id = null,
  revision = 0,
  dirty = false,
  busy = false,
  undo = [],
  redo = [],
  selected = new Set(),
  query = "",
  filter = "all",
  pageNumber = 0,
  zoom = 1,
  month = "2026-10",
  editCallback = null;
const KIND = "branchboard",
  KEY = "tasks";
function node(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
function button(text, fn, cls) {
  const b = node("button", text, cls);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
}
function svg(tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  if (text !== undefined) n.textContent = text;
  return n;
}
function say(text) {
  $("status").textContent = text;
  $("status").hidden = !text;
}
function fail(error) {
  for (const key of ["error", "dialog-error"]) {
    $(key).textContent = error.message || String(error);
    $(key).hidden = false;
  }
}
function controls() {
  document
    .querySelectorAll("button,input,select,textarea")
    .forEach((e) => (e.disabled = busy));
  $("undo").disabled = busy || !undo.length;
  $("redo").disabled = busy || !redo.length;
  $("save").disabled = busy || !doc;
}
async function api(path, data) {
  const r = await fetch(
    "/api/" + path,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "Workspace",
          },
          body: JSON.stringify(data),
        },
  );
  const value = await r.json();
  if (!r.ok) throw Error(value.error || "Request failed.");
  return value;
}
async function task(message, fn) {
  if (busy) return;
  busy = true;
  controls();
  $("error").hidden = true;
  $("dialog-error").hidden = true;
  say(message);
  try {
    await fn();
  } catch (e) {
    fail(e);
    say("");
  } finally {
    busy = false;
    controls();
  }
}
async function change(next, message = "Changes applied. Save when ready.") {
  const checked = await api("validate", next);
  undo.push(clone(doc));
  undo = undo.slice(-50);
  redo = [];
  doc = checked.document;
  analysis = checked.analysis;
  dirty = true;
  selected = new Set(
    [...selected].filter((k) => doc[KEY].some((x) => x.id === k)),
  );
  render();
  say(message);
}
function render() {
  const active = document.activeElement?.id;
  $("document-title").textContent = doc.title;
  $("revision").textContent = dirty
    ? "Unsaved changes"
    : `Saved revision ${revision}`;
  $("metrics").replaceChildren();
  Object.entries(analysis.metrics).forEach(([label, value]) => {
    const n = node("div", undefined, "metric");
    n.append(node("strong", String(value)), node("span", label));
    $("metrics").append(n);
  });
  renderWorkspace();
  controls();
  if (active && $(active)) $(active).focus({ preventScroll: true });
}
function field(label, key, value, type = "text", options) {
  const wrap = node("label", label);
  const input = node(
    options ? "select" : type === "textarea" ? "textarea" : "input",
  );
  input.id = "field-" + key;
  input.name = key;
  if (!options && type !== "textarea") input.type = type;
  if (options) options.forEach((o) => input.add(new Option(o, o)));
  if (type === "checkbox") input.checked = value;
  else input.value = value;
  wrap.append(input);
  if (type === "textarea") wrap.className = "wide";
  $("fields").append(wrap);
  return input;
}
function dialog(title, fields, callback) {
  $("editor-title").textContent = title;
  $("fields").replaceChildren();
  $("dialog-error").hidden = true;
  fields.forEach((f) => field(...f));
  editCallback = () => {
    const values = {};
    fields.forEach(([, key, , type]) => {
      const e = $("field-" + key);
      values[key] =
        type === "number"
          ? Number(e.value)
          : type === "checkbox"
            ? e.checked
            : e.value;
    });
    return callback(values);
  };
  $("editor").showModal();
  $("fields").querySelector("input,select,textarea")?.focus();
}
$("cancel").onclick = () => $("editor").close();
$("editor-form").onsubmit = (e) => {
  e.preventDefault();
  task("Validating edits…", async () => {
    await editCallback();
    $("editor").close();
  });
};
function editEntry(entry) {
  const original = entry ? clone(entry) : newEntry();
  dialog(
    entry ? "Edit entry" : "Add entry",
    entryFields(original),
    async (values) => {
      const next = clone(doc);
      const result = normalizeEntry({ ...original, ...values });
      if (entry)
        next[KEY] = next[KEY].map((x) => (x.id === entry.id ? result : x));
      else next[KEY].push(result);
      selected = new Set([result.id]);
      await change(next);
    },
  );
}
function removeEntry(key) {
  if (
    !confirm(
      "Remove this entry? Undo remains available until you open another document.",
    )
  )
    return;
  task("Checking removal…", () =>
    change({ ...doc, [KEY]: doc[KEY].filter((x) => x.id !== key) }),
  );
}
function selectField(label, options, value, callback) {
  const l = node("label", label),
    s = node("select");
  s.id = "tool-" + label.toLowerCase().replaceAll(" ", "-");
  for (const [v, t] of options) s.add(new Option(t, v));
  s.value = value;
  s.onchange = () => callback(s.value);
  l.append(s);
  return l;
}
function setupTools() {
  const tools = $("tools");
  tools.replaceChildren();
  const l = node("label", "Search entries"),
    input = node("input");
  input.type = "search";
  input.id = "search";
  input.oninput = () => {
    query = input.value.toLowerCase();
    pageNumber = 0;
    renderWorkspace();
    controls();
  };
  l.append(input);
  tools.append(l);
  domainTools(tools);
}
function download(name, data, type) {
  const u = URL.createObjectURL(new Blob([data], { type })),
    a = node("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
async function library() {
  const rows = await api("documents");
  $("library").replaceChildren(new Option("Select a document", ""));
  rows.forEach((x) =>
    $("library").add(new Option(`${x.title} · v${x.revision}`, x.id)),
  );
  $("library").value = id || "";
}
async function load(document, key = null, rev = 0) {
  const checked = await api("validate", document);
  doc = checked.document;
  analysis = checked.analysis;
  id = key;
  revision = rev;
  dirty = !key;
  undo = [];
  redo = [];
  selected.clear();
  query = "";
  filter = "all";
  pageNumber = 0;
  zoom = 1;
  setupTools();
  render();
}
$("new").onclick = () => {
  if (dirty && !confirm("Discard unsaved changes and load the sample?")) return;
  task("Loading sample…", async () => {
    await load(await api("sample"));
    say("Fictional sample ready.");
  });
};
$("save").onclick = () =>
  task("Saving document…", async () => {
    const r = await api("save", { id, revision, document: doc });
    id = r.id;
    revision = r.revision;
    dirty = false;
    await library();
    render();
    say(`Saved revision ${revision} locally.`);
  });
$("open").onclick = () => {
  const key = $("library").value;
  if (!key) return;
  if (dirty && !confirm("Discard unsaved changes and open the saved document?"))
    return;
  task("Opening document…", async () => {
    const r = await api("documents/" + key);
    await load(r.document, r.id, r.revision);
    say("Saved document opened.");
  });
};
$("undo").onclick = () =>
  task("Restoring previous state…", async () => {
    if (!undo.length) return;
    const next = undo.at(-1),
      checked = await api("validate", next);
    undo.pop();
    redo.push(clone(doc));
    doc = checked.document;
    analysis = checked.analysis;
    dirty = true;
    selected = new Set(
      [...selected].filter((k) => doc[KEY].some((x) => x.id === k)),
    );
    render();
    say("Change undone.");
  });
$("redo").onclick = () =>
  task("Reapplying change…", async () => {
    if (!redo.length) return;
    const next = redo.at(-1),
      checked = await api("validate", next);
    redo.pop();
    undo.push(clone(doc));
    doc = checked.document;
    analysis = checked.analysis;
    dirty = true;
    render();
    say("Change reapplied.");
  });
$("add").onclick = () => editEntry();
$("settings").onclick = () =>
  dialog("Document settings", settingsFields(), (values) =>
    change({ ...doc, ...values }),
  );
$("export").onclick = () =>
  task("Validating export…", async () => {
    const checked = await api("validate", doc);
    download(
      KIND + ".json",
      JSON.stringify(checked.document, null, 2) + "\n",
      "application/json",
    );
    say("Validated document exported.");
  });
$("import").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (dirty && !confirm("Replace unsaved changes with this import?")) {
    e.target.value = "";
    return;
  }
  task("Validating import…", async () => {
    try {
      if (file.size > 256000) throw Error("Imports are limited to 256 KB.");
      await load(JSON.parse(await file.text()));
      say("Document imported. Save to add it to the library.");
    } finally {
      e.target.value = "";
    }
  });
};
$("print").onclick = () => window.print();
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
function settingsFields() {
  return [["Document title", "title", doc.title]];
}

function unique() {
  return "entry-" + crypto.randomUUID().slice(0, 12);
}
function newEntry() {
  return {
    id: unique(),
    title: "New task",
    status: "backlog",
    priority: "normal",
    depends: [],
    note: "—",
  };
}
function entryFields(x) {
  return [
    ["Task title", "title", x.title],
    ["Status", "status", x.status, "text", ["backlog", "active", "done"]],
    ["Priority", "priority", x.priority, "text", ["low", "normal", "high"]],
    ["Dependency IDs (comma-separated)", "depends", x.depends.join(", ")],
    ["Notes", "note", x.note, "textarea"],
  ];
}
function normalizeEntry(x) {
  return {
    ...x,
    depends:
      typeof x.depends === "string"
        ? x.depends
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : x.depends,
  };
}
function domainTools(tools) {
  tools.append(
    selectField(
      "Priority",
      [
        ["all", "All priorities"],
        ["high", "High"],
        ["normal", "Normal"],
        ["low", "Low"],
      ],
      filter,
      (v) => {
        filter = v;
        renderWorkspace();
        controls();
      },
    ),
  );
}
function moveTask(key, status) {
  task("Checking dependencies…", () =>
    change({
      ...doc,
      tasks: doc.tasks.map((t) => (t.id === key ? { ...t, status } : t)),
    }),
  );
}
function renderWorkspace() {
  const root = $("workspace");
  root.replaceChildren();
  const card = node("section", undefined, "card"),
    scroll = node("div", undefined, "scroll"),
    board = node("div", undefined, "board");
  board.id = "board";
  for (const status of ["backlog", "active", "done"]) {
    const lane = node("section", undefined, "lane");
    lane.dataset.status = status;
    lane.append(
      node(
        "h2",
        status === "backlog"
          ? "01 / Backlog"
          : status === "active"
            ? "02 / In progress"
            : "03 / Complete",
      ),
    );
    lane.ondragover = (e) => e.preventDefault();
    lane.ondrop = (e) => {
      e.preventDefault();
      moveTask(e.dataTransfer.getData("text/plain"), status);
    };
    const tasks = doc.tasks.filter(
      (t) =>
        t.status === status &&
        (filter === "all" || t.priority === filter) &&
        [t.title, t.note, t.id].join(" ").toLowerCase().includes(query),
    );
    for (const t of tasks) {
      const n = node("article", undefined, "task");
      n.draggable = true;
      n.ondragstart = (e) => e.dataTransfer.setData("text/plain", t.id);
      n.append(
        node(
          "span",
          analysis.blocked.includes(t.id)
            ? "BLOCKED"
            : t.priority.toUpperCase(),
          analysis.blocked.includes(t.id) ? "tag warn" : "tag",
        ),
        node("strong", t.title),
        node("p", t.note, "muted"),
        node(
          "p",
          "ID: " + t.id + " · Depends on: " + (t.depends.join(", ") || "none"),
          "muted",
        ),
      );
      const actions = node("div", undefined, "row");
      const edit = button("Edit", () => editEntry(t));
      edit.setAttribute("aria-label", "Edit " + t.title);
      actions.append(edit);
      if (status !== "done")
        actions.append(
          button(status === "backlog" ? "Start" : "Complete", () =>
            moveTask(t.id, status === "backlog" ? "active" : "done"),
          ),
        );
      const remove = button("Remove", () => removeEntry(t.id));
      remove.setAttribute("aria-label", "Remove " + t.title);
      actions.append(remove);
      n.append(actions);
      lane.append(n);
    }
    if (!tasks.length) lane.append(node("p", "No matching tasks.", "empty"));
    board.append(lane);
  }
  scroll.append(board);
  card.append(
    scroll,
    node(
      "p",
      "Drag a card between columns, or use Start / Complete and Edit. Dependencies must be complete before work can advance.",
      "muted",
    ),
  );
  root.append(card);
}

task("Preparing workspace…", async () => {
  await load(await api("sample"));
  await library();
  say("Fictional sample loaded. Changes stay local.");
});
