# label 吃掉天体点击 — 修复方案(pointer-events 改造)

> 缘起:视角拉远后,锚点天体的投影圆半径 < 16 px(= `--notch-depth`),`SolarLabel` 容器矩形(426×286)的**顶部凹口区域会压在天体投影圆上**;而 `.solar-label.is-visible` 此时是 `pointer-events: auto`,凹口的"透明但属于矩形容器"的那一块就吃掉了本应命中 canvas 的点击。
>
> 本文档落地"方案 A":**把 `.solar-label` 容器固定为 `pointer-events: none`,只让 `.shape`(由 `clip-path` 收束为多边形可见区)接收点击**。凹口和透明边角不再是 click target,点击自然穿透到 canvas;按钮维持自身的 `pointer-events: auto` 不受影响。
>
> `@pointerenter` / `@pointerleave` 从容器挪到 `<Shape>` 上,继续喂给 `isLabelHover` —— `isLabelHover` 信号被保留,只是触发边界从"426×286 的矩形"收紧为"clip-path 多边形",语义更准。
>
> 工程内已有先例:`SolarPanel.vue:42/56/63` 即"容器 none + 内容 auto"的同款 pattern。本次把它推广到 `SolarLabel`,两个 HUD 组件 pointer 模型对齐。

---

## 1. 改动总览

| 文件 | 改动 | 量级 |
|---|---|---|
| `src/components/SolarLabel.vue` | 模板把 `@pointerenter`/`@pointerleave` 从 `<div class="solar-label">` 挪到 `<Shape>`;`.solar-label.is-visible` 删去 `pointer-events: auto` 一行 | 1 行删除 + 2 行迁移 |
| `src/components/label/Shape.vue` | `.shape` 的 style 块显式声明 `pointer-events: auto`(显式表达意图,虽然初始值就是 `auto`) | 1 行新增 |

`onPointerEnter` / `onPointerLeave` 函数体不动(仍读写 `hoverStore.setLabelHover`)。`labelRect` 计算路径不变(仍由 `containerRef.value.getBoundingClientRect()` 取容器矩形,供 `isNearLabel` 距离判定使用)。

---

## 2. 文件改动详情

### 2.1 `src/components/SolarLabel.vue`

#### 模板(`SolarLabel.vue:2-9`)

**改前**:

```vue
<div
    class="solar-label"
    ref="container"
    :style="positionStyle"
    :class="{'is-visible': hoverStore.shouldShowLabel}"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
>
```

**改后**:

```vue
<div
    class="solar-label"
    ref="container"
    :style="positionStyle"
    :class="{'is-visible': hoverStore.shouldShowLabel}"
>
```

`<Shape>` 那一行(`SolarLabel.vue:11`)同步加上两个监听:

```vue
<!-- 裁剪区域开始 -->
<Shape
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
></Shape>
<!-- 裁剪区域结束 -->
```

> Vue 3 的属性继承默认为 `inheritAttrs: true`,`<Shape>` 的根元素是单 root(`Shape.vue:2` 的 `<div class="shape">`),所以 `@pointerenter` / `@pointerleave` 会被自动转发到 `.shape` 这个 div 上,不需要在 Shape.vue 内部 emit 转发。

#### 样式(`SolarLabel.vue:268-276`)

**改前**:

```css
/* 可见态 */
.solar-label.is-visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    /* 显示时立刻可见,再淡入 */
    transition:
        opacity 0.5s linear,
        visibility 0s linear 0s;
}
```

**改后**(删除 `pointer-events: auto` 一行):

```css
/* 可见态 */
.solar-label.is-visible {
    opacity: 1;
    visibility: visible;
    /* 显示时立刻可见,再淡入 */
    transition:
        opacity 0.5s linear,
        visibility 0s linear 0s;
}
```

`.solar-label` 基础规则中(`SolarLabel.vue:233`)的 `pointer-events: none` **保持不变**——它现在覆盖到所有状态(包括可见态),容器永远不是 click target。

### 2.2 `src/components/label/Shape.vue`

`.shape` 的 style 块(`Shape.vue:25-40`)追加一行:

```css
.shape {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(/* ... */);

    pointer-events: auto;   /* ← 新增:让 clip-path 收束后的多边形成为唯一的 click target */

    clip-path: polygon(
        /* ... */
    );
}
```

> 不加这行也能跑(`pointer-events` 初始值就是 `auto`),但显式声明把"`.shape` 是这一层结构里**唯一**接住点击的元素"这件事写到样式里,与父级的 `none` 形成可见的对仗,后续读代码会更省力。

---

## 3. 点击穿透行为矩阵

改动后逐场景核对:

| 鼠标落点 | 命中链 | 期望结果 |
|---|---|---|
| 锚点天体本体 | `.solar-label` (none) → `.content-layer` (默认 auto 但被父级 visibility/none 影响) → `.shape` 的 clip-path 外侧 → canvas | canvas raycaster 命中天体 ✓ |
| 凹口透明区(label 矩形内、polygon 外) | `.solar-label` (none) → 直接穿透 → canvas | canvas raycaster 命中天体(若位置正好在天体上)或 miss ✓ |
| label 可见多边形(`.shape` 内非按钮区域) | `.shape` (auto) | `.shape` 接收 click(无监听,无副作用);**pointerenter 触发 `setLabelHover(true)`** ✓ |
| label 底部按钮 | `LuminousAction.bottom-button` (auto) | 按钮自身的 `@click="onFocusClick"` 触发 ✓ |
| label 外的星空 | (label 矩形外,与 label 无关)→ canvas | canvas raycaster 处理 ✓ |

