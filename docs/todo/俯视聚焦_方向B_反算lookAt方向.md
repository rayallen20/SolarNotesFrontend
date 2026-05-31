# 俯视聚焦 — 方向 B:反算 `lookAt` 方向,让天体精确落在 NDC (X_target, 0)

> 缘起:`docs/todo/俯视聚焦时天体偏离视口右侧_钳制相机极角.md` 的钳制方案落地后实测残余偏移远大于预期(俯视下天体常常出屏底)。本方向不再走"钳制相机姿态"的路,而是**保留用户原视角的 elevation,反过来去算"应当让相机看向哪个点(`toControlsTarget`),才能让天体在屏幕右侧 + 垂直居中"**。
>
> 平行方向是 `俯视聚焦_方向A_钳制末态相机到近赤道.md`,实现简单但 UX 上相机会显著下沉。**先按本方向跑一遍代码、再按 A 跑一遍**,凭手感选效果对的那个。

---

## 1. 核心思想

现状的 `toControlsTarget` 计算逻辑(`focus.js:150-163`)是"在世界水平面里、沿 `-cameraRightWorld` 推 `targetShift` 距离"——这相当于**先决定 `toControlsTarget` 在世界里的偏移,然后让 OrbitControls 用 `camera.up = (0,1,0)` 反算相机姿态**。问题是:`controls.update()` 算出来的相机本地 +Y 轴(屏幕"上")在非赤道视角下偏出世界 Y 轴,导致 `toControlsTarget` 的水平偏移泄漏到屏幕 Y 上,天体下沉。

本方向反过来做:
- 末态相机位置 `toCameraPosition` 沿用现有 `body + ttc × desiredDistance` 计算
- 然后**反算 `toControlsTarget` 的位置**,使得"camera 在 `toCameraPosition`、用 world Y 作 up、看向 `toControlsTarget`"这套姿态推出来的屏幕坐标中,body 严格落在 NDC (X_target, 0)

这是一个二元方程组的解(两个未知数:`toControlsTarget` 在两个独立维度上的位置;两个约束:NDC X = X_target、NDC Y = 0),数学上能闭式解出来。

---

## 2. 数学推导(简版)

省略中间步骤,直接给关键关系。详细推导见 §10 附录(如果你想深挖)。

设:
- `α` = 当前相机相对天体的 elevation(rad,从世界水平面向上为正)
- `γ` = `atan(horizontalShiftRatio × tan(fovX/2))` = 目标"body 相对 forward 在屏幕水平方向的夹角"(对应 NDC X = horizontalShiftRatio)
- `β_z` = `toControlsTarget → toCameraPosition` 方向(也就是 OrbitControls 的 `z_back`)相对水平面的 elevation
- `φ_hg` = `z_back` 水平投影 与 `g_h`(`body - camera` 的水平投影) 在水平面内的方位角差

**关键解析关系**(由"body 在屏幕本地 Y_l = 0"+"body 在屏幕本地 X_l > 0 且对应 NDC X = X_target"两条约束联立求得):

```
sin(β_z) = sin(α) / cos(γ)                            ... (1)
cos(φ_hg) = -sin(α) × cos(β_z) / (cos(α) × sin(β_z))   ... (2)
```

`(1)` 说的是:**z_back 比 ttc 更"陡"**(elevation 更大,因为 cos(γ) < 1)。直觉上对——为了让 body 在屏幕右侧 + 垂直居中,相机不能直直看向 body,而要看向比 body 更下方(对俯视角)的一个点,这样 body 才会浮在屏幕"上半屏" 反过来抵消 y_axis_end 的水平倾斜。

`(2)` 给的是 `cos`,所以 `φ_hg` 有正负两个解 —— 对应"body 在屏幕左侧 vs 右侧"。**取使 body 落在右侧的那个符号**。

### 2.1 可行域

`(1)` 要求 `sin(α) ≤ cos(γ)`,即 `α ≤ asin(cos(γ)) = π/2 - γ`。

