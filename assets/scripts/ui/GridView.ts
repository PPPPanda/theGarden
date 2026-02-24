/**
 * theGarden — Grid View
 * 可视化网格背包，支持点击放置 / 移除物品
 */
import { _decorator, Component, Node, UITransform, Graphics, Label, Color, Vec3, size, Sprite, UIOpacity } from 'cc';
import { GameManager, PlacedItem, gameEvents, GameEvent, GamePhase } from '../core/GameManager';
import { ITEM_TEMPLATES, ItemTemplate } from '../core/ItemDB';

const { ccclass, property } = _decorator;

const CELL_SIZE = 72;
const CELL_GAP = 4;
const CELL_RADIUS = 8;
const GRID_PADDING = 12;

// 花园主题色
const COLOR_CELL_BG = new Color(255, 248, 225, 255);       // 奶油色
const COLOR_CELL_BORDER = new Color(194, 178, 128, 200);    // 暖棕
const COLOR_CELL_HOVER = new Color(255, 241, 200, 255);     // 高亮
const COLOR_GRID_BG = new Color(139, 195, 74, 40);          // 淡绿底
const COLOR_ITEM_BG = new Color(255, 255, 255, 220);        // 物品底色

@ccclass('GridView')
export class GridView extends Component {
    private _cellNodes: Node[][] = [];
    private _itemNodes: Map<string, Node> = new Map();
    private _gridSize = 4;

    start() {
        this._gridSize = GameManager.instance?.gridSize ?? 4;
        this._buildGrid();
        this._listenEvents();
        this._refreshItems();
    }

    private _buildGrid() {
        const totalSize = this._gridSize * (CELL_SIZE + CELL_GAP) - CELL_GAP + GRID_PADDING * 2;
        const ut = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ut.setContentSize(totalSize, totalSize);

        // 网格背景
        const bgNode = new Node('GridBg');
        bgNode.parent = this.node;
        bgNode.addComponent(UITransform).setContentSize(totalSize, totalSize);
        const bgG = bgNode.addComponent(Graphics);
        bgG.fillColor = COLOR_GRID_BG;
        bgG.roundRect(-totalSize / 2, -totalSize / 2, totalSize, totalSize, 16);
        bgG.fill();
        bgG.strokeColor = new Color(76, 175, 80, 100);
        bgG.lineWidth = 2;
        bgG.roundRect(-totalSize / 2, -totalSize / 2, totalSize, totalSize, 16);
        bgG.stroke();

        // 创建格子
        for (let r = 0; r < this._gridSize; r++) {
            this._cellNodes[r] = [];
            for (let c = 0; c < this._gridSize; c++) {
                const cell = this._createCell(r, c);
                this._cellNodes[r][c] = cell;
            }
        }
    }

    private _createCell(row: number, col: number): Node {
        const cell = new Node(`Cell_${row}_${col}`);
        cell.parent = this.node;

        const ut = cell.addComponent(UITransform);
        ut.setContentSize(CELL_SIZE, CELL_SIZE);

        // 位置：左下角起
        const totalSize = this._gridSize * (CELL_SIZE + CELL_GAP) - CELL_GAP + GRID_PADDING * 2;
        const x = GRID_PADDING + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 - totalSize / 2;
        const y = GRID_PADDING + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 - totalSize / 2;
        cell.setPosition(x, y, 0);

        // 绘制格子
        const g = cell.addComponent(Graphics);
        this._drawCellBackground(g, false);

        // 点击事件
        cell.on(Node.EventType.TOUCH_END, () => this._onCellTap(row, col));

        return cell;
    }

    private _drawCellBackground(g: Graphics, highlight: boolean) {
        g.clear();
        const half = CELL_SIZE / 2;
        g.fillColor = highlight ? COLOR_CELL_HOVER : COLOR_CELL_BG;
        g.roundRect(-half, -half, CELL_SIZE, CELL_SIZE, CELL_RADIUS);
        g.fill();
        g.strokeColor = COLOR_CELL_BORDER;
        g.lineWidth = 1.5;
        g.roundRect(-half, -half, CELL_SIZE, CELL_SIZE, CELL_RADIUS);
        g.stroke();

        // 小装饰点
        if (!highlight) {
            g.fillColor = new Color(200, 200, 180, 30);
            g.circle(-half + 8, -half + 8, 3);
            g.fill();
        }
    }

