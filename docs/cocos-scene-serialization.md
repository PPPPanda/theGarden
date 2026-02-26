# Cocos Creator 3.x 场景序列化规范

> 适用版本：Cocos Creator 3.8.x
> 用途：Pipeline agents（coder / sceneops）编辑场景文件时必须遵守的编码规则

## 1. 场景文件结构

场景文件（`.scene`）和预制体（`.prefab`）本质是 JSON 数组：

```json
[
  { "__type__": "cc.SceneAsset", "scene": { "__id__": 1 }, ... },  // [0] 资源描述
  { "__type__": "cc.Scene", "_children": [{"__id__": 2}], ... },   // [1] 场景根
  { "__type__": "cc.Node", "_name": "Canvas", ... },                // [2] 节点
  { "__type__": "cc.UITransform", "node": {"__id__": 2}, ... },     // [3] 组件
  ...
]
```

### 关键规则

| 字段 | 用途 | 格式 |
|---|---|---|
| `__id__` | 数组内引用（同文件内的节点/组件互引） | 整数下标 |
| `__uuid__` | 外部资源引用（SpriteFrame、Prefab等） | 标准 UUID 或压缩 UUID |
| `__type__` | 对象类型标识 | 见下文 |

## 2. `__type__` 字段编码规则（⚠️ 最重要）

### 内置类型
直接使用类名前缀 `cc.`：
```
"__type__": "cc.Node"
"__type__": "cc.UITransform"
"__type__": "cc.Sprite"
"__type__": "cc.Label"
"__type__": "cc.Button"
"__type__": "cc.SceneAsset"
```

### 自定义脚本组件（⚠️ 必须使用压缩 UUID，不是类名！）
```
❌ "__type__": "ShopPanel"          // 错误！会变成 MissingScript
❌ "__type__": "GridPanelComp"      // 错误！
✅ "__type__": "8baedqmWtJAe4a6Qc8y+9W5"  // 正确：ShopPanel 的压缩 UUID
✅ "__type__": "755e62ErntBF7/XclSfbty3"   // 正确：GridPanelComp 的压缩 UUID
```

**规则：** Cocos 3.x 中，自定义脚本的 `__type__` 是该脚本 `.ts` 文件的 UUID 经过压缩编码后的 23 字符字符串（CID）。

## 3. UUID 压缩算法

### 编码表
```
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/
```

### 压缩（UUID → CID）
```
输入: "8baedaa6-5ad2-407b-86ba-41cf32fbd5b9"（标准 UUID，36字符）
输出: "8baedqmWtJAe4a6Qc8y+9W5"（压缩 CID，23字符）
```

算法步骤：
1. 去掉连字符 → `"8baedaa65ad2407b86ba41cf32fbd5b9"`（32字符 hex）
2. 保留前 5 个 hex 字符作为前缀 → `"8baed"`
3. 剩余 27 个 hex 字符，每 3 个一组（共 9 组）
4. 每组 3 hex → 12 bit → 用 Base64 查表编码为 2 个字符

每组编码：
```
hex[0], hex[1], hex[2] → u, d, n（各 4 bit）
char1 = Base64[(u << 2) | (d >> 2)]      // 高 6 bit
char2 = Base64[((d & 3) << 4) | n]       // 低 6 bit
```

### Python 实现
```python
Base64KeyChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

def uuid_to_cid(uuid_str: str) -> str:
    """Convert standard UUID to Cocos Creator 3.x CID (23 chars, scene __type__ format)"""
    s = uuid_str.replace('-', '')
    prefix = s[:5]
    result = []
    i = 5
    while i < len(s):
        u = int(s[i], 16)
        d = int(s[i+1], 16)
        n = int(s[i+2], 16)
        result.append(Base64KeyChars[(u << 2) | (d >> 2)])
        result.append(Base64KeyChars[((d & 3) << 4) | n])
        i += 3
    return prefix + ''.join(result)
```

### JavaScript 实现
```javascript
const Base64KeyChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function uuidToCid(uuid) {
    const s = uuid.replace(/-/g, '');
    const prefix = s.slice(0, 5);
    const chars = [];
    for (let i = 5; i < s.length; i += 3) {
        const u = parseInt(s[i], 16);
        const d = parseInt(s[i + 1], 16);
        const n = parseInt(s[i + 2], 16);
        chars.push(Base64KeyChars[(u << 2) | (d >> 2)]);
        chars.push(Base64KeyChars[((d & 3) << 4) | n]);
    }
    return prefix + chars.join('');
}
```

### 解压（CID → UUID）
```javascript
const AsciiTo64 = new Array(128).fill(0);
for (let i = 0; i < 64; i++) AsciiTo64[Base64KeyChars.charCodeAt(i)] = i;

function cidToUuid(cid) {
    if (cid.length === 23) {
        const hex = [];
        for (let i = 5; i < 23; i += 2) {
            const r = AsciiTo64[cid.charCodeAt(i)];
            const t = AsciiTo64[cid.charCodeAt(i + 1)];
            hex.push((r >> 2).toString(16));
            hex.push((((r & 3) << 2) | (t >> 4)).toString(16));
            hex.push((t & 15).toString(16));
        }
        const full = cid.slice(0, 5) + hex.join('');
        return [full.slice(0,8), full.slice(8,12), full.slice(12,16), full.slice(16,20), full.slice(20)].join('-');
    }
    return cid;
}
```

