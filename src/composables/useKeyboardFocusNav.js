import {useFocusStore} from "@/stores/focus.js";
import {sunAxis} from "@/three/sun.js";
import {planets} from "@/three/planet/index.js";
import {onActivated, onDeactivated} from "vue";

/**
 * @type {Array<import('three').Object3D>} 天体循环聚焦顺序列表
 * */
const orderedAnchors = [
    sunAxis,
    ...planets.map(planet => planet.root)
]

/**
 * 本函数用于按给定偏移量循环聚焦
 * @param {Number} offset 给定的偏移量
 * */
export function focusByOffset(offset) {
    const focusStore = useFocusStore()

    const count = orderedAnchors.length

    const currentIndex = orderedAnchors.indexOf(focusStore.focusedEntity)

    let nexIndex
    if (currentIndex === -1) {
        // 未聚焦时,正向从太阳(orderedAnchors[0])开始聚焦;反向从末位(orderedAnchors[count - 1])开始聚焦
        if (offset > 0) {
            nexIndex = 0
        } else {
            nexIndex = count - 1
        }
    } else {
        nexIndex = (currentIndex + offset + count) % count
    }

    focusStore.requestFocus(orderedAnchors[nexIndex])
}

/**
 * 本函数用于键盘按下事件回调
 * @param {KeyboardEvent} event
 * */
function onKeydown(event) {
    if (event.key === 'ArrowRight') {
        focusByOffset(1)
        event.preventDefault()
        return
    }

    if (event.key === 'ArrowLeft') {
        focusByOffset(-1)
        event.preventDefault()
        return
    }

    if (event.key === 'Escape') {
        useFocusStore().requestClear()
    }
}

/**
 * 本函数用于键盘触发循环聚焦与退出聚焦
 * - ←/→: 在太阳与八大行星之间循环聚焦
 * - ESC: 退出聚焦
 * */
export function useKeyboardFocusNav() {
    onActivated(() => window.addEventListener('keydown', onKeydown))
    onDeactivated(() => window.removeEventListener('keydown', onKeydown))
}