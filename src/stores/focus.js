import {defineStore} from "pinia";
import {computed, ref, shallowRef} from "vue";
import {FocusPhase} from "@/lib/enum.js";

/**
 * @typedef {Object} FocusAnimation 聚焦/退出动画的运行时配置与状态
 * @property {Number} durationMs 配置项: 动画总时长(单位: 毫秒). 本配置项的时长将作用在SolarPanel的过渡样式上
 * @property {Number} startedAt 运行时: 当前动画的起始时间戳(以performance.now())为基准,0表示动画尚未开始
 * @property {Boolean} needsInit 运行时: 是否还有"一次性建立(记录起点/计算终点/禁用OrbitControls)"需要tickFocus()执行
 * @property {Boolean} shouldCaptureHome 运行时: 本次进入focusing是否应该记录退出聚焦时要回到的位置(仅当状态机从idle状态进入focusing状态时需要记录)
 * */

/**
 * @typedef {Object} PanelText 显示在panel上的文本,从focusEntity的userData上获取而来
 * @property {String} title panel的标题内容
 * @property {String} intro panel的介绍内容
 * */

export const useFocusStore = defineStore('focus', () => {
    // PART1. 当前状态
    /**
     * @type {import('vue').Ref<String>} 状态机当前状态
     * */
    const phase = ref(FocusPhase.idle)

    // PART2. 当前聚焦天体
    /**
     * @type {import('vue').ShallowRef<import('three').Object3D|null>} 当前聚焦的锚点天体(sunAxis/planet.root)
     *      - idle: null
     *      - focusing/focused: 被聚焦的锚点天体
     *      - clearing: 仍保留当前锚点,直到清空操作结束后,再置为null
     *          这样设计是为了让panel滑出期间,panelText不会提前清空
     * */
    const focusedEntity = shallowRef(null)

    // PART3. 动画运行时
    /**
     * @type {FocusAnimation}
     * */
    const animation = {
        durationMs: 600,
        startedAt: 0,
        needsInit: false,
        shouldCaptureHome: false,
    }

    // getters(派生量)
    /**
     * @type {import('vue').ComputedRef<Boolean>} 本派生量用于标识当前状态是否应显示panel
     * - focusing/focused状态: 显示panel
     * - idle/clearing状态: 隐藏panel
     * */
    const shouldShowPanel = computed(() => {
        return phase.value === FocusPhase.focusing || phase.value === FocusPhase.focused
    })

    /**
     * @type {import('vue').ComputedRef<Boolean>} 本派生量用于标识当前状态是否应冻结天体公转
     * - idle状态: 不冻结公转
     * - focusing/focused/clearing状态: 冻结公转
     * */
    const shouldFreezeRevolution = computed(() => {
        return phase.value !== FocusPhase.idle
    })

    /**
     * @type {import('vue').ComputedRef<Boolean>} 本派生量用于标识当前状态机是否处于聚焦过程中
     * - focusing/focused/clearing状态: 均为聚焦流程
     * */
    const inFocusMode = computed(() => {
        return phase.value !== FocusPhase.idle
    })

    /**
     * @type {import('vue').ComputedRef<PanelText|null>} panel上需要显示的文案内容对象,当focusEntity为null时返回null
     * */
    const panelText = computed(() => {
        const entity = focusedEntity.value
        if (entity === null) {
            return null
        }

        return {
            title: entity.userData.title,
            intro: entity.userData.intro,
        }
    })

    // mutations/actions: 由组件调用
    /**
     * 本函数用于请求聚焦到给定锚点天体.本函数仅记录意图,真正的相机移动与动画推进由 tickFocus() 完成
     * @param {import('three').Object3D} anchor 被聚焦的锚点天体(sunAxis/planet.root)
     * */
    function requestFocus(anchor) {
        if (anchor === null || anchor === undefined) {
            return
        }

        // 若当前已在聚焦流程(状态机状态为focusing/focused/clearing)中,则不做任何操作
        // - focusing/focused: 避免重算位置导致的镜头抖动
        // - clearing: 让退出动画执行完,不取消退出动画
        if (phase.value !== FocusPhase.idle && focusedEntity.value === anchor) {
            return
        }

        // 仅当状态从idle转换为focusing时,才需要记录shouldCaptureHome为true,以便tickFocus()在动画开始时记录退出聚焦时要回到的位置
        animation.shouldCaptureHome = (phase.value === FocusPhase.idle)
        phase.value = FocusPhase.focusing
        focusedEntity.value = anchor
        animation.needsInit = true
    }

    /**
     * 本函数用于请求退出当前聚焦(相机回到聚焦前的位置).本函数仅记录意图,动画由 tickFocus() 完成
     * */
    function requestClear() {
        if (phase.value === FocusPhase.idle) {
            return
        }

        phase.value = FocusPhase.clearing
        animation.needsInit = true
    }

    // mutations/actions: 由tickFocus()调用 用于推进动画
    /**
     * 本函数用于维护状态机的动画开始(tickFocus()函数完成一次性建立工作后调用本函数)行为
     *      - 记录动画开始时间
     *      - 不需要执行一次性建立工作
     * @param {Number} nowMs 动画开始时的时间戳
     * */
    function markAnimationStart(nowMs) {
        animation.startedAt = nowMs
        animation.needsInit = false
    }

    /**
     * 本函数用于维护状态机的聚焦动画结束行为
     *      - 状态机变更状态为focused
     * */
    function settleFocused() {
        phase.value = FocusPhase.focused
    }

    /**
     * 本函数用于维护状态机的退出动画结束行为
     *      - 状态机变更状态为idle
     *      - 清除被聚焦天体
     * */
    function finishClear() {
        phase.value = FocusPhase.idle
        focusedEntity.value = null
    }

    return {
        // state
        phase, focusedEntity, animation,

        // computed
        shouldShowPanel, shouldFreezeRevolution, inFocusMode, panelText,

        // mutations/actions: 组件调用
        requestFocus, requestClear,

        // mutations/actions: tickFocus()调用
        markAnimationStart, settleFocused, finishClear,
    }
})

/**
 * @typedef {ReturnType<typeof useFocusStore>} FocusStore 聚焦状态机的store实例
 * */