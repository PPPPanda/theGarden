/**
 * GridPanelComp - Grid Panel Cocos Component
 * Renders 10x10 grid using Sprite nodes with proper typing.
 * All drag logic is delegated to GridDragController.
 */

import { _decorator, Component, Node, Sprite, Label, Color, UITransform, Vec3, input, CCFloat, Graphics } from 'cc';
import { GridManager } from '../core/GridManager';
import { ItemDB } from '../core/ItemDB';
import { GameLoop } from '../core/GameLoop';
import { GridView } from './GridView';
import { IGridItem, IGridPosition } from '../core/types';
import { GridDragController, DragType } from './drag/GridDragController';

const { ccclass, property } = _decorator;

@ccclass('GridPanelComp')
export class GridPanelComp extends Component {
    // ============= Layout Properties =============

    @property({ type: CCFloat, tooltip: 'Cell gap in pixels' })
    public cellGap: number = 2;

    @property({ type: CCFloat, tooltip: 'Cell size in pixels (0 = auto)' })
    public cellSize: number = 0;

    @property({ type: Node, tooltip: 'Container node for grid cells' })
    public container: Node | null = null;

    @property({ type: Node, tooltip: 'Cell prefab for instantiation' })
    public cellPrefab: Node | null = null;

    // ============= Color Properties =============

    @property({ type: Color, tooltip: 'Empty cell background color' })
    public emptyColor: Color = new Color(232, 245, 233, 255);

    @property({ type: Color, tooltip: 'Occupied cell background color' })
    public occupiedColor: Color = new Color(200, 230, 201, 255);

    @property({ type: Color, tooltip: 'Selected border color' })
    public selectedBorderColor: Color = new Color(255, 193, 7, 255);

    @property({ type: CCFloat, tooltip: 'Selected border width' })
    public selectedBorderWidth: number = 3;

    @property({ type: Color, tooltip: 'Valid drop target color' })
    public validDropColor: Color = new Color(144, 238, 144, 150);

    @property({ type: Color, tooltip: 'Invalid drop target color' })
    public invalidDropColor: Color = new Color(255, 182, 193, 150);

    // ============= Private Fields =============

    private gridManager: GridManager | null = null;
    private itemDB: ItemDB | null = null;
    private gameLoop: GameLoop | null = null;
    private gridView: GridView | null = null;
    private cellNodes: Map<string, Node> = new Map();
    private cellPool: Node[] = [];
    private selectedItemId: string | null = null;
    private actualCellSize: number = 50;
    private rows: number = 10;
    private cols: number = 10;
    private dragController: GridDragController | null = null;

    // ============= Callbacks =============

    private onShopItemDropCallback: ((templateId: string, slotIndex: number, position: IGridPosition) => boolean) | null = null;

    public setOnShopItemDrop(callback: (templateId: string, slotIndex: number, position: IGridPosition) => boolean): void {
        this.onShopItemDropCallback = callback;
    }

    // ============= Public Drag API =============

    /** Called by ShopPanel to initiate a shop→grid drag */
    public startDragFromShop(templateId: string, slotIndex: number, touchPos: Vec3): void {
        this.dragController?.startDragFromShop(templateId, slotIndex, touchPos);
    }

    /** Get cell position from world/touch position */
    public getCellFromPosition(worldPos: Vec3): IGridPosition | null {
        const containerNode = this.container ?? this.node;
        if (this.dragController) {
            return this.dragController.getCellFromPosition(worldPos, containerNode);
        }
        return this.getCellFromPositionLocal(worldPos);
    }

    // ============= Initialization =============

    public init(gridManager: GridManager, itemDB: ItemDB, gameLoop: GameLoop): void {
        this.gridManager = gridManager;
        this.itemDB = itemDB;
        this.gameLoop = gameLoop;
        this.rows = gridManager.rows;
        this.cols = gridManager.cols;
        this.createCells();
        this.initDragController();
    }

