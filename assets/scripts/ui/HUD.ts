/**
 * HUD - Heads-Up Display Component
 * Displays game status: HP, Gold, Day, Phase Timer
 * Binds to GameLoop for real-time updates
 */

import { _decorator, Component, Node, Label, Color, Graphics } from 'cc';
import { GameLoop, GamePhase } from '../core/GameLoop';

const { ccclass, property } = _decorator;

@ccclass('HUD')
export class HUD extends Component {
    // ============= Properties =============

    @property({ type: Number, tooltip: 'Update interval in seconds' })
    public updateInterval: number = 0.1;

    // Colors
    @property({ type: Color, tooltip: 'Normal gold color' })
    public goldColor: Color = new Color(255, 215, 0, 255);

    @property({ type: Color, tooltip: 'Warning gold color (low)' })
    public goldWarningColor: Color = new Color(255, 100, 100, 255);

    @property({ type: Color, tooltip: 'Day color' })
    public dayColor: Color = new Color(100, 200, 255, 255);

    @property({ type: Color, tooltip: 'Phase color' })
    public phaseColor: Color = new Color(200, 200, 200, 255);

    @property({ type: Color, tooltip: 'HP bar background color' })
    public hpBarBgColor: Color = new Color(50, 50, 50, 200);

    @property({ type: Color, tooltip: 'HP bar fill color (healthy)' })
    public hpBarColor: Color = new Color(100, 255, 100, 255);

    @property({ type: Color, tooltip: 'HP bar fill color (low)' })
    public hpBarLowColor: Color = new Color(255, 100, 100, 255);

    // Warning thresholds
    @property({ type: Number, tooltip: 'Gold warning threshold' })
    public goldWarningThreshold: number = 5;

    @property({ type: Number, tooltip: 'HP warning threshold (0-1)' })
    public hpWarningThreshold: number = 0.3;

    // ============= Lifecycle =============

    onLoad(): void {
        this.createHUDElements();
    }

    start(): void {
        this.refreshDisplay();
        // Start periodic update
        this.schedule(this.refreshDisplay, this.updateInterval);
    }

    onDestroy(): void {
        this.unschedule(this.refreshDisplay);
    }

    // ============= Dependencies =============

    private gameLoop: GameLoop | null = null;

    // ============= UI References =============

    private goldLabel: Label | null = null;
    private dayLabel: Label | null = null;
    private phaseLabel: Label | null = null;
    private timerLabel: Label | null = null;
    private playerHpBar: Graphics | null = null;
    private enemyHpBar: Graphics | null = null;
    private playerHpText: Label | null = null;
    private enemyHpText: Label | null = null;

    // ============= Initialization =============

    /**
     * Initialize with GameLoop reference
     */
    public init(gameLoop: GameLoop): void {
        this.gameLoop = gameLoop;
        this.refreshDisplay();
    }

    // ============= UI Creation =============

    /**
     * Create HUD UI elements
     */
    private createHUDElements(): void {
        this.createTopBar();
        this.createHpBars();
    }

    /**
     * Create top bar with gold, day, phase, timer
     */
    private createTopBar(): void {
        // Gold display (top-left)
        const goldNode = new Node('gold');
        const goldTransform = goldNode.addComponent('cc.UITransform');
        (goldTransform as any).setContentSize(150, 30);
        goldNode.setPosition(-300, 250, 0);
        this.node.addChild(goldNode);

        this.goldLabel = goldNode.addComponent(Label);
        this.goldLabel.fontSize = 24;
        this.goldLabel.color = this.goldColor;
        this.goldLabel.string = 'Gold: 0';

        // Day display (top-center)
        const dayNode = new Node('day');
        const dayTransform = dayNode.addComponent('cc.UITransform');
        (dayTransform as any).setContentSize(100, 30);
        dayNode.setPosition(0, 250, 0);
        this.node.addChild(dayNode);

        this.dayLabel = dayNode.addComponent(Label);
        this.dayLabel.fontSize = 24;
        this.dayLabel.color = this.dayColor;
        this.dayLabel.string = 'Day 1';

        // Phase display (top-right)
        const phaseNode = new Node('phase');
        const phaseTransform = phaseNode.addComponent('cc.UITransform');
        (phaseTransform as any).setContentSize(200, 30);
        phaseNode.setPosition(200, 250, 0);
        this.node.addChild(phaseNode);

        this.phaseLabel = phaseNode.addComponent(Label);
        this.phaseLabel.fontSize = 20;
        this.phaseLabel.color = this.phaseColor;
        this.phaseLabel.string = 'PREPARE';

        // Timer display (below phase)
        const timerNode = new Node('timer');
        const timerTransform = timerNode.addComponent('cc.UITransform');
        (timerTransform as any).setContentSize(100, 25);
        timerNode.setPosition(200, 220, 0);
        this.node.addChild(timerNode);

        this.timerLabel = timerNode.addComponent(Label);
        this.timerLabel.fontSize = 18;
        this.timerLabel.color = this.phaseColor;
        this.timerLabel.string = '0.0s';
    }

