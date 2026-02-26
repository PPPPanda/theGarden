/**
 * BattlePanel - Battle UI Component
 * Displays battle phase, events, and results
 */

import { _decorator, Component, Node, Label, Color, Graphics, UITransform, Sprite, Vec3 } from 'cc';
import { BattleEngine } from '../core/BattleEngine';
import { GameLoop, GamePhase, BattleResult } from '../core/GameLoop';
import { IBattleState, ITimelineEvent } from '../core/types';

const { ccclass, property } = _decorator;

/** Battle Panel State */
export enum BattlePanelState {
    Hidden = 'hidden',
    Starting = 'starting',
    InProgress = 'in_progress',
    ShowingResult = 'showing_result'
}

/** Round Result */
export interface RoundResult {
    roundNumber: number;
    time: number;
    events: ITimelineEvent[];
    playerHp: number;
    enemyHp: number;
}

@ccclass('BattlePanel')
export class BattlePanel extends Component {
    // ============= Properties =============

    @property({ type: Node, tooltip: 'Battle container node' })
    public battleContainer: Node | null = null;

    @property({ type: Node, tooltip: 'Battle info panel (HP, time)' })
    public battleInfoPanel: Node | null = null;

    @property({ type: Node, tooltip: 'Event log panel' })
    public eventLogPanel: Node | null = null;

    @property({ type: Node, tooltip: 'Result panel' })
    public resultPanel: Node | null = null;

    @property({ type: Node, tooltip: 'Player HP bar' })
    public playerHpBar: Node | null = null;

    @property({ type: Node, tooltip: 'Enemy HP bar' })
    public enemyHpBar: Node | null = null;

    @property({ type: Node, tooltip: 'Battle timer label' })
    public timerLabel: Node | null = null;

    @property({ type: Node, tooltip: 'Result title label' })
    public resultTitleLabel: Node | null = null;

    @property({ type: Node, tooltip: 'Damage summary label' })
    public damageSummaryLabel: Node | null = null;

    @property({ type: Node, tooltip: 'Rewards label' })
    public rewardsLabel: Node | null = null;

    @property({ type: Node, tooltip: 'Continue button' })
    public continueButton: Node | null = null;

    @property({ type: Node, tooltip: 'Timeline progress bar fill' })
    public timelineBar: Node | null = null;

    @property({ type: Node, tooltip: 'Floating text container layer' })
    public floatingTextLayer: Node | null = null;

    @property({ type: Node, tooltip: 'Status icons container for player' })
    public playerStatusIcons: Node | null = null;

    @property({ type: Node, tooltip: 'Status icons container for enemy' })
    public enemyStatusIcons: Node | null = null;

    // ============= Private Fields =============

    private gameLoop: GameLoop | null = null;
    private battleEngine: BattleEngine | null = null;
    private state: BattlePanelState = BattlePanelState.Hidden;
    private currentBattleState: IBattleState | null = null;
    private battleResult: BattleResult | null = null;
    private eventLog: ITimelineEvent[] = [];
    private roundResults: RoundResult[] = [];
    private roundNumber: number = 0;
    private isAutoMode: boolean = false;
    private autoAdvanceDelay: number = 1.0; // seconds

    // Callbacks
    private onContinueCallback: (() => void) | null = null;
    private continueClickTarget: any = null; // Store click event target for cleanup

    // Colors
    private readonly PLAYER_COLOR = new Color(76, 175, 80, 255);    // Green
    private readonly ENEMY_COLOR = new Color(244, 67, 54, 255);    // Red
    private readonly WIN_COLOR = new Color(255, 193, 7, 255);       // Gold
    private readonly LOSE_COLOR = new Color(158, 158, 158, 255);    // Gray

    // ============= Lifecycle =============

    /**
     * onLoad - Called when component is loaded
     */
    onLoad(): void {
        // Initialize UI elements
        this.initializeUI();
    }

    /**
     * Initialize UI elements
     */
    private initializeUI(): void {
        // Hide all panels initially
        this.setPanelVisible(this.battleContainer, false);
        this.setPanelVisible(this.battleInfoPanel, false);
        this.setPanelVisible(this.eventLogPanel, false);
        this.setPanelVisible(this.resultPanel, false);
    }

    /**
     * Set panel visibility
     */
    private setPanelVisible(panel: Node | null, visible: boolean): void {
        if (panel) {
            panel.active = visible;
        }
    }

    // ============= Initialization =============

