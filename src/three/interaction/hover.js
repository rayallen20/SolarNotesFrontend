import {HoverPhase} from "@/lib/enum.js";
import {calcProjection, distanceToProjectionEdgePx} from "@/three/lib/projection.js";
import {pickHoveredBody} from "@/three/base/raycaster.js";
import {isFarRect, isNearRect} from "@/three/lib/rect.js";
import {resolveAnchor} from "@/three/lib/resolveAnchor.js";

/**
 * @typedef {(nowMs: Number, store: import('@/stores/hover.js').HoverStore,
 * hitObject: import('three').Object3D|null) => void} PhaseHandler 状态机各阶段对应的处理函数
 * */

/**
 * @type {Object<String, PhaseHandler>} 本对象用于将状态机的每个状态映射到对应的处理函数上
 * */
const phaseHandlers = {
    [HoverPhase.idle]: handleIdle,
    [HoverPhase.body]: handleBody,
    [HoverPhase.sticky]: handleSticky,
    [HoverPhase.label]: handleLabel,
}

/**
 * 本函数用于逐帧维护状态机
 * @param {Number} nowMs 当前时间戳(单位: 毫秒)
 * @param {import('@/stores/hover.js').HoverStore} store 定义状态机属性和行为的存储对象
 * @param {import('three').PerspectiveCamera} camera 相机对象
 * @param {HTMLCanvasElement} domElement 渲染场景的DOM元素
 * */
function tickHover(nowMs, store, camera, domElement) {
    // step1. 防御性措施: 鼠标从未移动过(此时场景刚加载完毕 且 鼠标的NDC位置为(0, 0) ),则强制进入idle状态
    if (!store.pointer.hasEverMoved) {
        if (store.phase !== HoverPhase.idle) {
            store.enterIdle()
        }

        return
    }

    // step2. 刷新当前激活天体的屏幕投影
    if (store.activeEntity !== null) {
        const projection = calcProjection(store.activeEntity, camera, domElement)
        store.setActiveProjection(projection)
    }

    // step3. 维护isNearLabel的滞后判定(严进宽出)
    // Tips: 该步骤必须在状态分发前完成,因为各状态的handler会读取isActiveLocked,
    // 而isActiveLocked是根据isLabelHover和isNearLabel计算得出的计算属性,因此必须
    // 在状态分发前维护isNearLabel字段,否则分发到各状态的handler后,各handler读取到的
    // isActiveLocked是上一帧的计算结果

    // Tips: 将需要用到的字段做snapshot(快照)的原因:
    // 以下3个if的条件需要**互不干涉**,但每个if内都会调用setNearLabel(),若if的条件判断
    // 中直接读取isNearLabel,则有可能出现:
    // 第1个if满足条件,调用setNearLabel()后,修改了isNearLabel
    // 修改后导致第2个if的条件判断也满足了,又修改了isNearLabel
    // 而这是不符合逻辑的.因此需要将需要用到的字段做snapshot
    const hasLabel = store.labelRect !== null
    const wasNear = store.isNearLabel

    // Tips: 这里的变量不是snapshot,只是为了缩短if中在调用isNearRect()时参数的长度
    const rect = store.labelRect
    const point = store.pointer.screenPx
    let threshold

    // 严进:
    // condition1: 在当前帧label已显示
    // condition2: 在当前帧之前,鼠标未靠近label
    // operation: 检测鼠标是否**新**靠近label
    if (hasLabel && !wasNear) {
        threshold = store.labelHysteresis.enterDistancePx
        const isNear = isNearRect(rect, point, threshold)
        store.setNearLabel(isNear)
    }

    // 宽出:
    // condition1: 在当前帧label已显示
    // condition2: 在当前帧之前,鼠标已在label附近
    // operation: 检测鼠标是否已经远离label
    if (hasLabel && wasNear) {
        threshold = store.labelHysteresis.exitDistancePx
        const isFar = isFarRect(rect, point, threshold)
        store.setNearLabel(!isFar)
    }

    // 复位:
    // condition1: 在当前帧label未显示
    // condition2: 在当前帧之前,鼠标已在label附近
    // operation: 复位标量isNearLabel,重置为false,因为在当前帧中,label未显示,因此必然不存在鼠标靠近label的可能性
    if (!hasLabel && wasNear) {
        store.setNearLabel(false)
    }

    // step4. 投射检测 根据投射检测的结果维护悬停状态机中用于标识鼠标当前是否悬停在可聚焦天体上的标量
    const pointer = store.pointer
    const hitObject = pickHoveredBody(pointer.ndcCoordinate, camera)
    const isPointerOverBody = resolveAnchor(hitObject) !== null
    store.setPointerOverBody(isPointerOverBody)

    // step5. 按当前状态调用对应处理函数
    const handler = phaseHandlers[store.phase]
    // 防御性编程: 理论上handler是不可能为undefined的,这里做判断,是为了防止
    // 1. store.phase被不可预料的修改
    // 2. 若未来扩展了HoverPhase的枚举,但此处没有同步新增状态处理函数,则会报错
    if (handler !== undefined) {
        handler(nowMs, store, hitObject)
    }
}

