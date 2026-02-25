/**
 * GameLoop - Day Cycle Controller
 * Manages: Shop phase → Inventory → Match AI → Auto battle → Settlement
 */

import { IGridItem, IGridPosition, IBattleState, IItemTemplate, IPlayerState } from './types';
import { GridManager } from './GridManager';
import { BattleEngine } from './BattleEngine';
import { ItemDB, getItemDB } from './ItemDB';
import { ShopManager } from './ShopManager';
import { SeededRandom } from '../utils/SeededRandom';

/**
 * Game Phase
 */
export enum GamePhase {
    Shop = 'shop',
    Prepare = 'prepare',
    Battle = 'battle',
    Result = 'result',
    GameOver = 'gameover'
}

/**
 * Battle Result
 */
export interface BattleResult {
    win: boolean;
    draw: boolean;
    playerDamage: number;
    enemyDamage: number;
    rewards: {
        gold: number;
        mmr: number;
    };
}

/**
 * Game Loop - main game controller
 */
export class GameLoop {
    private playerGrid: GridManager;
    private enemyGrid: GridManager;
    private itemDB: ItemDB;
    private shopManager: ShopManager;
    private random: SeededRandom;
    
    // Game state
    private day: number = 1;
    private playerGold: number = 100;
    private playerMmr: number = 1000;
    private playerWins: number = 0;
    private playerLosses: number = 0;
    private phase: GamePhase = GamePhase.Shop;
    private seed: number;
    
    // Battle state
    private currentBattle: BattleEngine | null = null;
    private battleResult: BattleResult | null = null;
    private lastBattleState: IBattleState | null = null;

    // Settings
    private gridSize: number = 10;
    private maxDuration: number = 60;

    constructor(seed?: number) {
        this.seed = seed ?? 42;
        this.random = new SeededRandom(this.seed);
        this.playerGrid = new GridManager(this.gridSize, this.gridSize);
        this.enemyGrid = new GridManager(this.gridSize, this.gridSize);
        this.itemDB = getItemDB(this.seed);
        this.shopManager = new ShopManager(this.seed + this.day);
    }

    /**
     * Start new day
     */
    public startDay(): void {
        this.phase = GamePhase.Shop;
        this.shopManager.reset();
    }

    /**
     * Get current phase
     */
    public getPhase(): GamePhase {
        return this.phase;
    }

    /**
     * Set game phase
     */
    public setPhase(phase: GamePhase): void {
        this.phase = phase;
    }

