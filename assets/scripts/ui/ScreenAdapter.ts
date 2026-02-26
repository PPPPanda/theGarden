/**
 * ScreenAdapter - WeChat Mini-Game Resolution & Safe Area Adapter
 * Handles different screen sizes, aspect ratios, and safe areas
 */

import { _decorator, Component, Node, UITransform, view, Vec2, CCFloat } from 'cc';

const { ccclass, property } = _decorator;

/** Screen orientation */
export enum Orientation {
    Portrait = 'portrait',
    Landscape = 'landscape',
    Auto = 'auto'
}

/** Safe area configuration */
export interface SafeAreaConfig {
    top: number;      // Top safe area (notch)
    bottom: number;   // Bottom safe area (home indicator)
    left: number;     // Left safe area
    right: number;   // Right safe area
}

/** Common device resolutions */
export const DEVICE_RESOLUTIONS = {
    // iPhone series
    IPHONE_SE: { width: 320, height: 568, ratio: 0.563 },
    IPHONE_X: { width: 375, height: 812, ratio: 0.462 },
    IPHONE_XR: { width: 414, height: 896, ratio: 0.462 },
    IPHONE_12_MINI: { width: 360, height: 780, ratio: 0.462 },
    IPHONE_12: { width: 390, height: 844, ratio: 0.462 },
    IPHONE_12_PRO_MAX: { width: 428, height: 926, ratio: 0.462 },
    IPHONE_14: { width: 390, height: 844, ratio: 0.462 },
    IPHONE_14_PRO: { width: 393, height: 852, ratio: 0.461 },
    IPHONE_14_PRO_MAX: { width: 430, height: 932, ratio: 461 },
    
    // Android common
    ANDROID_720P: { width: 720, height: 1280, ratio: 0.5625 },
    ANDROID_1080P: { width: 1080, height: 1920, ratio: 0.5625 },
    ANDROID_1440P: { width: 1440, height: 2560, ratio: 0.5625 },
    
    // WeChat mini-game common
    WECHAT_MINI: { width: 375, height: 667, ratio: 0.562 },
    WECHAT_MINI_PRO: { width: 414, height: 896, ratio: 0.462 }
};

/** Reference design resolution */
const REFERENCE_WIDTH = 720;
const REFERENCE_HEIGHT = 1280;
const REFERENCE_RATIO = REFERENCE_WIDTH / REFERENCE_HEIGHT;

@ccclass('ScreenAdapter')
export class ScreenAdapter extends Component {
    // ============= Properties =============

    @property({ tooltip: 'Target orientation (portrait / landscape / auto)' })
    public targetOrientation: Orientation = Orientation.Portrait;

    @property({ type: CCFloat, tooltip: 'Reference design width' })
    public referenceWidth: number = REFERENCE_WIDTH;

    @property({ type: CCFloat, tooltip: 'Reference design height' })
    public referenceHeight: number = REFERENCE_HEIGHT;

    @property({ type: CCFloat, tooltip: 'Minimum safe area padding (percentage)' })
    public minSafeAreaPadding: number = 0.02; // 2%

    @property({ type: CCFloat, tooltip: 'HUD top margin (percentage)' })
    public hudTopMargin: number = 0.08; // 8%

    @property({ type: CCFloat, tooltip: 'HUD bottom margin (percentage)' })
    public hudBottomMargin: number = 0.12; // 12%

    @property({ type: CCFloat, tooltip: 'Side margins (percentage)' })
    public sideMargin: number = 0.03; // 3%

    @property({ type: CCFloat, tooltip: 'Button minimum size (pixels)' })
    public minButtonSize: number = 44; // Touch-friendly size

    @property({ type: CCFloat, tooltip: 'Grid maximum width percentage' })
    public maxGridWidthPercent: number = 0.9; // 90%

    // ============= Private Fields =============

    private _screenSize: Vec2 = new Vec2();
    private _safeArea: SafeAreaConfig = { top: 0, bottom: 0, left: 0, right: 0 };
    private _scaleFactor: number = 1;
    private _isInitialized: boolean = false;
    private _lastOrientation: Orientation = Orientation.Auto;
    
    // Cached UI element references
    private _hudTopNode: Node | null = null;
    private _hudBottomNode: Node | null = null;
    private _leftPanelNode: Node | null = null;
    private _rightPanelNode: Node | null = null;
    private _centerContentNode: Node | null = null;

