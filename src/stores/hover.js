import {defineStore} from "pinia";
import {computed, ref, shallowRef} from "vue";
import * as THREE from 'three'
import {HoverPhase} from "@/lib/enum.js";
import {findAncestorByName} from "@/three/lib/findAncestorByName.js";

/**
 * @typedef {Object} Pointer 鼠标位置快照信息,由SolarCanvas组件的DOM事件每帧更新
 * @property {import('three').Vector2} ndcCoordinate 鼠标在canvas中的NDC坐标(没有Z轴分量),默认值(0, 0)
 * @property {{x: Number, y: Number}} screenPx 鼠标在视口下的屏幕像素坐标(相对视口左上角)
 * @property {Boolean} inCanvas 标识鼠标是否在canvas元素内的标量
 * @property {Boolean} hasEverMoved 自页面加载以来,鼠标是否在canvas DOM元素上触发过至少一次pointermove事件
 * Tips: 该标量用于修正: 页面刚加载时,默认ndcCoordinate位置为(0,0)(恰好是canvas中心, 即太阳的位置)导致假命中 的情况
 * */

/**
 * @typedef StickyState 鼠标位于粘滞区时(即状态机为sticky状态)的配置项和运行时状态
 * @property {Number} enterEdgeDistancePx 配置项: 鼠标从天体移开,进入粘滞区的距离阈值(单位: 像素)
 * @property {Number} exitEdgeDistancePx 配置项: 从粘滞区退出到idle状态的距离阈值(单位: 像素)
 * @property {Number} expireMs 配置项: sticky状态的最长持续时长,超过该时长后,即使鼠标仍停留在粘滞区,sticky状态也要结束 (单位: 毫秒)
 * @property {Number} minHoldMs 配置项: sticky状态的最短保留时长,在该时长内,即使鼠标离开粘滞区,sticky状态也不会结束 (单位: 毫秒)
 * @property {Number} startedAt 运行时: 状态机进入sticky状态的时间戳(即: 从startedAt记录的时刻开始,状态机由body状态改变为sticky状态),0表示当前未进入sticky状态
 * */

/**
 * @typedef {Object} LabelHysteresis label滞后反应的配置项
 * Tips: 这里使用滞后反应来描述,是因为进入label的距离阈值较小,而离开label的距离阈值较大,这样的阈值设计,反应在行为上即为:
 *      当鼠标靠近label时,尚未进入label就会被判定为悬停在label上;
 *      当鼠标远离label时,并不会在离开label后立刻被判定为不悬停在label上,而是要再远离label一段距离,才会被判定为不悬停在label上;
 *      这种设计让操作看起来有了一种滞后的感觉
 * @property {Number} enterDistancePx 配置项: 鼠标靠近label的距离阈值(单位: 像素)
 *      Tips: 即鼠标到label的距离小于等于该阈值时,即会被判定为鼠标悬停在label上
 * @property {Number} exitDistancePx 配置项: 鼠标远离label的距离阈值(单位: 像素)
 *      Tips: 即鼠标到label的距离大于等于该阈值时,即会被判定为鼠标不悬停在label上
 * */

/**
 * @typedef {Object} LabelText 显示在label上的文本内容对象(标题和介绍),从activeEntity的userData中读取而来
 * @property {String} title label的标题
 * @property {String} intro label的介绍
 * */

