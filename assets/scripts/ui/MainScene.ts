/**
 * MainScene - Main Game Scene (Cocos Component)
 * Coordinates all game systems and UI
 */

import { _decorator, Component, Node } from 'cc';
import { GameLoop, GamePhase, getGameLoop } from '../core/GameLoop';
import { ShopManager } from '../core/ShopManager';
import { GridView } from './GridView';
import { BattlePanel, BattlePanelState } from './BattlePanel';
import { ScreenAdapter, Orientation } from './ScreenAdapter';
import { HUD } from './HUD';
import { IGridItem, IItemTemplate, IShopSlot } from '../core/types';

const { ccclass, property } = _decorator;

@ccclass('MainScene')
export class MainScene extends Component {
    // ============= Cocos Lifecycle =============

    /**
     * Called when the component is loaded
     */
    onLoad(): void {
        // Initialize game loop
        this.gameLoop = getGameLoop();
        
        // Initialize grid views
        this.playerGridView = new GridView(this.gameLoop.getPlayerGrid(), 50);
        this.enemyGridView = new GridView(this.gameLoop.getEnemyGrid(), 50);
    }

    /**
     * Called after onLoad, when the component is enabled
     */
    start(): void {
        // Start first day
        this.gameLoop.startDay();
        
        // Initialize views
        this.playerGridView.init();
        this.enemyGridView.init();
        
        // Initialize battle panel
        this.initBattlePanel();
        
        // Initialize screen adapter
        this.initScreenAdapter();
        
        // Initialize HUD with gameLoop reference
        if (this.hud) {
            this.hud.init(this.gameLoop);
        }
        
        this.isInitialized = true;
    }

    /**
     * Called every frame
     * @param deltaTime - Time in seconds since last frame
     */
    update(deltaTime: number): void {
        // Can be used for game loop updates if needed
    }

    /**
     * Called when the component is destroyed
     */
    onDestroy(): void {
        this.playerGridView.destroy();
        this.enemyGridView.destroy();
        if (this.battlePanel) {
            this.battlePanel.hide();
        }
        this.isInitialized = false;
    }

    // ============= Properties (Cocos) =============

    @property({ type: Node, tooltip: 'Player grid container node' })
    public playerGridNode: Node | null = null;

    @property({ type: Node, tooltip: 'Enemy grid container node' })
    public enemyGridNode: Node | null = null;

    @property({ type: Node, tooltip: 'UI layer node' })
    public uiLayerNode: Node | null = null;

    @property({ type: BattlePanel, tooltip: 'Battle panel component' })
    public battlePanel: BattlePanel | null = null;

    @property({ type: ScreenAdapter, tooltip: 'Screen adapter for resolution/safe-area' })
    public screenAdapter: ScreenAdapter | null = null;

    @property({ type: HUD, tooltip: 'HUD component for HP/Gold/Day display' })
    public hud: HUD | null = null;

    @property({ type: Node, tooltip: 'HUD top bar node (gold, day, mmr)' })
    public hudTopNode: Node | null = null;

    @property({ type: Node, tooltip: 'HUD bottom bar node (actions)' })
    public hudBottomNode: Node | null = null;

    @property({ type: Node, tooltip: 'Center content node (grids)' })
    public centerContentNode: Node | null = null;

    // ============= Private Fields =============

    private gameLoop!: GameLoop;
    private playerGridView!: GridView;
    private enemyGridView!: GridView;
    private isInitialized: boolean = false;

    /**
     * Get current game phase
     */
    public getPhase(): GamePhase {
        return this.gameLoop.getPhase();
    }

    /**
     * Get player grid view
     */
    public getPlayerGridView(): GridView {
        return this.playerGridView;
    }

    /**
     * Get enemy grid view
     */
    public getEnemyGridView(): GridView {
        return this.enemyGridView;
    }

    /**
     * Get shop manager
     */
    public getShopManager(): ShopManager {
        return this.gameLoop.getShopManager();
    }

    /**
     * Get day number
     */
    public getDay(): number {
        return this.gameLoop.getDay();
    }

    /**
     * Get player gold
     */
    public getPlayerGold(): number {
        return this.gameLoop.getPlayerGold();
    }

