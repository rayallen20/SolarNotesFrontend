# 悬停天体时显示"可点击"光标 — 实现方案(phase 驱动 class)

> 需求:当悬停状态机处于 `body` 状态(鼠标正压在某个天体上)时,把鼠标样式切换为 `index.css` 中"可点击层"使用的光标(`@/assets/cursors/cursor-pointer.png`);离开天体则回落到默认光标。
>
> **核心难点:天体不是 DOM 元素。** `index.css` 的"可点击层"靠**元素选择器**(`button` / `a[href]` …)命中真实 DOM;但一个天体是 Three.js 在 `<canvas>` 里 raycast 命中的 mesh —— 整个画面只有**一个 `<canvas>` DOM 元素**,CSS 无法"选中鼠标正下方的那个天体"。因此这个光标只能由**悬停状态机的 `phase` 驱动**:`phase === HoverPhase.body` 的语义恰好就是"鼠标正压在某个天体上",状态机(`tickHover` → `enterBody`)已经把"鼠标下面是不是天体"算好了。
>
> **落地思路(三段分工):**
> 1. **store** 加派生量 `shouldUseClickableCursor`(与既有的 `shouldShowLabel` / `shouldFreezeRevolution` 并排),把"什么状态算可点击"收在状态机里;
> 2. **`SolarCanvas.vue`** 在 `.canvas-container` 上按该派生量切一个 `is-clickable` class;
> 3. **`index.css`** 加一条规则,把 `.canvas-container.is-clickable canvas` 的光标指到既有的那张 `cursor-pointer.png`。
>
> 这样 cursor 规则**全部集中在 `index.css`**(与现状一致),组件只管"切 class",资源路径与热点坐标 `12 0` 不重复;"phase → 可点击"的判断在 store,符合既有 `shouldXxx` 派生量模式。

---

## 1. 改动总览

| 文件 | 改动 | 量级 |
|---|---|---|
| `src/stores/hover.js` | 新增 computed 派生量 `shouldUseClickableCursor`,并加入 `return` 暴露 | ~5 行 |
| `src/pages/SolarCanvas.vue` | `.canvas-container` 上按 `hoverStore.shouldUseClickableCursor` 绑定 `:class="{ 'is-clickable': ... }"` | 1 行 |
| `src/assets/index.css` | 新增一条规则:`.canvas-container.is-clickable canvas` 使用可点击光标 | ~4 行 |

无需在 `SolarCanvas.vue` 里 `import HoverPhase`(判断已收进 store 的派生量,模板只读一个布尔)。

---

## 2. 文件改动详情

### 2.1 `src/stores/hover.js` — 新增派生量

在 getters 区(`shouldShowLabel` / `shouldFreezeRevolution` 附近,`hover.js:128-143`)追加:

```js
/**
 * @type {import('vue').ComputedRef<Boolean>} 本派生量用于标识当前是否应使用"可点击层"的鼠标样式
 * Tips: 仅 body 状态(鼠标正压在某个天体上,点击即触发聚焦)才显示可点击光标;
 *       sticky/label 状态均不算"点击即聚焦",故不显示(详见方案文档 §4)
 * */
const shouldUseClickableCursor = computed(() => phase.value === HoverPhase.body)
```

并在 `return` 的 computed 行(`hover.js:303-304`)把它暴露出去:

```js
// computed
shouldShowLabel, shouldFreezeRevolution, isActiveLocked, labelText, shouldUseClickableCursor,
```

> `HoverPhase` 已在 `hover.js:4` 导入,`computed` 已在 `hover.js:2` 导入,无需新增 import。

### 2.2 `src/pages/SolarCanvas.vue` — 按派生量切 class

模板里的容器 div(`SolarCanvas.vue:3`):

**改前**:

```vue
<div ref="container" class="canvas-container"></div>
```

**改后**:

```vue
<div
    ref="container"
    class="canvas-container"
    :class="{ 'is-clickable': hoverStore.shouldUseClickableCursor }"
></div>
```

> `hoverStore` 已在 `SolarCanvas.vue:39` 取得;静态 `class` 与动态 `:class` 会被 Vue 合并,互不冲突。`phase` 只在状态切换时变(非每帧),切 class 很廉价。

### 2.3 `src/assets/index.css` — 新增 canvas 可点击光标规则

在"可点击层"规则(`index.css:33-44`)之后追加:

```css
/* 悬停在天体上时(状态机 body 态),canvas 使用可点击层的鼠标样式 */
.canvas-container.is-clickable canvas {
    cursor: url("@/assets/cursors/cursor-pointer.png") 12 0, pointer;
}
```

> canvas 是 Three.js 通过 `engine.js:67` 的 `container.appendChild(renderer.domElement)` 塞进 `.canvas-container` 的子元素,所以后代选择器 `.canvas-container ... canvas` 能命中。光标值与 `index.css:43` 的"可点击层"完全一致(同一张 PNG、同一热点 `12 0`)。

