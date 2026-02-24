/**
 * GridManager 单元测试
 */
import { GridManager } from '../../assets/scripts/core/GridManager';
import { IGridItem, IGridPosition, IGridSize, ItemRarity, ItemSize } from '../../assets/scripts/core/types';

describe('GridManager', () => {
    let grid: GridManager;

    // Helper to create test items
    const createItem = (
        id: string, 
        row: number, 
        col: number, 
        rows: number = 1, 
        cols: number = 1
    ): IGridItem => ({
        id,
        templateId: `template_${id}`,
        name: `Item ${id}`,
        description: `Description for ${id}`,
        rarity: ItemRarity.Common,
        size: ItemSize.Small,
        gridSize: { rows, cols },
        position: { row, col },
        cooldown: 0,
        currentCooldown: 0,
        effects: [],
        level: 1,
        destroyed: false,
        enchantments: []
    });

    beforeEach(() => {
        // Use 4x4 grid for testing
        grid = new GridManager(4, 4);
    });

    describe('initGrid', () => {
        it('should create correct number of rows and cols', () => {
            expect(grid.rows).toBe(4);
            expect(grid.cols).toBe(4);
        });

        it('should initialize all cells as empty', () => {
            const items = grid.getAllItems();
            expect(items).toHaveLength(0);
            expect(grid.isEmpty()).toBe(true);
        });
    });

    describe('canPlace', () => {
        it('should allow 1x1 item at (0,0)', () => {
            const result = grid.canPlace({ rows: 1, cols: 1 }, { row: 0, col: 0 });
            expect(result).toBe(true);
        });

        it('should allow 2x1 item at top-right corner', () => {
            const result = grid.canPlace({ rows: 2, cols: 1 }, { row: 2, col: 3 });
            expect(result).toBe(true);
        });

        it('should allow 1x2 item at (0,3)', () => {
            const result = grid.canPlace({ rows: 1, cols: 2 }, { row: 0, col: 2 });
            expect(result).toBe(true);
        });

        it('should allow 2x2 item at (2,2)', () => {
            const result = grid.canPlace({ rows: 2, cols: 2 }, { row: 2, col: 2 });
            expect(result).toBe(true);
        });

        it('should reject placement out of bounds (right)', () => {
            const result = grid.canPlace({ rows: 1, cols: 1 }, { row: 0, col: 4 });
            expect(result).toBe(false);
        });

        it('should reject placement out of bounds (top)', () => {
            const result = grid.canPlace({ rows: 1, cols: 1 }, { row: 4, col: 0 });
            expect(result).toBe(false);
        });

        it('should reject 2x2 at (3,3) - out of bounds', () => {
            const result = grid.canPlace({ rows: 2, cols: 2 }, { row: 3, col: 3 });
            expect(result).toBe(false);
        });

        it('should reject negative position', () => {
            const result = grid.canPlace({ rows: 1, cols: 1 }, { row: -1, col: 0 });
            expect(result).toBe(false);
        });
    });

    describe('placeItem', () => {
        it('should place 1x1 item successfully', () => {
            const item = createItem('item1', 0, 0);
            const result = grid.placeItem(item);
            expect(result).toBe(true);
            expect(grid.getAllItems()).toHaveLength(1);
        });

        it('should reject overlapping items', () => {
            const item1 = createItem('item1', 0, 0);
            const item2 = createItem('item2', 0, 0); // Same position
            grid.placeItem(item1);
            const result = grid.placeItem(item2);
            expect(result).toBe(false);
            expect(grid.getAllItems()).toHaveLength(1);
        });

        it('should reject partial overlap', () => {
            const item1 = createItem('item1', 0, 0, 1, 2);
            const item2 = createItem('item2', 0, 1, 1, 2); // Overlaps at (0,1)
            grid.placeItem(item1);
            const result = grid.placeItem(item2);
            expect(result).toBe(false);
        });
    });

    describe('removeItem', () => {
        it('should remove item and free cells', () => {
            const item = createItem('item1', 1, 1);
            grid.placeItem(item);
            grid.removeItem('item1');
            expect(grid.getAllItems()).toHaveLength(0);
            expect(grid.getItemAt({ row: 1, col: 1 })).toBeNull();
        });

        it('should return removed item', () => {
            const item = createItem('item1', 2, 2);
            grid.placeItem(item);
            const removed = grid.removeItem('item1');
            expect(removed?.id).toBe('item1');
        });

        it('should return null for non-existent item', () => {
            const result = grid.removeItem('nonexistent');
            expect(result).toBeNull();
        });

        it('should allow placing after removal', () => {
            const item1 = createItem('item1', 0, 0);
            const item2 = createItem('item2', 0, 0);
            grid.placeItem(item1);
            grid.removeItem('item1');
            const result = grid.placeItem(item2);
            expect(result).toBe(true);
        });
    });

    describe('getAdjacentItems', () => {
        it('should find 8 neighbors for single item', () => {
            const item1 = createItem('item1', 1, 1);
            const item2 = createItem('item2', 0, 0);
            const item3 = createItem('item3', 0, 1);
            const item4 = createItem('item4', 0, 2);
            const item5 = createItem('item5', 1, 0);
            const item6 = createItem('item6', 1, 2);
            const item7 = createItem('item7', 2, 0);
            const item8 = createItem('item8', 2, 1);
            const item9 = createItem('item9', 2, 2);
            
            grid.placeItem(item1);
            grid.placeItem(item2);
            grid.placeItem(item3);
            grid.placeItem(item4);
            grid.placeItem(item5);
            grid.placeItem(item6);
            grid.placeItem(item7);
            grid.placeItem(item8);
            grid.placeItem(item9);

            const adjacent = grid.getAdjacentItems('item1');
            expect(adjacent).toHaveLength(8);
        });

        it('should find outer ring for 2x2 item', () => {
            // Place 2x2 item at center
            const bigItem = createItem('big', 1, 1, 2, 2);
            // Place surrounding items
            const n = createItem('n', 0, 1);
            const s = createItem('s', 3, 1);
            const e = createItem('e', 1, 3);
            const w = createItem('w', 1, 0);
            const ne = createItem('ne', 0, 3);
            const nw = createItem('nw', 0, 0);
            const se = createItem('se', 3, 3);
            const sw = createItem('sw', 3, 0);
            
            grid.placeItem(bigItem);
            grid.placeItem(n);
            grid.placeItem(s);
            grid.placeItem(e);
            grid.placeItem(w);
            grid.placeItem(ne);
            grid.placeItem(nw);
            grid.placeItem(se);
            grid.placeItem(sw);

            const adjacent = grid.getAdjacentItems('big');
            expect(adjacent).toHaveLength(8);
        });

        it('should allow mutual discovery between adjacent items', () => {
            const item1 = createItem('item1', 1, 1);
            const item2 = createItem('item2', 1, 2);
            
            grid.placeItem(item1);
            grid.placeItem(item2);

            const item1Adjacent = grid.getAdjacentItems('item1');
            const item2Adjacent = grid.getAdjacentItems('item2');

            expect(item1Adjacent).toContain('item2');
            expect(item2Adjacent).toContain('item1');
        });

        it('should return empty for item not on grid', () => {
            const result = grid.getAdjacentItems('nonexistent');
            expect(result).toEqual([]);
        });
    });

    describe('moveItem', () => {
        it('should move item to empty position', () => {
            const item = createItem('item1', 0, 0);
            grid.placeItem(item);
            const result = grid.moveItem('item1', { row: 2, col: 2 });
            expect(result).toBe(true);
            expect(grid.getItemAt({ row: 0, col: 0 })).toBeNull();
            expect(grid.getItemAt({ row: 2, col: 2 })).toBe('item1');
        });

        it('should rollback on failure', () => {
            const item1 = createItem('item1', 0, 0);
            const item2 = createItem('item2', 2, 2);
            grid.placeItem(item1);
            grid.placeItem(item2);
            
            // Try to move item1 to item2's position - should fail
            const result = grid.moveItem('item1', { row: 2, col: 2 });
            expect(result).toBe(false);
            
            // Should still be at original position
            expect(grid.getItemAt({ row: 0, col: 0 })).toBe('item1');
        });
    });

    describe('getItemAt', () => {
        it('should return item ID at position', () => {
            const item = createItem('item1', 1, 2);
            grid.placeItem(item);
            expect(grid.getItemAt({ row: 1, col: 2 })).toBe('item1');
        });

        it('should return null for empty cell', () => {
            expect(grid.getItemAt({ row: 0, col: 0 })).toBeNull();
        });

        it('should return null for out of bounds', () => {
            expect(grid.getItemAt({ row: 10, col: 10 })).toBeNull();
        });
    });
});
