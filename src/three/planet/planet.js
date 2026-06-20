import * as THREE from 'three'
import {loadGLTF} from "@/three/lib/loadGLTF.js";
import {setShadowCastReceive} from "@/three/lib/setShadowCastReceive.js";
import {scaleModel} from "@/three/lib/scaleModel.js";
import {centerModelToOrigin} from "@/three/lib/centerModelToOrigin.js";
import {listMeshes} from "@/three/lib/listMeshes.js";
import {initOrbitalGroupPosition} from "@/three/planet/helper/position.js";
import {createOrbitPath} from "@/three/planet/helper/orbitPath.js";
import {setOrbitalGroupPosition} from "@/three/planet/helper/revolution.js";
import {setSpinAutoRotation} from "@/three/planet/helper/autoRotation.js";

/**
 * @typedef {Object} Planet 本类型表示一颗行星的运行时状态
 * @property {PlanetConfig} config 行星配置项
 * @property {import('three').Group} axis 轨道倾角层 用于倾斜整个轨道面
 * @property {import('three').Group} root 公转层 用于定义行星的公转运动(换言之,本层定义了行星在轨道上的位置)
 * @property {import('three').Group} spin 自转层 用于定义行星绕自身Y轴的自转运动
 * @property {import('three').Object3D|null} model 行星的GLTF模型,在调用`initPlanet()`函数之前为null
 * @property {Number} orbitRad 行星当前公转位置的弧度 (角度 * 2π / 360°)
 * @property {Array<import('three').Mesh>} pickableMeshes 可拾取的网格列表,在调用`initPlanet()`函数之前为[]
 * @property {Number} baseVisibleRadius 行星可见半径,供相机伸缩至屏幕最小尺寸时使用
 * */

/**
 * 本函数用于根据给定的行星配置,创建并返回一个表示行星运行时状态的对象
 * Tips: 本函数不加载行星模型,仅创建支持行星运行所需的组
 * 1. 创建:
 *      - axis: 轨道倾角层
 *      - root: 公转层
 *      - spin: 自转层
 * 2. 在 root 层上挂载交互所需的userData
 * @param {PlanetConfig} config 行星配置项
 * @return {Planet} 行星运行时对象
 * */
function createPlanet(config) {
    // 轨道倾角层
    const axis = new THREE.Group()
    axis.name = config.axisName

    // 公转层
    const root = new THREE.Group()
    root.name = config.groupName

    // 自转层
    const spin = new THREE.Group()
    spin.name = config.spinName

    // 挂载交互所需的userData
    root.userData.bodyType = config.label.bodyType
    root.userData.hoverRadius = config.hover.radius

    return {
        config,
        axis,
        root,
        spin,
        model: null,
        orbitRad: 0,
        pickableMeshes: [],
        baseVisibleRadius: config.scale / 2,
    }
}

/**
 * 本函数用于异步加载行星模型并完成层级挂载
 * 1. 加载GLTF
 * 2. 设置:
 *      2.1 阴影
 *      2.2 缩放
 *      2.3 居中
 * 3. 收集可拾取网格对象,并为这些对象添加锚点信息
 * 4. 按 spin -> root -> axis 的顺序挂载
 *      Tips: 挂载结果的包含关系为: axis 包含 root; root 包含 spin; spin 包含 GLTF
 *      Tips: 最终和外部交互的"接驳点"是axis层
 * 5. 设置轨道倾角
 * 6. 初始化行星在轨道上的位置
 * 7. 创建并添加轨道对象
 * @param {Planet} planet 给定的行星运行时对象
 * */
async function initPlanet(planet) {
    // 1. 加载GLTF
    const gltf = await loadGLTF(planet.config.path)
    planet.model = gltf.scene

    // 2. 设置
    const config = planet.config
    // 2.1 设置阴影
    setShadowCastReceive(planet.model)
    // 2.2 设置缩放
    scaleModel(planet.model, config.scale)
    // 2.3 设置居中
    centerModelToOrigin(planet.model)

    // 3. 收集可拾取网格对象,并为这些对象添加锚点信息
    planet.pickableMeshes = listMeshes(planet.model)
    for (const mesh of planet.pickableMeshes) {
        mesh.userData.anchorPointName = config.groupName
    }

    // 4. 按 spin -> root -> axis 的顺序挂载
    planet.spin.clear()
    planet.spin.add(planet.model)

    planet.root.clear()
    planet.root.add(planet.spin)

    planet.axis.clear()
    planet.axis.add(planet.root)

    // 5. 设置轨道倾角
    const orbitConfig = config.orbit
    planet.axis.rotation.x = THREE.MathUtils.degToRad(orbitConfig.dipAngle)

    // 6. 初始化行星在轨道上的位置
    initOrbitalGroupPosition(planet)

    // 7. 创建并添加轨道对象
    const orbit = createOrbitPath(planet)
    planet.axis.add(orbit)
}

/**
 * 本函数用于获取给定行星的可拾取网格对象列表
 * @param {Planet} planet
 * @return {Array<import('three').Mesh>} 给定行星的可拾取网格对象列表
 * */
function getPlanetPickableMeshes(planet) {
    return planet.pickableMeshes
}

/**
 * 本函数用于逐帧更新给定行星的公转和自转
 * @param {Planet} planet 给定行星的运行时状态对象
 * @param {Boolean} needRevolution 是否需要更新公转
 * */
function updatePlanet(planet, needRevolution) {
    if (needRevolution) {
        setOrbitalGroupPosition(planet)
    }

    setSpinAutoRotation(planet)
}

export {
    createPlanet,
    initPlanet,
    getPlanetPickableMeshes,
    updatePlanet,
}