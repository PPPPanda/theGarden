import { SceneFlowStateMachine, SceneStage } from '../../assets/scripts/core/SceneFlowStateMachine';

describe('SceneFlowStateMachine', () => {
    test('follows the normal round cycle', () => {
        const machine = new SceneFlowStateMachine(SceneStage.Loading);

        expect(machine.transitionTo(SceneStage.Shop).ok).toBe(true);
        expect(machine.transitionTo(SceneStage.Grid).ok).toBe(true);
        expect(machine.transitionTo(SceneStage.Battle).ok).toBe(true);
        expect(machine.transitionTo(SceneStage.Result).ok).toBe(true);
        expect(machine.transitionTo(SceneStage.Shop).ok).toBe(true);

        expect(machine.getCurrentStage()).toBe(SceneStage.Shop);
    });

    test('rejects invalid transitions', () => {
        const machine = new SceneFlowStateMachine(SceneStage.Loading);

        const result = machine.transitionTo(SceneStage.Battle);
        expect(result.ok).toBe(false);
        expect(result.error).toContain('Invalid transition');
        expect(machine.getCurrentStage()).toBe(SceneStage.Loading);
    });

    test('provides deterministic fallback strategy', () => {
        const machine = new SceneFlowStateMachine(SceneStage.Loading);

        expect(machine.getFallbackStage(SceneStage.Loading)).toBe(SceneStage.Loading);
        expect(machine.getFallbackStage(SceneStage.Shop)).toBe(SceneStage.Shop);
        expect(machine.getFallbackStage(SceneStage.Grid)).toBe(SceneStage.Shop);
        expect(machine.getFallbackStage(SceneStage.Battle)).toBe(SceneStage.Grid);
        expect(machine.getFallbackStage(SceneStage.Result)).toBe(SceneStage.Shop);
    });

    test('supports force stage for interruption recovery', () => {
        const machine = new SceneFlowStateMachine(SceneStage.Loading);
        machine.transitionTo(SceneStage.Shop);
        machine.transitionTo(SceneStage.Grid);
        machine.transitionTo(SceneStage.Battle);

        const transition = machine.forceStage(SceneStage.Grid, {
            reason: 'battle_interrupted'
        });

        expect(transition.from).toBe(SceneStage.Battle);
        expect(transition.to).toBe(SceneStage.Grid);
        expect(machine.getCurrentStage()).toBe(SceneStage.Grid);
    });

    test('advance uses the same state transition channel and records deterministic chain', () => {
        const machine = new SceneFlowStateMachine(SceneStage.Loading);

        expect(machine.advance().ok).toBe(true); // loading -> shop
        expect(machine.advance().ok).toBe(true); // shop -> grid
        expect(machine.advance().ok).toBe(true); // grid -> battle
        expect(machine.advance().ok).toBe(true); // battle -> result
        expect(machine.advance().ok).toBe(true); // result -> shop

        const history = machine.getHistory();
        const chain = history.map((entry) => `${entry.from}->${entry.to}`);

        expect(chain).toEqual([
            'loading->shop',
            'shop->grid',
            'grid->battle',
            'battle->result',
            'result->shop',
        ]);
        expect(machine.getCurrentStage()).toBe(SceneStage.Shop);
    });

    test('failed transition does not mutate stage or append history', () => {
        const machine = new SceneFlowStateMachine(SceneStage.Loading);

        const ok = machine.transitionTo(SceneStage.Shop);
        expect(ok.ok).toBe(true);

        const beforeStage = machine.getCurrentStage();
        const beforeHistoryLength = machine.getHistory().length;

        const failed = machine.transitionTo(SceneStage.Result); // invalid from shop
        expect(failed.ok).toBe(false);
        expect(failed.error).toContain('Invalid transition');

        expect(machine.getCurrentStage()).toBe(beforeStage);
        expect(machine.getHistory().length).toBe(beforeHistoryLength);
    });
});
