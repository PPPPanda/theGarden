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
     * Process an item and schedule its effects
     */
    private processItem(item: IGridItem, side: 'player' | 'enemy'): void {
        for (const effect of item.effects) {
            if (effect.trigger === TriggerTiming.OnBattleStart) {
                // Execute immediately at battle start
                const event: ITimelineEvent = {
                    time: this.currentTime,
                    type: 'item_trigger',
                    itemId: item.id,
                    target: side === 'player' ? 'enemy' : 'player',
                    value: effect.value,
                    description: `${item.name} triggers ${effect.type} at battle start`
                };
                this.eventLog.push(event);
            } else if (effect.trigger === TriggerTiming.Passive) {
                // Passive effects are always active, no scheduling needed
            } else {
                // Schedule based on cooldown
                const effectiveCooldown = this.getEffectiveCooldown(item.cooldown, side === 'player' ? this.playerEffects : this.enemyEffects);
                if (effectiveCooldown > 0) {
                    const initialDelay = effectiveCooldown * 0.5;
                    this.eventTimeline.insert({
                        time: initialDelay,
                        itemId: item.id,
                        side,
                        effects: [effect]
                    });
                }
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

        // Create timeline event
        const event: ITimelineEvent = {
            time: this.currentTime,
            type: 'item_trigger',
            itemId: entry.itemId,
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
     * Schedule next trigger for an item
     */
    private scheduleItemTrigger(item: IGridItem, side: 'player' | 'enemy'): void {
        const effects = side === 'player' ? this.playerEffects : this.enemyEffects;
        
        for (const effect of item.effects) {
            if (effect.trigger === TriggerTiming.OnCooldownComplete) {
                const effectiveCooldown = this.getEffectiveCooldown(item.cooldown, effects);
                if (effectiveCooldown < Infinity) {
                    this.eventTimeline.insert({
                        time: this.currentTime + effectiveCooldown,
                        itemId: item.id,
                        side,
                        effects: [effect]
                    });
                }
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
}