    public initWithGridView(gridView: GridView): void {
        this.gridView = gridView;
        this.gridManager = gridView.getGridManager();
        this.rows = this.gridManager?.rows ?? 10;
        this.cols = this.gridManager?.cols ?? 10;
        this.createCells();
        this.initDragController();
    }

    public onLoad(): void {
        // Draw panel background
        this.drawPanelBackground();
        
        if (!this.gridManager && !this.gridView) {
            this.createCells();
        }
    }

    /**
     * Draw panel background using Graphics
     */
    private drawPanelBackground(): void {
        const graphics = this.node.getComponent(Graphics);
        if (!graphics) return;
        
        const transform = this.node.getComponent(UITransform);
        if (!transform) return;
        
        const size = transform.contentSize;
        const w = size.width;
        const h = size.height;
        
        // Draw light green background for Grid stage
        graphics.clear(false);
        graphics.fillColor = new Color(232, 245, 233, 200); // #E8F5E9 light green
        graphics.rect(-w / 2, -h / 2, w, h);
        graphics.fill();
    }

    private initDragController(): void {
        this.dragController = new GridDragController(
            this.actualCellSize, this.cellGap, this.rows, this.cols,
            this.validDropColor, this.invalidDropColor, this.occupiedColor
        );

        this.dragController.setGetItemAtPosition((pos: IGridPosition) => {
            return this.gridManager?.getItemAt(pos) ?? null;
        });

        this.dragController.setGetItemTemplate((itemId: string) => {
            // itemId may be a templateId (from shop) or actual itemId (from grid)
            const template = this.itemDB?.getTemplate(itemId);
            if (template) return template;
            // Lookup by itemId → get templateId from item
            const item = this.gridManager?.itemsMap?.get(itemId);
            if (item) return this.itemDB?.getTemplate(item.templateId) ?? null;
            return null;
        });

        this.dragController.setHoverCallbacks(
            (row, col, isValid) => this.setHoverEffect(row, col, isValid),
            () => this.clearHoverEffect()
        );

        this.dragController.setDropCallback((type, itemId, templateId, slotIndex, position) => {
            if (type === DragType.FromShop && templateId && slotIndex !== null) {
                const itemAtPos = this.gridManager?.getItemAt(position);
                if (itemAtPos) return false;
                if (this.onShopItemDropCallback) {
                    const success = this.onShopItemDropCallback(templateId, slotIndex, position);
                    if (success) this.refreshGrid();
                    return success;
                }
                return false;
            }
            if (type === DragType.InGrid && itemId && this.gameLoop) {
                const itemAtPos = this.gridManager?.getItemAt(position);
                if (itemAtPos) return false;
                const success = this.gameLoop.moveItem(itemId, position);
                if (success) this.refreshGrid();
                return success;
            }
            return false;
        });

        // Register global touch listeners for drag
        this.setupTouchListeners();
    }

    private setupTouchListeners(): void {
        if (input) {
            input.on('touchstart', this.onTouchStart, this);
            input.on('touchmove', this.onTouchMove, this);
            input.on('touchend', this.onTouchEnd, this);
        }
    }

    private removeTouchListeners(): void {
        if (input) {
            input.off('touchstart', this.onTouchStart, this);
            input.off('touchmove', this.onTouchMove, this);
            input.off('touchend', this.onTouchEnd, this);
        }
    }

    // ============= Touch Handlers (delegate to controller) =============

    private touchStartPos: Vec3 | null = null;
    private touchStartCell: IGridPosition | null = null;

    private onTouchStart(event: any): void {
        if (!event) return;
        const touch = event.touch;
        if (!touch) return;
        const loc = touch.getLocation();
        const pos = new Vec3(loc.x, loc.y, 0);
        this.touchStartPos = pos;
        this.touchStartCell = this.getCellFromPosition(pos);

        // If touch is on a grid item, record for potential drag
        if (this.touchStartCell && this.gridManager) {
            const itemId = this.gridManager.getItemAt(this.touchStartCell);
            if (itemId) {
                // Potential grid drag — controller will start on threshold
            }
        }
    }

