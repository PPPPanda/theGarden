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

// Enum values
export const HorizontalAlign: any;
export const VerticalAlign: any;
export const TouchEvent: { TOUCH_END: any; TOUCH_START: any; TOUCH_MOVE: any };
