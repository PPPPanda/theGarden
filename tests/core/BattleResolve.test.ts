/**
 * BattleEngine 结算单元测试
 */
import { BattleEngine } from '../../assets/scripts/core/BattleEngine';
import { GridManager } from '../../assets/scripts/core/GridManager';
import { IGridItem, ItemRarity, ItemSize, StatusEffectType, TriggerTiming } from '../../assets/scripts/core/types';

describe('BattleEngine Battle Resolution', () => {
    // Helper to create test items
    const createItem = (
        id: string,
        cooldown: number,
        effects?: { trigger: TriggerTiming; type: string; value: number; target?: string; params?: Record<string, any> }[]
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
        effects: effects?.map(e => ({
            effectId: `effect_${id}`,
            trigger: e.trigger,
            target: e.target ?? 'enemy',
            type: e.type,
            value: e.value,
            params: e.params
        })) ?? [],
        level: 1,
        destroyed: false,
        enchantments: []
    });

    describe('trigger filtering', () => {
        it('should execute only OnCooldownComplete effects for cooldown trigger events', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);

            const item = createItem('filter_item', 2, [
                { trigger: TriggerTiming.OnBattleStart, type: 'damage', value: 80 },
                { trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 10 }
            ]);

            const engine = new BattleEngine({
                playerItems: [item],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1100,
                playerHp: 100,
                enemyHp: 100
            });

            const event = engine.advanceToNext();
            expect(event).not.toBeNull();
            if (!event) {
                throw new Error('Expected cooldown event to be emitted');
            }

            engine.resolveEvent(event);

            // Only cooldown damage should apply (10), OnBattleStart damage must be ignored here.
            const state = engine.getBattleState();
            expect(state.opponent.hero.currentHealth).toBe(90);
        });
    });

    describe('buff status dispatch', () => {
        const statusCases: Array<[string, StatusEffectType]> = [
            ['shield', StatusEffectType.Shield],
            ['haste', StatusEffectType.Haste],
            ['slow', StatusEffectType.Slow],
            ['freeze', StatusEffectType.Freeze],
            ['regen', StatusEffectType.Regen],
        ];

        it.each(statusCases)('should dispatch buff statusType=%s to %s', (statusType, expectedType) => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);

            const item = createItem(`buff_${statusType}`, 2, [
                {
                    trigger: TriggerTiming.OnCooldownComplete,
                    type: 'buff',
                    value: 1,
                    params: { statusType, duration: 6 }
                }
            ]);

            const engine = new BattleEngine({
                playerItems: [item],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1200,
                playerHp: 100,
                enemyHp: 100
            });

            const event = engine.advanceToNext();
            expect(event).not.toBeNull();
            if (!event) {
                throw new Error('Expected cooldown event to be emitted');
            }

            engine.resolveEvent(event);

            const state = engine.getBattleState();
            const applied = state.playerEffects.find(effect => effect.sourceItemId === item.id);
            expect(applied?.type).toBe(expectedType);
        });

        it('should fallback to shield and warn for unknown buff statusType', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);

            const item = createItem('buff_unknown', 2, [
                {
                    trigger: TriggerTiming.OnCooldownComplete,
                    type: 'buff',
                    value: 1,
                    params: { statusType: 'mystery_status', duration: 4 }
                }
            ]);

            const engine = new BattleEngine({
                playerItems: [item],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1201,
                playerHp: 100,
                enemyHp: 100
            });

            const event = engine.advanceToNext();
            expect(event).not.toBeNull();
            if (!event) {
                throw new Error('Expected cooldown event to be emitted');
            }

            engine.resolveEvent(event);

            const state = engine.getBattleState();
            const applied = state.playerEffects.find(effect => effect.sourceItemId === item.id);
            expect(applied?.type).toBe(StatusEffectType.Shield);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown buff statusType'));

            warnSpy.mockRestore();
        });
    });

    describe('damage with shield', () => {
        it('should absorb damage with shield stacks', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            const engine = new BattleEngine({
                playerItems: [],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1000,
                playerHp: 10,
                enemyHp: 10
            });

            // Manually add shield effect to enemy
            (engine as any).enemyEffects = [{
                type: 'shield' as any,
                duration: 10,
                remaining: 10,
                value: 3,
                sourceItemId: 'shield_item',
                stacks: 3
            }];

            // Deal 5 damage - should absorb 3, leave 2
            (engine as any).applyDamageWithShield('enemy', 5);
            
            const state = engine.getBattleState();
            expect(state.opponent.hero.currentHealth).toBe(8); // 10 - 2
        });

        it('should handle shield overflow', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            const engine = new BattleEngine({
                playerItems: [],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1001,
                playerHp: 10,
                enemyHp: 10
            });

            // Add 5 shield stacks
            (engine as any).enemyEffects = [{
                type: 'shield' as any,
                duration: 10,
                remaining: 10,
                value: 1,
                sourceItemId: 'shield_item',
                stacks: 5
            }];

            // Deal 3 damage - all absorbed
            (engine as any).applyDamageWithShield('enemy', 3);
            
            const state = engine.getBattleState();
            expect(state.opponent.hero.currentHealth).toBe(10); // Full HP
        });
    });

    describe('poison tick damage', () => {
        it('should accumulate poison damage over time', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            const engine = new BattleEngine({
                playerItems: [],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1002,
                playerHp: 10,
                enemyHp: 10
            });

            // Add poison effect with value=2 per second
            (engine as any).enemyEffects = [{
                type: 'poison' as any,
                duration: 3,
                remaining: 3,
                value: 2,
                sourceItemId: 'poison_item',
                stacks: 1
            }];

            // Tick for 3 seconds
            (engine as any).tickSideEffects('enemy', 3);
            
            const state = engine.getBattleState();
            expect(state.opponent.hero.currentHealth).toBe(4); // 10 - 6
        });
    });

    describe('regen tick healing', () => {
        it('should heal over time with regen', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            const engine = new BattleEngine({
                playerItems: [],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1003,
                playerHp: 50,
                enemyHp: 50
            });

            // Add regen effect with value=5 per second
            (engine as any).playerEffects = [{
                type: 'regen' as any,
                duration: 2,
                remaining: 2,
                value: 5,
                sourceItemId: 'regen_item',
                stacks: 1
            }];

            // Tick for 2 seconds
            (engine as any).tickSideEffects('player', 2);
            
            const state = engine.getBattleState();
            expect(state.player.hero.currentHealth).toBe(60); // 50 + 10
        });

        it('should not exceed max HP', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            const engine = new BattleEngine({
                playerItems: [],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1004,
                playerHp: 90,
                enemyHp: 100
            });

            // Add regen effect with value=20 per second
            (engine as any).playerEffects = [{
                type: 'regen' as any,
                duration: 2,
                remaining: 2,
                value: 20,
                sourceItemId: 'regen_item',
                stacks: 1
            }];

            // Tick for 2 seconds - would heal 40 but max is 100
            (engine as any).tickSideEffects('player', 2);
            
            const state = engine.getBattleState();
            expect(state.player.hero.currentHealth).toBe(100);
        });
    });

    describe('checkBattleEnd', () => {
        it('should detect player win', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            const engine = new BattleEngine({
                playerItems: [],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1005,
                playerHp: 10,
                enemyHp: 0
            });

            expect(engine.checkBattleEnd()).toBe('player_win');
        });

        it('should detect enemy win', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            const engine = new BattleEngine({
                playerItems: [],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1006,
                playerHp: 0,
                enemyHp: 10
            });

            expect(engine.checkBattleEnd()).toBe('enemy_win');
        });

        it('should detect draw', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            const engine = new BattleEngine({
                playerItems: [],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1007,
                playerHp: 0,
                enemyHp: 0
            });

            expect(engine.checkBattleEnd()).toBe('draw');
        });

        it('should detect timeout winner by HP percent', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            const engine = new BattleEngine({
                playerItems: [],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1008,
                playerHp: 60,
                enemyHp: 40,
                maxDuration: 10
            });

            // Set current time to max duration (timeout)
            (engine as any).currentTime = 10;
            
            expect(engine.checkBattleEnd()).toBe('player_win');
        });

        it('should detect timeout draw', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            const engine = new BattleEngine({
                playerItems: [],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 1009,
                playerHp: 50,
                enemyHp: 50,
                maxDuration: 10
            });

            // Set current time to max duration (timeout)
            (engine as any).currentTime = 10;
            
            expect(engine.checkBattleEnd()).toBe('draw');
        });
    });

    describe('runFullBattle determinism', () => {
        it('should produce identical event logs with same seed', () => {
            const createTestEngine = () => {
                const playerGrid = new GridManager(4, 4);
                const enemyGrid = new GridManager(4, 4);
                const items = [
                    createItem('item1', 2, [{ trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 10 }]),
                    createItem('item2', 3, [{ trigger: TriggerTiming.OnCooldownComplete, type: 'heal', value: 5 }])
                ];
                
                return new BattleEngine({
                    playerItems: items,
                    enemyItems: [],
                    playerGrid,
                    enemyGrid,
                    seed: 9999,
                    playerHp: 100,
                    enemyHp: 100,
                    maxDuration: 20
                });
            };

            const engine1 = createTestEngine();
            const engine2 = createTestEngine();

            const result1 = engine1.runFullBattle();
            const result2 = engine2.runFullBattle();

            // Compare event logs as JSON
            const log1 = JSON.stringify(result1.eventLog);
            const log2 = JSON.stringify(result2.eventLog);
            
            expect(log1).toEqual(log2);
        });

        it('should complete 2v2 battle without crash', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            const playerItems = [
                createItem('p1', 2, [{ trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 8 }]),
                createItem('p2', 4, [{ trigger: TriggerTiming.OnCooldownComplete, type: 'heal', value: 5 }])
            ];
            
            const enemyItems = [
                createItem('e1', 3, [{ trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 6 }]),
                createItem('e2', 5, [{ trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 10 }])
            ];
            
            const engine = new BattleEngine({
                playerItems,
                enemyItems,
                playerGrid,
                enemyGrid,
                seed: 12345,
                playerHp: 100,
                enemyHp: 100,
                maxDuration: 30
            });

            const result = engine.runFullBattle();
            
            // Should complete without crash
            expect(result.eventLog.length).toBeGreaterThan(0);
            expect(result.player.hero.currentHealth).toBeGreaterThanOrEqual(0);
            expect(result.opponent.hero.currentHealth).toBeGreaterThanOrEqual(0);
        });
    });

    describe('adjacent coordination', () => {
        it('should find adjacent items correctly', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            // Place items adjacent to each other
            const item1 = createItem('item1', 5, [{ trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 10 }]);
            item1.position = { row: 1, col: 1 };
            playerGrid.placeItem(item1);

            const item2 = createItem('item2', 5, [{ trigger: TriggerTiming.OnAdjacentTrigger, type: 'damage', value: 5 }]);
            item2.position = { row: 1, col: 2 }; // Adjacent to item1
            playerGrid.placeItem(item2);

            // Test adjacency query
            const adjacent = playerGrid.getAdjacentItems('item1');
            expect(adjacent).toContain('item2');
        });

        it('should log adjacent trigger event', () => {
            const playerGrid = new GridManager(4, 4);
            const enemyGrid = new GridManager(4, 4);
            
            // Place items adjacent to each other
            const item1 = createItem('item1', 5, [{ trigger: TriggerTiming.OnCooldownComplete, type: 'damage', value: 10 }]);
            item1.position = { row: 1, col: 1 };
            playerGrid.placeItem(item1);

            const item2 = createItem('item2', 5, [{ trigger: TriggerTiming.OnAdjacentTrigger, type: 'damage', value: 5 }]);
            item2.position = { row: 1, col: 2 }; // Adjacent to item1
            playerGrid.placeItem(item2);

            const engine = new BattleEngine({
                playerItems: [item1, item2],
                enemyItems: [],
                playerGrid,
                enemyGrid,
                seed: 2000,
                playerHp: 100,
                enemyHp: 100
            });

            // Run one event - item1 triggers
            engine.advanceToNext();
            
            // The adjacency resolution should be logged
            const log = engine.getEventLog();
            // There should be log entries from processing the item
            expect(log.length).toBeGreaterThan(0);
        });
    });
});
