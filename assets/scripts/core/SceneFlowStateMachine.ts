/**
 * SceneFlowStateMachine - MainScene phase flow controller
 * Loading -> Shop -> Grid -> Battle -> Result -> Shop ...
 */

export enum SceneStage {
    Loading = 'loading',
    Shop = 'shop',
    Grid = 'grid',
    Battle = 'battle',
    Result = 'result'
}

export interface SceneStageContext {
    reason?: string;
    interruptedFrom?: SceneStage;
    day?: number;
    [key: string]: unknown;
}

export interface SceneTransition {
    from: SceneStage;
    to: SceneStage;
    context: SceneStageContext;
    at: number;
}

export interface SceneTransitionResult {
    ok: boolean;
    transition?: SceneTransition;
    error?: string;
}

/**
 * Pure state machine used by MainScene to avoid invalid transitions/dead loops.
 */
export class SceneFlowStateMachine {
    private currentStage: SceneStage;
    private readonly history: SceneTransition[] = [];
    private isTransitioning: boolean = false;

    private readonly allowedTransitions: Record<SceneStage, Set<SceneStage>> = {
        [SceneStage.Loading]: new Set([SceneStage.Shop]),
        [SceneStage.Shop]: new Set([SceneStage.Grid]),
        [SceneStage.Grid]: new Set([SceneStage.Battle, SceneStage.Shop]),
        [SceneStage.Battle]: new Set([SceneStage.Result, SceneStage.Grid]),
        [SceneStage.Result]: new Set([SceneStage.Shop])
    };

    private readonly fallbackMap: Record<SceneStage, SceneStage> = {
        [SceneStage.Loading]: SceneStage.Loading,
        [SceneStage.Shop]: SceneStage.Shop,
        [SceneStage.Grid]: SceneStage.Shop,
        [SceneStage.Battle]: SceneStage.Grid,
        [SceneStage.Result]: SceneStage.Shop
    };

    constructor(initialStage: SceneStage = SceneStage.Loading) {
        this.currentStage = initialStage;
    }

    public getCurrentStage(): SceneStage {
        return this.currentStage;
    }

    public getHistory(): SceneTransition[] {
        return [...this.history];
    }

    public canTransition(to: SceneStage, from: SceneStage = this.currentStage): boolean {
        return this.allowedTransitions[from]?.has(to) ?? false;
    }

    public getFallbackStage(stage: SceneStage = this.currentStage): SceneStage {
        return this.fallbackMap[stage];
    }

    public getNextCycleStage(stage: SceneStage = this.currentStage): SceneStage {
        switch (stage) {
            case SceneStage.Loading:
                return SceneStage.Shop;
            case SceneStage.Shop:
                return SceneStage.Grid;
            case SceneStage.Grid:
                return SceneStage.Battle;
            case SceneStage.Battle:
                return SceneStage.Result;
            case SceneStage.Result:
                return SceneStage.Shop;
            default:
                return SceneStage.Shop;
        }
    }

    public transitionTo(to: SceneStage, context: SceneStageContext = {}): SceneTransitionResult {
        if (this.isTransitioning) {
            return { ok: false, error: 'Transition is already in progress' };
        }

        const from = this.currentStage;
        if (!this.canTransition(to, from)) {
            return {
                ok: false,
                error: `Invalid transition: ${from} -> ${to}`
            };
        }

        this.isTransitioning = true;
        try {
            const transition: SceneTransition = {
                from,
                to,
                context,
                at: Date.now()
            };

            this.currentStage = to;
            this.history.push(transition);

            // Keep history bounded
            if (this.history.length > 100) {
                this.history.shift();
            }

            return {
                ok: true,
                transition
            };
        } finally {
            this.isTransitioning = false;
        }
    }

    /**
     * Force set stage for recovery/interruption paths.
     */
    public forceStage(stage: SceneStage, context: SceneStageContext = {}): SceneTransition {
        const transition: SceneTransition = {
            from: this.currentStage,
            to: stage,
            context,
            at: Date.now()
        };

        this.currentStage = stage;
        this.history.push(transition);

        if (this.history.length > 100) {
            this.history.shift();
        }

        return transition;
    }

    public advance(context: SceneStageContext = {}): SceneTransitionResult {
        return this.transitionTo(this.getNextCycleStage(), context);
    }
}
