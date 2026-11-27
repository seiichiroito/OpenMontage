"""AI動画ハブ (fork): the library page, its summary fields and /api/info."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from tests.backlot.test_server import _make_project, _write_json, client, projects_root  # noqa: F401
from backlot import server as server_mod

ROOT = Path(__file__).resolve().parents[2]


def test_summary_has_shelf_fields(client, projects_root):  # noqa: F811
    project = _make_project(projects_root, "film")
    _write_json(project / "artifacts" / "scene_plan.json",
                {"version": "1.0", "metadata": {"total_duration_seconds": 48}, "scenes": []})
    body = client.get("/api/projects").json()[0]
    assert body["created_at"] == "2026-07-02T00:00:00Z"
    assert body["duration_seconds"] == 48
    assert body["stage_count"] >= 1


def test_info_hides_absolute_paths(client):  # noqa: F811
    repo_dir = client.get("/api/info").json()["repo_dir"]
    assert repo_dir.startswith("~") or "/" not in repo_dir


def test_display_path(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    assert server_mod._display_path(tmp_path / "Project" / "OpenMontage") == "~/Project/OpenMontage"
    assert server_mod._display_path(Path("/opt/elsewhere/OpenMontage")) == "OpenMontage"


def test_usage_doc_is_served(client):  # noqa: F811
    res = client.get("/usage.md")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/markdown")
    body = res.text
    for word in (".env", "projects/", "renders/", "確認待ち"):
        assert word in body


def test_library_page_is_japanese(client):  # noqa: F811
    html = client.get("/").text
    assert 'lang="ja"' in html
    assert "AI動画ハブ" in html and "使い方" in html
    assert "/ui/library.css?v=" in html


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
def test_library_model_js():
    result = subprocess.run(
        ["node", "--test", str(ROOT / "tests" / "backlot" / "library_model.test.mjs")],
        capture_output=True, text=True, cwd=ROOT,
    )
    assert result.returncode == 0, result.stdout + result.stderr
