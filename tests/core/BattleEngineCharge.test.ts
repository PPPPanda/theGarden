/**
 * BattleEngine Charge 专项测试
 */
import { BattleEngine } from '../../assets/scripts/core/BattleEngine';
import { GridManager } from '../../assets/scripts/core/GridManager';
import { IGridItem, IItemEffect, ItemRarity, ItemSize, TriggerTiming } from '../../assets/scripts/core/types';

type EffectSpec = {
    trigger: TriggerTiming;
    type: 'damage' | 'heal' | 'buff' | 'debuff' | 'special';
    value: number;
    target?: string;
    params?: Record<string, unknown>;
};

const createItem = (
    id: string,
    cooldown: number,
    effects: EffectSpec[]
): IGridItem => ({
    id,
    templateId: `template_${id}`,
    name: `Item ${id}`,
    description: `Description for ${id}`,
    rarity: ItemRarity.Common,
    size: ItemSize.Small,
    gridSize: { rows: 1, cols: 1 },
    position: { row: 0, col: 0 },
    cooldown,
    currentCooldown: 0,
    effects: effects.map((effect, index): IItemEffect => ({
        effectId: `effect_${id}_${index}`,
        trigger: effect.trigger,
        target: effect.target ?? 'enemy',
        type: effect.type,
        value: effect.value,
        params: effect.params,
    })),
    level: 1,
    destroyed: false,
    enchantments: [],
});

