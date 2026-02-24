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

    constructor(seed: number = Date.now()) {
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
            id: id ?? `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
     * Random item pool with weighted probability
     */
    public randomPool(count: number, seed?: number): IItemTemplate[] {
        const rng = seed !== undefined ? new SeededRandom(seed) : this.random;
        const templates = this.getAllTemplates();
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
