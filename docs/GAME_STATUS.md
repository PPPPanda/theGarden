# theGarden — 游戏开发全貌文档

> 最后更新：2026-03-10
> 版本：M3 完成（Cocos 场景集成）
> 引擎：Cocos Creator 3.8.8 | 语言：TypeScript strict | 平台：微信小游戏

---

## 1. 游戏概述

**一句话定位：** 花园主题的异步 PvP 策略小游戏，对标《The Bazaar》。

**核心玩法：** 10×10 网格背包 + 时间轴自动战斗 + 幽灵数据异步对战。

玩家在花园中种植各种植物（物品），植物有不同大小和技能。战斗时，植物按冷却时间自动释放技能。不需要对手在线——挑战的是对手的"幽灵快照"。

---

## 2. 游戏流程

```
     ┌──────────────────────────────────────────────┐
     │                                              │
     ▼                                              │
 Loading ──→ Shop ──→ Grid ──→ Battle ──→ Result ──┘
              │        │        │
              │        │        └─ 自动战斗（5-15秒）
              │        └─ 整理背包、拖拽物品
              └─ 花金币买物品、锁定/刷新商店
```

### 阶段详解

| 阶段 | 做什么 | 时长 | 背景色 |
|------|--------|------|--------|
| **Loading** | 初始化游戏数据 | 自动跳过 | 深蓝 #1A237E |
| **Shop** | 从 5 个槽位中购买植物 | 玩家操作 | 暖黄 #FFF8E1 |
| **Grid** | 把植物拖放到 10×10 网格中 | 玩家操作 | 浅绿 #E8F5E9 |
| **Battle** | 植物自动战斗（时间轴驱动） | 5-60秒 | 浅红 #FFEBEE |
| **Result** | 显示胜负、奖励、继续下一天 | 玩家点击 | 浅蓝 #E3F2FD |

### 状态机（合法转换）

```
Loading → Shop
Shop → Grid
Grid → Battle / Shop（可回退）
Battle → Result / Grid（可中断）
Result → Shop（新一天开始）
```

每个转换由 `SceneFlowStateMachine` 严格守卫，非法转换被拒绝。

---

## 3. 物品（植物）系统

### 3.1 当前物品一览（10 个）

| 物品 | 稀有度 | 尺寸 | CD | 花费 | 效果 |
|------|--------|------|----|------|------|
| 🌵 仙人掌 | Common | 1×1 | 3s | 10金 | 对敌造成 8 伤害（反弹） |
| 🍄 毒蘑菇 | Uncommon | 1×1 | 4s | 15金 | 对敌施加中毒（3点/秒×5秒） |
| 🌻 向日葵 | Rare | 1×1 | 5s | 20金 | 治疗自己 12 HP |
| ❄️ 冰雪花 | Rare | 1×1 | 6s | 22金 | 冰冻敌人 3 秒 |
| 🌲 盾墙树 | Rare | 2×2 | 8s | 30金 | 给自己加护盾（10点×6秒） |
| 🔥 火焰花 | Epic | 1×1 | 3s | 32金 | 对敌施加灼烧（5点/秒×4秒） |
| 🌹 玫瑰荆棘 | Epic | 1×2 | 4s | 35金 | 对敌 15 伤害 + 吸血 5 HP |
| 💖 心形花 | Epic | 1×2 | 7s | 45金 | 治疗 20 HP + 再生（4点/秒×5秒） |
| ⚡ 闪电花 | Legendary | 1×1 | 2s | 50金 | 对敌 6 伤害 + 自身急速 3 秒 |
| 🌳 超级巨树 | Legendary | 2×2 | 10s | 80金 | 开战时 15 护盾×10秒 + 每轮治疗 8 HP |

### 3.2 稀有度

| 稀有度 | 权重 | Day 解锁 |
|--------|------|----------|
| Common | 50% | Day 1+ |
| Uncommon | 30% | Day 4+ |
| Rare | 15% | Day 7+ |
| Epic | 4% | Day 10+ |
| Legendary | 1% | Day 13+ |

### 3.3 物品尺寸

| 类型 | 格子 | 示例 |
|------|------|------|
| Small | 1×1 | 仙人掌、火焰花 |
| Medium | 1×2 | 玫瑰荆棘、心形花 |
| Large | 2×2 | 盾墙树、超级巨树 |

### 3.4 物品数据结构