    /**
     * Initialize with game dependencies
     */
    public init(gameLoop: GameLoop): void {
        this.gameLoop = gameLoop;
    }

    /**
     * Set callback for continue button click
     */
    public setOnContinue(callback: () => void): void {
        this.onContinueCallback = callback;
        this.setupContinueButtonListener();
    }

    /**
     * Setup click listener on continue button
     */
    private setupContinueButtonListener(): void {
        if (!this.continueButton) return;
        
        // Try to use button component first
        const buttonComp = this.continueButton.getComponent('cc.Button');
        if (buttonComp) {
            // Use button's click events
            const clickEvent = buttonComp.clickEvents?.[0];
            if (clickEvent) {
                // Already has click event, no need to add more
                return;
            }
        }
        
        // Fallback: add touch listener directly
        this.continueButton.on('click', this.onContinueClicked, this);
        this.continueClickTarget = this.continueButton;
    }

    /**
     * Handle continue button click
     */
    private onContinueClicked(): void {
        this.continueToNext();
    }

    // ============= Battle Flow =============

    /**
     * Show battle starting UI
     */
    public showBattleStart(): void {
        this.state = BattlePanelState.Starting;
        this.eventLog = [];
        this.roundResults = [];
        this.roundNumber = 0;

        // Show battle container
        this.setPanelVisible(this.battleContainer, true);
        this.setPanelVisible(this.battleInfoPanel, true);
        this.setPanelVisible(this.eventLogPanel, true);
        this.setPanelVisible(this.resultPanel, false);

        // Initialize HP bars
        this.updateHpBars(100, 100);
        
        // Initialize timer
        this.updateTimer(0, 60);

        // Clear event log display
        this.clearEventLog();

        // Add start event
        this.addEventLogEntry({
            time: 0,
            type: 'item_trigger',
            target: 'player',
            value: 0,
            description: '⚔️ Battle Started!'
        });
    }

    /**
     * Start battle with BattleEngine
     */
    public startBattle(battleEngine: BattleEngine): void {
        this.battleEngine = battleEngine;

        // Show battle UI first, then enter in-progress state
        this.showBattleStart();
        this.state = BattlePanelState.InProgress;
    }

    /**
     * Advance to next battle event
     * Returns true if battle continues, false if finished
     */
    public advanceBattle(): boolean {
        if (!this.battleEngine) {
            return false;
        }

        // Check if already finished
        if (this.battleEngine.getIsFinished()) {
            return false;
        }

        // Get next event
        const event = this.battleEngine.advanceToNext();
        
        if (!event) {
            // Battle ended
            this.finishBattle();
            return false;
        }

        // Increment round
        this.roundNumber++;

        // Record round result
        const battleState = this.battleEngine.getBattleState();
        this.roundResults.push({
            roundNumber: this.roundNumber,
            time: event.time,
            events: [event],
            playerHp: battleState.player.hero.currentHealth,
            enemyHp: battleState.opponent.hero.currentHealth
        });

        // Update UI
        this.updateHpBars(
            battleState.player.hero.currentHealth,
            battleState.opponent.hero.currentHealth
        );
        
        this.updateTimer(
            battleState.currentTime,
            battleState.maxDuration
        );

        // Add to event log
        this.addEventLogEntry(event);

        // Store current state
        this.currentBattleState = battleState;

        // Check if battle ended
        if (this.battleEngine.getIsFinished()) {
            this.finishBattle();
            return false;
        }

        return true;
    }

    /**
     * Run full battle (for testing)
     */
    public runFullBattle(): IBattleState | null {
        if (!this.battleEngine) {
            return null;
        }

        const result = this.battleEngine.runFullBattle();
        this.currentBattleState = result;
        this.finishBattle();
        
        return result;
    }

    /**
     * Finish battle and show results
     */
    private finishBattle(): void {
        this.state = BattlePanelState.ShowingResult;

        // Get final state
        const finalState = this.battleEngine?.getBattleState();
        if (finalState) {
            this.currentBattleState = finalState;
        }

        // Get battle result from GameLoop
        this.battleResult = this.gameLoop?.getBattleResult() ?? null;

        // Show result panel
        this.setPanelVisible(this.resultPanel, true);

        // Update result display
        this.updateResultDisplay();
    }

