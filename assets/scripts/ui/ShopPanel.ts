/**
 * ShopPanel - Shop Panel Cocos Component
 * Displays shop items, handles purchase and refresh interactions
 */

import { _decorator, Component, Node, Graphics, Label, Color, UITransform, EventTouch } from 'cc';
import { ShopManager } from '../core/ShopManager';
import { GameLoop } from '../core/GameLoop';
import { IShopSlot, IItemTemplate } from '../core/types';

const { ccclass, property } = _decorator;

@ccclass('ShopPanel')
export class ShopPanel extends Component {
    // ============= Properties =============

    @property({ type: Number, tooltip: 'Shop slot size in pixels' })
    public slotSize: number = 80;

    @property({ type: Number, tooltip: 'Gap between slots' })
    public slotGap: number = 10;

    @property({ type: Color, tooltip: 'Slot background color' })
    public slotColor: Color = new Color(60, 60, 60, 200);

    @property({ type: Color, tooltip: 'Purchased slot color' })
    public purchasedColor: Color = new Color(100, 100, 100, 150);

    @property({ type: Color, tooltip: 'Locked slot color' })
    public lockedColor: Color = new Color(255, 215, 0, 100);

    @property({ type: Color, tooltip: 'Text color' })
    public textColor: Color = new Color(255, 255, 255, 255);

    @property({ type: Color, tooltip: 'Gold color' })
    public goldColor: Color = new Color(255, 215, 0, 255);

    // ============= Lifecycle =============

    onLoad(): void {
        this.createShopUI();
    }

    start(): void {
        this.refreshDisplay();
    }

    // ============= Dependencies =============

    private shopManager: ShopManager | null = null;
    private gameLoop: GameLoop | null = null;
    private slotNodes: Map<number, Node> = new Map();
    private goldLabel: Label | null = null;
    private refreshCostLabel: Label | null = null;

    /**
     * Initialize with dependencies
     */
    public init(shopManager: ShopManager, gameLoop: GameLoop): void {
        this.shopManager = shopManager;
        this.gameLoop = gameLoop;
        this.refreshDisplay();
    }

    // ============= UI Creation =============

    /**
     * Create shop UI elements
     */
    private createShopUI(): void {
        // Create shop container
        this.createGoldDisplay();
        this.createRefreshButton();
        this.createSlots();
    }

    /**
     * Create gold display
     */
    private createGoldDisplay(): void {
        const goldNode = new Node('goldDisplay');
        const transform = goldNode.addComponent(UITransform);
        transform.setContentSize(150, 30);
        goldNode.setPosition(0, -30, 0);
        this.node.addChild(goldNode);

        this.goldLabel = goldNode.addComponent(Label);
        this.goldLabel.fontSize = 24;
        this.goldLabel.color = this.goldColor;
        this.goldLabel.string = 'Gold: 0';
    }

    /**
     * Create refresh button
     */
    private createRefreshButton(): void {
        const refreshNode = new Node('refreshButton');
        const transform = refreshNode.addComponent(UITransform);
        transform.setContentSize(100, 40);
        refreshNode.setPosition(0, -80, 0);
        this.node.addChild(refreshNode);

        // Background
        const graphics = refreshNode.addComponent(Graphics);
        graphics.fillColor = new Color(100, 150, 255, 200);
        graphics.rect(-50, -20, 100, 40);
        graphics.fill();

        // Label
        const labelNode = new Node('label');
        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(90, 30);
        labelNode.setPosition(0, 0, 0);
        refreshNode.addChild(labelNode);

        const label = labelNode.addComponent(Label);
        label.fontSize = 20;
        label.color = this.textColor;
        label.string = 'Refresh: 2g';

        this.refreshCostLabel = label;

        // Touch event
        refreshNode.on(EventTouch.TOUCH_END, () => this.onRefreshClicked(), this);
    }

