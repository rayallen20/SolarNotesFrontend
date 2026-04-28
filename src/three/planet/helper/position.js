/**
 * 本函数用于初始化行星公转组的位置
 * @param {import('@/three/planet/planet.js').Planet} planet 行星运行时对象
 * */
function initOrbitalGroupPosition(planet) {
    const group = planet.root
    const rad = planet.orbitRad
    const semiMajorAxis = planet.config.orbit.semiMajorAxis
    const eccentricity = planet.config.orbit.eccentricity

    const position = calcOrbitalGroupPosition(rad, semiMajorAxis, eccentricity)
    group.position.set(position.x, 0, position.z)
}

/**
 * 本函数用于根据给定的弧度位置/半长轴长度/离心率,计算行星公转组在轨道上的位置坐标
 * @param {Number} rad 行星在轨道上的弧度位置
 * @param {Number} semiMajorAxis 行星轨道的半长轴长度
 * @param {Number} eccentricity 行星轨道的离心率
 * @return {{x: Number, z: Number}} 返回行星在轨道上的位置坐标
 * */
function calcOrbitalGroupPosition(rad, semiMajorAxis, eccentricity) {
    const b = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity)

    const x = semiMajorAxis * (Math.cos(rad) - eccentricity)
    const z = b * Math.sin(rad)

    return {x, z}
}

export {
    initOrbitalGroupPosition,
    calcOrbitalGroupPosition,
}