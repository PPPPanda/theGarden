/**
 * ShopPanel - Shop Panel Cocos Component
 * Displays shop slots with item icons, prices, buy/lock buttons.
 * All purchase/refresh/lock logic delegated via callbacks to MainScene.
 */

import { _decorator, Component, Node, Label, Color, UITransform, EventTouch, Sprite, Button, CCFloat, CCInteger, Vec3, Graphics } from 'cc';
import { ShopManager } from '../core/ShopManager';
import { GameLoop } from '../core/GameLoop';
import { ItemDB } from '../core/ItemDB';
import { IShopSlot, IItemTemplate, ItemRarity } from '../core/types';

const { ccclass, property } = _decorator;

/** Per-slot bound nodes */
interface SlotBinding {
    icon: Node | null;
    price: Node | null;
    buyBtn: Node | null;
    lockBtn: Node | null;
}

type Bounds2D = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};

@ccclass('ShopPanel')
export class ShopPanel extends Component {
    // ============= Layout Properties =============

    @property({ type: CCFloat, tooltip: 'Shop slot size in pixels' })
    public slotSize: number = 80;

    @property({ type: CCFloat, tooltip: 'Gap between slots' })
    public slotGap: number = 10;

    @property({ type: CCInteger, tooltip: 'Number of shop slots (3-5)' })
    public slotCount: number = 5;

    // ============= Slot 0 Bindings =============

    @property({ type: Node, tooltip: 'Slot 0 icon node (Label/Sprite)' })
    public slot0Icon: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 0 price label node' })
    public slot0Price: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 0 buy button node' })
    public slot0BuyBtn: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 0 lock button node' })
    public slot0LockBtn: Node | null = null;

    // ============= Slot 1 Bindings =============

    @property({ type: Node, tooltip: 'Slot 1 icon node' })
    public slot1Icon: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 1 price label node' })
    public slot1Price: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 1 buy button node' })
    public slot1BuyBtn: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 1 lock button node' })
    public slot1LockBtn: Node | null = null;

    // ============= Slot 2 Bindings =============

    @property({ type: Node, tooltip: 'Slot 2 icon node' })
    public slot2Icon: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 2 price label node' })
    public slot2Price: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 2 buy button node' })
    public slot2BuyBtn: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 2 lock button node' })
    public slot2LockBtn: Node | null = null;

    // ============= Slot 3 Bindings =============

    @property({ type: Node, tooltip: 'Slot 3 icon node' })
    public slot3Icon: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 3 price label node' })
    public slot3Price: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 3 buy button node' })
    public slot3BuyBtn: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 3 lock button node' })
    public slot3LockBtn: Node | null = null;

    // ============= Slot 4 Bindings =============

    @property({ type: Node, tooltip: 'Slot 4 icon node (Label/Sprite)' })
    public slot4Icon: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 4 price label node' })
    public slot4Price: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 4 buy button node' })
    public slot4BuyBtn: Node | null = null;

    @property({ type: Node, tooltip: 'Slot 4 lock button node' })
    public slot4LockBtn: Node | null = null;

    // ============= Global Bindings =============

    @property({ type: Node, tooltip: 'Refresh button node' })
    public refreshBtn: Node | null = null;

    @property({ type: Node, tooltip: 'Gold display label node' })
    public goldLabelNode: Node | null = null;

    @property({ type: Node, tooltip: 'Purchased items list label node (optional)' })
    public purchasedListNode: Node | null = null;

    // ============= Style Properties =============

    @property({ type: Color, tooltip: 'Empty slot background color' })
    public slotColor: Color = new Color(60, 60, 60, 200);

    @property({ type: Color, tooltip: 'Purchased slot color' })
    public purchasedColor: Color = new Color(100, 100, 100, 150);

    @property({ type: Color, tooltip: 'Locked slot indicator color' })
    public lockedColor: Color = new Color(255, 215, 0, 100);

    @property({ type: Color, tooltip: 'Text color' })
    public textColor: Color = new Color(255, 255, 255, 255);

    @property({ type: Color, tooltip: 'Gold text color' })
    public goldColor: Color = new Color(255, 215, 0, 255);

    // ============= Private State =============

    private shopManager: ShopManager | null = null;
    private gameLoop: GameLoop | null = null;
    private itemDB: ItemDB | null = null;

    /** Runtime-created slot nodes (fallback when @property nodes not bound) */
    private runtimeSlotNodes: Map<number, Node> = new Map();

    /** Resolved slot bindings (bound or runtime-created) */
    private slotBindings: SlotBinding[] = [];

    /** Runtime gold label ref */
    private runtimeGoldLabel: Label | null = null;

    /** Runtime refresh cost label ref */
    private runtimeRefreshLabel: Label | null = null;

    /** Runtime purchased list node (fallback when purchasedListNode is not bound) */
    private runtimePurchasedListNode: Node | null = null;

    /** Purchased list label ref (bound or runtime-created) */
    private purchasedListLabel: Label | null = null;

    /** Purchased item aggregation by templateId */
    private purchasedItemCounts: Map<string, number> = new Map();

