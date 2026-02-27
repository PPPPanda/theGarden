/**
 * HUD - Heads-Up Display Component
 * Displays game status: HP, Gold, Day, Phase Timer
 * Binds to GameLoop for real-time updates
 *
 * ALL UI nodes are bound via @property in the scene editor.
 * No runtime node creation — scene is the single source of truth.
 */

import { _decorator, Component, Node, Label, Color, Graphics, UITransform, CCFloat } from 'cc';
import { GameLoop, GamePhase } from '../core/GameLoop';

const { ccclass, property } = _decorator;

@ccclass('HUD')
export class HUD extends Component {
    // ============= Properties =============

    @property({ type: CCFloat, tooltip: 'Update interval in seconds' })
    public updateInterval: number = 0.1;

    // ============= Node Bindings (set in scene) =============

    /** HP bar fill node — uses Graphics; scaled on X axis for health ratio */
    @property({ type: Node, tooltip: 'HP bar fill (scale X for health)' })
    public hpBarFill: Node | null = null;

    /** HP bar background node (optional — drawn once at init) */
    @property({ type: Node, tooltip: 'HP bar background' })
    public hpBarBg: Node | null = null;

    /** HP text label node */
    @property({ type: Node, tooltip: 'HP text label' })
    public hpText: Node | null = null;

    /** Gold text label node */
    @property({ type: Node, tooltip: 'Gold text label' })
    public goldText: Node | null = null;

    /** Day text label node */
    @property({ type: Node, tooltip: 'Day text label' })
    public dayText: Node | null = null;

    /** Phase text label node (optional) */
    @property({ type: Node, tooltip: 'Phase text label' })
    public phaseText: Node | null = null;

    /** Timer text label node (optional) */
    @property({ type: Node, tooltip: 'Timer text label' })
    public timerText: Node | null = null;

    // ============= Color Properties =============

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

    // ============= Thresholds =============

    @property({ type: CCFloat, tooltip: 'Gold warning threshold' })
    public goldWarningThreshold: number = 5;

    @property({ type: CCFloat, tooltip: 'HP warning threshold (0-1)' })
    public hpWarningThreshold: number = 0.3;

    // ============= Private State =============

    private gameLoop: GameLoop | null = null;
    private hpBarWidth: number = 200;
    private hpBarHeight: number = 20;

    // ============= Lifecycle =============

    onLoad(): void {
        // Draw initial HP bar graphics (bg + fill) using scene-bound nodes
        this.initHpBarGraphics();
    }

    start(): void {
        this.refreshAll();
        this.schedule(this.refreshAll, this.updateInterval);
    }

    onDestroy(): void {
        this.unschedule(this.refreshAll);
    }

    // ============= Initialization =============

    /**
     * Initialize with GameLoop reference (called by MainScene)
     */
    public init(gameLoop: GameLoop): void {
        this.gameLoop = gameLoop;
        this.refreshAll();
    }

    /**
     * Draw initial HP bar graphics on scene-bound nodes.
     * Background: solid dark bar. Fill: solid green bar (scaled at runtime).
     */
    private initHpBarGraphics(): void {
        // Determine bar dimensions from UITransform if available
        if (this.hpBarBg) {
            const transform = this.hpBarBg.getComponent(UITransform);
            if (transform) {
                this.hpBarWidth = transform.width;
                this.hpBarHeight = transform.height;
            }
        } else if (this.hpBarFill) {
            const transform = this.hpBarFill.getComponent(UITransform);
            if (transform) {
                this.hpBarWidth = transform.width;
                this.hpBarHeight = transform.height;
            }
        }

        // Draw background bar
        if (this.hpBarBg) {
            const gfx = this.hpBarBg.getComponent(Graphics);
            if (gfx) {
                gfx.clear();
                gfx.fillColor = this.hpBarBgColor;
                gfx.roundRect(
                    -this.hpBarWidth / 2, -this.hpBarHeight / 2,
                    this.hpBarWidth, this.hpBarHeight, 4
                );
                gfx.fill();
            }
        }

        // Draw fill bar (full width — scaling handles ratio)
        if (this.hpBarFill) {
            const gfx = this.hpBarFill.getComponent(Graphics);
            if (gfx) {
                gfx.clear();
                gfx.fillColor = this.hpBarColor;
                gfx.roundRect(
                    -this.hpBarWidth / 2, -this.hpBarHeight / 2,
                    this.hpBarWidth, this.hpBarHeight, 4
                );
                gfx.fill();
            }
        }
    }