代入典型 16:9 / fovY=60° / horizontalShiftRatio=0.8:
- `γ = atan(0.8 × tan(45.76°)) = atan(0.821) ≈ 39.4°`
- `α_max = 90° - 39.4° = 50.6°`

也就是说:**只要相机 elevation 在 ±50° 以内,本方向能精确把 body 放到 NDC (0.8, 0)**。超过这个范围(用户镜头拉到极俯视/极仰视)需要兜底,见 §5。

---

## 3. 算法

按这个顺序在 `initFocusAnimation` 里替换原本的 `targetShift / cameraRightWorld / targetOffset / toControlsTarget` 那段:

```
1. 已有: toCameraPosition = targetPosition + ttc × desiredDistance
2. 计算 g = targetPosition - toCameraPosition          (从相机指向天体的向量,= -ttc × desiredDistance)
3. 计算 D = |g| = desiredDistance
4. 计算 α = asin(-g.y / D)                            (相机elevation,相机在天体之上时为正)
5. 计算 horizontalShiftRatio = min(PANEL_RATIO + PANEL_GAP_RATIO, MAX_SHIFT_RATIO)  (现有)
6. 计算 fovX = 2 × atan(tan(fovRad/2) × camera.aspect)  (现有)
7. 计算 γ = atan(horizontalShiftRatio × tan(fovX/2))
8. ★ 可行域检查: if (sin(α) > cos(γ) - safety_margin) → 触发兜底, 见 §5
9. 计算 β_z = asin(sin(α) / cos(γ))
10. 计算 g_h_norm = (g.x, 0, g.z).normalize()         (g 的水平方向,单位向量)
11. 计算 cos_φhg = -sin(α) × cos(β_z) / (cos(α) × sin(β_z))
12. 计算 sin_φhg = ±sqrt(1 - cos_φhg²)                (符号选取见 §3.1)
13. 构造 p_hat: 把 g_h_norm 在水平面内绕世界 Y 轴旋转 φ_hg 角度,
    p_hat.x = g_h_norm.x × cos_φhg - g_h_norm.z × sin_φhg
    p_hat.y = 0
    p_hat.z = g_h_norm.x × sin_φhg + g_h_norm.z × cos_φhg
14. 构造 z_back = cos(β_z) × p_hat + sin(β_z) × (0, 1, 0)
    (此即 OrbitControls 末态会算出来的 "camera 指向远离 controls.target 方向"的单位向量)
15. lookAtPoint = toCameraPosition - z_back × D
16. toControlsTarget = lookAtPoint
```

`cameraRightWorld` / `targetOffset` 两个模块级缓存向量在本方向**不再被使用**——可以从文件顶部缓存定义里删掉,或暂时留着不影响。

### 3.1 `sin_φhg` 符号选取

`(2)` 给的是 `cos(φ_hg)`,正负不定。需要用一个明确的方向参考来挑符号。最稳妥的做法:**用现有的 `cameraRightWorld`(相机开始那一帧的 matrixWorld 第 0 列)作为"屏幕水平向右"的世界方向参考**,选择使 lookAtPoint 落在 body 的 `-cameraRightWorld` 方向上(即"屏幕左侧")的那个符号。

伪代码:

```
camera.updateMatrixWorld()
cameraRightWorld.setFromMatrixColumn(camera.matrixWorld, 0).normalize()

// 试两种符号,选 lookAtPoint - body 投影到 -cameraRightWorld 为正的那个
sin_φhg_candidate = sqrt(1 - cos_φhg²)
// 构造 z_back 两种候选
for sign in [+1, -1]:
    p_hat = rotate(g_h_norm, cos_φhg, sign × sin_φhg_candidate)
    z_back = cos(β_z) × p_hat + sin(β_z) × (0, 1, 0)
    candidate_lookAt = toCameraPosition - z_back × D
    if (candidate_lookAt - targetPosition) · (-cameraRightWorld) > 0:
        toControlsTarget = candidate_lookAt
        break
```

