# label 靠近视口左右边缘显示不全 — 修复方案(水平位置钳制)

> 缘起:`SolarLabel` 的 `positionStyle` 计算属性目前只把 label 水平居中对齐到投影圆心(`left = centerX - width / 2`),**水平方向没有任何视口边界处理**。当锚点天体靠近视口左侧或右侧时:
>
> - `centerX < width / 2` → `left < 0` → label 左半被视口裁掉;
> - `centerX > innerWidth - width / 2` → `left + width > innerWidth` → label 右半被裁掉。
>
> 垂直方向已有 `shouldFlipUp`(`SolarLabel.vue:100`)兜住下边缘,水平方向连对应的判定都没有 —— 这是**需求设计阶段就缺失的一段逻辑**,而非实现 bug。
>
> 本文档落地的修复思路:**当 label 靠左/靠右溢出时,把它整体推回视口内,直至完整显示**。左溢出向右推、右溢出向左推,各自推到刚好贴住视口安全边距即停 —— 这个"最小移动量"在数学上恰好等价于把 `left` **钳制(clamp)** 到 `[MARGIN, innerWidth - width - MARGIN]`。
>
> **注意:这不是垂直方向那种"翻转(flip)"。** 垂直能翻是因为 label 上下各有一个凹口,翻转切换"哪个凹口与投影圆相切";水平方向没有左/右凹口可切,翻转无从谈起,正确的动作是钳制。

---

## 1. 改动总览

| 文件 | 改动 | 量级 |
|---|---|---|
| `src/components/SolarLabel.vue` | `positionStyle` 中把 `const left = centerX - width / 2` 一行,改为先算 `rawLeft` 再做水平钳制;并把 `VIEWPORT_SAFE_MARGIN_THRESHOLD_PX` 的 JSDoc 拓宽为"同时覆盖上下/左右边缘" | ~6 行新增 + 1 处注释更新 |

**不动的部分**:垂直方向的 `downTop` / `downBottom` / `shouldFlipUp` / `top` 逻辑完全不变;`labelRect` 上报的 `watch`(`SolarLabel.vue:145`)不动 —— 它读 `positionStyle.value.left`,钳制后的新 `left` 会自动带进 `getBoundingClientRect()`,`isNearLabel` 距离判定继续正确。

---

## 2. 文件改动详情

### 2.1 复用安全边距常量(`SolarLabel.vue:37-42`)

水平钳制需要一个"距视口边缘的最小安全距离",其语义与垂直方向的 `VIEWPORT_SAFE_MARGIN_THRESHOLD_PX`(目前 8px)完全一致 —— **复用同一个常量**即可,无需新增第二个。只需把它的 JSDoc 从"仅描述下边缘"拓宽为"覆盖四边"。

**改前**:

```js
/**
 * @type {Number} 视口安全边距阈值:
 * - label与视口下边缘的距离需大于该值,label才能出现在投影圆的正下方
 * - 否则label需要翻转到投影圆的正上方
 * */
const VIEWPORT_SAFE_MARGIN_THRESHOLD_PX = 8
```

**改后**:

```js
/**
 * @type {Number} 视口安全边距阈值:label与视口边缘需保持的最小距离
 * - 垂直方向: label与视口下边缘的距离需大于该值,label才能出现在投影圆的正下方,否则翻转到正上方
 * - 水平方向: label靠左/靠右溢出时,推回视口内后其左/右边缘距视口边缘需保持该距离
 * */
const VIEWPORT_SAFE_MARGIN_THRESHOLD_PX = 8
```

> 若你更倾向"垂直翻转阈值"与"水平钳制边距"各用一个独立常量(语义上一个是决策边界、一个是保持距离),也可以新增一个 `HORIZONTAL_SAFE_MARGIN_PX`。但二者都表达"离视口边 ≥ 8px",合用一个更省心,这里按合用写。

### 2.2 水平位置钳制(`SolarLabel.vue:92-93`)

**改前**:

```js
// 水平位置: 凹口中点在投影圆圆心的正下方
const left = centerX - width / 2
```

**改后**:

```js
// 水平位置: 理想情况下凹口中点对齐投影圆心(label 水平居中于圆心)
const rawLeft = centerX - width / 2

// 水平钳制: 靠左/靠右溢出时,把 label 推回视口内,直至完整显示
// 代价: 移动后顶部凹口中点不再落在 centerX 上,凹口不再指向天体(需求设计取舍,已接受)
const left = Math.min(
    Math.max(rawLeft, VIEWPORT_SAFE_MARGIN_THRESHOLD_PX),
    window.innerWidth - width - VIEWPORT_SAFE_MARGIN_THRESHOLD_PX
)
```