export const useHoverStore = defineStore('hover', () => {
    // PART1. 当前状态
    /**
     * @type {import('vue').Ref<String>} 状态机当前状态
     * */
    const phase = ref(HoverPhase.idle)

    // PART2. 当前悬停的天体 + 投影
    /**
     * @type {import('vue').ShallowRef<import('three').Object3D|null>} 当前激活的天体3D对象
     *      - idle状态: null
     *      - body状态: 投射检测命中的叶子节点Mesh的祖先锚点Mesh
     *      - sticky状态: 从body状态转换到sticky状态时,body状态投射检测命中的天体
     *      - label状态: 从body/sticky状态转换到label状态时,本字段值不改变,但会锁定天体.锁定操作是为了防止鼠标在label内移动时,
     *                  同时命中其他天体,造成状态机在label状态和body/sticky状态之间来回切换
     *                  简言之: 从label状态只能转换为idle状态,不能转换为body/sticky状态
     *      Tips: Object3D不需要Vue深度代理 (1. 考虑性能原因 2. 防止Object3D对象内部属性被Vue代理后导致的意外行为)
     * */
    const activeEntity = shallowRef(null)

    /**
     * @type {import('vue').Ref<import('@/three/lib/projection.js').ScreenProjection>} 当前悬停的天体在屏幕上的投影信息,
     * 每帧由tickHover()函数更新,但是需要被SolarLabel组件读取,所以需要设计成响应式数据
     * */
    const activeProjection = ref({
        centerPx: {
            x: 0,
            y: 0,
        },
        radiusPx: 0,
        ndcZ: 0,
    })

    // PART3. 鼠标相关信息
    /**
     * @type {Pointer} 鼠标位置快照信息,仅被tickHover()函数更新
     * Tips: 本字段不会被任何组件读取,故不需要设计成响应式
     * */
    const pointer = {
        ndcCoordinate: new THREE.Vector2(0, 0),
        screenPx: {
            x: 0,
            y: 0,
        },
        inCanvas: false,
        hasEverMoved: false,
    }

    // PART4. label相关信息
    /**
     * @type {import('vue').ShallowRef<DOMRect|null>} label的屏幕矩形
     * 由SolarLabel组件写入 未渲染时为null
     * */
    const labelRect = shallowRef(null)

    /**
     * @type {import('vue').Ref<Boolean>} 本标量用于标识鼠标当前是否悬停在label上
     * */
    const isLabelHover = ref(false)

    /**
     * @type {import('vue').Ref<Boolean>} 本标量用于标识鼠标是否靠近label (滞后判定的结果,由tickHover维护)
     * */
    const isNearLabel = ref(false)

    // PART5. 粘滞区状态
    /**
     * @type {StickyState} 粘滞区的配置项与运行时信息
     * */
    const sticky = {
        enterEdgeDistancePx: 24,
        exitEdgeDistancePx: 36,
        expireMs: 1500,
        minHoldMs: 300,
        startedAt: 0,
    }

    /**
     * @type {LabelHysteresis} 鼠标靠近与远离label的配置项
     * */
    const labelHysteresis = {
        enterDistancePx: 8,
        exitDistancePx: 14,
    }

    // getters(派生量)
    /**
     * @type {import('vue').ComputedRef<Boolean>} 本派生量用于标识当前状态是否应该显示label
     * */
    const shouldShowLabel = computed(() => {
        // 非idle状态均应显示label
        return phase.value !== HoverPhase.idle
    })

    /**
     * @type {import('vue').ComputedRef<Boolean>} 本派生量用于标识当前状态是否应该停止各天体的公转
     * */
    const shouldFreezeRevolution = computed(() => {
        // 非idle状态均应停止各天体公转
        return phase.value !== HoverPhase.idle
    })

    /**
     * @type {import('vue').ComputedRef<Boolean>} 本派生量用于标识状态机当前的activeEntity字段是否允许被修改
     * */
    const isActiveLocked = computed(() => {
        // case1. 鼠标悬停在label上
        // case2. 鼠标离label足够近
        // 以上2种情况均会被判定为label状态,此时应该锁定activeEntity,不允许该字段再被修改,
        // 直到label状态结束
        return isLabelHover.value || isNearLabel.value
    })

    /**
     * @type {import('vue').ComputedRef<LabelText|null>} 显示在label上的文本内容对象
     * */
    const labelText = computed(() => {
        const entity = activeEntity.value
        if (entity === null) {
            return null
        }

        return {
            title: entity.userData.title,
            intro: entity.userData.intro,
        }
    })

    // mutations/actions: 状态转换
    /**
     * 本函数用于将状态机切换到idle状态,并清理所有运行时状态:
     * - 当前激活天体: activeEntity
     * - label矩形: labelRect
     * - 是否靠近label: isNearLabel
     * - 状态机进入sticky状态时的时间戳: sticky.startedAt
     * Tips: 此处不重置isLabelHover字段,该字段由SolarLabel组件的pointerenter/pointerleave事件监听器维护
     * */
    function enterIdle() {
        phase.value = HoverPhase.idle
        activeEntity.value = null
        labelRect.value = null
        isNearLabel.value = false
        sticky.startedAt = 0
    }

    /**
     * 本函数用于将状态机切换到body状态,并记录投射检测命中天体的锚点天体
     * @param {import('three').Object3D} hitObject 投射检测命中的叶子节点Mesh
     * */
    function enterBody(hitObject) {
        // 防御性编程: 若状态机正常的状态流转,isActiveLocked为true意味着当前状态机应该是label状态,
        // 根本不可能进入body状态.此处防御的是2件事:
        // 1. 外部绕过store中定义的函数,直接修改状态机的字段
        // 2. 防止未来重构后对本函数的行为造成破坏
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
        // Tips: 若此处是同引用赋值,则不会触发watch/computed/模板重渲染的
        activeEntity.value = anchor
    }

    /**
     * 本函数用于将状态机切换到sticky状态,并记录sticky状态开始时的时间戳(单位: 毫秒)
     * @param {Number} nowMs 进入sticky状态时的时间戳
     * */
    function enterSticky(nowMs) {
        phase.value = HoverPhase.sticky
        sticky.startedAt = nowMs
    }

    /**
     * 本函数用于将状态机切换到label状态,并清空sticky状态的开始计时
     * */
    function enterLabel() {
        phase.value = HoverPhase.label
        sticky.startedAt = 0
    }

    // mutations/actions: 外部设置store
    /**
     * 本函数用于将鼠标的NDC坐标写入store
     * @param {Number} x NDC坐标的x分量 有效范围`x ∈ [-1, 1]`,超出该范围表示鼠标在canvas外
     * @param {Number} y NDC坐标的y分量 有效范围`y ∈ [-1, 1]`,超出该范围表示鼠标在canvas外
     * */
    function setPointerNDC(x, y) {
        pointer.ndcCoordinate.set(x, y)
    }

    /**
     * 本函数用于将鼠标的屏幕像素坐标写入store
     * @param {Number} x  屏幕像素坐标的x分量(相对视口左上角)
     * @param {Number} y  屏幕像素坐标的y分量(相对视口左上角)
     * */
    function setPointerScreen(x, y) {
        pointer.screenPx.x = x
        pointer.screenPx.y = y
    }

    /**
     * 本函数用于设置标识鼠标当前是否在canvas元素内的标量
     * @param {Boolean} flag true: 鼠标在canvas内; false: 鼠标在canvas外
     * */
    function setPointerInCanvas(flag) {
        pointer.inCanvas = flag
    }

    /**
     * 本函数用于标记canvas元素的pointermove事件已经至少被触发过1次
     * */
    function markPointerMoved() {
        pointer.hasEverMoved = true
    }

    /**
     * 本函数用于将label的屏幕矩形写入store
     * @param {DOMRect|null} rect label的屏幕矩形,若label未被渲染,则该参数值为null
     * */
    function setLabelRect(rect) {
        labelRect.value = rect
    }

    /**
     * 本函数用于设置标识鼠标当前是否悬停在label上的标量
     * @param {Boolean} flag true: 鼠标当前悬停在label上; false: 鼠标当前在label外
     * */
    function setLabelHover(flag) {
        isLabelHover.value = flag
    }

    /**
     * 本函数用于设置标识鼠标是否靠近label的标量
     * @param {Boolean} flag true: 鼠标距离label的距离足够近; false: 鼠标距离label的距离不够近(尚未达到阈值)
     * */
    function setNearLabel(flag) {
        isNearLabel.value = flag
    }

    /**
     * 本函数用于设置当前激活天体的屏幕投影信息
     * @param {import('@/three/lib/projection.js').ScreenProjection} projection 当前激活天体的投影信息
     * */
    function setActiveProjection(projection) {
        // Tips: 使用这种`ref.value = obj`的方式,所有依赖该Ref对象的 computed()/watch()/watchEffect() 都会被通知,
        // Tips: 然后异步重新执行
        activeProjection.value = projection
    }

    return {
        // state
        phase, activeEntity, activeProjection, pointer, labelRect,
        isLabelHover, isNearLabel, sticky, labelHysteresis,

        // computed
        shouldShowLabel, shouldFreezeRevolution, isActiveLocked, labelText,

        // mutations/actions: 状态转换
        enterIdle, enterBody, enterSticky, enterLabel,

        // mutations/actions: 外部设置store
        setPointerNDC, setPointerScreen, setPointerInCanvas, markPointerMoved,
        setLabelRect, setLabelHover, setNearLabel, setActiveProjection,
    }
})

/**
 * @typedef {ReturnType<typeof useHoverStore>} HoverStore 悬停状态机的store实例
 * */