describe('BattleEngine Charge', () => {
    it('should move ally next trigger earlier after charge and emit charge log', () => {
        const baselineEngine = new BattleEngine({
            playerItems: [
                createItem('heavy', 8, [
                    { trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 9 }
                ])
            ],
            enemyItems: [],
            playerGrid: new GridManager(4, 4),
            enemyGrid: new GridManager(4, 4),
            seed: 3001,
            playerHp: 100,
            enemyHp: 100,
        });

        const baselineFirstHeavy = baselineEngine.advanceToNext();
        expect(baselineFirstHeavy).not.toBeNull();
        if (!baselineFirstHeavy) {
            throw new Error('Expected baseline heavy event');
        }

        const engine = new BattleEngine({
            playerItems: [
                createItem('charger', 1, [
                    {
                        trigger: TriggerTiming.OnCooldownComplete,
                        type: 'buff',
                        value: 3,
                        params: { statusType: 'charge' },
                    },
                ]),
                createItem('heavy', 8, [
                    { trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 9 }
                ]),
            ],
            enemyItems: [],
            playerGrid: new GridManager(4, 4),
            enemyGrid: new GridManager(4, 4),
            seed: 3001,
            playerHp: 100,
            enemyHp: 100,
        });

        const firstEvent = engine.advanceToNext();
        expect(firstEvent).not.toBeNull();
        if (!firstEvent) {
            throw new Error('Expected first charge event');
        }
        expect(firstEvent.itemId).toBe('charger');

        engine.resolveEvent(firstEvent);

        const chargeLog = engine.getEventLog().find((entry) =>
            entry.description.includes('Charge from charger advanced player cooldown by 3s')
        );
        expect(chargeLog).toBeDefined();
        expect(chargeLog?.time).toBe(firstEvent.time);

        let heavyTriggerTime: number | null = null;
        for (let i = 0; i < 10; i++) {
            const event = engine.advanceToNext();
            if (!event) break;

            if (event.itemId === 'heavy') {
                heavyTriggerTime = event.time;
                break;
            }

            engine.resolveEvent(event);
        }

        expect(heavyTriggerTime).not.toBeNull();
        expect((heavyTriggerTime ?? Infinity)).toBeLessThan(baselineFirstHeavy.time);
    });

    it('should clamp cooldown floor when charge over-advances remaining cooldown', () => {
        const engine = new BattleEngine({
            playerItems: [
                createItem('charger', 1, [
                    {
                        trigger: TriggerTiming.OnCooldownComplete,
                        type: 'buff',
                        value: 50,
                        params: { statusType: 'charge' },
                    },
                ]),
                createItem('heavy', 6, [
                    { trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 10 }
                ]),
            ],
            enemyItems: [],
            playerGrid: new GridManager(4, 4),
            enemyGrid: new GridManager(4, 4),
            seed: 3002,
            playerHp: 100,
            enemyHp: 100,
        });

        const firstEvent = engine.advanceToNext();
        expect(firstEvent).not.toBeNull();
        if (!firstEvent) {
            throw new Error('Expected first charge event');
        }

        engine.resolveEvent(firstEvent);

        const stateAfterCharge = engine.getBattleState();
        const heavyCooldown = stateAfterCharge.player.items.find((item) => item.id === 'heavy')?.currentCooldown;

        expect(heavyCooldown).toBeDefined();
        expect(heavyCooldown ?? -1).toBeGreaterThanOrEqual(0);
        // Over-advanced cooldown should be effectively ready (0 or near-immediate epsilon)
        expect(heavyCooldown ?? Infinity).toBeLessThanOrEqual(0.011);

        const nextEvent = engine.advanceToNext();
        expect(nextEvent).not.toBeNull();
        if (!nextEvent) {
            throw new Error('Expected heavy event after charge clamp');
        }

        expect(nextEvent.itemId).toBe('heavy');
        expect(nextEvent.time).toBeGreaterThan(firstEvent.time);
        expect(nextEvent.time).toBeLessThanOrEqual(firstEvent.time + 0.2);

        const nonNegativeCooldowns = engine.getBattleState().player.items.every((item) => item.currentCooldown >= 0);
        expect(nonNegativeCooldowns).toBe(true);
    });

    it('should keep deterministic event sequence and result with same seed', () => {
        const createChargeEngine = (): BattleEngine => new BattleEngine({
            playerItems: [
                createItem('charger', 2, [
                    {
                        trigger: TriggerTiming.OnCooldownComplete,
                        type: 'buff',
                        value: 2,
                        params: { statusType: 'charge' },
                    },
                ]),
                createItem('striker', 4, [
                    { trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 8 }
                ]),
            ],
            enemyItems: [
                createItem('enemy', 3, [
                    { trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 6 }
                ]),
            ],
            playerGrid: new GridManager(4, 4),
            enemyGrid: new GridManager(4, 4),
            seed: 3003,
            playerHp: 100,
            enemyHp: 100,
            maxDuration: 20,
        });

        const resultA = createChargeEngine().runFullBattle();
        const resultB = createChargeEngine().runFullBattle();

        const compactA = resultA.eventLog.map((entry) => `${entry.time.toFixed(4)}|${entry.type}|${entry.itemId ?? ''}|${entry.target}|${entry.value}`);
        const compactB = resultB.eventLog.map((entry) => `${entry.time.toFixed(4)}|${entry.type}|${entry.itemId ?? ''}|${entry.target}|${entry.value}`);

        expect(compactA).toEqual(compactB);
        expect(resultA.result).toEqual(resultB.result);
    });

    it('should keep same-time ordering stable by itemId after charge reorder', () => {
        const engine = new BattleEngine({
            playerItems: [
                createItem('charger', 1, [
                    {
                        trigger: TriggerTiming.OnCooldownComplete,
                        type: 'buff',
                        value: 2,
                        params: { statusType: 'charge' },
                    },
                ]),
                createItem('alpha', 6, [
                    { trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 5 }
                ]),
                createItem('zeta', 6, [
                    { trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 5 }
                ]),
            ],
            enemyItems: [],
            playerGrid: new GridManager(4, 4),
            enemyGrid: new GridManager(4, 4),
            seed: 3004,
            playerHp: 100,
            enemyHp: 100,
        });

        const first = engine.advanceToNext();
        expect(first?.itemId).toBe('charger');
        if (!first) {
            throw new Error('Expected first charge event');
        }

        engine.resolveEvent(first);

        const eventA = engine.advanceToNext();
        const eventB = engine.advanceToNext();

        expect(eventA).not.toBeNull();
        expect(eventB).not.toBeNull();
        if (!eventA || !eventB) {
            throw new Error('Expected reordered same-time events');
        }

        expect(eventA.time).toBe(eventB.time);
        expect(eventA.itemId).toBe('alpha');
        expect(eventB.itemId).toBe('zeta');
    });
});
