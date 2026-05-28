import * as THREE from 'three'
import {pickHoveredBody} from "@/three/base/raycaster.js";
import {findAncestorByName} from "@/three/lib/findAncestorByName.js";
import {getWorldRadius} from "@/three/lib/projection.js";
import {easeInOut} from "@/lib/easing.js";
import {FocusPhase} from "@/lib/enum.js";

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
const MARGIN = 0.05

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
 * @type {import('three').Vector3} 世界坐标系下,相机的右方向单位向量
 * */
const cameraRightWorld = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 相机相对被聚焦天体的偏移
 *      - 相机终点位置 = 被聚焦天体的世界坐标 + 本偏移量
 *      - 本变量决定了"相机从哪里看"
 * */
const cameraOffset = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 轨道控制器相对被聚焦天体的偏移
 *      - 轨道控制器终点位置 = 被聚焦天体的世界坐标 + 本偏移量
 *      - 本变量决定了"相机看向哪里"
 * */
const targetOffset = new THREE.Vector3()

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

/**
 * 本函数用于一次性建立进入聚焦的动画:
 *      - 记录起点
 *      - 记录退出聚焦时要回到的位置
 *      - 计算终点
 *      - 禁用OrbitControls
 * @param {import('@/stores/focus.js').FocusStore} store 聚焦状态机存储实例
 * @param {import('three').PerspectiveCamera} camera 透视相机实例
 * @param {import('three/examples/jsm/controls/OrbitControls.js').OrbitControls} controls
 * @param {Number} nowMs 进入聚焦动画的时间戳
 * */
function initFocusAnimation(store, camera, controls, nowMs) {
    const target = store.focusedEntity
    target.updateWorldMatrix(true, false)
    target.getWorldPosition(targetPosition)

    // 记录本段动画的起点
    fromCameraPosition.copy(camera.position)
    fromControlsTarget.copy(controls.target)

    // 仅在从idle状态变更到focusing状态时 记录退出聚焦时要回到的位置(即: 换焦操作不修改退出聚焦时要回到的位置)
    if (store.animation.shouldCaptureHome) {
        homeCameraPosition.copy(camera.position)
        homeControlsTarget.copy(controls.target)
    }

    // 计算从被聚焦天体指向相机的方向
    targetToCameraDirection.copy(camera.position).sub(targetPosition).normalize()

    // 计算相机到被聚焦天体的距离
    // 相机到被聚焦天体的距离 = 让被聚焦天体的投影圆半径在垂直方向上占满屏幕的距离 * 缩放因子
    const radius = Math.max(getWorldRadius(target), 1e-6)
    const fovRad = THREE.MathUtils.degToRad(camera.fov)
    const fitDistance = radius / Math.tan(fovRad * 0.5)
    const desireDistance = fitDistance * ZOOM_FACTOR

    // 计算相机偏移向量
    // 相机偏移向量 = 天体世界坐标 + 沿从被聚焦天体指向相机的方向 * desireDistance
    cameraOffset.copy(targetToCameraDirection).multiplyScalar(desireDistance)

    // 计算轨道控制器偏移向量
    const horizontalShiftRatio = Math.min(PANEL_RATIO + MARGIN, MAX_SHIFT_RATIO)
    const fovX = 2 * Math.atan(Math.tan(fovRad * 0.5) * camera.aspect)
    const targetShift = desireDistance * Math.tan(fovX * 0.5) * horizontalShiftRatio
    camera.updateMatrixWorld()
    // matrixWorld第0列: 相机本地X轴在世界坐标系下的方向(即屏幕水平右方向)
    cameraRightWorld.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
    // 轨道控制器偏移向量 = 沿相机右方向的反方向(左方向)移动targetShift的距离.此时天体位于屏幕右侧
    targetOffset.copy(cameraRightWorld).multiplyScalar(-targetShift)

    // 计算相机和轨道控制器的终点
    // 相机终点 = 被聚焦天体位置 + 相机偏移向量
    toCameraPosition.copy(targetPosition).add(cameraOffset)
    // 轨道控制器终点 = 被聚焦天体位置 + 轨道控制器偏移向量
    toControlsTarget.copy(targetPosition).add(targetOffset)

    // 禁用轨道控制器
    controls.enabled = false

    // 记录动画开始时间并将needsInit置为false
    store.markAnimationStart(nowMs)
}

/**
 * 本函数用于一次性建立退出聚焦动画: 相机和轨道控制器从当前位置回到聚焦开始前位置
 * @param {import('@/stores/focus.js').FocusStore} store 聚焦状态机存储实例
 * @param {import('three').PerspectiveCamera} camera 透视相机实例
 * @param {import('three/examples/jsm/controls/OrbitControls.js').OrbitControls} controls
 * @param {Number} nowMs 进入聚焦动画的时间戳
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