    /** Last observed game day for auto-reset */
    private lastKnownDay: number = -1;

    /** Cached effective interactive nodes for hit guards */
    private interactiveHitNodes: Node[] = [];

    /** Hit padding in pixels */
    private readonly hitPadding: number = 4;

    /** One-shot diagnostics flag for hit bounds logging */
    private hasLoggedHitBoundsDiagnostics: boolean = false;

    // ============= Callbacks =============

    private onBuyCallback: ((slotIndex: number) => boolean) | null = null;
    private onRefreshCallback: (() => boolean) | null = null;
    private onLockCallback: ((slotIndex: number) => boolean) | null = null;
    private onDragStartFromShopCallback: ((slotIndex: number, templateId: string, worldPos: {x: number, y: number}) => void) | null = null;

    // Drag detection state
    private dragTouchStartPos: {x: number, y: number} | null = null;
    private dragStartSlotIndex: number = -1;
    private readonly DRAG_THRESHOLD = 10; // pixels

    /**
     * Set buy callback — called when buy button pressed.
     * Return true = purchase succeeded, UI will refresh.
     */
    public setOnBuy(callback: (slotIndex: number) => boolean): void {
        this.onBuyCallback = callback;
    }

    /**
     * Set refresh callback — called when refresh button pressed.
     * Return true = refresh succeeded, UI will refresh.
     */
    public setOnRefresh(callback: () => boolean): void {
        this.onRefreshCallback = callback;
    }

    /**
     * Set lock callback — called when lock button pressed.
     * Return true = lock toggled, UI will refresh.
     */
    public setOnLock(callback: (slotIndex: number) => boolean): void {
        this.onLockCallback = callback;
    }

    /**
     * Set drag start callback - called when user starts dragging from shop slot
     */
    public setOnDragStartFromShop(callback: (slotIndex: number, templateId: string, worldPos: {x: number, y: number}) => void): void {
        this.onDragStartFromShopCallback = callback;
    }

    // ============= Initialization =============

    /**
     * Initialize with GameLoop (primary entry point)
     */
    public init(gameLoop: GameLoop): void {
        this.gameLoop = gameLoop;
        this.shopManager = gameLoop.getShopManager();
        this.itemDB = gameLoop.getItemDB();
        this.resolveBindings();
        this.refreshInteractiveBoundsAndHitArea();
        this.ensurePurchasedListUI();
        this.wireEvents();
        this.refreshShopUI();
    }

    /**
     * Initialize with explicit dependencies
     */
    public initWithDeps(shopManager: ShopManager, gameLoop: GameLoop, itemDB: ItemDB): void {
        this.shopManager = shopManager;
        this.gameLoop = gameLoop;
        this.itemDB = itemDB;
        this.resolveBindings();
        this.refreshInteractiveBoundsAndHitArea();
        this.ensurePurchasedListUI();
        this.wireEvents();
        this.refreshShopUI();
    }

    // ============= Lifecycle =============

    public onLoad(): void {
        // Build fallback UI for any unbound slots
        this.buildFallbackUI();
    }

    public start(): void {
        this.resolveBindings();
        this.refreshInteractiveBoundsAndHitArea();
        this.ensurePurchasedListUI();
        this.wireEvents();
        this.refreshShopUI();
    }

    // ============= Binding Resolution =============

    /**
     * Resolve slot bindings: prefer @property nodes, fall back to runtime-created
     */
    private resolveBindings(): void {
        this.slotBindings = [];

        const boundSlots: Array<[Node | null, Node | null, Node | null, Node | null]> = [
            [this.slot0Icon, this.slot0Price, this.slot0BuyBtn, this.slot0LockBtn],
            [this.slot1Icon, this.slot1Price, this.slot1BuyBtn, this.slot1LockBtn],
            [this.slot2Icon, this.slot2Price, this.slot2BuyBtn, this.slot2LockBtn],
            [this.slot3Icon, this.slot3Price, this.slot3BuyBtn, this.slot3LockBtn],
            [this.slot4Icon, this.slot4Price, this.slot4BuyBtn, this.slot4LockBtn],
        ];

        for (let i = 0; i < this.slotCount; i++) {
            const bound = i < boundSlots.length ? boundSlots[i] : [null, null, null, null];
            const runtimeNode = this.runtimeSlotNodes.get(i);

            this.slotBindings.push({
                icon: bound[0] ?? runtimeNode?.getChildByName('icon') ?? null,
                price: bound[1] ?? runtimeNode?.getChildByName('price') ?? null,
                buyBtn: bound[2] ?? runtimeNode?.getChildByName('buyBtn') ?? null,
                lockBtn: bound[3] ?? runtimeNode?.getChildByName('lockBtn') ?? null,
            });
        }
    }

    /**
     * Refresh interactive node cache, tighten root hit bounds, and disable input blockers.
     */
    private refreshInteractiveBoundsAndHitArea(): void {
        this.collectInteractiveHitNodes();
        this.walkAndDisableBlockInputEvents(this.node);
        this.tightenRootTouchBounds();
    }

