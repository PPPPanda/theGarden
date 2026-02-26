/**
 * ShopPanel - Shop Panel Cocos Component
 * Displays shop slots with item icons, prices, buy/lock buttons.
 * All purchase/refresh/lock logic delegated via callbacks to MainScene.
 */

import { _decorator, Component, Node, Label, Color, UITransform, EventTouch, Sprite, Button } from 'cc';
import { ShopManager } from '../core/ShopManager';
import { GameLoop } from '../core/GameLoop';
import { ItemDB } from '../core/ItemDB';
import { IShopSlot, IItemTemplate } from '../core/types';

const { ccclass, property } = _decorator;

/** Per-slot bound nodes */
interface SlotBinding {
    icon: Node | null;
    price: Node | null;
    buyBtn: Node | null;
    lockBtn: Node | null;
}

@ccclass('ShopPanel')
export class ShopPanel extends Component {
    // ============= Layout Properties =============

    @property({ type: Number, tooltip: 'Shop slot size in pixels' })
    public slotSize: number = 80;

    @property({ type: Number, tooltip: 'Gap between slots' })
    public slotGap: number = 10;

    @property({ type: Number, tooltip: 'Number of shop slots (3-5)' })
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
     * Wire button events
     */
    private wireEvents(): void {
        // Slot buy/lock buttons
        for (let i = 0; i < this.slotBindings.length; i++) {
            const binding = this.slotBindings[i];
            const slotIdx = i;

            if (binding.buyBtn) {
                binding.buyBtn.off(EventTouch.TOUCH_END);
                binding.buyBtn.on(EventTouch.TOUCH_END, () => this.handleBuy(slotIdx), this);
            }
            if (binding.lockBtn) {
                binding.lockBtn.off(EventTouch.TOUCH_END);
                binding.lockBtn.on(EventTouch.TOUCH_END, () => this.handleLock(slotIdx), this);
            }
            
            // Add drag detection on slot icon
            if (binding.icon) {
                binding.icon.off(EventTouch.TOUCH_START);
                binding.icon.off(EventTouch.TOUCH_MOVE);
                binding.icon.off(EventTouch.TOUCH_END);
                
                binding.icon.on(EventTouch.TOUCH_START, (event: EventTouch) => {
                    const pos = event.touch?.getLocation();
                    if (pos) {
                        this.dragTouchStartPos = { x: pos.x, y: pos.y };
                        this.dragStartSlotIndex = slotIdx;
                    }
                }, this);
                
                binding.icon.on(EventTouch.TOUCH_MOVE, (event: EventTouch) => {
                    if (this.dragTouchStartPos && this.dragStartSlotIndex >= 0) {
                        const pos = event.touch?.getLocation();
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

        // Refresh button
        const refreshNode = this.refreshBtn ?? this.node.getChildByName('refreshBtn');
        if (refreshNode) {
            refreshNode.off(EventTouch.TOUCH_END);
            refreshNode.on(EventTouch.TOUCH_END, () => this.handleRefresh(), this);
        }
    }

    /**
     * Handle drag start from shop slot
     */
    private handleDragStart(slotIndex: number, worldPos: {x: number, y: number}): void {
        if (!this.onDragStartFromShopCallback) return;
        
        const slot = this.shopManager?.getSlot(slotIndex);
        if (!slot || !slot.templateId) return;
        
        const templateId = slot.templateId;
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
     * Handle buy button press
     */
    private handleBuy(slotIndex: number): void {
        // Check if slot is already purchased
        const slot = this.shopManager?.getSlot(slotIndex);
        if (!slot) {
            console.warn('ShopPanel: invalid slot index');
            return;
        }
        if (slot.purchased) {
            console.warn('ShopPanel: slot already purchased');
            return;
        }

        if (this.onBuyCallback) {
            const success = this.onBuyCallback(slotIndex);
            if (success) {
                this.refreshShopUI();
            }
            return;
        }

        // No callback set — purchase requires position from MainScene
        console.warn('ShopPanel: no onBuy callback set, purchase requires MainScene wiring');
    }

    /**
     * Handle refresh button press
     */
    private handleRefresh(): void {
        if (this.onRefreshCallback) {
            const success = this.onRefreshCallback();
            if (success) {
                this.refreshShopUI();
            }
            return;
        }

        // Fallback: direct refresh via gameLoop
        if (!this.gameLoop) return;
        const success = this.gameLoop.refreshShop();
        if (success) {
            this.refreshShopUI();
        }
    }

    /**
     * Handle lock button press
     */
    private handleLock(slotIndex: number): void {
        if (this.onLockCallback) {
            const success = this.onLockCallback(slotIndex);
            if (success) {
                this.refreshShopUI();
            }
            return;
        }

        // Fallback: direct lock toggle via shopManager
        if (!this.shopManager) return;
        this.shopManager.toggleLock(slotIndex);
        this.refreshShopUI();
    }

    // ============= Display Refresh =============

    /**
     * Refresh entire shop UI
     */
    public refreshShopUI(): void {
        this.updateGoldDisplay();
        this.updateRefreshDisplay();
        this.updateAllSlots();
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

        // Update icon
        if (binding.icon) {
            const label = binding.icon.getComponent(Label);
            if (label) {
                if (slot.purchased) {
                    label.string = '✓';
                    label.color = this.purchasedColor;
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
            const label = binding.icon.getComponent(Label);
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
        this.slotBindings = [];
        this.onBuyCallback = null;
        this.onRefreshCallback = null;
        this.onLockCallback = null;
    }
}
