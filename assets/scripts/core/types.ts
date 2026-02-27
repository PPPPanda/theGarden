/**
 * theGarden — Core Type Definitions
 * Phase 2: 网格背包系统 + 单机战斗演算
 * 与 docs/data-schema.md 保持一致
 */

// ============= Constants =============

/** 网格行数 */
export const GRID_ROWS = 10;
/** 网格列数 */
export const GRID_COLS = 10;

// ============= Enums (String Values) =============

/** 物品稀有度 */
export enum ItemRarity {
    Common = 'common',
    Uncommon = 'uncommon',
    Rare = 'rare',
    Epic = 'epic',
    Legendary = 'legendary'
}

/** 物品尺寸 */
export enum ItemSize {
    Small = 'small',   // 1×1
    Medium = 'medium', // 2×1 or 1×2
    Large = 'large'    // 2×2
}

/** 状态效果类型 */
export enum StatusEffectType {
    Charge = 'charge',  // 充能
    Haste = 'haste',   // 急速
    Freeze = 'freeze', // 冰冻
    Slow = 'slow',     // 减速
    Poison = 'poison', // 中毒
    Shield = 'shield', // 护盾
    Burn = 'burn',     // 灼烧
    Regen = 'regen'    // 再生
}

/** 效果触发时机 */
export enum TriggerTiming {
    OnCooldownComplete = 'on_cooldown_complete', // 冷却完成
    OnBattleStart = 'on_battle_start',          // 战斗开始
    OnDamageTaken = 'on_damage_taken',          // 受伤时
    OnDamageDealt = 'on_damage_dealt',          // 造成伤害时
    OnItemDestroyed = 'on_item_destroyed',       // 物品被摧毁
    OnAdjacentTrigger = 'on_adjacent_trigger',  // 相邻物品触发
    OnHeal = 'on_heal',                        // 治疗时
    Passive = 'passive'                         // 被动常驻
}

// ============= Grid System =============

/** 网格坐标 */
export interface IGridPosition {
    row: number; // 行（0 = 底部）
    col: number; // 列（0 = 左侧）
}

/** 物品占位尺寸 */
export interface IGridSize {
    rows: number; // 占据行数
    cols: number; // 占据列数
}

/** 网格单元格 */
export interface IGridCell {
    position: IGridPosition;
    occupied: boolean;
    itemId: string | null;
}

/** 网格背包 */
export interface IGrid {
    rows: number;
    cols: number;
    cells: IGridCell[][];
}

// ============= Item System =============

/** 物品效果 */
export interface IItemEffect {
    effectId: string;                           // 效果 ID
    trigger: TriggerTiming;                   // 触发时机
    target: string;                            // 目标：self/enemy/adjacent/all_allies
    type: string;                              // 类型：damage/heal/buff/debuff/special
    value: number;                             // 数值
    params?: Record<string, unknown>;           // 额外参数
}

/** 物品基类 */
export interface IGridItem {
    id: string;                // 唯一实例 ID
    templateId: string;       // 模板 ID
    name: string;              // 名称
    description: string;       // 描述
    rarity: ItemRarity;        // 稀有度
    size: ItemSize;            // 尺寸类型
    gridSize: IGridSize;       // 实际占位
    position: IGridPosition;   // 网格中锚点（左下角）
    cooldown: number;          // 冷却时间（秒）
    currentCooldown: number;   // 距离下次触发的剩余冷却（秒）
    effects: IItemEffect[];    // 效果列表
    level: number;             // 物品等级
    destroyed: boolean;       // 是否已摧毁
    enchantments: string[];    // 附魔数据
}

// ============= Item Template (Config) =============

/** 物品模板（配置表 items.json 使用） */
export interface IItemTemplate {
    templateId: string;           // 模板 ID
    name: string;                // 名称
    description: string;         // 描述
    rarity: ItemRarity;          // 稀有度
    size: ItemSize;              // 尺寸类型
    gridSize: IGridSize;         // 实际占位
    cooldown: number;            // 冷却时间（秒）
    effects: IItemEffect[];      // 效果列表
    emoji?: string;              // emoji 图标
    cost?: number;               // 花费
    color?: string;              // 颜色
    tier?: number;               // 等级
    icon?: string;               // 图标路径
}