```typescript
interface IGridItem {
    id: string;              // 唯一实例 ID
    templateId: string;      // 模板 ID（对应 items.json）
    name: string;            // 名称
    rarity: ItemRarity;      // 稀有度
    size: ItemSize;          // 尺寸类型
    gridSize: IGridSize;     // 实际占格 { rows, cols }
    position: IGridPosition; // 网格坐标（左下角锚点）
    cooldown: number;        // 冷却时间（秒）
    currentCooldown: number; // 剩余冷却
    effects: IItemEffect[];  // 效果列表
    level: number;           // 等级
    destroyed: boolean;      // 是否被摧毁
    enchantments: string[];  // 附魔
}
```

---

## 4. 核心机制

### 4.1 网格背包（GridManager）

- **大小：** 10×10 格子
- **坐标：** 左下角 `(0,0)`，row 向上增，col 向右增
- **碰撞检测：** 放置时遍历物品 gridSize 覆盖的所有格子，检查 occupied 状态
- **邻接查询：** 获取物品周围一圈格子中的其他物品（去重）
- **拖拽：** GridDragController 处理触摸拖放，支持交换位置

关键方法：
```
placeItem(item, position) → boolean
removeItem(itemId) → boolean
canPlace(position, gridSize) → boolean
getAdjacentItems(itemId) → IGridItem[]
```

### 4.2 商店系统（ShopManager）

- **槽位数：** 5 个
- **刷新机制：** 按 Day + 稀有度权重随机
- **锁定：** 玩家可锁定某个槽位保留到下一轮
- **已购标记：** purchased = true 后不可重复购买

```
refreshShop(gold, day) → IShopState
buyItem(slotIndex, gold) → { item, remainingGold }
toggleLock(slotIndex) → boolean
```

### 4.3 战斗引擎（BattleEngine）

- **驱动方式：** 时间轴 + 优先队列（MinHeap）
- **冷却调度：** 每个物品有 CD，CD 完成后触发效果，然后重新入队
- **确定性：** 种子随机数（SeededRandom），同一快照+同一种子=相同结果
- **时长：** 最多 60 秒，超时判负/判平

#### 状态效果

| 效果 | 类型 | 说明 |
|------|------|------|
| Charge | buff | 立即推进物品冷却进度 |
| Haste | buff | 冷却速度 ×2 |
| Slow | debuff | 冷却速度 ×0.5 |
| Freeze | debuff | 冷却暂停 |
| Poison | debuff | 每秒固定伤害 |
| Burn | debuff | 每秒灼烧伤害 |
| Shield | buff | 吸收下一次伤害（可叠层） |
| Regen | buff | 每秒回复生命 |

#### 触发时机

| 时机 | 说明 |
|------|------|
| on_cooldown_complete | 冷却完成时触发（最常见） |
| on_battle_start | 战斗开始时一次性触发 |
| on_damage_taken | 受伤时触发 |
| on_damage_dealt | 造成伤害时触发 |
| on_item_destroyed | 物品被摧毁时触发 |
| on_adjacent_trigger | 相邻物品触发时连锁 |
| on_heal | 治疗时触发 |
| passive | 被动常驻效果 |

### 4.4 异步 PvP（幽灵系统）

- **离线对战：** 玩家挑战对手的"幽灵快照"，不需要双方同时在线
- **幽灵数据：** 序列化的精简背包状态（`IGhostData`）
- **匹配：** MMR ±200 范围内随机匹配
- **反作弊：** 服务端可用相同种子重放验证结果
- **状态：** 🔴 尚未实现（M3 后端部分）

### 4.5 游戏循环（GameLoop）

```
Day 1: Shop → Grid → Battle → Result
Day 2: Shop → Grid → Battle → Result
...
```

每天：
1. 商店刷新（根据 Day 解锁稀有度）
2. 玩家购买+整理
3. 匹配幽灵对手
4. 自动战斗
5. 结算金币/经验

---

## 5. 场景节点结构

