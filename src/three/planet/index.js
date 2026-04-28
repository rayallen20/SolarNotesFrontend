import {config as planetConfigs} from "@/three/planet/config.js";
import {createPlanet, getPlanetPickableMeshes, initPlanet, updatePlanet} from "@/three/planet/planet.js";

/**
 * @type {Array<import('@/three/planet/planet.js').Planet>} 行星运行时实例列表
 * */
const planets = planetConfigs.map(createPlanet)

/**
 * 本函数用于并行加载所有行星模型并完成挂载
 * @return {Promise<void>}
 * */
async function initPlanets() {
    await Promise.all(planets.map(initPlanet))
}

/**
 * 本函数用于获取所有行星的可拾取网格对象
 * @return {Array<import('three').Mesh>}
 * */
function getAllPickableMeshes() {
    return planets.flatMap(getPlanetPickableMeshes)
}

/**
 * 本函数用于逐帧更新所有行星的公转和自转
 * @param {Boolean} needRevolution 是否需要公转
 * */
function updatePlanets(needRevolution) {
    for (const planet of planets) {
        updatePlanet(planet, needRevolution)
    }
}

export {
    planets,
    initPlanets,
    getAllPickableMeshes,
    updatePlanets,
}