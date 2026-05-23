# Label定位设计

> 本文设计 label(`SolarLabel`)在屏幕上的定位规则,用于**取代**原项目(`universeBlog`)中的 `calcOffset()`。
>
> 适用代码:`src/components/SolarLabel.vue` 中的 `positionStyle` 计算属性(当前为占位实现,见 line 48 的 TODO)。

---

## 1. 背景与目标

### 1.1 待替代的实现

当前 `SolarLabel.vue` 的 `positionStyle` 是占位实现,直接把 label 的**左上角**钉在投影圆中心:

```js
// 占位实现:label 左上角 = 投影圆中心,会严重遮挡天体
const positionStyle = computed(() => {
    const center = hoverStore.activeProjection.centerPx
    return {
        left: `${center.x}px`,
        top: `${center.y}px`,
    }
})
```

JSDoc 中标注的"下一阶段接入 `calcOffset()`"——本文档即定义这个"下一阶段",但**不沿用** `calcOffset()` 的算法。

### 1.2 为何不沿用 `calcOffset()`

`calcOffset()` 会根据天体位置计算一个偏移方向,把 label 放在天体周围某个角度上。该方案的问题:

- 计算出的位置**有可能与天体投影圆重叠**;
- 后续要做的 **focus 功能**(点击天体使镜头聚焦)依赖鼠标点击到天体本身,若 label(带 `pointer-events: auto` 的 DOM)压在天体上,点击会被 label 拦截,focus 失效。

### 1.3 设计目标

1. **label 永不与天体投影圆重叠**——保证天体像素区始终可点击(为 focus 让路);
2. label 与投影圆建立清晰的视觉锚定关系(凹口"咬住"投影圆);
3. **避免被视口边缘裁切**——尤其是天体靠近视口底部、或镜头放大导致投影圆变大时;
4. 规则确定、可推导、无魔数。

---

## 2. 术语与已知量

| 记号 | 含义 | 来源 |
| --- | --- | --- |
| `cx`, `cy` | 投影圆圆心的屏幕像素坐标 | `activeProjection.centerPx.{x,y}`(每帧更新) |
| `r` | 投影圆半径(像素) | `activeProjection.radiusPx`(每帧更新) |
| `W` | label 宽度 | CSS 变量 `--width`(426px) |
| `H` | label 高度 | CSS 变量 `--height`(286px) |
| `d` | 凹口深度 | CSS 变量 `--notch-depth`(16px) |
| `vh` | 视口高度 | `window.innerHeight` |
| `m` | 视口安全边距 | 常量,建议 8px(可调) |

**坐标系一致性(关键前提)**:`activeProjection.centerPx` 由 `calcProjection()` 用 `canvas.getBoundingClientRect()` 计算,是**视口坐标**(含 `rect.left/top` 偏移);而 `.solar-label` 是 `position: fixed`,其 `left/top` 同样以**视口左上角**为原点。两者同处一个坐标系,可直接运算,无需换算。y 轴向下。

**容器原点**:`.solar-label` 当前**无 `transform`**,因此 CSS 的 `left/top` 设置的是容器**左上角**(本地坐标原点 `(0,0)`)的屏幕位置。下文所有"把本地参考点对齐到屏幕锚点"的换算都基于此。若未来给容器加了 `transform: translate(...)`,本文公式需同步修订。

---

## 3. 核心规则概述

1. **默认朝下**:label 出现在投影圆**正下方**,label **顶部凹口的中点**与投影圆**底部**相切。
2. **触底翻转朝上**:当"朝下"会使 label 底部超出视口下边缘时,翻转到投影圆**正上方**,label **底部凹口的中点**与投影圆**顶部**相切。
3. **只移动、不镜像**:翻转仅改变容器的 `left/top`,**绝不**对 label 做镜像/翻转变换——文字、按钮、装饰始终保持正立(理由见 §5.4)。
4. 水平方向:label 始终以投影圆圆心**水平居中**(`left = cx − W/2`),使凹口中点正对天体中心。

---

## 4. 锚点几何推导

### 4.1 凹口中点的本地坐标

label 的形状(`Shape.vue` 的 `clip-path`)在顶部和底部各有一个**对称的梯形凹口**。以顶部凹口为例,其路径关键点(本地坐标,原点为 label 左上角):

