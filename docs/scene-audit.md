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

## 3. 代码-场景一致性

| 代码引用 | 场景节点 | 状态 |
|----------|----------|------|
| getComponent(HUD) | HUD 节点 | ✅ |
| getComponent(ShopPanel) | ShopPanel 节点 | ✅ |
| getComponent(GridPanelComp) | GridPanel 节点 | ✅ |
| getComponent(BattlePanel) | BattlePanel 节点 | ✅ |
| getChildByName('EnterGridBtn') | FlowControls/EnterGridBtn | ✅ |
| getChildByName('StartBattleBtn') | FlowControls/StartBattleBtn | ✅ |

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