更高效的做法:直接用叉积一次判定。`p_hat × g_h_norm` 在世界 Y 方向上的分量符号 == `sin(φ_hg)`(从 g_h_norm 旋转到 p_hat,以 +Y 轴为右手螺旋方向)。**期望符号:使 body 落在屏幕右侧**——具体到本工程的相机方向约定,需要在实测中确认是 `+` 还是 `-`。

落地建议:**先写两个分支都试,在 console 打印 NDC X 看符号对错,定下后删掉一支**。

---

## 4. 代码骨架(直接可改的形态)

先在文件顶部「相机数学配置常量」区(与 `ZOOM_FACTOR` / `PANEL_RATIO` / `PANEL_GAP_RATIO` / `MAX_SHIFT_RATIO` 并列)新增一个模块级常量:

```js
/**
 * @type {Number} 可行域安全裕度:从 cos(γ) 留出的缓冲,避免 sin(α)/cos(γ) 贴上 asin 定义域边界(|x| → 1)产生 NaN
 *      - 钳制阈值 = asin(cos(γ) - FEASIBILITY_MARGIN);本值越大,阈值越小、越早触发兜底(典型 16:9 / fovY 60°:cos(γ) ≈ 0.77,本值 0.05 → 阈值 ≈ ±46°)
 *      - 本值过小会使 β_z 在阈值附近趋近 90°、数值抖动(asin 在 |x| → 1 处导数趋于无穷)
 * */
const FEASIBILITY_MARGIN = 0.05
```

然后在 `initFocusAnimation` 内,把现有 §5.5 那段(从 `// 计算轨道控制器偏移向量` 开始到 `toControlsTarget.copy(...)` 结束)整段替换为:

```js
// ===== 方向 B: 反算 lookAtPoint,使 body 严格落在 NDC (X_target, 0) =====

// 从相机指向天体的向量(推导中记作 g;与 targetToCameraDirection 反向, 长度 = desiredDistance)
const cameraToTargetOffset = targetToCameraDirection.clone().multiplyScalar(-desiredDistance)

// 相机相对天体的 elevation
const alpha = Math.asin(-cameraToTargetOffset.y / desiredDistance)
const sinAlpha = Math.sin(alpha)
const cosAlpha = Math.cos(alpha)

// 目标"body 相对 forward 的水平角"
const horizontalShiftRatio = Math.min(PANEL_RATIO + PANEL_GAP_RATIO, MAX_SHIFT_RATIO)
const fovX = 2 * Math.atan(Math.tan(fovRad * 0.5) * camera.aspect)
const gamma = Math.atan(horizontalShiftRatio * Math.tan(fovX * 0.5))
const cosGamma = Math.cos(gamma)

// 可行域兜底
// α 超出可行域(|sin(α)| > cos(γ))时, |sin(α)/cos(γ)| > 1, 而 asin 定义域为 [−1,1], 超出即返回 NaN, 进而污染 camera.position / controls.target
// 兜底策略: 把 α 钳到 ±asin(cos(γ) - FEASIBILITY_MARGIN) 范围内, 等效修改 ttc.y 并等比例缩放 ttc.x/ttc.z 保持单位向量
// 详细落地说明见 §5.1
const sinAlphaLimit = cosGamma - FEASIBILITY_MARGIN
let sinAlphaUsed = sinAlpha
let cosAlphaUsed = cosAlpha

if (Math.abs(sinAlpha) > sinAlphaLimit) {
    sinAlphaUsed = sinAlphaLimit * Math.sign(sinAlpha || 1)
    cosAlphaUsed = Math.sqrt(1 - sinAlphaUsed * sinAlphaUsed)

    const horizontalScale = cosAlphaUsed / Math.max(cosAlpha, 1e-6)
    targetToCameraDirection.x *= horizontalScale
    targetToCameraDirection.z *= horizontalScale
    targetToCameraDirection.y = sinAlphaUsed

    // 重算 ttc 的下游(g 的方向不变, 无需重算 cameraToTargetOffset)
    cameraOffset.copy(targetToCameraDirection).multiplyScalar(desiredDistance)
    toCameraPosition.copy(targetPosition).add(cameraOffset)
}

// z_back 的 elevation(使用 sinAlphaUsed —— 未触发兜底时与 sinAlpha 相等)
const beta = Math.asin(sinAlphaUsed / cosGamma)
const sinBeta = Math.sin(beta)
const cosBeta = Math.cos(beta)

// cameraToTargetOffset 在 XZ 平面的水平投影:长度 + 单位方向
const horizontalLength = Math.hypot(cameraToTargetOffset.x, cameraToTargetOffset.z)
const horizontalDirX = horizontalLength > 1e-6 ? cameraToTargetOffset.x / horizontalLength : 1
const horizontalDirZ = horizontalLength > 1e-6 ? cameraToTargetOffset.z / horizontalLength : 0

// z_back 水平方向相对 horizontalDir 的方位角差(使用 sinAlphaUsed / cosAlphaUsed —— 未触发兜底时与 sinAlpha / cosAlpha 相等)
const cosPhi = -sinAlphaUsed * cosBeta / (cosAlphaUsed * sinBeta)
// sin 符号:先试 +,看效果不对再翻
const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi))

// 旋转 horizontalDir 单位向量得到 z_back 水平方向(p_hat),绕世界 Y 轴
// φ > 0:+X 转向 +Z;φ < 0:+X 转向 -Z
const rotatedHorizontalDirX = horizontalDirX * cosPhi - horizontalDirZ * sinPhi
const rotatedHorizontalDirZ = horizontalDirX * sinPhi + horizontalDirZ * cosPhi

// 合成 z_back(单位向量)
const cameraBackDirX = cosBeta * rotatedHorizontalDirX
const cameraBackDirY = sinBeta
const cameraBackDirZ = cosBeta * rotatedHorizontalDirZ

// lookAtPoint = camera - z_back × D
toControlsTarget.set(
    toCameraPosition.x - cameraBackDirX * desiredDistance,
    toCameraPosition.y - cameraBackDirY * desiredDistance,
    toCameraPosition.z - cameraBackDirZ * desiredDistance,
)
```

