// Tend simulator UI. All text is set with textContent, never innerHTML, so user-derived strings cannot inject markup.
const params = new URLSearchParams(location.search);
const VIEW = ["kitchen", "care", "demo"].includes(params.get("view")) ? params.get("view") : "demo";
const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVG = {
  clock: '<circle cx="10" cy="10" r="8"/><path d="M10 5v5l3 2"/>',
  check: '<path d="M4 10.5l4 4 8-9"/>',
  mic: '<rect x="7" y="2" width="6" height="10" rx="3"/><path d="M4 9a6 6 0 0012 0M10 15v3"/>',
  warn: '<path d="M10 3l8 14H2z"/><path d="M10 8v4M10 14.5v.5"/>',
};

function el(tag, cls, text, attrs) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
function icon(name) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("class", "icon"); s.setAttribute("viewBox", "0 0 20 20"); s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", name === "check" ? "2.4" : "2"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = SVG[name]; // constant strings only, never user text
  return s;
}
const fmt12 = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

let state = null;
let transcript = []; // {who, text, error?, card?}
let lastMode = null;
let lastSig = null;
let lastLogged = null; // {item, at}
let speakOn = true;
let busyUntil = 0;
let draft = "";

async function api(path, body) {
  const r = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function speak(text) {
  if (!speakOn || !("speechSynthesis" in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; speechSynthesis.speak(u); } catch { /* optional */ }
}

function applyState(s, opts = {}) {
  if (!s) return;
  state = s;
  $("offline").hidden = !s.offline;
  if (s.offline) return;
  $("chip").textContent = s.chip;
  const mode = s.due?.data?.mode ?? null;
  if (mode === "overdue" && lastMode !== "overdue" && !opts.quiet) {
    transcript.push({ who: "Simulated Alexa+", text: s.due.text });
    speak(s.due.text);
  }
  if (transcript.length === 0 && s.due) transcript.push({ who: "Simulated Alexa+", text: mode === "overdue" ? s.due.text : `Good morning, Mom. ${s.due.text}` });
  lastMode = mode;
  render();
}

// ---------- kitchen ----------
function kitchenPanel() {
  const due = state.due;
  const panel = el("section", "panel");
  const d = due?.data ?? {};
  const mode = d.mode ?? "empty";
  if (!due || mode === "empty") {
    panel.append(el("h1", "item", "Nothing due"), el("p", "eyebrow", due?.text ?? "Waiting for your caregiver to set up reminders."));
    return panel;
  }
  const first = due.items[0];
  const sig = `${mode}|${due.title}|${first.value}`;
  const animate = !reduceMotion && sig !== lastSig;
  lastSig = sig;
  const swap = el("div", animate ? "swap" : "");
  if (mode === "overdue") {
    const st = el("p", "status-overdue"); st.append(icon("clock"), document.createTextNode("Overdue"));
    swap.append(st, el("p", "eyebrow", first.meta ?? ""));
  } else if (mode === "due") {
    swap.append(el("p", "eyebrow", "Due now"));
  } else {
    const e = el("p", "eyebrow");
    if (lastLogged) { e.append(icon("check"), document.createTextNode(`${lastLogged.item}: taken at ${lastLogged.at}`)); } else e.textContent = "Next dose";
    swap.append(e);
  }
  swap.append(el("h1", "item", due.title), el("p", "time", first.value));
  const btn = el("button", "btn", "", { type: "button", id: "took" });
  btn.append(icon("check"), document.createTextNode("I took it"));
  btn.addEventListener("click", () => logDose(due.title, btn));
  swap.append(btn);
  if (d.moreOverdue > 0) {
    const more = el("button", "more-line", `${d.moreOverdue} more overdue`, { type: "button", "aria-expanded": "false" });
    const list = el("ul", "more-list"); list.hidden = true;
    for (const it of due.items.slice(1, 4)) {
      const li = el("li"); li.append(el("span", "", `${it.label}, ${it.value}`));
      const b = el("button", "btn secondary", "I took it", { type: "button" });
      b.addEventListener("click", () => logDose(it.label, b));
      li.append(b); list.append(li);
    }
    more.addEventListener("click", () => { list.hidden = !list.hidden; more.setAttribute("aria-expanded", String(!list.hidden)); });
    swap.append(more, list);
  }
  if (d.nextLine) swap.append(el("p", "next-line", d.nextLine));
  panel.append(swap);
  return panel;
}

function transcriptAside() {
  const a = el("aside", "transcript", "", { "aria-label": "Alexa conversation" });
  a.append(el("h2", "", "Simulated Alexa+ display"));
  const log = el("div", "", "", { role: "status", "aria-live": "polite" });
  for (const t of transcript.slice(-6)) {
    const p = el("p", t.error ? "line err" : "line");
    p.append(el("b", "", t.who), document.createTextNode(t.text));
    log.append(p);
    if (t.card?.data?.items && t.card.actions?.some((x) => x.tool === "set_schedule")) {
      const row = el("div", "propose");
      const save = el("button", "btn", "Save", { type: "button" });
      const edit = el("button", "btn secondary", "Edit", { type: "button" });
      save.addEventListener("click", async () => {
        const items = t.card.data.items.map((i) => ({ name: i.name, time: i.hhmm, days: i.days }));
        const r = await api("/api/action", { tool: "set_schedule", args: { items, version: t.card.data.version } });
        transcript.push({ who: "Simulated Alexa+", text: r.reply, error: r.isError });
        applyState(r.state, { quiet: true });
      });
      edit.addEventListener("click", () => $("u")?.focus());
      row.append(save, edit); log.append(row);
    }
  }
  a.append(log);
  const field = el("div", "field");
  field.append(el("label", "", "Say it or type it", { for: "u" }));
  const row = el("div", "field-row");
  const input = el("input", "", "", { id: "u", type: "text", autocomplete: "off", maxlength: "500" });
  input.value = draft;
  input.addEventListener("input", () => { draft = input.value; });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submitSay(); });
  row.append(input);
  const sendBtn = el("button", "btn secondary", "Send", { type: "button" });
  sendBtn.addEventListener("click", submitSay);
  row.append(sendBtn);
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (Rec) {
    const mic = el("button", "btn secondary", "", { type: "button", "aria-pressed": "false", id: "mic" });
    mic.append(icon("mic"), document.createTextNode("Speak"));
    mic.addEventListener("click", () => listen(Rec, mic));
    row.append(mic);
  }
  field.append(row);
  const tog = el("label", "toggle");
  const cb = el("input", "", "", { type: "checkbox" }); cb.checked = speakOn;
  cb.addEventListener("change", () => { speakOn = cb.checked; if (!speakOn && "speechSynthesis" in window) speechSynthesis.cancel(); });
  tog.append(cb, document.createTextNode(" Speak alerts aloud"));
  field.append(tog);
  a.append(field);
  return a;
}