/** 物品配置表类型 */
export type IItemConfig = IItemTemplate[];

// ============= Player State =============

/** 英雄属性 */
export interface IHeroStats {
    maxHealth: number;
    currentHealth: number;
    baseAttack: number;
    baseDefense: number;
}

/** 玩家完整状态 */
export interface IPlayerState {
    playerId: string;           // 玩家 ID
    nickname: string;            // 昵称
    hero: IHeroStats;            // 英雄属性
    grid: IGrid;                 // 网格背包
    items: IGridItem[];          // 物品列表
    gold: number;                // 金币
    day: number;                 // 当前天数
    wins: number;                // 累计胜场
    losses: number;              // 累计败场
    mmr: number;                // 隐藏匹配分
    shopRefreshes: number;       // 商店剩余刷新次数
}

// ============= Battle System =============

/** 战斗中状态效果实例 */
export interface IStatusEffect {
    type: StatusEffectType;     // 效果类型
    duration: number;            // 剩余持续时间（秒）
    value: number;               // 效果强度
    sourceItemId: string;        // 来源物品 ID
    stacks: number;              // 叠加层数
}

/** 时间轴事件类型 */
export type TimelineEventType = 
    | 'item_trigger' 
    | 'effect_tick' 
    | 'status_apply' 
    | 'status_expire' 
    | 'damage' 
    | 'heal';

/** 时间轴事件 */
export interface ITimelineEvent {
    time: number;                 // 触发时间（秒）
    type: TimelineEventType;     // 事件类型
    itemId?: string;             // 关联物品（兼容旧字段）
    sourceId?: string;           // 出手方物品ID
    sourceSide?: 'player' | 'enemy'; // 出手方（可选，用于区分target语义）
    target: 'player' | 'enemy';  // 受击方/目标
    value: number;               // 事件数值
    description: string;         // 描述
}

/** 战斗状态 */
export interface IBattleState {
    battleId: string;                    // 战斗 ID
    player: IPlayerState;                 // 玩家方快照
    opponent: IPlayerState;               // 对手方快照
    currentTime: number;                  // 当前时间（秒）
    maxDuration: number;                  // 最大时长
    timeline: ITimelineEvent[];           // 事件队列
    eventLog: ITimelineEvent[];           // 已执行事件（回放用）
    playerEffects: IStatusEffect[];        // 玩家状态效果栈
    opponentEffects: IStatusEffect[];      // 对手状态效果栈
    isFinished: boolean;                  // 是否结束
    result: 'win' | 'lose' | 'draw' | null;
    randomSeed: number;                   // 随机种子
}

// ============= Ghost Data (Async PvP) =============

/** 幽灵物品（精简版） */
export interface IGhostItem {
    templateId: string;
    position: IGridPosition;
    gridSize: IGridSize;
    level: number;
    enchantments: string[];
}

/** 幽灵快照 */
export interface IGhostData {
    ghostId: string;           // 幽灵 ID
    playerId: string;          // 原始玩家 ID
    nickname: string;          // 昵称
    day: number;              // 快照天数
    mmr: number;              // 快照时 MMR
    hero: IHeroStats;         // 英雄属性
    gridSize: IGridSize;
    items: IGhostItem[];     // 精简物品列表
    timestamp: number;        // 生成时间戳
    version: number;          // 数据版本号
}

// ============= Shop System =============

/** 商店槽位 */
export interface IShopSlot {
    index: number;             // 槽位索引
    templateId: string;        // 物品模板 ID
    price: number;             // 价格
    purchased: boolean;        // 已购买
    locked: boolean;           // 已锁定
}

/** 商店状态 */
export interface IShopState {
    slots: IShopSlot[];        // 物品槽位
    refreshCost: number;       // 刷新价格
    refreshCount: number;      // 已刷新次数
}

// ============= Type Aliases for Convenience =============

export type GridItem = IGridItem;
export type ItemEffect = IItemEffect;
export type BattleState = IBattleState;
export type ItemTemplate = IItemTemplate;