```
Scene (main.scene)
├── Main Camera
├── Canvas (720×1280, portrait)
│   ├── Background [UITransform, Graphics]     ← 阶段背景色绘制
│   └── Root [UITransform, MainScene, ScreenAdapter]
│       ├── HUD [UITransform, HUD, Graphics]   ← 顶部状态栏
│       │   ├── TopBar
│       │   │   ├── GoldText                   ← 金币显示
│       │   │   └── DayText                    ← 天数显示
│       │   ├── HpBar
│       │   │   ├── HpBarBg                    ← 血条背景
│       │   │   └── HpBarFill                  ← 血条填充
│       │   └── HpText                         ← HP 数值
│       │
│       ├── ShopPanel [UITransform, ShopPanel, Graphics]  ← 商店面板
│       │   ├── ShopTitle                      ← "花园商店"
│       │   ├── SlotsContainer                 ← 5 个商品槽
│       │   │   ├── Slot0~4 [Button]           ← 每个槽位
│       │   │   │   ├── ItemEmoji [Label]      ← 植物 emoji
│       │   │   │   ├── ItemName [Label]       ← 名称
│       │   │   │   ├── ItemPrice [Label]      ← 价格
│       │   │   │   ├── LockIcon [Label]       ← 🔒
│       │   │   │   └── BuyButton [Button]     ← 购买按钮
│       │   │   └── ...
│       │   ├── RefreshButton [Button]         ← 刷新商店
│       │   └── PurchasedList                  ← 已购物品列表
│       │
│       ├── GridPanel [UITransform, GridPanelComp, Graphics]  ← 网格面板
│       │   └── GridContainer                  ← 10×10 格子容器
│       │
│       ├── BattlePanel [UITransform, BattlePanel, Graphics]  ← 战斗面板
│       │   ├── battleContainer                ← 战斗主区域
│       │   ├── battleInfoPanel                ← 战斗信息
│       │   │   ├── TimerLabel                 ← 倒计时
│       │   │   ├── TimelineBar                ← 时间轴进度
│       │   │   ├── PlayerHpBar                ← 玩家血条
│       │   │   └── EnemyHpBar                 ← 对手血条
│       │   ├── eventLogPanel                  ← 战斗日志
│       │   ├── resultPanel                    ← 结算面板
│       │   │   ├── ResultTitleLabel           ← "胜利/失败"
│       │   │   ├── DamageSummaryLabel         ← 伤害统计
│       │   │   ├── RewardsLabel               ← 奖励
│       │   │   └── ContinueButton             ← 继续按钮
│       │   ├── floatingTextLayer              ← 飘字层
│       │   ├── playerStatusIcons              ← 玩家状态图标
│       │   └── enemyStatusIcons               ← 对手状态图标
│       │
│       └── FlowControls [UITransform]         ← 底部流程按钮
│           ├── EnterGridBtn [Button, Graphics] ← "进入背包"
│           │   └── EnterGridLabel [Label]
│           ├── StartBattleBtn [Button, Graphics] ← "开始战斗"
│           │   └── StartBattleLabel [Label]
│           └── ContinueNextDayBtn [Button, Graphics] ← "下一天"
│               └── ContinueNextDayLabel [Label]
```

### 节点职责

| 节点 | 脚本 | 职责 |
|------|------|------|
| Root | **MainScene** | 总控：阶段切换、面板显隐、背景色绘制、按钮事件 |
| Root | **ScreenAdapter** | 竖屏适配 720×1280 |
| HUD | **HUD** | 顶栏：金币、天数、血量显示 |
| ShopPanel | **ShopPanel** | 商店：5 槽位展示、购买、锁定、刷新 |
| GridPanel | **GridPanelComp** | 网格：10×10 格子渲染、物品放置 |
| BattlePanel | **BattlePanel** | 战斗：时间轴可视化、血条、战斗日志、结算 |

---

## 6. 代码架构

### 6.1 文件清单（8,584 行）

```
assets/scripts/
├── core/                    # 核心逻辑（纯 TS，不依赖 Cocos）
│   ├── types.ts        (257行)  # 全局类型定义
│   ├── BattleEngine.ts (904行)  # 时间轴战斗引擎
│   ├── GameLoop.ts     (504行)  # 游戏循环控制
│   ├── GameManager.ts  (258行)  # 游戏状态管理
│   ├── GridManager.ts  (263行)  # 网格背包逻辑
│   ├── ItemDB.ts       (241行)  # 物品数据库
│   ├── MinHeap.ts      (123行)  # 优先队列（战斗调度用）
│   ├── SceneFlowStateMachine.ts (177行) # 阶段状态机
│   └── ShopManager.ts  (241行)  # 商店逻辑
│
├── ui/                      # UI 层（依赖 Cocos API）
│   ├── MainScene.ts    (1231行) # 主场景总控
│   ├── ShopPanel.ts    (1639行) # 商店面板
│   ├── BattlePanel.ts  (888行)  # 战斗面板
│   ├── GridPanelComp.ts(565行)  # 网格面板
│   ├── HUD.ts          (361行)  # 顶部状态栏
│   ├── ScreenAdapter.ts(653行)  # 屏幕适配
│   ├── GridView.ts     (213行)  # 格子视图
│   └── drag/
│       └── GridDragController.ts (458行) # 拖拽控制器（未启用）
│
├── utils/
│   └── SeededRandom.ts  (66行)  # 种子随机数
│
└── cc.d.ts                  # Cocos 类型声明

configs/
└── items.json               # 10 个物品模板

tools/                       # CI/Preview 工具
├── preview-common.js        # 预览共享库
├── preview-console.js       # 控制台日志检查
├── preview-debug.js         # 调试工具
└── preview-ui-test.js       # UI 测试
```

