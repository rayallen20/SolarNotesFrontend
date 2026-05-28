# leaf → anchor 翻译抽离 — `resolveAnchor` 公共工具

> 缘起:`docs/design/聚焦与相机动画迁移设计.md` §12.5 指出"`anchorPointName` + `findAncestorByName`"这套 leaf → anchor 翻译在聚焦和悬停两处出现了相同的实现。本文档把这套操作抽离为 `src/three/lib/resolveAnchor.js`,两个调用方各自化简为一行函数调用;后续翻译规则若需要演进(例如允许从父节点继承 anchorPointName、给翻译加 fail-loud 的 console.warn 等),只动这一个文件。
>
> 这不是单纯的 DRY —— **leaf → anchor 是本项目的核心抽象之一**(详见 `docs/todo/屏幕投影半径计算偏差_方案A实施.md` §1.1 的论证),让这条翻译有专属的、被命名的边界点,是 anchor 重构的最后一公里。

---

## 1. 当前重复点

| 调用方 | 文件:行 | 当前做了什么 |
|---|---|---|
| 悬停状态机的 `enterBody` | `src/stores/hover.js:191-216` | 读 `userData.anchorPointName` → 守卫非空字符串 → `findAncestorByName` → 守卫非 null → 写 phase / activeEntity |
| 聚焦的 `resolveFocusAnchor` | `src/three/interaction/focus.js:95-107` | `pickHoveredBody` 命中后,执行同样的 4 步翻译 |

两处除变量命名(`hitObject` vs `hit`)外,**翻译子操作语义完全一致** —— 都是"raycaster 命中的视觉子节点 → 天体的语义代表(`sunAxis` / `planet.root`)"。

`findAncestorByName` 本身是更底层的"按 name 沿父链搜索"工具(`src/three/lib/findAncestorByName.js`),它**不知道** anchorPointName 的存在;现在这两个调用方各自把"读 anchorPointName"和"调 findAncestorByName"粘在一起,正是该被收口的层。

---

## 2. 抽离的形态

### 2.1 新建 `src/three/lib/resolveAnchor.js`

```js
import {findAncestorByName} from "@/three/lib/findAncestorByName.js";

/**
 * 本函数用于把raycaster命中的leaf mesh翻译为对应天体的anchor(sunAxis/planet.root)
 *      1. 读leaf的userData.anchorPointName,作为目标anchor的名称
 *      2. 沿父链向上搜索同名祖先
 *      3. 任一步失败(hitObject为空 / anchorPointName非法 / 找不到同名祖先) → 返回null
 * @param {import('three').Object3D|null} hitObject raycaster命中的leaf mesh
 * @return {import('three').Object3D|null} 天体的anchor(sunAxis/planet.root),或null
 * */
function resolveAnchor(hitObject) {
    if (hitObject === null || hitObject === undefined) {
        return null
    }

    const anchorName = hitObject.userData.anchorPointName
    if (typeof anchorName !== 'string' || anchorName === '') {
        return null
    }

    return findAncestorByName(hitObject, anchorName)
}

export {
    resolveAnchor,
}
```

> 把 `hitObject === null` 的兜底也收进函数内部,调用方不需要在外面再判 null。这让 `resolveFocusAnchor` 内部可以直接传 `pickHoveredBody` 的返回值,省一层 if。

### 2.2 改动总览

| 文件 | 改动 | 量级 |
|---|---|---|
| `src/three/lib/resolveAnchor.js` | 新建 | ~20 行 |
| `src/stores/hover.js` | `enterBody` 内 9 行翻译逻辑 → 4 行;import 切换 | -5 行净 |
| `src/three/interaction/focus.js` | `resolveFocusAnchor` 内 10 行 → 2 行;import 切换 | -8 行净 |

净结果:**-13 行内联翻译 + 20 行新工具**,但翻译规则的演进点从"两处分散"收到"一处集中"。

---

## 3. 调用方化简

### 3.1 `src/stores/hover.js` — `enterBody`

**改前**(`stores/hover.js:191-216` 区段,核心部分):

```js
function enterBody(hitObject) {
    if (isActiveLocked.value) {
        return
    }

    // 查找祖先锚点Mesh
    const anchorName = hitObject.userData.anchorPointName
    if (typeof anchorName !== 'string' || anchorName === '') {
        return
    }

    const anchor = findAncestorByName(hitObject, anchorName)
    if (anchor === null) {
        return
    }

    phase.value = HoverPhase.body
    activeEntity.value = anchor
}
```