### Editor API（插件/控制台可用）
```javascript
// 压缩
Editor.Utils.UuidUtils.compressUuid('8baedaa6-5ad2-407b-86ba-41cf32fbd5b9');
// → "8baedqmWtJAe4a6Qc8y+9W5"

// 解压
Editor.Utils.UuidUtils.decompressUuid('8baedqmWtJAe4a6Qc8y+9W5');
// → "8baedaa6-5ad2-407b-86ba-41cf32fbd5b9"
```

## 4. 本项目脚本 UUID → CID 映射表

| 脚本 | UUID | CID (`__type__`) |
|---|---|---|
| MainScene.ts | `05842fdd-44ec-498b-bf6e-32be59fb8923` | `05842/dROxJi79uMr5Z+4kj` |
| HUD.ts | `65195f5a-e66e-4aea-8469-ea3dc6941c6d` | `651959a5m5K6oRp6j3GlBxt` |
| ShopPanel.ts | `8baedaa6-5ad2-407b-86ba-41cf32fbd5b9` | `8baedqmWtJAe4a6Qc8y+9W5` |
| GridPanelComp.ts | `755e6d84-ae7b-4117-bfd7-72549f6edcb7` | `755e62ErntBF7/XclSfbty3` |
| BattlePanel.ts | `20d68bc8-d26f-4563-a407-52ed56e4ad42` | `20d68vI0m9FY6QHUu1W5K1C` |
| ScreenAdapter.ts | `e5030a7b-7875-4767-99d1-0bd24cdc7ff6` | `e5030p7eHVHZ5nRC9JM3H/2` |
| GridView.ts | `e0b7b142-ece6-4512-b6ee-80f381fc403a` | `e0b7bFC7OZFErbugPOB/EA6` |
| GridDragController.ts | `73c03a89-36a6-4f94-a039-57a6edfb9cfd` | `73c03qJNqZPlKA5V6bt+5z9` |
| SceneFlowStateMachine.ts | `ef8033a1-1cca-4a44-bc2d-eec4c710a769` | `ef803OhHMpKRLwt7sTHEKdp` |

## 5. 节点引用规则

### 同文件引用（`__id__`）
```json
{
    "__type__": "8baedqmWtJAe4a6Qc8y+9W5",
    "node": { "__id__": 42 },        // 引用同文件中下标 42 的对象
    "slot0Icon": { "__id__": 55 },    // @property 绑定的节点
    "_enabled": true
}
```

### 外部资源引用（`__uuid__`）
```json
{
    "__type__": "cc.Sprite",
    "_spriteFrame": {
        "__uuid__": "d4ed19e4-2aa0-47c3-ac57-a402975035ad"
    }
}
```

## 6. 常见错误

### MissingScript
**原因：** `__type__` 使用了类名字符串而不是压缩 UUID
```json
// ❌ 会导致 MissingScript
{ "__type__": "HUD", "node": {"__id__": 9} }

// ✅ 正确写法
{ "__type__": "651959a5m5K6oRp6j3GlBxt", "node": {"__id__": 9} }
```

### 如何获取脚本的 CID
1. 查看 `.meta` 文件获取 UUID：`cat assets/scripts/ui/HUD.ts.meta | grep uuid`
2. 使用压缩算法转换为 CID
3. 或通过 MCP 工具：`cocos_project_get_asset_info(assetPath)` 获取 UUID

### 通过 MCP 正确添加脚本组件
优先使用 MCP 工具而不是手动编辑场景 JSON：
```
cocos_component_attach_script(nodeUuid, scriptPath)  // 自动处理 CID
cocos_prefab_instantiate_prefab(prefabPath)           // 保留正确引用
```

## 7. Prefab 相关

### `_prefab` / `__prefab` 字段
每个从 prefab 实例化的节点和组件都有 `__prefab` 字段：
```json
{
    "__prefab": {
        "fileId": "LevSTzHUuovIXFaBR/e1V0"  // prefab 内部文件 ID
    }
}
```

### 规则
- 使用 `instantiate_prefab` 创建的节点会自动保留 `_prefab` 链接
- 手动创建节点（`create_node`）不会有 prefab 链接
- 丢失 `_prefab` 链接 = 无法和 prefab 源同步更新

## 参考
- Cocos Creator 3.8 官方文档：https://docs.cocos.com/creator/3.8/manual/zh/
- Editor UUID API：https://docs.cocos.com/creator/3.8/manual/zh/editor/extension/api/utils.html
- 引擎序列化源码：`cocos/serialization/report-missing-class.ts`
- 引擎反序列化：`cocos/serialization/deserialize-dynamic.ts`
