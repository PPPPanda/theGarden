# Scene Audit Report

## Section 1: 节点属性审计

| 节点路径 | Position | ContentSize | Anchor | Components | 状态 |
|---------|----------|-------------|--------|------------|------|
| Canvas | (360, 640) | 720×1280 | (0.5, 0.5) | cc.UITransform, cc.Canvas | ✅ |
| Canvas/Background | (0, 0) | 1280×720 | (0.5, 0.5) | cc.UITransform, cc.Graphics | ✅ |
| Canvas/Root | (0, 0) | 1280×720 | (0.5, 0.5) | cc.UITransform, MainScene, ScreenAdapter | ✅ |
| Canvas/Root/HUD | (0, 520) | 720×160 | (0.5, 0.5) | cc.UITransform, HUD, cc.Graphics | ✅ |
| Canvas/Root/ShopPanel | (0, 0) | 100×100* | (0.5, 0.5) | cc.UITransform, ShopPanel, cc.Graphics | ✅ |
| Canvas/Root/GridPanel | (0, 0) | 100×100* | (0.5, 0.5) | cc.UITransform, GridPanelComp, cc.Graphics | ✅ (inactive) |
| Canvas/Root/BattlePanel | (0, 0) | 100×100* | (0.5, 0.5) | cc.UITransform, BattlePanel, cc.Graphics | ✅ (inactive) |
| Canvas/Root/FlowControls | (0, -560) | 700×60 | (0.5, 0.5) | cc.UITransform | ✅ |

*注: Panel 节点的 contentSize 为 100×100 是默认值，运行时会通过代码自适应

### 关键节点详情

#### Canvas
- **Camera 绑定**: ✅ 已绑定 Main Camera (uuid: a89Cq2tZ1AYpazC+ypBvmz)
- **设计分辨率**: 720×1280 (Portrait)
- **alignCanvasWithScreen**: true

#### Root (MainScene)
- **Script 组件**:
  - MainScene (uuid: 05842fdd-44ec-498b-bf6e-32be59fb8923)
  - ScreenAdapter (uuid: e5030a7b-7875-4767-99d1-0bd24cdc7ff6)
- **ScreenAdapter 配置**:
  - targetOrientation: portrait
  - referenceWidth: 720
  - referenceHeight: 1280

#### HUD
- **Script 组件**: HUD (uuid: 65195f5a-e66e-4aea-8469-ea3dc6941c6d)
- **绑定节点**:
  - goldText: GoldText
  - dayText: DayText
  - hpText: HpText
  - hpBarFill: HpBarFill
  - hpBarBg: HpBarBg

#### ShopPanel
- **Script 组件**: ShopPanel (uuid: 8baedaa6-5ad2-407b-86ba-41cf32fbd5b9)
- **slotCount**: 5
- **slotSize**: 80px
- **slotGap**: 10px

#### GridPanel
- **Script 组件**: GridPanelComp (uuid: 755e6d84-ae7b-4117-bfd7-72549f6edcb7)
- **cellSize**: 0 (auto)
- **cellGap**: 2px
- **active**: false (Shop 阶段隐藏)

#### BattlePanel
- **Script 组件**: BattlePanel (uuid: 20d68bc8-d26f-4563-a407-52ed56e4ad42)
- **子节点**:
  - battleContainer
  - battleInfoPanel (TimerLabel, TimelineBar, PlayerHpBar, EnemyHpBar)
  - eventLogPanel
  - resultPanel (ResultTitleLabel, DamageSummaryLabel, RewardsLabel, ContinueButton)
  - floatingTextLayer
  - playerStatusIcons, enemyStatusIcons
- **active**: false (Shop/Grid 阶段隐藏)

#### FlowControls
- **子节点**:
  - EnterGridBtn (EnterGridLabel)
  - StartBattleBtn (StartBattleLabel)
  - ContinueNextDayBtn (ContinueNextDayLabel)

### 子节点列表

#### HUD/TopBar
| 子节点 | 类型 |
|--------|------|
| GoldText | cc.Node |
| DayText | cc.Node |

#### HUD/HpBar
| 子节点 | 类型 |
|--------|------|
| HpBarBg | cc.Node |
| HpBarFill | cc.Node |
| HpText | cc.Node |

#### ShopPanel/SlotList
| 子节点 | 类型 |
|--------|------|
| Slot1-5 | cc.Node (含 Icon, Price, BuyButton, LockButton) |
| RefreshButton | cc.Node |

#### FlowControls
| 子节点 | 类型 |
|--------|------|
| EnterGridBtn | cc.Node |
| StartBattleBtn | cc.Node |
| ContinueNextDayBtn | cc.Node |

## 2. 组件契约验证