    /**
     * Create shop slots
     */
    private createSlots(): void {
        const totalWidth = 5 * this.slotSize + 4 * this.slotGap;
        const startX = -totalWidth / 2 + this.slotSize / 2;

        for (let i = 0; i < 5; i++) {
            const slotNode = new Node(`slot_${i}`);
            const transform = slotNode.addComponent(UITransform);
            transform.setContentSize(this.slotSize, this.slotSize);
            slotNode.setPosition(startX + i * (this.slotSize + this.slotGap), 30, 0);
            this.node.addChild(slotNode);

            // Store reference
            this.slotNodes.set(i, slotNode);

            // Touch event for purchase
            slotNode.on(EventTouch.TOUCH_END, () => this.onSlotClicked(i), this);

            // Create slot content
            this.createSlotContent(slotNode, i);
        }
    }

    /**
     * Create slot content (background + emoji + price)
     */
    private createSlotContent(slotNode: Node, index: number): void {
        // Background
        const bg = slotNode.addComponent(Graphics);
        bg.fillColor = this.slotColor;
        bg.rect(-this.slotSize / 2, -this.slotSize / 2, this.slotSize, this.slotSize);
        bg.fill();

        // Emoji label
        const emojiNode = new Node('emoji');
        const emojiTransform = emojiNode.addComponent(UITransform);
        emojiTransform.setContentSize(this.slotSize * 0.7, this.slotSize * 0.7);
        emojiNode.setPosition(0, 5, 0);
        slotNode.addChild(emojiNode);

        const emojiLabel = emojiNode.addComponent(Label);
        emojiLabel.fontSize = Math.floor(this.slotSize * 0.5);
        emojiLabel.color = this.textColor;
        emojiLabel.string = '?';
        (emojiLabel as any)._slotIndex = index;
        (emojiLabel as any)._slotEmoji = emojiLabel;

        // Price label
        const priceNode = new Node('price');
        const priceTransform = priceNode.addComponent(UITransform);
        priceTransform.setContentSize(this.slotSize * 0.8, 20);
        priceNode.setPosition(0, -this.slotSize / 2 + 12, 0);
        slotNode.addChild(priceNode);

        const priceLabel = priceNode.addComponent(Label);
        priceLabel.fontSize = 16;
        priceLabel.color = this.goldColor;
        priceLabel.string = '0g';
        (priceLabel as any)._slotIndex = index;
        (priceLabel as any)._slotPrice = priceLabel;
    }

    // ============= Interactions =============

    /**
     * Handle slot click for purchase
     */
    private onSlotClicked(index: number): void {
        if (!this.shopManager || !this.gameLoop) {
            console.warn('ShopPanel: not initialized');
            return;
        }

        const slot = this.shopManager.getSlot(index);
        if (!slot || slot.purchased) {
            console.log(`ShopPanel: slot ${index} is not available`);
            return;
        }

        // Try to purchase via MainScene/GameLoop
        // Note: This requires a MainScene reference - for now use gameLoop directly
        const playerGold = this.gameLoop.getPlayerGold();
        const slotInfo = this.shopManager.canPurchase(index);

        if (!slotInfo) {
            console.log('ShopPanel: cannot purchase - invalid slot');
            return;
        }

        if (playerGold < slotInfo.cost) {
            console.log(`ShopPanel: not enough gold (have ${playerGold}, need ${slotInfo.cost})`);
            this.showFeedback('Not enough gold!', false);
            return;
        }

        // Attempt purchase - for now just mark as purchased and deduct gold
        // In full implementation, would call MainScene.purchaseFromShop()
        const success = this.shopManager.markPurchased(index);
        if (success) {
            // Deduct gold
            (this.gameLoop as any).deductGold(slotInfo.cost);
            console.log(`ShopPanel: purchased ${slotInfo.template.name} for ${slotInfo.cost}g`);
            this.showFeedback(`Purchased: ${slotInfo.template.name}`, true);
            this.refreshDisplay();
        }
    }

