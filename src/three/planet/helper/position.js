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
    // 根据离心率和半长轴 计算半短轴长度
    const semiMinorAxis = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity)

    // 椭圆参数方程:
    // x = a * cos(t)
    // y = b * sin(t)

    // 但是本场景是要让太阳这个本来是F1的点作为中心点C,因此需要让椭圆整体向右移动 移动长度为c(c表示中心点到焦点的距离)
    // 而 c = a * e
    // 因此 x = a ( cos(t) - e)
    // 而代码中的z其实就是椭圆计算公式中的y 只是THREE.js用XZ表示水平面

    // 这里不计算y,是因为3D场景中垂直方向上的变化是通过轨道倾角来实现的,而不是通过改变y坐标来实现的
    const x = semiMajorAxis * (Math.cos(rad) - eccentricity)
    const z = semiMinorAxis * Math.sin(rad)

    return {x, z}
}

export {
    initOrbitalGroupPosition,
    calcOrbitalGroupPosition,
}