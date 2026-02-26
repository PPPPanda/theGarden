/**
 * GridDragController - Drag interaction controller for GridPanel
 * Handles touch state machine, drag preview, and drop validation
 */

import { Node, Sprite, Label, Color, UITransform, Vec3, EventTouch } from 'cc';
import { IGridPosition } from '../../core/types';

export enum DragType {
    None = 'none',
    FromShop = 'fromShop',
    InGrid = 'inGrid'
}

export interface DragState {
    type: DragType;
    itemId?: string;
    templateId?: string;
    slotIndex?: number;
    startCell?: IGridPosition;
    previewNode?: Node | null;
}

/**
 * GridDragController handles all drag-related logic
 */
export class GridDragController {
    // Configuration
    private cellSize: number;
    private cellGap: number;
    private rows: number;
    private cols: number;
    private validDropColor: Color;
    private invalidDropColor: Color;
    private occupiedColor: Color;
    private dragThreshold: number = 10;

    // Callbacks
    private onDropCallback: ((type: DragType, itemId: string | null, templateId: string | null, slotIndex: number | null, position: IGridPosition) => boolean) | null = null;
    private getItemAtPosition: ((pos: IGridPosition) => string | null) | null = null;
    private getItemTemplate: ((itemId: string) => { emoji?: string; color?: string } | null) | null = null;
    private onHoverCallback: ((row: number, col: number, isValid: boolean) => void) | null = null;
    private onClearHoverCallback: (() => void) | null = null;

    // State
    private dragState: DragState = { type: DragType.None };
    private touchStartPos: Vec3 | null = null;
    private isDragGesture: boolean = false;
    private hoveredCell: IGridPosition | null = null;

    constructor(
        cellSize: number,
        cellGap: number,
        rows: number,
        cols: number,
        validDropColor: Color,
        invalidDropColor: Color,
        occupiedColor: Color
    ) {
        this.cellSize = cellSize;
        this.cellGap = cellGap;
        this.rows = rows;
        this.cols = cols;
        this.validDropColor = validDropColor;
        this.invalidDropColor = invalidDropColor;
        this.occupiedColor = occupiedColor;
    }

    // ============= Configuration =============

    public setDropCallback(callback: (type: DragType, itemId: string | null, templateId: string | null, slotIndex: number | null, position: IGridPosition) => boolean): void {
        this.onDropCallback = callback;
    }

    public setGetItemAtPosition(callback: (pos: IGridPosition) => string | null): void {
        this.getItemAtPosition = callback;
    }

    public setGetItemTemplate(callback: (itemId: string) => { emoji?: string; color?: string } | null): void {
        this.getItemTemplate = callback;
    }

    public setHoverCallbacks(onHover: (row: number, col: number, isValid: boolean) => void, onClear: () => void): void {
        this.onHoverCallback = onHover;
        this.onClearHoverCallback = onClear;
    }

    public updateGridSize(cellSize: number, cellGap: number, rows: number, cols: number): void {
        this.cellSize = cellSize;
        this.cellGap = cellGap;
        this.rows = rows;
        this.cols = cols;
    }

    // ============= Drag Operations =============

    /**
     * Start dragging from shop
     */
    public startDragFromShop(templateId: string, slotIndex: number, touchPos: Vec3): void {
        this.clearDragState();
        this.dragState = {
            type: DragType.FromShop,
            templateId,
            slotIndex,
            previewNode: this.createDragPreview(templateId, touchPos)
        };
        this.touchStartPos = new Vec3(touchPos.x, touchPos.y, 0);
    }

    /**
     * Start dragging item within grid
     */
    public startGridDrag(itemId: string, startCell: IGridPosition, touchPos: Vec3): void {
        this.clearDragState();
        this.dragState = {
            type: DragType.InGrid,
            itemId,
            startCell,
            previewNode: this.createGridItemPreview(itemId, touchPos)
        };
        this.touchStartPos = new Vec3(touchPos.x, touchPos.y, 0);
    }

    /**
     * Update drag position
     */
    public updateDrag(touchPos: Vec3, getCellFromPosition: (pos: Vec3) => IGridPosition | null): void {
        // Update preview position
        if (this.dragState.previewNode) {
            this.dragState.previewNode.setPosition(touchPos);
        }

        // Check if moved enough for drag gesture
        if (!this.isDragGesture && this.touchStartPos) {
            const dx = touchPos.x - this.touchStartPos.x;
            const dy = touchPos.y - this.touchStartPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > this.dragThreshold) {
                this.isDragGesture = true;
            }
        }

