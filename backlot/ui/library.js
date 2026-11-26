import { el, getJSON, subscribe, thumbURL } from "/ui/lib.js";
import {
  EXAMPLES, LENGTHS, MOODS, buildAsk, filterSort, fmtDate, fmtLength, fmtTotal,
  liveState, madeAt, progress, totals,
} from "/ui/library-model.js";

const app = document.getElementById("app");
const THEME_KEY = "backlot.theme";
const isStatic = new URLSearchParams(location.search).has("static");

function readTheme() {
  try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; } catch { return "dark"; }
}
let currentTheme = readTheme();

function applyTheme(theme) {
  currentTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = currentTheme;
  try { localStorage.setItem(THEME_KEY, currentTheme); } catch { /* private window */ }
}

function renderThemeToggle() {
  const next = currentTheme === "light" ? "dark" : "light";
  const label = next === "light" ? "明るい表示にする" : "暗い表示にする";
  return el("button", {
    class: "theme-toggle",
    type: "button",
    title: label,
    "aria-label": label,
    "aria-pressed": currentTheme === "light" ? "true" : "false",
    onclick: () => {
      applyTheme(next);
      document.querySelector(".theme-toggle").replaceWith(renderThemeToggle());
    },
  }, el("span", { class: "theme-toggle-icon", "aria-hidden": "true" }, currentTheme === "light" ? "☾" : "☀"));
}

applyTheme(currentTheme);
document.getElementById("tools").append(renderThemeToggle());

// ---- 使い方 -----------------------------------------------------------
const help = document.getElementById("help");
document.getElementById("helpBtn").addEventListener("click", () => help.showModal());
document.getElementById("helpClose").addEventListener("click", () => help.close());

// ---- 写す ---------------------------------------------------------------
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.textContent = ""; }, 3000);
}

async function copyText(text, btn) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    const area = el("textarea", { style: "position:fixed;opacity:0" });
    area.value = text;
    document.body.append(area);
    area.select();
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    area.remove();
  }
  toast(ok ? "写しました。Claude Code か Codex に貼ってください" : "写せませんでした。文を選んで写してください");
  if (ok && btn && btn.classList.contains("hub-cp")) {
    const before = btn.textContent;
    btn.textContent = "写しました ✓";
    btn.classList.add("ok");
    setTimeout(() => { btn.textContent = before; btn.classList.remove("ok"); }, 2200);
  }
}

function copyBtn(text, label = "写す", cls = "hub-cp") {
  return el("button", { class: cls, type: "button", onclick: (e) => copyText(text, e.currentTarget) }, label);
}

// ---- 案内(3 つの手順と例文) --------------------------------------------
let repoDir = "OpenMontage";

const ICONS = [
  '<svg viewBox="0 0 200 110" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="46" y="18" width="108" height="68" rx="5"/><path d="M30 96h140M64 40h26l6 7h42v26H64z"/><path d="M64 54h74" class="hub-accent"/></svg>',
  '<svg viewBox="0 0 200 110" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M30 20h140v56H94l-18 18V76H30z"/><path d="M46 40h66M46 56h44"/><path d="M118 34v28M98 56h14" class="hub-accent" stroke-width="3"/></svg>',
  '<svg viewBox="0 0 200 110" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="22" y="34" width="48" height="30"/><rect x="76" y="26" width="64" height="42" class="hub-accent" stroke-width="3"/><path d="m102 38 16 9-16 9z" class="hub-accent-fill"/><rect x="146" y="34" width="34" height="30"/><path d="M14 82h172"/></svg>',
];

function icon(i) {
  const span = el("span", { class: "hub-ic" });
  span.innerHTML = ICONS[i]; // fixed markup above, no data
  return span;
}

