import {nextTick, ref, watch} from "vue";
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
import {prefersReducedMotion} from "@/lib/prefersReducedMotion.js";

/**
 * 本函数用于非叶节点展开/折叠的高度过渡.机制:
 *      - 折叠: 从内容高度过渡到0高度
 *      - 展开: 从0高度过渡到内容高度
 *      - CSS负责静态样式,本函数只负责过渡
 *      - 叶子节点的elementRef为null,watch()会直接返回
 * @param {import('vue').Ref<HTMLUListElement|null>} elementRef 被添加过渡效果的ul元素的ref
 * @param {() => Boolean} isCollapsed 读取当前elementRef折叠状态的getter
 * @param {Number} nodeId 要展开/折叠的节点id
 * @return {{isAnimating: import('vue').Ref<Boolean>}} isAnimating: 用于让组件判定是否绑定.animating类
 * */
export function useCollapseTransition(elementRef, isCollapsed, nodeId) {
    /**
     * @type {import('vue').Ref<Boolean>} 是否正在播放折叠/展开动画
     * */
    const isAnimating = ref(false)

    const catalogueStore = useCatalogueStore()
    let token = 0

    /**
     * 本函数用于播放1次折叠/展开的高度过渡动画
     * @param {Boolean} collapsed 本次切换的目标态:
     *      - true: 折叠
     *      - false: 展开
     * */
    async function playTransition(collapsed) {
        const element = elementRef.value
        if (element === null) {
            return
        }

        // 强展开或减少动态效果偏好时,不播放动画
        if (catalogueStore.consumeForceExpanded(nodeId) || prefersReducedMotion()) {
            element.style.height = collapsed ? '' : 'auto'
            isAnimating.value = false
            return
        }

        const current = ++token
        const startHeight = collapsed ? element.scrollHeight : 0
        const endHeight = collapsed ? 0 : element.scrollHeight

        element.style.height = startHeight + 'px'
        isAnimating.value = true

        // 等待animating类的过渡生效且起点高度设置生效后再设置终点才会过渡,否则会跳变

        // 把.animating类写入DOM树
        await nextTick()
        if (current !== token) {
            return
        }

        // 通过读取元素布局后实际高度的方式,让浏览器把前面设置的height: startHeight生效
        element.offsetHeight
        // 设置终点高度
        element.style.height = endHeight + 'px'

        /**
         * 本函数用于过渡动画结束后,修改元素的CSS样式
         * @param {TransitionEvent} event 过渡结束事件对象
         * */
        function onTransitionEnd(event) {
            if (event.propertyName !== 'height') {
                return
            }

            if (current === token) {
                // 修改CSS: 折叠后清除内联高度;展开后高度auto
                element.style.height = collapsed ? '' : 'auto'
                isAnimating.value = false
            }

            element.removeEventListener('transitionend', onTransitionEnd)
        }

        element.addEventListener('transitionend', onTransitionEnd)
    }

    watch(isCollapsed, playTransition)

    return {
        isAnimating,
    }
}