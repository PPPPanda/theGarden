/**
 * MainScene - Main Game Scene (Cocos Component)
 * Unified scene flow dispatcher: Loading -> Shop -> Grid -> Battle -> Result
 */

import { _decorator, Component, Node } from 'cc';
import { BattleResult, GameLoop, GamePhase, getGameLoop } from '../core/GameLoop';
import { ShopManager } from '../core/ShopManager';
import { SceneFlowStateMachine, SceneStage, SceneStageContext } from '../core/SceneFlowStateMachine';
import { IGridItem, IItemTemplate, IShopSlot, IBattleState } from '../core/types';
import { GridView } from './GridView';
import { BattlePanel, BattlePanelState } from './BattlePanel';
import { ShopPanel } from './ShopPanel';
import { GridPanelComp } from './GridPanelComp';

const { ccclass, property } = _decorator;

/** MainScene flow actions */
export enum MainSceneAction {
    LoadingCompleted = 'loading_completed',
    EnterGrid = 'enter_grid',
    StartBattle = 'start_battle',
    ResolveBattle = 'resolve_battle',
    NextDay = 'next_day',
    Interrupt = 'interrupt'
}

@ccclass('MainScene')
export class MainScene extends Component {
    // ============= Cocos Lifecycle =============

    /**
     * Called when the component is loaded
     */
    onLoad(): void {
        this.gameLoop = getGameLoop();
        this.flowMachine = new SceneFlowStateMachine(SceneStage.Loading);

        // Initialize logic grid views (non-Node view adapters)
        this.playerGridView = new GridView(this.gameLoop.getPlayerGrid(), 50);
        this.enemyGridView = new GridView(this.gameLoop.getEnemyGrid(), 50);
    }

    /**
     * Called after onLoad, when the component is enabled
     */
    start(): void {
        this.playerGridView.init();
        this.enemyGridView.init();

        this.initBattlePanel();
        this.initGridPanels();

        // Explicit loading stage first, then move to shop when "loaded"
        this.applyStageVisibility(SceneStage.Loading);
        this.gameLoop.setPhase(GamePhase.Loading);

        this.isInitialized = true;
        this.dispatch(MainSceneAction.LoadingCompleted, { reason: 'scene_start' });
    }

