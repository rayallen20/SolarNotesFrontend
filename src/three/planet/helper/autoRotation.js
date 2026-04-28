/**
 * 本函数用于为给定行星设置其自转组的自转
 * @param {import('@/three/planet/planet.js').Planet} planet 给定的行星运行时对象
 * */
export function setSpinAutoRotation(planet) {
    const model = planet.spin
    const speed = planet.config.rotationSpeed

    model.rotation.y += speed
    model.rotation.y = model.rotation.y % (2 * Math.PI)
}