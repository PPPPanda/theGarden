/**
 * BattleEngine - Timeline-based Battle Scheduler
 * Pure TypeScript implementation, no Cocos dependency
 */

import { MinHeap } from './MinHeap';
import { SeededRandom } from '../utils/SeededRandom';
import { 
    IBattleState, 
    IGridItem, 
    IItemEffect, 
    IStatusEffect, 
    ITimelineEvent, 
    TriggerTiming, 
    StatusEffectType 
} from './types';
import { GridManager } from './GridManager';

interface TimelineEventEntry {
    time: number;
    itemId: string;
    side: 'player' | 'enemy';
    effects: IItemEffect[];
}

const BUFF_STATUS_MAP: Record<string, StatusEffectType> = {
    shield: StatusEffectType.Shield,
    haste: StatusEffectType.Haste,
    slow: StatusEffectType.Slow,
    freeze: StatusEffectType.Freeze,
    regen: StatusEffectType.Regen,
    charge: StatusEffectType.Charge,
    burn: StatusEffectType.Burn,
    poison: StatusEffectType.Poison,
};

/**
 * Battle Engine - handles timeline-based battle execution
 */
export class BattleEngine {
    private playerItems: IGridItem[];
    private enemyItems: IGridItem[];
    private playerGrid: GridManager;
    private enemyGrid: GridManager;
    private random: SeededRandom;
    private maxDuration: number;
    private playerHp: number;
    private enemyHp: number;
    private currentTime: number;
    private eventTimeline: MinHeap<TimelineEventEntry>;
    private eventLog: ITimelineEvent[];
    private playerEffects: IStatusEffect[];
    private enemyEffects: IStatusEffect[];
    private isFinished: boolean;
    private result: 'win' | 'lose' | 'draw' | null;
    private randomSeed: number;

    /**
     * @param config - Battle configuration
     */
    constructor(config: {
        playerItems: IGridItem[];
        enemyItems: IGridItem[];
        playerGrid: GridManager;
        enemyGrid: GridManager;
        seed: number;
        maxDuration?: number;
        playerHp?: number;
        enemyHp?: number;
    }) {
        this.playerItems = config.playerItems;
        this.enemyItems = config.enemyItems;
        this.playerGrid = config.playerGrid;
        this.enemyGrid = config.enemyGrid;
        this.randomSeed = config.seed;
        this.random = new SeededRandom(config.seed);
        this.maxDuration = config.maxDuration ?? 60;
        this.playerHp = config.playerHp ?? 100;
        this.enemyHp = config.enemyHp ?? 100;
        this.currentTime = 0;
        
        // Initialize timeline heap (sort by time, then by itemId for same time)
        this.eventTimeline = new MinHeap<TimelineEventEntry>((a, b) => {
            if (a.time !== b.time) {
                return a.time - b.time;
            }
            return a.itemId.localeCompare(b.itemId);
        });
        
        this.eventLog = [];
        this.playerEffects = [];
        this.enemyEffects = [];
        this.isFinished = false;
        this.result = null;

        // Initialize timeline
        this.initTimeline();
    }

    /**
     * Initialize timeline with all items' effects
     */
    private initTimeline(): void {
        // Process player items
        for (const item of this.playerItems) {
            if (item.destroyed) continue;
            this.processItem(item, 'player');
        }

        // Process enemy items
        for (const item of this.enemyItems) {
            if (item.destroyed) continue;
            this.processItem(item, 'enemy');
        }
    }