`toCameraPosition` 沿用现有 `targetPosition + cameraOffset` 计算(`focus.js:161`),**不动**。其他下游(controls.enabled / markAnimationStart 等)也都不动。

### 4.1 关键 sanity check

替换完代码后,打开浏览器 console,在 `initFocusAnimation` 末尾临时加一行:

```js
console.log('focus debug:', {
    alpha: THREE.MathUtils.radToDeg(alpha).toFixed(1),
    beta: THREE.MathUtils.radToDeg(beta).toFixed(1),
    gamma: THREE.MathUtils.radToDeg(gamma).toFixed(1),
    cosPhi: cosPhi.toFixed(3),
})
```

在不同 elevation 下触发聚焦,看输出:
- α 30° 时:β_z 应该 ≈ 40°(总 > α)
- α 45° 时:β_z 应该 ≈ 66°
- α 接近 50° 时:β_z 接近 90°(数值会很敏感)

如果 β_z < α,公式实现反了,排查。

---

## 5. 兜底:α 超出可行域(典型参数下 |elevation| > ~46°)

`|sin(α)| > cos(γ)` 时,数学上无解——意思是几何上**不存在一个 lookAtPoint 让 body 同时落在 NDC X = 0.8 且 NDC Y = 0**。典型参数(16:9, fovY=60°, shiftRatio=0.8)下数学边界是 `α = ±asin(cos(γ)) ≈ ±50.6°`,但考虑数值边缘和余量,代码用 `FEASIBILITY_MARGIN = 0.05` 后**实际钳制阈值约 ±46°**(`asin(cos(γ) - 0.05) ≈ asin(0.723) ≈ 46.3°`)。

⚠ **对称性**:必须用 `Math.abs(sinAlpha) > sinAlphaLimit` 检测,既覆盖俯视(sinAlpha > 0)也覆盖仰视(sinAlpha < 0)。否则仰视分支漏检,`Math.asin(sinAlpha/cosGamma)` 在 `|x| > 1` 时返回 NaN 并污染 `camera.position` / `controls.target` —— 一旦污染,即使退出聚焦也无法恢复:`initClearAnimation` 里 `fromControlsTarget.copy(controls.target)` 会把 NaN 再复制进来,后续 `lerpVectors(NaN, valid, k)` 仍是 NaN,渲染永久黑屏。