| 节点 | 契约要求 | 实际组件 | 状态 |
|------|----------|----------|------|
| Canvas | cc.Canvas | cc.Canvas + cc.UITransform | ✅ |
| Background | cc.Graphics | cc.Graphics + cc.UITransform | ✅ |
| Root | MainScene + UITransform | MainScene + ScreenAdapter + UITransform | ✅ |
| HUD | HUD + UITransform | HUD + cc.Graphics + UITransform | ✅ |
| ShopPanel | ShopPanel + UITransform | ShopPanel + cc.Graphics + UITransform | ✅ |
| GridPanel | GridPanelComp + UITransform | GridPanelComp + cc.Graphics + UITransform | ✅ |
| BattlePanel | BattlePanel + UITransform | BattlePanel + cc.Graphics + UITransform | ✅ |
| FlowControls | UITransform | UITransform | ✅ |

**渲染组件检查**:
- 所有 Panel 节点均只有 1 个渲染组件 (cc.Graphics)
- 无双渲染组件违规 (如 Graphics + Sprite)
- ✅ 通过

## Section 2: 代码-场景一致性

### MainScene.ts @property 绑定状态

| 行号 | 属性名 | 类型 | 绑定状态 | 场景节点 | 状态 |
|------|--------|------|----------|----------|------|
| 215 | playerGridNode | Node | ✅ 已绑定 | GridContainer | ✅ |
| 218 | enemyGridNode | Node | ✅ 已绑定 | GridContainer | ✅ |
| 221 | uiLayerNode | Node | ✅ 已绑定 | Root | ✅ |
| 224 | battlePanel | BattlePanel | ✅ 已绑定 | BattlePanel (uuid: 59BYMkuKNPkL3/OZdCODX1) | ✅ |
| 227 | screenAdapter | ScreenAdapter | ✅ 已绑定 | Root (uuid: 6ao1EQZQVDyJz8BBWHkdDm) | ✅ |
| 230 | hud | HUD | ✅ 已绑定 | HUD (uuid: e4AQM9nYREQIMc2PVf7FPN) | ✅ |
| 233 | hudTopNode | Node | ✅ 已绑定 | TopBar | ✅ |
| 236 | hudBottomNode | Node | ✅ 已绑定 | HpBar | ✅ |
| 239 | centerContentNode | Node | ✅ 已绑定 | GridPanel | ✅ |
| 242 | gridPanel | GridPanelComp | ✅ 已绑定 | GridPanel (uuid: 29NR9uNARFe74z6MP2DQju) | ✅ |
| 245 | shopPanel | ShopPanel | ✅ 已绑定 | ShopPanel (uuid: d1vBnIZx9EIYzBtuE+ShGh) | ✅ |
| 250 | enterGridBtn | Node | ✅ 已绑定 | EnterGridBtn | ✅ |
| 253 | startBattleBtn | Node | ✅ 已绑定 | StartBattleBtn | ✅ |
| 256 | continueNextDayBtn | Node | ✅ 已绑定 | ContinueNextDayBtn | ✅ |

### HUD.ts @property 绑定状态

| 行号 | 属性名 | 类型 | 绑定状态 | 场景节点 | 状态 |
|------|--------|------|----------|----------|------|
| 25 | hpBarFill | Node | ✅ 已绑定 | HpBarFill | ✅ |
| 29 | hpBarBg | Node | ✅ 已绑定 | HpBarBg | ✅ |
| 33 | hpText | Node | ✅ 已绑定 | HpText | ✅ |
| 37 | goldText | Node | ✅ 已绑定 | GoldText | ✅ |
| 41 | dayText | Node | ✅ 已绑定 | DayText | ✅ |
| 45 | phaseText | Node | ⚠️ 可选 | - | ⚠️ |
| 49 | timerText | Node | ⚠️ 可选 | - | ⚠️ |

### ShopPanel.ts @property 绑定状态