**改后**:

```js
function enterBody(hitObject) {
    if (isActiveLocked.value) {
        return
    }

    const anchor = resolveAnchor(hitObject)
    if (anchor === null) {
        return
    }

    phase.value = HoverPhase.body
    activeEntity.value = anchor
}
```

**import 切换**(`stores/hover.js:5`):

```js
// 改前
import {findAncestorByName} from "@/three/lib/findAncestorByName.js";

// 改后
import {resolveAnchor} from "@/three/lib/resolveAnchor.js";
```

`enterBody` 头上那段"防御性编程"的多行注释**保留不变** —— 它在解释 `isActiveLocked` 这层守卫,与翻译逻辑无关。"查找祖先锚点 Mesh"这条注释可以删掉,因为下面那行调用名本身已经讲清楚了。

### 3.2 `src/three/interaction/focus.js` — `resolveFocusAnchor`

**改前**(`interaction/focus.js:95-107`):

```js
function resolveFocusAnchor(ndcCoordinate, camera) {
    const hit = pickHoveredBody(ndcCoordinate, camera)
    if (hit === null) {
        return null
    }

    const anchorName = hit.userData.anchorPointName
    if (typeof  anchorName !== 'string' || anchorName === '') {
        return null
    }

    return findAncestorByName(hit, anchorName)
}
```

**改后**:

```js
function resolveFocusAnchor(ndcCoordinate, camera) {
    const hit = pickHoveredBody(ndcCoordinate, camera)
    return resolveAnchor(hit)
}
```

**import 切换**(`interaction/focus.js:3`):

```js
// 改前
import {findAncestorByName} from "@/three/lib/findAncestorByName.js";

// 改后
import {resolveAnchor} from "@/three/lib/resolveAnchor.js";
```

> 化简后 `resolveFocusAnchor` 的职责变得极简且清晰:**raycaster 投射(`pickHoveredBody`)+ 语义翻译(`resolveAnchor`)= 聚焦用的 anchor 解析**。三层各司其职,语义边界一目了然。

---

## 4. 行为校验

| 输入 | 改前行为 | 改后行为 |
|---|---|---|
| 正常 leaf(合法 anchorPointName,祖先链中存在 anchor) | 返回 anchor | 返回 anchor(完全一致) |
| 漏配 anchorPointName 的 leaf | 返回 null / `enterBody` no-op | 返回 null(完全一致) |
| anchorPointName 拼错,找不到对应祖先 | 返回 null | 返回 null(完全一致) |
| `pickHoveredBody` 没命中,传入 null | 聚焦侧调用方先判 null 短路;悬停侧不会调到 | `resolveAnchor` 内部判 null,统一返回 null |

**null 处理边界略有移动**:从"两个调用方各自判 hitObject 是否为 null"变成"`resolveAnchor` 内部统一判"。下游观察到的行为完全不变。

---

## 5. 不再做的事(以及为什么)

### 5.1 不在 `resolveAnchor` 内加 memo 缓存

直觉上可以把翻译结果挂到 `hitObject.userData.__anchor` 上,避免每帧重新走父链。**本次不加**:

- `findAncestorByName` 走 3-4 层父节点,代价 ns 量级;raycaster 每帧最多触发一次 hover 解析、点击时才触发聚焦解析,总调用频率不高
- 若将来真的成为瓶颈,**更优的方案不是 lazy memo,而是在 leaf 构建时(`sun.js` / `planet.js`)直接挂 `userData.anchor` 引用** —— 那时 `resolveAnchor` 会进一步简化为 `return hitObject?.userData.anchor ?? null`,连父链遍历都省了

留作未来演化方向,不属于本次范围。

### 5.2 不动 `findAncestorByName`

抽离后,`findAncestorByName` 在工程内的**显式调用方只剩 `resolveAnchor` 一个**。但它仍然是一个独立的、有清晰语义的公共工具("按 name 沿父链搜索"),不应该被合并进 `resolveAnchor` —— 未来可能在与 anchor 无关的语境(调试、序列化、其他 hover/click 模型)中复用。**保持两层分离**:`findAncestorByName` 是"机制",`resolveAnchor` 是"基于该机制 + anchorPointName 约定的应用"。