兜底策略二选一:

### 5.1 兜底方案 ①:钳制 α 到可行域内(推荐)

把 `α` 钳到 `±asin(cos(γ) - FEASIBILITY_MARGIN)`(典型参数下约 ±46°),然后**等效修改 ttc 的 y 分量并等比例缩放 ttc.x / ttc.z 保持单位向量**,最后重算 `cameraOffset` / `toCameraPosition`。

落地关键点:

1. **对称检测**:用 `Math.abs(sinAlpha) > sinAlphaLimit`,**不要**用 `sinAlpha > sinAlphaLimit`。仰视 sinAlpha < 0 时单边检测会漏检,后果见 §5 段首的 NaN 污染链
2. **保持 ttc 单位向量**:水平分量乘 `horizontalScale = cosAlphaUsed / cosAlpha`,垂直分量直接设为 `sinAlphaUsed`,严格保持 `(x·s)² + (z·s)² + y² = cos²·s² + sin² = cos² + sin² = 1`
3. **必须重算 cameraOffset / toCameraPosition**:ttc 改了,相机末态位置随之改变。不重算会导致"相机位置仍在用户原视角,但反算用的是钳制后视角",几何不自洽
4. **不需要重算 cameraToTargetOffset**:下游公式只用 `horizontalDirX/horizontalDirZ` 的**方向**(经 hypot 归一化),而 ttc 水平分量是等比例缩放,方向不变;`cameraToTargetOffset.y` 在下游不被使用
5. **下游必须切换到 sinAlphaUsed / cosAlphaUsed**:`beta` 和 `cosPhi` 两处的 `sinAlpha` / `cosAlpha` 必须替换为兜底后的 `sinAlphaUsed` / `cosAlphaUsed`,否则兜底等于白做
6. **cosAlpha 接近 0 的保护**:用户极接近正上/正下方点击时 `cosAlpha → 0`,`horizontalScale` 会爆炸。用 `Math.max(cosAlpha, 1e-6)` 兜底

可执行代码(与 §4 骨架同源):

```js
// FEASIBILITY_MARGIN 为文件顶部的模块级常量(见 §4)
const sinAlphaLimit = cosGamma - FEASIBILITY_MARGIN
let sinAlphaUsed = sinAlpha
let cosAlphaUsed = cosAlpha

if (Math.abs(sinAlpha) > sinAlphaLimit) {
    sinAlphaUsed = sinAlphaLimit * Math.sign(sinAlpha || 1)
    cosAlphaUsed = Math.sqrt(1 - sinAlphaUsed * sinAlphaUsed)

    const horizontalScale = cosAlphaUsed / Math.max(cosAlpha, 1e-6)
    targetToCameraDirection.x *= horizontalScale
    targetToCameraDirection.z *= horizontalScale
    targetToCameraDirection.y = sinAlphaUsed

    cameraOffset.copy(targetToCameraDirection).multiplyScalar(desiredDistance)
    toCameraPosition.copy(targetPosition).add(cameraOffset)
}

// 下游必须切换到 sinAlphaUsed / cosAlphaUsed:
const beta = Math.asin(sinAlphaUsed / cosGamma)
// ...
const cosPhi = -sinAlphaUsed * cosBeta / (cosAlphaUsed * sinBeta)
```

**代价**:用户从 |elevation| > 46° 进入聚焦时,相机末态被压到约 ±46°,有视角跳变(比方向 A 的 15° 温和很多,但仍能感知)。如果觉得 46° 触发过早,把 `FEASIBILITY_MARGIN` 调小到 0.02-0.03 可推到 ~48°-49°;再小则数值边缘会让 `beta` 在 90° 附近抖动(`asin(x)` 在 `|x| → 1` 时导数趋于无穷)。

### 5.2 兜底方案 ②:动态降低 `horizontalShiftRatio`