逻辑拆解:

- `Math.max(rawLeft, MARGIN)` —— 管"**左溢出向右推**":`rawLeft < MARGIN` 时取 `MARGIN`,label 左边缘贴住安全边距;
- `Math.min(..., innerWidth - width - MARGIN)` —— 管"**右溢出向左推**":`rawLeft + width > innerWidth - MARGIN` 时取 `innerWidth - width - MARGIN`,label 右边缘贴住安全边距;
- label 在视口内放得下时,两个边界不可能同时触发(互斥),钳制对"不靠边"的常规情况零影响(`rawLeft` 原样返回)。

---

## 3. 行为矩阵

改动后逐场景核对(设 `W = innerWidth`,`w = width = 426`,`m = MARGIN = 8`):

| 天体水平位置 | `rawLeft` | 钳制后 `left` | 效果 |
|---|---|---|---|
| 居中 | `m ≤ rawLeft ≤ W-w-m` | `rawLeft`(不变) | 凹口正对天体,无移动 ✓ |
| 偏左、未溢出 | 同上区间 | `rawLeft`(不变) | 同上 ✓ |
| 偏左、溢出(`rawLeft < m`) | `< m` | `m` | 向右推,左边缘贴安全边距,label 完整 ✓ |
| 偏右、溢出(`rawLeft > W-w-m`) | `> W-w-m` | `W-w-m` | 向左推,右边缘贴安全边距,label 完整 ✓ |

> 这四种水平情况与既有的垂直 `shouldFlipUp` 正交叠加 —— 水平钳制只改 `left`,垂直翻转只改 `top`,互不干扰。

---

## 4. 实施步骤

1. **`SolarLabel.vue:37-42`**:拓宽 `VIEWPORT_SAFE_MARGIN_THRESHOLD_PX` 的 JSDoc(见 §2.1)
2. **`SolarLabel.vue:92-93`**:把 `const left = ...` 改为 `rawLeft` + 钳制(见 §2.2)
3. 浏览器刷新,按 §5 验收

---

## 5. 验收清单

- [ ] 把锚点天体拖到视口**最左侧**(投影圆心贴近左边缘),label 完整显示、左边缘距视口左边 ≥ 8px,不被裁切
- [ ] 把锚点天体拖到视口**最右侧**,label 完整显示、右边缘距视口右边 ≥ 8px,不被裁切
- [ ] 天体在视口**水平居中区域**时,label 仍水平居中、顶部凹口正对天体(钳制未误伤常规情况)
- [ ] 靠边场景下,label 的悬停/锁定仍正常(`isNearLabel` 用钳制后的真实矩形判定,鼠标移到被推后的 label 上能锁定 `activeEntity`)
- [ ] 水平钳制与垂直翻转叠加:把天体拖到**视口右下角**,label 应同时"向左推 + 翻转到天体上方",完整显示
- [ ] 控制台无报错;无 NaN

---

## 6. 风险与未尽事项

### 6.1 凹口不再指向天体(已知代价,本次接受)

钳制一旦生效,`left ≠ centerX - width/2`,顶部凹口中点(label 本地 x = width/2 = 213)就不再落在 `centerX` 上,**凹口不再"指着"天体**。这是本方案明确放弃的语义,换取 label 完整显示。

若将来要找回指向,可在本方案之上**叠加**"凹口水平偏移"(原讨论中的方案 B):算 `notchOffsetX = centerX - (left + width/2)`,通过 CSS 变量传给 `Shape.vue` 让凹口反向平移、仍指向天体;偏移需限制在顶部水平线可移动区间内(否则凹口会爬到斜边/边框上)。两者不冲突,可后续增量实现。

### 6.2 视口比 label 还窄的极端情况

`Math.min(Math.max(rawLeft, m), W - w - m)` 中,当 `W - w - m < m`(即视口宽度 `W < w + 2m = 442px`)时,外层 `Math.min` 的右边界小于左边界,结果会取右边界 → `left` 可能 `< m`,label 左侧仍会被裁。

label 固定宽 426px,常规桌面视口不会触发;若需兼容极窄窗口,可加注释说明"此时右边界优先",或对超窄视口单独降级处理。本次按"不会发生"忽略,仅记录。

### 6.3 `labelRect` 上报无需改动

`watch`(`SolarLabel.vue:145`)依赖 `positionStyle.value.left`,钳制后的新值会触发它重新 `getBoundingClientRect()` 并上报。`isNearLabel` 的滞后判定基于上报的真实矩形,因此**钳制后悬停/锁定行为自动正确**,这条链无需任何改动。