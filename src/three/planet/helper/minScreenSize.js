import * as THREE from 'three'

/**
 * @type {Number} 行星屏幕最小半径阈值,行星在屏幕上的半径小于该值时将被放大
 * */
const MIN_SCREEN_RADIUS_PX = 11

/**
 * @type {Number} 最大放大倍数
 * */
const MAX_BOOST = 4

/**
 * @type {import('three').Vector3} 世界坐标向量(为避免频繁创建对象而复用)
 * */
const worldPosition = new THREE.Vector3()

/**
 * 本函数用于逐帧维护天体在屏幕上的最小尺寸,若小于阈值则放大天体
 * Tips: 缩放的目标为planet.root
 * Tips: 被聚焦的行星将不会被缩放
 * @param {Array<import('@/three/planet/planet.js').Planet>} planets 行星实例列表
 * @param {import('three').PerspectiveCamera} camera 透视相机实例
 * @param {Number} viewportHeightPx 视口高度
 * @param {import('three').Object3D|null} focusedEntity 被聚焦的锚点天体
 * */
export function tickMinScreenSize(planets, camera, viewportHeightPx, focusedEntity) {
    const fovRad = THREE.MathUtils.degToRad(camera.fov)
    const pxPerWorldUnitAtUnitDist = viewportHeightPx / (2 * Math.tan(fovRad / 2))

    for (const planet of planets) {
        // 被聚焦的行星保持真实尺寸
        if (planet.root === focusedEntity) {
            planet.root.scale.setScalar(1)
            continue
        }

        // 计算行星中心的世界坐标到相机的距离
        planet.root.getWorldPosition(worldPosition)
        const distance = worldPosition.distanceTo(camera.position)

        // 计算真实尺寸下的屏幕半径
        const trueScreenRadiusPx = planet.baseVisibleRadius / distance * pxPerWorldUnitAtUnitDist

        // 对过小的天体做缩放
        let boost = 1
        if (trueScreenRadiusPx < MIN_SCREEN_RADIUS_PX) {
            const rate = MIN_SCREEN_RADIUS_PX / trueScreenRadiusPx
            boost = Math.min(rate, MAX_BOOST)
        }

        // 整颗行星等比放大,同时hoverRadius同步放大,否则label的投影计算有误
        planet.root.scale.setScalar(boost)
    }
}