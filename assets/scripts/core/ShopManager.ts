/**
 * ShopManager - Shop System
 * Handles shop refresh, purchase, lock - gold managed by GameLoop
 */

import { IItemTemplate, IShopSlot, IShopState } from './types';
import { ItemDB, getItemDB } from './ItemDB';
import { SeededRandom } from '../utils/SeededRandom';

const SHOP_SLOT_COUNT = 5;
const BASE_REFRESH_COST = 2;
const REFRESH_COST_INCREASE = 2;

/**
 * Shop Manager - manages shop state (gold managed externally by GameLoop)
 */
export class ShopManager {
    private itemDB: ItemDB;
    private random: SeededRandom;
    private state: IShopState;
    private maxShopSlots: number = SHOP_SLOT_COUNT;
    private currentDay: number = 1; // Track current day for item rarity filtering

    constructor(seed: number) {
        this.itemDB = getItemDB(seed);
        this.random = new SeededRandom(seed);
        this.state = this.createInitialShopState();
    }

    /**
     * Set current day for item rarity filtering
     */
    public setDay(day: number): void {
        this.currentDay = Math.max(1, Math.floor(day));
    }

    /**
     * Create initial shop state
     */
    private createInitialShopState(): IShopState {
        return {
            slots: this.generateShopSlots(this.currentDay),
            refreshCost: BASE_REFRESH_COST,
            refreshCount: 0
        };
    }

    /**
     * Generate random shop slots
     */
    private generateShopSlots(day?: number): IShopSlot[] {
        const slots: IShopSlot[] = [];
        const effectiveDay = day ?? this.currentDay;
        // Use day-gated random pool when day is provided
        const items = day !== undefined 
            ? this.itemDB.randomPoolByDay(this.maxShopSlots, day, this.random.next() * 10000)
            : this.itemDB.randomPool(this.maxShopSlots, this.random.next() * 10000);

        for (let i = 0; i < this.maxShopSlots; i++) {
            const item = items[i];
            slots.push({
                index: i,
                templateId: item?.templateId ?? '',
                price: item?.cost ?? 10,
                purchased: false,
                locked: false
            });
        }

        return slots;
    }

    /**
     * Get current shop state
     */
    public getShopState(): IShopState {
        return this.state;
    }

    /**
     * Get all shop slots
     */
    public getSlots(): IShopSlot[] {
        return this.state.slots;
    }

    /**
     * Get slot by index
     */
    public getSlot(index: number): IShopSlot | null {
        return this.state.slots[index] ?? null;
    }

    /**
     * Get refresh cost
     */
    public getRefreshCost(): number {
        return this.state.refreshCost;
    }

    /**
     * Check if can purchase (does NOT deduct gold - caller handles gold)
     * Returns the slot info if purchasable, null otherwise
     */
    public canPurchase(index: number): { template: IItemTemplate; cost: number } | null {
        const slot = this.getSlot(index);
        if (!slot || slot.purchased) {
            return null;
        }
        
        const template = this.itemDB.getTemplate(slot.templateId);
        if (!template) {
            return null;
        }

        return {
            template,
            cost: slot.price
        };
    }

    /**
     * Mark slot as purchased (caller handles gold deduction)
     */
    public markPurchased(index: number): boolean {
        const slot = this.getSlot(index);
        if (!slot || slot.purchased) {
            return false;
        }
        
        slot.purchased = true;
        return true;
    }

    /**
     * Purchase result - returned to GameLoop for gold handling
     */
    public purchaseResult(index: number): { success: boolean; template: IItemTemplate | null; cost: number } {
        const slot = this.getSlot(index);
        if (!slot || slot.purchased) {
            return { success: false, template: null, cost: 0 };
        }
        
        const template = this.itemDB.getTemplate(slot.templateId);
        if (!template) {
            return { success: false, template: null, cost: 0 };
        }

        // Mark as purchased
        slot.purchased = true;

        return {
            success: true,
            template,
            cost: slot.price
        };
    }

    /**
     * Toggle lock on slot
     * Lock means "preserve this slot during refresh"
     */
    public toggleLock(index: number): boolean {
        const slot = this.getSlot(index);
        if (!slot || slot.purchased) {
            return false;
        }

        slot.locked = !slot.locked;
        return true;
    }

    /**
     * Refresh shop (does NOT deduct gold - caller handles gold)
     * @param day Optional day number for item rarity filtering
     * Returns { success: boolean, newCost: number }
     * Locked slots are preserved (not replaced)
     */
    public refreshResult(day?: number): { success: boolean; newCost: number } {
        // Generate new slots with day-based filtering
        const newSlots = this.generateShopSlots(day);
        
        // Preserve locked slots (they stay the same, not replaced)
        for (let i = 0; i < this.state.slots.length; i++) {
            const oldSlot = this.state.slots[i];
            if (oldSlot.locked && !oldSlot.purchased) {
                // Keep the locked slot unchanged
                newSlots[i] = { ...oldSlot };
            }
        }

        this.state.slots = newSlots;
        
        // Increase refresh cost
        this.state.refreshCost += REFRESH_COST_INCREASE;
        this.state.refreshCount++;

        return {
            success: true,
            newCost: this.state.refreshCost
        };
    }

    /**
     * Check if all slots purchased
     */
    public isAllPurchased(): boolean {
        return this.state.slots.every(slot => slot.purchased);
    }

    /**
     * Reset shop for new day
     */
    public reset(): void {
        this.state = this.createInitialShopState();
    }

    /**
     * Get available (not purchased) slots count
     */
    public getAvailableSlotsCount(): number {
        return this.state.slots.filter(slot => !slot.purchased).length;
    }

    /**
     * Get item templates for current shop (not purchased)
     */
    public getShopItems(): IItemTemplate[] {
        return this.state.slots
            .filter(slot => !slot.purchased)
            .map(slot => this.itemDB.getTemplate(slot.templateId))
            .filter((item): item is IItemTemplate => item !== undefined);
    }

    /**
     * Get refresh count
     */
    public getRefreshCount(): number {
        return this.state.refreshCount;
    }
}