    /**
     * Process an item and schedule its effects (per-item, not per-effect)
     */
    private processItem(item: IGridItem, side: 'player' | 'enemy'): void {
        // Collect all OnBattleStart effects
        const battleStartEffects = item.effects.filter(e => e.trigger === TriggerTiming.OnBattleStart);
        
        if (battleStartEffects.length > 0) {
            // Execute all OnBattleStart effects immediately at battle start
            for (const effect of battleStartEffects) {
                const event: ITimelineEvent = {
                    time: this.currentTime,
                    type: 'item_trigger',
                    itemId: item.id,
                    sourceId: item.id,
                    sourceSide: side,
                    target: side === 'player' ? 'enemy' : 'player',
                    value: effect.value,
                    description: `${item.name} triggers ${effect.type} at battle start`
                };
                this.eventLog.push(event);
            }
        }

        // Schedule cooldown-based triggers (per-item, not per-effect)
        const cooldownEffects = item.effects.filter(e => e.trigger === TriggerTiming.OnCooldownComplete || e.trigger === TriggerTiming.Passive);
        
        if (cooldownEffects.length > 0) {
            // Schedule ONE entry per item, carrying all effects
            const effectiveCooldown = this.getEffectiveCooldown(item.cooldown, side === 'player' ? this.playerEffects : this.enemyEffects);
            if (effectiveCooldown > 0 && effectiveCooldown !== Infinity) {
                const initialDelay = effectiveCooldown * 0.5;
                this.eventTimeline.insert({
                    time: initialDelay,
                    itemId: item.id,
                    side,
                    effects: cooldownEffects // ALL cooldown/passive effects together
                });
            }
        }
    }

    /**
     * Get effective cooldown based on status effects
     */
    public getEffectiveCooldown(base: number, effects: IStatusEffect[]): number {
        let multiplier = 1;
        let frozen = false;

        for (const effect of effects) {
            switch (effect.type) {
                case StatusEffectType.Haste:
                    multiplier *= 0.5; // 2x speed = 0.5x cooldown
                    break;
                case StatusEffectType.Slow:
                    multiplier *= 2; // 0.5x speed = 2x cooldown
                    break;
                case StatusEffectType.Freeze:
                    frozen = true;
                    break;
            }
        }

        if (frozen) {
            return Infinity; // No triggers while frozen
        }

        return base * multiplier;
    }

    /**
     * Advance to next event and return it
     */
    public advanceToNext(): ITimelineEvent | null {
        if (this.isFinished) {
            return null;
        }

        // Check if timeline is empty
        if (this.eventTimeline.isEmpty()) {
            this.finishBattle();
            return null;
        }

        // Extract next event
        const entry = this.eventTimeline.extractMin();
        if (!entry) {
            this.finishBattle();
            return null;
        }

        // Update current time
        this.currentTime = entry.time;

        // Check max duration
        if (this.currentTime > this.maxDuration) {
            this.finishBattle();
            return null;
        }

        // Create timeline event with explicit source info
        const event: ITimelineEvent = {
            time: this.currentTime,
            type: 'item_trigger',
            itemId: entry.itemId,
            sourceId: entry.itemId,
            sourceSide: entry.side,
            target: entry.side === 'player' ? 'enemy' : 'player',
            value: entry.effects[0]?.value ?? 0,
            description: `Item ${entry.itemId} triggers`
        };

        this.eventLog.push(event);

        // Apply effects and potentially schedule next trigger
        const item = entry.side === 'player' 
            ? this.playerItems.find(i => i.id === entry.itemId)
            : this.enemyItems.find(i => i.id === entry.itemId);

        if (item && !item.destroyed) {
            // Apply cooldown for next trigger
            this.scheduleItemTrigger(item, entry.side);
        }

        // Check if battle should end
        if (this.playerHp <= 0 || this.enemyHp <= 0) {
            this.finishBattle();
        }

        return event;
    }

    /**
     * Schedule next trigger for an item (per-item, not per-effect)
     */
    private scheduleItemTrigger(item: IGridItem, side: 'player' | 'enemy'): void {
        const effects = side === 'player' ? this.playerEffects : this.enemyEffects;
        
        // Collect all OnCooldownComplete effects
        const cooldownEffects = item.effects.filter(e => e.trigger === TriggerTiming.OnCooldownComplete);
        
        if (cooldownEffects.length > 0) {
            const effectiveCooldown = this.getEffectiveCooldown(item.cooldown, effects);
            if (effectiveCooldown > 0 && effectiveCooldown !== Infinity) {
                // Schedule ONE entry per item, carrying all effects
                this.eventTimeline.insert({
                    time: this.currentTime + effectiveCooldown,
                    itemId: item.id,
                    side,
                    effects: cooldownEffects // ALL effects together
                });
            }
        }
    }

