/**
 * GridPanelComp - Grid Panel Cocos Component
 * Renders grid and handles touch interactions
 */

import { _decorator, Component, Node, Graphics, Label, Color, UITransform, EventTouch, Sprite, SpriteFrame } from 'cc';
import { GridManager } from '../core/GridManager';
import { ItemDB } from '../core/ItemDB';
import { GameLoop } from '../core/GameLoop';
import { IGridItem, IItemTemplate } from '../core/types';

const { ccclass, property } = _decorator;

@ccclass('GridPanelComp')
export class GridPanelComp extends Component {
    @property({ type: Number, tooltip: 'Cell gap in pixels' })
    public cellGap: number = 2;

    @property({ type: Color, tooltip: 'Grid background color' })
    public gridColor: Color = new Color(232, 245, 233, 255); // #E8F5E9

    @property({ type: Color, tooltip: 'Cell border color' })
    public borderColor: Color = new Color(200, 230, 201, 255); // #C8E6C9

    @property({ type: Color, tooltip: 'Selected border color' })
    public selectedBorderColor: Color = new Color(255, 193, 7, 255); // #FFC107

    @property({ type: Number, tooltip: 'Selected border width' })
    public selectedBorderWidth: number = 3;

    private gridManager: GridManager | null = null;
    private itemDB: ItemDB | null = null;
    private gameLoop: GameLoop | null = null;
    private cellNodes: Map<string, Node> = new Map();
    private selectedItemId: string | null = null;
    private cellSize: number = 50;
    private rows: number = 10;
    private cols: number = 10;

    /**
     * Initialize with dependencies
     */
    public init(gridManager: GridManager, itemDB: ItemDB, gameLoop: GameLoop): void {
        this.gridManager = gridManager;
        this.itemDB = itemDB;
        this.gameLoop = gameLoop;

        this.rows = gridManager.rows;
        this.cols = gridManager.cols;

        this.createCells();
    }

    /**
     * onLoad lifecycle - only create cells if not initialized
     */
    public onLoad(): void {
        // Only create cells if init hasn't been called yet
        if (!this.gridManager) {
            this.createCells();
        }
    }

