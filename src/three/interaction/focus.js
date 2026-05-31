import * as THREE from 'three'
import {pickHoveredBody} from "@/three/base/raycaster.js";
import {getWorldRadius} from "@/three/lib/projection.js";
import {easeInOut} from "@/lib/easing.js";
import {FocusPhase} from "@/lib/enum.js";
import {resolveAnchor} from "@/three/lib/resolveAnchor.js";

// 相机数学配置常量
/**
 * @type {Number} 缩放因子: 本值越小则相机离天体越近,天体在屏幕上越大
 * */
const ZOOM_FACTOR = 1.25

/**
 * @type {Number} panel横向占屏幕比例
 * */
const PANEL_RATIO = 0.75

/**
 * @type {Number} panel与天体之间的边距横向占屏幕的比例
 * */
const PANEL_GAP_RATIO = 0.05

/**
 * @type {Number} 可行域的安全余量: 从cos(γ)中预留出的缓冲,避免 |sin(α) / cos(γ)|超出 arcsin()的定义域
 * 其中:
 *      - α: 被聚焦天体与相机的连线与XZ平面的夹角
 *      - γ: 相机正前方方向与相机位置指向被聚焦天体方向的夹角
 * */
const FEASIBILITY_MARGIN = 0.05

/**
 * @type {Number} 天体横向偏移位置横向占屏幕比例的上限
 * */
const MAX_SHIFT_RATIO = 0.85

// 模块级缓存(避免每帧GC)
/**
 * @type {import('three').Vector3} 被聚焦物体的世界坐标,用于计算相机终点与轨道控制器终点
 * */
const targetPosition = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 当前动画的相机起点位置(进入/退出聚焦共用),线性插值的起始向量
 * */
const fromCameraPosition = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 当前动画的相机终点位置(进入/退出聚焦共用),线性插值的目标向量
 * */
const toCameraPosition = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 当前动画的轨道控制器起点位置
 * */
const fromControlsTarget = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 当前动画的轨道控制器终点位置
 * */
const toControlsTarget = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 从被聚焦天体指向相机方向的单位向量
 * */
const targetToCameraDirection = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 相机相对被聚焦天体的偏移
 *      - 相机终点位置 = 被聚焦天体的世界坐标 + 本偏移量
 *      - 本变量决定了"相机从哪里看"
 * */
const cameraOffset = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 相机在聚焦前的位置(退出聚焦时回到此处)
 * */
const homeCameraPosition = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 轨道控制器在聚焦前的位置(退出聚焦时回到此处)
 * */
const homeControlsTarget = new THREE.Vector3()

/**
 * 本函数用于检测被点击命中的锚点天体
 * @param {import('three').Vector2} ndcCoordinate 点击事件发生位置的NDC坐标
 * @param {import('three').PerspectiveCamera} camera 透视相机实例
 * @return {import('three').Object3D|null} 命中锚点天体则返回锚点天体(sunAxis/planet.root),否则返回null
 * */
function resolveFocusAnchor(ndcCoordinate, camera) {
    const hitObject = pickHoveredBody(ndcCoordinate, camera)
    return resolveAnchor(hitObject)
}

/**
 * 本函数用于一次性建立进入聚焦的动画:
 *      - 记录起点
 *      - 记录退出聚焦时要回到的位置
 *      - 计算终点
 *      - 禁用OrbitControls
 * @param {import('@/stores/focus.js').FocusStore} store 聚焦状态机存储实例
 * @param {import('three').PerspectiveCamera} camera 透视相机实例
 * @param {import('three/examples/jsm/controls/OrbitControls.js').OrbitControls} controls 轨道控制器实例
 * @param {Number} nowMs 进入聚焦动画的时间戳
 * */
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

    // 将被聚焦天体与相机的连线与XZ平面的夹角α限制在可行域内,保证后续的反算注视点操作是可行的
    // 不在可行域范围内则原地修改targetToCameraDirection的方向
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