    /**
     * Handle refresh button click
     */
    private onRefreshClicked(): void {
        if (!this.shopManager || !this.gameLoop) {
            console.warn('ShopPanel: not initialized');
            return;
        }

        const refreshCost = this.shopManager.getRefreshCost();
        const playerGold = this.gameLoop.getPlayerGold();

        if (playerGold < refreshCost) {
            console.log(`ShopPanel: not enough gold for refresh (have ${playerGold}, need ${refreshCost})`);
            this.showFeedback('Not enough gold for refresh!', false);
            return;
        }

        // Deduct gold and refresh
        (this.gameLoop as any).deductGold(refreshCost);
        this.shopManager.refreshResult();

        console.log(`ShopPanel: refreshed shop for ${refreshCost}g`);
        this.showFeedback('Shop refreshed!', true);
        this.refreshDisplay();
    }

    /**
     * Show feedback message
     */
    private showFeedback(message: string, success: boolean): void {
        // Simple console feedback - could be enhanced with UI
        console.log(`[ShopPanel] ${success ? '✓' : '✗'} ${message}`);
    }

    // ============= Display Updates =============

    /**
     * Refresh entire display
     */
    public refreshDisplay(): void {
        this.updateGoldDisplay();
        this.updateRefreshCostDisplay();
        this.updateSlots();
    }

    /**
     * Update gold display
     */
    private updateGoldDisplay(): void {
        if (!this.gameLoop) return;

        const gold = this.gameLoop.getPlayerGold();
        if (this.goldLabel) {
            this.goldLabel.string = `Gold: ${gold}`;
        }
    }

    /**
     * Update refresh cost display
     */
    private updateRefreshCostDisplay(): void {
        if (!this.shopManager || !this.refreshCostLabel) return;

        const cost = this.shopManager.getRefreshCost();
        this.refreshCostLabel.string = `Refresh: ${cost}g`;
    }

    /**
     * Update all slot displays
     */
    private updateSlots(): void {
        if (!this.shopManager) return;

        for (let i = 0; i < 5; i++) {
            this.updateSlot(i);
        }
    }

    /**
     * Update single slot
     */
    private updateSlot(index: number): void {
        const slotNode = this.slotNodes.get(index);
        if (!slotNode || !this.shopManager) return;

        const slot = this.shopManager.getSlot(index);
        if (!slot) return;

        // Find children
        const emojiLabel = slotNode.getChildByName('emoji')?.getComponent(Label);
        const priceLabel = slotNode.getChildByName('price')?.getComponent(Label);
        const graphics = slotNode.getComponent(Graphics);

        if (slot.purchased) {
            // Purchased - show empty
            if (emojiLabel) emojiLabel.string = '✓';
            if (priceLabel) priceLabel.string = '';
            if (graphics) graphics.fillColor = this.purchasedColor;
        } else if (slot.locked) {
            // Locked - show lock icon
            if (emojiLabel) emojiLabel.string = '🔒';
            if (priceLabel) priceLabel.string = `${slot.price}g`;
            if (graphics) graphics.fillColor = this.lockedColor;
        } else {
            // Available - show item
            const template = (this.shopManager as any).itemDB?.getTemplate(slot.templateId);
            if (emojiLabel) emojiLabel.string = template?.emoji ?? '?';
            if (priceLabel) priceLabel.string = `${slot.price}g`;
            if (graphics) graphics.fillColor = this.slotColor;
        }

        // Redraw background
        graphics?.rect(-this.slotSize / 2, -this.slotSize / 2, this.slotSize, this.slotSize);
        graphics?.fill();
    }

    // ============= Public Methods =============

    /**
     * Update gold - call this when gold changes externally
     */
    public updateGold(): void {
        this.updateGoldDisplay();
    }

    /**
     * Refresh shop display - call after any shop change
     */
    public refreshShop(): void {
        this.refreshDisplay();
    }
}
