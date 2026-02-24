/**
 * theGarden — Core Type Definitions
 *
 * 核心数据结构定义，用于网格背包系统、异步PvP、时间轴战斗。
 * 所有游戏逻辑模块共享这些基础类型。
 */

// ─── 基础枚举 ────────────────────────────────────────────

/** 物品稀有度 */
export enum ItemRarity {
    Common = 'common',
    Uncommon = 'uncommon',
    Rare = 'rare',
    Epic = 'epic',
    Legendary = 'legendary',
}

/** 物品尺寸类型 */
export enum ItemSize {
    Small = 'small',     // 1×1
    Medium = 'medium',   // 2×1 or 1×2
    Large = 'large',     // 2×2
}

/** 效果触发时机 */
export enum TriggerTiming {
    OnCooldownComplete = 'on_cooldown_complete',  // 冷却结束时
    OnBattleStart = 'on_battle_start',            // 战斗开始时
    OnDamageTaken = 'on_damage_taken',            // 受到伤害时
    OnDamageDealt = 'on_damage_dealt',            // 造成伤害时
    OnItemDestroyed = 'on_item_destroyed',        // 物品被摧毁时
    OnAdjacentTrigger = 'on_adjacent_trigger',    // 相邻物品触发时
    OnHeal = 'on_heal',                           // 治疗时
    Passive = 'passive',                          // 被动效果（始终生效）
}

/** 状态效果类型 */
export enum StatusEffectType {
    Haste = 'haste',       // 急速：冷却速度翻倍
    Slow = 'slow',         // 减速：冷却速度减半
    Freeze = 'freeze',     // 冰冻：暂停冷却
    Poison = 'poison',     // 中毒：持续伤害
    Shield = 'shield',     // 护盾：伤害吸收
    Burn = 'burn',         // 灼烧：百分比伤害
    Charge = 'charge',     // 充能：推进冷却进度
    Regenerate = 'regen',  // 再生：持续回复
}


// ─── 网格系统 ────────────────────────────────────────────

/** 网格坐标（原点在左下角） */
export interface IGridPosition {
    row: number;   // 行（0 = 底部）
    col: number;   // 列（0 = 左侧）
}

/** 物品在网格中占据的尺寸 */
export interface IGridSize {
    rows: number;  // 占据的行数
    cols: number;  // 占据的列数
}

/** 网格单元格 */
export interface IGridCell {
    position: IGridPosition;
    occupied: boolean;
    /** 占据该格的物品 ID（null = 空格） */
    itemId: string | null;
}

/** 网格背包（10×10） */
export interface IGrid {
    rows: number;   // 默认 10
    cols: number;   // 默认 10
    cells: IGridCell[][];
}

/** 网格常量 */
export const GRID_ROWS = 10;
export const GRID_COLS = 10;


// ─── 物品系统 ────────────────────────────────────────────

/** 物品效果定义 */
export interface IItemEffect {
    /** 效果唯一标识 */
    effectId: string;
    /** 触发时机 */
    trigger: TriggerTiming;
    /** 效果目标：self / enemy / adjacent / all_allies */
    target: string;
    /** 效果类型标签（damage / heal / buff / debuff / special） */
    type: string;
    /** 效果数值（伤害量、治疗量、持续时间等） */
    value: number;
    /** 附加参数（特殊效果的额外配置） */
    params?: Record<string, unknown>;
}

/** 物品基类接口 */
export interface IGridItem {
    /** 物品唯一实例 ID */
    id: string;
    /** 物品模板 ID（用于查配置表） */
    templateId: string;
    /** 物品名称 */
    name: string;
    /** 物品描述 */
    description: string;
    /** 稀有度 */
    rarity: ItemRarity;
    /** 尺寸类型 */
    size: ItemSize;
    /** 在网格中的实际占位 */
    gridSize: IGridSize;
    /** 网格中的锚点位置（左下角） */
    position: IGridPosition;
    /** 冷却时间（秒） */
    cooldown: number;
    /** 当前冷却进度（0 = 就绪，> 0 = 冷却中） */
    currentCooldown: number;
    /** 物品携带的效果列表 */
    effects: IItemEffect[];
    /** 物品等级（可升级） */
    level: number;
    /** 是否已被摧毁 */
    destroyed: boolean;
    /** 附魔/强化数据 */
    enchantments: string[];
}


// ─── 玩家状态 ────────────────────────────────────────────

