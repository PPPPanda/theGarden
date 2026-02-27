/**
 * ItemDB - Item Configuration Database
 * Loads and manages item templates from configs/items.json
 */

import { IItemTemplate, IGridItem, ItemRarity, ItemSize, IGridPosition, IGridSize, TriggerTiming } from './types';
import { SeededRandom } from '../utils/SeededRandom';

// Import item config JSON
import itemConfig from '../../../configs/items.json';

/**
 * Item Database - manages item templates and instances
 */
export class ItemDB {
    private templates: Map<string, IItemTemplate> = new Map();
    private random: SeededRandom;
    private itemCounter: number = 0;

    constructor(seed: number = 42) {
        this.random = new SeededRandom(seed);
        this.loadTemplates();
    }

    /**
     * Load item templates from config
     */
    private loadTemplates(): void {
        const items = itemConfig.items as IItemTemplate[];
        for (const item of items) {
            this.templates.set(item.templateId, item);
        }
    }

    /**
     * Get template by ID
     */
    public getTemplate(templateId: string): IItemTemplate | undefined {
        return this.templates.get(templateId);
    }

    /**
     * Get all templates
     */
    public getAllTemplates(): IItemTemplate[] {
        return Array.from(this.templates.values());
    }

    /**
     * Create item instance from template
     */
    public createItem(templateId: string, position: IGridPosition, id?: string): IGridItem | null {
        const template = this.getTemplate(templateId);
        if (!template) {
            return null;
        }

        return {
            id: id ?? `item_${templateId}_${this.itemCounter++}`,
            templateId: template.templateId,
            name: template.name,
            description: template.description,
            rarity: template.rarity as ItemRarity,
            size: template.size as ItemSize,
            gridSize: template.gridSize,
            position,
            cooldown: template.cooldown,
            currentCooldown: 0,
            effects: [...template.effects],
            level: template.tier ?? 1,
            destroyed: false,
            enchantments: []
        };
    }

    /**
     * Get items by rarity
     */
    public getItemsByRarity(rarity: ItemRarity): IItemTemplate[] {
        return this.getAllTemplates().filter(item => item.rarity === rarity);
    }

    /**
     * Get available rarities for a given day (per architecture spec)
     * Day 1-3: Common only
     * Day 4-6: Common + Uncommon
     * Day 7-9: Common + Uncommon + Rare
     * Day 10-12: Common + Uncommon + Rare + Epic
     * Day 13+: All rarities including Legendary
     */
    public getAvailableRaritiesForDay(day: number): ItemRarity[] {
        if (day <= 3) {
            return [ItemRarity.Common];
        } else if (day <= 6) {
            return [ItemRarity.Common, ItemRarity.Uncommon];
        } else if (day <= 9) {
            return [ItemRarity.Common, ItemRarity.Uncommon, ItemRarity.Rare];
        } else if (day <= 12) {
            return [ItemRarity.Common, ItemRarity.Uncommon, ItemRarity.Rare, ItemRarity.Epic];
        } else {
            // Day 13+: all rarities including Legendary
            return [ItemRarity.Common, ItemRarity.Uncommon, ItemRarity.Rare, ItemRarity.Epic, ItemRarity.Legendary];
        }
    }

    /**
     * Get all items available for a given day (filtered by rarity)
     */
    public getAvailableByDay(day: number): IItemTemplate[] {
        const validDay = Math.max(1, Math.floor(day)); // Ensure positive integer
        const rarities = this.getAvailableRaritiesForDay(validDay);
        return this.getAllTemplates().filter(item => 
            rarities.includes(item.rarity as ItemRarity)
        );
    }

    /**
     * Random item pool with weighted probability (legacy - uses ALL items regardless of day)
     * This maintains backward compatibility with existing callers.
     */
    public randomPool(count: number, seed?: number): IItemTemplate[] {
        const rng = seed !== undefined ? new SeededRandom(seed) : this.random;
        const templates = this.getAllTemplates();
        
        if (templates.length === 0) {
            console.warn('[ItemDB] randomPool: no items in database');
            return [];
        }
        
        const result: IItemTemplate[] = [];

        for (let i = 0; i < count; i++) {
            const weights = templates.map(t => this.getWeight(t.rarity as ItemRarity));
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let randomValue = rng.next() * totalWeight;
            
            for (let j = 0; j < templates.length; j++) {
                randomValue -= weights[j];
                if (randomValue <= 0) {
                    result.push(templates[j]);
                    break;
                }
            }
        }

        return result;
    }

    /**
     * Random item pool filtered by day (new method)
     * @param count Number of items to return
     * @param day Day number for rarity filtering
     * @param seed Optional random seed
     */
    public randomPoolByDay(count: number, day: number, seed?: number): IItemTemplate[] {
        const rng = seed !== undefined ? new SeededRandom(seed) : this.random;
        const templates = this.getAvailableByDay(day);
        
        // Safe fallback: if no items for day, use all templates
        if (templates.length === 0) {
            console.warn(`[ItemDB] No items available for day ${day}, falling back to all items`);
            return this.randomPool(count, seed);
        }
        
        const result: IItemTemplate[] = [];

        for (let i = 0; i < count; i++) {
            const weights = templates.map(t => this.getWeight(t.rarity as ItemRarity));
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let randomValue = rng.next() * totalWeight;
            
            for (let j = 0; j < templates.length; j++) {
                randomValue -= weights[j];
                if (randomValue <= 0) {
                    result.push(templates[j]);
                    break;
                }
            }
        }

        return result;
    }

    /**
     * Get weight by rarity
     */
    private getWeight(rarity: ItemRarity): number {
        switch (rarity) {
            case ItemRarity.Common: return 50;
            case ItemRarity.Uncommon: return 30;
            case ItemRarity.Rare: return 15;
            case ItemRarity.Epic: return 4;
            case ItemRarity.Legendary: return 1;
            default: return 10;
        }
    }

    /**
     * Get random template
     */
    public randomTemplate(seed?: number): IItemTemplate | null {
        const pool = this.randomPool(1, seed);
        return pool[0] ?? null;
    }

    /**
     * Get item size in grid cells
     */
    public getItemGridSize(templateId: string): IGridSize | null {
        const template = this.getTemplate(templateId);
        return template?.gridSize ?? null;
    }

    /**
     * Validate item can be placed
     */
    public canPlaceItem(templateId: string): boolean {
        const template = this.getTemplate(templateId);
        return template !== undefined;
    }
}

// Singleton instance
let _instance: ItemDB | null = null;

/**
 * Get ItemDB singleton
 */
export function getItemDB(seed?: number): ItemDB {
    if (!_instance) {
        _instance = new ItemDB(seed);
    }
    return _instance;
}

/**
 * Reset ItemDB singleton (for testing)
 */
export function resetItemDB(): void {
    _instance = null;
}
