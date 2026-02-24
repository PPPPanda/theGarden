# theGarden — 核心数据结构定义

> 对应代码文件：`assets/scripts/core/types.ts`

## 1. 枚举类型

### ItemRarity — 物品稀有度
```typescript
enum ItemRarity {
    Common    = 'common',
    Uncommon  = 'uncommon',
    Rare      = 'rare',
    Epic      = 'epic',
    Legendary = 'legendary',
}
```

### ItemSize — 物品尺寸
```typescript
enum ItemSize {
    Small  = 'small',   // 1×1
    Medium = 'medium',  // 2×1 or 1×2
    Large  = 'large',   // 2×2
}
```

### StatusEffectType — 状态效果
```typescript
enum StatusEffectType {
    Charge = 'charge',   // 充能：推进冷却进度
    Haste  = 'haste',    // 急速：冷却速度 ×2
    Freeze = 'freeze',   // 冰冻：暂停冷却
    Slow   = 'slow',     // 减速：冷却速度 ×0.5
    Poison = 'poison',   // 中毒：持续伤害
    Shield = 'shield',   // 护盾：吸收伤害
    Burn   = 'burn',     // 灼烧：百分比伤害
    Regen  = 'regen',    // 再生：持续回复
}
```

### TriggerTiming — 效果触发时机
```typescript
enum TriggerTiming {
    OnCooldownComplete = 'on_cooldown_complete',  // 冷却完成
    OnBattleStart      = 'on_battle_start',       // 战斗开始
    OnDamageTaken      = 'on_damage_taken',       // 受伤时
    OnDamageDealt      = 'on_damage_dealt',       // 造成伤害时
    OnItemDestroyed    = 'on_item_destroyed',     // 物品被摧毁
    OnAdjacentTrigger  = 'on_adjacent_trigger',   // 相邻物品触发
    OnHeal             = 'on_heal',               // 治疗时
    Passive            = 'passive',               // 被动常驻
}
```

## 2. 网格系统

### IGridPosition — 网格坐标
```typescript
interface IGridPosition {
    row: number;  // 行（0 = 底部）
    col: number;  // 列（0 = 左侧）
}
```
原点 `(0,0)` 在左下角，与 Cocos 坐标系一致。

### IGridSize — 物品占位尺寸
```typescript
interface IGridSize {
    rows: number;  // 占据行数
    cols: number;  // 占据列数
}
```

### IGridCell — 网格单元格
```typescript
interface IGridCell {
    position: IGridPosition;
    occupied: boolean;
    itemId: string | null;  // 占据该格的物品 ID
}
```

### IGrid — 网格背包
```typescript
interface IGrid {
    rows: number;          // 默认 10
    cols: number;          // 默认 10
    cells: IGridCell[][];  // [row][col] 二维数组
}
```
**常量：** `GRID_ROWS = 10`, `GRID_COLS = 10`

## 3. 物品系统

### IItemEffect — 物品效果
```typescript
interface IItemEffect {
    effectId: string;               // 效果 ID
    trigger: TriggerTiming;         // 触发时机
    target: string;                 // 目标：self / enemy / adjacent / all_allies
    type: string;                   // 类型：damage / heal / buff / debuff / special
    value: number;                  // 数值
    params?: Record<string, unknown>; // 额外参数
}
```

### IGridItem — 物品基类
```typescript
interface IGridItem {
    id: string;              // 唯一实例 ID
    templateId: string;      // 模板 ID（查配置表）
    name: string;            // 名称
    description: string;     // 描述
    rarity: ItemRarity;      // 稀有度
    size: ItemSize;          // 尺寸类型
    gridSize: IGridSize;     // 实际占位
    position: IGridPosition; // 网格中锚点（左下角）
    cooldown: number;        // 冷却时间（秒）
    currentCooldown: number; // 当前冷却进度
    effects: IItemEffect[];  // 效果列表
    level: number;           // 物品等级
    destroyed: boolean;      // 是否已摧毁
    enchantments: string[];  // 附魔数据
}
```

## 4. 玩家状态

### IHeroStats — 英雄属性
```typescript
interface IHeroStats {
    maxHealth: number;
    currentHealth: number;
    baseAttack: number;
    baseDefense: number;
}
```