/** 英雄/角色基础属性 */
export interface IHeroStats {
    maxHealth: number;
    currentHealth: number;
    baseAttack: number;
    baseDefense: number;
}

/** 玩家状态 */
export interface IPlayerState {
    /** 玩家唯一 ID */
    playerId: string;
    /** 玩家昵称 */
    nickname: string;
    /** 英雄属性 */
    hero: IHeroStats;
    /** 网格背包 */
    grid: IGrid;
    /** 背包中的物品列表 */
    items: IGridItem[];
    /** 当前金币 */
    gold: number;
    /** 当前生存天数（轮次） */
    day: number;
    /** 累计胜场 */
    wins: number;
    /** 累计败场 */
    losses: number;
    /** 隐藏匹配分 (MMR) */
    mmr: number;
    /** 商店刷新次数（当天剩余） */
    shopRefreshes: number;
}


// ─── 战斗系统 ────────────────────────────────────────────

/** 战斗中的状态效果实例 */
export interface IStatusEffect {
    /** 效果类型 */
    type: StatusEffectType;
    /** 剩余持续时间（秒） */
    duration: number;
    /** 效果强度/数值 */
    value: number;
    /** 效果来源物品 ID */
    sourceItemId: string;
    /** 叠加层数 */
    stacks: number;
}

/** 战斗时间轴上的事件 */
export interface ITimelineEvent {
    /** 事件触发时间（秒，从战斗开始计） */
    time: number;
    /** 事件类型 */
    type: 'item_trigger' | 'effect_tick' | 'status_apply' | 'status_expire' | 'damage' | 'heal';
    /** 关联的物品 ID */
    itemId?: string;
    /** 事件目标（player / enemy） */
    target: 'player' | 'enemy';
    /** 事件数值 */
    value: number;
    /** 事件描述（用于战斗回放 UI） */
    description: string;
}

/** 战斗状态 */
export interface IBattleState {
    /** 战斗唯一 ID */
    battleId: string;
    /** 玩家方状态快照 */
    player: IPlayerState;
    /** 对手方状态快照（幽灵数据解析后） */
    opponent: IPlayerState;
    /** 当前战斗时间（秒） */
    currentTime: number;
    /** 战斗最大时长（秒，超时判定） */
    maxDuration: number;
    /** 时间轴事件队列（按时间排序） */
    timeline: ITimelineEvent[];
    /** 已执行的事件日志（用于回放） */
    eventLog: ITimelineEvent[];
    /** 玩家方当前状态效果栈 */
    playerEffects: IStatusEffect[];
    /** 对手方当前状态效果栈 */
    opponentEffects: IStatusEffect[];
    /** 战斗是否结束 */
    isFinished: boolean;
    /** 战斗结果（null = 进行中） */
    result: 'win' | 'lose' | 'draw' | null;
    /** 随机数种子（确保战斗可复现） */
    randomSeed: number;
}


// ─── 幽灵数据（异步PvP核心） ──────────────────────────────

/** 幽灵数据 — 序列化的对手快照 */
export interface IGhostData {
    /** 幽灵数据唯一 ID */
    ghostId: string;
    /** 原始玩家 ID */
    playerId: string;
    /** 玩家昵称 */
    nickname: string;
    /** 快照生成时的天数 */
    day: number;
    /** 快照时的 MMR */
    mmr: number;
    /** 英雄属性快照 */
    hero: IHeroStats;
    /** 网格尺寸 */
    gridSize: { rows: number; cols: number };
    /** 物品快照列表（精简序列化） */
    items: IGhostItem[];
    /** 快照生成时间戳 */
    timestamp: number;
    /** 数据版本号（用于兼容性检查） */
    version: number;
}

/** 幽灵物品数据（精简版，用于传输） */
export interface IGhostItem {
    templateId: string;
    position: IGridPosition;
    gridSize: IGridSize;
    level: number;
    enchantments: string[];
}


// ─── 商店系统 ────────────────────────────────────────────

/** 商店物品槽位 */
export interface IShopSlot {
    /** 槽位索引 */
    index: number;
    /** 物品模板 ID */
    templateId: string;
    /** 购买价格 */
    price: number;
    /** 是否已购买 */
    purchased: boolean;
    /** 是否已锁定（保留到下轮） */
    locked: boolean;
}

/** 商店状态 */
export interface IShopState {
    /** 当前可购买的物品槽位 */
    slots: IShopSlot[];
    /** 刷新价格 */
    refreshCost: number;
    /** 当天已刷新次数 */
    refreshCount: number;
}
