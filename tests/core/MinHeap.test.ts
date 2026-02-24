/**
 * MinHeap 单元测试
 */
import { MinHeap } from '../../assets/scripts/core/MinHeap';

describe('MinHeap', () => {
    describe('basic operations', () => {
        it('should insert and extract in correct order', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            
            // Insert 10 random numbers
            const numbers = [5, 3, 8, 1, 9, 2, 7, 4, 6, 0];
            for (const num of numbers) {
                heap.insert(num);
            }

            // Extract should return sorted ascending
            const result: number[] = [];
            while (!heap.isEmpty()) {
                const val = heap.extractMin();
                if (val !== undefined) result.push(val);
            }

            expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        });

        it('should handle single element', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            heap.insert(42);
            expect(heap.extractMin()).toBe(42);
            expect(heap.isEmpty()).toBe(true);
        });

        it('should return undefined when empty', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            expect(heap.extractMin()).toBeUndefined();
            expect(heap.peek()).toBeUndefined();
        });

        it('should track size correctly', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            expect(heap.size()).toBe(0);
            
            heap.insert(1);
            heap.insert(2);
            expect(heap.size()).toBe(2);
            
            heap.extractMin();
            expect(heap.size()).toBe(1);
        });

        it('should peek without removing', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            heap.insert(5);
            heap.insert(3);
            heap.insert(8);
            
            expect(heap.peek()).toBe(3);
            expect(heap.size()).toBe(3); // Size unchanged
        });

        it('should clear all elements', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            heap.insert(1);
            heap.insert(2);
            heap.insert(3);
            
            heap.clear();
            expect(heap.isEmpty()).toBe(true);
            expect(heap.size()).toBe(0);
        });

        it('should handle duplicate values', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            heap.insert(5);
            heap.insert(3);
            heap.insert(5);
            heap.insert(3);
            
            const result: number[] = [];
            while (!heap.isEmpty()) {
                const val = heap.extractMin();
                if (val !== undefined) result.push(val);
            }
            
            expect(result).toEqual([3, 3, 5, 5]);
        });

        it('should work with custom objects', () => {
            interface Item {
                priority: number;
                id: string;
            }
            
            const heap = new MinHeap<Item>((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                return a.id.localeCompare(b.id);
            });
            
            heap.insert({ priority: 3, id: 'a' });
            heap.insert({ priority: 1, id: 'b' });
            heap.insert({ priority: 2, id: 'c' });
            
            expect(heap.extractMin()?.id).toBe('b');
            expect(heap.extractMin()?.id).toBe('c');
            expect(heap.extractMin()?.id).toBe('a');
        });

        it('should handle negative numbers', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            heap.insert(-5);
            heap.insert(10);
            heap.insert(0);
            heap.insert(-1);
            
            const result: number[] = [];
            while (!heap.isEmpty()) {
                const val = heap.extractMin();
                if (val !== undefined) result.push(val);
            }
            
            expect(result).toEqual([-5, -1, 0, 10]);
        });

        it('should handle large numbers', () => {
            const heap = new MinHeap<number>((a, b) => a - b);
            heap.insert(1000000);
            heap.insert(-1000000);
            heap.insert(0);
            
            expect(heap.extractMin()).toBe(-1000000);
            expect(heap.extractMin()).toBe(0);
            expect(heap.extractMin()).toBe(1000000);
        });
    });
});
