# theGarden — 项目开发文档

> 最后更新：2026-02-28
> 当前版本：M3 完成（Cocos 场景集成）

---

## 1. 项目概况

### 1.1 定位

theGarden 是一款花园主题的异步 PvP 策略游戏，对标《The Bazaar》。核心玩法：10×10 网格背包 + 时间轴自动战斗 + 幽灵数据异步对战。

### 1.2 技术选型

| 项 | 选择 | 原因 |
|----|------|------|
| 引擎 | Cocos Creator 3.8.8 | 微信小游戏原生支持、中文生态、2D 性能好 |
| 语言 | TypeScript strict | 类型安全、与 Cocos 3.x 原生匹配 |
| 平台 | 微信小游戏 | 目标用户群、社交分享链路 |
| 后端 | 微信云开发 | 免运维、与小游戏天然集成 |
| 构建 | Cocos Builder → 微信开发者工具 | 官方工具链 |

### 1.3 当前数据

```
源文件:     19 个 TypeScript 文件
代码行数:   8,317 行（core 2,510 + ui 5,283 + utils 66 + drag 458）
测试文件:   8 个
测试用例:   116 个（全部通过）
tsc:       0 errors
场景:      1 个（main.scene）
物品:      10 个（5 个稀有度层级）
```

---

## 2. 核心系统详解

### 2.1 网格背包（GridManager）

**文件**：`assets/scripts/core/GridManager.ts`（263 行）

管理 10×10 二维网格的物品放置、移除、碰撞检测和邻接查询。

**API**：

| 方法 | 说明 |
|------|------|
| `placeItem(item, position)` | 放置物品（检查碰撞和边界） |
| `removeItem(itemId)` | 移除物品并释放格子 |
| `canPlace(gridSize, position)` | 检查是否可放置 |
| `getAdjacentItems(itemId)` | 获取相邻物品（去重） |
| `getItemAt(position)` | 查询某格子上的物品 |
| `getAllItems()` | 获取所有物品列表 |
| `autoArrange(items)` | 自动整理背包（贪心算法） |

**设计决策**：
- 坐标原点在左下角 `(0,0)`，与 Cocos 坐标系一致
- 物品锚点在左下角，`gridSize` 定义向右上方扩展
- `IGridCell.occupied` 和 `IGridCell.itemId` 双字段冗余，加速碰撞检测

### 2.2 战斗引擎（BattleEngine）

**文件**：`assets/scripts/core/BattleEngine.ts`（904 行）

时间轴调度的自动战斗系统，使用 MinHeap 优先队列管理事件。

**战斗流程**：
```
初始化：双方物品按冷却时间插入时间轴
  ↓
循环：弹出最早事件 → 处理效果 → 插入新事件
  ↓
终止：一方 HP ≤ 0 或超过最大时长（60 秒）
```

**8 种状态效果**：

| 效果 | 作用 | 实现 |
|------|------|------|
| Charge | 推进冷却进度 N 秒 | 直接修改事件时间 |
| Haste | 冷却速度 ×2 | 新事件时间 = 当前 + cd/2 |
| Slow | 冷却速度 ×0.5 | 新事件时间 = 当前 + cd×2 |
| Freeze | 暂停冷却 | 跳过事件插入 |
| Poison | 每秒固定伤害 | 注册 tick 事件 |
| Shield | 吸收伤害 | 伤害计算前检查 stacks |
| Burn | 百分比伤害 | 注册 tick 事件 |
| Regen | 持续回复 | 注册 tick 事件 |

**确定性保证**：
- `SeededRandom`（Mulberry32 算法）替代 `Math.random()`
- 同一 `randomSeed` + 同一状态 = 相同结果
- `eventLog` 记录所有事件，支持回放

**防无限循环**：`MIN_EVENT_INTERVAL = 0.01` 秒，防止 Charge 效果导致零时间自循环。

### 2.3 游戏循环（GameLoop）

**文件**：`assets/scripts/core/GameLoop.ts`（504 行）

管理完整的 Day 循环：商店 → 网格整理 → 匹配 AI → 战斗 → 结算。

**阶段定义**：
```typescript
enum GamePhase {
    Loading = 'loading',
    Shop = 'shop',       // 购买物品
    Grid = 'grid',       // 整理背包
    Battle = 'battle',   // 自动战斗
    Result = 'result',   // 结算
    GameOver = 'gameover' // 游戏结束
}
```

**金币经济**：
- 初始金币：10
- 每天收入：3 + Day 数（上限 10）
- 物品价格：Common 3 / Uncommon 5 / Rare 8 / Epic 12 / Legendary 15
- 商店刷新：首次免费，之后 2/4/6... 递增

**AI 对手**：随机生成与当前 Day 匹配的背包快照，作为战斗对手。

### 2.4 商店系统（ShopManager）

**文件**：`assets/scripts/core/ShopManager.ts`（241 行）

**规则**：
- 5 个槽位，每天自动刷新
- 物品池按 Day 解锁稀有度（见 ItemDB Day-gating）
- 支持锁定槽位（保留到下一轮）
- 刷新费用递增

