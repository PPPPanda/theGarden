# Cocos Creator 3.8 Scripting Guide

> Source: https://docs.cocos.com/creator/3.8/manual/en/scripting/
> Downloaded for offline agent reference.

---

## 1. Operating Environment

All Cocos Creator engine APIs exist in the module `cc`. Import using standard ES6 syntax:

```ts
import {
  Component,
  _decorator,
  Vec3,
  Node,
  Label,
  Sprite,
  Color,
  find,
  director,
  EventTarget,
  CCInteger,
  CCFloat,
  CCString,
  CCBoolean,
} from 'cc';
const { ccclass, property, integer, float, type, executeInEditMode, requireComponent, executionOrder, disallowMultiple, menu } = _decorator;
```

**Reserved identifier:** `cc` is reserved. Don't use `cc` as a global variable name.

---

## 2. Creating Component Scripts

A component script extends `Component` and uses the `@ccclass` decorator:

```ts
import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MyComponent')
export class MyComponent extends Component {
    start() { }
    update(deltaTime: number) { }
}
```

**Rules:**
- Class name in `@ccclass('Name')` must be **unique** across the entire project (even across directories)
- Class name and file name are independent after creation — renaming the file doesn't change the class name
- Use TypeScript (`.ts`) files

---

## 3. Decorators

### @ccclass

Registers the class with the Cocos Creator serialization system. Without it, the class **cannot** be added as a component.

```ts
@ccclass('Example')
export class Example extends Component { }
```

### Component Class Decorators

| Decorator | Purpose | Example |
|---|---|---|
| `@executeInEditMode(true)` | Run lifecycle in editor | `@executeInEditMode(true)` |
| `@requireComponent(Sprite)` | Auto-add dependency | `@requireComponent(Sprite)` |
| `@executionOrder(3)` | Control execution priority | Lower = earlier |
| `@disallowMultiple(true)` | One per node | Prevent duplicate components |
| `@menu('foo/bar')` | Add to component menu | Shows in Add Component dropdown |

### @property Decorator

Exposes properties to the Inspector panel and enables serialization:

```ts
@property({ type: Node, tooltip: "Target node" })
targetNode: Node | null = null;

@property({ type: [Node] })
children: Node[] = [];

@property
speed: number = 10;    // Auto-detected as CCFloat

@property(CCInteger)
count: number = 0;     // Explicit integer

@property(Label)
label: Label | null = null;  // Component reference
```

**Type shortcuts:**
```ts
@integer     // same as @property(CCInteger)
@float       // same as @property(CCFloat)
@type(Node)  // same as @property(Node)
```

**Visibility rules:**
- Properties starting with `_` are hidden by default
- Force show: `@property({ visible: true })`
- Force hide: `@property({ visible: false })`

**Property attributes:**

| Attribute | Type | Description |
|---|---|---|
| `type` | Any | CC type (Node, CCInteger, [Node], etc.) |
| `visible` | boolean | Show in Inspector |
| `displayName` | string | Display as different name |
| `tooltip` | string | Hover tooltip |
| `serializable` | boolean | Serialize (default: true) |
| `override` | boolean | Override parent property |
| `min` / `max` / `step` | number | Numeric constraints |
| `range` | [min, max, step?] | Range with optional step |
| `slide` | boolean | Show as slider |
| `multiline` | boolean | Multi-line text |
| `readonly` | boolean | Read-only in Inspector |
| `group` | { name, id?, displayOrder?, style? } | Group properties |
| `formerlySerializedAs` | string | Migration from old name |

---

## 4. Life Cycle Callbacks

Execution order (top to bottom):

```
onLoad()      → First activation (node becomes active). Guaranteed: other nodes accessible.
                Always called before any start().
onEnable()    → enabled changes false→true, or node activates.
start()       → Before first update(). One-time init that needs other components ready.
update(dt)    → Every frame, before animations.
lateUpdate(dt)→ Every frame, after animations/physics.
onDisable()   → enabled changes true→false, or node deactivates.
onDestroy()   → After destroy() called, at end of frame.
```