---

## 3. 关键:特异度能压过 `*`

canvas 当前的光标来自全局通配规则(`index.css:29-31`),新规则要盖过它——与按钮 hover 那个 bug 同源,**谁特异度高谁说了算**:

| 规则 | 选择器构成 | 特异度 |
|---|---|---|
| `*, *::before, *::after { cursor: default.png }` | 通配符 | **(0,0,0)** |
| `.canvas-container.is-clickable canvas { cursor: pointer.png }` | 2 个 class + 1 个元素 | **(0,2,1)** |

`(0,2,1)` 稳压 `(0,0,0)`,**不需要 `!important`**。`is-clickable` 移除后(非 body 态),canvas 自动落回 `*` 的默认光标,**无需手动复位**。

> 注:`index.css` 里的 `canvas { ... }` 规则(`index.css:19-26`)只设了 `display/position/...`,**未设 `cursor`**,不参与竞争;`SolarCanvas.vue` 的 scoped `.canvas-container` 规则也只设了尺寸,无 `cursor`。所以 canvas 上唯一的 cursor 竞争就发生在上表两条之间。

---

## 4. 为什么只取 `body`(需求范围核验)

核对另外两个非 idle 态,确认排除它们是正确的:

| 状态 | 点击会发生什么 | 是否显示可点击光标 |
|---|---|---|
| `body` | `onPointerUp` raycast 命中天体 → `requestFocus` **聚焦** | **是** ✓ |
| `sticky` | 鼠标已离开天体进入粘滞区;`onPointerUp` 重新 raycast,落点不在天体上 → `resolveFocusAnchor` 返回 null → `requestClear`(**取消**聚焦,而非聚焦该天体) | 否 |
| `label` | 命中的是 label DOM;label 内按钮自带 pointer(走 `index.css` 的 `button` 规则),label 背景非"点击即聚焦" | 否 |

结论:`phase === body` 正好是"**点下去会触发聚焦**"的唯一区间,与需求严丝合缝。

---

## 5. 实施步骤

1. **`hover.js`**:加 `shouldUseClickableCursor` computed(§2.1),并加入 `return`
2. **`SolarCanvas.vue`**:`.canvas-container` 加 `:class="{ 'is-clickable': hoverStore.shouldUseClickableCursor }"`(§2.2)
3. **`index.css`**:加 `.canvas-container.is-clickable canvas` 规则(§2.3)
4. 浏览器刷新,按 §6 验收

---

## 6. 验收清单

- [ ] 鼠标移到任一天体上,光标变为可点击光标(`cursor-pointer.png`),且热点对齐(`12 0`)
- [ ] 鼠标从天体移到空白星空,光标回落为默认光标(`cursor-default.png`)
- [ ] 鼠标停在天体边缘外的**粘滞区**(label 已显示、但鼠标仍在 canvas 上、未压在天体上)时,光标为默认光标(不是可点击光标)
- [ ] 鼠标移到 **label** 上:label 背景区为默认/容器光标,label 内**按钮**为可点击光标(按钮走 `index.css` 既有 `button` 规则,不受本次改动影响)
- [ ] Vue DevTools 中,鼠标在天体上时 `hoverStore.shouldUseClickableCursor === true`,离开后为 `false`
- [ ] 控制台无报错;光标 PNG 正常加载(无 404)

---

## 7. 风险与未尽事项

### 7.1 光标只跟随悬停 `phase`,不感知聚焦状态

本方案的可点击光标严格由 `hoverStore.phase === body` 决定,**不读取聚焦状态机(`focusStore`)**。即:已聚焦(`focused`)后再悬停某天体,只要悬停状态机进入 `body`,光标仍会显示为可点击。这与当前"点击天体即(重新)聚焦"的交互是自洽的。若将来希望在某些聚焦态下抑制可点击光标,再在 `shouldUseClickableCursor` 里叠加 `focusStore` 条件即可,本方案不预设。

### 7.2 可选润色:用 CSS 变量消除光标串重复

`url("@/assets/cursors/cursor-pointer.png") 12 0, pointer` 现在出现在 `index.css` 两处("可点击层" + 本次新增)。若想彻底去重,可在 `:root`(`index.css:7-10`)定义:

```css
:root {
    --border: #20C6D8;
    --cursor-pointer: url("@/assets/cursors/cursor-pointer.png") 12 0, pointer;
}
```

再让两条规则都写 `cursor: var(--cursor-pointer);`。一处改、两处生效。非必须,属整洁度优化。

### 7.3 派生量命名

本方案采用 `shouldUseClickableCursor`(与既有 `shouldShowLabel` / `shouldFreezeRevolution` 的 `shouldXxx` 风格一致)。若后续要扩展到"多种光标按状态切换",可考虑把派生量从布尔升级为"光标类型"枚举(如 `cursorKind`),但当前只有一种可点击光标,布尔足够,不提前抽象。