    /**
     * Finish the battle and determine result
     */
    private finishBattle(): void {
        this.isFinished = true;
        
        if (this.playerHp > 0 && this.enemyHp <= 0) {
            this.result = 'win';
        } else if (this.enemyHp > 0 && this.playerHp <= 0) {
            this.result = 'lose';
        } else if (this.playerHp <= 0 && this.enemyHp <= 0) {
            this.result = 'draw';
        } else {
            // Time limit reached
            if (this.playerHp > this.enemyHp) {
                this.result = 'win';
            } else if (this.enemyHp > this.playerHp) {
                this.result = 'lose';
            } else {
                this.result = 'draw';
            }
        }
    }

    /**
     * Get current battle state
     */
    public getBattleState(): IBattleState {
        return {
            battleId: `battle_${this.randomSeed}`,
            player: {
                playerId: 'player',
                nickname: 'Player',
                hero: {
                    maxHealth: 100,
                    currentHealth: this.playerHp,
                    baseAttack: 10,
                    baseDefense: 5
                },
                grid: this.playerGrid['gridCells'] ? {
                    rows: this.playerGrid.rows,
                    cols: this.playerGrid.cols,
                    cells: this.playerGrid.gridCells
                } : {
                    rows: this.playerGrid.rows,
                    cols: this.playerGrid.cols,
                    cells: []
                },
                items: this.playerItems,
                gold: 0,
                day: 1,
                wins: 0,
                losses: 0,
                mmr: 1000,
                shopRefreshes: 0
            },
            opponent: {
                playerId: 'enemy',
                nickname: 'Enemy',
                hero: {
                    maxHealth: 100,
                    currentHealth: this.enemyHp,
                    baseAttack: 10,
                    baseDefense: 5
                },
                grid: this.enemyGrid['gridCells'] ? {
                    rows: this.enemyGrid.rows,
                    cols: this.enemyGrid.cols,
                    cells: this.enemyGrid.gridCells
                } : {
                    rows: this.enemyGrid.rows,
                    cols: this.enemyGrid.cols,
                    cells: []
                },
                items: this.enemyItems,
                gold: 0,
                day: 1,
                wins: 0,
                losses: 0,
                mmr: 1000,
                shopRefreshes: 0
            },
            currentTime: this.currentTime,
            maxDuration: this.maxDuration,
            timeline: [],
            eventLog: [...this.eventLog],
            playerEffects: [...this.playerEffects],
            opponentEffects: [...this.enemyEffects],
            isFinished: this.isFinished,
            result: this.result,
            randomSeed: this.randomSeed
        };
    }

    /**
     * Get current time
     */
    public getCurrentTime(): number {
        return this.currentTime;
    }

    /**
     * Check if battle is finished
     */
    public getIsFinished(): boolean {
        return this.isFinished;
    }

    /**
     * Get battle result
     */
    public getResult(): 'win' | 'lose' | 'draw' | null {
        return this.result;
    }

    /**
     * Get event log
     */
    public getEventLog(): ITimelineEvent[] {
        return [...this.eventLog];
    }

    /**
     * Get random instance for external use
     */
    public getRandom(): SeededRandom {
        return this.random;
    }

    /**
     * Apply damage to a side
     */
    public applyDamage(target: 'player' | 'enemy', damage: number): void {
        if (target === 'player') {
            this.playerHp = Math.max(0, this.playerHp - damage);
        } else {
            this.enemyHp = Math.max(0, this.enemyHp - damage);
        }
    }

    /**
     * Apply healing to a side
     */
    public applyHeal(target: 'player' | 'enemy', amount: number): void {
        if (target === 'player') {
            this.playerHp = Math.min(100, this.playerHp + amount);
        } else {
            this.enemyHp = Math.min(100, this.enemyHp + amount);
        }
    }

    // ============= Battle Resolution =============