### IPlayerState — 玩家完整状态
```typescript
interface IPlayerState {
    playerId: string;       // 玩家 ID
    nickname: string;       // 昵称
    hero: IHeroStats;       // 英雄属性
    grid: IGrid;            // 网格背包
    items: IGridItem[];     // 物品列表
    gold: number;           // 金币
    day: number;            // 当前天数
    wins: number;           // 累计胜场
    losses: number;         // 累计败场
    mmr: number;            // 隐藏匹配分
    shopRefreshes: number;  // 商店剩余刷新次数
}
```

## 5. 战斗系统

### IStatusEffect — 战斗中状态效果实例
```typescript
interface IStatusEffect {
    type: StatusEffectType;    // 效果类型
    duration: number;          // 剩余持续时间（秒）
    value: number;             // 效果强度
    sourceItemId: string;      // 来源物品 ID
    stacks: number;            // 叠加层数
}
```

### ITimelineEvent — 时间轴事件
```typescript
interface ITimelineEvent {
    time: number;        // 触发时间（秒）
    type: 'item_trigger' | 'effect_tick' | 'status_apply' | 'status_expire' | 'damage' | 'heal';
    itemId?: string;     // 关联物品
    target: 'player' | 'enemy';
    value: number;       // 事件数值
    description: string; // 描述（用于回放 UI）
}
```

### IBattleState — 战斗状态
```typescript
interface IBattleState {
    battleId: string;                  // 战斗 ID
    player: IPlayerState;              // 玩家方快照
    opponent: IPlayerState;            // 对手方快照
    currentTime: number;               // 当前时间（秒）
    maxDuration: number;               // 最大时长
    timeline: ITimelineEvent[];        // 事件队列
    eventLog: ITimelineEvent[];        // 已执行事件（回放用）
    playerEffects: IStatusEffect[];    // 玩家状态效果栈
    opponentEffects: IStatusEffect[];  // 对手状态效果栈
    isFinished: boolean;               // 是否结束
    result: 'win' | 'lose' | 'draw' | null;
    randomSeed: number;                // 随机种子（确定性战斗）
}
```

## 6. 异步 PvP — 幽灵数据

### IGhostData — 幽灵快照
```typescript
interface IGhostData {
    ghostId: string;      // 幽灵 ID
    playerId: string;     // 原始玩家 ID
    nickname: string;     // 昵称
    day: number;          // 快照天数
    mmr: number;          // 快照时 MMR
    hero: IHeroStats;     // 英雄属性
    gridSize: { rows: number; cols: number };
    items: IGhostItem[];  // 精简物品列表
    timestamp: number;    // 生成时间戳
    version: number;      // 数据版本号
}
```

### IGhostItem — 幽灵物品（精简版）
```typescript
interface IGhostItem {
    templateId: string;
    position: IGridPosition;
    gridSize: IGridSize;
    level: number;
    enchantments: string[];
}
```

**设计原则：** 幽灵数据只包含战斗演算必需的字段，`name`、`description` 等展示字段从本地配置表查找，减少网络传输量。

## 7. 商店系统

### IShopSlot — 商店槽位
```typescript
interface IShopSlot {
    index: number;        // 槽位索引
    templateId: string;   // 物品模板 ID
    price: number;        // 价格
    purchased: boolean;   // 已购买
    locked: boolean;      // 已锁定
}
```

### IShopState — 商店状态
```typescript
interface IShopState {
    slots: IShopSlot[];     // 物品槽位
    refreshCost: number;    // 刷新价格
    refreshCount: number;   // 已刷新次数
}
```

## 8. 云端存储结构（微信云开发）

### 集合：`players`
```json
{
    "_id": "player_openid",
    "state": { /* IPlayerState 序列化 */ },
    "ghost": { /* IGhostData 最新快照 */ },
    "history": {
        "totalGames": 0,
        "bestDay": 0,
        "bestMmr": 0
    },
    "updatedAt": "2026-02-24T00:00:00Z"
}
```

### 集合：`matchmaking_pool`
```json
{
    "_id": "ghost_xxxxx",
    "playerId": "player_openid",
    "mmr": 1200,
    "day": 5,
    "ghostData": { /* IGhostData */ },
    "createdAt": "2026-02-24T00:00:00Z"
}
```
**索引：** `mmr` + `day` 联合索引，用于匹配查询。

### 集合：`battle_results`
```json
{
    "_id": "battle_xxxxx",
    "playerA": "player_openid_A",
    "playerB": "player_openid_B",
    "result": "win",
    "seed": 12345,
    "day": 5,
    "mmrChange": { "A": +15, "B": -15 },
    "createdAt": "2026-02-24T00:00:00Z"
}
```
