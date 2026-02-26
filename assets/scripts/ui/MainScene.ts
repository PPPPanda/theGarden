/**
 * MainScene - Main Game Scene (Cocos Component)
 * Coordinates all game systems and UI
 */

import { _decorator, Component, Node, Vec3 } from 'cc';
import { GameLoop, GamePhase, getGameLoop } from '../core/GameLoop';
import { ShopManager } from '../core/ShopManager';
import { GridView } from './GridView';
import { BattlePanel, BattlePanelState } from './BattlePanel';
import { ScreenAdapter, Orientation } from './ScreenAdapter';
import { HUD } from './HUD';
import { GridPanelComp } from './GridPanelComp';
import { ShopPanel } from './ShopPanel';
import { SceneFlowStateMachine, SceneStage, SceneTransitionResult } from '../core/SceneFlowStateMachine';
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
        
        // Initialize stage machine (start at Loading)
        this.stageMachine = new SceneFlowStateMachine(SceneStage.Loading);
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
        
        // Initialize all panels with gameLoop (includes battlePanel)
        this.initAllPanels();
        
        // Initialize screen adapter
        this.initScreenAdapter();
        
        // Initialize HUD with gameLoop reference
        if (this.hud) {
            this.hud.init(this.gameLoop);
        }
        
        // Auto-advance from Loading to Shop on startup
        this.transitionToStage(SceneStage.Shop);
        
        this.isInitialized = true;
    }

    /**
     * Initialize all panels with proper dependencies and callbacks
     */
    private initAllPanels(): void {
        const itemDB = this.gameLoop.getItemDB();
        
        // Initialize ShopPanel
        if (this.shopPanel) {
            this.shopPanel.init(this.gameLoop);
            
            // Bind shop callbacks - buy/refresh/lock all trigger unified refresh
            this.shopPanel.setOnBuy((slotIndex: number) => {
                // For direct buy (without grid placement), place at first empty cell
                const grid = this.gameLoop.getPlayerGrid();
                let placed = false;
                for (let r = 0; r < grid.rows && !placed; r++) {
                    for (let c = 0; c < grid.cols && !placed; c++) {
                        if (!grid.getItemAt({ row: r, col: c })) {
                            const success = this.gameLoop.purchaseFromShop(slotIndex, { row: r, col: c });
                            if (success) {
                                placed = true;
                            }
                        }
                    }
                }
                if (placed) {
                    this.refreshAllViews();
                }
                return placed;
            });
            
            this.shopPanel.setOnRefresh(() => {
                const success = this.gameLoop.refreshShop();
                if (success) {
                    this.refreshAllViews();
                }
                return success;
            });
            
            this.shopPanel.setOnLock((slotIndex: number) => {
                const success = this.gameLoop.getShopManager().toggleLock(slotIndex);
                if (success) {
                    this.refreshAllViews();
                }
                return success;
            });
            
            // Wire drag start from shop to grid
            this.shopPanel.setOnDragStartFromShop((slotIndex, templateId, worldPos) => {
                if (this.gridPanel) {
                    this.gridPanel.startDragFromShop(templateId, slotIndex, new Vec3(worldPos.x, worldPos.y, 0));
                }
            });
        }
        
        // Initialize GridPanel
        if (this.gridPanel) {
            this.gridPanel.init(
                this.gameLoop.getPlayerGrid(),
                itemDB,
                this.gameLoop
            );
            
            // Bind grid to receive shop drops
            this.gridPanel.setOnShopItemDrop((templateId: string, slotIndex: number, position) => {
                const success = this.gameLoop.purchaseFromShop(slotIndex, position);
                if (success) {
                    this.refreshAllViews();
                }
                return success;
            });
        }
        
        // Initialize BattlePanel (moved from start())
        if (this.battlePanel) {
            this.battlePanel.init(this.gameLoop);
            // Wire continue button to transition to next day
            this.battlePanel.setOnContinue(() => {
                this.continueToNextDay();
            });
        }
    }

    /**
     * Refresh all views after any successful operation
     */
    private refreshAllViews(): void {
        this.shopPanel?.refreshShopUI();
        this.gridPanel?.refreshGrid();
        this.updateGoldDisplay();
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

    @property({ type: GridPanelComp, tooltip: 'Player grid panel component' })
    public gridPanel: GridPanelComp | null = null;

    @property({ type: ShopPanel, tooltip: 'Shop panel component' })
    public shopPanel: ShopPanel | null = null;

    // ============= Private Fields =============

    private gameLoop!: GameLoop;
    private playerGridView!: GridView;
    private enemyGridView!: GridView;
    private isInitialized: boolean = false;
    private stageMachine!: SceneFlowStateMachine;

    /**
     * Get current game phase
     */
    public getPhase(): GamePhase {
        return this.gameLoop.getPhase();
    }

    // ============= Stage Management =============

    /**
     * Get current scene stage
     */
    public getCurrentStage(): SceneStage {
        return this.stageMachine.getCurrentStage();
    }

    /**
     * Transition to target stage
     */
    public transitionToStage(targetStage: SceneStage, context: Record<string, unknown> = {}): SceneTransitionResult {
        const result = this.stageMachine.transitionTo(targetStage, context);
        
        if (result.ok) {
            this.applyStageVisibility(targetStage);
        }
        
        return result;
    }

    /**
     * Advance to next stage in cycle
     */
    public advanceToNextStage(context: Record<string, unknown> = {}): SceneTransitionResult {
        const result = this.stageMachine.advance(context);
        
        if (result.ok && result.transition) {
            this.applyStageVisibility(result.transition.to);
        }
        
        return result;
    }

    /**
     * Check if transition to target stage is valid
     */
    public canTransitionTo(targetStage: SceneStage): boolean {
        return this.stageMachine.canTransition(targetStage);
    }

    /**
     * Apply visibility for all panels based on stage
     */
    private applyStageVisibility(stage: SceneStage): void {
        // Hide all panels first
        this.setPanelVisible(this.shopPanel?.node ?? null, false);
        this.setPanelVisible(this.gridPanel?.node ?? null, false);
        this.setPanelVisible(this.battlePanel?.node ?? null, false);
        
        // Show ONLY the panel(s) for the current stage
        switch (stage) {
            case SceneStage.Loading:
                // Loading - hide all game UI
                break;
                
            case SceneStage.Shop:
                // Show shop only (grid is separate stage)
                this.setPanelVisible(this.shopPanel?.node ?? null, true);
                this.shopPanel?.refreshShopUI();
                break;
                
            case SceneStage.Grid:
                // Show grid only (player arranges items)
                this.setPanelVisible(this.gridPanel?.node ?? null, true);
                this.gridPanel?.refreshGrid();
                break;
                
            case SceneStage.Battle:
                // Show battle panel
                this.setPanelVisible(this.battlePanel?.node ?? null, true);
                break;
                
            case SceneStage.Result:
                // Show result (battle panel shows this)
                this.setPanelVisible(this.battlePanel?.node ?? null, true);
                break;
        }
        
        // Always show HUD
        this.setPanelVisible(this.hud?.node ?? null, true);
        this.updateAllDisplays();
    }

    /**
     * Set panel visibility helper
     */
    private setPanelVisible(node: Node | null, visible: boolean): void {
        if (node) {
            node.active = visible;
        }
    }

    /**
     * Check if waiting for user input at current stage
     */
    public isWaitingForUser(): boolean {
        return this.stageMachine.isWaitingForUser();
    }

    // ============= Player Grid View =============

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
     * Run full battle (legacy method)
     */
    /**
     * Run full battle (legacy - prefer startBattle/finishBattle)
     */
    public runFullBattle() {
        // Use proper state machine flow
        if (!this.startBattle()) {
            return null;
        }
        
        const result = this.gameLoop.runFullBattle();
        
        // Update battle panel UI
        if (this.battlePanel) {
            this.battlePanel.runFullBattle();
        }
        
        // Transition to Result stage
        this.finishBattle();
        
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
    /**
     * Show battle start UI - uses GameLoop's battle engine as single source
     */
    public showBattleStartUI(): void {
        if (this.battlePanel) {
            // Get battle engine from GameLoop (single source of truth)
            const battleEngine = this.gameLoop.getCurrentBattleEngine();
            if (battleEngine) {
                this.battlePanel.startBattle(battleEngine);
            }
        }
    }

    /**
     * Advance battle (single step) - checks if battle ended and transitions to Result
     */
    public advanceBattleStep(): boolean {
        if (this.battlePanel) {
            const continued = this.battlePanel.advanceBattle();
            
            // Check if battle finished after this step
            if (!continued && this.battlePanel.isBattleFinished()) {
                this.finishBattle();
            }
            
            return continued;
        }
        return false;
    }

    /**
     * Run full battle with UI
     */
    /**
     * Run full battle with UI (legacy method - prefer startBattle/finishBattle)
     */
    public runBattleWithUI() {
        // Use proper state machine flow
        if (!this.startBattle()) {
            return null;
        }
        
        // Run full battle
        const result = this.gameLoop.runFullBattle();
        
        // Update battle panel with result
        if (this.battlePanel) {
            this.battlePanel.runFullBattle();
        }
        
        // Transition to Result
        this.finishBattle();
        
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

    // ============= Stage-Driven Flow =============

    /**
     * Enter Grid stage from Shop (user ready to arrange items)
     */
    public enterGrid(): boolean {
        if (!this.canTransitionTo(SceneStage.Grid)) {
            console.warn('Cannot transition to Grid from current stage');
            return false;
        }
        
        const result = this.transitionToStage(SceneStage.Grid);
        return result.ok;
    }

    /**
     * Start battle from Grid (user ready to fight)
     */
    public startBattle(): boolean {
        if (!this.canTransitionTo(SceneStage.Battle)) {
            console.warn('Cannot transition to Battle from current stage');
            return false;
        }
        
        // Generate AI opponent
        this.gameLoop.generateAiOpponent();
        
        // Start battle in GameLoop
        this.gameLoop.startBattle();
        
        // Update enemy grid view
        this.enemyGridView.refresh();
        
        // Transition to Battle stage
        const result = this.transitionToStage(SceneStage.Battle);
        
        // Show battle UI
        if (result.ok) {
            this.showBattleStartUI();
        }
        
        return result.ok;
    }

    /**
     * Finish battle and show results (called when battle ends)
     */
    public finishBattle(): boolean {
        // Battle auto-transitions to Result when finished
        // This method explicitly triggers the Result stage
        
        const current = this.getCurrentStage();
        if (current !== SceneStage.Battle) {
            console.warn('Cannot finish battle - not in Battle stage');
            return false;
        }
        
        const result = this.transitionToStage(SceneStage.Result);
        
        // Update views after battle
        this.playerGridView.refresh();
        this.enemyGridView.refresh();
        
        return result.ok;
    }

    /**
     * Continue to next day - Result -> Shop
     */
    public continueToNextDay(): boolean {
        if (!this.canTransitionTo(SceneStage.Shop)) {
            console.warn('Cannot transition to Shop from current stage');
            return false;
        }
        
        // Complete current day and start next
        this.gameLoop.completeDay();
        
        // Transition to Shop for next day
        const result = this.transitionToStage(SceneStage.Shop);
        
        // Refresh views
        this.playerGridView.refresh();
        this.enemyGridView.refresh();
        
        return result.ok;
    }

    // ============= Legacy Compatibility =============

    /**
     * Complete day and advance (legacy method)
     */
    public completeDay(): void {
        this.continueToNextDay();
    }

    // ============= UI Updates =============

    /**
     * Update gold display
     */
    private updateGoldDisplay(): void {
        if (this.hud) {
            this.hud.forceRefresh();
        }
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