    /**
     * Ensure purchased-list UI exists and is laid out away from interactive controls.
     */
    private ensurePurchasedListUI(): void {
        const listNode = this.purchasedListNode ?? this.getOrCreateRuntimePurchasedListNode();
        if (!listNode) {
            return;
        }

        const transform = listNode.getComponent(UITransform) ?? listNode.addComponent(UITransform);
        this.layoutPurchasedListNode(listNode, transform);

        const label = listNode.getComponent(Label) ?? listNode.addComponent(Label);
        label.fontSize = 16;
        label.lineHeight = 20;
        label.color = this.textColor;
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.TOP;
        label.string = 'Purchased: (none)';

        this.purchasedListLabel = label;
    }

    private getOrCreateRuntimePurchasedListNode(): Node | null {
        if (this.runtimePurchasedListNode?.isValid) {
            return this.runtimePurchasedListNode;
        }

        const node = new Node('PurchasedList');
        node.setPosition(0, this.slotSize + 70, 0);
        this.node.addChild(node);
        this.runtimePurchasedListNode = node;
        return node;
    }

    private layoutPurchasedListNode(node: Node, transform: UITransform): void {
        const bounds = this.computeLocalUnionBounds(this.interactiveHitNodes);

        const width = Math.max(
            220,
            bounds ? (bounds.maxX - bounds.minX + 20) : this.slotCount * (this.slotSize + this.slotGap)
        );
        const lineCount = Math.max(2, this.purchasedItemCounts.size + 1);
        const height = Math.min(200, Math.max(56, lineCount * 20 + 10));

        transform.setContentSize(width, height);

        const y = bounds
            ? bounds.maxY + height * 0.5 + 16
            : this.slotSize + height * 0.5 + 24;

        node.setPosition(0, y, 0);
    }

    /**
     * Collect all valid interactive nodes (buy/lock/icon/refresh).
     */
    private collectInteractiveHitNodes(): void {
        const nodes: Node[] = [];

        for (const binding of this.slotBindings) {
            if (binding.icon) nodes.push(binding.icon);
            if (binding.buyBtn) nodes.push(binding.buyBtn);
            if (binding.lockBtn) nodes.push(binding.lockBtn);
        }

        const refreshNode = this.refreshBtn ?? this.node.getChildByName('refreshBtn');
        if (refreshNode) {
            nodes.push(refreshNode);
        }

        this.interactiveHitNodes = nodes.filter((node, index) => nodes.indexOf(node) === index);
    }

    /**
     * Recursively disable BlockInputEvents if present.
     */
    private walkAndDisableBlockInputEvents(node: Node | null): void {
        if (!node) {
            return;
        }

        this.disableBlockInputEvents(node);
        for (const child of node.children) {
            this.walkAndDisableBlockInputEvents(child);
        }
    }

    private disableBlockInputEvents(node: Node): void {
        const blockCompUnknown = node.getComponent('cc.BlockInputEvents') ?? node.getComponent('BlockInputEvents');
        if (!blockCompUnknown) {
            return;
        }

        const blockComp = blockCompUnknown as unknown as { enabled?: boolean };
        if (typeof blockComp.enabled === 'boolean') {
            blockComp.enabled = false;
            console.warn(`[ShopPanel] Disabled BlockInputEvents on ${node.name}`);
        }
    }

