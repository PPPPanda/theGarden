/**
 * theGarden - Core Type Definitions
 * Phase 2: 网格背包系统 + 单机战斗演算
 */

// ============= Enums =============

/** 物品稀有度 */
export enum ItemRarity {
    Common = 0,     // 普通
    Uncommon = 1,   // 优秀
    Rare = 2,       // 稀有
    Epic = 3,       // 史诗
    Legendary = 4   // 传说
}

/** 物品类型 */
export enum ItemType {
    Weapon = 0,     // 武器
    Armor = 1,      // 护甲
    Consumable = 2, // 消耗品
    Material = 3,   // 材料
    Special = 4     // 特殊
}

/** 效果类型 */
export enum EffectType {
    Damage = 0,         // 伤害
    Heal = 1,           // 治疗
    Shield = 2,         // 护盾
    Buff = 3,           // 增益
    Debuff = 4,         // 减益
    Draw = 5,           // 抽牌
    Energy = 6,         // 能量
    Poison = 7,         // 中毒
    Stun = 8,           // 眩晕
    Drain = 9           // 吸血
}

/** 效果目标类型 */
export enum EffectTarget {
    Self = 0,       // 自身
    Enemy = 1,      // 敌人
    Ally = 2,       // 友军
    AllEnemies = 3, // 所有敌人
    AllAllies = 4   // 所有友军
}

/** 状态效果类型 */
export enum StatusType {
    Poison = 0,     // 中毒
    Burn = 1,       // 燃烧
    Frozen = 2,     // 冰冻
    Stunned = 3,    // 眩晕
    Shielded = 4,   // 护盾
    Powered = 5,    // 强化
    Weakened = 6,   // 虚弱
    Regenerating = 7 // 再生
}

/** 时间轴事件类型 */
export enum TimelineEventType {
    Damage = 0,         // 伤害事件
    Heal = 1,           // 治疗事件
    EffectApplied = 2,  // 效果应用
    EffectRemoved = 3,  // 效果移除
    TurnStart = 4,      // 回合开始
    TurnEnd = 5,        // 回合结束
    ItemUsed = 6,       // 物品使用
    ItemPlaced = 7,     // 物品放置
    ItemRemoved = 8,    // 物品移除
    BattleStart = 9,    // 战斗开始
    BattleEnd = 10      // 战斗结束
}

/** 网格位置 */
export interface IGridPosition {
    x: number;
    y: number;
}

/** 网格尺寸 */
export interface IGridSize {
    width: number;
    height: number;
}

// ============= Item Effects =============

/** 物品效果定义（配置表用） */
export interface IItemEffect {
    type: EffectType;           // 效果类型
    value: number;              // 效果数值
    target: EffectTarget;       // 目标类型
    duration?: number;          // 持续时间（回合）
    chance?: number;            // 触发概率 (0-1)
    scaling?: number;           // 数值 scaling（基于等级等）
    description?: string;       // 效果描述
}

// ============= Status Effects =============

/** 运行时状态效果 */
export interface IStatusEffect {
    type: StatusType;           // 状态类型
    duration: number;            // 持续时间（回合）
    remaining: number;           // 剩余回合
    stackCount: number;          // 堆叠层数
    source: string;              // 来源（物品ID等）
    value?: number;              // 数值（如伤害/治疗量）
}

// ============= Item Template =============

/** 物品模板（配置表 items.json 使用） */
export interface IItemTemplate {
    id: string;                  // 物品唯一ID (如 "sword_001")
    templateId: string;          // 模板ID (如 "sword")
    name: string;                // 显示名称
    description?: string;        // 物品描述
    type: ItemType;              // 物品类型
    rarity: ItemRarity;           // 稀有度
    size: IGridSize;             // 物品占据的网格大小
    cooldown?: number;           // 冷却时间（回合）
    maxCooldown?: number;        // 最大冷却时间
    effects: IItemEffect[];      // 效果列表
    level?: number;              // 物品等级
    upgradeId?: string;          // 升级后物品ID
    sellPrice?: number;          // 售价
    buyPrice?: number;           // 购入价格
    icon?: string;               // 图标资源路径
    tags?: string[];             // 标签
}