function steps() {
  return el("ol", { class: "hub-reel" },
    el("li", {},
      el("span", { class: "hub-no hub-mono" }, "SCENE 1"), icon(0),
      el("b", {}, "Mac で動画のフォルダを開く"),
      el("p", {}, "場所: ", el("code", {}, repoDir), el("br"),
        copyBtn(`cd ${repoDir}`, "開く命令を写す", "hub-link"))),
    el("li", {},
      el("span", { class: "hub-no hub-mono" }, "SCENE 2"), icon(1),
      el("b", {}, "Claude Code か Codex に頼む"),
      el("p", {}, "下の例文を写して、貼るだけです。")),
    el("li", {},
      el("span", { class: "hub-no hub-mono" }, "SCENE 3"), icon(2),
      el("b", {}, "できたら、ここに並びます"),
      el("p", {}, "制作が始まると自動で出ます。新しい動画がいちばん前です。")),
  );
}

const ask = { what: "", len: "30 秒", mood: "静かな音楽で" };

function optionGroup(key, values, onChange) {
  const box = el("div", { class: "hub-opt", role: "group" });
  const draw = () => {
    box.replaceChildren(...values.map((v) => el("button", {
      type: "button", "aria-pressed": String(ask[key] === v),
      onclick: () => { ask[key] = v; draw(); onChange(); box.querySelector(`[aria-pressed="true"]`).focus(); },
    }, v)));
  };
  draw();
  return box;
}

function examples() {
  const made = el("p", { class: "hub-made" });
  const madeBtn = el("button", { class: "hub-cp", type: "button", onclick: (e) => copyText(buildAsk(ask), e.currentTarget) }, "写す");
  const update = () => { made.textContent = buildAsk(ask); };
  update();
  const input = el("input", { maxlength: "40", placeholder: "例: 近所の坂道の四季", value: ask.what });
  input.addEventListener("input", () => { ask.what = input.value; update(); });
  return el("section", { class: "hub-sec" },
    el("div", { class: "hub-sh" }, el("h2", {}, "頼み方の例文"), el("p", {}, "写して、Claude Code か Codex に貼ります。")),
    el("div", { class: "hub-asks" },
      EXAMPLES.map(([kind, text]) => el("article", { class: "hub-ask" },
        el("small", {}, kind), el("q", {}, text), copyBtn(text)))),
    el("div", { class: "hub-make" },
      el("div", {},
        el("label", {}, el("span", {}, "自分で組み立てる: 何の動画"), input),
        el("div", { class: "hub-field" }, el("span", {}, "長さ"), optionGroup("len", LENGTHS, update)),
        el("div", { class: "hub-field" }, el("span", {}, "雰囲気"), optionGroup("mood", MOODS, update))),
      el("div", { class: "hub-out" }, made, madeBtn)),
  );
}

// ---- 棚 -----------------------------------------------------------------
let filter = "all";
let sort = "new";
let projects = [];

function card(p, big) {
  const prog = progress(p);
  const poster = el("span", { class: "lib-poster hub-th" });
  if (p.poster) {
    poster.append(el("img", { src: thumbURL(p.project_id, p.poster, big ? 960 : 640), loading: "lazy", alt: "" }));
  } else {
    poster.append(el("span", { class: "lp-txt" }, "まだ絵がありません"));
  }
  const len = fmtLength(p.duration_seconds);
  if (len) poster.append(el("span", { class: "hub-len hub-mono" }, len));
  if (p.live) poster.append(el("span", { class: "lp-live" }, el("span", { class: "dot" }), "制作中"));

  const suffix = isStatic ? "?static=1" : "";
  return el("a", {
    class: `lib-card hub-v${big ? " big" : ""}${prog.done ? "" : " wip"}${p.live ? " live-card" : ""}`,
    href: `/p/${encodeURIComponent(p.project_id)}${suffix}`,
  },
    poster,
    el("b", {}, p.title || p.project_id),
    el("small", {},
      el("span", { class: `hub-st${prog.done ? "" : " wip"}` }, prog.label),
      el("span", {}, fmtDate(madeAt(p))),
      p.pipeline_type && p.pipeline_type !== "unknown" ? el("span", { class: "hub-mono hub-pipe" }, p.pipeline_type) : null),
  );
}

