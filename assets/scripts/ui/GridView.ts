/**
 * GridView - Grid UI Component
 * Displays grid and handles user interactions
 * Adapts to new GridManager interface
 */

import { IGridItem, IGridPosition, IGridSize, ItemRarity, ItemSize } from '../core/types';
import { GridManager } from '../core/GridManager';

interface GridCellView {
    x: number;
    y: number;
    width: number;
    height: number;
    itemId: string | null;
    itemTemplateId: string | null;
    rarity: ItemRarity | null;
    emoji: string | null;
    color: string | null;
}

/**
 * Grid View - renders and interacts with grid
 */
export class GridView {
    private gridManager: GridManager;
    private cellSize: number = 50;
    private offsetX: number = 0;
    private offsetY: number = 0;
    private container: any = null; // Cocos Node reference
    private cellViews: Map<string, any> = new Map(); // cell position -> view node

    /**
     * @param gridManager - Grid manager instance
     * @param cellSize - Size of each cell in pixels
     */
    constructor(gridManager: GridManager, cellSize: number = 50) {
        this.gridManager = gridManager;
        this.cellSize = cellSize;
    }

    /**
     * Initialize the view
     */
    public init(): void {
        this.render();
    }

    /**
     * Render the grid
     */
    public render(): void {
        // In a real implementation, this would create Cocos nodes
        // For now, we prepare the view data structure
        this.cellViews.clear();
        
        const rows = this.gridManager.rows;
        const cols = this.gridManager.cols;
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const posKey = `${r},${c}`;
                const cell = this.gridManager.getCell({ row: r, col: c });
                
                if (cell) {
                    const viewData: GridCellView = {
                        x: this.offsetX + c * this.cellSize,
                        y: this.offsetY + r * this.cellSize,
                        width: this.cellSize,
                        height: this.cellSize,
                        itemId: cell.itemId,
                        itemTemplateId: null,
                        rarity: null,
                        emoji: null,
                        color: null
                    };
                    this.cellViews.set(posKey, viewData);
                }
            }
        }
    }

    /**
     * Update a specific cell
     */
    public updateCell(row: number, col: number): void {
        const posKey = `${row},${col}`;
        const cell = this.gridManager.getCell({ row, col });
        
        if (cell && this.cellViews.has(posKey)) {
            const viewData = this.cellViews.get(posKey)!;
            viewData.itemId = cell.itemId;
            viewData.itemTemplateId = null;
            viewData.rarity = null;
            viewData.emoji = null;
            viewData.color = null;
        }
    }

    /**
     * Refresh entire grid
     */
    public refresh(): void {
        this.render();
    }

    /**
     * Get cell position from screen coordinates
     */
    public screenToGrid(screenX: number, screenY: number): IGridPosition | null {
        const col = Math.floor((screenX - this.offsetX) / this.cellSize);
        const row = Math.floor((screenY - this.offsetY) / this.cellSize);
        
        if (row >= 0 && row < this.gridManager.rows && 
            col >= 0 && col < this.gridManager.cols) {
            return { row, col };
        }
        
        return null;
    }

    /**
     * Get screen position from grid coordinates
     */
    public gridToScreen(gridPos: IGridPosition): { x: number, y: number } {
        return {
            x: this.offsetX + gridPos.col * this.cellSize,
            y: this.offsetY + gridPos.row * this.cellSize
        };
    }

    /**
     * Check if position is valid
     */
    public isValidPosition(pos: IGridPosition): boolean {
        return pos.row >= 0 && pos.row < this.gridManager.rows &&
               pos.col >= 0 && pos.col < this.gridManager.cols;
    }

    /**
     * Get grid manager
     */
    public getGridManager(): GridManager {
        return this.gridManager;
    }

    /**
     * Set cell size
     */
    public setCellSize(size: number): void {
        this.cellSize = size;
        this.render();
    }

    /**
     * Get cell size
     */
    public getCellSize(): number {
        return this.cellSize;
    }

    /**
     * Set offset
     */
    public setOffset(x: number, y: number): void {
        this.offsetX = x;
        this.offsetY = y;
        this.render();
    }

    /**
     * Get all cell views
     */
    public getCellViews(): Map<string, GridCellView> {
        return this.cellViews;
    }

    /**
     * Get cell view at position
     */
    public getCellView(row: number, col: number): GridCellView | null {
        return this.cellViews.get(`${row},${col}`) ?? null;
    }

    /**
     * Highlight a cell
     */
    public highlightCell(row: number, col: number, highlight: boolean): void {
        // In real implementation, would change visual state
    }

    /**
     * Show placement preview
     */
    public showPlacementPreview(gridSize: IGridSize, position: IGridPosition, valid: boolean): void {
        // In real implementation, would show ghost preview
    }

    /**
     * Clear placement preview
     */
    public clearPlacementPreview(): void {
        // In real implementation, would clear ghost preview
    }

    /**
     * Destroy the view
     */
    public destroy(): void {
        this.cellViews.clear();
        this.container = null;
    }
}
