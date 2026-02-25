/**
 * MainScene - Main Game Scene (Cocos Component)
 * Coordinates all game systems and UI using SceneFlowStateMachine
 */

import { _decorator, Component, Node } from 'cc';
import { GameLoop, GamePhase, getGameLoop, BattleResult } from '../core/GameLoop';
import { ShopManager } from '../core/ShopManager';
import { GridView } from './GridView';
import { BattlePanel, BattlePanelState } from './BattlePanel';
import { ShopPanel } from './ShopPanel';
import { GridPanelComp } from './GridPanelComp';
import { SceneFlowStateMachine, SceneStage, SceneStageContext } from '../core/SceneFlowStateMachine';
import { IGridItem, IItemTemplate, IShopSlot, IBattleState } from '../core/types';

const { ccclass, property } = _decorator;

@ccclass('MainScene')
export class MainScene extends Component {
    // ============= Cocos Lifecycle =============

    /**
     * Called when the component is loaded
     */
    onLoad(): void {
        // Initialize state machine
        this.stateMachine = new SceneFlowStateMachine(SceneStage.Loading);
        
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
        // Initialize views
        this.playerGridView.init();
        this.enemyGridView.init();
        
        // Initialize all panels
        this.initShopPanel();
        this.initGridPanel();
        this.initBattlePanel();
        
        // Start loading -> shop transition
        this.finishLoading();
        
        this.isInitialized = true;
    }

    /**
     * Called every frame
     * @param deltaTime - Time in seconds since last frame
     */
    update(deltaTime: number): void {
        // Handle auto-advance from Loading
        if (this.stateMachine.getCurrentStage() === SceneStage.Loading) {
            const autoStage = this.stateMachine.getAutoAdvanceStage();
            if (autoStage) {
                this.transitionTo(autoStage, { reason: 'auto_advance' });
            }
        }
    }

    /**
     * Called when the component is destroyed
     */
    onDestroy(): void {
        this.playerGridView.destroy();
        this.enemyGridView.destroy();
        this.hideAllPanels();
        this.isInitialized = false;
    }

    // ============= Properties (Cocos) =============

    @property({ type: Node, tooltip: 'Player grid container node' })
    public playerGridNode: Node | null = null;

    @property({ type: Node, tooltip: 'Enemy grid container node' })
    public enemyGridNode: Node | null = null;

    @property({ type: Node, tooltip: 'UI layer node' })
    public uiLayerNode: Node | null = null;

    @property({ type: Node, tooltip: 'Shop panel node' })
    public shopPanelNode: Node | null = null;

    @property({ type: Node, tooltip: 'Grid panel node' })
    public gridPanelNode: Node | null = null;

    @property({ type: Node, tooltip: 'Battle panel node' })
    public battlePanelNode: Node | null = null;

    @property({ type: BattlePanel, tooltip: 'Battle panel component' })
    public battlePanel: BattlePanel | null = null;

    // ============= State Machine =============

    private stateMachine!: SceneFlowStateMachine;

    /**
     * Get current scene stage
     */
    public getCurrentStage(): SceneStage {
        return this.stateMachine.getCurrentStage();
    }

    /**
     * Get state machine instance
     */
    public getStateMachine(): SceneFlowStateMachine {
        return this.stateMachine;
    }

    /**
     * Transition to a new stage with panel management
     */
    public transitionTo(stage: SceneStage, context: SceneStageContext = {}): boolean {
        const result = this.stateMachine.transitionTo(stage, context);
        
        if (!result.ok) {
            console.warn(`[MainScene] Transition failed: ${result.error}`);
            return false;
        }

        console.log(`[MainScene] Stage: ${result.transition!.from} -> ${result.transition!.to}`);
        
        // Handle stage entry
        this.onEnterStage(result.transition!.to, context);
        
        return true;
    }

    /**
     * Advance to next stage in the cycle
     */
    public advanceStage(context: SceneStageContext = {}): boolean {
        const result = this.stateMachine.advance(context);
        
        if (!result.ok) {
            console.warn(`[MainScene] Advance failed: ${result.error}`);
            return false;
        }

        console.log(`[MainScene] Advanced: ${result.transition!.from} -> ${result.transition!.to}`);
        
        this.onEnterStage(result.transition!.to, context);
        
        return true;
    }