    /**
     * Create HP bars for player and enemy
     */
    private createHpBars(): void {
        const barWidth = 200;
        const barHeight = 20;

        // Player HP (bottom-left)
        const playerHpNode = new Node('playerHp');
        const playerHpTransform = playerHpNode.addComponent('cc.UITransform');
        (playerHpTransform as any).setContentSize(barWidth, barHeight + 20);
        playerHpNode.setPosition(-250, -250, 0);
        this.node.addChild(playerHpNode);

        // Player HP bar background
        const playerHpBg = playerHpNode.addComponent(Graphics);
        playerHpBg.fillColor = this.hpBarBgColor;
        playerHpBg.rect(-barWidth / 2, 0, barWidth, barHeight);
        playerHpBg.fill();

        // Player HP bar fill
        this.playerHpBar = playerHpNode.addComponent(Graphics);
        this.playerHpBar.fillColor = this.hpBarColor;
        this.playerHpBar.rect(-barWidth / 2, 0, barWidth, barHeight);
        this.playerHpBar.fill();

        // Player HP text
        const playerTextNode = new Node('playerText');
        const playerTextTransform = playerTextNode.addComponent('cc.UITransform');
        (playerTextTransform as any).setContentSize(barWidth, 20);
        playerTextNode.setPosition(0, -15, 0);
        playerHpNode.addChild(playerTextNode);

        this.playerHpText = playerTextNode.addComponent(Label);
        this.playerHpText.fontSize = 14;
        this.playerHpText.color = new Color(255, 255, 255, 255);
        this.playerHpText.string = 'Player: 100/100';

        // Enemy HP (bottom-right)
        const enemyHpNode = new Node('enemyHp');
        const enemyHpTransform = enemyHpNode.addComponent('cc.UITransform');
        (enemyHpTransform as any).setContentSize(barWidth, barHeight + 20);
        enemyHpNode.setPosition(250, -250, 0);
        this.node.addChild(enemyHpNode);

        // Enemy HP bar background
        const enemyHpBg = enemyHpNode.addComponent(Graphics);
        enemyHpBg.fillColor = this.hpBarBgColor;
        enemyHpBg.rect(-barWidth / 2, 0, barWidth, barHeight);
        enemyHpBg.fill();

        // Enemy HP bar fill
        this.enemyHpBar = enemyHpNode.addComponent(Graphics);
        this.enemyHpBar.fillColor = this.hpBarColor;
        this.enemyHpBar.rect(-barWidth / 2, 0, barWidth, barHeight);
        this.enemyHpBar.fill();

        // Enemy HP text
        const enemyTextNode = new Node('enemyText');
        const enemyTextTransform = enemyTextNode.addComponent('cc.UITransform');
        (enemyTextTransform as any).setContentSize(barWidth, 20);
        enemyTextNode.setPosition(0, -15, 0);
        enemyHpNode.addChild(enemyTextNode);

        this.enemyHpText = enemyTextNode.addComponent(Label);
        this.enemyHpText.fontSize = 14;
        this.enemyHpText.color = new Color(255, 255, 255, 255);
        this.enemyHpText.string = 'Enemy: 100/100';
    }