    // ============= Lifecycle =============

    /**
     * Called when component is loaded
     */
    onLoad(): void {
        this.initialize();
    }

    /**
     * Called when component is enabled
     */
    onEnable(): void {
        this.updateSafeArea();
        this.updateLayout();
        
        // Register resize listener — guard in case view.on is not available
        try {
            if (typeof view.on === 'function') {
                view.on('canvas-resize', this.onCanvasResize, this);
            }
        } catch (_e) { /* Editor Preview may not support this event */ }
        
        // WeChat mini-game specific
        this.setupWeChatSafeArea();
    }

    /**
     * Called when component is disabled
     */
    onDisable(): void {
        try {
            if (typeof view.off === 'function') {
                view.off('canvas-resize', this.onCanvasResize, this);
            }
        } catch (_e) { /* Ignore */ }
    }

    /**
     * Called every frame
     */
    update(deltaTime: number): void {
        // Check for orientation change
        const currentOrientation = this.getCurrentOrientation();
        if (currentOrientation !== this._lastOrientation) {
            this._lastOrientation = currentOrientation;
            this.updateLayout();
        }
    }

    // ============= Initialization =============

    /**
     * Initialize adapter
     */
    public initialize(): void {
        if (this._isInitialized) return;
        
        this.updateScreenSize();
        this.updateSafeArea();
        this.calculateScaleFactor();
        
        this._isInitialized = true;
    }

    /**
     * Update screen size using Cocos 3.8.8-safe APIs.
     * Avoids deprecated view.getCanvasSize() which logs warnings in Editor Preview.
     */
    private updateScreenSize(): void {
        try {
            const viewAny = view as any;
            // Prefer getVisibleSize (stable across Cocos 3.x, no deprecation warning)
            if (typeof viewAny.getVisibleSize === 'function') {
                const vs = viewAny.getVisibleSize();
                if (vs && typeof vs.width === 'number') {
                    this._screenSize.set(vs.width, vs.height);
                    return;
                }
            }
            // Fallback: getDesignResolutionSize (also stable)
            if (typeof viewAny.getDesignResolutionSize === 'function') {
                const ds = viewAny.getDesignResolutionSize();
                if (ds && typeof ds.width === 'number') {
                    this._screenSize.set(ds.width, ds.height);
                    return;
                }
            }
        } catch (_e) {
            // Silently fall through
        }
        // Ultimate fallback: reference design resolution
        this._screenSize.set(this.referenceWidth, this.referenceHeight);
    }

    /**
     * Calculate scale factor based on screen size
     */
    private calculateScaleFactor(): void {
        const screenRatio = this._screenSize.x / this._screenSize.y;
        const refRatio = this.referenceWidth / this.referenceHeight;

        if (screenRatio > refRatio) {
            // Screen is wider - scale by height
            this._scaleFactor = this._screenSize.y / this.referenceHeight;
        } else {
            // Screen is taller - scale by width
            this._scaleFactor = this._screenSize.x / this.referenceWidth;
        }

        // Clamp scale factor to reasonable range
        this._scaleFactor = Math.max(0.5, Math.min(2.0, this._scaleFactor));
    }

    // ============= Safe Area =============

    /**
     * Update safe area from system (Cocos 3.8.8-safe)
     */
    public updateSafeArea(): void {
        // Default: full screen is safe
        let safeRect = { x: 0, y: 0, width: this._screenSize.x, height: this._screenSize.y };

        try {
            // getSafeAreaRect may not exist or may throw in Editor Preview
            const viewAny = view as any;
            if (typeof viewAny.getSafeAreaRect === 'function') {
                const r = viewAny.getSafeAreaRect();
                if (r && typeof r.width === 'number') {
                    safeRect = { x: r.x, y: r.y, width: r.width, height: r.height };
                }
            }
        } catch (_e) {
            // Silently fall back to full screen
        }
        
        // Convert to our format (in pixels)
        this._safeArea = {
            top: safeRect.y,
            bottom: this._screenSize.y - safeRect.y - safeRect.height,
            left: safeRect.x,
            right: this._screenSize.x - safeRect.x - safeRect.width
        };

        // Apply minimum padding
        const minPadding = Math.min(this._screenSize.x, this._screenSize.y) * this.minSafeAreaPadding;
        this._safeArea.top = Math.max(this._safeArea.top, minPadding);
        this._safeArea.bottom = Math.max(this._safeArea.bottom, minPadding);
        this._safeArea.left = Math.max(this._safeArea.left, minPadding);
        this._safeArea.right = Math.max(this._safeArea.right, minPadding);
    }

