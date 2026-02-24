/**
 * ShopManager - Shop System
 * Handles shop refresh, purchase, lock, and coin deduction
 */

import { IItemTemplate, IShopSlot, IShopState } from './types';
import { ItemDB, getItemDB } from './ItemDB';
import { SeededRandom } from '../utils/SeededRandom';

const SHOP_SLOT_COUNT = 5;
const BASE_REFRESH_COST = 2;
const REFRESH_COST_INCREASE = 2;

/**
 * Shop Manager - manages shop state and transactions
 */
export class ShopManager {
    private itemDB: ItemDB;
    private random: SeededRandom;
    private state: IShopState;
    private playerGold: number = 100;
    private maxShopSlots: number = SHOP_SLOT_COUNT;

    constructor(seed: number) {
        this.itemDB = getItemDB(seed);
        this.random = new SeededRandom(seed);
        this.state = this.createInitialShopState();
    }

    /**
     * Create initial shop state
     */
    private createInitialShopState(): IShopState {
        return {
            slots: this.generateShopSlots(),
            refreshCost: BASE_REFRESH_COST,
            refreshCount: 0
        };
    }

    /**
     * Generate random shop slots
     */
    private generateShopSlots(): IShopSlot[] {
        const slots: IShopSlot[] = [];
        const items = this.itemDB.randomPool(this.maxShopSlots, this.random.next() * 10000);

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
     * Get player gold
     */
    public getPlayerGold(): number {
        return this.playerGold;
    }

    /**
     * Set player gold
     */
    public setPlayerGold(gold: number): void {
        this.playerGold = Math.max(0, gold);
    }

    /**
     * Deduct gold
     */
    public deductGold(amount: number): boolean {
        if (this.playerGold < amount) {
            return false;
        }
        this.playerGold -= amount;
        return true;
    }

    /**
     * Add gold
     */
    public addGold(amount: number): void {
        this.playerGold += amount;
    }

    /**
     * Purchase item from slot
     */
    public purchase(index: number): IItemTemplate | null {
        const slot = this.getSlot(index);
        if (!slot || slot.purchased || slot.locked) {
            return null;
        }

        if (!this.deductGold(slot.price)) {
            return null;
        }

        // Mark as purchased
        slot.purchased = true;

        // Return the template
        return this.itemDB.getTemplate(slot.templateId) ?? null;
    }

    /**
     * Lock/unlock slot
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
     * Refresh shop
     */
    public refresh(): boolean {
        // Check if can afford
        if (!this.deductGold(this.state.refreshCost)) {
            return false;
        }

        // Increase refresh cost
        this.state.refreshCost += REFRESH_COST_INCREASE;
        this.state.refreshCount++;

        // Generate new slots (keep locked ones)
        const newSlots = this.generateShopSlots();
        for (let i = 0; i < this.state.slots.length; i++) {
            if (this.state.slots[i].locked) {
                // Keep locked slot, just regenerate the item
                const item = this.itemDB.randomTemplate(this.random.next() * 10000);
                if (item) {
                    newSlots[i] = {
                        ...this.state.slots[i],
                        templateId: item.templateId,
                        price: item.cost ?? 10
                    };
                }
            }
        }

        this.state.slots = newSlots;
        return true;
    }

    /**
     * Get refresh cost
     */
    public getRefreshCost(): number {
        return this.state.refreshCost;
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
     * Get item templates for current shop
     */
    public getShopItems(): IItemTemplate[] {
        return this.state.slots
            .filter(slot => !slot.purchased)
            .map(slot => this.itemDB.getTemplate(slot.templateId))
            .filter((item): item is IItemTemplate => item !== undefined);
    }
}