**Day-gating 策略**（ItemDB）：

| Day | 可出现稀有度 |
|-----|-------------|
| 1+  | Common |
| 2+  | + Uncommon |
| 3+  | + Rare |
| 5+  | + Epic |
| 8+  | + Legendary |

### 2.5 场景流转状态机（SceneFlowStateMachine）

**文件**：`assets/scripts/core/SceneFlowStateMachine.ts`（177 行）

合法的状态转换：
```
Loading → Shop
Shop → Grid
Grid → Battle
Battle → Result
Result → Shop（Day+1）
```

所有非法转换返回 `{ ok: false, reason: "..." }`。包含转换历史日志。

---

## 3. UI 层（Cocos 组件）

### 3.1 MainScene（主场景控制器）

**文件**：`assets/scripts/ui/MainScene.ts`（1,079 行）

所有 UI 面板的协调者，职责：
- 初始化 GameLoop 和所有面板
- 阶段切换时激活/隐藏对应面板
- 按钮回调绑定（EnterGrid / StartBattle / ContinueNextDay）
- 商店购买/刷新/锁定事件代理

**面板激活矩阵**：

| 阶段 | ShopPanel | GridPanel | BattlePanel | HUD | FlowControls |
|------|-----------|-----------|-------------|-----|-------------|
| Shop | ✅ | ❌ | ❌ | ✅ | EnterGrid 可见 |
| Grid | ❌ | ✅ | ❌ | ✅ | StartBattle 可见 |
| Battle | ❌ | ❌ | ✅ | ✅ | 隐藏 |
| Result | ❌ | ❌ | ✅ (result) | ✅ | ContinueNextDay 可见 |

### 3.2 ShopPanel（商店面板）

**文件**：`assets/scripts/ui/ShopPanel.ts`（1,596 行）

最复杂的 UI 组件。功能：
- 5 个槽位动态渲染（物品图标、名称、价格、稀有度边框颜色）
- 购买/锁定按钮
- 刷新按钮 + 费用显示
- 金币不足时灰显
- 触摸区域精确控制（防止遮挡 FlowControls 按钮）

**已知问题**：ShopPanel 触摸区域曾覆盖 FlowControls 按钮，已通过 `enforceMinWidth` + 延迟 hit-area 重算修复。

### 3.3 GridPanelComp（网格面板）

**文件**：`assets/scripts/ui/GridPanelComp.ts`（541 行）

10×10 网格渲染 + 拖拽交互：
- 自动计算 cell 尺寸适配屏幕
- 物品颜色编码（按稀有度）
- 拖拽控制委托给 `GridDragController`

### 3.4 BattlePanel（战斗面板）

**文件**：`assets/scripts/ui/BattlePanel.ts`（864 行）

战斗可视化：
- 双方 HP 条（实时更新）
- 时间轴事件日志滚动显示
- 状态效果图标
- 结算结果展示（胜/负/平 + 奖励）

### 3.5 HUD（状态显示）

**文件**：`assets/scripts/ui/HUD.ts`（337 行）

顶部状态栏：
- HP 条（Graphics 绘制 + scale X 缩放）
- 金币数量
- 当前 Day
- 阶段指示

所有 UI 节点通过 `@property` 在场景编辑器绑定，不运行时创建。

### 3.6 ScreenAdapter（屏幕适配）

**文件**：`assets/scripts/ui/ScreenAdapter.ts`（653 行）

微信小游戏多设备适配：
- 预设设备分辨率（iPhone SE / X / XR 等）
- 安全区（刘海屏、Home 指示器）
- 竖屏/横屏切换
- 按比例缩放 UI 根节点

---

## 4. 测试

### 4.1 测试框架

- **Jest** + **ts-jest**（Node.js 环境）
- 核心逻辑（`core/`）完全脱离 Cocos 引擎，可直接在 Node.js 中测试
- `cc.d.ts` 提供类型 stub，tsc 和 jest 共用

### 4.2 测试用例

| 文件 | 用例数 | 覆盖 |
|------|--------|------|
| BattleEngine.test.ts | — | 战斗调度、伤害计算、效果触发 |
| BattleEngineCharge.test.ts | — | Charge 效果、冷却加速 |
| BattleResolve.test.ts | — | 战斗结算、胜负判定、确定性验证 |
| GridManager.test.ts | — | 放置/移除/碰撞/邻接 |
| ItemDBDayGating.test.ts | — | Day-gating 稀有度解锁 |
| MinHeap.test.ts | — | 优先队列操作 |
| SceneFlowStateMachine.test.ts | — | 合法/非法状态转换 |
| SeededRandom.test.ts | — | 种子随机数确定性、分布均匀性 |
| **合计** | **116** | |

### 4.3 运行测试

```bash
# 全部测试
npx jest

# 单个文件
npx jest tests/core/BattleEngine.test.ts

# 带覆盖率
npx jest --coverage
```

### 4.4 CI 验证（Pipeline）

Pipeline CI Agent 执行 7 层验证：