    /**
     * Get player MMR
     */
    public getPlayerMmr(): number {
        return this.gameLoop.getPlayerMmr();
    }

    /**
     * Get player wins
     */
    public getPlayerWins(): number {
        return this.gameLoop.getPlayerWins();
    }

    /**
     * Get player losses
     */
    public getPlayerLosses(): number {
        return this.gameLoop.getPlayerLosses();
    }

    // ============= Shop Phase =============

    /**
     * Get shop slots
     */
    public getShopSlots(): IShopSlot[] {
        return this.getShopManager().getSlots();
    }

    /**
     * Get shop item templates
     */
    public getShopItems(): IItemTemplate[] {
        return this.gameLoop.getShopItems();
    }

    /**
     * Get refresh cost
     */
    public getRefreshCost(): number {
        return this.getShopManager().getRefreshCost();
    }

    /**
     * Refresh shop (via GameLoop which handles gold)
     */
    public refreshShop(): boolean {
        const success = this.gameLoop.refreshShop();
        if (success) {
            // Update gold display
            this.updateGoldDisplay();
        }
        return success;
    }

    /**
     * Purchase from shop
     */
    public purchaseFromShop(slotIndex: number, gridPosition: { row: number; col: number }): boolean {
        const success = this.gameLoop.purchaseFromShop(slotIndex, gridPosition);
        if (success) {
            this.playerGridView.refresh();
            this.updateGoldDisplay();
        }
        return success;
    }

    /**
     * Toggle shop slot lock
     */
    public toggleShopLock(index: number): boolean {
        return this.getShopManager().toggleLock(index);
    }

    // ============= Prepare Phase =============

    /**
     * Move item in player grid
     */
    public moveItem(itemId: string, newRow: number, newCol: number): boolean {
        const success = this.gameLoop.moveItem(itemId, { row: newRow, col: newCol });
        if (success) {
            this.playerGridView.refresh();
        }
        return success;
    }

    /**
     * Remove item from player grid
     */
    public removeItem(itemId: string): boolean {
        const removed = this.gameLoop.removeItem(itemId);
        if (removed) {
            this.playerGridView.refresh();
        }
        return removed !== null;
    }

    // ============= Battle Phase =============

    /**
     * Start battle
     */
    public startBattle(): void {
        // Generate AI opponent
        this.gameLoop.generateAiOpponent();
        
        // Start battle
        this.gameLoop.startBattle();
        
        // Update enemy grid view
        this.enemyGridView.refresh();
    }

    /**
     * Run full battle
     */
    public runFullBattle() {
        const result = this.gameLoop.runFullBattle();
        
        // Update views
        this.playerGridView.refresh();
        this.enemyGridView.refresh();
        
        return result;
    }

    /**
     * Get battle result
     */
    public getBattleResult() {
        return this.gameLoop.getBattleResult();
    }

    // ============= Battle Panel Integration =============

    /**
     * Initialize battle panel
     */
    public initBattlePanel(): void {
        if (this.battlePanel) {
            this.battlePanel.init(this.gameLoop);
        }
    }

    /**
     * Initialize screen adapter for resolution and safe area handling
     */
    public initScreenAdapter(): void {
        if (this.screenAdapter) {
            this.screenAdapter.initialize();
            
            // Register UI elements for adaptive positioning
            if (this.hudTopNode) {
                this.screenAdapter.registerHudTop(this.hudTopNode);
            }
            if (this.hudBottomNode) {
                this.screenAdapter.registerHudBottom(this.hudBottomNode);
            }
            if (this.centerContentNode) {
                this.screenAdapter.registerCenterContent(this.centerContentNode);
            }
        }
    }

    /**
     * Get screen adapter instance
     */
    public getScreenAdapter(): ScreenAdapter | null {
        return this.screenAdapter;
    }

    /**
     * Update layout for new screen size
     */
    public updateLayout(): void {
        if (this.screenAdapter) {
            this.screenAdapter.updateLayout();
        }
    }

    /**
     * Get safe area info
     */
    public getSafeArea() {
        return this.screenAdapter?.getSafeArea() ?? null;
    }

