import {calcOrbitalGroupPosition} from "@/three/planet/helper/position.js";

/**
 * 本函数用于为给定行星设置其公转位置
 * @param {import('@/three/planet/planet.js').Planet} planet 给定的行星运行时对象
 * */
export function setOrbitalGroupPosition(planet) {
    const model = planet.root
    const semiMajorAxis = planet.config.orbit.semiMajorAxis
    const eccentricity = planet.config.orbit.eccentricity

    planet.orbitRad += planet.config.orbit.speed
    planet.orbitRad = planet.orbitRad % (2 * Math.PI)

    const position = calcOrbitalGroupPosition(planet.orbitRad, semiMajorAxis, eccentricity)
    model.position.set(position.x, 0, position.z)
}