# 🌱 theGarden

> 对标《The Bazaar》的异步 PvP 微信小游戏
> 核心玩法：网格背包 + 自动战斗 + 异步对战（花园主题）

## 游戏概述

theGarden 是一款花园主题的策略游戏。玩家在 10×10 网格中布置物品，物品按冷却时间自动触发效果进行战斗。通过**幽灵数据**实现异步 PvP——你打的是对手的快照，不需要双方同时在线。

### 核心循环

```
商店购买 → 网格布局 → 自动战斗 → 结算奖励 → 下一天
```

### 关键机制

- **网格背包**：10×10 二维网格，物品有不同尺寸（1×1 / 2×1 / 1×2 / 2×2），摆放位置影响协同效果
- **时间轴战斗**：物品按冷却时间自动触发，支持 8 种状态效果（Charge/Haste/Freeze/Slow/Poison/Shield/Burn/Regen）
- **确定性战斗**：种子随机数保证同一快照 + 同一种子 = 相同结果，支持回放和服务端验证
- **异步 PvP**：上传背包快照为"幽灵"，MMR 匹配，离线也能被挑战

## 项目状态

| 里程碑 | 状态 | 说明 |
|--------|------|------|
| M1 — 核心原型 | ✅ 完成 | 网格系统 + 战斗引擎 + 10 个物品 |
| M2 — 单机循环 | ✅ 完成 | 商店 + Day 循环 + AI 对手 + 完整阶段流转 |
| M3 — Cocos 场景集成 | ✅ 完成 | 4 个 UI 面板 + 场景流转 + 屏幕适配 |
| M4 — 联网对战 | 🔜 | 微信云开发 + 幽灵数据 + MMR 匹配 |
| M5 — 内容扩展 | 📋 | 50+ 物品 + 平衡性调优 |
| M6 — 上线打磨 | 📋 | 性能优化 + 美术 + 微信审核 |

**当前统计**：19 个 TS 源文件，8,317 行 | 8 个测试文件，116 个测试用例 | tsc 0 errors

## 技术栈

