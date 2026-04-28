import * as THREE from 'three';
import {calcOrbitalGroupPosition} from "@/three/planet/helper/position.js";

/**
 * @type {Object} 轨道配置对象
 * @property {String} nameSuffix 行星轨道名称后缀
 * @property {Number} segment 创建轨道时需要的点的数量.点与点连成线段,线段数量越多则轨道越平滑,但性能开销也越大
 * @property {Number} color 轨道线条颜色
 * @property {Boolean} transparent 轨道线条是否透明
 * @property {Number} opacity 轨道线条透明度,仅在transparent为true时生效
 * */
const pathConfig = {
    nameSuffix: 'Orbit',
    segment: 256,
    color: 0x888888,
    transparent: true,
    opacity: 0.6,
}

/**
 * 本函数用于为给定行星创建轨道路径
 * @param {import('@/three/planet/planet.js').Planet} planet 行星对象
 * @return {import('three').LineLoop} 轨道路径对象
 * */
export function createOrbitPath(planet) {
    const semiMajorAxis = planet.config.orbit.semiMajorAxis
    const eccentricity = planet.config.orbit.eccentricity
    const name = planet.config.name

    const points = []

    for (let i = 0; i < pathConfig.segment; i++) {
        const rad = (i / pathConfig.segment) * Math.PI * 2
        const position = calcOrbitalGroupPosition(rad, semiMajorAxis, eccentricity)
        const point = new THREE.Vector3(
            position.x,
            0,
            position.z,
        )
        points.push(point)
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
        color: pathConfig.color,
        transparent: pathConfig.transparent,
    })
    if (pathConfig.transparent) {
        material.opacity = pathConfig.opacity
    }

    const orbit = new THREE.LineLoop(geometry, material)
    orbit.name = name + pathConfig.nameSuffix

    return orbit

}