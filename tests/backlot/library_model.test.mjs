// node --test tests/backlot/library_model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAsk, filterSort, fmtDate, fmtLength, fmtTotal, inlineParts, isDone, liveState, parseDoc, progress, stageLabel, totals,
} from "../../backlot/ui/library-model.js";

const st = (pairs) => pairs.map(([name, status]) => ({ name, status }));
const done = { project_id: "a", title: "森の音", created_at: "2026-10-05T09:00:00Z", duration_seconds: 40,
  stage_states: st([["script", "completed"], ["edit", "completed"]]), stage_count: 2 };
const wip = { project_id: "b", title: "夜の灯台", created_at: "2026-11-20T09:00:00Z", duration_seconds: 48, live: true,
  stage_states: st([["script", "completed"], ["assets", "completed"], ["edit", "in_progress"], ["compose", "pending"]]), stage_count: 4 };
const waiting = { project_id: "c", title: "ロボットの朝", created_at: "2026-10-27T09:00:00Z",
  stage_states: st([["script", "awaiting_human"], ["edit", "pending"]]), stage_count: 2 };

test("段階の名前は日本語", () => {
  assert.equal(stageLabel("scene_plan"), "場面割り");
  assert.equal(stageLabel("rig_plan"), "rig plan");
});

test("長さの書き方", () => {
  assert.equal(fmtLength(48), "48 秒");
  assert.equal(fmtLength(60), "60 秒");
  assert.equal(fmtLength(80), "1 分 20 秒");
  assert.equal(fmtLength(null), "");
  assert.equal(fmtTotal(510), "8 分 30 秒");
  assert.equal(fmtTotal(120), "2 分");
});

test("日付は今年なら月/日", () => {
  const t = Date.parse("2026-11-20T12:00:00") / 1000;
  assert.equal(fmtDate(t, new Date("2026-11-26")), "11/20");
  assert.equal(fmtDate(t, new Date("2027-01-02")), "2026/11/20");
});

test("完成と作りかけ", () => {
  assert.equal(isDone(done), true);
  assert.deepEqual(progress(wip), { done: false, label: "編集 3/4" });
  assert.deepEqual(progress(waiting), { done: false, label: "確認待ち: 台本" });
  assert.equal(isDone({ stage_states: [], render_count: 1 }), true);
  assert.equal(isDone({ stage_states: [], render_count: 0 }), false);
});

test("状態の札: 待機 / 制作中", () => {
  assert.deepEqual(liveState([done]), { live: false, text: "待機" });
  assert.deepEqual(liveState([done, wip]), { live: true, text: "制作中: 夜の灯台 ・ 編集 3/4" });
});

test("しぼる・並べる・数字", () => {
  const all = [done, wip, waiting];
  assert.deepEqual(filterSort(all).map((p) => p.project_id), ["b", "c", "a"]);
  assert.deepEqual(filterSort(all, "done").map((p) => p.project_id), ["a"]);
  assert.deepEqual(filterSort(all, "wip", "len").map((p) => p.project_id), ["b", "c"]);
  assert.deepEqual(totals(all), { all: 3, done: 1, wip: 2, seconds: 88 });
});

test("頼み方を組み立てる", () => {
  assert.equal(buildAsk({ what: "  港の朝  ", len: "1 分", mood: "明るい調子で" }), "明るい調子で、港の朝を見せる 1 分の動画を作って");
  assert.equal(buildAsk({}), "静かな音楽で、近所の坂道の四季を見せる 30 秒の動画を作って");
});

test("使い方の文書を読み取る(見出し・箇条・番号・表・段落)", () => {
  const md = "# 題\n\n## 要るキー\n\n- `.env` に書きます。\n  - 下の段\n1. 開く\n2. 頼む\n\n| キー | 使い道 |\n|---|---|\n| `FAL_KEY` | 画像 |\n\n一行目\n二行目\n";
  assert.deepEqual(parseDoc(md), [
    { type: "h", level: 1, text: "題" },
    { type: "h", level: 2, text: "要るキー" },
    { type: "list", ordered: false, items: [{ depth: 0, text: "`.env` に書きます。" }, { depth: 1, text: "下の段" }] },
    { type: "list", ordered: true, items: [{ depth: 0, text: "開く" }, { depth: 0, text: "頼む" }] },
    { type: "table", rows: [["キー", "使い道"], ["`FAL_KEY`", "画像"]] },
    { type: "p", text: "一行目二行目" },
  ]);
  assert.deepEqual(inlineParts("**待機**: `<b>` のまま"), [
    { kind: "b", text: "待機" }, { kind: "text", text: ": " }, { kind: "code", text: "<b>" }, { kind: "text", text: " のまま" },
  ]);
});
