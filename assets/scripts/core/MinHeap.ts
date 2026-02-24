/**
 * MinHeap - Generic Priority Queue (Min-Heap)
 * Pure TypeScript implementation, no external dependencies
 */

/**
 * Generic Min-Heap data structure
 */
export class MinHeap<T> {
    private heap: T[] = [];
    private compareFn: (a: T, b: T) => number;

    /**
     * @param compareFn - Comparison function: returns negative if a < b, positive if a > b, 0 if equal
     */
    constructor(compareFn: (a: T, b: T) => number) {
        this.compareFn = compareFn;
    }

    /**
     * Get number of elements
     */
    size(): number {
        return this.heap.length;
    }

    /**
     * Check if heap is empty
     */
    isEmpty(): boolean {
        return this.heap.length === 0;
    }

    /**
     * Insert element into heap
     */
    insert(value: T): void {
        this.heap.push(value);
        this.bubbleUp(this.heap.length - 1);
    }

    /**
     * Extract and return minimum element
     */
    extractMin(): T | undefined {
        if (this.isEmpty()) {
            return undefined;
        }

        const min = this.heap[0];
        const last = this.heap.pop();

        if (!this.isEmpty() && last !== undefined) {
            this.heap[0] = last;
            this.bubbleDown(0);
        }

        return min;
    }

    /**
     * Peek at minimum element without removing
     */
    peek(): T | undefined {
        return this.heap[0];
    }

    /**
     * Clear all elements
     */
    clear(): void {
        this.heap = [];
    }

    /**
     * Get all elements as array (not sorted)
     */
    toArray(): T[] {
        return [...this.heap];
    }

    /**
     * Bubble up element at index
     */
    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.compareFn(this.heap[index], this.heap[parentIndex]) >= 0) {
                break;
            }
            [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
            index = parentIndex;
        }
    }

    /**
     * Bubble down element at index
     */
    private bubbleDown(index: number): void {
        const length = this.heap.length;

        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let smallest = index;

            if (leftChild < length && this.compareFn(this.heap[leftChild], this.heap[smallest]) < 0) {
                smallest = leftChild;
            }

            if (rightChild < length && this.compareFn(this.heap[rightChild], this.heap[smallest]) < 0) {
                smallest = rightChild;
            }

            if (smallest === index) {
                break;
            }

            [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
            index = smallest;
        }
    }
}
