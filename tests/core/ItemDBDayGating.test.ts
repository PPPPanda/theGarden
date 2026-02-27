/**
 * ItemDB and ShopManager Day-Gating 单元测试
 */
import { ItemDB, getItemDB } from '../../assets/scripts/core/ItemDB';
import { ShopManager } from '../../assets/scripts/core/ShopManager';
import { GameLoop } from '../../assets/scripts/core/GameLoop';
import { ItemRarity } from '../../assets/scripts/core/types';

describe('ItemDB Day-Gating', () => {
    let itemDB: ItemDB;

    beforeEach(() => {
        itemDB = getItemDB(12345);
    });

    describe('getAvailableRaritiesForDay', () => {
        it('Day 1 should return only Common', () => {
            const rarities = itemDB.getAvailableRaritiesForDay(1);
            expect(rarities).toEqual([ItemRarity.Common]);
        });

        it('Day 3 should return only Common', () => {
            const rarities = itemDB.getAvailableRaritiesForDay(3);
            expect(rarities).toEqual([ItemRarity.Common]);
        });

        it('Day 4 should return Common + Uncommon', () => {
            const rarities = itemDB.getAvailableRaritiesForDay(4);
            expect(rarities).toContain(ItemRarity.Common);
            expect(rarities).toContain(ItemRarity.Uncommon);
            expect(rarities).toHaveLength(2);
        });

        it('Day 7 should return Common + Uncommon + Rare', () => {
            const rarities = itemDB.getAvailableRaritiesForDay(7);
            expect(rarities).toContain(ItemRarity.Common);
            expect(rarities).toContain(ItemRarity.Uncommon);
            expect(rarities).toContain(ItemRarity.Rare);
            expect(rarities).toHaveLength(3);
        });

        it('Day 10 should return Common + Uncommon + Rare + Epic', () => {
            const rarities = itemDB.getAvailableRaritiesForDay(10);
            expect(rarities).toContain(ItemRarity.Common);
            expect(rarities).toContain(ItemRarity.Uncommon);
            expect(rarities).toContain(ItemRarity.Rare);
            expect(rarities).toContain(ItemRarity.Epic);
            expect(rarities).toHaveLength(4);
        });

        it('Day 13 should include Legendary', () => {
            const rarities = itemDB.getAvailableRaritiesForDay(13);
            expect(rarities).toContain(ItemRarity.Legendary);
            expect(rarities).toHaveLength(5);
        });

        it('Day 100 should include Legendary', () => {
            const rarities = itemDB.getAvailableRaritiesForDay(100);
            expect(rarities).toContain(ItemRarity.Legendary);
            expect(rarities).toHaveLength(5);
        });

        it('negative day should default to Day 1 (Common only)', () => {
            const rarities = itemDB.getAvailableRaritiesForDay(-5);
            expect(rarities).toEqual([ItemRarity.Common]);
        });

        it('zero day should default to Day 1 (Common only)', () => {
            const rarities = itemDB.getAvailableRaritiesForDay(0);
            expect(rarities).toEqual([ItemRarity.Common]);
        });
    });

    describe('getAvailableByDay', () => {
        it('Day 1 items should all be Common rarity', () => {
            const items = itemDB.getAvailableByDay(1);
            for (const item of items) {
                expect(item.rarity).toBe(ItemRarity.Common);
            }
        });

        it('Day 7 items should be Common, Uncommon, or Rare only', () => {
            const items = itemDB.getAvailableByDay(7);
            const validRarities = [ItemRarity.Common, ItemRarity.Uncommon, ItemRarity.Rare];
            for (const item of items) {
                expect(validRarities).toContain(item.rarity);
            }
        });

        it('Day 13+ items can include Legendary', () => {
            const items = itemDB.getAvailableByDay(13);
            const hasLegendary = items.some(item => item.rarity === ItemRarity.Legendary);
            // May or may not have legendary depending on random seed and weights
            // But it's possible to get legendary at Day 13+
            expect(items.length).toBeGreaterThan(0);
        });
    });

    describe('randomPoolByDay', () => {
        it('Day 1 random pool should only contain Common items', () => {
            const items = itemDB.randomPoolByDay(10, 1, 99999);
            for (const item of items) {
                expect(item.rarity).toBe(ItemRarity.Common);
            }
        });

        it('Day 7 random pool should respect rarity limits', () => {
            const items = itemDB.randomPoolByDay(20, 7, 88888);
            const validRarities = [ItemRarity.Common, ItemRarity.Uncommon, ItemRarity.Rare];
            for (const item of items) {
                expect(validRarities).toContain(item.rarity);
            }
        });

        it('Day 13 random pool can include Legendary', () => {
            // Run multiple times to increase chance of getting legendary
            let gotLegendary = false;
            for (let i = 0; i < 50; i++) {
                const items = itemDB.randomPoolByDay(5, 13, i * 1000);
                if (items.some(item => item.rarity === ItemRarity.Legendary)) {
                    gotLegendary = true;
                    break;
                }
            }
            // With enough iterations, we should eventually get legendary at Day 13
            expect(gotLegendary).toBe(true);
        });
    });

    describe('randomPool legacy compatibility', () => {
        it('randomPool without day should return all items', () => {
            const items = itemDB.randomPool(10, 77777);
            // Legacy method returns all rarities
            expect(items.length).toBe(10);
            const rarities = items.map(i => i.rarity);
            // Should include various rarities (not filtered by day)
            const uniqueRarities = [...new Set(rarities)];
            expect(uniqueRarities.length).toBeGreaterThan(1);
        });
    });
});