    /**
     * Show final battle result using externally resolved data.
     * Used by MainScene state machine when GameLoop resolves battle.
     */
    public showResolvedResult(state: IBattleState, result: BattleResult | null): void {
        this.state = BattlePanelState.ShowingResult;
        this.currentBattleState = state;
        this.battleResult = result;
        this.eventLog = [...state.eventLog];

        this.setPanelVisible(this.battleContainer, true);
        this.setPanelVisible(this.battleInfoPanel, true);
        this.setPanelVisible(this.eventLogPanel, true);
        this.setPanelVisible(this.resultPanel, true);

        this.refreshEventLogDisplay();
        this.updateResultDisplay();
    }

    /**
     * Update HP bars
     */
    private updateHpBars(playerHp: number, enemyHp: number): void {
        // Update player HP bar width (assuming bar has a Graphics component)
        if (this.playerHpBar) {
            const graphics = this.playerHpBar.getComponent(Graphics);
            if (graphics) {
                const maxWidth = this.playerHpBar.getComponent(UITransform)?.width ?? 200;
                const currentWidth = (playerHp / 100) * maxWidth;
                
                graphics.clear();
                graphics.fillColor = this.PLAYER_COLOR;
                graphics.roundRect(-maxWidth/2, -10, currentWidth, 20, 4);
                graphics.fill();
            }
        }

        // Update enemy HP bar
        if (this.enemyHpBar) {
            const graphics = this.enemyHpBar.getComponent(Graphics);
            if (graphics) {
                const maxWidth = this.enemyHpBar.getComponent(UITransform)?.width ?? 200;
                const currentWidth = (enemyHp / 100) * maxWidth;
                
                graphics.clear();
                graphics.fillColor = this.ENEMY_COLOR;
                graphics.roundRect(-maxWidth/2, -10, currentWidth, 20, 4);
                graphics.fill();
            }
        }

        // Update HP text labels
        this.updateHpText(this.playerHpBar, playerHp);
        this.updateHpText(this.enemyHpBar, enemyHp);
    }

    /**
     * Update HP text on bar
     */
    private updateHpText(hpBar: Node | null, hp: number): void {
        if (!hpBar) return;
        
        const label = hpBar.getComponent(Label);
        if (label) {
            label.string = `${Math.round(hp)}/100`;
        }
    }

    /**
     * Update battle timer
     */
    private updateTimer(currentTime: number, maxTime: number): void {
        if (!this.timerLabel) return;

        const label = this.timerLabel.getComponent(Label);
        if (label) {
            label.string = `⏱️ ${currentTime.toFixed(1)}s / ${maxTime}s`;
        }

        // Update timeline progress bar
        this.updateTimelineBar(currentTime, maxTime);
    }

    /**
     * Update timeline progress bar
     */
    private updateTimelineBar(currentTime: number, maxTime: number): void {
        if (!this.timelineBar) return;

        const graphics = this.timelineBar.getComponent(Graphics);
        if (!graphics) return;

        const transform = this.timelineBar.getComponent(UITransform);
        const maxWidth = transform?.width ?? 400;
        const progress = Math.min(1, Math.max(0, currentTime / maxTime));
        const fillWidth = maxWidth * progress;

        graphics.clear();
        // Green for remaining, red for overtime
        graphics.fillColor = progress < 1 ? this.PLAYER_COLOR : this.ENEMY_COLOR;
        graphics.roundRect(-maxWidth / 2, -8, fillWidth, 16, 4);
        graphics.fill();
    }

    // ============= Floating Text =============

    /**
     * Show floating damage/heal text at position
     */
    public showFloatingText(text: string, position: Vec3, isDamage: boolean = true): void {
        if (!this.floatingTextLayer) return;

        // Create floating text node
        const floatNode = new Node('floatingText');
        floatNode.setPosition(position);

        // Add transform
        const transform = floatNode.addComponent(UITransform);
        transform.setContentSize(120, 40);

        // Add label
        const label = floatNode.addComponent(Label);
        label.fontSize = 24;
        label.fontWeight = 'bold';
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.string = text;

        // Color based on type
        if (isDamage) {
            label.color = this.ENEMY_COLOR;
        } else {
            label.color = this.PLAYER_COLOR;
        }

        this.floatingTextLayer.addChild(floatNode);

        // Animate using schedule - float up and fade out
        let elapsed = 0;
        const duration = 0.7;
        const startY = position.y;
        const startColor = label.color.clone();

        const updateFloat = (dt: number) => {
            elapsed += dt;
            const t = elapsed / duration;
            
            if (t >= 1) {
                floatNode.destroy();
                this.node.off('update', updateFloat);
                return;
            }

            // Float up
            const newY = startY + t * 80;
            floatNode.setPosition(position.x, newY, position.z);

            // Fade out in last half
            if (t > 0.5) {
                const alpha = Math.floor(255 * (1 - (t - 0.5) * 2));
                label.color = new Color(startColor.r, startColor.g, startColor.b, alpha);
            }
        };

        this.node.on('update', updateFloat);
    }

