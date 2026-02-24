# theGarden — 开发工作流

> LangGraph Pipeline + Git Worktree 多代理协作开发流程

## 1. 仓库结构

```
theGarden/                  ← main 分支（reviewer 只读审查）
├── .git/                   ← 共享 Git 仓库
├── assets/
├── docs/
└── ...

game-repo__coder/           ← dev 分支（coder 工作区，git worktree）
├── assets/
└── ...

game-repo__ci/              ← detached HEAD（CI 构建/测试，git worktree）
├── assets/
└── ...
```

三个目录是同一个 Git 仓库的不同 worktree，共享历史和分支。

## 2. 分支策略

```
main ──────────────────────────────────── 稳定版本
  │
  └── dev ── feature/* ── 开发中 ──→ PR → main
```

- `main` — 稳定版本，通过 PR 合入
- `dev` — 开发主线，coder 在此工作
- `feature/*` — 功能分支（可选，较大功能时使用）

## 3. LangGraph Pipeline 工作流

### 3.1 流程概览

```
用户需求
    │
    ▼
┌─────────┐    分析拆解     ┌─────────┐    编写代码     ┌─────────┐
│   PM    │ ──────────→   │  Coder  │ ──────────→   │   CI    │
│ (Opus)  │               │(MiniMax)│               │(MiniMax)│
└─────────┘               └─────────┘               └─────────┘
    ▲                          │                         │
    │         代码审查         ▼         构建/测试        ▼
    │       ┌──────────┐                              结果反馈
    │       │ Reviewer │ ←────────────────────────────────┘
    │       │(MiniMax) │
    │       └──────────┘
    │              │
    └──────────────┘
        合格 → merge to main
        不合格 → 返回 Coder 修改
```

### 3.2 角色职责

| 角色 | 模型 | 工作区 | 分支 | 职责 |
|------|------|--------|------|------|
| PM | Opus | — | — | 需求分析、任务拆解、方案设计、验收 |
| Coder | MiniMax | game-repo__coder | dev | 编写代码、单元测试、提交 |
| Reviewer | MiniMax | theGarden | main | 代码审查、质量把控、合规检查 |
| CI | MiniMax | game-repo__ci | detached | 构建验证、自动化测试、lint |

### 3.3 Coder 工作规范

```bash
# 1. 同步最新代码
cd game-repo__coder
git checkout dev
git pull origin dev

# 2. 编写代码
# ... 修改 assets/scripts/ 下的文件 ...

# 3. 提交
git add .
git commit -m "feat(grid): implement GridManager placement logic"

# 4. 推送
git push origin dev
```

**Commit 规范：**
```
<type>(<scope>): <description>

type: feat | fix | refactor | docs | test | chore
scope: grid | battle | shop | ui | net | config
```

### 3.4 CI 验证流程

```bash
cd game-repo__ci

# 1. 获取待验证的提交
git fetch origin dev
git checkout FETCH_HEAD

# 2. TypeScript 编译检查
npx tsc --noEmit

# 3. ESLint 代码规范
npx eslint assets/scripts/ --ext .ts

# 4. 单元测试（如有）
npx jest --passWithNoTests

# 5. 报告结果
```

### 3.5 Reviewer 审查清单

- [ ] 代码是否符合 `types.ts` 中定义的接口？
- [ ] 是否有硬编码的魔法数字？（应使用常量）
- [ ] 是否处理了边界情况？（网格越界、空物品等）
- [ ] 是否保持了战斗确定性？（所有随机数使用种子）
- [ ] 性能是否满足微信小游戏约束？
- [ ] 是否有内存泄漏风险？（事件监听器、定时器清理）

## 4. 开发阶段规划

### Phase 1 — 基建（当前）
- [x] 项目初始化（Cocos 3.8.8 空项目）
- [x] Git 仓库 + worktree 配置
- [x] 目录结构 + .gitkeep
- [x] 核心类型定义（types.ts）
- [x] 架构文档

### Phase 2 — 核心原型
- [ ] GridManager — 网格放置/移除/碰撞检测
- [ ] BattleEngine — 时间轴调度 + 战斗演算
- [ ] 物品配置表（items.json）— 10 个基础物品
- [ ] 基础 UI — 网格显示 + 拖拽

### Phase 3 — 完整循环
- [ ] ShopManager — 商店刷新/购买/锁定
- [ ] GameLoop — Day 循环 + 结算
- [ ] 场景流转 — Loading → Shop → Grid → Battle → Result

### Phase 4 — 联网
- [ ] 微信云开发集成
- [ ] GhostManager — 快照上传/下载
- [ ] MatchManager — MMR 匹配
- [ ] 战斗结果验证

### Phase 5 — 内容 & 上线
- [ ] 50+ 物品设计 + 平衡
- [ ] 美术资源集成
- [ ] 性能优化（首包 < 4MB）
- [ ] 微信审核 + 发布

## 5. 本地开发环境

### 前置要求
- Cocos Creator 3.8.8（Dashboard 安装）
- Node.js 18+
- Git 2.30+

### 首次配置
```bash
# 克隆仓库
git clone <repo-url> theGarden
cd theGarden

# 创建 worktree
git worktree add ../game-repo__coder dev
git worktree add ../game-repo__ci --detach HEAD

# 用 Cocos Creator 打开 theGarden 目录
# Editor 会自动生成 library/、temp/、.meta 文件
```

### 日常开发
1. 用 Cocos Creator 打开项目（编辑场景、预览）
2. 用 VS Code 编辑 TypeScript 代码
3. 在 `game-repo__coder` 目录提交代码
4. CI 在 `game-repo__ci` 目录验证

## 6. 注意事项

### .meta 文件
- **不要手动创建** `.meta` 文件
- Cocos Editor 首次打开时自动生成
- `.meta` 文件**需要**提交到 Git（它们记录资源 UUID，是项目的一部分）
- 如果 `.meta` 冲突，以 main 分支为准

### 微信小游戏构建
```bash
# 在 Cocos Creator 中：
# Project → Build → 选择"微信小游戏"平台
# 构建输出到 build/wechatgame/
```

### 内存管理
- 使用对象池（cc.NodePool）管理频繁创建/销毁的节点
- 纹理使用 Auto Atlas 合并，减少 DrawCall
- 及时释放不需要的资源（cc.assetManager.releaseAsset）
