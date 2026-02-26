/**
 * GridPanelComp - Grid Panel Cocos Component
 * Renders 10x10 grid using Sprite nodes with proper typing
 */

import { _decorator, Component, Node, Sprite, Label, Color, UITransform, EventTouch, Vec3 } from 'cc';
import { GridManager } from '../core/GridManager';
import { ItemDB } from '../core/ItemDB';
import { GameLoop } from '../core/GameLoop';
import { GridView } from './GridView';
import { IGridItem, IItemTemplate, IGridPosition } from '../core/types';

const { ccclass, property } = _decorator;

@ccclass('GridPanelComp')
export class GridPanelComp extends Component {
    // ============= Layout Properties =============

    @property({ type: Number, tooltip: 'Cell gap in pixels' })
    public cellGap: number = 2;

    @property({ type: Number, tooltip: 'Cell size in pixels (0 = auto)' })
    public cellSize: number = 0;

    @property({ type: Node, tooltip: 'Container node for grid cells' })
    public container: Node | null = null;

    @property({ type: Node, tooltip: 'Cell prefab for instantiation' })
    public cellPrefab: Node | null = null;

    // ============= Color Properties =============

    @property({ type: Color, tooltip: 'Empty cell background color' })
    public emptyColor: Color = new Color(232, 245, 233, 255); // #E8F5E9

    @property({ type: Color, tooltip: 'Occupied cell background color' })
    public occupiedColor: Color = new Color(200, 230, 201, 255); // #C8E6C9

    @property({ type: Color, tooltip: 'Selected border color' })
    public selectedBorderColor: Color = new Color(255, 193, 7, 255); // #FFC107

    @property({ type: Number, tooltip: 'Selected border width' })
    public selectedBorderWidth: number = 3;

    // ============= Private Fields =============

    private gridManager: GridManager | null = null;
    private itemDB: ItemDB | null = null;
    private gameLoop: GameLoop | null = null;
    private gridView: GridView | null = null;
    private cellNodes: Map<string, Node> = new Map();
    private cellPool: Node[] = [];  // Node pool for reuse
    private selectedItemId: string | null = null;
    private actualCellSize: number = 50;
    private rows: number = 10;
    private cols: number = 10;

    // ============= Drag State =============

    /** Whether currently dragging from shop */
    private isDraggingFromShop: boolean = false;

    /** Shop item being dragged (templateId, slotIndex) */
    private draggedShopItem: { templateId: string; slotIndex: number } | null = null;

    /** Currently hovered cell for drop feedback */
    private hoveredCell: { row: number; col: number } | null = null;

    /** Dragged item node (visual feedback) */
    private dragPreviewNode: Node | null = null;

    /** Valid drop target color */
    @property({ type: Color, tooltip: 'Valid drop target color' })
    public validDropColor: Color = new Color(144, 238, 144, 150); // light green

    /** Invalid drop target color */
    @property({ type: Color, tooltip: 'Invalid drop target color' })
    public invalidDropColor: Color = new Color(255, 182, 193, 150); // light pink

    // ============= Callbacks =============

    /** Callback for shop item drop on grid */
    private onShopItemDropCallback: ((templateId: string, slotIndex: number, position: IGridPosition) => boolean) | null = null;

    /**
     * Set callback for shop item being dropped on grid
     */
    public setOnShopItemDrop(callback: (templateId: string, slotIndex: number, position: IGridPosition) => boolean): void {
        this.onShopItemDropCallback = callback;
    }

    /**
     * Start dragging from shop
     */
    public startDragFromShop(templateId: string, slotIndex: number, touchPos: Vec3): void {
        this.isDraggingFromShop = true;
        this.draggedShopItem = { templateId, slotIndex };
        this.createDragPreview(templateId, touchPos);
    }

    /**
     * Create drag preview node
     */
    private createDragPreview(templateId: string, touchPos: Vec3): void {
        if (this.dragPreviewNode) {
            this.dragPreviewNode.destroy();
        }

        // Create preview node
        this.dragPreviewNode = new Node('dragPreview');
        const transform = this.dragPreviewNode.addComponent(UITransform);
        transform.setContentSize(this.actualCellSize, this.actualCellSize);
        this.dragPreviewNode.setPosition(touchPos);

        // Add sprite
        const sprite = this.dragPreviewNode.addComponent(Sprite);
        const template = this.itemDB?.getTemplate(templateId);
        if (template?.color) {
            sprite.color = this.parseHexColor(template.color);
        } else {
            sprite.color = this.occupiedColor;
        }

        // Add emoji label
        const labelNode = new Node('label');
        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(this.actualCellSize * 0.8, this.actualCellSize * 0.8);
        labelNode.setPosition(0, 0, 0);
        this.dragPreviewNode.addChild(labelNode);

        const label = labelNode.addComponent(Label);
        label.fontSize = Math.floor(this.actualCellSize * 0.6);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.string = template?.emoji ?? '?';

        // Add to this node's parent (above everything)
        this.node.addChild(this.dragPreviewNode);
    }