    /**
     * Called every frame
     * @param _deltaTime - Time in seconds since last frame
     */
    update(_deltaTime: number): void {
        // Keep frame hook for future animation/timer updates.
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

    @property({ type: Node, tooltip: 'Loading panel node' })
    public loadingPanelNode: Node | null = null;

    @property({ type: Node, tooltip: 'Shop panel node' })
    public shopPanelNode: Node | null = null;

    @property({ type: Node, tooltip: 'Grid panel node' })
    public gridPanelNode: Node | null = null;

    @property({ type: Node, tooltip: 'Battle panel node' })
    public battlePanelNode: Node | null = null;

    @property({ type: Node, tooltip: 'Result panel node' })
    public resultPanelNode: Node | null = null;

    @property({ type: BattlePanel, tooltip: 'Battle panel component' })
    public battlePanel: BattlePanel | null = null;

    @property({ type: ShopPanel, tooltip: 'Shop panel component' })
    public shopPanel: ShopPanel | null = null;

    @property({ type: GridPanelComp, tooltip: 'Player grid panel component' })
    public playerGridPanel: GridPanelComp | null = null;

    @property({ type: GridPanelComp, tooltip: 'Enemy grid panel component' })
    public enemyGridPanel: GridPanelComp | null = null;

    // ============= Private Fields =============

    private gameLoop!: GameLoop;
    private flowMachine!: SceneFlowStateMachine;

    private playerGridView!: GridView;
    private enemyGridView!: GridView;

    private isInitialized: boolean = false;
    private isDispatching: boolean = false;

    private gridPanelsReady: boolean = false;
    private lastResolvedBattleState: IBattleState | null = null;
    private lastResolvedBattleResult: BattleResult | null = null;
    private lastInterruptReason: string | null = null;

    // ============= MainScene Dispatcher =============

    /**
     * Unified action dispatcher for scene flow.
     */
    public dispatch(action: MainSceneAction, context: SceneStageContext = {}): boolean {
        if (!this.isInitialized && action !== MainSceneAction.LoadingCompleted) {
            return false;
        }

        if (this.isDispatching) {
            return false;
        }

        this.isDispatching = true;
        try {
            switch (action) {
                case MainSceneAction.LoadingCompleted:
                    return this.transitionToStage(SceneStage.Shop, {
                        ...context,
                        reason: context.reason ?? 'loading_completed'
                    });

                case MainSceneAction.EnterGrid:
                    return this.transitionToStage(SceneStage.Grid, {
                        ...context,
                        reason: context.reason ?? 'enter_grid'
                    });

                case MainSceneAction.StartBattle:
                    return this.transitionToStage(SceneStage.Battle, {
                        ...context,
                        reason: context.reason ?? 'start_battle'
                    });

                case MainSceneAction.ResolveBattle:
                    if (this.getCurrentStage() !== SceneStage.Battle) {
                        const started = this.transitionToStage(SceneStage.Battle, {
                            reason: 'auto_start_before_resolve'
                        });
                        if (!started) {
                            return false;
                        }
                    }

                    return this.transitionToStage(SceneStage.Result, {
                        ...context,
                        reason: context.reason ?? 'resolve_battle'
                    });

                case MainSceneAction.NextDay:
                    return this.transitionToStage(SceneStage.Shop, {
                        ...context,
                        reason: context.reason ?? 'next_day',
                        advanceDay: true
                    });

                case MainSceneAction.Interrupt:
                    return this.interruptFlow(String(context.reason ?? 'manual_interrupt'));

                default:
                    return false;
            }
        } finally {
            this.isDispatching = false;
        }
    }

    /**
     * Handle validated transition and stage entry side-effects.
     */
    private transitionToStage(nextStage: SceneStage, context: SceneStageContext = {}): boolean {
        const result = this.flowMachine.transitionTo(nextStage, context);
        if (!result.ok || !result.transition) {
            return false;
        }

        try {
            this.onStageEntered(nextStage, result.transition.from, context);
            this.lastInterruptReason = null;
            return true;
        } catch (error) {
            this.handleStageError(nextStage, error);
            return false;
        }
    }

    /**
     * Enter-stage handler with all panel wiring + data passing.
     */
    private onStageEntered(stage: SceneStage, fromStage: SceneStage, context: SceneStageContext): void {
        switch (stage) {
            case SceneStage.Loading:
                this.gameLoop.setPhase(GamePhase.Loading);
                break;

            case SceneStage.Shop:
                if (fromStage === SceneStage.Loading) {
                    this.gameLoop.startDay();
                } else if (context.advanceDay === true) {
                    this.gameLoop.completeDay();
                } else {
                    this.gameLoop.setPhase(GamePhase.Shop);
                }

                this.bindShopPanel();
                this.refreshAllGrids();
                break;

            case SceneStage.Grid:
                this.gameLoop.enterGridPhase();
                this.initGridPanels();
                this.refreshAllGrids();
                break;

            case SceneStage.Battle:
                this.enterBattleStage();
                break;

            case SceneStage.Result:
                this.resolveBattleStage();
                break;
        }

        this.applyStageVisibility(stage);
        this.updateAllDisplays();
    }

    /**
     * Explicit rollback strategy for failure / interruption.
     */
    private interruptFlow(reason: string): boolean {
        const currentStage = this.flowMachine.getCurrentStage();
        const fallbackStage = this.flowMachine.getFallbackStage(currentStage);

        this.lastInterruptReason = reason;
        this.flowMachine.forceStage(fallbackStage, {
            reason,
            interruptedFrom: currentStage
        });

        try {
            this.onStageEntered(fallbackStage, currentStage, {
                reason: 'recovery',
                interruptedFrom: currentStage,
                originalReason: reason
            });
            return true;
        } catch {
            // Last safe fallback to loading UI if even recovery path fails.
            this.applyStageVisibility(SceneStage.Loading);
            this.gameLoop.setPhase(GamePhase.Loading);
            return false;
        }
    }

    private handleStageError(stage: SceneStage, error: unknown): void {
        const message = error instanceof Error ? error.message : String(error);
        this.interruptFlow(`stage=${stage}; error=${message}`);
    }

    // ============= Stage Wiring =============

    private bindShopPanel(): void {
        if (!this.shopPanel) {
            return;
        }

        this.shopPanel.init(this.gameLoop.getShopManager(), this.gameLoop);
        this.shopPanel.refreshDisplay();
    }

    private initGridPanels(): void {
        if (this.gridPanelsReady) {
            return;
        }

        const itemDB = this.gameLoop.getItemDB();

        if (this.playerGridPanel) {
            this.playerGridPanel.init(this.gameLoop.getPlayerGrid(), itemDB, this.gameLoop);
        }

        if (this.enemyGridPanel) {
            this.enemyGridPanel.init(this.gameLoop.getEnemyGrid(), itemDB, this.gameLoop);
        }

        this.gridPanelsReady = true;
    }

    private enterBattleStage(): void {
        this.gameLoop.generateAiOpponent();
        this.gameLoop.startBattle();

        this.refreshAllGrids();

        if (this.battlePanel) {
            const battleEngine = this.gameLoop.getCurrentBattleEngine();
            if (battleEngine) {
                this.battlePanel.startBattle(battleEngine);
            }
        }
    }

    private resolveBattleStage(): void {
        const battleState = this.gameLoop.runFullBattle();
        const battleResult = this.gameLoop.getBattleResult();

        this.lastResolvedBattleState = battleState;
        this.lastResolvedBattleResult = battleResult;

        if (this.battlePanel) {
            this.battlePanel.showResolvedResult(battleState, battleResult);
        }

        this.refreshAllGrids();
    }

    private applyStageVisibility(stage: SceneStage): void {
        this.setNodeVisible(this.loadingPanelNode, stage === SceneStage.Loading);
        this.setNodeVisible(this.shopPanelNode, stage === SceneStage.Shop);
        this.setNodeVisible(this.gridPanelNode, stage === SceneStage.Grid);

        const showBattleLayer = stage === SceneStage.Battle || stage === SceneStage.Result;
        this.setNodeVisible(this.battlePanelNode, showBattleLayer);
        this.setNodeVisible(this.resultPanelNode, stage === SceneStage.Result);

        if (!showBattleLayer) {
            this.battlePanel?.hide();
        }
    }

    private setNodeVisible(node: Node | null, visible: boolean): void {
        if (node) {
            node.active = visible;
        }
    }

    private refreshAllGrids(): void {
        this.playerGridView.refresh();
        this.enemyGridView.refresh();

        this.playerGridPanel?.refreshGrid();
        this.enemyGridPanel?.refreshGrid();
    }

    // ============= Public State Access =============

    /**
     * Get current game phase (GameLoop-level)
     */
    public getPhase(): GamePhase {
        return this.gameLoop.getPhase();
    }

    /**
     * Get current scene stage (MainScene FSM-level)
     */
    public getCurrentStage(): SceneStage {
        return this.flowMachine.getCurrentStage();
    }

    /**
     * Get latest flow interrupt reason
     */
    public getLastInterruptReason(): string | null {
        return this.lastInterruptReason;
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

    // ============= Shop Stage =============

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
     * Refresh shop
     */
    public refreshShop(): boolean {
        if (this.getCurrentStage() !== SceneStage.Shop) {
            return false;
        }

        const success = this.gameLoop.refreshShop();
        if (success) {
            this.updateGoldDisplay();
            this.shopPanel?.refreshDisplay();
        }

        return success;
    }

    /**
     * Purchase from shop
     */
    public purchaseFromShop(slotIndex: number, gridPosition: { row: number; col: number }): boolean {
        if (this.getCurrentStage() !== SceneStage.Shop) {
            return false;
        }

        const success = this.gameLoop.purchaseFromShop(slotIndex, gridPosition);
        if (success) {
            this.refreshAllGrids();
            this.updateGoldDisplay();
            this.shopPanel?.refreshDisplay();
        }

        return success;
    }

    /**
     * Toggle shop slot lock
     */
    public toggleShopLock(index: number): boolean {
        if (this.getCurrentStage() !== SceneStage.Shop) {
            return false;
        }

        const toggled = this.getShopManager().toggleLock(index);
        if (toggled) {
            this.shopPanel?.refreshDisplay();
        }

        return toggled;
    }

    /**
     * Move from shop to grid-arrange stage
     */
    public enterGridStage(): boolean {
        return this.dispatch(MainSceneAction.EnterGrid, { reason: 'shop_done' });
    }

    // ============= Grid Stage =============

    /**
     * Move item in player grid
     */
    public moveItem(itemId: string, newRow: number, newCol: number): boolean {
        const stage = this.getCurrentStage();
        if (stage !== SceneStage.Grid && stage !== SceneStage.Shop) {
            return false;
        }

        const success = this.gameLoop.moveItem(itemId, { row: newRow, col: newCol });
        if (success) {
            this.refreshAllGrids();
        }

        return success;
    }

    /**
     * Remove item from player grid
     */
    public removeItem(itemId: string): boolean {
        const stage = this.getCurrentStage();
        if (stage !== SceneStage.Grid && stage !== SceneStage.Shop) {
            return false;
        }

        const removed = this.gameLoop.removeItem(itemId);
        if (removed) {
            this.refreshAllGrids();
        }

        return removed !== null;
    }

    // ============= Battle Stage =============

    /**
     * Start battle stage
     */
    public startBattle(): void {
        this.dispatch(MainSceneAction.StartBattle, { reason: 'manual_start_battle' });
    }

    /**
     * Resolve battle to result stage
     */
    public runFullBattle(): IBattleState | null {
        const ok = this.dispatch(MainSceneAction.ResolveBattle, { reason: 'manual_resolve_battle' });
        if (!ok) {
            return null;
        }

        return this.lastResolvedBattleState;
    }

    /**
     * Get battle result
     */
    public getBattleResult(): BattleResult | null {
        return this.lastResolvedBattleResult ?? this.gameLoop.getBattleResult();
    }

    /**
     * Advance battle (single step)
     */
    public advanceBattleStep(): boolean {
        if (this.getCurrentStage() !== SceneStage.Battle) {
            return false;
        }

        if (this.battlePanel) {
            return this.battlePanel.advanceBattle();
        }

        return false;
    }

    /**
     * Run full battle with UI (compat wrapper)
     */
    public runBattleWithUI(): IBattleState | null {
        return this.runFullBattle();
    }

    /**
     * Hide battle panel
     */
    public hideBattlePanel(): void {
        this.battlePanel?.hide();
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

    // ============= Result Stage =============

    /**
     * Continue from result to next day shop
     */
    public completeDay(): void {
        this.dispatch(MainSceneAction.NextDay, { reason: 'continue_from_result' });
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

    // ============= UI Updates =============

    /**
     * Update gold display
     */
    private updateGoldDisplay(): void {
        // Hook point for external label binding.
    }

    /**
     * Update day display
     */
    public updateDayDisplay(): void {
        // Hook point for external label binding.
    }

    /**
     * Update MMR display
     */
    public updateMmrDisplay(): void {
        // Hook point for external label binding.
    }

    /**
     * Update wins/losses display
     */
    public updateRecordDisplay(): void {
        // Hook point for external label binding.
    }

    /**
     * Update all displays
     */
    public updateAllDisplays(): void {
        this.updateGoldDisplay();
        this.updateDayDisplay();
        this.updateMmrDisplay();
        this.updateRecordDisplay();
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
     * Reset game and return to loading
     */
    public reset(): void {
        this.gameLoop.reset();
        this.lastResolvedBattleState = null;
        this.lastResolvedBattleResult = null;
        this.lastInterruptReason = null;

        this.flowMachine.forceStage(SceneStage.Loading, { reason: 'reset' });
        this.applyStageVisibility(SceneStage.Loading);
        this.gameLoop.setPhase(GamePhase.Loading);

        this.dispatch(MainSceneAction.LoadingCompleted, { reason: 'reset_complete' });
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