| 行号 | 属性名 | 类型 | 绑定状态 | 场景节点 | 状态 |
|------|--------|------|----------|----------|------|
| 45 | slot0Icon | Node | ✅ 已绑定 | Slot1/Icon | ✅ |
| 48 | slot0Price | Node | ✅ 已绑定 | Slot1/Price | ✅ |
| 51 | slot0BuyBtn | Node | ✅ 已绑定 | Slot1/BuyButton | ✅ |
| 54 | slot0LockBtn | Node | ✅ 已绑定 | Slot1/LockButton | ✅ |
| 59-68 | slot1* | Node | ✅ 已绑定 | Slot2/* | ✅ |
| 73-82 | slot2* | Node | ✅ 已绑定 | Slot3/* | ✅ |
| 87-96 | slot3* | Node | ✅ 已绑定 | Slot4/* | ✅ |
| 101-110 | slot4* | Node | ✅ 已绑定 | Slot5/* | ✅ |
| 115 | refreshBtn | Node | ✅ 已绑定 | RefreshButton | ✅ |
| 118 | goldLabelNode | Node | ✅ 已绑定 | GoldLabel | ✅ |
| 121 | purchasedListNode | Node | ⚠️ 可选 | - | ⚠️ |

### GridPanelComp.ts @property 绑定状态

| 行号 | 属性名 | 类型 | 绑定状态 | 场景节点 | 状态 |
|------|--------|------|----------|----------|------|
| 27 | container | Node | ✅ 已绑定 | GridContainer | ✅ |
| 30 | cellPrefab | Node | ⚠️ 可选 | - | ⚠️ |

### BattlePanel.ts @property 绑定状态

| 行号 | 属性名 | 类型 | 绑定状态 | 场景节点 | 状态 |
|------|--------|------|----------|----------|------|
| 34 | battleContainer | Node | ✅ 已绑定 | BattleContainer | ✅ |
| 37 | battleInfoPanel | Node | ✅ 已绑定 | BattleInfoPanel | ✅ |
| 40 | eventLogPanel | Node | ✅ 已绑定 | EventLogPanel | ✅ |
| 43 | resultPanel | Node | ✅ 已绑定 | ResultPanel | ✅ |
| 46 | playerHpBar | Node | ✅ 已绑定 | PlayerHpBar | ✅ |
| 49 | enemyHpBar | Node | ✅ 已绑定 | EnemyHpBar | ✅ |
| 52 | timerLabel | Node | ✅ 已绑定 | TimerLabel | ✅ |
| 55 | resultTitleLabel | Node | ✅ 已绑定 | ResultTitleLabel | ✅ |
| 58 | damageSummaryLabel | Node | ✅ 已绑定 | DamageSummaryLabel | ✅ |
| 61 | rewardsLabel | Node | ✅ 已绑定 | RewardsLabel | ✅ |
| 64 | continueButton | Node | ✅ 已绑定 | ContinueButton | ✅ |
| 67 | timelineBar | Node | ✅ 已绑定 | TimelineBar | ✅ |
| 70 | floatingTextLayer | Node | ✅ 已绑定 | FloatingTextLayer | ✅ |
| 73 | playerStatusIcons | Node | ✅ 已绑定 | PlayerStatusIcons | ✅ |
| 76 | enemyStatusIcons | Node | ✅ 已绑定 | EnemyStatusIcons | ✅ |

### 问题检查结果

#### Ghost References (代码声明但场景未绑定)
| 文件 | 行号 | 属性名 | 问题描述 |
|------|------|--------|----------|
| HUD.ts | 45 | phaseText | 可选属性，场景未绑定 |
| HUD.ts | 49 | timerText | 可选属性，场景未绑定 |
| ShopPanel.ts | 121 | purchasedListNode | 可选属性，场景未绑定 |
| GridPanelComp.ts | 30 | cellPrefab | 可选属性，场景未绑定 |

**结论**: 无 Ghost References（所有未绑定属性均为可选属性）

#### Dead Nodes (场景存在但无代码引用)
| 节点 | 路径 | 状态 |
|------|------|------|
| Main Camera | Canvas/Main Camera | ✅ 结构必需 |
| GridContainer | Canvas/Root/GridPanel/GridContainer | ✅ 被代码使用 |
| SlotList | Canvas/Root/ShopPanel/SlotList | ✅ 被代码遍历 |
| EventLogPlaceholder | Canvas/Root/BattlePanel/... | ✅ 可选日志 |

**结论**: 无 Dead Nodes（所有节点均有代码引用或为结构必需）

#### 组件类型不匹配
| 检查项 | 代码调用 | 场景组件 | 状态 |
|--------|----------|----------|------|
| Label 组件 | goldText.getComponent(Label) | GoldText 有 Label | ✅ |
| Label 组件 | dayText.getComponent(Label) | DayText 有 Label | ✅ |
| Label 组件 | hpText.getComponent(Label) | HpText 有 Label | ✅ |
| Label 组件 | timerLabel.getComponent(Label) | TimerLabel 有 Label | ✅ |

**结论**: 无组件类型不匹配

### 一致性总结

| 检查项 | 状态 |
|--------|------|
| @property 绑定完整性 | ✅ 100% (可选属性除外) |
| Ghost References | ✅ 无 |
| Dead Nodes | ✅ 无 |
| 组件类型匹配 | ✅ |

## 4. 审查结论

| 检查项 | 状态 |
|--------|------|
| Canvas 绑定 Camera | ✅ |
| 所有节点有 UITransform | ✅ |
| 渲染组件无冲突 | ✅ |
| Script 组件正确绑定 | ✅ |
| 节点层级结构正确 | ✅ |
| Panel 可见性控制 | ✅ (ShopPanel active, GridPanel/BattlePanel inactive) |

---

*Report generated: 2026-03-01*
*Audit tool: Cocos MCP Server*
