/**
 * GridManager - Pure Logic Grid System
 * Handles grid placement, removal, collision detection, and adjacency queries
 * Does not depend on Cocos engine (pure TypeScript)
 */

import { 
    IGridCell, 
    IGridItem, 
    IGridPosition, 
    IGridSize, 
    GRID_ROWS, 
    GRID_COLS 
} from './types';

/**
 * Grid Manager - handles grid-based item management
 */
export class GridManager {
    private _rows: number;
    private _cols: number;
    private cells: IGridCell[][];
    private items: Map<string, IGridItem>;

    /**
     * @param rows - Number of rows (default: GRID_ROWS)
     * @param cols - Number of columns (default: GRID_COLS)
     */
    constructor(rows: number = GRID_ROWS, cols: number = GRID_COLS) {
        this._rows = rows;
        this._cols = cols;
        this.cells = [];
        this.items = new Map();
        this.initGrid();
    }

    /** Get number of rows */
    get rows(): number {
        return this._rows;
    }

    /** Get number of columns */
    get cols(): number {
        return this._cols;
    }

    /** Get all cells */
    get gridCells(): IGridCell[][] {
        return this.cells;
    }

    /** Get items map */
    get itemsMap(): Map<string, IGridItem> {
        return this.items;
    }

    /**
     * Initialize empty grid
     */
    initGrid(): void {
        this.cells = [];
        for (let r = 0; r < this._rows; r++) {
            this.cells[r] = [];
            for (let c = 0; c < this._cols; c++) {
                this.cells[r][c] = {
                    position: { row: r, col: c },
                    occupied: false,
                    itemId: null
                };
            }
        }
    }

    /**
     * Check if item can be placed at position
     */
    canPlace(gridSize: IGridSize, position: IGridPosition): boolean {
        // Check bounds
        if (position.row < 0 || position.col < 0) {
            return false;
        }
        if (position.row + gridSize.rows > this._rows) {
            return false;
        }
        if (position.col + gridSize.cols > this._cols) {
            return false;
        }

        // Check collision with existing items
        for (let r = 0; r < gridSize.rows; r++) {
            for (let c = 0; c < gridSize.cols; c++) {
                const cell = this.cells[position.row + r][position.col + c];
                if (cell.occupied && cell.itemId !== null) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Place item on grid
     * @returns true if placement successful
     */
    placeItem(item: IGridItem): boolean {
        if (!this.canPlace(item.gridSize, item.position)) {
            return false;
        }

        // Mark cells as occupied
        for (let r = 0; r < item.gridSize.rows; r++) {
            for (let c = 0; c < item.gridSize.cols; c++) {
                const cell = this.cells[item.position.row + r][item.position.col + c];
                cell.occupied = true;
                cell.itemId = item.id;
            }
        }

        // Add to items map
        this.items.set(item.id, item);
        return true;
    }

    /**
     * Remove item from grid
     * @returns Removed item or null if not found
     */
    removeItem(itemId: string): IGridItem | null {
        const item = this.items.get(itemId);
        if (!item) {
            return null;
        }

        // Clear cells
        for (let r = 0; r < item.gridSize.rows; r++) {
            for (let c = 0; c < item.gridSize.cols; c++) {
                const cell = this.cells[item.position.row + r][item.position.col + c];
                cell.occupied = false;
                cell.itemId = null;
            }
        }

        // Remove from map
        this.items.delete(itemId);
        return item;
    }

    /**
     * Get adjacent items around an item (8-direction ring)
     * Returns all unique item IDs that are adjacent to the given item
     */
    getAdjacentItems(itemId: string): string[] {
        const item = this.items.get(itemId);
        if (!item) {
            return [];
        }

        // Calculate the bounding box of the item's occupied cells
        const minRow = item.position.row;
        const maxRow = item.position.row + item.gridSize.rows - 1;
        const minCol = item.position.col;
        const maxCol = item.position.col + item.gridSize.cols - 1;

        // Collect all cells in the expanded 8-direction ring (3x3 around each corner)
        const expandedMinRow = Math.max(0, minRow - 1);
        const expandedMaxRow = Math.min(this._rows - 1, maxRow + 1);
        const expandedMinCol = Math.max(0, minCol - 1);
        const expandedMaxCol = Math.min(this._cols - 1, maxCol + 1);

        const adjacentItemIds = new Set<string>();

        // Scan the expanded area
        for (let r = expandedMinRow; r <= expandedMaxRow; r++) {
            for (let c = expandedMinCol; c <= expandedMaxCol; c++) {
                // Skip if this cell is part of the original item
                if (r >= minRow && r <= maxRow && c >= minCol && c <= maxCol) {
                    continue;
                }

                const cell = this.cells[r][c];
                if (cell.occupied && cell.itemId !== null) {
                    adjacentItemIds.add(cell.itemId);
                }
            }
        }

        return Array.from(adjacentItemIds);
    }

    /**
     * Get item at specific position
     * @returns item ID or null if empty
     */
    getItemAt(pos: IGridPosition): string | null {
        if (pos.row < 0 || pos.row >= this._rows || pos.col < 0 || pos.col >= this._cols) {
            return null;
        }
        return this.cells[pos.row][pos.col].itemId;
    }

    /**
     * Get all items on grid
     */
    getAllItems(): IGridItem[] {
        return Array.from(this.items.values());
    }

    /**
     * Move item to new position
     * @returns true if move successful, false if failed (no rollback needed - atomic operation)
     */
    moveItem(itemId: string, newPos: IGridPosition): boolean {
        const item = this.items.get(itemId);
        if (!item) {
            return false;
        }

        // Save old position for potential rollback
        const oldPosition = { ...item.position };

        // Remove item first
        this.removeItem(itemId);

        // Try to place at new position
        if (!this.canPlace(item.gridSize, newPos)) {
            // Rollback: restore item to original position
            item.position = oldPosition;
            this.placeItem(item);
            return false;
        }

        // Update position and place
        item.position = newPos;
        this.placeItem(item);
        return true;
    }

    /**
     * Clear all items from grid
     */
    clear(): void {
        this.items.clear();
        this.initGrid();
    }

    /**
     * Check if grid is empty
     */
    isEmpty(): boolean {
        return this.items.size === 0;
    }

    /**
     * Get cell at position
     */
    getCell(pos: IGridPosition): IGridCell | null {
        if (pos.row < 0 || pos.row >= this._rows || pos.col < 0 || pos.col >= this._cols) {
            return null;
        }
        return this.cells[pos.row][pos.col];
    }
}