    // ============= Display Updates =============

    /**
     * Refresh all HUD displays
     */
    public refreshDisplay(): void {
        if (!this.gameLoop) return;

        this.updateGold();
        this.updateDay();
        this.updatePhase();
        this.updateHp();
    }

    /**
     * Update gold display
     */
    private updateGold(): void {
        if (!this.gameLoop || !this.goldLabel) return;

        const gold = this.gameLoop.getPlayerGold();
        this.goldLabel.string = `Gold: ${gold}`;

        // Warning color if low gold
        if (gold <= this.goldWarningThreshold) {
            this.goldLabel.color = this.goldWarningColor;
        } else {
            this.goldLabel.color = this.goldColor;
        }
    }

    /**
     * Update day display
     */
    private updateDay(): void {
        if (!this.gameLoop || !this.dayLabel) return;

        const day = this.gameLoop.getDay();
        this.dayLabel.string = `Day ${day}`;
    }

    /**
     * Update phase and timer display
     */
    private updatePhase(): void {
        if (!this.gameLoop || !this.phaseLabel || !this.timerLabel) return;

        const phase = this.gameLoop.getPhase();
        this.phaseLabel.string = this.formatPhase(phase);

        // Timer (if in timed phase)
        const timer = (this.gameLoop as any).getTimer?.();
        if (timer !== null && timer !== undefined) {
            this.timerLabel.string = `${timer.toFixed(1)}s`;
        } else {
            this.timerLabel.string = '';
        }
    }

    /**
     * Update HP bars
     */
    private updateHp(): void {
        if (!this.gameLoop) return;

        // Get HP from battle state or use defaults
        const playerHp = (this.gameLoop as any).getPlayerHp?.() ?? 100;
        const playerMaxHp = (this.gameLoop as any).getPlayerMaxHp?.() ?? 100;
        const enemyHp = (this.gameLoop as any).getEnemyHp?.() ?? 100;
        const enemyMaxHp = (this.gameLoop as any).getEnemyMaxHp?.() ?? 100;

        this.updateHpBar(this.playerHpBar, this.playerHpText, playerHp, playerMaxHp, 'Player');
        this.updateHpBar(this.enemyHpBar, this.enemyHpText, enemyHp, enemyMaxHp, 'Enemy');
    }

    /**
     * Update single HP bar
     */
    private updateHpBar(
        bar: Graphics | null, 
        text: Label | null, 
        hp: number, 
        maxHp: number, 
        name: string
    ): void {
        if (!bar || !text) return;

        const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
        const barWidth = 200;

        // Clear and redraw
        bar.clear();
        
        // Color based on HP ratio
        if (ratio > this.hpWarningThreshold) {
            bar.fillColor = this.hpBarColor;
        } else {
            bar.fillColor = this.hpBarLowColor;
        }

        // Draw bar (only if there's HP)
        if (ratio > 0) {
            bar.rect(-barWidth / 2, 0, barWidth * ratio, 20);
            bar.fill();
        }

        // Update text
        text.string = `${name}: ${Math.ceil(hp)}/${Math.ceil(maxHp)}`;
    }

    // ============= Helpers =============

    /**
     * Format phase enum to display string
     */
    private formatPhase(phase: GamePhase): string {
        switch (phase) {
            case GamePhase.Prepare:
                return 'PREPARE';
            case GamePhase.Shop:
                return 'SHOP';
            case GamePhase.Battle:
                return 'BATTLE';
            case GamePhase.Result:
                return 'RESULT';
            case GamePhase.GameOver:
                return 'GAME OVER';
            default:
                return 'UNKNOWN';
        }
    }

    // ============= Public API =============

    /**
     * Force refresh (call after game state changes)
     */
    public forceRefresh(): void {
        this.refreshDisplay();
    }

    /**
     * Set update interval
     */
    public setUpdateInterval(interval: number): void {
        this.updateInterval = interval;
        this.unschedule(this.refreshDisplay);
        this.schedule(this.refreshDisplay, this.updateInterval);
    }
}
