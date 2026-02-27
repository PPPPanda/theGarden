/**
 * MainScene - Main Game Scene (Cocos Component)
 * Coordinates all game systems and UI
 */

import { _decorator, Component, Node, Vec3, Button } from 'cc';
import { GameLoop, GamePhase, getGameLoop } from '../core/GameLoop';
import { ShopManager } from '../core/ShopManager';
import { GridView } from './GridView';
import { BattlePanel, BattlePanelState } from './BattlePanel';
import { ScreenAdapter } from './ScreenAdapter';
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
        
        // Setup backup input handlers with diagnostic logging
        this.setupBackupInputHandlers();
        
        // Auto-advance from Loading to Shop on startup
        const bootTransition = this.transitionToStage(SceneStage.Shop);
        if (!bootTransition.ok) {
            console.error('[MainScene] Failed to transition to Shop on startup');
        }

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
        // Cleanup backup input listeners to prevent memory leaks
        if (this._backupInputRegistered) {
            if (this._enterGridBtn) {
                this._enterGridBtn.off('touchend', this._onEnterGridTouched, this);
            }
            if (this._startBattleBtn) {
                this._startBattleBtn.off('touchend', this._onStartBattleTouched, this);
            }
            if (this._continueNextDayBtn) {
                this._continueNextDayBtn.off('touchend', this._onContinueNextDayTouched, this);
            }
            this._backupInputRegistered = false;
        }
        
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

    // ============= Flow Control Buttons =============

    @property({ type: Node, tooltip: 'Enter Grid button node' })
    public enterGridBtn: Node | null = null;

    @property({ type: Node, tooltip: 'Start Battle button node' })
    public startBattleBtn: Node | null = null;

    @property({ type: Node, tooltip: 'Continue Next Day button node' })
    public continueNextDayBtn: Node | null = null;

    // ============= Private Fields =============

    private gameLoop!: GameLoop;
    private playerGridView!: GridView;
    private enemyGridView!: GridView;
    private isInitialized: boolean = false;
    private stageMachine!: SceneFlowStateMachine;
    
    // Backup input registration flags (one-time protection)
    private _backupInputRegistered: boolean = false;
    private _enterGridBtn: Node | null = null;
    private _startBattleBtn: Node | null = null;
    private _continueNextDayBtn: Node | null = null;

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
            this.onStageTransitionSuccess(targetStage, 'transitionToStage');
        }

        return result;
    }

    /**
     * Advance to next stage in cycle
     */
    public advanceToNextStage(context: Record<string, unknown> = {}): SceneTransitionResult {
        const result = this.stageMachine.advance(context);

        if (result.ok && result.transition) {
            this.onStageTransitionSuccess(result.transition.to, 'advanceToNextStage');
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
     * Unified success hook for SceneStage transitions.
     */
    private onStageTransitionSuccess(stage: SceneStage, source: string): void {
        this.syncPhaseWithStage(stage, source);
        this.assertStagePhaseConsistency(stage, source);
        this.applyStageVisibility(stage);
        this.refreshHudAfterStageTransition(stage, source);
        this.logUiClosureCheckpoint(stage, source);
    }

    /**
     * Refresh HUD after a successful stage transition.
     */
    private refreshHudAfterStageTransition(stage: SceneStage, source: string): void {
        this.hud?.refreshAll();
        console.log(`[MainScene] HUD refresh after stage transition (${source}): stage=${stage}, phase=${this.gameLoop.getPhase()}`);
    }

    /**
     * Final UI closure checkpoint log for anti-regression.
     */
    private logUiClosureCheckpoint(stage: SceneStage, source: string): void {
        const phase = this.gameLoop.getPhase();
        const day = this.gameLoop.getDay();

        if (stage !== SceneStage.Shop || !this.shopPanel) {
            console.log(`[MainScene] UI_CLOSURE_CHECK (${source}) stage=${stage} phase=${phase} day=${day}`);
            return;
        }

        const healthy = this.shopPanel.isUiRegressionHealthy();
        const issues = this.shopPanel.getUiRegressionIssues();

        if (healthy) {
            console.log(`[MainScene] UI_CLOSURE_CHECK (${source}) PASS stage=${stage} phase=${phase} day=${day}`);
        } else {
            console.warn(`[MainScene] UI_CLOSURE_CHECK (${source}) WARN stage=${stage} phase=${phase} day=${day} issues=${issues.join(' | ')}`);
        }
    }

    /**
     * Runtime assertion guard for Stage/Phase consistency.
     */
    private assertStagePhaseConsistency(stage: SceneStage, source: string): void {
        const expected = this.getExpectedPhaseForStage(stage);
        if (!expected) {
            return;
        }

        const actual = this.gameLoop.getPhase();
        if (actual !== expected) {
            console.error(`[MainScene] Stage/Phase assertion failed at ${source}: stage=${stage}, expected=${expected}, actual=${actual}`);
        }
    }

    /**
     * Ensure GamePhase stays aligned with SceneStage.
     */
    private syncPhaseWithStage(stage: SceneStage, source: string): void {
        const expected = this.getExpectedPhaseForStage(stage);
        if (!expected) {
            return;
        }

        const current = this.gameLoop.getPhase();
        if (current !== expected) {
            console.warn(`[MainScene] Stage/Phase mismatch at ${source}: stage=${stage}, phase=${current}, expected=${expected}. Syncing phase.`);
            this.gameLoop.setPhase(expected);
        }

        console.log(`[MainScene] ${source}: stage=${stage}, phase=${this.gameLoop.getPhase()}`);
    }

    /**
     * Map scene stage to expected game phase.
     */
    private getExpectedPhaseForStage(stage: SceneStage): GamePhase | null {
        switch (stage) {
            case SceneStage.Loading:
                return GamePhase.Loading;
            case SceneStage.Shop:
                return GamePhase.Shop;
            case SceneStage.Grid:
                return GamePhase.Grid;
            case SceneStage.Battle:
                return GamePhase.Battle;
            case SceneStage.Result:
                return GamePhase.Result;
            default:
                return null;
        }
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
        
        // Always show HUD (content refresh handled by onStageTransitionSuccess hook)
        this.setPanelVisible(this.hud?.node ?? null, true);
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
        // Use unified flow: startBattle -> finishBattle (finish resolves/settles exactly once)
        if (!this.startBattle()) {
            return null;
        }

        const finished = this.finishBattle();
        if (!finished) {
            return null;
        }

        return this.gameLoop.getLastBattleState();
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
            
            // Register FlowControls for adaptive positioning
            const flowControls = this.node.getChildByName('FlowControls');
            if (flowControls) {
                this.screenAdapter.registerFlowControls(flowControls);
                console.log('[MainScene] FlowControls registered with ScreenAdapter');
            }
        }
    }

    /**
     * Setup backup input handlers for FlowControls buttons.
     * Finds buttons at runtime via getChildByName (FlowControls > Button).
     * Provides diagnostic logging and TOUCH_END fallback if clickEvents fail.
     * Uses one-time registration protection to avoid duplicates.
     */
    private setupBackupInputHandlers(): void {
        if (this._backupInputRegistered) {
            console.warn('[MainScene] Backup input already registered, skipping');
            return;
        }
        
        console.log('[MainScene] Setting up backup input handlers...');
        
        // Find buttons at runtime: FlowControls is child of MainScene root
        const flowControls = this.node.getChildByName('FlowControls');
        if (!flowControls) {
            console.warn('[MainScene] FlowControls node not found, backup handlers skipped');
            return;
        }
        
        const enterGridBtn = flowControls.getChildByName('EnterGridBtn');
        const startBattleBtn = flowControls.getChildByName('StartBattleBtn');
        const continueNextDayBtn = flowControls.getChildByName('ContinueNextDayBtn');
        
        // Diagnostic: Log button availability
        const buttons = [
            { name: 'EnterGridBtn', node: enterGridBtn },
            { name: 'StartBattleBtn', node: startBattleBtn },
            { name: 'ContinueNextDayBtn', node: continueNextDayBtn },
        ];
        
        for (const btn of buttons) {
            if (btn.node) {
                const buttonComp = btn.node.getComponent(Button);
                const hasClickEvents = (buttonComp?.clickEvents?.length ?? 0) > 0;
                console.log(`[MainScene] ${btn.name}: found, Button component: ${!!buttonComp}, clickEvents: ${hasClickEvents ? 'yes' : 'none'}`);
            } else {
                console.log(`[MainScene] ${btn.name}: NOT FOUND at runtime path`);
            }
        }
        
        // Register backup TOUCH_END listeners and store references for cleanup
        if (enterGridBtn) {
            this._enterGridBtn = enterGridBtn;
            enterGridBtn.on('touchend', this._onEnterGridTouched, this);
            console.log('[MainScene] Registered backup touchend for EnterGridBtn');
        }
        
        if (startBattleBtn) {
            this._startBattleBtn = startBattleBtn;
            startBattleBtn.on('touchend', this._onStartBattleTouched, this);
            console.log('[MainScene] Registered backup touchend for StartBattleBtn');
        }
        
        if (continueNextDayBtn) {
            this._continueNextDayBtn = continueNextDayBtn;
            continueNextDayBtn.on('touchend', this._onContinueNextDayTouched, this);
            console.log('[MainScene] Registered backup touchend for ContinueNextDayBtn');
        }
        
        this._backupInputRegistered = true;
        console.log('[MainScene] Backup input handlers setup complete');
    }

    // Backup touch handlers - call actual business methods
    
    private _onEnterGridTouched(): void {
        const currentStage = this.getCurrentStage();
        console.log(`[MainScene] ENTER_GRID touched! Current stage: ${currentStage}`);
        
        // Call actual business method (includes phase sync)
        const success = this.enterGrid();
        console.log(`[MainScene] enterGrid() result: ${success ? 'SUCCESS' : 'FAILED'}`);
    }
    
    private _onStartBattleTouched(): void {
        const currentStage = this.getCurrentStage();
        console.log(`[MainScene] START_BATTLE touched! Current stage: ${currentStage}`);
        
        // startBattle() already calls generateAiOpponent() - do not duplicate
        // Call actual business method (includes gameLoop.startBattle() + generateAiOpponent())
        const success = this.startBattle();
        console.log(`[MainScene] startBattle() result: ${success ? 'SUCCESS' : 'FAILED'}`);
    }
    
    private _onContinueNextDayTouched(): void {
        const currentStage = this.getCurrentStage();
        console.log(`[MainScene] CONTINUE_NEXT_DAY touched! Current stage: ${currentStage}`);
        
        // Call actual business method (includes completeDay, day/gold/hud refresh)
        const success = this.continueToNextDay();
        console.log(`[MainScene] continueToNextDay() result: ${success ? 'SUCCESS' : 'FAILED'}`);
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
        // Use unified flow: startBattle -> finishBattle (finish resolves/settles exactly once)
        if (!this.startBattle()) {
            return null;
        }

        const finished = this.finishBattle();
        if (!finished) {
            return null;
        }

        return this.gameLoop.getLastBattleState();
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
        console.log(`[MainScene] enterGrid() stage transition: ${result.ok ? 'SUCCESS' : 'FAILED'}`);
        if (result.ok) {
            console.log('[MainScene] UI_FLOW shop->grid checkpoint PASS');
        }
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

        // Transition through the unified stage channel first.
        const result = this.transitionToStage(SceneStage.Battle);
        if (!result.ok) {
            return false;
        }

        // Generate AI opponent exactly once per battle start entry
        this.gameLoop.generateAiOpponent();
        console.log('[MainScene] startBattle: generateAiOpponent() called once');

        // Start battle in GameLoop
        this.gameLoop.startBattle();

        // Update enemy grid view and battle UI
        this.enemyGridView.refresh();
        this.showBattleStartUI();

        // Phase/timer may have changed after battle engine creation, refresh once more.
        this.hud?.refreshAll();
        console.log('[MainScene] UI_FLOW grid->battle checkpoint PASS');

        return true;
    }

    /**
     * Finish battle and transition to Result stage.
     * Battle settlement is resolved through GameLoop.runFullBattle() with internal idempotency guards.
     */
    public finishBattle(): boolean {
        const current = this.getCurrentStage();
        if (current !== SceneStage.Battle) {
            console.warn('Cannot finish battle - not in Battle stage');
            return false;
        }

        // Resolve/settle battle before entering Result stage.
        const battleState = this.gameLoop.runFullBattle();
        const battleResult = this.gameLoop.getBattleResult();

        if (!battleResult) {
            console.warn('[MainScene] finishBattle aborted: battleResult is null after settlement');
            return false;
        }

        console.log(`[MainScene] finishBattle settlement complete: result=${battleState.result}`);

        // Push resolved data to battle panel without re-running settlement.
        if (this.battlePanel) {
            this.battlePanel.showResolvedResult(battleState, battleResult);
        }

        const result = this.transitionToStage(SceneStage.Result);
        console.log(`[MainScene] finishBattle() transition: ${result.ok ? 'SUCCESS' : 'FAILED'}`);

        // Update views after battle
        this.playerGridView.refresh();
        this.enemyGridView.refresh();

        if (result.ok) {
            console.log('[MainScene] UI_FLOW battle->result checkpoint PASS');
        }

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

        // Transition through the unified stage channel first.
        const result = this.transitionToStage(SceneStage.Shop);
        if (!result.ok) {
            return false;
        }

        // Complete current day and start next.
        this.gameLoop.completeDay();

        // Refresh views
        this.playerGridView.refresh();
        this.enemyGridView.refresh();
        this.hud?.refreshAll();
        console.log('[MainScene] UI_FLOW result->shop(nextDay) checkpoint PASS');

        return true;
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
        this.hud?.refreshAll();
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
        this.updateDayDisplay();
        this.updateMmrDisplay();
        this.updateRecordDisplay();
        this.hud?.refreshAll();
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

    }
