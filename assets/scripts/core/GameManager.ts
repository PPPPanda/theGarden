/**
 * theGarden — Game Manager
 * 中央游戏状态管理，控制游戏流程
 */
import { _decorator, Component, EventTarget } from 'cc';
import { ItemTemplate, ITEM_TEMPLATES, getItemsByTier, pickRandomItems } from './ItemDB';

const { ccclass, property } = _decorator;

// ─── 游戏阶段 ─────────────────────────────────
export enum GamePhase {
    Menu = 'menu',
    Shop = 'shop',
    Battle = 'battle',
    Result = 'result',
}

// ─── 网格物品实例 ─────────────────────────────────
export interface PlacedItem {
    uid: string;               // 唯一实例 ID
    templateId: string;        // 对应 ItemTemplate.id
    row: number;
    col: number;
    level: number;
}

// ─── 商店槽位 ─────────────────────────────────
export interface ShopSlot {
    template: ItemTemplate | null;
    price: number;
    purchased: boolean;
    locked: boolean;
}

// ─── 战斗日志条目 ─────────────────────────────────
export interface BattleLogEntry {
    time: number;
    text: string;
    type: 'damage' | 'heal' | 'effect' | 'info';
}

// ─── 游戏全局事件 ─────────────────────────────────
export const gameEvents = new EventTarget();
export const GameEvent = {
    PHASE_CHANGED: 'phase-changed',
    GOLD_CHANGED: 'gold-changed',
    HP_CHANGED: 'hp-changed',
    ITEM_PLACED: 'item-placed',
    ITEM_REMOVED: 'item-removed',
    SHOP_REFRESHED: 'shop-refreshed',
    BATTLE_TICK: 'battle-tick',
    BATTLE_LOG: 'battle-log',
    BATTLE_END: 'battle-end',
    DAY_CHANGED: 'day-changed',
};

// ─── 常量 ─────────────────────────────────
const GRID_SIZE = 4;
const STARTING_GOLD = 10;
const STARTING_HP = 30;
const SHOP_SLOTS = 3;
const REFRESH_COST = 1;
const WIN_GOLD = 4;
const LOSE_GOLD = 2;
const BATTLE_DURATION = 20; // 秒
const ENEMY_ITEM_COUNT_BASE = 2;

// ─── 单例管理器 ─────────────────────────────────
let _instance: GameManager | null = null;

@ccclass('GameManager')
export class GameManager extends Component {
    // ── 玩家状态 ──
    day: number = 1;
    gold: number = STARTING_GOLD;
    maxHp: number = STARTING_HP;
    playerHp: number = STARTING_HP;
    enemyMaxHp: number = STARTING_HP;
    enemyHp: number = STARTING_HP;
    wins: number = 0;
    losses: number = 0;

    // ── 游戏流程 ──
    phase: GamePhase = GamePhase.Menu;

    // ── 网格数据（4×4） ──
    gridSize: number = GRID_SIZE;
    grid: (PlacedItem | null)[][] = [];

    // ── 敌人网格 ──
    enemyItems: PlacedItem[] = [];

    // ── 商店 ──
    shopSlots: ShopSlot[] = [];

    // ── 战斗状态 ──
    battleTime: number = 0;
    battleDuration: number = BATTLE_DURATION;
    isBattling: boolean = false;
    battleLog: BattleLogEntry[] = [];
    playerShield: number = 0;
    enemyShield: number = 0;
    playerPoisonDps: number = 0;
    enemyPoisonDps: number = 0;
    playerCooldowns: Map<string, number> = new Map();
    enemyCooldowns: Map<string, number> = new Map();

    private _uidCounter = 0;

    static get instance(): GameManager {
        return _instance!;
    }

    onLoad() {
        if (_instance && _instance !== this) {
            this.destroy();
            return;
        }
        _instance = this;
        this._initGrid();
    }

    onDestroy() {
        if (_instance === this) _instance = null;
    }

    // ═══════════════ 初始化 ═══════════════