    /**
     * Handle stage entry - show/hide panels
     */
    private onEnterStage(stage: SceneStage, context: SceneStageContext): void {
        this.hideAllPanels();
        
        switch (stage) {
            case SceneStage.Loading:
                // Loading handled externally
                break;
                
            case SceneStage.Shop:
                this.showShopPanel();
                break;
                
            case SceneStage.Grid:
                this.showGridPanel();
                break;
                
            case SceneStage.Battle:
                this.showBattlePanel();
                break;
                
            case SceneStage.Result:
                this.showResultPanel();
                break;
        }
    }

    /**
     * Handle stage exit - cleanup
     */
    private onExitStage(stage: SceneStage): void {
        switch (stage) {
            case SceneStage.Battle:
                // Cleanup battle resources
                if (this.battlePanel) {
                    this.battlePanel.hide();
                }
                break;
            case SceneStage.Shop:
                // Refresh shop for next time
                break;
        }
    }

    /**
     * Fallback to safe stage on error
     */
    public fallbackToSafeStage(reason: string): boolean {
        const currentStage = this.stateMachine.getCurrentStage();
        const fallbackStage = this.stateMachine.getFallbackStage(currentStage);
        
        console.log(`[MainScene] Fallback: ${currentStage} -> ${fallbackStage} (${reason})`);
        
        // Force transition to fallback
        const transition = this.stateMachine.forceStage(fallbackStage, { reason });
        
        this.onEnterStage(fallbackStage, { reason, interruptedFrom: currentStage });
        
        return true;
    }

    // ============= Private Fields =============

    private gameLoop!: GameLoop;
    private playerGridView!: GridView;
    private enemyGridView!: GridView;
    private shopPanel: ShopPanel | null = null;
    private gridPanel: GridPanelComp | null = null;
    private isInitialized: boolean = false;

    // ============= Initialization =============

    /**
     * Initialize shop panel
     */
    private initShopPanel(): void {
        if (this.shopPanelNode) {
            this.shopPanel = this.shopPanelNode.getComponent(ShopPanel) ?? this.shopPanelNode.addComponent(ShopPanel);
            if (this.shopPanel) {
                this.shopPanel.init(this.gameLoop.getShopManager(), this.gameLoop);
            }
        }
    }

    /**
     * Initialize grid panel
     */
    private initGridPanel(): void {
        if (this.gridPanelNode) {
            this.gridPanel = this.gridPanelNode.getComponent(GridPanelComp) ?? this.gridPanelNode.addComponent(GridPanelComp);
            if (this.gridPanel) {
                this.gridPanel.init(
                    this.gameLoop.getPlayerGrid(),
                    this.gameLoop.getItemDB(),
                    this.gameLoop
                );
            }
        }
    }

    /**
     * Initialize battle panel
     */
    private initBattlePanel(): void {
        if (this.battlePanel) {
            this.battlePanel.init(this.gameLoop);
        }
    }

    /**
     * Hide all panels
     */
    private hideAllPanels(): void {
        if (this.shopPanelNode) {
            this.shopPanelNode.active = false;
        }
        if (this.gridPanelNode) {
            this.gridPanelNode.active = false;
        }
        if (this.battlePanel) {
            this.battlePanel.hide();
        }
    }

    /**
     * Show shop panel
     */
    private showShopPanel(): void {
        if (this.shopPanelNode) {
            this.shopPanelNode.active = true;
        }
        if (this.shopPanel) {
            this.shopPanel.refreshDisplay();
        }
    }

    /**
     * Show grid panel
     */
    private showGridPanel(): void {
        if (this.gridPanelNode) {
            this.gridPanelNode.active = true;
        }
        if (this.gridPanel) {
            this.gridPanel.refreshGrid();
        }
        // Refresh grid views too
        this.playerGridView.refresh();
    }

    /**
     * Show battle panel
     */
    private showBattlePanel(): void {
        if (this.battlePanel) {
            // Prepare battle
            this.gameLoop.generateAiOpponent();
            this.gameLoop.startBattle();
            
            // Get battle engine
            const battleEngine = this.gameLoop.getCurrentBattleEngine();
            if (battleEngine) {
                this.battlePanel.startBattle(battleEngine);
            }
            
            // Update enemy grid
            this.enemyGridView.refresh();
        }
    }

