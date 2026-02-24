#!/usr/bin/env python3
"""
query_scene.py — 查询 Cocos Creator 当前场景信息

策略（双模式）：
  1. 尝试连接 Cocos Creator MCP Server（编辑器运行时）
  2. 降级：解析项目 .scene 文件（离线模式）

输出 JSON：
  { "sceneName": "main", "nodeCount": 87, "source": "editor"|"file" }
"""

import json
import sys
import os
import urllib.request
import urllib.error
from pathlib import Path

# ─── 配置 ──────────────────────────────────────────────────────────────────────

# Cocos Creator MCP Server 默认端口（cocos-mcp-server 插件）
COCOS_MCP_URL = os.getenv("COCOS_MCP_URL", "http://localhost:7456")

# 项目根目录（含 .scene 文件的 Cocos 项目）
PROJECT_ROOT = os.getenv(
    "COCOS_PROJECT",
    str(Path(__file__).parent.parent / "project" / "NewProject"),
)

# ─── MCP 模式：查询编辑器 ──────────────────────────────────────────────────────

def query_via_mcp() -> dict | None:
    """
    通过 Cocos Creator MCP Server 查询当前打开的场景。
    返回 None 表示编辑器不可达。
    """
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "scene_query",
            "arguments": {}
        },
        "id": 1
    }).encode()

    try:
        req = urllib.request.Request(
            f"{COCOS_MCP_URL}/mcp",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read())
            result = data.get("result", {})
            # cocos-mcp-server 返回场景树结构
            scene_name = result.get("sceneName") or result.get("name", "unknown")
            node_count = _count_nodes_in_tree(result.get("children", []))
            return {
                "sceneName": scene_name,
                "nodeCount": node_count,
                "source": "editor",
            }
    except (urllib.error.URLError, OSError, json.JSONDecodeError):
        return None


def _count_nodes_in_tree(children: list) -> int:
    """递归统计场景树节点数。"""
    count = len(children)
    for child in children:
        count += _count_nodes_in_tree(child.get("children", []))
    return count


# ─── 文件模式：解析 .scene 文件 ───────────────────────────────────────────────

def get_launch_scene(project_root: str) -> str | None:
    """
    从项目设置中读取启动场景路径。
    Cocos Creator 3.x 将启动场景写在 settings/v2/packages/builder.json 中。
    """
    builder_cfg = Path(project_root) / "settings" / "v2" / "packages" / "builder.json"
    if builder_cfg.exists():
        try:
            cfg = json.loads(builder_cfg.read_text(encoding="utf-8"))
            # startScene 格式形如 "db://assets/main.scene"
            start = cfg.get("startScene", "")
            if start:
                # 转换为本地路径
                rel = start.replace("db://", "").replace("/", os.sep)
                return str(Path(project_root) / rel)
        except (json.JSONDecodeError, KeyError):
            pass
    return None


def find_scenes(project_root: str) -> list[Path]:
    """列出项目 assets 目录下所有 .scene 文件，按文件大小降序（越大越复杂）。"""
    assets = Path(project_root) / "assets"
    scenes = list(assets.rglob("*.scene"))
    return sorted(scenes, key=lambda p: p.stat().st_size, reverse=True)


def count_nodes_in_scene(scene_path: str) -> tuple[str, int]:
    """
    解析 Cocos Creator .scene 文件（JSON 格式），返回 (场景名, 节点数)。
    节点类型：cc.Scene、cc.Node（及其子类如 cc.Canvas 等）
    """
    with open(scene_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    scene_name = Path(scene_path).stem  # 文件名即场景名
    node_count = 0

    if isinstance(data, list):
        for entry in data:
            if not isinstance(entry, dict):
                continue
            t = entry.get("__type__", "")
            # cc.Scene 本身也算一个节点，cc.Node 及其子类均计入
            if t in ("cc.Scene", "cc.Node") or (
                t.startswith("cc.") and "Node" in t
            ):
                node_count += 1
            # 读取场景名（SceneAsset 的第一条记录）
            elif t == "cc.SceneAsset":
                scene_name = entry.get("_name", scene_name) or scene_name

    return scene_name, node_count


def query_via_file() -> dict:
    """
    离线模式：解析 .scene 文件获取场景信息。
    优先使用项目配置的启动场景，否则取节点数最多（文件最大）的场景。
    """
    # 1. 尝试读取启动场景
    launch = get_launch_scene(PROJECT_ROOT)
    if launch and Path(launch).exists():
        scene_path = launch
    else:
        # 2. 找最复杂（文件最大）的场景作为"当前"场景
        scenes = find_scenes(PROJECT_ROOT)
        if not scenes:
            return {"error": f"No .scene files found in {PROJECT_ROOT}"}
        scene_path = str(scenes[0])

    scene_name, node_count = count_nodes_in_scene(scene_path)
    return {
        "sceneName": scene_name,
        "nodeCount": node_count,
        "source": "file",
        "path": scene_path,
    }


# ─── 主入口 ────────────────────────────────────────────────────────────────────

def main():
    # 尝试编辑器模式
    result = query_via_mcp()
    if result is None:
        # 降级到文件解析
        result = query_via_file()

    print(json.dumps(result, ensure_ascii=False, indent=2))

    # 供 CI 快速检查：非零退出码 = 错误
    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    main()