    private _initGrid() {
        this.grid = [];
        for (let r = 0; r < this.gridSize; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.gridSize; c++) {
                this.grid[r][c] = null;
            }
        }
    }

    /** 开始新游戏 */
    startNewGame() {
        this.day = 1;
        this.gold = STARTING_GOLD;
        this.maxHp = STARTING_HP;
        this.playerHp = STARTING_HP;
        this.wins = 0;
        this.losses = 0;
        this._initGrid();
        this.enemyItems = [];
        this._uidCounter = 0;
        this.setPhase(GamePhase.Shop);
        this.refreshShop();
        gameEvents.emit(GameEvent.DAY_CHANGED, this.day);
    }

    // ═══════════════ 阶段控制 ═══════════════

    setPhase(phase: GamePhase) {
        this.phase = phase;
        gameEvents.emit(GameEvent.PHASE_CHANGED, phase);
    }

    // ═══════════════ 金币 ═══════════════

    addGold(amount: number) {
        this.gold += amount;
        gameEvents.emit(GameEvent.GOLD_CHANGED, this.gold);
    }

    spendGold(amount: number): boolean {
        if (this.gold < amount) return false;
        this.gold -= amount;
        gameEvents.emit(GameEvent.GOLD_CHANGED, this.gold);
        return true;
    }

    // ═══════════════ 网格操作 ═══════════════

    /** 检查能否放置 */
    canPlace(templateId: string, row: number, col: number): boolean {
        const tmpl = ITEM_TEMPLATES[templateId];
        if (!tmpl) return false;
        for (let r = row; r < row + tmpl.rows; r++) {
            for (let c = col; c < col + tmpl.cols; c++) {
                if (r >= this.gridSize || c >= this.gridSize) return false;
                if (this.grid[r][c] !== null) return false;
            }
        }
        return true;
    }

    /** 放置物品 */
    placeItem(templateId: string, row: number, col: number): PlacedItem | null {
        if (!this.canPlace(templateId, row, col)) return null;
        const tmpl = ITEM_TEMPLATES[templateId];
        const item: PlacedItem = {
            uid: `item_${this._uidCounter++}`,
            templateId,
            row, col,
            level: 1,
        };
        for (let r = row; r < row + tmpl.rows; r++) {
            for (let c = col; c < col + tmpl.cols; c++) {
                this.grid[r][c] = item;
            }
        }
        gameEvents.emit(GameEvent.ITEM_PLACED, item);
        return item;
    }

    /** 自动寻找空位放置 */
    autoPlace(templateId: string): PlacedItem | null {
        const tmpl = ITEM_TEMPLATES[templateId];
        if (!tmpl) return null;
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.canPlace(templateId, r, c)) {
                    return this.placeItem(templateId, r, c);
                }
            }
        }
        return null;
    }

    /** 移除物品 */
    removeItem(uid: string): boolean {
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.grid[r][c]?.uid === uid) {
                    const item = this.grid[r][c]!;
                    const tmpl = ITEM_TEMPLATES[item.templateId];
                    // 清除所有占位
                    for (let rr = item.row; rr < item.row + tmpl.rows; rr++) {
                        for (let cc = item.col; cc < item.col + tmpl.cols; cc++) {
                            this.grid[rr][cc] = null;
                        }
                    }
                    gameEvents.emit(GameEvent.ITEM_REMOVED, item);
                    return true;
                }
            }
        }
        return false;
    }

    /** 获取所有已放置物品（去重） */
    getPlacedItems(): PlacedItem[] {
        const seen = new Set<string>();
        const items: PlacedItem[] = [];
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const item = this.grid[r][c];
                if (item && !seen.has(item.uid)) {
                    seen.add(item.uid);
                    items.push(item);
                }
            }
        }
        return items;
    }

    /** 获取相邻物品 */
    getAdjacentItems(row: number, col: number): PlacedItem[] {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        const seen = new Set<string>();
        const result: PlacedItem[] = [];
        for (const [dr, dc] of dirs) {
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize) {
                const item = this.grid[r][c];
                if (item && !seen.has(item.uid)) {
                    seen.add(item.uid);
                    result.push(item);
                }
            }
        }
        return result;
    }

    // ═══════════════ 商店 ═══════════════

    refreshShop(free: boolean = true) {
        if (!free && !this.spendGold(REFRESH_COST)) return;
        const tier = Math.min(3, Math.ceil(this.day / 3));
        const pool = getItemsByTier(tier);
        const picks = pickRandomItems(pool, SHOP_SLOTS);
        this.shopSlots = picks.map(t => ({
            template: t,
            price: t.cost,
            purchased: false,
            locked: false,
        }));
        gameEvents.emit(GameEvent.SHOP_REFRESHED, this.shopSlots);
    }

    buyItem(slotIndex: number): boolean {
        const slot = this.shopSlots[slotIndex];
        if (!slot || !slot.template || slot.purchased) return false;
        if (!this.spendGold(slot.price)) return false;
        const placed = this.autoPlace(slot.template.id);
        if (!placed) {
            // 退款
            this.addGold(slot.price);
            return false;
        }
        slot.purchased = true;
        gameEvents.emit(GameEvent.SHOP_REFRESHED, this.shopSlots);
        return true;
    }

    getRefreshCost(): number {
        return REFRESH_COST;
    }

    // ═══════════════ 战斗 ═══════════════

    /** 生成 AI 敌人 */
    private _generateEnemy() {
        const itemCount = ENEMY_ITEM_COUNT_BASE + Math.floor(this.day * 0.8);
        const tier = Math.min(3, Math.ceil(this.day / 3));
        const pool = getItemsByTier(tier);
        const picks = pickRandomItems(pool, Math.min(itemCount, 16));

        this.enemyItems = [];
        const enemyGrid: boolean[][] = [];
        for (let r = 0; r < this.gridSize; r++) {
            enemyGrid[r] = [];
            for (let c = 0; c < this.gridSize; c++) {
                enemyGrid[r][c] = false;
            }
        }

        for (const tmpl of picks) {
            let placed = false;
            for (let r = 0; r < this.gridSize && !placed; r++) {
                for (let c = 0; c < this.gridSize && !placed; c++) {
                    let canFit = true;
                    for (let rr = r; rr < r + tmpl.rows && canFit; rr++) {
                        for (let cc = c; cc < c + tmpl.cols && canFit; cc++) {
                            if (rr >= this.gridSize || cc >= this.gridSize || enemyGrid[rr][cc]) {
                                canFit = false;
                            }
                        }
                    }
                    if (canFit) {
                        for (let rr = r; rr < r + tmpl.rows; rr++) {
                            for (let cc = c; cc < c + tmpl.cols; cc++) {
                                enemyGrid[rr][cc] = true;
                            }
                        }
                        this.enemyItems.push({
                            uid: `enemy_${this._uidCounter++}`,
                            templateId: tmpl.id,
                            row: r, col: c, level: 1,
                        });
                        placed = true;
                    }
                }
            }
        }

        this.enemyMaxHp = STARTING_HP + Math.floor(this.day * 2);
        this.enemyHp = this.enemyMaxHp;
    }

    /** 开始战斗 */
    startBattle() {
        this._generateEnemy();
        this.battleTime = 0;
        this.isBattling = true;
        this.battleLog = [];
        this.playerShield = 0;
        this.enemyShield = 0;
        this.playerPoisonDps = 0;
        this.enemyPoisonDps = 0;
        this.playerCooldowns.clear();
        this.enemyCooldowns.clear();

        // 初始化冷却
        for (const item of this.getPlacedItems()) {
            const tmpl = ITEM_TEMPLATES[item.templateId];
            if (tmpl.cooldown > 0) {
                this.playerCooldowns.set(item.uid, tmpl.cooldown * 0.5); // 初始半冷却
            }
        }
        for (const item of this.enemyItems) {
            const tmpl = ITEM_TEMPLATES[item.templateId];
            if (tmpl.cooldown > 0) {
                this.enemyCooldowns.set(item.uid, tmpl.cooldown * 0.5);
            }
        }

        // 计算被动效果
        this._applyPassives('player');
        this._applyPassives('enemy');

        this.setPhase(GamePhase.Battle);
        this._addLog(0, `🌸 第 ${this.day} 天战斗开始！`, 'info');
    }

    /** 计算被动效果（金币、增益等） */
    private _applyPassives(side: 'player' | 'enemy') {
        const items = side === 'player' ? this.getPlacedItems() : this.enemyItems;
        for (const item of items) {
            const tmpl = ITEM_TEMPLATES[item.templateId];
            if (tmpl.cooldown === 0) {
                if (tmpl.effectType === 'gold' && side === 'player') {
                    this.addGold(tmpl.effectValue);
                    this._addLog(0, `🍀 四叶草带来了 ${tmpl.effectValue} 金币！`, 'effect');
                }
            }
        }
    }

    /** 战斗每帧更新（由 GameScene 调用） */
    updateBattle(dt: number) {
        if (!this.isBattling) return;

        this.battleTime += dt;

        // 毒伤 tick
        if (this.playerPoisonDps > 0) {
            this._dealDamageToPlayer(this.playerPoisonDps * dt, '🍄 中毒');
        }
        if (this.enemyPoisonDps > 0) {
            this._dealDamageToEnemy(this.enemyPoisonDps * dt, '🍄 中毒');
        }

        // 玩家物品触发
        this._tickItems('player', dt);
        // 敌人物品触发
        this._tickItems('enemy', dt);

        gameEvents.emit(GameEvent.BATTLE_TICK, this.battleTime);

        // 检查结束
        if (this.playerHp <= 0 || this.enemyHp <= 0 || this.battleTime >= this.battleDuration) {
            this._endBattle();
        }
    }

    private _tickItems(side: 'player' | 'enemy', dt: number) {
        const items = side === 'player' ? this.getPlacedItems() : this.enemyItems;
        const cooldowns = side === 'player' ? this.playerCooldowns : this.enemyCooldowns;

        // 计算 boost 倍率
        let boostMultiplier = 1.0;
        for (const item of items) {
            const tmpl = ITEM_TEMPLATES[item.templateId];
            if (tmpl.effectType === 'boost' && tmpl.cooldown === 0) {
                boostMultiplier += tmpl.effectValue / 100;
            }
        }

        for (const item of items) {
            const tmpl = ITEM_TEMPLATES[item.templateId];
            if (tmpl.cooldown <= 0) continue;

            const cd = cooldowns.get(item.uid) ?? 0;
            if (cd <= 0) {
                // 触发效果
                this._triggerItemEffect(tmpl, side, boostMultiplier);
                cooldowns.set(item.uid, tmpl.cooldown);
            } else {
                cooldowns.set(item.uid, cd - dt);
            }
        }
    }

    private _triggerItemEffect(tmpl: ItemTemplate, side: 'player' | 'enemy', boost: number) {
        const value = Math.round(tmpl.effectValue * boost);
        const t = Math.round(this.battleTime * 10) / 10;

        switch (tmpl.effectType) {
            case 'damage':
                if (side === 'player') {
                    this._dealDamageToEnemy(value, `${tmpl.emoji} ${tmpl.name}`);
                } else {
                    this._dealDamageToPlayer(value, `${tmpl.emoji} ${tmpl.name}`);
                }
                break;
            case 'heal':
                if (side === 'player') {
                    this.playerHp = Math.min(this.maxHp, this.playerHp + value);
                    this._addLog(t, `${tmpl.emoji} 回复 ${value} HP`, 'heal');
                } else {
                    this.enemyHp = Math.min(this.enemyMaxHp, this.enemyHp + value);
                }
                gameEvents.emit(GameEvent.HP_CHANGED, { playerHp: this.playerHp, enemyHp: this.enemyHp });
                break;
            case 'poison':
                if (side === 'player') {
                    this.enemyPoisonDps += value;
                    this._addLog(t, `${tmpl.emoji} 对敌人施加中毒 ${value}/s`, 'effect');
                    // 3秒后清除
                    this.scheduleOnce(() => { this.enemyPoisonDps = Math.max(0, this.enemyPoisonDps - value); }, tmpl.effectDuration ?? 3);
                } else {
                    this.playerPoisonDps += value;
                    this.scheduleOnce(() => { this.playerPoisonDps = Math.max(0, this.playerPoisonDps - value); }, tmpl.effectDuration ?? 3);
                }
                break;
            case 'thorns':
                if (side === 'player') {
                    this._dealDamageToEnemy(value, `${tmpl.emoji} 仙人掌反刺`);
                    this.playerShield += 2;
                } else {
                    this._dealDamageToPlayer(value, `${tmpl.emoji} 仙人掌反刺`);
                    this.enemyShield += 2;
                }
                break;
            case 'shield':
                if (side === 'player') {
                    this.playerShield += value;
                    this._addLog(t, `${tmpl.emoji} 获得 ${value} 护盾`, 'effect');
                } else {
                    this.enemyShield += value;
                }
                break;
            case 'haste':
                // 简化：直接推进所有冷却
                const cds = side === 'player' ? this.playerCooldowns : this.enemyCooldowns;
                cds.forEach((v, k) => {
                    cds.set(k, Math.max(0, v - 1));
                });
                if (side === 'player') {
                    this._addLog(t, `${tmpl.emoji} 加速所有物品冷却！`, 'effect');
                }
                break;
        }
    }

    private _dealDamageToEnemy(value: number, source: string) {
        let actual = value;
        if (this.enemyShield > 0) {
            const absorbed = Math.min(this.enemyShield, actual);
            this.enemyShield -= absorbed;
            actual -= absorbed;
        }
        this.enemyHp = Math.max(0, this.enemyHp - actual);
        const t = Math.round(this.battleTime * 10) / 10;
        if (actual > 0) this._addLog(t, `${source} 造成 ${Math.round(actual)} 伤害`, 'damage');
        gameEvents.emit(GameEvent.HP_CHANGED, { playerHp: this.playerHp, enemyHp: this.enemyHp });
    }

    private _dealDamageToPlayer(value: number, source: string) {
        let actual = value;
        if (this.playerShield > 0) {
            const absorbed = Math.min(this.playerShield, actual);
            this.playerShield -= absorbed;
            actual -= absorbed;
        }
        this.playerHp = Math.max(0, this.playerHp - actual);
        gameEvents.emit(GameEvent.HP_CHANGED, { playerHp: this.playerHp, enemyHp: this.enemyHp });
    }

    private _addLog(time: number, text: string, type: BattleLogEntry['type']) {
        const entry: BattleLogEntry = { time, text, type };
        this.battleLog.push(entry);
        gameEvents.emit(GameEvent.BATTLE_LOG, entry);
    }

    private _endBattle() {
        this.isBattling = false;
        const won = this.enemyHp <= 0 && this.playerHp > 0;
        const draw = this.playerHp > 0 && this.enemyHp > 0;

        if (won) {
            this.wins++;
            this.addGold(WIN_GOLD);
            this._addLog(this.battleTime, `🎉 胜利！获得 ${WIN_GOLD} 金币`, 'info');
        } else if (draw) {
            this.addGold(LOSE_GOLD);
            this._addLog(this.battleTime, `⏰ 时间到！平局，获得 ${LOSE_GOLD} 金币`, 'info');
        } else {
            this.losses++;
            this.addGold(LOSE_GOLD);
            this._addLog(this.battleTime, `💔 失败...获得 ${LOSE_GOLD} 金币`, 'info');
        }

        const result = won ? 'win' : (draw ? 'draw' : 'lose');
        gameEvents.emit(GameEvent.BATTLE_END, result);
        this.setPhase(GamePhase.Result);
    }

    /** 进入下一天 */
    nextDay() {
        this.day++;
        this.enemyPoisonDps = 0;
        this.playerPoisonDps = 0;
        gameEvents.emit(GameEvent.DAY_CHANGED, this.day);
        this.refreshShop();
        this.setPhase(GamePhase.Shop);
    }

    /** 游戏结束检查 */
    isGameOver(): boolean {
        return this.playerHp <= 0;
    }
}
