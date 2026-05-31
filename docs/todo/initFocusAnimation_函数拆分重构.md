# `initFocusAnimation` 拆分重构方案(兜底钳制前置 + 编排器/helper 分层)

> 现状:`src/three/interaction/focus.js` 的 `initFocusAnimation` ~110 行,跨"记录起点 / 算相机终点 / 反算注视点 / 收尾"多个阶段,且可行域兜底夹在中间、还回写了相机终点,读起来累。(`captureStartAndHome` 已抽出。)
>
> 目标:拆成"编排器 + 几个内聚 helper",并**把可行域兜底提到算 `toCameraPosition` 之前**,顺带消除"先算 `toCameraPosition`、兜底里再重算"的双重计算,以及"为什么不用重算 `cameraToTargetOffset`"那条隐晦注释。
>
> 本方案是**行为等价重构**:对同一输入,末态 `toCameraPosition` / `toControlsTarget` 必须和重构前完全一致(浮点误差内)。下面代码块的注释/JSDoc 直接沿用你当前 `focus.js` 的措辞。

---

## 1. 核心改动:把兜底钳制提到算 `toCameraPosition` 之前

### 1.1 现状的耦合

旧流程是:

```
1. 算 toCameraPosition(用原始方向)
2. 算 α、γ
3. 兜底:若 α 超域 → 改 targetToCameraDirection,并【重算】toCameraPosition
4. 反算 toControlsTarget(其中 horizontalDir 用兜底前的 cameraToTargetOffset)
```

问题:第 3 步既改方向又**回写 `toCameraPosition`**,于是"算相机终点"和"反算注视点"互相缠住;还得专门写一条"`cameraToTargetOffset` 为什么不用重算"的注释。

### 1.2 重排后的流程

```
1. 算方向 targetToCameraDirection(body→camera 单位向量)+ 距离 desiredDistance + cosγ
2. 兜底钳制:若 α 超域 → 原地修改 targetToCameraDirection(只改方向,不碰 toCameraPosition)
3. 用【钳制后】的方向一次算定 toCameraPosition
4. 反算 toControlsTarget(cameraToTargetOffset 在此步内由钳制后的方向现算,天然一致)
```

### 1.3 为什么行为等价

- `toCameraPosition = targetPosition + targetToCameraDirection × desiredDistance`,**只依赖最终方向**。旧版"先算一次、兜底再算一次"的最终结果,就是用钳制后方向算出来的那个值——和重排后"只在钳制后算一次"完全相同。
- `cameraToTargetOffset` 只用于取**水平投影方向**(`horizontalDir`,已归一化)。重排后在反算步骤内用钳制后的方向现算,结果一样且不再需要那条"沿用兜底前方向"的解释注释(**该注释删掉**)。
- `α` 用的是**钳制前**的 elevation(决定是否要钳)。重排后在钳制函数内用 `targetToCameraDirection.y` 取到(单位向量的 y 分量即 sin(α),等于旧式 `-cameraToTargetOffset.y / desiredDistance`)。

> ⚠ 落地后务必按 §5 做 before/after 数值对拍,确认等价。

---

## 2. 目标结构:1 个编排器 + 3 个 helper

粒度:**编排器 + `captureStartAndHome`(已实现)+ `clampElevationToFeasibleDomain` + `solveControlsTarget`**。距离、cosγ 这种几行纯计算内联在编排器里;若想抽见 §2.5。

> 约定沿用本文件既有风格:**共享几何向量走模块级 scratch(helper 直接读写),标量走参数/返回值**。

### 2.1 编排器 `initFocusAnimation`