    /**
     * Resolve a timeline event - execute all effects
     * Uses sourceId/sourceSide to find the triggering item,
     * applies effects to target.
     * Only executes effects matching the trigger timing.
     */
    public resolveEvent(event: ITimelineEvent): void {
        // Use sourceId to find the triggering item
        const lookupId = event.sourceId ?? event.itemId;
        const sourceSide = event.sourceSide ?? (event.target === 'player' ? 'enemy' : 'player');
        
        const item = sourceSide === 'player'
            ? this.playerItems.find(i => i.id === lookupId)
            : this.enemyItems.find(i => i.id === lookupId);
        
        if (!item) {
            console.warn(`[BattleEngine] resolveEvent: item not found for sourceId=${lookupId}, sourceSide=${sourceSide}`);
            return;
        }

        const targetSide = event.target;
        
        // Filter effects by trigger timing - only execute OnCooldownComplete effects (per task requirement)
        const matchingEffects = item.effects.filter(e => 
            e.trigger === TriggerTiming.OnCooldownComplete
        );

        for (const effect of matchingEffects) {
            switch (effect.type) {
                case 'damage':
                    this.applyDamageWithShield(targetSide, effect.value);
                    break;
                case 'heal':
                    this.applyHeal(targetSide, effect.value);
                    break;
                case 'buff': {
                    const buffType = this.resolveBuffStatusType(effect.params);
                    
                    // Handle Charge specially - reduces cooldown instead of adding status effect
                    if (buffType === StatusEffectType.Charge) {
                        // Charge reduces cooldown of all items on source side
                        const chargeAmount = effect.value;
                        this.applyChargeToSide(sourceSide, chargeAmount, item.id);
                        console.log(`[BattleEngine] Charge: reduced cooldown by ${chargeAmount} for ${sourceSide} side`);
                    } else {
                        // Other buffs create status effects
                        this.addStatusEffect(sourceSide, {
                            type: buffType,
                            duration: (effect.params?.duration as number) ?? 5,
                            value: effect.value,
                            sourceItemId: item.id,
                            stacks: Math.max(1, effect.value)
                        });
                    }
                    break;
                }
                case 'debuff':
                    const debuffType = (effect.params?.statusType as StatusEffectType) ?? StatusEffectType.Poison;
                    this.addStatusEffect(targetSide, {
                        type: debuffType,
                        duration: (effect.params?.duration as number) ?? 3,
                        value: effect.value,
                        sourceItemId: item.id,
                        stacks: 1
                    });
                    break;
                case 'special':
                    // Handle special effects like thorns, lifesteal, etc.
                    if (effect.params?.thorns) {
                        // Reflect damage to attacker
                        this.applyDamageWithShield(sourceSide, effect.value);
                    }
                    if (effect.params?.lifesteal) {
                        const healAmount = Math.min(effect.value, this.getMaxHp(targetSide) - this.getCurrentHp(targetSide));
                        this.applyHeal(sourceSide, healAmount);
                    }
                    break;
                default:
                    console.warn(`[BattleEngine] Unknown effect type: ${effect.type}`);
                    break;
            }
        }

        // Check adjacent coordination
        this.resolveAdjacentEffects(item.id, sourceSide);
    }

    /**
     * Resolve buff status type from effect params with safe fallback.
     */
    private resolveBuffStatusType(params?: Record<string, unknown>): StatusEffectType {
        const statusTypeRaw = typeof params?.statusType === 'string' ? params.statusType : '';
        const mapped = BUFF_STATUS_MAP[statusTypeRaw];

        if (!mapped) {
            console.warn(`[BattleEngine] Unknown buff statusType: '${statusTypeRaw}', defaulting to shield`);
            return StatusEffectType.Shield;
        }

        return mapped;
    }

    /**
     * Apply charge effect - reduces cooldown of all items on the given side
     * Charge is an instant effect that reduces currentCooldown (not a status effect)
     */
    private applyChargeToSide(side: 'player' | 'enemy', chargeAmount: number, sourceItemId: string): void {
        const items = side === 'player' ? this.playerItems : this.enemyItems;
        
        for (const item of items) {
            if (item.destroyed) continue;
            
            // Reduce cooldown, clamped to minimum 0
            const oldCooldown = item.currentCooldown;
            item.currentCooldown = Math.max(0, item.currentCooldown - chargeAmount);
            
            console.log(`[BattleEngine] Charge: item ${item.id} (${item.name}) cooldown ${oldCooldown}s -> ${item.currentCooldown}s`);
        }
    }