/**
 * 将被聚焦天体与相机的连线与XZ平面的夹角α限制在可行域内,保证后续的反算注视点操作是可行的.在可行域范围外时,
 * 原地修改targetToCameraDirection
 *      - 可行域: |sin(α)| ≤ cos(γ) - FEASIBILITY_MARGIN
 *      - 在可行域外: 等比缩放targetToCameraDirection的x/z分量并改写其y,保持单位向量
 * @param {Number} cosGamma cos(γ).其中γ为相机正前方方向与相机指向被聚焦天体方向的夹角
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

    return {
        sinAlphaUsed,
        cosAlphaUsed
    }
}

/**
 * 反算注视点(轨道控制器终点toControlsTarget):由sinAlphaUsed/cosAlphaUsed/cosGamma解出聚焦动画结束后相机本地Z轴正方向(即视线反方向),
 * 再根据该值反推注视点
 *      - 读取模块级targetToCameraDirection/toCameraPosition,写入toControlsTarget
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

/**
 * 本函数用于一次性建立退出聚焦动画: 相机和轨道控制器从当前位置回到聚焦开始前位置
 * @param {import('@/stores/focus.js').FocusStore} store 聚焦状态机存储实例
 * @param {import('three').PerspectiveCamera} camera 透视相机实例
 * @param {import('three/examples/jsm/controls/OrbitControls.js').OrbitControls} controls
 * @param {Number} nowMs 退出聚焦动画的时间戳
 * */
function initClearAnimation(store, camera, controls, nowMs) {
    fromCameraPosition.copy(camera.position)
    fromControlsTarget.copy(controls.target)

    toCameraPosition.copy(homeCameraPosition)
    toControlsTarget.copy(homeControlsTarget)

    controls.enabled = false

    store.markAnimationStart(nowMs)
}

/**
 * 本函数用于按当前时间推进相机/轨道控制器的位置(线性插值)
 * @param {import('@/stores/focus.js').FocusStore} store 聚焦状态机存储实例
 * @param {import('three').PerspectiveCamera} camera 透视相机实例
 * @param {import('three/examples/jsm/controls/OrbitControls.js').OrbitControls} controls
 * @param {Number} nowMs 当前时间的时间戳
 * @return {Number} 当前进度 (progress ∈ [0,1])
 * */
function advanceCameraLerp(store, camera, controls, nowMs) {
    const elapsed = nowMs - store.animation.startedAt
    const elapsedRatio = elapsed / store.animation.durationMs
    const progress = Math.min(elapsedRatio, 1)
    const k = easeInOut(progress)

    camera.position.lerpVectors(fromCameraPosition, toCameraPosition, k)
    controls.target.lerpVectors(fromControlsTarget, toControlsTarget, k)
    controls.update()

    return progress
}

/**
 * 本函数用于逐帧推进聚焦状态机
 * @param {Number} nowMs 当前时间的时间戳
 * @param {import('@/stores/focus.js').FocusStore} store 聚焦状态机存储实例
 * @param {import('three').PerspectiveCamera} camera 透视相机实例
 * @param {import('three/examples/jsm/controls/OrbitControls.js').OrbitControls} controls
 * */
function tickFocus(nowMs, store, camera, controls) {
    // 处理聚焦动画
    if (store.phase === FocusPhase.focusing) {
        if (store.animation.needsInit) {
            initFocusAnimation(store, camera, controls, nowMs)
        }

        const progress = advanceCameraLerp(store, camera, controls, nowMs)
        // 动画完成
        if (progress >= 1) {
            // 允许移动轨道控制器
            controls.enabled = true
            // 修改状态机状态
            store.settleFocused()
        }

        return
    }

    // 处理清除聚焦动画
    if (store.phase === FocusPhase.clearing) {
        if (store.animation.needsInit) {
            initClearAnimation(store, camera, controls, nowMs)
        }

        const progress = advanceCameraLerp(store, camera, controls, nowMs)
        // 动画完成
        if (progress >= 1) {
            // 允许移动轨道控制器
            controls.enabled = true
            // 修改状态机状态
            store.finishClear()
        }
    }

    // idle/focused状态: 没有动画,不需要推进
}

export {
    tickFocus,
    resolveFocusAnchor,
}