    /**
     * Get shop manager
     */
    public getShopManager(): ShopManager {
        return this.shopManager;
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
     * Get day number
     */
    public getDay(): number {
        return this.day;
    }

    /**
     * Get player MMR
     */
    public getPlayerMmr(): number {
        return this.playerMmr;
    }

    /**
     * Get player wins
     */
    public getPlayerWins(): number {
        return this.playerWins;
    }

    /**
     * Get player losses
     */
    public getPlayerLosses(): number {
        return this.playerLosses;
    }

    /**
     * Place item from shop
     */
    public purchaseAndPlace(templateId: string, position: IGridPosition): boolean {
        const item = this.itemDB.createItem(templateId, position);
        if (!item) {
            return false;
        }

        return this.playerGrid.placeItem(item);
    }

    /**
     * Generate AI opponent
     */
    public generateAiOpponent(): void {
        // Clear enemy grid
        this.enemyGrid.clear();

        // Calculate AI strength based on day and MMR
        const aiStrength = Math.min(10, Math.floor(this.day / 2) + 3);
        const items = this.itemDB.randomPool(aiStrength, this.seed + this.day * 1000);

        // Place items on enemy grid (simple random placement)
        let placed = 0;
        for (const template of items) {
            // Try random positions
            for (let attempt = 0; attempt < 50; attempt++) {
                const row = this.random.nextInt(0, this.gridSize - template.gridSize.rows);
                const col = this.random.nextInt(0, this.gridSize - template.gridSize.cols);
                
                const item = this.itemDB.createItem(
                    template.templateId,
                    { row, col },
                    `enemy_d${this.day}_${placed}`
                );
                
                if (item && this.enemyGrid.placeItem(item)) {
                    placed++;
                    break;
                }
            }
        }
    }

    /**
     * Start battle
     */
    public startBattle(): void {
        this.phase = GamePhase.Battle;
        
        const playerItems = this.playerGrid.getAllItems();
        const enemyItems = this.enemyGrid.getAllItems();

        this.currentBattle = new BattleEngine({
            playerItems,
            enemyItems,
            playerGrid: this.playerGrid,
            enemyGrid: this.enemyGrid,
            seed: this.seed + this.day,
            maxDuration: this.maxDuration,
            playerHp: 100,
            enemyHp: 100
        });
    }

    /**
     * Run full battle
     */
    public runFullBattle(): IBattleState {
        if (!this.currentBattle) {
            this.startBattle();
        }

        const result = this.currentBattle!.runFullBattle();
        this.lastBattleState = result;
        
        // Process result
        this.processBattleResult(result);
        
        this.phase = GamePhase.Result;
        
        return result;
    }

    /**
     * Process battle result
     */
    private processBattleResult(battleState: IBattleState): void {
        const playerWon = battleState.result === 'win';
        const draw = battleState.result === 'draw';
        
        // Calculate rewards
        const baseGold = 20;
        const winBonus = playerWon ? 30 : 0;
        const dayBonus = this.day * 5;
        
        const goldReward = baseGold + winBonus + dayBonus;
        const mmrChange = playerWon ? 15 : (draw ? 0 : -15);

        this.battleResult = {
            win: playerWon,
            draw,
            playerDamage: 100 - battleState.player.hero.currentHealth,
            enemyDamage: 100 - battleState.opponent.hero.currentHealth,
            rewards: {
                gold: goldReward,
                mmr: mmrChange
            }
        };

        // Update stats
        this.playerGold += goldReward;
        this.playerMmr = Math.max(0, this.playerMmr + mmrChange);
        
        if (playerWon) {
            this.playerWins++;
        } else if (!draw) {
            this.playerLosses++;
        }
    }

    /**
     * Get battle result
     */
    public getBattleResult(): BattleResult | null {
        return this.battleResult;
    }

    /**
     * Get last battle state
     */
    public getLastBattleState(): IBattleState | null {
        return this.lastBattleState;
    }

    /**
     * Complete day and advance
     */
    public completeDay(): void {
        this.day++;
        this.battleResult = null;
        this.currentBattle = null;
        this.lastBattleState = null;
        this.startDay();
    }

    /**
     * Get player items
     */
    public getPlayerItems(): IGridItem[] {
        return this.playerGrid.getAllItems();
    }

    /**
     * Get enemy items
     */
    public getEnemyItems(): IGridItem[] {
        return this.enemyGrid.getAllItems();
    }

    /**
     * Get available items from shop
     */
    public getShopItems(): IItemTemplate[] {
        return this.shopManager.getShopItems();
    }

    /**
     * Purchase from shop and place (handles gold deduction)
     * Order: check → gold → place → mark purchased
     */
    public purchaseFromShop(slotIndex: number, position: IGridPosition): boolean {
        // 1. Check if purchasable (no side effects)
        const check = this.shopManager.canPurchase(slotIndex);
        if (!check) {
            return false;
        }

        // 2. Check gold
        if (this.playerGold < check.cost) {
            return false;
        }

        // 3. Try to place item first
        const placed = this.purchaseAndPlace(check.template.templateId, position);
        if (!placed) {
            return false;
        }

        // 4. Only mark purchased after successful placement
        this.shopManager.markPurchased(slotIndex);
        
        // 5. Deduct gold last
        this.playerGold -= check.cost;

        return true;
    }

    /**
     * Refresh shop (handles gold deduction)
     */
    public refreshShop(): boolean {
        const cost = this.shopManager.getRefreshCost();
        
        // Check if player has enough gold
        if (this.playerGold < cost) {
            return false;
        }

        // Deduct gold
        this.playerGold -= cost;

        // Refresh shop
        const result = this.shopManager.refreshResult();
        return result.success;
    }

    /**
     * Remove item from player grid
     */
    public removeItem(itemId: string): IGridItem | null {
        return this.playerGrid.removeItem(itemId);
    }

    /**
     * Move item
     */
    public moveItem(itemId: string, newPos: IGridPosition): boolean {
        return this.playerGrid.moveItem(itemId, newPos);
    }

    /**
     * Can place item
     */
    public canPlaceItem(templateId: string, position: IGridPosition): boolean {
        const gridSize = this.itemDB.getItemGridSize(templateId);
        if (!gridSize) return false;
        return this.playerGrid.canPlace(gridSize, position);
    }

    /**
     * Get full player state
     */
    public getPlayerState(): IPlayerState {
        return {
            playerId: 'player',
            nickname: 'Player',
            hero: {
                maxHealth: 100,
                currentHealth: this.lastBattleState?.player.hero.currentHealth ?? 100,
                baseAttack: 10,
                baseDefense: 5
            },
            grid: {
                rows: this.playerGrid.rows,
                cols: this.playerGrid.cols,
                cells: this.playerGrid.gridCells
            },
            items: this.playerGrid.getAllItems(),
            gold: this.playerGold,
            day: this.day,
            wins: this.playerWins,
            losses: this.playerLosses,
            mmr: this.playerMmr,
            shopRefreshes: this.shopManager.getShopState().refreshCount
        };
    }

    /**
     * Reset game
     */
    public reset(): void {
        this.day = 1;
        this.playerGold = 100;
        this.playerMmr = 1000;
        this.playerWins = 0;
        this.playerLosses = 0;
        this.phase = GamePhase.Shop;
        this.playerGrid.clear();
        this.enemyGrid.clear();
        this.battleResult = null;
        this.currentBattle = null;
        this.lastBattleState = null;
        this.shopManager.reset();
    }
}

// Singleton
let _gameLoop: GameLoop | null = null;

/**
 * Get GameLoop singleton
 */
export function getGameLoop(seed?: number): GameLoop {
    if (!_gameLoop) {
        _gameLoop = new GameLoop(seed);
    }
    return _gameLoop;
}

/**
 * Reset GameLoop (for testing)
 */
export function resetGameLoop(): void {
    _gameLoop = null;
}