// ============= Grid Item =============

/** 物品实例（运行时用） */
export interface IGridItem {
    id: string;                          // 物品实例唯一ID
    templateId: string;                 // 模板ID
    name: string;                       // 显示名称
    rarity: ItemRarity;                  // 稀有度
    size: IGridSize;                    // 物品占据的网格大小
    gridSize: IGridSize;                // 同上，兼容写法
    position: IGridPosition;             // 网格位置
    cooldown: number;                   // 冷却时间（回合）
    currentCooldown: number;            // 当前剩余冷却
    effects: IItemEffect[];             // 物品效果
    level: number;                      // 物品等级
    destroyed: boolean;                 // 是否已销毁
    enchantments?: IEnchantment[];      // 附魔效果
    instanceId?: string;                // 实例ID（别名）
}

/** 附魔效果 */
export interface IEnchantment {
    id: string;              // 附魔ID
    name: string;            // 附魔名称
    effects: IItemEffect[]; // 附魔带来的效果
    level: number;           // 附魔等级
}

// ============= Timeline Events =============

/** 时间轴事件 */
export interface ITimelineEvent {
    time: number;                    // 事件发生的时间点（毫秒）
    sourceItemId?: string;           // 触发事件的物品ID
    type: TimelineEventType;         // 事件类型
    value: number;                   // 事件数值（如伤害值）
    target: string;                  // 目标（玩家/敌人ID）
    description?: string;            // 事件描述
    effects?: IItemEffect[];         // 附带效果
}

// ============= Battle State =============

/** 战斗状态快照 */
export interface IBattleState {
    playerHp: number;                 // 玩家当前生命值
    enemyHp: number;                 // 敌人当前生命值
    maxHp: number;                   // 最大生命值
    playerItems: IGridItem[];       // 玩家物品列表
    enemyItems: IGridItem[];         // 敌人物品列表
    currentTime: number;             // 当前战斗时间（毫秒）
    maxTime: number;                 // 最大战斗时间
    eventLog: ITimelineEvent[];      // 事件日志
    randomSeed: number;              // 随机种子
    activeEffects: IStatusEffect[]; // 活跃的状态效果
    playerEnergy?: number;           // 玩家能量
    enemyEnergy?: number;            // 敌人能量
    turn?: number;                   // 当前回合
    isPlayerTurn?: boolean;          // 是否玩家回合
}

// ============= Grid System =============

/** 网格单元格 */
export interface IGridCell {
    x: number;
    y: number;
    occupied: boolean;
    itemId?: string;
}

/** 网格系统配置 */
export interface IGridConfig {
    width: number;
    height: number;
    cellSize: number;
}

// ============= Battle Configuration =============

/** 战斗配置 */
export interface IBattleConfig {
    maxTime: number;             // 最大战斗时间（毫秒）
    maxHp: number;               // 最大生命值
    initialEnergy: number;      // 初始能量
    maxEnergy: number;          // 最大能量
    energyPerTurn: number;      // 每回合恢复能量
    randomSeed: number;         // 随机种子
}

// ============= Serialization =============

/** 可序列化接口（用于存档） */
export interface ISerializable {
    serialize(): string;
    deserialize(data: string): void;
}

// ============= Export all types for convenience =============

export type GridItem = IGridItem;
export type ItemEffect = IItemEffect;
export type StatusEffect = IStatusEffect;
export type TimelineEvent = ITimelineEvent;
export type BattleState = IBattleState;
export type ItemTemplate = IItemTemplate;

/** 物品配置表类型（items.json 数组类型） */
export type IItemConfig = IItemTemplate[];