```js
function initFocusAnimation(store, camera, controls, nowMs) {
    const target = store.focusedEntity
    target.updateWorldMatrix(true, false)
    target.getWorldPosition(targetPosition)

    // 记录本段动画的起点
    // 仅在从idle状态变更到focusing状态时 记录退出聚焦时要回到的位置(即: 换焦操作不修改退出聚焦时要回到的位置)
    captureStartAndHome(store, camera, controls)

    // 计算从被聚焦天体指向相机的方向
    targetToCameraDirection.copy(camera.position).sub(targetPosition).normalize()

    // 计算相机到被聚焦天体的距离
    // 相机到被聚焦天体的距离 = 让被聚焦天体的投影圆半径在垂直方向上占满屏幕的距离 * 缩放因子
    const radius = Math.max(getWorldRadius(target), 1e-6)
    const fovRad = THREE.MathUtils.degToRad(camera.fov)
    const fitDistance = radius / Math.tan(fovRad * 0.5)
    const desiredDistance = fitDistance * ZOOM_FACTOR

    // 计算相机正前方方向与相机位置指向被聚焦天体方向的夹角γ
    const horizontalShiftRatio = Math.min(PANEL_RATIO + PANEL_GAP_RATIO, MAX_SHIFT_RATIO)
    const fovX = 2 * Math.atan(Math.tan(fovRad * 0.5) * camera.aspect)
    const gamma = Math.atan(horizontalShiftRatio * Math.tan(fovX * 0.5))
    const cosGamma = Math.cos(gamma)

    // 将α钳制到可行域内,保证后续反算可行(超域时会原地修改targetToCameraDirection的方向)
    const {sinAlphaUsed, cosAlphaUsed} = clampElevationToFeasibleDomain(cosGamma)

    // 计算相机偏移向量
    // 相机偏移向量 = 沿从被聚焦天体指向相机的方向 * desiredDistance
    cameraOffset.copy(targetToCameraDirection).multiplyScalar(desiredDistance)
    // 相机终点 = 被聚焦天体位置 + 相机偏移向量
    toCameraPosition.copy(targetPosition).add(cameraOffset)

    // 反算注视点(轨道控制器终点)
    solveControlsTarget(desiredDistance, sinAlphaUsed, cosAlphaUsed, cosGamma)

    // 禁用轨道控制器
    controls.enabled = false

    // 记录动画开始时间并将needsInit置为false
    store.markAnimationStart(nowMs)
}
```

> 注:相比旧版,`cameraOffset` / `toCameraPosition` 的计算被移到**钳制之后**(只算一次),兜底里的重算随之删除。

### 2.2 `captureStartAndHome`(已实现,保持现状)

```js
/**
 * 记录本段动画的起点,仅在聚焦状态机从idle状态转换为focusing状态时记录退出聚焦要回到的位置(即home)
 * @param {import('@/stores/focus.js').FocusStore} store 聚焦状态机存储实例
 * @param {import('three').PerspectiveCamera} camera 透视相机实例
 * @param {import('three/examples/jsm/controls/OrbitControls.js').OrbitControls} controls 轨道控制器实例
 * */
function captureStartAndHome(store, camera, controls) {
    fromCameraPosition.copy(camera.position)
    fromControlsTarget.copy(controls.target)

    if (store.animation.shouldCaptureHome) {
        homeCameraPosition.copy(camera.position)
        homeControlsTarget.copy(controls.target)
    }
}
```

### 2.3 `clampElevationToFeasibleDomain`

```js
/**
 * 将相机相对被聚焦天体的elevation(α)钳制到可行域内,保证后续反算注视点可行;超域时原地修改targetToCameraDirection
 *      - 可行域: |sin(α)| ≤ cos(γ) - FEASIBILITY_MARGIN
 *      - 超域时: 等比缩放targetToCameraDirection的x/z分量并改写其y,保持单位向量
 * @param {Number} cosGamma cos(γ),γ为相机正前方方向与相机指向被聚焦天体方向的夹角
 * @return {{sinAlphaUsed: Number, cosAlphaUsed: Number}} 钳制后实际采用的sin(α)与cos(α)
 * */
function clampElevationToFeasibleDomain(cosGamma) {
    // 计算被聚焦天体与相机的连线与XZ平面的夹角α
    // - 相机在y轴正方向位置: α > 0
    // - 相机在XZ平面位置: α = 0
    // - 相机在y轴负方向位置: α < 0
    // targetToCameraDirection为单位向量,其y分量即sin(α)(等于旧式 -cameraToTargetOffset.y / desiredDistance)
    const alpha = Math.asin(targetToCameraDirection.y)
    const sinAlpha = Math.sin(alpha)
    const cosAlpha = Math.cos(alpha)

    // 可行域的保证
    // 可行域: |sin(α)| ≤ cos(γ)
    // α超出可行域时:
    // - |sin(α) / cos(γ)| > 1
    // - 导致arcsin(sin(α) / cos(γ))无法计算(arcsin的定义域为 x ∈ [-1, 1])
    // - 导致toControlsTarget无法计算
    const sinAlphaLimit = cosGamma - FEASIBILITY_MARGIN
    let sinAlphaUsed = sinAlpha
    let cosAlphaUsed = cosAlpha

    // 策略: 限制α ∈ [-arcsin(cos(γ) - FEASIBILITY_MARGIN), arcsin(cos(γ) - FEASIBILITY_MARGIN)],
    // 等价于修改targetToCameraDirection.y并等比例缩放targetToCameraDirection.x/targetToCameraDirection.z,保持单位向量
    if (Math.abs(sinAlpha) > sinAlphaLimit) {
        sinAlphaUsed = sinAlphaLimit * Math.sign(sinAlpha || 1)
        cosAlphaUsed = Math.sqrt(1 - sinAlphaUsed * sinAlphaUsed)

        const horizontalScale = cosAlphaUsed / Math.max(cosAlpha, 1e-6)
        targetToCameraDirection.x *= horizontalScale
        targetToCameraDirection.z *= horizontalScale
        targetToCameraDirection.y = sinAlphaUsed
    }

    return {sinAlphaUsed, cosAlphaUsed}
}
```