    /**
     * Update drag preview position
     */
    private updateDragPreview(touchPos: Vec3): void {
        if (this.dragPreviewNode) {
            this.dragPreviewNode.setPosition(touchPos);
        }
    }

    /**
     * End drag operation
     */
    public endDrag(dropPosition: IGridPosition | null): void {
        if (!this.isDraggingFromShop || !this.draggedShopItem) {
            this.cancelDrag();
            return;
        }

        // Try to place item (only if not already occupied)
        if (dropPosition) {
            const itemAtPos = this.gridManager?.getItemAt(dropPosition);
            if (itemAtPos) {
                // Cell occupied - cannot drop
                this.cancelDrag();
                return;
            }

            if (this.onShopItemDropCallback) {
                const success = this.onShopItemDropCallback(
                    this.draggedShopItem.templateId,
                    this.draggedShopItem.slotIndex,
                    dropPosition
                );
                if (success) {
                    this.refreshGrid();
                }
            }
        }

        this.cancelDrag();
    }

    /**
     * Cancel drag operation
     */
    private cancelDrag(): void {
        this.isDraggingFromShop = false;
        this.draggedShopItem = null;
        this.clearHoverEffect();
        if (this.dragPreviewNode) {
            this.dragPreviewNode.destroy();
            this.dragPreviewNode = null;
        }
    }