- **引擎**：[Cocos Creator 3.8.8](https://www.cocos.com/creator)
- **语言**：TypeScript（strict mode）
- **目标平台**：微信小游戏（WeChat Mini Game）
- **后端**（M4）：微信云开发（Cloudbase）
- **开发工具**：LangGraph Pipeline + OpenClaw Agent 多代理协作

## 项目结构

```
theGarden/
├── assets/
│   ├── scripts/
│   │   ├── core/                 # 核心逻辑（无 Cocos 依赖）
│   │   │   ├── types.ts          # 类型定义（257 行）
│   │   │   ├── GridManager.ts    # 网格系统（263 行）
│   │   │   ├── BattleEngine.ts   # 时间轴战斗引擎（904 行）
│   │   │   ├── GameLoop.ts       # Day 循环控制器（504 行）
│   │   │   ├── ShopManager.ts    # 商店系统（241 行）
│   │   │   ├── ItemDB.ts         # 物品数据库（241 行）
│   │   │   ├── SceneFlowStateMachine.ts  # 阶段流转状态机（177 行）
│   │   │   └── MinHeap.ts        # 优先队列（123 行）
│   │   ├── ui/                   # Cocos 组件层
│   │   │   ├── MainScene.ts      # 主场景控制器（1,079 行）
│   │   │   ├── ShopPanel.ts      # 商店面板（1,596 行）
│   │   │   ├── BattlePanel.ts    # 战斗面板（864 行）
│   │   │   ├── GridPanelComp.ts  # 网格面板（541 行）
│   │   │   ├── HUD.ts            # 状态显示（337 行）
│   │   │   ├── ScreenAdapter.ts  # 屏幕适配（653 行）
│   │   │   ├── GridView.ts       # 网格视图（213 行）
│   │   │   └── drag/GridDragController.ts  # 拖拽控制器
│   │   └── utils/
│   │       └── SeededRandom.ts   # 种子随机数（66 行）
│   ├── scenes/
│   │   └── main.scene            # 主场景
│   └── configs/
│       └── items.json            # 10 个花园主题物品
├── tests/                        # Jest 单元测试
│   ├── core/                     # 核心逻辑测试（116 cases）
│   └── utils/                    # 工具类测试
├── tools/                        # CI 工具脚本
│   ├── preview-console.js        # 预览控制台捕获
│   ├── preview-debug.js          # 运行时状态检查
│   └── preview-ui-test.js        # UI 交互验证
├── docs/                         # 项目文档
│   ├── architecture.md           # 系统架构
│   ├── data-schema.md            # 数据结构定义
│   ├── PLAN.md                   # 里程碑计划
│   ├── dev-workflow.md           # 开发工作流
│   ├── cocos-scripting-guide.md  # Cocos 脚本指南
│   └── cocos-scene-serialization.md  # 场景序列化规范
├── tsconfig.json
├── jest.config.js
└── package.json
```

## 架构设计

```
┌──────────────────────────────────────────┐
│              UI Layer (Cocos)             │
│  MainScene ─ ShopPanel ─ GridPanelComp   │
│  BattlePanel ─ HUD ─ ScreenAdapter      │
└─────────────────┬────────────────────────┘
                  │ 调用
┌─────────────────┴────────────────────────┐
│           Core Layer (Pure TS)           │
│  GameLoop ─ ShopManager ─ GridManager    │
│  BattleEngine ─ ItemDB ─ MinHeap        │
│  SceneFlowStateMachine ─ SeededRandom    │
└──────────────────────────────────────────┘
```

**核心与 UI 分离**：`core/` 下的所有类都是纯 TypeScript，不依赖 Cocos 引擎，可以在 Node.js 中直接运行单元测试和无头模拟。`ui/` 层负责 Cocos 组件绑定和渲染。

## 物品系统

当前 10 个花园主题物品：

| 物品 | 稀有度 | 效果 |
|------|--------|------|
| 🌵 仙人掌 | Common | 基础伤害 |
| 🍄 毒蘑菇 | Uncommon | 持续中毒 |
| 🌻 向日葵 | Rare | 治疗回复 |
| 🌹 玫瑰荆棘 | Epic | 高额伤害 |
| 🌲 盾墙树 | Rare | 护盾吸收 |
| 🔥 火焰花 | Epic | 灼烧伤害 |
| ❄️ 冰雪花 | Rare | 冰冻控制 |
| ⚡ 闪电花 | Legendary | 充能加速 |
| 💖 心形花 | Epic | 持续回复 |
| 🌳 超级巨树 | Legendary | 高额护盾 |

物品按 Day 解锁稀有度：Common（Day 1+）→ Uncommon（Day 2+）→ Rare（Day 3+）→ Epic（Day 5+）→ Legendary（Day 8+）

## 快速开始

### 环境要求

- [Cocos Creator 3.8.8](https://www.cocos.com/creator)（Dashboard 安装）
- Node.js 18+
- Git 2.30+

### 运行

```bash
# 克隆
git clone https://github.com/PPPPanda/theGarden.git
cd theGarden

# 安装测试依赖
npm install

# 用 Cocos Creator 打开项目目录
# 或通过 Cocos Dashboard → 添加项目

# 运行测试
npx jest

# TypeScript 编译检查
npx tsc --noEmit
```

### 预览

在 Cocos Creator 中打开 `assets/scenes/main.scene`，点击预览按钮，或访问 `http://localhost:7456`。

## 开发

本项目使用 [LangGraph Pipeline](../dev-pipeline/ARCHITECTURE.md) 进行自动化多代理协作开发：

- **Planner**：需求分解为子任务
- **Coder**：TypeScript 编码 + Cocos 场景操作
- **CI**：7 层验证（编译/门禁/场景/运行时/UI 交互）
- **Reviewer**：代码审查 + 验收标准验证

详见 [`docs/dev-workflow.md`](docs/dev-workflow.md)。

## 文档

| 文档 | 说明 |
|------|------|
| [architecture.md](docs/architecture.md) | 核心系统架构 |
| [data-schema.md](docs/data-schema.md) | 数据结构定义（对应 `types.ts`） |
| [PLAN.md](docs/PLAN.md) | 里程碑计划 |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | 项目开发文档 |
| [dev-workflow.md](docs/dev-workflow.md) | LangGraph Pipeline 工作流 |
| [cocos-scripting-guide.md](docs/cocos-scripting-guide.md) | Cocos 3.8 脚本指南 |
| [cocos-scene-serialization.md](docs/cocos-scene-serialization.md) | 场景序列化规范 |

## License

Private — All Rights Reserved