### 5.3 不把 `resolveFocusAnchor` 也搬到 `lib/`

化简后它只剩两行,理论上可以删除并让 `SolarCanvas.vue` 直接调 `resolveAnchor(pickHoveredBody(...))`。**本次保留这层包装**:

- `resolveFocusAnchor` 在语义上表达"为聚焦准备一个 anchor",意图清楚;读 `SolarCanvas` 时不必跨文件拼装
- 未来若聚焦需要额外的预处理(例如忽略某些 bodyType 的天体、聚焦前对 anchor 做断言),这一层是天然的扩展点

保留它的成本是 4 行,值。

---

## 6. 实施步骤

1. 新建 `src/three/lib/resolveAnchor.js`,内容见 §2.1
2. 改 `src/stores/hover.js`:
    - 顶部 import 从 `findAncestorByName` 切换为 `resolveAnchor`(路径见 §3.1)
    - `enterBody` 内"查找祖先锚点 Mesh"以下的 9 行替换为 §3.1 改后版本
3. 改 `src/three/interaction/focus.js`:
    - 顶部 import 从 `findAncestorByName` 切换为 `resolveAnchor`
    - `resolveFocusAnchor` 整体替换为 §3.2 改后版本(两行)
4. `npm run dev`,确认无 console 报错、无解析失败
5. 按 §7 验收

---

## 7. 验收清单

- [ ] `src/three/lib/resolveAnchor.js` 已新建,导出 `resolveAnchor`
- [ ] `src/stores/hover.js` 的 `enterBody` 不再直接 `findAncestorByName`,改为 `resolveAnchor(hitObject)`
- [ ] `src/three/interaction/focus.js` 的 `resolveFocusAnchor` 缩到两行,内部 `resolveAnchor(hit)`
- [ ] 两个调用方文件顶部的 import 已同步切换(各自原先的 `findAncestorByName` import 删除)
- [ ] 全项目检索:`findAncestorByName` 的**直接消费者**只剩 `resolveAnchor.js` 一处
    ```bash
    grep -rn "findAncestorByName" src/
    # 期望命中:lib/findAncestorByName.js(定义)、lib/resolveAnchor.js(调用)
    ```
- [ ] 悬停每颗天体能正常出现 label
- [ ] 点击每颗天体能进入聚焦动画
- [ ] 退出聚焦回到自由视角
- [ ] **fail-loud 验证**:故意把某颗天体 leaf 的 `userData.anchorPointName` 改成不存在的字符串,刷新页面后悬停该天体 → label 不显示(行为与抽离前完全一致)
- [ ] 无 console 报错

---

## 8. 风险与未尽事项

### 8.1 设计文档 §12.5 需要同步更新

`docs/design/聚焦与相机动画迁移设计.md` §12.5 当前把"两处重复"列为待优化点。本次抽离落地后,§12.5 的事实陈述应该更新 —— 要么改写为"`resolveAnchor` 已收口该翻译,见 `docs/todo/resolveAnchor抽离.md`",要么把该节并入"已完成的优化"的附录段落。

该改动不在本文档范围内,**本次留作单独步骤**,待代码落地后再单独跟进设计文档。

### 8.2 命名是否会与 Vue / Three.js 现有名冲突

- Vue:无 `resolveAnchor` 关键字
- Three.js:无 `Object3D.resolveAnchor` 方法
- 本工程:已有 `resolveFocusAnchor`(聚焦专用),新增 `resolveAnchor`(通用底层)。两者命名风格一致,且后者是前者的"子操作",**不冲突且语义对仗**

### 8.3 `resolveAnchor` 的位置选择

放在 `src/three/lib/` 下与 `findAncestorByName.js` 并列,理由:

- **不依赖 Vue / store** —— 是纯 Three.js Object3D 操作
- **不依赖 raycaster 层** —— 与 `pickHoveredBody`(`src/three/base/raycaster.js`)解耦,后者负责"NDC → leaf",`resolveAnchor` 负责"leaf → anchor",两者是流水线的相邻两节
- 与 `findAncestorByName` 同目录,体现"基于场景树的通用工具"的归属

如果未来 `src/three/lib/` 变拥挤,可以考虑再细分一个 `src/three/lib/anchor/` 子目录把 `resolveAnchor` 和未来可能新增的 anchor 相关工具聚拢。**当前两个文件,不细分**。