    /**
     * Show damage number
     */
    public showDamage(target: 'player' | 'enemy', damage: number, worldPos: Vec3): void {
        const sign = target === 'enemy' ? '-' : '+';
        this.showFloatingText(`${sign}${Math.round(damage)}`, worldPos, true);
    }

    /**
     * Show heal number
     */
    public showHeal(amount: number, worldPos: Vec3): void {
        this.showFloatingText(`+${Math.round(amount)}`, worldPos, false);
    }

    // ============= Status Icons =============

    /**
     * Update status icons display
     */
    public updateStatusIcons(playerStatuses: string[], enemyStatuses: string[]): void {
        this.updateStatusIconContainer(this.playerStatusIcons, playerStatuses);
        this.updateStatusIconContainer(this.enemyStatusIcons, enemyStatuses);
    }

    /**
     * Update a single status icon container
     */
    private updateStatusIconContainer(container: Node | null, statuses: string[]): void {
        if (!container) return;

        // Clear existing icons
        const children = container.children.slice();
        for (const child of children) {
            child.destroy();
        }

        // Add icons for each status
        const icons = ['🔥', '🛡️', '⚡', '💀', '✨', '❄️'];
        for (let i = 0; i < statuses.length && i < icons.length; i++) {
            const iconNode = new Node(`status_${i}`);
            const transform = iconNode.addComponent(UITransform);
            transform.setContentSize(32, 32);
            iconNode.setPosition(i * 36 - (statuses.length - 1) * 18, 0, 0);

            const label = iconNode.addComponent(Label);
            label.fontSize = 24;
            label.string = icons[i];

            container.addChild(iconNode);
        }
    }

    // ============= Event Log =============

    /**
     * Add entry to event log
     */
    private addEventLogEntry(event: ITimelineEvent): void {
        this.eventLog.push(event);
        
        // Update display (limit to last 10 events)
        this.refreshEventLogDisplay();
    }

    /**
     * Clear event log display
     */
    private clearEventLog(): void {
        if (!this.eventLogPanel) return;
        
        // Clear all children except template
        const children = this.eventLogPanel.children.slice();
        for (const child of children) {
            child.destroy();
        }
    }

    /**
     * Refresh event log display
     */
    private refreshEventLogDisplay(): void {
        if (!this.eventLogPanel) return;

        // Clear existing
        this.clearEventLog();

        // Show last 10 events
        const recentEvents = this.eventLog.slice(-10);
        
        for (const event of recentEvents) {
            const eventNode = this.createEventNode(event);
            this.eventLogPanel.addChild(eventNode);
        }
    }

    /**
     * Create event display node
     */
    private createEventNode(event: ITimelineEvent): Node {
        const node = new Node('event');
        
        const transform = node.addComponent(UITransform);
        transform.setContentSize(400, 30);
        
        const label = node.addComponent(Label);
        label.fontSize = 14;
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        
        // Format event string
        const timeStr = `[${event.time.toFixed(1)}s]`;
        const icon = this.getEventIcon(event.type);
        const targetStr = event.target === 'player' ? '🟢' : '🔴';
        const descStr = event.description || `${event.type}: ${event.value}`;
        
        label.string = `${timeStr} ${icon} ${targetStr} ${descStr}`;
        
        // Color based on type
        if (event.type === 'damage') {
            label.color = this.ENEMY_COLOR;
        } else if (event.type === 'heal') {
            label.color = this.PLAYER_COLOR;
        }
        
        return node;
    }

    /**
     * Get icon for event type
     */
    private getEventIcon(type: string): string {
        switch (type) {
            case 'item_trigger': return '⚡';
            case 'damage': return '💥';
            case 'heal': return '💚';
            case 'effect_tick': return '⏳';
            case 'status_apply': return '✨';
            case 'status_expire': return '❌';
            default: return '•';
        }
    }

    // ============= Results =============

