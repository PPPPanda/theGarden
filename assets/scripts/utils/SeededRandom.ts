/**
 * SeededRandom - Deterministic Random Number Generator
 * Uses Mulberry32 algorithm for reproducible sequences
 * Does not depend on Cocos engine (pure TypeScript)
 */

/**
 * Seeded random number generator using Mulberry32 algorithm
 */
export class SeededRandom {
    private state: number;

    /**
     * @param seed - Initial seed value (uint32)
     */
    constructor(seed: number) {
        // Ensure seed is uint32
        this.state = (seed | 0) >>> 0;
    }

    /**
     * Generate next random number in [0, 1)
     */
    next(): number {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /**
     * Generate random integer in [min, max] (inclusive)
     */
    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /**
     * Generate random float in [min, max)
     */
    nextFloat(min: number, max: number): number {
        return this.next() * (max - min) + min;
    }

    /**
     * Pick a random element from array
     */
    pick<T>(array: T[]): T {
        if (array.length === 0) {
            throw new Error('Cannot pick from empty array');
        }
        return array[this.nextInt(0, array.length - 1)];
    }

    /**
     * Shuffle array using Fisher-Yates algorithm (returns new array)
     */
    shuffle<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}