不钳制 α,而是减小 NDC X 目标,使 γ 变小、`cos(γ)` 变大,从而扩大可行域。例如:

```js
if (sinAlpha > cosGamma) {
    // 动态降低: 让 cos(γ) >= sin(α) + margin
    const cosGammaRequired = Math.min(1, sinAlpha + FEASIBILITY_MARGIN)
    const gammaAdjusted = Math.acos(cosGammaRequired)
    const ratioAdjusted = Math.tan(gammaAdjusted) / Math.tan(fovX * 0.5)
    // 用 ratioAdjusted 替代 horizontalShiftRatio 走后续计算
}
```

代价:极俯视时,body 不再贴右(panel 与 body 视觉位置变近),但相机视角连续,无跳变。

**推荐 ①**,因为 ② 会让用户感觉"panel 看起来位置不一样了"很迷惑;① 的视角跳变虽然突兀,但语义清晰("镜头压到接近平视才能聚焦")。

---

## 6. 实施步骤

1. 在 `src/three/interaction/focus.js` 的 `initFocusAnimation` 内,定位 §5.5 那段(从 `// 计算轨道控制器偏移向量` 到 `toControlsTarget.copy(...)`)
2. 整段替换为 §4 的代码骨架
3. (可选)清理不再用的模块级缓存:`cameraRightWorld` 和 `targetOffset` 两个 Vector3
4. 临时加 §4.1 的 console.log,刷新页面跑一次确认数值合理
5. 切换若干视角(俯视、仰视、低角度、平视)验证 body 都在 NDC ≈ (0.8, 0)
6. 调 `sinPhi` 符号(如果发现 body 在屏幕左侧而非右侧,翻一下加号变减号)
7. 决定兜底方案(§5.1 还是 §5.2),实现
8. 删 console.log,清理代码

---

## 7. 验收清单

- [ ] **关键修复**:把镜头拉到 elevation 20°/30°(常见俯视角度且小于兜底阈值)点击天体 → 末态 body 严格落在视口右侧(约 NDC X = 0.8)、垂直水平中线(NDC Y ≈ 0)
- [ ] **保留 elevation**:对比方向 A → **方向 B 末态相机在 |elevation| < 46° 范围内维持用户原 elevation**,没有"突然下沉到近平视"的视角跳变(只有 |elevation| > ~46° 触发兜底才出现钳制)
- [ ] **左右半屏**:同一 elevation 下,点击不同位置的天体 → 末态 body 都在屏幕右侧
- [ ] **拉远拉近**:同一 elevation 下,镜头拉远 vs 拉近点击同一天体 → 末态 body 位置一致
- [ ] **仰视对称**:把镜头压到天体下方往上看(elevation < 0)→ body 同样在 NDC (0.8, 0)
- [ ] **极俯视兜底**:elevation > 46°(俯视)或 < -46°(仰视)触发聚焦 → 按 §5.1 钳到 ±46° / §5.2 降低 ratio,**不抛错、不出现 NaN、不黑屏、body 仍可见**
- [ ] **兜底后退出聚焦**(关键回归测试):在兜底触发的聚焦下退出 → `camera.position` 和 `controls.target` 能正确回到 home 位置,不黑屏。验证点是 NaN 没有泄漏到任何模块级缓存
- [ ] **方位角中性**:用户在不同 azimuth 角度下俯视点击 → body 都在右侧,不再"左下/右下"漂移
- [ ] `home*` 仍捕获原始视角,退出聚焦回到正确位置
- [ ] 无 console 报错

---

## 8. 风险与未尽事项

### 8.1 数值稳定性

在 `α` 接近数学边界(典型参数下 ±50.6°)时,`β_z` 接近 90°,`sin(β_z) ≈ 1`,`cos(β_z) ≈ 0`,公式 `(2)` 的分母 `cos(α) × sin(β_z)` 趋于稳定,但分子 `sin(α) × cos(β_z)` 趋于零——`cos(φ_hg)` 数值上可能在 0 附近抖动。`FEASIBILITY_MARGIN = 0.05` 把实际钳制阈值推到 ±46° 处,远离数值边缘。**如果实测发现 ~40°-46° 区间(兜底将触发的临界区)残余 body 跳动,把 margin 调大到 0.08-0.1(阈值会推到 ~±42°-44°)**。