    /**
     * Get visible screen size
     */
    public getVisibleSize(): { width: number, height: number } {
        return this.screenAdapter?.getVisibleSize() ?? { width: 720, height: 1280 };
    }

    /**
     * Show battle start UI
     */
    public showBattleStartUI(): void {
        if (this.battlePanel) {
            // Get current battle engine
            const playerItems = this.gameLoop.getPlayerItems();
            const enemyItems = this.gameLoop.getEnemyItems();
            
            // Create battle engine (same as in GameLoop.startBattle)
            const { BattleEngine } = require('../core/BattleEngine');
            const battleEngine = new BattleEngine({
                playerItems,
                enemyItems,
                playerGrid: this.gameLoop.getPlayerGrid(),
                enemyGrid: this.gameLoop.getEnemyGrid(),
                seed: this.gameLoop.getDay() + Date.now(),
                maxDuration: 60,
                playerHp: 100,
                enemyHp: 100
            });
            
            this.battlePanel.startBattle(battleEngine);
        }
    }

    /**
     * Advance battle (single step)
     */
    public advanceBattleStep(): boolean {
        if (this.battlePanel) {
            return this.battlePanel.advanceBattle();
        }
        return false;
    }

    /**
     * Run full battle with UI
     */
    public runBattleWithUI() {
        // Show battle start
        this.showBattleStartUI();
        
        // Run full battle
        const result = this.gameLoop.runFullBattle();
        
        // Update battle panel with result
        if (this.battlePanel) {
            this.battlePanel.runFullBattle();
        }
        
        // Update views
        this.playerGridView.refresh();
        this.enemyGridView.refresh();
        
        return result;
    }

    /**
     * Hide battle panel
     */
    public hideBattlePanel(): void {
        if (this.battlePanel) {
            this.battlePanel.hide();
        }
    }

    /**
     * Get battle panel state
     */
    public getBattlePanelState(): BattlePanelState | null {
        return this.battlePanel?.getState() ?? null;
    }

    /**
     * Is battle in progress
     */
    public isBattleInProgress(): boolean {
        return this.battlePanel?.isBattleInProgress() ?? false;
    }

    /**
     * Is battle finished
     */
    public isBattleFinished(): boolean {
        return this.battlePanel?.isBattleFinished() ?? false;
    }

    // ============= Result Phase =============

    /**
     * Complete day and advance
     */
    public completeDay(): void {
        this.gameLoop.completeDay();
        this.playerGridView.refresh();
    }

    // ============= UI Updates =============

    /**
     * Update gold display
     */
    private updateGoldDisplay(): void {
        // In real implementation, would update Cocos UI
    }

    /**
     * Update day display
     */
    public updateDayDisplay(): void {
        // In real implementation, would update Cocos UI
    }

    /**
     * Update MMR display
     */
    public updateMmrDisplay(): void {
        // In real implementation, would update Cocos UI
    }

    /**
     * Update wins/losses display
     */
    public updateRecordDisplay(): void {
        // In real implementation, would update Cocos UI
    }

    /**
     * Update all displays
     */
    public updateAllDisplays(): void {
        this.updateGoldDisplay();
        this.updateDayDisplay();
        this.updateMmrDisplay();
        this.updateRecordDisplay();
        
        // Force refresh HUD to update HP/Gold/Day
        this.hud?.forceRefresh();
    }

    // ============= Game State =============

    /**
     * Check if initialized
     */
    public isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Get player items
     */
    public getPlayerItems(): IGridItem[] {
        return this.gameLoop.getPlayerItems();
    }

    /**
     * Get enemy items
     */
    public getEnemyItems(): IGridItem[] {
        return this.gameLoop.getEnemyItems();
    }

    /**
     * Can place item at position
     */
    public canPlaceItem(templateId: string, row: number, col: number): boolean {
        return this.gameLoop.canPlaceItem(templateId, { row, col });
    }

    /**
     * Reset game
     */
    public reset(): void {
        this.gameLoop.reset();
        this.playerGridView.refresh();
        this.enemyGridView.refresh();
    }

    /**
     * Destroy scene
     */
    public destroy(): void {
        this.playerGridView.destroy();
        this.enemyGridView.destroy();
        this.isInitialized = false;
    }
}
