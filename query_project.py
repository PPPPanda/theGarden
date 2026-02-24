#!/usr/bin/env python3
"""
query_project.py — 查询 Cocos Creator 项目名称

策略（双模式）：
  1. 尝试连接 Cocos Creator MCP Server（编辑器运行时）
  2. 降级：读取项目 package.json（离线模式）

输出 JSON：
  { "projectName": "theGarden", "version": "3.8.8", "source": "editor"|"file" }
"""

import json
import sys
import os
import urllib.request
import urllib.error
from pathlib import Path

# ─── 配置 ──────────────────────────────────────────────────────────────────────

COCOS_MCP_URL = os.getenv("COCOS_MCP_URL", "http://localhost:7456")

PROJECT_ROOT = os.getenv(
    "COCOS_PROJECT",
    str(Path(__file__).parent.parent / "project" / "NewProject"),
)

# ─── MCP 模式 ─────────────────────────────────────────────────────────────────

def query_via_mcp() -> dict | None:
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": "project_info", "arguments": {}},
        "id": 1,
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
            name = result.get("projectName") or result.get("name")
            if not name:
                return None
            return {
                "projectName": name,
                "version": result.get("version", "unknown"),
                "source": "editor",
            }
    except (urllib.error.URLError, OSError, json.JSONDecodeError):
        return None

# ─── 文件模式 ─────────────────────────────────────────────────────────────────

def query_via_file() -> dict:
    pkg = Path(PROJECT_ROOT) / "package.json"
    if not pkg.exists():
        return {"error": f"package.json not found in {PROJECT_ROOT}"}

    try:
        data = json.loads(pkg.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return {"error": f"Failed to parse package.json: {e}"}

    name = data.get("name")
    if not name:
        return {"error": "No 'name' field found in package.json"}

    return {
        "projectName": name,
        "creatorVersion": data.get("creator", {}).get("version", "unknown"),
        "uuid": data.get("uuid", ""),
        "source": "file",
        "path": str(pkg),
    }

# ─── 主入口 ───────────────────────────────────────────────────────────────────

def main():
    result = query_via_mcp()
    if result is None:
        result = query_via_file()

    print(json.dumps(result, ensure_ascii=False, indent=2))
    if "error" in result:
        sys.exit(1)

if __name__ == "__main__":
    main()