    /**
     * Setup WeChat mini-game specific safe area
     */
    private setupWeChatSafeArea(): void {
        // @ts-ignore
        const wx = (window as any).wx;
        if (!wx) return;

        try {
            // Get system info
            const systemInfo = wx.getSystemInfoSync();
            
            // Get safe area (WeChat specific)
            if (systemInfo.safeArea) {
                const safeArea = systemInfo.safeArea;
                const screenHeight = systemInfo.screenHeight;
                const screenWidth = systemInfo.screenWidth;
                const pixelRatio = systemInfo.pixelRatio || 1;

                // Calculate safe area in CSS pixels
                this._safeArea = {
                    top: (safeArea.top / pixelRatio),
                    bottom: (screenHeight - safeArea.bottom) / pixelRatio,
                    left: (safeArea.left / pixelRatio),
                    right: (screenWidth - safeArea.right) / pixelRatio
                };
            }

            // Handle notch devices
            if (systemInfo.model && (
                systemInfo.model.includes('iPhone') || 
                systemInfo.model.includes('iPad')
            )) {
                // iOS devices typically have notch
                this._safeArea.top = Math.max(this._safeArea.top, 44);
                this._safeArea.bottom = Math.max(this._safeArea.bottom, 34);
            }
        } catch (e) {
            console.warn('WeChat safe area setup failed:', e);
        }
    }

    /**
     * Get safe area
     */
    public getSafeArea(): SafeAreaConfig {
        return { ...this._safeArea };
    }

    /**
     * Get safe area as percentage of screen
     */
    public getSafeAreaPercent(): SafeAreaConfig {
        return {
            top: this._safeArea.top / this._screenSize.y,
            bottom: this._safeArea.bottom / this._screenSize.y,
            left: this._safeArea.left / this._screenSize.x,
            right: this._safeArea.right / this._screenSize.x
        };
    }

    // ============= Layout =============

    /**
     * Update layout for current screen
     */
    public updateLayout(): void {
        this.updateScreenSize();
        this.updateSafeArea();
        this.calculateScaleFactor();

        // Update all registered UI elements
        this.updateHudPositions();
        this.updatePanels();
        this.updateContent();
    }

    /**
     * Update HUD positions (top and bottom bars).
     * Cocos UI coordinate origin is at the CENTER of the Canvas.
     * Top edge = +screenSize.y/2, Bottom edge = -screenSize.y/2.
     */
    private updateHudPositions(): void {
        const safeArea = this._safeArea; // In pixels
        const halfH = this._screenSize.y / 2;

        // Top HUD — anchored to top edge minus safe-area inset
        if (this._hudTopNode) {
            const transform = this._hudTopNode.getComponent(UITransform);
            if (transform) {
                const y = halfH - safeArea.top - transform.height / 2;
                this._hudTopNode.setPosition(0, y, 0);
            }
        }

        // Bottom HUD — anchored to bottom edge plus safe-area inset
        if (this._hudBottomNode) {
            const transform = this._hudBottomNode.getComponent(UITransform);
            if (transform) {
                const y = -halfH + safeArea.bottom + transform.height / 2;
                this._hudBottomNode.setPosition(0, y, 0);
            }
        }
    }

    /**
     * Update side panels (Cocos centered coordinates).
     */
    private updatePanels(): void {
        const safeArea = this._safeArea; // In pixels
        const halfW = this._screenSize.x / 2;

        // Left panel — anchored to left edge plus safe-area inset
        if (this._leftPanelNode) {
            const transform = this._leftPanelNode.getComponent(UITransform);
            if (transform) {
                const x = -halfW + safeArea.left + transform.width / 2;
                this._leftPanelNode.setPosition(x, 0, 0);
            }
        }

        // Right panel — anchored to right edge minus safe-area inset
        if (this._rightPanelNode) {
            const transform = this._rightPanelNode.getComponent(UITransform);
            if (transform) {
                const x = halfW - safeArea.right - transform.width / 2;
                this._rightPanelNode.setPosition(x, 0, 0);
            }
        }
    }