```
(--notch-start-x, 0)                    = (60, 0)    凹口起点(回到顶边)
(--top-notch-left-diagonal-end-x, d)    = (108, 16)  左斜边终点(凹口平底左端)
(--top-notch-horizontal-end-x, d)       = (318, 16)  凹口平底右端
(--top-notch-right-diagonal-end-x, 0)   = (366, 0)   凹口终点(回到顶边)
```

凹口的**平底**是一段水平线,位于 `y = d`(=16),横跨 `x ∈ [108, 318]`。其**中点**:

```
x = (108 + 318) / 2 = 213 = W / 2     ← 凹口水平居中
y = d = 16
```

于是:

- **顶部凹口中点** `P_top = (W/2, d)`
- **底部凹口中点** `P_bottom = (W/2, H − d)`(底部凹口与顶部对称,平底位于 `y = H − d`)

> 这两个点就是"label 上/下边框的中点"——即用户描述中要与投影圆相切的那个点。凹口平底是水平线,与投影圆在切点处的切线方向一致,因此"中点正对圆心 + 距圆心为 r"与"凹口平底与圆相切于该中点"是同一几何配置。

### 4.2 朝下放置(默认)

把本地参考点 `P_top = (W/2, d)` 对齐到屏幕锚点 **投影圆底部** `B = (cx, cy + r)`:

```
容器左上角.left = B.x − P_top.x = cx − W/2
容器左上角.top  = B.y − P_top.y = (cy + r) − d
```

label 竖直占据区间:`[cy + r − d, cy + r − d + H]`。

```
            ·  ·
         ·        ·
        ·    C ───→·  r          投影圆:圆心 C=(cx,cy),半径 r
         ·    │    ·
            · │  ·
        ──────●──────            ← screen-y = cy + r(圆底)= 顶部凹口中点
       ╲    ╲ ╱    ╱                 凹口"咬住"圆底,切于此点
       │  标题       │
       │  ────       │           label 整体在圆下方,文字正立
       │  介绍       │
       │      [按钮]  │
       └────────────┘
```

### 4.3 朝上放置(翻转)

把本地参考点 `P_bottom = (W/2, H − d)` 对齐到屏幕锚点 **投影圆顶部** `T = (cx, cy − r)`:

```
容器左上角.left = T.x − P_bottom.x = cx − W/2
容器左上角.top  = T.y − P_bottom.y = (cy − r) − (H − d)
```

label 竖直占据区间:`[cy − r − (H − d), cy − r + d]`。

```
       ┌────────────┐
       │  标题       │           label 在天体上方,文字仍正立
       │  ────       │
       │  介绍       │
       │      [按钮]  │
       ╱    ╱ ╲    ╲              ← 底部凹口
        ──────●──────            ← screen-y = cy − r(圆顶)= 底部凹口中点
            · │  ·
         ·    │    ·
        ·    C ───→·  r
         ·        ·
            ·  ·
```

### 4.4 不重叠性(为何天体始终可点击)

两种朝向下,凹口平底所在的水平线分别与投影圆相切于圆的最低点 / 最高点;凹口区域的 label 材质**不会越过该切线**进入圆内。label 两侧(凹口之外)的材质虽比切点多伸出 `d`(16px),但其离圆心水平距离 ≥ 凹口半宽(105px),只有当 `r` 大到约 350–740px(极端放大)时才可能触圆——常规缩放下,**label 与投影圆零重叠**,天体中心像素区始终空出,focus 点击不被拦截。

---

## 5. 翻转决策

### 5.1 触发条件

默认朝下;**当朝下放置的 label 底边超出视口安全区时翻转朝上**:

```
朝下底边 = cy + r − d + H
翻转条件:  (cy + r − d + H) > (vh − m)   → 改用朝上
```

天体靠近视口底部(`cy` 大)、或镜头放大使 `r` 增大,都会让左侧值增大而触发翻转,正好覆盖本设计要解决的两种裁切场景。

### 5.2 为何"默认朝下,而非取空间更大的一侧"

可选的另一种策略是"比较上下可用空间,放在更宽的一侧"。本设计**不采用**,而是固定"默认朝下、触底才翻",原因:

- label 的装饰(`OuterDecorLayer` 的 `stripe-chip` 斜纹条)与内容是按"朝下"这一**主朝向**设计的,朝下是视觉最自然的默认;
- 固定默认朝向使行为可预期,避免天体在屏幕中部移动时 label 频繁左右/上下横跳。

### 5.3 抖动与稳定性

`positionStyle` 依赖 `activeProjection`,每帧重算,翻转判定也每帧进行。理论上若 `cy` 恰好卡在阈值附近抖动,label 可能在上下之间闪烁。但实际上:

- label 显示期间 `shouldFreezeRevolution` 为真,**各天体公转已冻结**,`activeEntity` 的投影在一次悬停会话内基本稳定;
- 悬停要求鼠标停在天体上,期间相机一般不动。

因此单阈值判定在实践中是稳定的,**本期不引入迟滞**。若后续发现边界抖动,可加一个翻转迟滞带(如朝下→朝上用 `vh − m`,朝上→朝下用 `vh − m − Δ`),作为加固项。

### 5.4 只翻转位置,不镜像内容

翻转**只改变容器的 `top`(以及 `left`,但 `left` 公式两朝向相同)**,绝不对 label 做 `scaleY(-1)` 之类的镜像。原因:

- `ContentLayer` 的标题/正文/按钮有固定阅读方向,镜像会使文字上下颠倒;
- `OuterDecorLayer` 的 `stripe-chip` 等装饰是绝对定位的具体图形,镜像会破坏其形态。

label 形状本身**顶部和底部都有凹口**,所以无论朝上朝下,总有一个凹口正对天体——朝下用顶部凹口,朝上用底部凹口,无需改形状。

**已知视觉副作用**:`stripe-chip` 斜纹条固定在 label 顶部(`top: 8px`,贴着顶部凹口)。朝下时它在靠近天体的一侧(符合设计);**朝上时它会落在远离天体的一侧**,而正对天体的底部凹口没有该装饰。这是位置翻转不可避免的非对称,属可接受的细节;若要求严格对称,可后续为 `OuterDecorLayer` 增加"翻转态"样式把斜纹条镜像到底部凹口(见 §8)。

---

## 6. 完整算法

### 6.1 几何量的来源(单一真源)

`W / H / d` 已在 CSS(`.solar-label`)中定义,且 `Shape.vue`、`OuterDecorLayer.vue` 的众多 `calc()` 派生变量都依赖它们。为**避免在 JS 中重复硬编码**这三个数值造成双真源,JS 侧在挂载后从 CSS 自定义属性**读取一次**(label 尺寸是静态的,不会运行时变化):

```js
import {computed, onMounted, ref, useTemplateRef, watch} from "vue";

const containerRef = useTemplateRef('container')

// label 几何量:挂载后从 CSS 变量读取一次,CSS 保持唯一真源
const labelWidth = ref(0)
const labelHeight = ref(0)
const notchDepth = ref(0)

onMounted(() => {
    const style = getComputedStyle(containerRef.value)
    labelWidth.value = parseFloat(style.getPropertyValue('--width'))
    labelHeight.value = parseFloat(style.getPropertyValue('--height'))
    notchDepth.value = parseFloat(style.getPropertyValue('--notch-depth'))
})
```

> label 在首次悬停前一直隐藏,而悬停必然发生在挂载之后,因此读取时机早于 label 的任何一次显示。

### 6.2 `positionStyle` 计算属性

```js
// 视口安全边距:label 与视口下边缘至少留出该距离时才算"放得下"
const VIEWPORT_SAFE_MARGIN_PX = 8

/**
 * @type {import('vue').ComputedRef<{left: String, top: String}>} label 的绝对定位样式
 * 规则:默认朝下(顶部凹口中点切于投影圆底部);朝下会超出视口下边缘时翻转朝上
 *      (底部凹口中点切于投影圆顶部)。仅移动容器,不镜像内容。
 * */
const positionStyle = computed(() => {
    const projection = hoverStore.activeProjection
    const cx = projection.centerPx.x
    const cy = projection.centerPx.y
    const r = projection.radiusPx

    const w = labelWidth.value
    const h = labelHeight.value
    const d = notchDepth.value

    // 水平:凹口中点正对天体中心(两种朝向一致)
    const left = cx - w / 2

    // 默认朝下:顶部凹口中点 (w/2, d) 对齐投影圆底部 (cx, cy + r)
    const downTop = cy + r - d
    const downBottom = downTop + h

    // 翻转判定:朝下底边超出视口安全区 → 改用朝上
    const shouldFlipUp = downBottom > window.innerHeight - VIEWPORT_SAFE_MARGIN_PX

    // 朝上:底部凹口中点 (w/2, h - d) 对齐投影圆顶部 (cx, cy - r)
    const top = shouldFlipUp
        ? cy - r - (h - d)
        : downTop

    return {
        left: `${left}px`,
        top: `${top}px`,
    }
})
```