        // Update hover feedback
        const cell = getCellFromPosition(touchPos);
        if (cell) {
            if (this.hoveredCell?.row !== cell.row || this.hoveredCell?.col !== cell.col) {
                this.hoveredCell = cell;
                const isValid = this.isValidDropPosition(cell);
                this.onHoverCallback?.(cell.row, cell.col, isValid);
            }
        } else {
            this.clearHover();
        }
    }

    /**
     * End drag operation
     */
    public endDrag(touchPos: Vec3, getCellFromPosition: (pos: Vec3) => IGridPosition | null): boolean {
        const cell = getCellFromPosition(touchPos);
        
        if (!cell) {
            this.clearDragState();
            return false;
        }

        const isValid = this.isValidDropPosition(cell);

        if (isValid && this.onDropCallback) {
            const success = this.onDropCallback(
                this.dragState.type,
                this.dragState.itemId ?? null,
                this.dragState.templateId ?? null,
                this.dragState.slotIndex ?? null,
                cell
            );
            this.clearDragState();
            return success;
        }

        this.clearDragState();
        return false;
    }

    /**
     * Cancel drag operation
     */
    public cancelDrag(): void {
        this.clearDragState();
    }

    /**
     * Check if currently dragging
     */
    public isDragging(): boolean {
        return this.dragState.type !== DragType.None;
    }

    /**
     * Get current drag type
     */
    public getDragType(): DragType {
        return this.dragState.type;
    }

    // ============= Coordinate Conversion =============

    /**
     * Convert world position to grid cell
     */
    public getCellFromPosition(worldPos: Vec3, containerNode: Node): IGridPosition | null {
        const transform = containerNode.getComponent(UITransform);
        if (!transform) return null;

        const localPos = transform.convertToNodeSpaceAR(worldPos);
        if (!localPos) return null;

        const x = localPos.x;
        const y = localPos.y;
        const step = this.cellSize + this.cellGap;
        const gridWidth = this.cols * step;
        const gridHeight = this.rows * step;

        // Reject points outside grid bounds
        if (x < 0 || x > gridWidth || y > 0 || y < -gridHeight) {
            return null;
        }

        const effectiveY = -y;
        const col = Math.floor(x / step);
        const rowFromTop = Math.floor(effectiveY / step);
        const row = (this.rows - 1) - rowFromTop;

        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
            return { row, col };
        }
        return null;
    }

    // ============= Private Helpers =============

    private isValidDropPosition(cell: IGridPosition): boolean {
        if (this.dragState.type === DragType.InGrid) {
            if (this.dragState.startCell?.row === cell.row && this.dragState.startCell?.col === cell.col) {
                return true;
            }
            const itemAtPos = this.getItemAtPosition?.(cell);
            return !itemAtPos;
        }
        if (this.dragState.type === DragType.FromShop) {
            const itemAtPos = this.getItemAtPosition?.(cell);
            return !itemAtPos;
        }
        return false;
    }

    private clearHover(): void {
        if (this.hoveredCell) {
            this.hoveredCell = null;
            this.onClearHoverCallback?.();
        }
    }

    private clearDragState(): void {
        if (this.dragState.previewNode) {
            this.dragState.previewNode.destroy();
            this.dragState.previewNode = null;
        }
        this.dragState = { type: DragType.None };
        this.touchStartPos = null;
        this.isDragGesture = false;
        this.clearHover();
    }

    private createDragPreview(templateId: string, touchPos: Vec3): Node {
        const template = this.getItemTemplate?.(templateId);
        return this.createPreviewNode(template?.emoji ?? '?', template?.color, touchPos);
    }

    private createGridItemPreview(itemId: string, touchPos: Vec3): Node {
        const template = this.getItemTemplate?.(itemId);
        return this.createPreviewNode(template?.emoji ?? '?', template?.color, touchPos);
    }

    private createPreviewNode(emoji: string, color: string | undefined, touchPos: Vec3): Node {
        const previewNode = new Node('dragPreview');
        const transform = previewNode.addComponent(UITransform);
        transform.setContentSize(this.cellSize, this.cellSize);
        previewNode.setPosition(touchPos);

        const sprite = previewNode.addComponent(Sprite);
        if (color) {
            sprite.color = this.parseHexColor(color);
        } else {
            sprite.color = this.occupiedColor;
        }

        const labelNode = new Node('label');
        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(this.cellSize * 0.8, this.cellSize * 0.8);
        labelNode.setPosition(0, 0, 0);
        previewNode.addChild(labelNode);

        const label = labelNode.addComponent(Label);
        label.fontSize = Math.floor(this.cellSize * 0.6);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.string = emoji;

        return previewNode;
    }

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
     * Destroy controller and clean up
     */
    public destroy(): void {
        this.clearDragState();
        this.onDropCallback = null;
        this.getItemAtPosition = null;
        this.getItemTemplate = null;
        this.onHoverCallback = null;
        this.onClearHoverCallback = null;
    }
}