function listen(Rec, mic) {
  let rec;
  try { rec = new Rec(); } catch { return voiceFailed(); }
  rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
  mic.setAttribute("aria-pressed", "true");
  const done = () => mic.setAttribute("aria-pressed", "false");
  rec.onresult = (e) => { const t = e.results?.[0]?.[0]?.transcript ?? ""; draft = t; const u = $("u"); if (u) u.value = t; done(); if (t) submitSay(); };
  rec.onerror = () => { done(); voiceFailed(); };
  rec.onnomatch = () => { done(); voiceFailed(); };
  rec.onend = done;
  try { rec.start(); } catch { done(); voiceFailed(); }
}
function voiceFailed() {
  transcript.push({ who: "Simulated Alexa+", text: "Voice didn't work here. Type it instead.", error: true });
  render(); $("u")?.focus();
}

async function submitSay() {
  const text = draft.trim();
  if (!text) return;
  draft = "";
  transcript.push({ who: "You", text });
  try {
    const r = await api("/api/say", { text });
    const entry = { who: "Simulated Alexa+", text: r.reply, error: r.isError, card: r.card };
    transcript.push(entry);
    if (r.intent === "log" && r.card?.data?.loggedItem) lastLogged = { item: r.card.data.loggedItem, at: r.card.data.loggedAt };
    applyState(r.state, { quiet: true });
  } catch { applyState({ offline: true }); }
}

async function logDose(item, btn) {
  if (Date.now() < busyUntil) return;
  busyUntil = Date.now() + 1500; // debounce: log_dose is idempotent anyway
  btn.disabled = true;
  try {
    const r = await api("/api/action", { tool: "log_dose", args: { item } });
    if (r.card?.data?.loggedItem) lastLogged = { item: r.card.data.loggedItem, at: r.card.data.loggedAt };
    transcript.push({ who: "Simulated Alexa+", text: r.reply, error: r.isError });
    applyState(r.state, { quiet: true });
  } catch { applyState({ offline: true }); }
  setTimeout(() => { const b = $("took"); if (b) b.disabled = false; }, 1500);
}