### 8.2 起始 vs 末态视角的连续感

理论上方向 B 的优势是"保留用户视角",但 elevation 接近 50° 时,β_z 接近 90°,**末态相机虽然位置没变(还在原 elevation),但 lookAt 方向变得很陡**——视觉上能感受到相机"压低了视线"。实测时关注一下:这种"位置不变 + 视线压低"的过渡,用户感觉是不是比方向 A 的"位置整体下沉"更自然。

### 8.3 退出聚焦的 home 一致性

`home*` 仍在 §2 那段反算之前捕获(`focus.js:130-133`),所以退出聚焦时相机回到的是用户原始视角(俯视进、俯视出)。但因为方向 B 的聚焦末态相机位置接近原始位置,**退出动画的位移很小**——可能感觉"一闪而过"。如果觉得退出动画过短,可以单独把 clearing 的 `durationMs` 调小,让动画时长正比于实际距离。

### 8.4 `cameraRightWorld` / `targetOffset` 的退役

如果本方向最终被选中,把 `focus.js:80-82, 95-96` 两个模块级缓存(`cameraRightWorld` / `targetOffset`)删掉——它们只被原"世界 XZ 偏移"方案使用,方向 B 不需要。**先保留**直到方向 A/B 取舍定下来。

### 8.5 设计文档同步

代码侧落地后,`docs/design/聚焦与相机动画迁移设计.md` §5.5 描述 `initFocusAnimation` 的章节需要重写——核心计算思路从"世界 XZ 偏移"变成"反算 lookAt 方向",数学公式和注释都要换。这一步在本 todo 落地之后单独跟进。

### 8.6 之前那份 todo doc 的处理

`docs/todo/俯视聚焦时天体偏离视口右侧_钳制相机极角.md` §3 的钳制数值是按错误的 `targetShift/D` 比例算的。**若本方向最终被选中,把那份 doc 标注为"未采用,被 `俯视聚焦_方向B_反算lookAt方向.md` 替代"或直接删除**。

---

## 9. 与方向 A 的快速对比备忘

| 评估角度 | 方向 A | 方向 B |
|---|---|---|
| 实现复杂度 | 改 3 个常数 + 1 个 if 条件 | 替换约 50 行 + 兜底逻辑 |
| 末态天体精度 | NDC y 残余 ~0.24 | NDC y ≈ 0(严格) |
| UX 视角连续性 | 俯视进 → 近平视(明显跳变) | 俯视进 → 俯视出(保留原 elevation,除非 > 50°) |
| 极端角度处理 | 任何角度统一钳到 15° | 仅 \|elevation\| > 46° 时兜底钳到 ±46° |
| `cameraRightWorld` / `targetOffset` 命运 | 保留(仍被使用) | 退役 |

落地建议:**先把方向 A 跑一遍**(改动小,5 分钟搞定),感受一下"视角跳变"够不够能接受;再把方向 B 跑一遍,感受一下"保留俯视感"够不够自然。两个跑过之后做决定。

---

## 10. 附录:`sin(β_z) = sin(α) / cos(γ)` 的推导

(此处省略,需要的话单独写一份)。核心思路:

1. 写出 `y_axis_end = ((0,1,0) - (z_back.y) × z_back).normalize()`(已知公式)
2. 约束 `(body - camera) · y_axis_end = 0`
3. 用 `(body - camera) = -ttc × D`、`ttc = (cos(α)×azimuth_unit, sin(α), ...)`、`z_back = (cos(β_z)×p_hat_xz, sin(β_z), ...)` 代入
4. 利用三角恒等式 `sin²+cos²=1`,把方程化简到 `sin(β_z) = sin(α) / cos(γ)`

如果之后做正式设计文档,这个推导值得完整写一份——它是方向 B 整个方案的"为什么这样做就对了"的论证。