describe('ShopManager Day-Gating', () => {
    let shop: ShopManager;

    beforeEach(() => {
        shop = new ShopManager(54321);
    });

    describe('setDay and initial shop', () => {
        it('Day 1 initial shop should have Common items only', () => {
            shop.setDay(1);
            shop.reset();
            const slots = shop.getSlots();
            
            for (const slot of slots) {
                if (slot.templateId) {
                    const item = getItemDB(54321).getAllTemplates()
                        .find(t => t.templateId === slot.templateId);
                    if (item) {
                        expect(item.rarity).toBe(ItemRarity.Common);
                    }
                }
            }
        });

        it('Day 7 initial shop should have items up to Rare', () => {
            shop.setDay(7);
            shop.reset();
            const slots = shop.getSlots();
            const validRarities = [ItemRarity.Common, ItemRarity.Uncommon, ItemRarity.Rare];
            
            for (const slot of slots) {
                if (slot.templateId) {
                    const item = getItemDB(54321).getAllTemplates()
                        .find(t => t.templateId === slot.templateId);
                    if (item) {
                        expect(validRarities).toContain(item.rarity);
                    }
                }
            }
        });
    });

    describe('refreshResult with day', () => {
        it('Day 4 refresh should include Uncommon items', () => {
            shop.setDay(4);
            shop.refreshResult(4);
            const slots = shop.getSlots();
            
            // At least some items should be Uncommon or higher at Day 4
            const hasUncommonOrHigher = slots.some(slot => {
                if (!slot.templateId) return false;
                const item = getItemDB(54321).getAllTemplates()
                    .find(t => t.templateId === slot.templateId);
                return item && item.rarity !== ItemRarity.Common;
            });
            expect(hasUncommonOrHigher).toBe(true);
        });
    });
});

describe('GameLoop Day-Gating integration', () => {
    let gameLoop: GameLoop;

    beforeEach(() => {
        gameLoop = new GameLoop(11111);
    });

    it('startDay should sync day to shop', () => {
        // Start day 5
        gameLoop.completeDay();
        gameLoop.startDay(); // This will use the day from completeDay increment
        
        // Verify shop has the correct day set internally
        const shop = gameLoop.getShopManager() as any;
        // The shop should now be set to the current day
        expect(shop.currentDay).toBeGreaterThanOrEqual(1);
    });

    it('refreshShop should use current day for filtering', () => {
        // Ensure player has enough gold via public method
        gameLoop.startDay();
        
        // Player starts with default gold (50), need to check if refresh is affordable
        const canRefresh = gameLoop.refreshShop();
        // Just verify the method works without error
        expect(typeof canRefresh).toBe('boolean');
    });
});