    /**
     * Update center content (like grid)
     */
    private updateContent(): void {
        if (!this._centerContentNode) return;

        const safeArea = this.getSafeAreaPercent();
        const transform = this._centerContentNode.getComponent(UITransform);
        
        if (!transform) return;

        // Calculate available space
        const availableWidth = this._screenSize.x * (1 - safeArea.left - safeArea.right - this.sideMargin * 2);
        const availableHeight = this._screenSize.y * (1 - safeArea.top - safeArea.bottom - this.hudTopMargin - this.hudBottomMargin);

        // Scale content to fit
        const contentWidth = transform.width;
        const contentHeight = transform.height;

        let scale = Math.min(
            availableWidth / contentWidth,
            availableHeight / contentHeight,
            this.maxGridWidthPercent * this._screenSize.x / contentWidth
        );

        // Apply minimum scale
        scale = Math.max(0.5, Math.min(1.5, scale));

        this._centerContentNode.setScale(scale, scale, 1);
    }

    // ============= UI Element Registration =============

    /**
     * Register top HUD node
     */
    public registerHudTop(node: Node): void {
        this._hudTopNode = node;
        this.updateHudPositions();
    }

    /**
     * Register bottom HUD node
     */
    public registerHudBottom(node: Node): void {
        this._hudBottomNode = node;
        this.updateHudPositions();
    }

    /**
     * Register left panel node
     */
    public registerLeftPanel(node: Node): void {
        this._leftPanelNode = node;
        this.updatePanels();
    }

    /**
     * Register right panel node
     */
    public registerRightPanel(node: Node): void {
        this._rightPanelNode = node;
        this.updatePanels();
    }

    /**
     * Register center content node
     */
    public registerCenterContent(node: Node): void {
        this._centerContentNode = node;
        this.updateContent();
    }

    // ============= Utility Methods =============

    /**
     * Convert position to safe area aware position
     */
    public toSafeAreaPosition(x: number, y: number): { x: number, y: number } {
        const safeArea = this.getSafeAreaPercent();
        
        return {
            x: x + safeArea.left * this._screenSize.x,
            y: y + safeArea.bottom * this._screenSize.y
        };
    }

    /**
     * Get scaled value
     */
    public getScaledValue(value: number): number {
        return value * this._scaleFactor;
    }

    /**
     * Get scaled size for touch target
     */
    public getScaledTouchSize(size: number): number {
        return Math.max(size * this._scaleFactor, this.minButtonSize);
    }

    /**
     * Check if point is in safe area
     */
    public isInSafeArea(x: number, y: number): boolean {
        const safeArea = this._safeArea;
        
        return x >= safeArea.left &&
               x <= this._screenSize.x - safeArea.right &&
               y >= safeArea.bottom &&
               y <= this._screenSize.y - safeArea.top;
    }

    /**
     * Get current orientation
     */
    public getCurrentOrientation(): Orientation {
        if (this.targetOrientation !== Orientation.Auto) {
            return this.targetOrientation;
        }

        return this._screenSize.x > this._screenSize.y 
            ? Orientation.Landscape 
            : Orientation.Portrait;
    }

    /**
     * Get screen size
     */
    public getScreenSize(): Vec2 {
        return new Vec2(this._screenSize.x, this._screenSize.y);
    }

    /**
     * Get scale factor
     */
    public getScaleFactor(): number {
        return this._scaleFactor;
    }

    /**
     * Get visible size accounting for safe area
     */
    public getVisibleSize(): { width: number, height: number } {
        const safeArea = this._safeArea;
        return {
            width: this._screenSize.x - safeArea.left - safeArea.right,
            height: this._screenSize.y - safeArea.top - safeArea.bottom
        };
    }

    // ============= Event Handlers =============

    /**
     * Handle canvas resize
     */
    private onCanvasResize(): void {
        this.updateLayout();
    }

    // ============= Legacy Support =============

    /**
     * Legacy method for getting design resolution
     * @deprecated Use getVisibleSize instead
     */
    public getDesignResolution(): { width: number, height: number } {
        return {
            width: this.referenceWidth,
            height: this.referenceHeight
        };
    }

    /**
     * Legacy method for adapting position
     * @deprecated Use toSafeAreaPosition instead
     */
    public adaptPosition(x: number, y: number): { x: number, y: number } {
        return this.toSafeAreaPosition(x, y);
    }
}

// Export types (removed duplicate re-export)
// SafeAreaConfig already exported via interface above
