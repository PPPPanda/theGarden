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
});