    /**
     * Update result display
     */
    private updateResultDisplay(): void {
        if (!this.currentBattleState) return;

        const result = this.currentBattleState.result;
        const playerDamage = 100 - this.currentBattleState.player.hero.currentHealth;
        const enemyDamage = 100 - this.currentBattleState.opponent.hero.currentHealth;

        // Update result title
        if (this.resultTitleLabel) {
            const label = this.resultTitleLabel.getComponent(Label);
            if (label) {
                switch (result) {
                    case 'win':
                        label.string = '🎉 VICTORY!';
                        label.color = this.WIN_COLOR;
                        break;
                    case 'lose':
                        label.string = '💀 DEFEAT';
                        label.color = this.LOSE_COLOR;
                        break;
                    case 'draw':
                        label.string = '⚖️ DRAW';
                        label.color = new Color(158, 158, 158, 255);
                        break;
                    default:
                        label.string = '❓ UNKNOWN';
                }
            }
        }

        // Update damage summary
        if (this.damageSummaryLabel) {
            const label = this.damageSummaryLabel.getComponent(Label);
            if (label) {
                label.string = `Player Damage: ${playerDamage.toFixed(1)}\nEnemy Damage: ${enemyDamage.toFixed(1)}`;
            }
        }

        // Update rewards
        if (this.rewardsLabel && this.battleResult) {
            const label = this.rewardsLabel.getComponent(Label);
            if (label) {
                const { gold, mmr } = this.battleResult.rewards;
                const mmrStr = mmr >= 0 ? `+${mmr}` : `${mmr}`;
                label.string = `💰 Gold: +${gold}\n📊 MMR: ${mmrStr}`;
            }
        }

        // Update HP bars to final state
        this.updateHpBars(
            this.currentBattleState.player.hero.currentHealth,
            this.currentBattleState.opponent.hero.currentHealth
        );
    }

    // ============= State Management =============

    /**
     * Get current panel state
     */
    public getState(): BattlePanelState {
        return this.state;
    }

    /**
     * Check if battle is in progress
     */
    public isBattleInProgress(): boolean {
        return this.state === BattlePanelState.InProgress;
    }

    /**
     * Check if battle is finished
     */
    public isBattleFinished(): boolean {
        return this.state === BattlePanelState.ShowingResult;
    }

    /**
     * Hide battle panel
     */
    public hide(): void {
        this.state = BattlePanelState.Hidden;
        this.setPanelVisible(this.battleContainer, false);
        this.setPanelVisible(this.battleInfoPanel, false);
        this.setPanelVisible(this.eventLogPanel, false);
        this.setPanelVisible(this.resultPanel, false);
        
        this.battleEngine = null;
        this.currentBattleState = null;
        this.battleResult = null;
        this.eventLog = [];
        this.roundResults = [];
        this.roundNumber = 0;
    }

    /**
     * Continue to next phase (called when user clicks continue)
     */
    public continueToNext(): void {
        // Call the callback first (e.g., to transition to next day)
        if (this.onContinueCallback) {
            this.onContinueCallback();
        }
        
        // Hide panel
        this.hide();
    }

    // ============= Auto Mode =============

    /**
     * Set auto mode
     */
    public setAutoMode(auto: boolean): void {
        this.isAutoMode = auto;
    }

    /**
     * Get auto mode status
     */
    public isAuto(): boolean {
        return this.isAutoMode;
    }

    /**
     * Set auto advance delay
     */
    public setAutoAdvanceDelay(delay: number): void {
        this.autoAdvanceDelay = Math.max(0.1, delay);
    }

    // ============= Data Access =============

    /**
     * Get current battle state
     */
    public getCurrentBattleState(): IBattleState | null {
        return this.currentBattleState;
    }

    /**
     * Get battle result
     */
    public getBattleResult(): BattleResult | null {
        return this.battleResult;
    }

    /**
     * Get event log
     */
    public getEventLog(): ITimelineEvent[] {
        return [...this.eventLog];
    }

    /**
     * Get round results
     */
    public getRoundResults(): RoundResult[] {
        return [...this.roundResults];
    }

    // ============= Cleanup =============

    /**
     * onDestroy - Called when component is destroyed
     */
    onDestroy(): void {
        // Clean up continue button listener
        if (this.continueClickTarget) {
            this.continueClickTarget.off('click', this.onContinueClicked, this);
            this.continueClickTarget = null;
        }
        
        this.hide();
        this.gameLoop = null;
        this.battleEngine = null;
    }
}

// Export types for external use
export type { IBattleState, ITimelineEvent } from '../core/types';
export type { BattleResult } from '../core/GameLoop';