    private onTouchMove(event: any): void {
        if (!event) return;
        const touch = event.touch;
        if (!touch) return;
        const loc = touch.getLocation();
        const pos = new Vec3(loc.x, loc.y, 0);
        const controller = this.dragController;
        if (!controller) return;

        // If already dragging (shop or grid), update
        if (controller.isDragging()) {
            const containerNode = this.container ?? this.node;
            controller.updateDrag(pos, (p) => controller.getCellFromPosition(p, containerNode));
            return;
        }

        // Check drag threshold to start grid drag
        if (this.touchStartPos && this.touchStartCell) {
            const dx = pos.x - this.touchStartPos.x;
            const dy = pos.y - this.touchStartPos.y;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                const itemId = this.gridManager?.getItemAt(this.touchStartCell);
                if (itemId) {
                    controller.startGridDrag(itemId, this.touchStartCell, pos);
                    // Add preview to scene
                    const previewNode = controller.getDragPreviewNode();
                    if (previewNode) {
                        this.node.addChild(previewNode);
                    }
                }
            }
        }
    }

    private onTouchEnd(event: any): void {
        if (!event) return;
        const touch = event.touch;
        if (!touch) return;
        const loc = touch.getLocation();
        const pos = new Vec3(loc.x, loc.y, 0);
        const controller = this.dragController;

        if (controller?.isDragging()) {
            const containerNode = this.container ?? this.node;
            controller.endDrag(pos, (p) => controller.getCellFromPosition(p, containerNode));
        } else if (this.touchStartCell) {
            // Tap (not drag) — handle cell selection
            const cell = this.getCellFromPosition(pos);
            if (cell) {
                this.onCellTouch(cell.row, cell.col);
            }
        }

        this.touchStartPos = null;
        this.touchStartCell = null;
    }

    // ============= Cell Touch (tap-to-select) =============

    private onCellTouch(row: number, col: number): void {
        if (!this.gridManager || !this.gameLoop) return;

        const itemAtPos = this.gridManager.getItemAt({ row, col });

        if (this.selectedItemId) {
            if (!itemAtPos) {
                const success = this.gameLoop.moveItem(this.selectedItemId, { row, col });
                if (success) {
                    this.selectedItemId = null;
                    this.refreshGrid();
                    return;
                }
            }

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

    // ============= Hover Feedback =============

    private hoveredCell: { row: number; col: number } | null = null;

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

    private clearHoverEffect(): void {
        if (!this.hoveredCell) return;
        const key = `${this.hoveredCell.row},${this.hoveredCell.col}`;
        const cellNode = this.cellNodes.get(key);
        if (cellNode) {
            const pos = { row: this.hoveredCell.row, col: this.hoveredCell.col };
            const itemId = this.gridManager?.getItemAt(pos);
            if (itemId && this.gridManager?.itemsMap) {
                const item = this.gridManager.itemsMap.get(itemId);
                if (item) {
                    this.setCellOccupied(cellNode, item);
                } else {
                    this.setCellEmpty(cellNode);
                }
            } else {
                this.setCellEmpty(cellNode);
            }
        }
        this.hoveredCell = null;
    }

    // ============= Cell Creation =============

    private createCells(): void {
        const targetContainer = this.container ?? this.node;

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

        this.cellNodes.forEach((node) => { node.active = false; });

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const key = `${row},${col}`;
                let cellNode: Node | undefined = this.cellNodes.get(key);

                if (!cellNode) {
                    cellNode = this.cellPool.length > 0
                        ? this.cellPool.pop()!
                        : this.createCellNode(row, col);
                    targetContainer.addChild(cellNode);
                    this.cellNodes.set(key, cellNode);
                }

                cellNode.active = true;
                this.updateCellPosition(cellNode, row, col);
            }
        }

        this.cellNodes.forEach((node, key) => {
            const [r, c] = key.split(',').map(Number);
            if (r >= this.rows || c >= this.cols) {
                node.active = false;
                this.cellPool.push(node);
                this.cellNodes.delete(key);
            }
        });
    }

    private updateCellPosition(cellNode: Node, row: number, col: number): void {
        const visualRow = (this.rows - 1) - row;
        const x = this.cellGap + col * (this.actualCellSize + this.cellGap);
        const y = this.cellGap + visualRow * (this.actualCellSize + this.cellGap);
        cellNode.setPosition(x, -y, 0);
    }

    private createCellNode(row: number, col: number): Node {
        let cellNode: Node;

        if (this.cellPrefab) {
            cellNode = this.cellPrefab.clone();
            cellNode.name = `cell_${row}_${col}`;
        } else {
            cellNode = new Node(`cell_${row}_${col}`);
            const transform = cellNode.addComponent(UITransform);
            transform.setContentSize(this.actualCellSize, this.actualCellSize);
            cellNode.addComponent(Sprite);
        }

        this.updateCellPosition(cellNode, row, col);

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

        return cellNode;
    }

    // ============= Grid Refresh =============

    public refreshGrid(): void {
        if (!this.gridManager) return;

        const items = this.gridManager.getAllItems();
        this.cellNodes.forEach((node) => { this.setCellEmpty(node); });

        for (const item of items) {
            const key = `${item.position.row},${item.position.col}`;
            const cellNode = this.cellNodes.get(key);
            if (cellNode) {
                this.setCellOccupied(cellNode, item);
            }
        }
    }

    private setCellEmpty(node: Node): void {
        const sprite = node.getComponent(Sprite);
        if (sprite) sprite.color = this.emptyColor;
        const label = node.getChildByName('label')?.getComponent(Label);
        if (label) label.string = '';
    }

    private setCellOccupied(node: Node, item: IGridItem): void {
        const template = this.itemDB?.getTemplate(item.templateId);
        const sprite = node.getComponent(Sprite);
        if (sprite && template?.color) {
            sprite.color = this.parseHexColor(template.color);
        } else if (sprite) {
            sprite.color = this.occupiedColor;
        }
        const label = node.getChildByName('label')?.getComponent(Label);
        if (label && template?.emoji) {
            label.string = template.emoji;
        }
    }

    private parseHexColor(hex: string): Color {
        if (!hex || hex.length < 7) return new Color(255, 255, 255, 255);
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return new Color(r, g, b, 255);
    }

    // ============= Coordinate Conversion (fallback) =============

    private getCellFromPositionLocal(worldPos: Vec3): IGridPosition | null {
        const containerNode = this.container ?? this.node;
        const transform = containerNode.getComponent(UITransform);
        if (!transform) return null;

        const localPos = transform.convertToNodeSpaceAR(worldPos);
        if (!localPos) return null;

        const step = this.actualCellSize + this.cellGap;
        const gridWidth = this.cols * step;
        const gridHeight = this.rows * step;

        if (localPos.x < 0 || localPos.x > gridWidth || localPos.y > 0 || localPos.y < -gridHeight) {
            return null;
        }

        const effectiveY = -localPos.y;
        const col = Math.floor(localPos.x / step);
        const rowFromTop = Math.floor(effectiveY / step);
        const row = (this.rows - 1) - rowFromTop;

        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
            return { row, col };
        }
        return null;
    }

    // ============= Public API =============

    public clearSelection(): void {
        this.selectedItemId = null;
        this.refreshGrid();
    }

    public getSelectedItemId(): string | null {
        return this.selectedItemId;
    }

    public setCellSize(size: number): void {
        this.actualCellSize = size;
        this.createCells();
        this.refreshGrid();
    }

    public getCellSize(): number {
        return this.actualCellSize;
    }

    public getGridManager(): GridManager | null {
        return this.gridManager;
    }

    public onDestroy(): void {
        this.removeTouchListeners();
        this.dragController?.destroy();
        this.cellNodes.forEach(node => node.destroy());
        this.cellNodes.clear();
        this.cellPool.forEach(node => node.destroy());
        this.cellPool = [];
    }

    // ============= GridView Compatibility =============

    public syncFromGridView(gridView: GridView): void {
        this.gridView = gridView;
        this.gridManager = gridView.getGridManager();
        this.refreshGrid();
    }
}