### 2.4 `solveControlsTarget`

```js
/**
 * 反算注视点(轨道控制器终点toControlsTarget):由sinAlphaUsed/cosAlphaUsed与cosGamma解出聚焦动画结束后相机本地Z轴正方向(即视线反方向),再据其反推注视点
 *      - 读取模块级 targetToCameraDirection / toCameraPosition,写入 toControlsTarget
 * @param {Number} desiredDistance 相机到被聚焦天体的距离
 * @param {Number} sinAlphaUsed 钳制后的sin(α)
 * @param {Number} cosAlphaUsed 钳制后的cos(α)
 * @param {Number} cosGamma cos(γ)
 * */
function solveControlsTarget(desiredDistance, sinAlphaUsed, cosAlphaUsed, cosGamma) {
    // 计算聚焦动画结束后相机本地Z轴正方向与水平面XZ构成的夹角β
    const beta = Math.asin(sinAlphaUsed / cosGamma)
    const sinBeta = Math.sin(beta)
    const cosBeta = Math.cos(beta)

    // 计算从相机指向被聚焦天体的向量
    // cameraToTargetOffset与targetToCameraDirection反向
    // |cameraToTargetOffset| = desiredDistance
    const cameraToTargetOffset = targetToCameraDirection.clone().multiplyScalar(-desiredDistance)

    // 计算cameraToTargetOffset在XZ平面上的投影长度和方向
    const horizontalLength = Math.hypot(cameraToTargetOffset.x, cameraToTargetOffset.z)
    const horizontalDirX = horizontalLength > 1e-6 ? cameraToTargetOffset.x / horizontalLength : 1
    const horizontalDirZ = horizontalLength > 1e-6 ? cameraToTargetOffset.z / horizontalLength : 0

    // φ: cameraToTargetOffset在XZ平面上的投影 与 聚焦动画结束后相机本地Z轴正方向在XZ平面上的投影 形成的夹角
    const cosPhi = -sinAlphaUsed * cosBeta / (cosAlphaUsed * sinBeta)
    // sin(φ)的符号(暂定,待实测确认:
    // +: 对应天体落在屏幕右侧
    // -: 对应天体落在屏幕左侧
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi))

    // 计算cameraToTargetOffset在XZ平面上的投影归一化为单位向量后,绕Y轴旋转角度φ后,
    // 所得单位向量在X轴/Z轴上的分量
    // - φ > 0,表示向量从X轴正方向转向Z轴正方向
    // - φ < 0,表示向量从X轴正方向转向Z轴负方向
    const rotatedHorizontalDirX = horizontalDirX * cosPhi - horizontalDirZ * sinPhi
    const rotatedHorizontalDirZ = horizontalDirX * sinPhi + horizontalDirZ * cosPhi

    // 计算聚焦动画结束后,相机本地Z轴正方向(即视线的反方向)的单位向量
    const cameraBackDirX = cosBeta * rotatedHorizontalDirX
    const cameraBackDirY = sinBeta
    const cameraBackDirZ = cosBeta * rotatedHorizontalDirZ

    // 聚焦动画结束后,从相机位置出发,沿cameraBackDir向量的反方向,位移desiredDistance,
    // 即为注视点(轨道控制器终点)
    toControlsTarget.set(
        toCameraPosition.x - cameraBackDirX * desiredDistance,
        toCameraPosition.y - cameraBackDirY * desiredDistance,
        toCameraPosition.z - cameraBackDirZ * desiredDistance,
    )
}
```

> 注:`cameraToTargetOffset` 现在在本函数里、用**钳制后**的方向 clone 算出,所以旧版那条 `// 后续的兜底只等比缩放X/Z方向分量…沿用兜底前的…方向即可` 不再需要,已删。

### 2.5(可选)再抽两个纯函数

距离、cosγ 是无副作用的纯计算,若想让编排器更瘦可各自抽出(对应注释一并移走):