### 6.2 核心 vs UI 分离

```
core/（纯逻辑层）              ui/（渲染层）
├── GridManager ──────────→ GridPanelComp
├── ShopManager ──────────→ ShopPanel
├── BattleEngine ─────────→ BattlePanel
├── GameLoop ─────────────→ MainScene（协调所有面板）
├── GameManager ──────────→ HUD
└── SceneFlowStateMachine → MainScene（阶段切换）
```

core 可以纯 Node.js 跑测试（jest），不依赖 Cocos。UI 层是 Cocos 组件。

### 6.3 测试覆盖

| 测试文件 | 覆盖模块 | 用例数 |
|----------|----------|--------|
| BattleEngine.test.ts | 战斗引擎 | 多项 |
| GameLoop.test.ts | 游戏循环 | 多项 |
| GridManager.test.ts | 网格管理 | 多项 |
| ItemDB.test.ts | 物品数据库 | 多项 |
| MinHeap.test.ts | 优先队列 | 多项 |
| SceneFlowStateMachine.test.ts | 状态机 | 多项 |
| ShopManager.test.ts | 商店逻辑 | 多项 |
| SeededRandom.test.ts | 随机数 | 多项 |
| **合计** | **8 suites** | **116 tests** |

---

## 7. 里程碑状态

| 里程碑 | 内容 | 状态 |
|--------|------|------|
| **M1** | 核心原型：网格背包拖拽 + 单机战斗演算 | ✅ 完成 |
| **M2** | 完整单机循环：商店 + 背包 + 战斗 + Day 循环 | ✅ 完成 |
| **M3** | Cocos 场景集成：所有 UI 面板可交互 | ✅ 完成 |
| **M4** | 联网对战：幽灵数据上传/下载 + MMR 匹配 | 🔴 未开始 |
| **M5** | 内容扩展：50+ 物品、平衡性调优、成就系统 | 🔴 未开始 |
| **M6** | 上线打磨：性能优化、引导教程、微信审核 | 🔴 未开始 |

### 当前进行中

- UI 修复：背景色绘制（Task 1/6 已完成，剩余 5 个 subtask）
- 商店面板：slot 布局竖屏适配
- FlowControls：按钮背景可见性
- 锁定图标：层级修复

---

## 8. 技术约束

| 约束 | 限制 | 应对 |
|------|------|------|
| 首包大小 | 4MB | 核心逻辑+最小资源，其余走子包/CDN |
| 内存峰值 | 100-150MB | 对象池、纹理压缩 |
| 屏幕方向 | 竖屏 720×1280 | ScreenAdapter 自适应 |
| DrawCall | < 50 | 2D 为主，合批 |
| 存储 | wx.setStorage 10MB | 关键数据上云 |

---

## 9. 开发工具链

| 工具 | 用途 |
|------|------|
| Cocos Creator 3.8.8 | 场景编辑、构建 |
| Cocos MCP Server | Agent 操作场景节点（端口 3101） |
| LangGraph Pipeline | AI 开发流水线（plan→code→ci→review） |
| Jest | 单元测试（116 tests） |
| TypeScript strict | 类型检查 |
| GitHub | 代码托管（PPPPanda/theGarden） |
| Mission Control | 任务看板（localhost:8000） |

---

## 10. 配置文件

| 文件 | 说明 |
|------|------|
| `configs/items.json` | 10 个物品模板 |
| `settings/v2/packages/builder.json` | 构建设置 |
| `tsconfig.json` | TypeScript 配置 |
| `jest.config.js` | Jest 测试配置 |
| `package.json` | 依赖管理 |