    /**
     * Apply damage with shield absorption
     */
    private applyDamageWithShield(target: 'player' | 'enemy', damage: number): void {
        const effects = target === 'player' ? this.playerEffects : this.enemyEffects;
        const shieldEffect = effects.find(e => e.type === StatusEffectType.Shield);
        
        let remainingDamage = damage;
        
        if (shieldEffect && shieldEffect.stacks > 0) {
            const shieldAbsorb = Math.min(shieldEffect.stacks, remainingDamage);
            shieldEffect.stacks -= shieldAbsorb;
            remainingDamage -= shieldAbsorb;
            
            // Log shield used
            this.eventLog.push({
                time: this.currentTime,
                type: 'effect_tick',
                target,
                value: shieldAbsorb,
                description: `Shield absorbed ${shieldAbsorb} damage`
            });
        }

        // Apply remaining damage
        if (remainingDamage > 0) {
            if (target === 'player') {
                this.playerHp = Math.max(0, this.playerHp - remainingDamage);
            } else {
                this.enemyHp = Math.max(0, this.enemyHp - remainingDamage);
            }
            
            this.eventLog.push({
                time: this.currentTime,
                type: 'damage',
                target,
                value: remainingDamage,
                description: `Dealt ${remainingDamage} damage`
            });
        }
    }

    /**
     * Add a status effect to a side
     */
    private addStatusEffect(side: 'player' | 'enemy', effect: IStatusEffect): void {
        const effects = side === 'player' ? this.playerEffects : this.enemyEffects;
        
        // Check if same type exists, stack if so
        const existing = effects.find(e => e.type === effect.type);
        if (existing) {
            existing.stacks += effect.stacks;
            existing.duration = Math.max(existing.duration, effect.duration);
        } else {
            effects.push({ ...effect });
        }

        this.eventLog.push({
            time: this.currentTime,
            type: 'status_apply',
            target: side,
            value: effect.value,
            description: `Applied ${effect.type} (${effect.stacks} stacks)`
        });
    }

    /**
     * Tick status effects over time
     */
    public tickStatusEffects(fromTime: number, toTime: number): void {
        const deltaTime = toTime - fromTime;
        
        // Process player effects
        this.tickSideEffects('player', deltaTime);
        
        // Process enemy effects
        this.tickSideEffects('enemy', deltaTime);
    }

    /**
     * Tick effects for one side
     */
    private tickSideEffects(side: 'player' | 'enemy', deltaTime: number): void {
        const effects = side === 'player' ? this.playerEffects : this.enemyEffects;
        const targetHp = side === 'player' ? this.playerHp : this.enemyHp;
        const maxHp = 100; // TODO: get from config

        for (let i = effects.length - 1; i >= 0; i--) {
            const effect = effects[i];
            
            // Apply per-tick effects
            switch (effect.type) {
                case StatusEffectType.Poison:
                    const poisonDamage = effect.value * deltaTime;
                    if (side === 'player') {
                        this.playerHp = Math.max(0, this.playerHp - poisonDamage);
                    } else {
                        this.enemyHp = Math.max(0, this.enemyHp - poisonDamage);
                    }
                    this.eventLog.push({
                        time: this.currentTime,
                        type: 'effect_tick',
                        target: side,
                        value: poisonDamage,
                        description: `Poison dealt ${poisonDamage.toFixed(2)} damage`
                    });
                    break;
                    
                case StatusEffectType.Burn:
                    const burnDamage = (effect.value / 100) * maxHp * deltaTime;
                    if (side === 'player') {
                        this.playerHp = Math.max(0, this.playerHp - burnDamage);
                    } else {
                        this.enemyHp = Math.max(0, this.enemyHp - burnDamage);
                    }
                    this.eventLog.push({
                        time: this.currentTime,
                        type: 'effect_tick',
                        target: side,
                        value: burnDamage,
                        description: `Burn dealt ${burnDamage.toFixed(2)} damage`
                    });
                    break;
                    
                case StatusEffectType.Regen:
                    const regenAmount = effect.value * deltaTime;
                    if (side === 'player') {
                        this.playerHp = Math.min(maxHp, this.playerHp + regenAmount);
                    } else {
                        this.enemyHp = Math.min(maxHp, this.enemyHp + regenAmount);
                    }
                    this.eventLog.push({
                        time: this.currentTime,
                        type: 'effect_tick',
                        target: side,
                        value: regenAmount,
                        description: `Regen healed ${regenAmount.toFixed(2)} HP`
                    });
                    break;
            }

            // Decrease duration
            effect.duration -= deltaTime;
            
            // Remove expired effects
            if (effect.duration <= 0) {
                effects.splice(i, 1);
                this.eventLog.push({
                    time: this.currentTime,
                    type: 'status_expire',
                    target: side,
                    value: 0,
                    description: `${effect.type} expired`
                });
            }
        }
    }