    /**
     * Create grid cells
     */
    private createCells(): void {
        const containerWidth = this.node.getComponent(UITransform)?.width ?? 500;
        const containerHeight = this.node.getComponent(UITransform)?.height ?? 500;

        // Calculate cell size based on container
        this.cellSize = Math.floor(Math.min(
            (containerWidth - this.cellGap * (this.cols + 1)) / this.cols,
            (containerHeight - this.cellGap * (this.rows + 1)) / this.rows
        ));

        // Clear existing cells
        this.cellNodes.forEach(node => node.destroy());
        this.cellNodes.clear();

        // Create cells
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cellNode = this.createCellNode(row, col);
                this.node.addChild(cellNode);
                this.cellNodes.set(`${row},${col}`, cellNode);
            }
        }
    }

    /**
     * Create a single cell node
     */
    private createCellNode(row: number, col: number): Node {
        const cellNode = new Node(`cell_${row}_${col}`);

        // Add UITransform
        const transform: any = cellNode.addComponent(UITransform);
        transform.setContentSize(this.cellSize, this.cellSize);

        // Position (flip row so row 0 = bottom in visual)
        const visualRow = (this.rows - 1) - row;
        const x = this.cellGap + col * (this.cellSize + this.cellGap);
        const y = this.cellGap + visualRow * (this.cellSize + this.cellGap);
        cellNode.setPosition(x, -y, 0);

        // Add Graphics for background
        const graphics: any = cellNode.addComponent(Graphics);
        this.drawCellBackground(graphics, false);

        // Add Label for emoji
        const labelNode = new Node('label');
        const labelTransform: any = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(this.cellSize * 0.8, this.cellSize * 0.8);
        labelNode.setPosition(0, 0, 0);
        cellNode.addChild(labelNode);

        const label: any = labelNode.addComponent(Label);
        label.fontSize = Math.floor(this.cellSize * 0.6);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.string = '';

        // Add touch listener
        cellNode.on(EventTouch.TOUCH_END, () => this.onCellTouch(row, col), this);

        return cellNode;
    }

    /**
     * Draw cell background
     */
    private drawCellBackground(graphics: Graphics, selected: boolean): void {
        graphics.clear();
        
        const halfSize = this.cellSize / 2;
        
        // Draw rounded rectangle background
        const bgColor = selected ? this.selectedBorderColor : this.borderColor;
        graphics.fillColor = this.gridColor;
        graphics.roundRect(-halfSize, -halfSize, this.cellSize, this.cellSize, 4);
        graphics.fill();

        // Draw border
        graphics.strokeColor = selected ? this.selectedBorderColor : this.borderColor;
        graphics.lineWidth = selected ? this.selectedBorderWidth : 1;
        graphics.roundRect(-halfSize, -halfSize, this.cellSize, this.cellSize, 4);
        graphics.stroke();
    }

    /**
     * Refresh grid display
     */
    public refreshGrid(): void {
        if (!this.gridManager) return;

        const items = this.gridManager.getAllItems();

        // Clear all cells first
        this.cellNodes.forEach((node, key) => {
            const label = node.getChildByName('label')?.getComponent(Label);
            if (label) {
                label.string = '';
            }
            
            const graphics = node.getComponent(Graphics);
            if (graphics) {
                this.drawCellBackground(graphics, false);
            }
        });

        // Draw items
        for (const item of items) {
            const pos = item.position;
            const key = `${pos.row},${pos.col}`;
            const cellNode = this.cellNodes.get(key);

            if (cellNode) {
                // Get template for emoji and color
                const template = this.itemDB?.getTemplate(item.templateId);
                
                // Set emoji
                const label = cellNode.getChildByName('label')?.getComponent(Label);
                if (label && template) {
                    label.string = template.emoji || '';
                }

                // Set color
                const graphics = cellNode.getComponent(Graphics);
                if (graphics && template?.color) {
                    const color = this.parseHexColor(template.color);
                    graphics.fillColor = color;
                    graphics.roundRect(-this.cellSize/2, -this.cellSize/2, this.cellSize, this.cellSize, 4);
                    graphics.fill();

                    // Highlight if selected
                    if (this.selectedItemId === item.id) {
                        this.drawCellBackground(graphics, true);
                    }
                } else if (this.selectedItemId === item.id) {
                    // Handle selected without color
                    this.drawCellBackground(graphics!, true);
                }
            }
        }
    }

    /**
     * Parse hex color to Color
     */
    private parseHexColor(hex: string): Color {
        if (!hex || hex.length < 7) {
            return new Color(255, 255, 255, 255);
        }

        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        return new Color(r, g, b, 255);
    }

    /**
     * Handle cell touch
     */
    private onCellTouch(row: number, col: number): void {
        if (!this.gridManager || !this.gameLoop) return;

        // Get item at this position
        const itemAtPos = this.gridManager.getItemAt({ row, col });

        // If we have a selected item
        if (this.selectedItemId) {
            // If clicking on empty cell, try to move
            if (!itemAtPos) {
                const success = this.gameLoop.moveItem(this.selectedItemId, { row, col });
                if (success) {
                    this.selectedItemId = null;
                    this.refreshGrid();
                    return;
                }
            }

            // If clicking on same cell or same item, deselect
            const selectedItem = this.gridManager.itemsMap?.get(this.selectedItemId);
            if (selectedItem && selectedItem.position.row === row && selectedItem.position.col === col) {
                this.selectedItemId = null;
                this.refreshGrid();
                return;
            }

            // If clicking on different item, select that instead
            if (itemAtPos) {
                this.selectedItemId = itemAtPos;
                this.refreshGrid();
                return;
            }

            // Otherwise deselect
            this.selectedItemId = null;
            this.refreshGrid();
        } else {
            // No selection, select item if exists
            if (itemAtPos) {
                this.selectedItemId = itemAtPos;
                this.refreshGrid();
            }
        }
    }

    /**
     * Clear selection
     */
    public clearSelection(): void {
        this.selectedItemId = null;
        this.refreshGrid();
    }

    /**
     * Get selected item ID
     */
    public getSelectedItemId(): string | null {
        return this.selectedItemId;
    }

    /**
     * Update cell size
     */
    public setCellSize(size: number): void {
        this.cellSize = size;
        this.createCells();
        this.refreshGrid();
    }

    /**
     * Get cell size
     */
    public getCellSize(): number {
        return this.cellSize;
    }

    /**
     * Destroy
     */
    public onDestroy(): void {
        this.cellNodes.forEach(node => node.destroy());
        this.cellNodes.clear();
    }

    // ============= GridView Compatibility =============

    /**
     * Sync from GridView (for compatibility)
     */
    public syncFromGridView(gridView: any): void {
        this.refreshGrid();
    }
}
