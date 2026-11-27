// Library page (AI動画ハブ): pure helpers. No DOM here, so node --test can run them.

const STAGE_JA = {
  research: "調査",
  proposal: "企画",
  idea: "企画",
  script: "台本",
  scene_plan: "場面割り",
  assets: "素材",
  edit: "編集",
  compose: "書き出し",
  publish: "公開",
  sample: "試し",
};

export function stageLabel(name) {
  if (!name) return "";
  return STAGE_JA[name] || String(name).replace(/_/g, " ");
}

// "48 秒" / "60 秒" / "1 分 20 秒". Unknown → "".
export function fmtLength(seconds) {
  const n = Number(seconds);
  if (seconds == null || !Number.isFinite(n) || n <= 0) return "";
  const s = Math.round(n);
  if (s <= 60) return `${s} 秒`;
  return `${Math.floor(s / 60)} 分 ${String(s % 60).padStart(2, "0")} 秒`;
}

// Total of all lengths, e.g. "8 分 30 秒". 0 → "0 秒".
export function fmtTotal(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} 分 ${String(s % 60).padStart(2, "0")} 秒` : `${m} 分`;
}

// Epoch seconds of when the project was made (created_at, else last activity).
export function madeAt(p) {
  if (p.created_at) {
    const t = Date.parse(p.created_at);
    if (Number.isFinite(t)) return t / 1000;
  }
  return Number(p.last_activity) || 0;
}

// "11/20" for this year, "2025/11/20" otherwise.
export function fmtDate(epochSeconds, now = new Date()) {
  if (!epochSeconds) return "";
  const d = new Date(epochSeconds * 1000);
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}/${md}`;
}

// Done = a render exists and no stage is still open, or every stage is done.
export function isDone(p) {
  const states = p.stage_states || [];
  const open = states.some((s) => s.status === "in_progress" || s.status === "awaiting_human");
  if (open) return false;
  if (states.length && states.every((s) => s.status === "completed")) return true;
  return (p.render_count || 0) > 0;
}

// Where the project is now: { done, label } e.g. "編集 3/4", "確認待ち: 台本".
export function progress(p) {
  if (isDone(p)) return { done: true, label: "完成" };
  const states = p.stage_states || [];
  const total = p.stage_count || states.length;
  const idx = states.findIndex((s) => s.status === "in_progress" || s.status === "awaiting_human");
  const cur = idx >= 0 ? states[idx] : states.find((s) => s.status !== "completed");
  if (!cur) return { done: false, label: "作りかけ" };
  const step = (idx >= 0 ? idx : states.indexOf(cur)) + 1;
  const name = stageLabel(cur.name);
  if (cur.status === "awaiting_human") return { done: false, label: `確認待ち: ${name}` };
  return { done: false, label: total ? `${name} ${step}/${total}` : name };
}

// Header state: 待機 / 制作中 (title ・ stage).
export function liveState(projects) {
  const live = projects.filter((p) => p.live);
  if (!live.length) return { live: false, text: "待機" };
  const p = live[0];
  const where = progress(p).label;
  const more = live.length > 1 ? ` ほか ${live.length - 1} 本` : "";
  return { live: true, text: `制作中: ${p.title || p.project_id} ・ ${where}${more}` };
}

export function filterSort(projects, filter = "all", sort = "new") {
  let list = projects.slice();
  if (filter === "done") list = list.filter(isDone);
  else if (filter === "wip") list = list.filter((p) => !isDone(p));
  if (sort === "len") list.sort((a, b) => (Number(b.duration_seconds) || 0) - (Number(a.duration_seconds) || 0));
  else list.sort((a, b) => madeAt(b) - madeAt(a));
  return list;
}

export function totals(projects) {
  const done = projects.filter(isDone).length;
  const seconds = projects.reduce((t, p) => t + (Number(p.duration_seconds) || 0), 0);
  return { all: projects.length, done, wip: projects.length - done, seconds };
}

export const EXAMPLES = [
  ["説明する動画", "30 秒で、紙ひこうきの折り方を説明する動画を作って"],
  ["雰囲気の動画", "静かな音楽で、雨の日の窓を写す 20 秒の動画を作って"],
  ["台本から作る", "この台本(台本.md)から、字幕つきの 1 分の動画を作って"],
];

export const LENGTHS = ["20 秒", "30 秒", "1 分", "2 分"];
export const MOODS = ["静かな音楽で", "明るい調子で", "語りと字幕つきで"];

export function buildAsk({ what = "", len = "30 秒", mood = "静かな音楽で" } = {}) {
  const topic = String(what).trim().slice(0, 40) || "近所の坂道の四季";
  return `${mood}、${topic}を見せる ${len}の動画を作って`;
}

// 使い方(backlot/USAGE.md)を画面に出すための小さな読み取り。
// 見出し・段落・箇条・番号・表と、**太字**・`コード` だけ。HTML にはせず、文字のまま渡す。
export function parseDoc(md) {
  const blocks = [];
  const lines = String(md ?? "").replace(/\r/g, "").split("\n");
  let list = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { list = null; continue; }
    let m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) { list = null; blocks.push({ type: "h", level: m[1].length, text: m[2].trim() }); continue; }
    if (line.trim().startsWith("|")) {
      const rows = [];
      for (; i < lines.length && lines[i].trim().startsWith("|"); i++) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
      }
      i--; list = null;
      blocks.push({ type: "table", rows });
      continue;
    }
    m = line.match(/^(\s*)(?:[-*]|(\d+)\.)\s+(.*)$/);
    if (m) {
      const depth = Math.floor(m[1].length / 2);
      const ordered = Boolean(m[2]);
      if (!list || (depth === 0 && list.ordered !== ordered)) {
        list = { type: "list", ordered, items: [] };
        blocks.push(list);
      }
      list.items.push({ depth, text: m[3].trim() });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (!list && last && last.type === "p") last.text += line.trim();
    else { list = null; blocks.push({ type: "p", text: line.trim() }); }
  }
  return blocks;
}

// "**完成** は `renders/`" → [{kind:"b"}, {kind:"text"}, {kind:"code"}]
export function inlineParts(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    out.push(m[1] !== undefined ? { kind: "b", text: m[1] } : { kind: "code", text: m[2] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}