    /**
     * Resolve adjacent item effects
     */
    private resolveAdjacentEffects(itemId: string, sourceSide: 'player' | 'enemy'): void {
        const grid = sourceSide === 'player' ? this.playerGrid : this.enemyGrid;
        const adjacentIds = grid.getAdjacentItems(itemId);
        
        for (const adjacentId of adjacentIds) {
            const adjacentItem = sourceSide === 'player'
                ? this.playerItems.find(i => i.id === adjacentId)
                : this.enemyItems.find(i => i.id === adjacentId);
            
            if (!adjacentItem || adjacentItem.destroyed) continue;

            // Check for OnAdjacentTrigger effects
            for (const effect of adjacentItem.effects) {
                if (effect.trigger === TriggerTiming.OnAdjacentTrigger) {
                    // Trigger immediately without re-scheduling
                    this.eventLog.push({
                        time: this.currentTime,
                        type: 'item_trigger',
                        itemId: adjacentId,
                        target: sourceSide === 'player' ? 'enemy' : 'player',
                        value: effect.value,
                        description: `${adjacentItem.name} triggered by adjacent ${itemId}`
                    });
                }
            }
        }
    }

    /**
     * Check if battle has ended
     */
    public checkBattleEnd(): 'player_win' | 'enemy_win' | 'draw' | null {
        if (this.playerHp <= 0 && this.enemyHp <= 0) {
            return 'draw';
        }
        if (this.playerHp <= 0) {
            return 'enemy_win';
        }
        if (this.enemyHp <= 0) {
            return 'player_win';
        }
        // Check timeout
        if (this.currentTime >= this.maxDuration) {
            const playerPercent = this.playerHp / 100;
            const enemyPercent = this.enemyHp / 100;
            
            if (playerPercent > enemyPercent) {
                return 'player_win';
            } else if (enemyPercent > playerPercent) {
                return 'enemy_win';
            } else {
                return 'draw';
            }
        }
        return null;
    }

    /**
     * Get current HP for a side
     */
    private getCurrentHp(side: 'player' | 'enemy'): number {
        return side === 'player' ? this.playerHp : this.enemyHp;
    }

    /**
     * Get max HP for a side
     */
    private getMaxHp(side: 'player' | 'enemy'): number {
        return 100; // TODO: get from config
    }

    /**
     * Run full battle to completion
     */
    public runFullBattle(): IBattleState {
        let lastTime = 0;
        
        while (!this.isFinished) {
            // Advance to next event
            const event = this.advanceToNext();
            
            if (!event) {
                break;
            }

            // Tick status effects from last time to current time
            this.tickStatusEffects(lastTime, this.currentTime);
            lastTime = this.currentTime;

            // Resolve the event
            this.resolveEvent(event);

            // Check for battle end
            const result = this.checkBattleEnd();
            if (result) {
                this.isFinished = true;
                if (result === 'player_win') {
                    this.result = 'win';
                } else if (result === 'enemy_win') {
                    this.result = 'lose';
                } else {
                    this.result = 'draw';
                }
            }
        }

        // Final tick for remaining effects
        this.tickStatusEffects(lastTime, this.currentTime);

        return this.getBattleState();
    }
}
