/**
 * GameManager - Game Controller
 * Coordinates GridManager, BattleEngine, and UI
 * Delegates to pure logic modules
 */

import { IGridItem, IGridPosition, IGridSize, ItemRarity, ItemSize, IBattleState, IItemTemplate } from './types';
import { GridManager } from './GridManager';
import { BattleEngine } from './BattleEngine';
import { ItemDB, getItemDB } from './ItemDB';
import { SeededRandom } from '../utils/SeededRandom';

/**
 * Game Manager - orchestrates the game
 */
export class GameManager {
    private playerGrid: GridManager;
    private enemyGrid: GridManager;
    private itemDB: ItemDB;
    private battleEngine: BattleEngine | null = null;
    private random: SeededRandom;
    private playerHp: number = 100;
    private enemyHp: number = 100;
    private seed: number;
    private isInBattle: boolean = false;
    private maxDuration: number = 60;

    constructor(seed?: number) {
        this.seed = seed ?? 42;
        this.random = new SeededRandom(this.seed);
        this.playerGrid = new GridManager(10, 10);
        this.enemyGrid = new GridManager(10, 10);
        this.itemDB = getItemDB(this.seed);
    }

    /**
     * Get player grid
     */
    public getPlayerGrid(): GridManager {
        return this.playerGrid;
    }

    /**
     * Get enemy grid
     */
    public getEnemyGrid(): GridManager {
        return this.enemyGrid;
    }

    /**
     * Get item DB
     */
    public getItemDB(): ItemDB {
        return this.itemDB;
    }

    /**
     * Place item on player grid
     */
    public placeItem(templateId: string, position: IGridPosition): IGridItem | null {
        const item = this.itemDB.createItem(templateId, position);
        if (!item) {
            return null;
        }

        const success = this.playerGrid.placeItem(item);
        if (!success) {
            return null;
        }

        return item;
    }

    /**
     * Remove item from player grid
     */
    public removeItem(itemId: string): IGridItem | null {
        return this.playerGrid.removeItem(itemId);
    }

    /**
     * Get all player items
     */
    public getPlayerItems(): IGridItem[] {
        return this.playerGrid.getAllItems();
    }

    /**
     * Check if position is valid for item
     */
    public canPlaceItem(templateId: string, position: IGridPosition): boolean {
        const gridSize = this.itemDB.getItemGridSize(templateId);
        if (!gridSize) {
            return false;
        }
        return this.playerGrid.canPlace(gridSize, position);
    }

    /**
     * Move item to new position
     */
    public moveItem(itemId: string, newPosition: IGridPosition): boolean {
        return this.playerGrid.moveItem(itemId, newPosition);
    }

    /**
     * Get adjacent items
     */
    public getAdjacentItems(itemId: string): string[] {
        return this.playerGrid.getAdjacentItems(itemId);
    }

    /**
     * Start a battle
     */
    public startBattle(): void {
        const playerItems = this.playerGrid.getAllItems();
        const enemyItems = this.enemyGrid.getAllItems();

        this.battleEngine = new BattleEngine({
            playerItems,
            enemyItems,
            playerGrid: this.playerGrid,
            enemyGrid: this.enemyGrid,
            seed: this.seed,
            maxDuration: this.maxDuration,
            playerHp: this.playerHp,
            enemyHp: this.enemyHp
        });

        this.isInBattle = true;
    }

    /**
     * Run full battle and get result
     */
    public runFullBattle(): IBattleState {
        if (!this.battleEngine) {
            this.startBattle();
        }

        const result = this.battleEngine!.runFullBattle();
        
        // Update HP
        this.playerHp = result.player.hero.currentHealth;
        this.enemyHp = result.opponent.hero.currentHealth;
        this.isInBattle = false;

        return result;
    }

    /**
     * Advance battle by one event
     */
    public advanceBattle(): import('./types').ITimelineEvent | null {
        if (!this.battleEngine) {
            this.startBattle();
        }
        return this.battleEngine!.advanceToNext();
    }

    /**
     * Get current battle state
     */
    public getBattleState(): IBattleState | null {
        return this.battleEngine?.getBattleState() ?? null;
    }

    /**
     * Get player HP
     */
    public getPlayerHp(): number {
        return this.playerHp;
    }

    /**
     * Get enemy HP
     */
    public getEnemyHp(): number {
        return this.enemyHp;
    }

    /**
     * Set player HP
     */
    public setPlayerHp(hp: number): void {
        this.playerHp = Math.max(0, Math.min(100, hp));
    }

    /**
     * Set enemy HP
     */
    public setEnemyHp(hp: number): void {
        this.enemyHp = Math.max(0, Math.min(100, hp));
    }

    /**
     * Check if in battle
     */
    public getIsInBattle(): boolean {
        return this.isInBattle;
    }

    /**
     * Get current seed
     */
    public getSeed(): number {
        return this.seed;
    }

    /**
     * Reset game
     */
    public reset(): void {
        this.playerGrid.clear();
        this.enemyGrid.clear();
        this.battleEngine = null;
        this.playerHp = 100;
        this.enemyHp = 100;
        this.isInBattle = false;
        this.seed = 42;
        this.random = new SeededRandom(this.seed);
    }

    /**
     * Get all available item templates
     */
    public getAvailableItems(): IItemTemplate[] {
        return this.itemDB.getAllTemplates();
    }

    /**
     * Get random items for shop
     */
    public getShopItems(count: number): IItemTemplate[] {
        return this.itemDB.randomPool(count);
    }
}

// Singleton
let _gameManager: GameManager | null = null;

/**
 * Get GameManager singleton
 */
export function getGameManager(seed?: number): GameManager {
    if (!_gameManager) {
        _gameManager = new GameManager(seed);
    }
    return _gameManager;
}

/**
 * Reset GameManager (for testing)
 */
export function resetGameManager(): void {
    _gameManager = null;
}
