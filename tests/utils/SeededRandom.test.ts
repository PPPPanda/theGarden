/**
 * SeededRandom 单元测试
 */
import { SeededRandom } from '../../assets/scripts/utils/SeededRandom';

describe('SeededRandom', () => {
    describe('constructor', () => {
        it('should handle seed = 0', () => {
            const rng = new SeededRandom(0);
            expect(rng).toBeDefined();
        });

        it('should normalize seed to uint32', () => {
            const rng1 = new SeededRandom(1);
            const rng2 = new SeededRandom(0x100000001);
            // Same lower 32 bits should produce same sequence
            const v1 = rng1.next();
            const rng3 = new SeededRandom(1);
            expect(rng3.next()).toBe(v1);
        });
    });

    describe('next()', () => {
        it('should return value in [0, 1)', () => {
            const rng = new SeededRandom(12345);
            for (let i = 0; i < 100; i++) {
                const v = rng.next();
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThan(1);
            }
        });

        it('should produce same sequence for same seed', () => {
            const rng1 = new SeededRandom(42);
            const rng2 = new SeededRandom(42);
            for (let i = 0; i < 500; i++) {
                expect(rng1.next()).toBe(rng2.next());
            }
        });

        it('should produce different sequences for different seeds', () => {
            const rng1 = new SeededRandom(1);
            const rng2 = new SeededRandom(2);
            let different = false;
            for (let i = 0; i < 10; i++) {
                if (rng1.next() !== rng2.next()) {
                    different = true;
                    break;
                }
            }
            expect(different).toBe(true);
        });
    });

    describe('nextInt()', () => {
        it('should return integer in [min, max] inclusive', () => {
            const rng = new SeededRandom(999);
            for (let i = 0; i < 100; i++) {
                const v = rng.nextInt(0, 10);
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(10);
                expect(Number.isInteger(v)).toBe(true);
            }
        });

        it('nextInt(0, 1) should only return 0 or 1', () => {
            const rng = new SeededRandom(888);
            const results = new Set<number>();
            for (let i = 0; i < 100; i++) {
                const v = rng.nextInt(0, 1);
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThanOrEqual(1);
                results.add(v);
            }
            expect(results.size).toBeGreaterThan(0);
            expect(results.size).toBeLessThanOrEqual(2);
        });

        it('should handle negative range', () => {
            const rng = new SeededRandom(777);
            for (let i = 0; i < 50; i++) {
                const v = rng.nextInt(-5, -1);
                expect(v).toBeGreaterThanOrEqual(-5);
                expect(v).toBeLessThanOrEqual(-1);
            }
        });
    });

    describe('nextFloat()', () => {
        it('should return float in [min, max)', () => {
            const rng = new SeededRandom(666);
            for (let i = 0; i < 100; i++) {
                const v = rng.nextFloat(5.5, 10.5);
                expect(v).toBeGreaterThanOrEqual(5.5);
                expect(v).toBeLessThan(10.5);
            }
        });
    });

    describe('pick()', () => {
        it('should pick random element from array', () => {
            const rng = new SeededRandom(555);
            const arr = [1, 2, 3, 4, 5];
            const picked = rng.pick(arr);
            expect(arr).toContain(picked);
        });

        it('should throw on empty array', () => {
            const rng = new SeededRandom(444);
            expect(() => rng.pick([])).toThrow();
        });
    });

    describe('shuffle()', () => {
        it('should return new array (not modify original)', () => {
            const rng = new SeededRandom(333);
            const original = [1, 2, 3, 4, 5];
            const shuffled = rng.shuffle(original);
            expect(original).toEqual([1, 2, 3, 4, 5]);
        });

        it('should return array of same length', () => {
            const rng = new SeededRandom(222);
            const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            const shuffled = rng.shuffle(original);
            expect(shuffled.length).toBe(original.length);
        });

        it('should contain all original elements', () => {
            const rng = new SeededRandom(111);
            const original = [1, 2, 3, 4, 5];
            const shuffled = rng.shuffle(original);
            const sortedShuffled = [...shuffled].sort((a, b) => a - b);
            expect(sortedShuffled).toEqual(original);
        });

        it('should produce different results for different seeds', () => {
            const rng1 = new SeededRandom(100);
            const rng2 = new SeededRandom(200);
            const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            const shuffled1 = rng1.shuffle(arr);
            const shuffled2 = rng2.shuffle(arr);
            // High probability of difference
            let sameCount = 0;
            for (let i = 0; i < 10; i++) {
                if (shuffled1[i] === shuffled2[i]) sameCount++;
            }
            expect(sameCount).toBeLessThan(10);
        });
    });
});