// ---------- caregiver ----------
function careSection() {
  const root = el("main", "care", "", { "aria-label": "Caregiver" });
  const due = state.due, alerts = state.alerts, week = state.week;
  const tl = week?.timeline;
  const first = alerts?.items?.[0];
  const today = first && /^\d/.test(first.value ?? "");
  if (due?.data?.mode === "overdue") {
    const b = el("p", "statusline", "", { role: "status" }); b.append(icon("clock"), document.createTextNode(`Missed: ${due.title} at ${due.items[0].value}`)); root.append(b);
  } else if (today && tl && tl.status === "resolved_late") {
    const item = tl.events[0].label.replace(/ scheduled$/, "");
    const b = el("p", "okline", "", { role: "status" }); b.append(icon("check"), document.createTextNode(`Logged late: ${item} at ${tl.events[tl.events.length - 1].time}`)); root.append(b);
  } else {
    const b = el("p", "okline", "", { role: "status" }); b.append(icon("check"), document.createTextNode("All on track. No missed doses today.")); root.append(b);
  }
  const sA = el("section", "", "", { "aria-labelledby": "a" });
  sA.append(el("h2", "", "Alerts", { id: "a" }));
  const ol = el("ol", "alerts");
  if (!alerts || alerts.items.length === 0) ol.append(el("li", "", "All quiet. No missed doses."));
  for (const it of alerts?.items ?? []) {
    const li = el("li"); li.append(el("p", "msg", it.label), el("span", "when", it.value));
    if (it.state === "missed" && !it.meta) li.append(el("span", "new", "New"));
    if (it.meta) li.append(el("p", "followup", it.meta));
    ol.append(li);
  }
  sA.append(ol); root.append(sA);

  const sW = el("section", "", "", { "aria-labelledby": "w" });
  sW.append(el("h2", "", "This week", { id: "w" }));
  const wk = el("div", "week");
  const word = { taken: "Taken", missed: "Missed", due: "Due", upcoming: "Due", nodata: "No data" };
  for (const d of week?.items ?? []) {
    const col = el("div", "day"); col.append(el("h3", "", d.label));
    if (d.doses.length === 0) col.append(el("div", "dose", "No data"));
    for (const x of d.doses) {
      const row = el("div", "dose");
      row.append(el("span", `dot ${x.state === "taken" ? "taken" : x.state === "missed" ? "missed" : "upcoming"}`), document.createTextNode(`${Number(x.hhmm.slice(0, 2)) < 12 ? "AM" : "PM"} ${word[x.state] ?? ""}`));
      col.append(row);
    }
    wk.append(col);
  }
  sW.append(wk);
  if (state.clockMode === "sim") sW.append(el("p", "foot", "Demo data"));
  root.append(sW);

  const sT = el("section", "", "", { "aria-labelledby": "t" });
  sT.append(el("h2", "", tl ? tl.title : "Timeline", { id: "t" }));
  if (!tl) sT.append(el("p", "foot", "No missed doses this week."));
  else {
    const rail = el("ol", "rail");
    tl.events.forEach((ev, i) => {
      const li = el("li", ev.kind === "alert" ? "alert" : ev.kind === "done" ? "done" : ""); li.append(el("time", "", ev.time), document.createTextNode(ev.label)); rail.append(li);
      if (i === 0 && state.skipLabel && ev.label.endsWith("scheduled") && !/^\w{3} /.test(ev.time)) { const s = el("li", "skip"); s.append(el("time", "", "Demo"), document.createTextNode(state.skipLabel)); rail.append(s); }
    });
    sT.append(rail);
  }
  root.append(sT);
  return root;
}

// ---------- layout ----------
function render() {
  const root = $("root");
  if (!state || state.offline) { if (!root.childNodes.length) root.append(el("p", "foot", "Starting...")); return; }
  const focusId = document.activeElement?.id; const caret = document.activeElement?.selectionStart;
  root.replaceChildren();
  if (VIEW === "kitchen") {
    const main = el("main", "kitchen", "", { "aria-label": "Kitchen display" }); main.append(kitchenPanel(), transcriptAside()); root.append(main);
  } else if (VIEW === "care") {
    root.append(careSection());
  } else {
    const demo = el("div", "demo");
    const l = el("section", "", "", { "aria-label": "Kitchen display" }); const k = el("main", "kitchen", "", { "aria-label": "Kitchen display" }); k.append(kitchenPanel(), transcriptAside()); l.append(k);
    const r = el("section", "", "", { "aria-label": "Caregiver" }); r.append(careSection());
    demo.append(l, r); root.append(demo);
  }
  $("tray").hidden = !(VIEW === "demo" && state.clockMode === "sim");
  $("pagefoot").hidden = VIEW === "demo";
  if (focusId === "u") { const u = $("u"); if (u) { u.focus(); if (caret != null) u.setSelectionRange(caret, caret); } }
}

async function refresh() { try { applyState(await api("/api/state"), { quiet: true }); } catch { applyState({ offline: true }); } }

document.addEventListener("click", async (e) => {
  const b = e.target.closest?.("[data-clock]");
  if (!b) return;
  const v = b.dataset.clock;
  try {
    const r = v === "reset" ? await api("/api/reset", {}) : await api("/api/clock", v === "next" ? { jump_to: "next_slot" } : { advance_minutes: Number(v) });
    if (v === "reset") { transcript = []; lastMode = null; lastSig = null; lastLogged = null; }
    applyState(r.state);
  } catch { applyState({ offline: true }); }
});
$("retry").addEventListener("click", refresh);
if (VIEW === "kitchen") $("pagefoot").hidden = false;
refresh();
setInterval(refresh, 30000);