```js
/**
 * 计算相机到被聚焦天体的距离(让天体投影圆半径在垂直方向占满屏幕的距离 * 缩放因子)
 * @param {import('three').Object3D} target 被聚焦天体
 * @param {import('three').PerspectiveCamera} camera 透视相机实例
 * @return {Number} desiredDistance
 * */
function computeDesiredDistance(target, camera) {
    const radius = Math.max(getWorldRadius(target), 1e-6)
    const fovRad = THREE.MathUtils.degToRad(camera.fov)
    return (radius / Math.tan(fovRad * 0.5)) * ZOOM_FACTOR
}

/**
 * 计算 cos(γ),γ为相机正前方方向与相机位置指向被聚焦天体方向的夹角
 * @param {import('three').PerspectiveCamera} camera 透视相机实例
 * @return {Number} cosGamma
 * */
function computeCosGamma(camera) {
    const fovRad = THREE.MathUtils.degToRad(camera.fov)
    const horizontalShiftRatio = Math.min(PANEL_RATIO + PANEL_GAP_RATIO, MAX_SHIFT_RATIO)
    const fovX = 2 * Math.atan(Math.tan(fovRad * 0.5) * camera.aspect)
    return Math.cos(Math.atan(horizontalShiftRatio * Math.tan(fovX * 0.5)))
}
```

**别再往下拆了**:`solveControlsTarget` 内部 β/φ/旋转/合成是一条紧密计算链,再切成一行行小函数只会让人来回跳。

---

## 3. 模块级缓存的处理

- **保持模块级**:`fromCameraPosition` / `toCameraPosition` / `fromControlsTarget` / `toControlsTarget` / `homeCameraPosition` / `homeControlsTarget` / `targetPosition` —— `advanceCameraLerp` 每帧读 `to*` / `from*`,是跨帧持有的插值端点,不能降级为局部变量。
- **保持模块级**:`targetToCameraDirection` —— 被 `clampElevationToFeasibleDomain` 原地修改、被 `solveControlsTarget` 读取。
- **保留**:`cameraOffset` —— 编排器仍用它算 `toCameraPosition`,注释也依赖它。可选微清理:改用 `toCameraPosition.copy(targetPosition).addScaledVector(targetToCameraDirection, desiredDistance)` 后即可删掉它及其 JSDoc——但会丢掉"计算相机偏移向量"那两条注释,看你取舍。

> 提醒:`clampElevationToFeasibleDomain` / `solveControlsTarget` **仍读写共享模块状态、不是纯函数**(§2.5 两个除外)。本次拆分目的是"分段、命名、消除耦合",不是"纯函数化/可独立单测"。

---

## 4. 落地步骤

1. `captureStartAndHome` 已抽出;新增 `clampElevationToFeasibleDomain` / `solveControlsTarget`(§2.3-2.4)。
2. 把 `initFocusAnimation` 函数体替换为 §2.1 的编排器(`cameraOffset` / `toCameraPosition` 移到钳制之后、删除兜底内重算)。
3. (可选)抽 `computeDesiredDistance` / `computeCosGamma`(§2.5),或保留内联。
4. 按 §5 做 before/after 数值对拍 + 浏览器实测。
5. 同步文档(§6)。

---

## 5. 验收清单(重点是"行为等价")

- [ ] **数值对拍(最关键)**:重构前在 `initFocusAnimation` 末尾临时打印 `toCameraPosition` 和 `toControlsTarget`;重构后在相同若干视角(elevation ≈ 20° / 30° / 48° / -48°、不同 azimuth)再打印,**两份结果逐分量相等(浮点误差内)**。
- [ ] **未触发兜底**(|elevation| < ~46°):末态相机位置、注视点与重构前一致。
- [ ] **触发兜底**(俯视 >46° / 仰视 <-46°):同样一致,且 `toCameraPosition` 是用钳制后方向算出的(不再有"重算"那步)。
- [ ] 退出聚焦能正确回到 home,不黑屏(`from*` / `home*` 逻辑未动)。
- [ ] 无 `NaN`、无 console 报错。
- [ ] 若选择删 `cameraOffset`:全局搜索确认无引用残留。

---

## 6. 后续:文档同步

- 本 todo 落地后,`docs/todo/俯视聚焦_方向B_反算lookAt方向.md` §4 的代码骨架可改为"按本拆分后的函数组织"(或加一句指向本文件)。
- 设计文档 `docs/design/聚焦与相机动画迁移设计.md` §5.5 对 `initFocusAnimation` 的描述,等方向 B 与本拆分都定稿后一并重写(见方向 B doc §8.5)。