    private _onCellTap(row: number, col: number) {
        const gm = GameManager.instance;
        if (!gm || gm.phase !== GamePhase.Shop) return;

        const existing = gm.grid[row]?.[col];
        if (existing) {
            // 点击已有物品 → 卖出（回收一半价格）
            const tmpl = ITEM_TEMPLATES[existing.templateId];
            const refund = Math.floor(tmpl.cost / 2);
            gm.removeItem(existing.uid);
            gm.addGold(refund);
            this._refreshItems();
        }
    }

    private _listenEvents() {
        gameEvents.on(GameEvent.ITEM_PLACED, () => this._refreshItems(), this);
        gameEvents.on(GameEvent.ITEM_REMOVED, () => this._refreshItems(), this);
    }

    /** 刷新所有物品显示 */
    _refreshItems() {
        // 清除旧的物品节点
        for (const [, node] of this._itemNodes) {
            node.destroy();
        }
        this._itemNodes.clear();

        // 重置格子高亮
        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                const g = this._cellNodes[r][c].getComponent(Graphics);
                if (g) this._drawCellBackground(g, false);
            }
        }

        const gm = GameManager.instance;
        if (!gm) return;

        // 绘制已放置物品
        const seen = new Set<string>();
        for (let r = 0; r < this._gridSize; r++) {
            for (let c = 0; c < this._gridSize; c++) {
                const item = gm.grid[r]?.[c];
                if (item && !seen.has(item.uid)) {
                    seen.add(item.uid);
                    this._createItemNode(item);
                    // 高亮占位格
                    const tmpl = ITEM_TEMPLATES[item.templateId];
                    for (let rr = item.row; rr < item.row + tmpl.rows; rr++) {
                        for (let cc = item.col; cc < item.col + tmpl.cols; cc++) {
                            const g = this._cellNodes[rr]?.[cc]?.getComponent(Graphics);
                            if (g) this._drawCellBackground(g, true);
                        }
                    }
                }
            }
        }
    }

    private _createItemNode(item: PlacedItem) {
        const tmpl = ITEM_TEMPLATES[item.templateId];
        const itemNode = new Node(`Item_${item.uid}`);
        itemNode.parent = this.node;

        const w = tmpl.cols * (CELL_SIZE + CELL_GAP) - CELL_GAP;
        const h = tmpl.rows * (CELL_SIZE + CELL_GAP) - CELL_GAP;
        const ut = itemNode.addComponent(UITransform);
        ut.setContentSize(w, h);

        // 位置
        const totalSize = this._gridSize * (CELL_SIZE + CELL_GAP) - CELL_GAP + GRID_PADDING * 2;
        const cx = GRID_PADDING + item.col * (CELL_SIZE + CELL_GAP) + w / 2 - totalSize / 2;
        const cy = GRID_PADDING + item.row * (CELL_SIZE + CELL_GAP) + h / 2 - totalSize / 2;
        itemNode.setPosition(cx, cy, 0);

        // 物品底色
        const g = itemNode.addComponent(Graphics);
        const clr = new Color(tmpl.color.r, tmpl.color.g, tmpl.color.b, 60);
        g.fillColor = clr;
        g.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, CELL_RADIUS - 2);
        g.fill();
        g.strokeColor = new Color(tmpl.color.r, tmpl.color.g, tmpl.color.b, 180);
        g.lineWidth = 2;
        g.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, CELL_RADIUS - 2);
        g.stroke();

        // Emoji 标签
        const emojiNode = new Node('Emoji');
        emojiNode.parent = itemNode;
        emojiNode.addComponent(UITransform);
        const emojiLabel = emojiNode.addComponent(Label);
        emojiLabel.string = tmpl.emoji;
        emojiLabel.fontSize = 32;
        emojiLabel.lineHeight = 40;
        emojiNode.setPosition(0, 4, 0);

        // 名称标签
        const nameNode = new Node('Name');
        nameNode.parent = itemNode;
        nameNode.addComponent(UITransform);
        const nameLabel = nameNode.addComponent(Label);
        nameLabel.string = tmpl.name;
        nameLabel.fontSize = 10;
        nameLabel.lineHeight = 14;
        nameLabel.color = new Color(80, 80, 80, 255);
        nameNode.setPosition(0, -22, 0);

        this._itemNodes.set(item.uid, itemNode);
    }

    onDestroy() {
        gameEvents.off(GameEvent.ITEM_PLACED, this._refreshItems, this);
        gameEvents.off(GameEvent.ITEM_REMOVED, this._refreshItems, this);
    }
}