    // ============= Display Updates =============

    /**
     * Refresh all HUD displays (idempotent).
     */
    public refreshAll(): void {
        if (!this.gameLoop || !this.node?.isValid) {
            return;
        }

        this.updateGold();
        this.updateDay();
        this.updatePhase();
        this.updateHp();
    }

    /**
     * Backward-compatible alias.
     */
    public refreshDisplay(): void {
        this.refreshAll();
    }

    /**
     * Update gold display — uses scene-bound goldText node
     */
    private updateGold(): void {
        if (!this.gameLoop || !this.goldText) return;

        const gold = this.gameLoop.getPlayerGold();
        const label = this.goldText.getComponent(Label);
        if (label) {
            label.string = `Gold: ${gold}`;
            label.color = gold <= this.goldWarningThreshold
                ? this.goldWarningColor
                : this.goldColor;
        }
    }

    /**
     * Update day display — uses scene-bound dayText node
     */
    private updateDay(): void {
        if (!this.gameLoop || !this.dayText) return;

        const day = this.gameLoop.getDay();
        const label = this.dayText.getComponent(Label);
        if (label) {
            label.string = `Day ${day}`;
        }
    }

    /**
     * Update phase and timer display — uses optional scene-bound nodes
     */
    private updatePhase(): void {
        if (!this.gameLoop) return;

        const phase = this.gameLoop.getPhase();

        if (this.phaseText) {
            const label = this.phaseText.getComponent(Label);
            if (label) {
                label.string = this.formatPhase(phase);
                label.color = this.phaseColor;
            }
        }

        if (this.timerText) {
            const label = this.timerText.getComponent(Label);
            if (label) {
                const timer = this.getPhaseTimer();
                label.string = timer === null ? '' : `${timer.toFixed(1)}s`;
            }
        }
    }

    /**
     * Update HP bar — scale fill node + update text
     */
    private updateHp(): void {
        if (!this.gameLoop) return;

        const state = this.gameLoop.getPlayerState();
        const hp = state.hero.currentHealth;
        const maxHp = state.hero.maxHealth;
        const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

        // Scale fill bar on X axis
        if (this.hpBarFill) {
            this.hpBarFill.setScale(ratio, 1, 1);

            // Update fill color based on HP ratio
            const gfx = this.hpBarFill.getComponent(Graphics);
            if (gfx) {
                gfx.clear();
                gfx.fillColor = ratio > this.hpWarningThreshold
                    ? this.hpBarColor
                    : this.hpBarLowColor;
                gfx.roundRect(
                    -this.hpBarWidth / 2, -this.hpBarHeight / 2,
                    this.hpBarWidth, this.hpBarHeight, 4
                );
                gfx.fill();
            }
        }

        // Update HP text
        if (this.hpText) {
            const label = this.hpText.getComponent(Label);
            if (label) {
                label.string = `${Math.ceil(hp)}/${Math.ceil(maxHp)}`;
            }
        }
    }

    // ============= Helpers =============

    /**
     * Get current phase timer for display.
     * Returns null when no active/known timer should be shown.
     */
    private getPhaseTimer(): number | null {
        if (!this.gameLoop) {
            return null;
        }

        const battleEngine = this.gameLoop.getCurrentBattleEngine();
        if (battleEngine) {
            return battleEngine.getCurrentTime();
        }

        const lastBattle = this.gameLoop.getLastBattleState();
        if (lastBattle && this.gameLoop.getPhase() === GamePhase.Result) {
            return lastBattle.currentTime;
        }

        return null;
    }

    /**
     * Format phase enum to display string
     */
    private formatPhase(phase: GamePhase): string {
        switch (phase) {
            case GamePhase.Prepare: return 'PREPARE';
            case GamePhase.Shop:    return 'SHOP';
            case GamePhase.Battle:  return 'BATTLE';
            case GamePhase.Result:  return 'RESULT';
            case GamePhase.GameOver: return 'GAME OVER';
            default:                 return 'UNKNOWN';
        }
    }

    // ============= Public API =============

    /**
     * Force refresh (call after game state changes)
     */
    public forceRefresh(): void {
        this.refreshAll();
    }

    /**
     * Set update interval
     */
    public setUpdateInterval(interval: number): void {
        this.updateInterval = interval;
        this.unschedule(this.refreshAll);
        this.schedule(this.refreshAll, this.updateInterval);
    }
}
