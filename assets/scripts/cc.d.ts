/**
 * Minimal Cocos Creator type declarations
 */

// Re-export everything as any to bypass strict typing
export const cc: any;

export type Component = any;
export type Node = any;
export type Color = any;
export type UITransform = any;
export type Graphics = any;
export type Label = any;
export type Sprite = any;
export type SpriteFrame = any;
export type EventTouch = any;

// Decorator functions - _decorator is an object with ccclass and property
export const _decorator: {
    ccclass: any;
    property: any;
};
export const ccclass: any;
export const property: any;

// Provide mock constructors for value usage (new Color(), etc.)
export const Component: new (...args: any[]) => any;
export const Node: new (...args: any[]) => any;

// Node.EventType for event registration
export const NodeEventType = {
    TOUCH_START: 'touchstart',
    TOUCH_MOVE: 'touchmove',
    TOUCH_END: 'touchend',
    MOUSE_DOWN: 'mousedown',
    MOUSE_MOVE: 'mousemove',
    MOUSE_UP: 'mouseup',
};
export const Color: new (...args: any[]) => any;
export const UITransform: new (...args: any[]) => any;
export const Graphics: new (...args: any[]) => any;

// Label with static enums
export interface LabelConstructor {
    new (...args: any[]): any;
    HorizontalAlign: { CENTER: any; LEFT: any; RIGHT: any };
    VerticalAlign: { CENTER: any; TOP: any; BOTTOM: any };
}
export const Label: LabelConstructor;

export const Sprite: new (...args: any[]) => any;
export const SpriteFrame: new (...args: any[]) => any;

// EventTouch with static properties
export interface EventTouchConstructor {
    new (...args: any[]): any;
    TOUCH_END: any;
    TOUCH_START: any;
    TOUCH_MOVE: any;
}
export const EventTouch: EventTouchConstructor;

export const SpriteAtlas: new (...args: any[]) => any;
export const Button: new (...args: any[]) => any;
export type Button = any;

// Enum values
export const HorizontalAlign: any;
export const VerticalAlign: any;
export const TouchEvent: { TOUCH_END: any; TOUCH_START: any; TOUCH_MOVE: any };

// ============= ScreenAdapter dependencies =============

// view - screen/view management (Cocos 3.8.8 safe subset)
// NOTE: Only declare APIs that are stable and non-deprecated.
// ScreenAdapter uses (view as any) for optional APIs like
// getVisibleSize, getDesignResolutionSize, getSafeAreaRect.
export interface ViewInterface {
    on(event: string, callback: Function, target?: any): void;
    off(event: string, callback: Function, target?: any): void;
    // getVisibleSize and getDesignResolutionSize exist at runtime
    // but are called via (view as any) with typeof guards, so we
    // intentionally omit them here to force defensive access.
}
export const view: ViewInterface;

// Screen - screen class
export const Screen: new (...args: any[]) => any;

// Vec2 - 2D vector (both value and type)
export interface Vec2Interface {
    x: number;
    y: number;
    width: number;
    height: number;
    set(x: number, y: number): Vec2Interface;
}
export type Vec2 = Vec2Interface;
export const Vec2: new (...args?: number[]) => Vec2Interface;

// Vec4 - 4D vector (both value and type)
export interface Vec4Interface {
    x: number;
    y: number;
    z: number;
    w: number;
    width: number;
    height: number;
    set(x: number, y: number, z: number, w: number): Vec4Interface;
}
export type Vec4 = Vec4Interface;
export const Vec4: new (...args?: number[]) => Vec4Interface;

// Vec3 - 3D vector (both value and type)
export interface Vec3Interface {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): Vec3Interface;
}
export type Vec3 = Vec3Interface;
export const Vec3: new (...args?: number[]) => Vec3Interface;

// CCFloat / CCInteger - numeric property type markers
export const CCFloat: any;
export const CCInteger: any;

// Input - global input system
export interface InputInterface {
    on(event: string, callback: Function, target?: any): void;
    off(event: string, callback: Function, target?: any): void;
    getTouches(): any[];
}
export const input: InputInterface;