> 注:`labelWidth/Height/notchDepth` 在挂载前为 0,此时 label 隐藏、`positionStyle` 不被实际使用,故无需额外空值守卫;如希望更保守,可在三者为 0 时提前返回 `{left:'0px', top:'0px'}`。

---

## 7. 与现有代码的接驳

| 改动点 | 说明 |
| --- | --- |
| `SolarLabel.vue` `positionStyle` | 用 §6.2 的实现替换占位实现,删除 line 48 的"接入 `calcOffset()`"TODO |
| `SolarLabel.vue` `onMounted` 读取几何量 | 新增 §6.1 的读取逻辑 |
| `labelRect` 上报 watch | **无需改动**。该 watch 已监听 `positionStyle.value.left/top`,翻转改变 `top` 时会自动重算并上报新的 `DOMRect`,滞后判定(`isNearLabel`)继续正确工作 |
| `ContentLayer.vue` / 装饰层 / `Shape.vue` | **无需改动**。形状本身上下都有凹口,内容不镜像 |
| `hover.js` / `hover store` | **无需改动**。定位是纯视图层逻辑,不涉及状态机与投影计算 |

---

## 8. 作用域与已知限制

本期**仅处理竖直方向**的裁切(朝下↔朝上翻转)。以下不在本期范围,作为已知限制记录:

1. **水平裁切**:天体非常靠近视口左/右边缘时,`left = cx − W/2` 可能使 label 半边出屏。未处理,因为天体通常位于视口水平中部。若将来需要,可加水平钳制
   `left = clamp(cx − W/2, m, vw − W − m)`;但钳制会让凹口中点不再正对天体中心,是"对齐 ↔ 不出屏"的权衡。
2. **上下都放不下**:极端放大(`r` 极大)或极小视口下,朝下、朝上都会裁切。当前实现在该情形下仍按"朝下底边是否超界"决策,可能朝上后顶部仍被裁。属罕见退化场景,后续可加竖直钳制兜底。
3. **装饰非对称**:朝上时 `stripe-chip` 斜纹条位于远离天体侧(见 §5.4)。如需对称,可为 `OuterDecorLayer` 增加翻转态样式。

---

## 9. 验证清单

- [ ] 天体位于视口中部:label 朝下,顶部凹口中点切于投影圆底部,不重叠天体。
- [ ] 天体靠近视口底部:label 翻转朝上,底部凹口中点切于投影圆顶部,完整可见、不被裁切。
- [ ] 放大镜头使 `radiusPx` 增大、label 被推低:同样触发翻转朝上。
- [ ] 翻转前后:标题/正文/按钮始终正立(只移动容器,无镜像)。
- [ ] 翻转后:`labelRect` 上报正确,鼠标靠近 label 的滞后判定(进入 label 状态)仍正常。
- [ ] 任意朝向、常规缩放下:label 与投影圆无重叠,天体中心区域可被鼠标命中(为 focus 预留)。
- [ ] 悬停期间(公转已冻结)label 位置稳定,不在阈值附近抖动。

---

## 10. 风险

| 风险 | 等级 | 说明 / 缓解 |
| --- | --- | --- |
| 几何量读取依赖挂载时机 | 低 | label 显示恒晚于挂载;静态值读一次即可。必要时加 0 值守卫 |
| 阈值边界抖动 | 低 | 公转冻结使投影稳定;如复现可加翻转迟滞带(§5.3) |
| 极端缩放/极小视口双向裁切 | 低 | 罕见;已记为已知限制,后续可加竖直钳制 |
| 容器若新增 `transform` | 中 | 本文公式假设容器原点为左上角;若加 `transform` 须同步修订(§2) |