```ts
@ccclass('Example')
export class Example extends Component {
    onLoad() {
        // Init: access other nodes, load references
    }
    
    start() {
        // Init state that may change during gameplay
    }
    
    update(deltaTime: number) {
        // Per-frame game logic
    }
    
    lateUpdate(deltaTime: number) {
        // After animation/physics updates
    }
    
    onDestroy() {
        // Cleanup
    }
}
```

---

## 5. Accessing Nodes and Components

### Get own node
```ts
this.node  // The Node this component is attached to
```

### Get component on same node
```ts
this.getComponent(Label)         // By class
this.getComponent("MyScript")    // By class name string
this.node.getComponent(Sprite)   // Same thing via node
```

### Inspector binding (preferred)
```ts
@property({ type: Node })
playerNode: Node | null = null;

@property({ type: Label })
scoreLabel: Label | null = null;

@property({ type: [Node] })
enemies: Node[] = [];
```

### Find child nodes
```ts
this.node.children                          // All direct children
this.node.getChildByName("Cannon 01")       // By name
find("Cannon 01/Barrel/SFX", this.node)     // Deep path from parent
```

### Global search
```ts
find("Canvas/Menu/Back")  // Search from scene root
```

### Cross-module access
```ts
// Global.ts
export class Global {
    static playerNode: Node | null = null;
}

// OtherScript.ts
import { Global } from "./Global";
Global.playerNode = this.node;
```

---

## 6. Event System

### Custom events (EventTarget)
```ts
import { EventTarget } from 'cc';
const eventTarget = new EventTarget();

// Listen
eventTarget.on('game-over', (score: number) => {
    console.log('Score:', score);
}, this);

// Emit (max 5 args)
eventTarget.emit('game-over', 100);

// Remove
eventTarget.off('game-over', callback, this);

// Listen once
eventTarget.once('game-over', callback, this);
```

**Note:** Don't use `this.node.on/emit` for custom events — use `EventTarget` instead (better performance).

### Node events (built-in)
```ts
this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
this.node.on(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
```

---

## 7. Scene Management

### Load and switch
```ts
director.loadScene("MyScene");
director.loadScene("MyScene", onSceneLaunched);  // With callback
```

### Preload
```ts
director.preloadScene("table", () => {
    console.log('Preloaded');
});
// Later:
director.loadScene("table");
```

### Persistent nodes (survive scene switches)
```ts
director.addPersistRootNode(myNode);    // Must be root node
director.removePersistRootNode(myNode); // Restore to normal
```

---

## 8. Advanced Scripting

### Inheritance
```ts
class Shape {
    getName() { return "shape"; }
}

class Rect extends Shape {
    getName() { return "rect"; }  // Override
}
```

### Static members
```ts
class Foo {
    static count = 0;
    static getBounds() { }
}
```

### get/set
```ts
@property
get width() { return this._width; }
set width(value: number) { this._width = value; }

@property
private _width = 0;
```

**Notes on get/set:**
- Properties with `get` cannot use `serializable`
- Need `@property` to show in Inspector
- The getter property itself is read-only (but returned objects aren't)

### Type checking
```ts
sub instanceof Sub   // true
sub instanceof Base  // true
base instanceof Sub  // false
```

---

## 9. Common Patterns for theGarden

### Panel visibility pattern
```ts
// Show one panel, hide others
showPanel(panel: Node) {
    this.shopPanel.active = false;
    this.gridPanel.active = false;
    this.battlePanel.active = false;
    panel.active = true;
}
```

### Component communication
```ts
// Get component from @property bound node
const shop = this.shopPanelNode.getComponent(ShopPanel);
shop?.refreshShop();

// Or use find + getComponent
const hud = find("Canvas/Root/HUD")?.getComponent(HUD);
hud?.updateGold(newGold);
```

### Safe null checks
```ts
const label = this.node.getComponent(Label);
if (label) {
    label.string = "Hello";
}
// Or: label?.string = "Hello";  (optional chaining doesn't work for assignment)
```