/**
 * 本函数用于处理状态机在idle状态下的行为
 * @param {Number} nowMs 当前时间戳(单位: 毫秒)
 * @param {import('@/stores/hover.js').HoverStore} store 存储中定义的状态机属性和行为
 * @param {import('three').Object3D|null} hitObject 投射检测命中的3D物体
 * */
function handleIdle(nowMs, store, hitObject) {
    if (hitObject !== null) {
        store.enterBody(hitObject)
    }
}

/**
 * 本函数用于处理状态机在body状态下的行为
 * @param {Number} nowMs 当前时间戳(单位: 毫秒)
 * @param {import('@/stores/hover.js').HoverStore} store 存储中定义的状态机属性和行为
 * @param {import('three').Object3D|null} hitObject 投射检测命中的3D物体
 * */
function handleBody(nowMs, store, hitObject) {
    // 优先级1. 若激活天体当前处于锁定状态 则说明鼠标:
    // - case1. 靠近label
    // - case2. 在label上
    // 此时直接进入label状态即可
    if (store.isActiveLocked) {
        store.enterLabel()
        return
    }

    // 优先级2. 仍然命中某个天体
    // 此时让enterBody()内部判断命中的天体是否发生改变即可
    if (hitObject !== null) {
        store.enterBody(hitObject)
        return
    }

    // 优先级3: 进入粘滞区
    // 若鼠标和当前激活天体的投影之间的距离小于进入粘滞区的距离时,则进入sticky状态
    const pointer = store.pointer
    const projection = store.activeProjection
    const sticky = store.sticky
    const distance = distanceToProjectionEdgePx(pointer.screenPx, projection.centerPx, projection.radiusPx)
    if (distance > 0 && distance < sticky.enterEdgeDistancePx) {
        store.enterSticky(nowMs)
        return
    }

    // 优先级4: 进入idle状态
    // 若以上3个优先级都不满足,则说明鼠标移动到了空白区域,进入idle状态即可
    store.enterIdle()
}

/**
 * 本函数用于处理状态机在sticky状态下的行为
 * @param {Number} nowMs 当前时间戳(单位: 毫秒)
 * @param {import('@/stores/hover.js').HoverStore} store 存储中定义的状态机属性和行为
 * @param {import('three').Object3D|null} hitObject 投射检测命中的3D物体
 * */
function handleSticky(nowMs, store, hitObject) {
    // 防御性措施: 在sticky状态下,activeEntity不可能为null.而activeEntity想要被置为null,
    // 只有store.enterIdle()函数能够触发.此处的防御措施和store.enterBody()函数中的意义相同,防御的是:
    // 1. 外部绕过store中定义的函数,直接修改状态机的字段
    // 2. 防止未来重构后对本函数的行为造成破坏
    if (store.activeEntity === null) {
        store.enterIdle()
        return
    }

    // 优先级1: 鼠标从粘滞区中移动到了靠近label的位置或移动到了label上,此时应进入label状态
    if (store.isActiveLocked) {
        store.enterLabel()
        return
    }

    // 优先级2: 鼠标从粘滞区移动到了天体上,此时应进入body状态
    // Tips: 这里检测是否靠近label或悬停在label上,是为了防止鼠标既在label上或者在label附近,且又命中了天体
    if (hitObject !== null && !store.isActiveLocked) {
        store.enterBody(hitObject)
        return
    }

    // 优先级3: 超过sticky状态持续的最大时长,且鼠标既未移动到label上/label附近,
    // 又没有命中天体(逻辑判断能走到这里,就必然满足这2个条件了),此时应进入idle状态
    const stickyConfig = store.sticky
    const elapsed = nowMs - stickyConfig.startedAt
    if (elapsed >= stickyConfig.expireMs) {
        store.enterIdle()
        return
    }

    // 优先级4: 超过sticky状态持续的最短时长后,根据鼠标距投影的距离判断是否应退出粘滞区.
    // 若距离足够远,则说明该退出粘滞区了,此时应进入idle状态
    if (elapsed < stickyConfig.minHoldMs) {
        return
    }
    const pointer = store.pointer
    const projection = store.activeProjection
    const distance = distanceToProjectionEdgePx(pointer.screenPx, projection.centerPx, projection.radiusPx)
    if (distance >= stickyConfig.exitEdgeDistancePx) {
        store.enterIdle()
    }
}

/**
 * 本函数用于处理状态机在label状态下的行为
 * @param {Number} nowMs 当前时间戳(单位: 毫秒)
 * @param {import('@/stores/hover.js').HoverStore} store 存储中定义的状态机属性和行为
 * @param {import('three').Object3D|null} hitObject 投射检测命中的3D物体
 * */
function handleLabel(nowMs, store, hitObject) {
    // 优先级1: 鼠标扔停留在label上或仍在label附近,则保持label状态不变即可,不需要做任何处理
    if (store.isActiveLocked) {
        return
    }

    // 优先级2: 鼠标离开label后,命中了天体,则进入body状态
    if (hitObject !== null) {
        store.enterBody(hitObject)
        return
    }

    // 优先级3: 鼠标离开label后,没有命中任何天体,则进入idle状态
    store.enterIdle()
}

export {
    tickHover,
}