关键校验点:**当锚点天体投影圆半径 < 16 px 时,凹口区域不再吃点击**——这是本次修复的核心目标。

---

## 4. `isLabelHover` 信号链校验

`isLabelHover` 由 `onPointerEnter` / `onPointerLeave` 直接调 `hoverStore.setLabelHover()` 维护,本次改动后这条链保留,仅触发边界变化:

| 项 | 改前 | 改后 |
|---|---|---|
| 触发元素 | `.solar-label`(426×286 矩形) | `.shape`(clip-path 多边形) |
| 触发条件 | 鼠标进入矩形 | 鼠标进入可见多边形 |
| 凹口区是否算 "hover"? | **是**(语义不准:此处视觉是透明的) | **否**(语义更准) |
| `isNearLabel` 覆盖凹口区? | 不需要(`isLabelHover` 已覆盖) | **是**(由 `tickHover` 的距离滞后判定填补) |

`isActiveLocked = isLabelHover || isNearLabel`(`stores/hover.js`)的语义没变——凹口区从"`isLabelHover` 触发锁定"切换为"`isNearLabel` 触发锁定",最终都把 `activeEntity` 锁住,用户的 UX 感受不变。

> 唯一会有细微差异的场景:鼠标停在凹口正中、距离 label 矩形外缘 > `labelHysteresis.enterDistancePx`(目前 8 px)——改前 `isLabelHover` 会兜底锁定,改后 `isNearLabel` 不会触发,锁定可能掉。但凹口高度只有 16 px,这个"中心带"非常窄,实际很难命中;若调试中发现这种边界状况偶发,把 `enterDistancePx` 上调到 ≥ 16 即可弥合。

---

## 5. 实施步骤

按顺序执行,每步改完目测一次:

1. **`Shape.vue`**:`.shape` 的 style 块加 `pointer-events: auto`
2. **`SolarLabel.vue`** 模板:把 `@pointerenter` / `@pointerleave` 从 `<div class="solar-label">` 挪到 `<Shape>`
3. **`SolarLabel.vue`** 样式:`.solar-label.is-visible` 删去 `pointer-events: auto` 一行
4. 浏览器**完整刷新**(不靠 HMR——pointer-events 改动 HMR 一般能识别,但保险起见手动刷),按 §6 验收

---

## 6. 验收清单

- [ ] 视角拉到最远(行星投影圆半径目测 ≤ 5 px),点击任一行星本体能进入聚焦动画(命中 canvas raycaster)
- [ ] 同一视角下,鼠标点在 label 凹口正中(行星正下方约 8 px 处)同样能命中天体(穿透成功)
- [ ] 鼠标停在 label 可见多边形上方时,`hoverStore.isLabelHover` = true(Vue DevTools 检查)
- [ ] 鼠标停在凹口透明区时,`hoverStore.isLabelHover` = false,`hoverStore.isNearLabel` = true(锁定不掉)
- [ ] 鼠标在 label 外的星空中移动,不会意外触发 `setLabelHover(true)`
- [ ] 点击 label 底部的"聚焦"按钮仍然能触发 `onFocusClick` —— 按钮的 `pointer-events: auto` 不被影响
- [ ] label 淡出动画期间(`is-visible` 已移除、opacity 还在 1→0),鼠标穿过 label 区域不会触发 `setLabelHover` —— 因为容器有 `visibility: hidden` 在 0.5s 后接管
- [ ] 控制台无 console 报错;无 NaN

---

## 7. 风险与未尽事项

### 7.1 `clip-path` 与 pointer 事件的浏览器一致性

CSS 规范:`clip-path` 影响 hit-testing —— polygon 外侧的元素不可点击。Chromium / Safari / Firefox 现代版本均符合规范。**项目目前的目标浏览器范围内无已知例外**,无需 polyfill。

### 7.2 `OuterDecorLayer` 是否需要 `pointer-events: auto`?

`OuterDecorLayer`(`SolarLabel.vue:16`)是位于 `.shape` 之外的装饰件层(发光、光晕、外轨等)。这些装饰**没有点击需求**,保持继承父级的 `none` 即可——它们既不该吃 click,也不该触发 hover。本次不动它。

### 7.3 SolarLabel 外层 div 不再有 click 事件载体

如果将来要给整个 label "贴一个点击行为"(如"按 Esc 等价于点击 label 容器"之类),不能再依赖 `.solar-label` 上的 `@click`——要么走全局键盘事件,要么放在 `.shape` 上。本次没有此类需求,但记下来以免将来踩坑。

### 7.4 不引入"label 容器整体可点 = 触发聚焦"语义

讨论中评估过的"方案 B"(给容器整体加 `@click` 兜底)被否决——它会让 label 透明区也成为隐式 click target,与按钮的显式 affordance 重叠,且让"路过 label 边角"易误触发聚焦,**不是 HUD 风格界面应有的语义**。本次明确不走这条路。