    /**
     * Get cell position from world/touch position
     */
    public getCellFromPosition(worldPos: Vec3): IGridPosition | null {
        const localPos = this.node.worldPosition;
        const containerTransform = this.container?.getComponent(UITransform) ?? this.node.getComponent(UITransform);
        if (!containerTransform) return null;

        // Convert to local coordinates
        const x = worldPos.x - localPos.x;
        const y = worldPos.y - localPos.y;

        // Calculate cell coordinates
        const col = Math.floor(x / (this.actualCellSize + this.cellGap));
        const row = (this.rows - 1) - Math.floor(y / (this.actualCellSize + this.cellGap));

        // Check bounds
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
            return { row, col };
        }
        return null;
    }

    /**
     * Set hover effect on cell
     */
    private setHoverEffect(row: number, col: number, isValid: boolean): void {
        this.clearHoverEffect();

        const key = `${row},${col}`;
        const cellNode = this.cellNodes.get(key);
        if (!cellNode) return;

        this.hoveredCell = { row, col };
        const sprite = cellNode.getComponent(Sprite);
        if (sprite) {
            sprite.color = isValid ? this.validDropColor : this.invalidDropColor;
        }
    }

    /**
     * Clear hover effect
     */
    private clearHoverEffect(): void {
        if (this.hoveredCell) {
            const key = `${this.hoveredCell.row},${this.hoveredCell.col}`;
            const cellNode = this.cellNodes.get(key);
            if (cellNode) {
                // Reset to appropriate color based on item presence
                const pos = { row: this.hoveredCell.row, col: this.hoveredCell.col };
                const itemId = this.gridManager?.getItemAt(pos);
                if (itemId && this.gridManager?.itemsMap) {
                    const item = this.gridManager.itemsMap.get(itemId);
                    if (item) {
                        this.setCellOccupied(cellNode, item);
                    }
                } else {
                    this.setCellEmpty(cellNode);
                }
            }
            this.hoveredCell = null;
        }
    }

    // ============= Initialization =============

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
     * Initialize with GridView (for compatibility)
     */
    public initWithGridView(gridView: GridView): void {
        this.gridView = gridView;
        this.gridManager = gridView.getGridManager();
        // Get itemDB from gameLoop if available
        this.rows = this.gridManager?.rows ?? 10;
        this.cols = this.gridManager?.cols ?? 10;
        this.createCells();
    }

    /**
     * onLoad lifecycle
     */
    public onLoad(): void {
        if (!this.gridManager && !this.gridView) {
            this.createCells();
        }
    }

    // ============= Cell Creation =============

    /**
     * Create grid cells using Sprite nodes with node pool
     */
    private createCells(): void {
        const targetContainer = this.container ?? this.node;
        
        // Calculate cell size
        if (this.cellSize > 0) {
            this.actualCellSize = this.cellSize;
        } else {
            const containerWidth = targetContainer.getComponent(UITransform)?.width ?? 500;
            const containerHeight = targetContainer.getComponent(UITransform)?.height ?? 500;
            this.actualCellSize = Math.floor(Math.min(
                (containerWidth - this.cellGap * (this.cols + 1)) / this.cols,
                (containerHeight - this.cellGap * (this.rows + 1)) / this.rows
            ));
        }

        // First, hide all existing cells
        this.cellNodes.forEach((node) => {
            node.active = false;
        });
        
        // Reuse or create cells
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const key = `${row},${col}`;
                let cellNode: Node | undefined = this.cellNodes.get(key);
                
                if (!cellNode) {
                    // Try to get from pool
                    if (this.cellPool.length > 0) {
                        cellNode = this.cellPool.pop()!;
                        this.updateCellPosition(cellNode, row, col);
                    } else {
                        // Create new if pool empty
                        cellNode = this.createCellNode(row, col);
                    }
                    targetContainer.addChild(cellNode);
                    this.cellNodes.set(key, cellNode);
                }
                
                // Reactivate and update position
                cellNode.active = true;
                this.updateCellPosition(cellNode, row, col);
            }
        }
        
        // Recycle excess nodes to pool
        this.cellNodes.forEach((node, key) => {
            const [r, c] = key.split(',').map(Number);
            if (r >= this.rows || c >= this.cols) {
                node.active = false;
                this.cellPool.push(node);
                this.cellNodes.delete(key);
            }
        });
    }

    /**
     * Update cell position
     */
    private updateCellPosition(cellNode: Node, row: number, col: number): void {
        const visualRow = (this.rows - 1) - row;
        const x = this.cellGap + col * (this.actualCellSize + this.cellGap);
        const y = this.cellGap + visualRow * (this.actualCellSize + this.cellGap);
        cellNode.setPosition(x, -y, 0);
    }

    /**
     * Create a single cell node using Sprite or prefab
     */
    private createCellNode(row: number, col: number): Node {
        let cellNode: Node;

        // Use prefab if available
        if (this.cellPrefab) {
            cellNode = this.cellPrefab.clone();
            cellNode.name = `cell_${row}_${col}`;
        } else {
            // Create new node with Sprite
            cellNode = new Node(`cell_${row}_${col}`);
            
            // Add UITransform
            const transform = cellNode.addComponent(UITransform);
            transform.setContentSize(this.actualCellSize, this.actualCellSize);

            // Add Sprite component
            const sprite = cellNode.addComponent(Sprite);
            // Sprite color will be set in refreshGrid
        }

        // Position (flip row so row 0 = bottom in visual)
        const visualRow = (this.rows - 1) - row;
        const x = this.cellGap + col * (this.actualCellSize + this.cellGap);
        const y = this.cellGap + visualRow * (this.actualCellSize + this.cellGap);
        cellNode.setPosition(x, -y, 0);

        // Add Label for emoji
        const labelNode = new Node('label');
        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(this.actualCellSize * 0.8, this.actualCellSize * 0.8);
        labelNode.setPosition(0, 0, 0);
        cellNode.addChild(labelNode);

        const label = labelNode.addComponent(Label);
        label.fontSize = Math.floor(this.actualCellSize * 0.6);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.string = '';

        // Add touch listener for cell interaction and drag handling
        cellNode.on(EventTouch.TOUCH_START, (event: EventTouch) => this.onCellTouchStart(event, row, col), this);
        cellNode.on(EventTouch.TOUCH_MOVE, (event: EventTouch) => this.onCellTouchMove(event, row, col), this);
        cellNode.on(EventTouch.TOUCH_END, (event: EventTouch) => this.onCellTouchEnd(event, row, col), this);

        return cellNode;
    }

    // ============= Grid Refresh =============

    /**
     * Refresh grid display
     */
    public refreshGrid(): void {
        if (!this.gridManager) return;

        const items = this.gridManager.getAllItems();

        // Reset all cells to empty
        this.cellNodes.forEach((node) => {
            this.setCellEmpty(node);
        });

        // Draw items
        for (const item of items) {
            const pos = item.position;
            const key = `${pos.row},${pos.col}`;
            const cellNode = this.cellNodes.get(key);

            if (cellNode && item) {
                this.setCellOccupied(cellNode, item);
            }
        }
    }

    /**
     * Set cell to empty state
     */
    private setCellEmpty(node: Node): void {
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            sprite.color = this.emptyColor;
        }
        
        const label = node.getChildByName('label')?.getComponent(Label);
        if (label) {
            label.string = '';
        }
    }

    /**
     * Set cell to occupied state with item
     */
    private setCellOccupied(node: Node, item: IGridItem): void {
        // Get template for color and emoji
        const template = this.itemDB?.getTemplate(item.templateId);
        
        // Set sprite color
        const sprite = node.getComponent(Sprite);
        if (sprite && template?.color) {
            sprite.color = this.parseHexColor(template.color);
        } else if (sprite) {
            sprite.color = this.occupiedColor;
        }

        // Set emoji label
        const label = node.getChildByName('label')?.getComponent(Label);
        if (label && template?.emoji) {
            label.string = template.emoji;
        }
    }

    /**
     * Parse hex color
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

    // ============= Touch Handling =============

    /**
     * Handle cell touch start
     */
    private onCellTouchStart(event: EventTouch, row: number, col: number): void {
        if (this.isDraggingFromShop) {
            // Check if this cell is valid drop target
            const pos = { row, col };
            const itemAtPos = this.gridManager?.getItemAt(pos);
            const isValid = !itemAtPos;
            this.setHoverEffect(row, col, isValid);
            event.propagationStopped = true;
        } else {
            this.onCellTouch(row, col);
        }
    }

    /**
     * Handle cell touch move (for hover feedback during drag)
     */
    private onCellTouchMove(event: EventTouch, row: number, col: number): void {
        if (this.isDraggingFromShop) {
            // Update hover feedback
            const pos = { row, col };
            const itemAtPos = this.gridManager?.getItemAt(pos);
            const isValid = !itemAtPos;
            this.setHoverEffect(row, col, isValid);

            // Update drag preview position
            const touchPos = event.getUILocation();
            this.updateDragPreview(new Vec3(touchPos.x, touchPos.y, 0));
            event.propagationStopped = true;
        }
    }

    /**
     * Handle cell touch end
     */
    private onCellTouchEnd(event: EventTouch, row: number, col: number): void {
        if (this.isDraggingFromShop) {
            // Attempt to drop
            const pos = { row, col };
            const itemAtPos = this.gridManager?.getItemAt(pos);

            if (!itemAtPos) {
                // Valid drop position
                this.endDrag(pos);
            } else {
                // Invalid - occupied
                this.cancelDrag();
            }
            event.propagationStopped = true;
        } else {
            // Normal cell tap handled in onCellTouch
        }
    }

    /**
     * Handle cell tap (original logic)
     */
    private onCellTouch(row: number, col: number): void {
        if (!this.gridManager || !this.gameLoop) return;

        const itemAtPos = this.gridManager.getItemAt({ row, col });

        if (this.selectedItemId) {
            // Try to move to empty cell
            if (!itemAtPos) {
                const success = this.gameLoop.moveItem(this.selectedItemId, { row, col });
                if (success) {
                    this.selectedItemId = null;
                    this.refreshGrid();
                    return;
                }
            }

            // Deselect or select different
            const selectedItem = this.gridManager.itemsMap?.get(this.selectedItemId);
            if (selectedItem && selectedItem.position.row === row && selectedItem.position.col === col) {
                this.selectedItemId = null;
                this.refreshGrid();
                return;
            }

            if (itemAtPos) {
                this.selectedItemId = itemAtPos;
                this.refreshGrid();
                return;
            }

            this.selectedItemId = null;
            this.refreshGrid();
        } else {
            if (itemAtPos) {
                this.selectedItemId = itemAtPos;
                this.refreshGrid();
            }
        }
    }

    // ============= Public API =============

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
     * Set cell size
     */
    public setCellSize(size: number): void {
        this.actualCellSize = size;
        this.createCells();
        this.refreshGrid();
    }

    /**
     * Get cell size
     */
    public getCellSize(): number {
        return this.actualCellSize;
    }

    /**
     * Get grid manager
     */
    public getGridManager(): GridManager | null {
        return this.gridManager;
    }

    /**
     * Destroy
     */
    public onDestroy(): void {
        this.cancelDrag();
        this.cellNodes.forEach(node => node.destroy());
        this.cellNodes.clear();
        this.cellPool.forEach(node => node.destroy());
        this.cellPool = [];
    }

    // ============= GridView Compatibility =============

    /**
     * Sync from GridView (properly typed)
     */
    public syncFromGridView(gridView: GridView): void {
        this.gridView = gridView;
        this.gridManager = gridView.getGridManager();
        this.refreshGrid();
    }
}