    /**
     * Tighten ShopPanel root UITransform bounds to union of actual interactive controls.
     */
    private tightenRootTouchBounds(): void {
        const rootTransform = this.node.getComponent(UITransform);
        if (!rootTransform) {
            return;
        }

        const bounds = this.computeLocalUnionBounds(this.interactiveHitNodes);
        if (!bounds) {
            return;
        }

        const halfW = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX));
        const halfH = Math.max(Math.abs(bounds.minY), Math.abs(bounds.maxY));
        const width = Math.max(1, halfW * 2 + this.hitPadding * 2);
        const height = Math.max(1, halfH * 2 + this.hitPadding * 2);

        rootTransform.setContentSize(width, height);

        if (!this.hasLoggedHitBoundsDiagnostics) {
            const world = rootTransform.getBoundingBoxToWorld();
            console.log(
                `[ShopPanel] HitBounds diagnostics ` +
                `local=(${bounds.minX.toFixed(1)},${bounds.minY.toFixed(1)})-(${bounds.maxX.toFixed(1)},${bounds.maxY.toFixed(1)}) ` +
                `size=${width.toFixed(1)}x${height.toFixed(1)} ` +
                `world=(${world.x.toFixed(1)},${world.y.toFixed(1)})-(${(world.x + world.width).toFixed(1)},${(world.y + world.height).toFixed(1)})`
            );
            this.hasLoggedHitBoundsDiagnostics = true;
        }
    }

    private computeLocalUnionBounds(nodes: Node[]): Bounds2D | null {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (const node of nodes) {
            const bounds = this.getNodeBoundsInRootLocal(node);
            if (!bounds) {
                continue;
            }

            minX = Math.min(minX, bounds.minX);
            maxX = Math.max(maxX, bounds.maxX);
            minY = Math.min(minY, bounds.minY);
            maxY = Math.max(maxY, bounds.maxY);
        }

        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
            return null;
        }

        return { minX, maxX, minY, maxY };
    }

    private getNodeBoundsInRootLocal(node: Node): Bounds2D | null {
        const rootTransform = this.node.getComponent(UITransform);
        const targetTransform = this.resolveHitTransform(node);
        if (!rootTransform || !targetTransform) {
            return null;
        }

        const box = targetTransform.getBoundingBoxToWorld();
        const corners = [
            new Vec3(box.x, box.y, 0),
            new Vec3(box.x + box.width, box.y, 0),
            new Vec3(box.x, box.y + box.height, 0),
            new Vec3(box.x + box.width, box.y + box.height, 0),
        ];

        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (const corner of corners) {
            const local = rootTransform.convertToNodeSpaceAR(corner);
            minX = Math.min(minX, local.x);
            maxX = Math.max(maxX, local.x);
            minY = Math.min(minY, local.y);
            maxY = Math.max(maxY, local.y);
        }

        return { minX, maxX, minY, maxY };
    }

    private extractEventWorldPosition(event: EventTouch): { x: number; y: number } | null {
        const touchPos = event.touch?.getLocation();
        if (touchPos) {
            return { x: touchPos.x, y: touchPos.y };
        }

        const eventLike = event as unknown as { getUILocation?: () => { x: number; y: number } };
        const uiPos = eventLike.getUILocation?.();
        if (uiPos && Number.isFinite(uiPos.x) && Number.isFinite(uiPos.y)) {
            return { x: uiPos.x, y: uiPos.y };
        }

        return null;
    }

    private isWorldPointInsideNode(node: Node | null, worldX: number, worldY: number): boolean {
        if (!node) {
            return false;
        }

        const transform = this.resolveHitTransform(node);
        if (!transform) {
            return false;
        }

        const box = transform.getBoundingBoxToWorld();
        return worldX >= box.x - this.hitPadding
            && worldX <= box.x + box.width + this.hitPadding
            && worldY >= box.y - this.hitPadding
            && worldY <= box.y + box.height + this.hitPadding;
    }

    /**
     * Resolve best UITransform for hit-test, including button target/children fallback.
     */
    private resolveHitTransform(node: Node): UITransform | null {
        const self = node.getComponent(UITransform);
        if (self) {
            return self;
        }

        const button = node.getComponent(Button);
        const targetTransform = button?.target?.getComponent(UITransform);
        if (targetTransform) {
            return targetTransform;
        }

        for (const child of node.children) {
            const childTransform = child.getComponent(UITransform);
            if (childTransform) {
                return childTransform;
            }
        }

        return null;
    }

    private isTouchInsideInteractiveZone(event: EventTouch): boolean {
        const pos = this.extractEventWorldPosition(event);
        if (!pos) {
            return false;
        }

        for (const node of this.interactiveHitNodes) {
            if (this.isWorldPointInsideNode(node, pos.x, pos.y)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Wire button events
     */
    private wireEvents(): void {
        // Slot buy/lock buttons - use Node.EventType.TOUCH_END per Cocos 3.x
        for (let i = 0; i < this.slotBindings.length; i++) {
            const binding = this.slotBindings[i];
            const slotIdx = i;

            if (binding.buyBtn) {
                binding.buyBtn.off(Node.EventType.TOUCH_END);
                binding.buyBtn.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                    const pos = this.extractEventWorldPosition(event);
                    if (!pos || !this.isWorldPointInsideNode(binding.buyBtn, pos.x, pos.y)) {
                        return;
                    }
                    if (!this.isTouchInsideInteractiveZone(event)) {
                        return;
                    }

                    console.log(`[ShopPanel] BUY touched at slot ${slotIdx}`);
                    const result = this.handleBuy(slotIdx);
                    console.log(`[ShopPanel] BUY result: ${result ? 'SUCCESS' : 'FAILED'}`);
                }, this);
            }
            if (binding.lockBtn) {
                binding.lockBtn.off(Node.EventType.TOUCH_END);
                binding.lockBtn.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                    const pos = this.extractEventWorldPosition(event);
                    if (!pos || !this.isWorldPointInsideNode(binding.lockBtn, pos.x, pos.y)) {
                        return;
                    }
                    if (!this.isTouchInsideInteractiveZone(event)) {
                        return;
                    }

                    console.log(`[ShopPanel] LOCK touched at slot ${slotIdx}`);
                    const result = this.handleLock(slotIdx);
                    console.log(`[ShopPanel] LOCK result: ${result ? 'SUCCESS' : 'FAILED'}`);
                }, this);
            }
            
            // Drag detection on slot icon - keep EventTouch for position data
            if (binding.icon) {
                binding.icon.off(EventTouch.TOUCH_START);
                binding.icon.off(EventTouch.TOUCH_MOVE);
                binding.icon.off(EventTouch.TOUCH_END);
                
                binding.icon.on(EventTouch.TOUCH_START, (event: EventTouch) => {
                    const pos = this.extractEventWorldPosition(event);
                    if (!pos || !this.isWorldPointInsideNode(binding.icon, pos.x, pos.y)) {
                        return;
                    }
                    if (!this.isTouchInsideInteractiveZone(event)) {
                        return;
                    }

                    this.dragTouchStartPos = { x: pos.x, y: pos.y };
                    this.dragStartSlotIndex = slotIdx;
                }, this);
                
                binding.icon.on(EventTouch.TOUCH_MOVE, (event: EventTouch) => {
                    if (this.dragTouchStartPos && this.dragStartSlotIndex >= 0) {
                        const pos = this.extractEventWorldPosition(event);
                        if (pos) {
                            const dx = pos.x - this.dragTouchStartPos.x;
                            const dy = pos.y - this.dragTouchStartPos.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            
                            if (dist > this.DRAG_THRESHOLD) {
                                // Trigger drag start
                                this.handleDragStart(slotIdx, { x: pos.x, y: pos.y });
                                this.dragTouchStartPos = null;
                                this.dragStartSlotIndex = -1;
                            }
                        }
                    }
                }, this);
                
                binding.icon.on(EventTouch.TOUCH_END, () => {
                    // Reset drag state on touch end (was a tap, not drag)
                    this.dragTouchStartPos = null;
                    this.dragStartSlotIndex = -1;
                }, this);
            }
        }

        // Refresh button - use Node.EventType.TOUCH_END
        const refreshNode = this.refreshBtn ?? this.node.getChildByName('refreshBtn');
        if (refreshNode) {
            refreshNode.off(Node.EventType.TOUCH_END);
            refreshNode.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                const pos = this.extractEventWorldPosition(event);
                if (!pos || !this.isWorldPointInsideNode(refreshNode, pos.x, pos.y)) {
                    return;
                }
                if (!this.isTouchInsideInteractiveZone(event)) {
                    return;
                }

                console.log('[ShopPanel] REFRESH touched');
                const result = this.handleRefresh();
                console.log(`[ShopPanel] REFRESH result: ${result ? 'SUCCESS' : 'FAILED'}`);
            }, this);
        }
    }

    /**
     * Handle drag start from shop slot
     */
    private handleDragStart(slotIndex: number, worldPos: {x: number, y: number}): void {
        console.log(`[ShopPanel] DRAG_START at slot ${slotIndex}, pos: (${worldPos.x}, ${worldPos.y})`);
        
        if (!this.onDragStartFromShopCallback) {
            console.warn(`[ShopPanel] DRAG_START: no callback set for slot ${slotIndex}`);
            return;
        }
        
        const slot = this.shopManager?.getSlot(slotIndex);
        if (!slot || !slot.templateId) {
            console.warn(`[ShopPanel] DRAG_START: invalid slot ${slotIndex}`);
            return;
        }
        
        const templateId = slot.templateId;
        console.log(`[ShopPanel] DRAG_START: triggering callback with templateId=${templateId}`);
        this.onDragStartFromShopCallback(slotIndex, templateId, worldPos);
    }

    // ============= Fallback UI Creation =============

    /**
     * Build runtime UI for slots not bound via @property
     */
    private buildFallbackUI(): void {
        const totalWidth = this.slotCount * this.slotSize + (this.slotCount - 1) * this.slotGap;
        const startX = -totalWidth / 2 + this.slotSize / 2;

        for (let i = 0; i < this.slotCount; i++) {
            // Skip if already bound via @property
            const boundSlots = [this.slot0Icon, this.slot1Icon, this.slot2Icon, this.slot3Icon, this.slot4Icon];
            if (i < boundSlots.length && boundSlots[i]) continue;

            const slotNode = this.createFallbackSlot(i);
            slotNode.setPosition(startX + i * (this.slotSize + this.slotGap), 0, 0);
            this.node.addChild(slotNode);
            this.runtimeSlotNodes.set(i, slotNode);
        }

        // Gold label fallback
        if (!this.goldLabelNode) {
            const goldNode = new Node('goldLabel');
            const transform = goldNode.addComponent(UITransform);
            transform.setContentSize(150, 30);
            goldNode.setPosition(0, -(this.slotSize / 2 + 30), 0);
            this.node.addChild(goldNode);

            this.runtimeGoldLabel = goldNode.addComponent(Label);
            this.runtimeGoldLabel.fontSize = 20;
            this.runtimeGoldLabel.color = this.goldColor;
            this.runtimeGoldLabel.string = 'Gold: 0';
        }

        // Refresh button fallback
        if (!this.refreshBtn) {
            const refreshNode = new Node('refreshBtn');
            const transform = refreshNode.addComponent(UITransform);
            transform.setContentSize(120, 36);
            refreshNode.setPosition(0, -(this.slotSize / 2 + 65), 0);
            this.node.addChild(refreshNode);

            // Add Sprite background
            refreshNode.addComponent(Sprite);

            const labelNode = new Node('label');
            const labelTransform = labelNode.addComponent(UITransform);
            labelTransform.setContentSize(110, 30);
            labelNode.setPosition(0, 0, 0);
            refreshNode.addChild(labelNode);

            this.runtimeRefreshLabel = labelNode.addComponent(Label);
            this.runtimeRefreshLabel.fontSize = 18;
            this.runtimeRefreshLabel.color = this.textColor;
            this.runtimeRefreshLabel.string = 'Refresh: 2g';
        }
    }

    /**
     * Create a single fallback slot node
     */
    private createFallbackSlot(index: number): Node {
        const slotNode = new Node(`slot_${index}`);
        const transform = slotNode.addComponent(UITransform);
        transform.setContentSize(this.slotSize, this.slotSize + 40);

        // Slot background (Sprite)
        const bgNode = new Node('bg');
        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(this.slotSize, this.slotSize);
        bgNode.setPosition(0, 20, 0);
        bgNode.addComponent(Sprite);
        slotNode.addChild(bgNode);

        // Icon label (emoji placeholder)
        const iconNode = new Node('icon');
        const iconTransform = iconNode.addComponent(UITransform);
        iconTransform.setContentSize(this.slotSize * 0.7, this.slotSize * 0.7);
        iconNode.setPosition(0, 25, 0);
        slotNode.addChild(iconNode);

        const iconLabel = iconNode.addComponent(Label);
        iconLabel.fontSize = Math.floor(this.slotSize * 0.45);
        iconLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        iconLabel.verticalAlign = Label.VerticalAlign.CENTER;
        iconLabel.string = '?';

        // Price label
        const priceNode = new Node('price');
        const priceTransform = priceNode.addComponent(UITransform);
        priceTransform.setContentSize(this.slotSize, 20);
        priceNode.setPosition(0, -this.slotSize / 2 + 15, 0);
        slotNode.addChild(priceNode);

        const priceLabel = priceNode.addComponent(Label);
        priceLabel.fontSize = 16;
        priceLabel.color = this.goldColor;
        priceLabel.string = '0g';

        // Buy button (entire slot acts as buy area)
        const buyBtnNode = new Node('buyBtn');
        const buyTransform = buyBtnNode.addComponent(UITransform);
        buyTransform.setContentSize(this.slotSize, this.slotSize);
        buyBtnNode.setPosition(0, 20, 0);
        slotNode.addChild(buyBtnNode);

        // Lock button (small toggle in corner)
        const lockBtnNode = new Node('lockBtn');
        const lockTransform = lockBtnNode.addComponent(UITransform);
        lockTransform.setContentSize(24, 24);
        lockBtnNode.setPosition(this.slotSize / 2 - 14, this.slotSize / 2 + 6, 0);
        slotNode.addChild(lockBtnNode);

        const lockLabel = lockBtnNode.addComponent(Label);
        lockLabel.fontSize = 14;
        lockLabel.string = '🔓';

        return slotNode;
    }

    // ============= Event Handlers (delegate to callbacks) =============

    /**
     * Handle buy button press - returns success status
     */
    private handleBuy(slotIndex: number): boolean {
        // Check if slot is already purchased
        const slot = this.shopManager?.getSlot(slotIndex);
        if (!slot) {
            console.warn('ShopPanel: invalid slot index');
            return false;
        }
        if (slot.purchased) {
            console.warn('ShopPanel: slot already purchased');
            return false;
        }

        const templateId = slot.templateId;

        if (this.onBuyCallback) {
            const success = this.onBuyCallback(slotIndex);
            if (success) {
                this.recordPurchasedItem(templateId);
                this.refreshShopUI();
                return true;
            }
            return false;
        }

        // No callback set — purchase requires position from MainScene
        console.warn('ShopPanel: no onBuy callback set, purchase requires MainScene wiring');
        return false;
    }

    /**
     * Handle refresh button press - returns success status
     */
    private handleRefresh(): boolean {
        if (this.onRefreshCallback) {
            const success = this.onRefreshCallback();
            if (success) {
                this.refreshShopUI();
                return true;
            }
            return false;
        }

        // Fallback: direct refresh via gameLoop
        if (!this.gameLoop) return false;
        const success = this.gameLoop.refreshShop();
        if (success) {
            this.refreshShopUI();
            return true;
        }
        return false;
    }

    /**
     * Handle lock button press - returns success status
     */
    private handleLock(slotIndex: number): boolean {
        if (this.onLockCallback) {
            const success = this.onLockCallback(slotIndex);
            if (success) {
                this.refreshShopUI();
                return true;
            }
            return false;
        }

        // Fallback: direct lock toggle via shopManager
        if (!this.shopManager) return false;
        this.shopManager.toggleLock(slotIndex);
        this.refreshShopUI();
        return true;
    }

    // ============= Display Refresh =============

    /**
     * Refresh entire shop UI
     */
    public refreshShopUI(): void {
        this.ensurePurchasedListUI();
        this.syncPurchasedListByDay();

        this.updateGoldDisplay();
        this.updateRefreshDisplay();
        this.updateAllSlots();
        this.updatePurchasedListDisplay();
    }

    /**
     * Update gold display
     */
    private updateGoldDisplay(): void {
        const gold = this.gameLoop?.getPlayerGold() ?? 0;

        // Prefer bound node
        const goldNode = this.goldLabelNode;
        if (goldNode) {
            const label = goldNode.getComponent(Label);
            if (label) {
                label.string = `Gold: ${gold}`;
            }
            return;
        }

        // Fallback
        if (this.runtimeGoldLabel) {
            this.runtimeGoldLabel.string = `Gold: ${gold}`;
        }
    }

    /**
     * Update refresh button cost display
     */
    private updateRefreshDisplay(): void {
        const cost = this.shopManager?.getRefreshCost() ?? 2;

        // Prefer bound refresh node label
        const refreshNode = this.refreshBtn;
        if (refreshNode) {
            const labelNode = refreshNode.getChildByName('label');
            const label = labelNode?.getComponent(Label);
            if (label) {
                label.string = `Refresh: ${cost}g`;
            }
            return;
        }

        // Fallback
        if (this.runtimeRefreshLabel) {
            this.runtimeRefreshLabel.string = `Refresh: ${cost}g`;
        }
    }

    /**
     * Update all slot displays
     */
    private updateAllSlots(): void {
        for (let i = 0; i < this.slotCount; i++) {
            this.updateSlot(i);
        }
    }

    private syncPurchasedListByDay(): void {
        const day = this.gameLoop?.getDay();
        if (day === undefined || day === null) {
            return;
        }

        if (this.lastKnownDay < 0) {
            this.lastKnownDay = day;
            return;
        }

        if (day !== this.lastKnownDay) {
            this.purchasedItemCounts.clear();
            this.lastKnownDay = day;
            console.log(`[ShopPanel] Day changed to ${day}, cleared purchased list`);
        }
    }

    private recordPurchasedItem(templateId: string): void {
        if (!templateId) {
            return;
        }

        const current = this.purchasedItemCounts.get(templateId) ?? 0;
        this.purchasedItemCounts.set(templateId, current + 1);
    }

    private updatePurchasedListDisplay(): void {
        this.ensurePurchasedListUI();

        if (!this.purchasedListLabel) {
            return;
        }

        if (this.purchasedItemCounts.size === 0) {
            this.purchasedListLabel.string = 'Purchased: (none)';
            return;
        }

        const lines = ['Purchased:'];
        for (const [templateId, count] of this.purchasedItemCounts.entries()) {
            const itemName = this.itemDB?.getTemplate(templateId)?.name ?? templateId;
            lines.push(`${itemName} × ${count}`);
        }

        this.purchasedListLabel.string = lines.join('\n');
    }

    /**
     * Resolve or create a Label component on the given icon node.
     * Scene Icon nodes may have cc.Sprite (no Label). In that case,
     * create a child node with a Label for text-based (emoji) display.
     */
    private resolveIconLabel(iconNode: Node): Label | null {
        // Prefer existing Label on the node itself
        let label = iconNode.getComponent(Label);
        if (label) return label;

        // Check for previously-created child label
        let child = iconNode.getChildByName('_iconLabel');
        if (child) {
            return child.getComponent(Label);
        }

        // Create a child Label (Sprite stays for future texture-based icons)
        child = new Node('_iconLabel');
        const transform = child.addComponent(UITransform);
        const parentTransform = iconNode.getComponent(UITransform);
        if (parentTransform) {
            transform.setContentSize(parentTransform.contentSize);
        } else {
            transform.setContentSize(56, 56);
        }
        label = child.addComponent(Label);
        label.fontSize = Math.floor(this.slotSize * 0.45);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        iconNode.addChild(child);
        return label;
    }

    private resolveIconFillGraphics(iconNode: Node): Graphics | null {
        let fillNode = iconNode.getChildByName('_iconFill');
        if (!fillNode) {
            fillNode = new Node('_iconFill');
            fillNode.setPosition(0, 0, 0);
            iconNode.addChild(fillNode);
            fillNode.setSiblingIndex(0);
        }

        const iconTransform = iconNode.getComponent(UITransform);
        const fillTransform = fillNode.getComponent(UITransform) ?? fillNode.addComponent(UITransform);
        if (iconTransform) {
            fillTransform.setContentSize(iconTransform.contentSize);
        } else {
            fillTransform.setContentSize(this.slotSize * 0.7, this.slotSize * 0.7);
        }

        return fillNode.getComponent(Graphics) ?? fillNode.addComponent(Graphics);
    }

    private getRarityFillColor(rarity: ItemRarity | undefined): Color {
        switch (rarity) {
            case ItemRarity.Uncommon:
                return new Color(76, 175, 80, 255); // #4CAF50
            case ItemRarity.Rare:
                return new Color(33, 150, 243, 255); // #2196F3
            case ItemRarity.Epic:
                return new Color(156, 39, 176, 255); // #9C27B0
            case ItemRarity.Legendary:
                return new Color(255, 152, 0, 255); // #FF9800
            case ItemRarity.Common:
            default:
                return new Color(136, 136, 136, 255); // #888888
        }
    }

    private drawIconFill(iconNode: Node, template: IItemTemplate | undefined, slot: IShopSlot): void {
        const graphics = this.resolveIconFillGraphics(iconNode);
        if (!graphics) {
            return;
        }

        const transform = graphics.node.getComponent(UITransform);
        if (!transform) {
            return;
        }

        const baseColor = this.getRarityFillColor(template?.rarity);
        const fillColor = baseColor.clone();
        let strokeColor = new Color(20, 20, 20, 220);

        if (slot.purchased) {
            fillColor.r = this.purchasedColor.r;
            fillColor.g = this.purchasedColor.g;
            fillColor.b = this.purchasedColor.b;
            fillColor.a = 170;
            strokeColor = new Color(90, 90, 90, 200);
        } else if (slot.locked) {
            fillColor.a = 190;
            strokeColor = new Color(255, 215, 0, 220);
        }

        const width = Math.max(8, transform.width - 6);
        const height = Math.max(8, transform.height - 6);

        graphics.clear();
        graphics.lineWidth = 2;
        graphics.fillColor = fillColor;
        graphics.strokeColor = strokeColor;
        graphics.roundRect(-width / 2, -height / 2, width, height, 8);
        graphics.fill();
        graphics.stroke();
    }

    /**
     * Update a single slot display
     */
    private updateSlot(index: number): void {
        if (!this.shopManager) return;
        if (index >= this.slotBindings.length) return;

        const binding = this.slotBindings[index];
        const slot = this.shopManager.getSlot(index);

        if (!slot) {
            this.setSlotEmpty(binding);
            return;
        }

        // Get template info for icon/color
        const template = this.itemDB?.getTemplate(slot.templateId);

        // Update icon (works with both Label-only and Sprite+child-Label nodes)
        if (binding.icon) {
            this.drawIconFill(binding.icon, template, slot);

            const label = this.resolveIconLabel(binding.icon);
            if (label) {
                if (slot.purchased) {
                    label.string = '✓';
                    label.color = new Color(220, 220, 220, 255);
                } else if (template?.emoji) {
                    label.string = template.emoji;
                    label.color = this.textColor;
                } else {
                    label.string = '?';
                    label.color = this.textColor;
                }
            }
        }

        // Update price
        if (binding.price) {
            const label = binding.price.getComponent(Label);
            if (label) {
                if (slot.purchased) {
                    label.string = 'SOLD';
                    label.color = this.purchasedColor;
                } else {
                    label.string = `${slot.price}g`;
                    label.color = this.goldColor;
                }
            }
        }

        // Update lock button visual
        if (binding.lockBtn) {
            const label = binding.lockBtn.getComponent(Label);
            if (label) {
                label.string = slot.locked ? '🔒' : '🔓';
            }
        }

        // Update buy button interactivity - keep listener, visual feedback only
        if (binding.buyBtn) {
            // Visual feedback handled in icon/price update
            // Click handler checks purchased state in handleBuy()
        }

        // Update slot background color via Sprite on bg node
        const runtimeNode = this.runtimeSlotNodes.get(index);
        if (runtimeNode) {
            const bgNode = runtimeNode.getChildByName('bg');
            const sprite = bgNode?.getComponent(Sprite);
            if (sprite) {
                if (slot.purchased) {
                    sprite.color = this.purchasedColor;
                } else if (slot.locked) {
                    sprite.color = this.lockedColor;
                } else {
                    sprite.color = this.slotColor;
                }
            }
        }
    }

    /**
     * Set slot to empty state
     */
    private setSlotEmpty(binding: SlotBinding): void {
        if (binding.icon) {
            const fillNode = binding.icon.getChildByName('_iconFill');
            const graphics = fillNode?.getComponent(Graphics);
            graphics?.clear();

            const label = this.resolveIconLabel(binding.icon);
            if (label) {
                label.string = '';
            }
        }
        if (binding.price) {
            const label = binding.price.getComponent(Label);
            if (label) {
                label.string = '';
            }
        }
    }

    // ============= Public API =============

    /**
     * Get slot count
     */
    public getSlotCount(): number {
        return this.slotCount;
    }

    /**
     * Get shop manager reference
     */
    public getShopManager(): ShopManager | null {
        return this.shopManager;
    }

    /**
     * Force refresh (alias for refreshShopUI)
     */
    public forceRefresh(): void {
        this.refreshShopUI();
    }

    // ============= Cleanup =============

    public onDestroy(): void {
        this.runtimeSlotNodes.forEach(node => node.destroy());
        this.runtimeSlotNodes.clear();

        if (this.runtimePurchasedListNode?.isValid) {
            this.runtimePurchasedListNode.destroy();
        }
        this.runtimePurchasedListNode = null;
        this.purchasedListLabel = null;
        this.purchasedItemCounts.clear();
        this.lastKnownDay = -1;

        this.slotBindings = [];
        this.interactiveHitNodes = [];
        this.dragTouchStartPos = null;
        this.dragStartSlotIndex = -1;
        this.hasLoggedHitBoundsDiagnostics = false;
        this.onBuyCallback = null;
        this.onRefreshCallback = null;
        this.onLockCallback = null;
    }
}