    /**
     * Show result panel (uses battle panel in result mode)
     */
    private showResultPanel(): void {
        if (this.battlePanel) {
            const lastState = this.gameLoop.getLastBattleState();
            const battleResult = this.gameLoop.getBattleResult();
            
            if (lastState && battleResult) {
                this.battlePanel.showResolvedResult(lastState, battleResult);
            }
        }
    }

    // ============= Loading Phase =============

    /**
     * Finish loading and transition to Shop
     */
    public finishLoading(): void {
        this.transitionTo(SceneStage.Shop, { reason: 'loading_complete' });
    }

    // ============= Shop Phase =============

    /**
     * Proceed from Shop to Grid phase
     */
    public confirmShop(): void {
        this.advanceStage({ reason: 'shop_confirmed' });
    }

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
        if (success && this.shopPanel) {
            this.shopPanel.refreshDisplay();
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
            if (this.gridPanel) {
                this.gridPanel.refreshGrid();
            }
            if (this.shopPanel) {
                this.shopPanel.refreshDisplay();
            }
        }
        return success;
    }

    /**
     * Toggle shop slot lock
     */
    public toggleShopLock(index: number): boolean {
        return this.getShopManager().toggleLock(index);
    }

    // ============= Grid Phase =============

    /**
     * Proceed from Grid to Battle phase
     */
    public confirmGrid(): void {
        this.advanceStage({ reason: 'grid_confirmed' });
    }

    /**
     * Go back to Shop from Grid
     */
    public backToShop(): boolean {
        return this.transitionTo(SceneStage.Shop, { reason: 'return_to_shop' });
    }

    /**
     * Move item in player grid
     */
    public moveItem(itemId: string, newRow: number, newCol: number): boolean {
        const success = this.gameLoop.moveItem(itemId, { row: newRow, col: newCol });
        if (success) {
            this.playerGridView.refresh();
            if (this.gridPanel) {
                this.gridPanel.refreshGrid();
            }
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
            if (this.gridPanel) {
                this.gridPanel.refreshGrid();
            }
        }
        return removed !== null;
    }

    // ============= Battle Phase =============

    /**
     * Run full battle and transition to Result
     */
    public runBattle(): void {
        const result = this.gameLoop.runFullBattle();
        
        // Update views
        this.playerGridView.refresh();
        this.enemyGridView.refresh();
        
        // Transition to Result
        this.transitionTo(SceneStage.Result, { 
            reason: 'battle_complete',
            battleResult: result
        });
    }

    /**
     * Run battle with UI (step-by-step)
     */
    public runBattleStep(): boolean {
        if (!this.battlePanel) {
            return false;
        }
        
        const continues = this.battlePanel.advanceBattle();
        
        if (!continues) {
            // Battle finished, transition to result
            this.transitionTo(SceneStage.Result, { reason: 'battle_finished' });
            return false;
        }
        
        return true;
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
     * Proceed from Result to next Shop (new day)
     */
    public nextDay(): void {
        // Complete the day in game loop
        this.gameLoop.completeDay();
        
        // Transition to Shop for new day
        this.transitionTo(SceneStage.Shop, { 
            reason: 'new_day',
            day: this.gameLoop.getDay()
        });
    }

    /**
     * Get battle result
     */
    public getBattleResult(): BattleResult | null {
        return this.gameLoop.getBattleResult();
    }

    // ============= Game State Access =============

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
     * Check if initialized
     */
    public isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Reset game
     */
    public reset(): void {
        this.gameLoop.reset();
        this.stateMachine = new SceneFlowStateMachine(SceneStage.Loading);
        this.playerGridView.refresh();
        this.enemyGridView.refresh();
        this.transitionTo(SceneStage.Shop, { reason: 'game_reset' });
    }

    // ============= Panel References =============

    /**
     * Get shop panel
     */
    public getShopPanel(): ShopPanel | null {
        return this.shopPanel;
    }

    /**
     * Get grid panel
     */
    public getGridPanel(): GridPanelComp | null {
        return this.gridPanel;
    }

    /**
     * Get battle panel
     */
    public getBattlePanel(): BattlePanel | null {
        return this.battlePanel;
    }
}