function toggleGroup(label, items, current, onPick) {
  return el("div", { class: "hub-filt", role: "group", "aria-label": label },
    items.map(([key, text]) => el("button", {
      type: "button", "aria-pressed": String(current === key), "data-key": key,
      onclick: () => { onPick(key); draw(); document.querySelector(`.hub-filt[aria-label="${label}"] [data-key="${key}"]`)?.focus(); },
    }, text)));
}

function shelf() {
  const sec = el("section", { class: "hub-sec", id: "shelf" });
  if (!projects.length) {
    sec.append(
      el("div", { class: "hub-sh" }, el("h2", {}, "できた動画"), el("p", {}, "まだ 0 本です。")),
      el("div", { class: "hub-shelf" },
        el("div", { class: "hub-slot" }, "ここに並びます"), el("div", { class: "hub-slot" }),
        el("div", { class: "hub-slot" }), el("div", { class: "hub-slot" })),
    );
    return sec;
  }
  const t = totals(projects);
  const list = filterSort(projects, filter, sort);
  sec.append(
    el("div", { class: "hub-sh" },
      el("div", {}, el("h2", {}, "できた動画"),
        el("p", {}, `全 ${t.all} 本・完成 ${t.done}・作りかけ ${t.wip}・合計 ${fmtTotal(t.seconds)}`)),
      el("div", { class: "hub-tools-row" },
        toggleGroup("しぼる", [["all", `全部 ${t.all}`], ["done", `完成 ${t.done}`], ["wip", `作りかけ ${t.wip}`]], filter, (k) => { filter = k; }),
        toggleGroup("並べる", [["new", "新しい順"], ["len", "長さ順"]], sort, (k) => { sort = k; }))),
    list.length
      ? el("div", { class: "lib-grid hub-shelf" }, list.map((p, i) => card(p, i === 0 && sort === "new")))
      : el("p", { class: "hub-none" }, "この条件の動画はありません。"),
  );
  return sec;
}

function guide(fold) {
  if (!fold) {
    return [
      el("section", { class: "hub-guide" },
        el("h2", { class: "hub-hero" }, "まだ動画がありません。", el("br"), "1 本目を作りましょう。"),
        el("p", {}, "作るのは Mac の中の AI です。頼み方は 3 つの手順だけ。この画面では、できた動画を見ます。"),
        steps()),
      examples(),
    ];
  }
  const d = el("details", { class: "hub-fold hub-sec" },
    el("summary", {}, el("span", { class: "hub-mono hub-plus" }, "＋"), "次の 1 本を作る",
      el("span", { class: "hub-sum-sub" }, "手順と、頼み方の例文")),
    el("div", {}, steps(), examples()));
  return [d];
}

function draw() {
  const openFold = app.querySelector(".hub-fold")?.open;
  const has = projects.length > 0;
  app.replaceChildren(...(has ? [shelf(), ...guide(true)] : [...guide(false), shelf()]));
  if (openFold) app.querySelector(".hub-fold").open = true;
}

function renderHeader() {
  document.getElementById("count").textContent = `${projects.length} 本`;
  const st = liveState(projects);
  document.getElementById("liveBadge").classList.toggle("run", st.live);
  document.getElementById("liveText").textContent = st.text;
}

async function render() {
  projects = await getJSON("/api/projects");
  renderHeader();
  // Typing in the builder must not be lost to a live refresh.
  if (app.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
  draw();
}

async function start() {
  try {
    const info = await getJSON("/api/info");
    if (info && info.repo_dir) repoDir = info.repo_dir;
  } catch { /* older server: keep the folder name */ }
  await render();
}

start().catch(console.error);
if (!isStatic) {
  subscribe("/api/library/events", () => render().catch(console.error));
}