1. **静态校验**：场景/预制体 JSON 可解析 + .meta 文件存在
2. **文件完整性**：关键节点存在 + `__type__` 是压缩 UUID
3. **TypeScript 编译**：`npx tsc --noEmit`
4. **2.x 语法门禁**：grep 禁止 `cc.Class`/`cc.loader`/`require()` 等
5. **Cocos Editor 运行时**：刷新资产 + 打开场景 + 检查错误日志
6. **Preview 运行时**：控制台 ERROR 检查 + 核心依赖非 null 验证
7. **UI 交互验证**：触摸区域重叠检测 + 场景切换 + 战斗触发

---

## 5. 编码规范

### 5.1 目录约定

| 目录 | 内容 | Cocos 依赖 |
|------|------|-----------|
| `scripts/core/` | 游戏逻辑 | ❌ 无 |
| `scripts/ui/` | Cocos 组件 | ✅ 是 |
| `scripts/utils/` | 工具类 | ❌ 无 |
| `scripts/net/`（M4） | 网络层 | ✅ 微信 API |

### 5.2 Cocos 3.x 强约束

**必须**：
```typescript
// ✅ 所有 API 从 'cc' 模块导入
import { Component, _decorator, Node, Label } from 'cc';
const { ccclass, property } = _decorator;

// ✅ 使用装饰器声明组件
@ccclass('MyComp')
export class MyComp extends Component {
    @property(Node) target: Node | null = null;
}
```

**禁止**：
```typescript
// ❌ 2.x 全局 cc 访问
cc.Class({...})
cc.loader.load(...)
cc.url.raw(...)

// ❌ CommonJS
require('...')

// ❌ 同节点双渲染组件
node.addComponent(Sprite);
node.addComponent(Label);  // 冲突！需创建子节点
```

### 5.3 Commit 规范

```
<type>(<scope>): <description>

type:  feat | fix | refactor | docs | test | chore
scope: grid | battle | shop | ui | net | config | scene
```

示例：
```
feat(battle): add Charge effect cooldown acceleration
fix(shop-panel): enforce minimum width 500px to cover all 5 slots
test(grid): add boundary collision detection cases
```

### 5.4 场景文件规则

- 自定义脚本的 `__type__` 必须是 **23 字符压缩 UUID**（不是类名）
- 优先用 MCP 工具操作场景（`cocos_component_attach_script`），不手动编辑 JSON
- Canvas.cameraComponent 必须绑定 Main Camera
- 一个节点只能有一个渲染组件（Sprite/Label/Graphics 等）

UUID→CID 映射表见 [`cocos-scene-serialization.md`](cocos-scene-serialization.md#4-本项目脚本-uuid--cid-映射表)。

---

## 6. 本地开发环境

### 6.1 首次配置

```bash
# 克隆
git clone https://github.com/PPPPanda/theGarden.git
cd theGarden

# 安装测试依赖
npm install

# 用 Cocos Creator 打开项目（自动生成 library/ 和 .meta 文件）
```

### 6.2 Git Worktree（Pipeline 用）

```bash
# 创建 Coder 工作区（dev 分支）
git worktree add ../game-repo__coder dev

# 创建 CI 工作区（独立 HEAD）
git worktree add ../game-repo__ci --detach HEAD
```

Pipeline 的 Coder Agent 在 `game-repo__coder` 目录的 dev 分支工作，CI Agent 验证后合并到 main。

### 6.3 预览

```bash
# Cocos Creator 内置预览（默认端口 7456）
# 或直接访问
open http://localhost:7456
```

---

## 7. 下一步（M4 — 联网对战）

### 7.1 需要实现

| 模块 | 说明 | 参考 |
|------|------|------|
| CloudManager | 微信云开发初始化 + API 封装 | `wx.cloud` API |
| GhostManager | 背包快照序列化 + 上传/下载 | `IGhostData` 接口 |
| MatchManager | MMR Elo 匹配（±200 分） | `docs/architecture.md §2.3` |
| 云函数：匹配 | 无状态匹配逻辑 | `skills/async-pvp-sync/SKILL.md` |
| 云函数：验证 | 战斗结果抽样验证（反作弊） | 确定性种子重放 |
| 云函数：结算 | MMR 更新 + 胜负记录 | |
| 玩家存档 | 云端存档 + 本地缓存 | `wx.setStorage` 10MB 上限 |

### 7.2 数据库设计

已在 [`data-schema.md §8`](data-schema.md#8-云端存储结构微信云开发) 定义：
- `players` 集合（存档 + 幽灵快照）
- `matchmaking_pool` 集合（MMR + Day 联合索引）
- `battle_results` 集合（战斗记录）

### 7.3 微信小游戏约束

| 约束 | 限制 | 应对 |
|------|------|------|
| 首包大小 | 4MB | 核心逻辑 + 最小资源，其余走子包/CDN |
| 内存峰值 | 100-150MB | 对象池、纹理压缩、及时释放 |
| 网络协议 | HTTPS / WSS | 微信云开发自动处理 |
| 本地存储 | 10MB | 关键数据上云，本地仅缓存 |
| DrawCall | < 50 | 2D 为主，Auto Atlas 合并纹理 |
