import * as THREE from 'three'
import {loadGLTF} from "@/three/lib/loadGLTF.js";
import {scaleModel} from "@/three/lib/scaleModel.js";
import {centerModelToOrigin} from "@/three/lib/centerModelToOrigin.js";
import {listMeshes} from "@/three/lib/listMeshes.js";
import {layers} from "@/three/base/layers.js";
import {bodyType} from "@/three/enum.js";

/**
 * 本常量用于定义太阳相关配置
 * @type {Object}
 * @property {String} name 太阳天体名称(用于标识后端API中的数据)
 * @property {String} groupName 太阳组名称
 * @property {String} axisName 太阳自转轴名称
 * @property {String} path 太阳模型的路径
 * @property {Object} emissive 太阳模型自发光相关配置
 * @property {Number} emissive.color 自发光颜色 (偏暖白的配色)
 * @property {Number} emissive.intensity 自发光强度
 * @property {Object} scale 太阳模型缩放相关配置
 * @property {Number} scale.size 太阳模型缩放比例
 * @property {Object} hover 太阳hover区域配置项
 * @property {Object} hover.radius 世界坐标系下hover区域的半径
 * @property {Object} autoRotation 太阳自转相关配置
 * @property {Number} autoRotation.speed 太阳自转速度
 * @property {Number} autoRotation.dipAngle 太阳自转轴倾斜角度 单位: 角度
 * @property {Object} light 太阳光源相关配置
 * @property {Object} light.principal 主光源配置,用于照亮内行星(水星/金星/地球/火星)
 * @property {Number} light.principal.color 主光源颜色 (和表面颜色一样接近暖白即可)
 * @property {Number} light.principal.intensity 主光源强度
 * @property {Number} light.principal.distance 主光源衰减距离 0表示没有衰减
 * @property {Number} light.principal.decay 主光源衰减系数
 * @property {Boolean} light.principal.castShadow 主光源是否投射阴影
 * @property {Object} light.principal.shadow 主光源阴影相关配置
 * @property {Number} light.principal.shadow.bias 阴影贴图偏差.设置该值是为了减少阴影失真和闪烁
 * @property {Object} light.principal.shadow.mapSize 阴影贴图尺寸
 * @property {Number} light.principal.shadow.mapSize.x 阴影贴图宽度
 * @property {Number} light.principal.shadow.mapSize.y 阴影贴图高度
 * @property {Object} light.principal.shadow.camera 阴影相机参数
 * @property {Number} light.principal.shadow.camera.near 阴影相机近裁剪面
 * @property {Number} light.principal.shadow.camera.far 阴影相机远裁剪面
 * @property {Number} light.principal.shadow.normalBias 阴影法线偏差.设置该值可以减少阴影失真和闪烁
 * @property {Number} light.principal.shadow.radius 阴影半径.设置该值可以使阴影边缘更柔和
 * @property {import('three').Vector3} light.principal.position 主光源位置
 * @property {Object} light.fill 远距离补光光源配置,用于照亮外行星(木星/土星/天王星/海王星)
 *      Tips: 设置远距离补光光源的原因:
 *      Tips: 若只设置主光源,则在能够照亮外行星时,内行星会过曝,所以需要给外行星设置补光
 *      Tips: 可以认为远补光用于设置外行星的向阳面亮度
 * @property {Number} light.fill.color 远距离补光光源颜色 (和表面颜色一样接近暖白即可)
 * @property {Number} light.fill.intensity 远距离补光光源强度
 * @property {Number} light.fill.distance 远距离补光光源衰减距离 0表示没有衰减
 * @property {Number} light.fill.decay 远距离补光光源衰减系数
 * @property {Boolean} light.fill.castShadow 远距离补光光源是否投射阴影
 * @property {import('three').Vector3} light.fill.position 远距离补光光源位置
 * @property {Object} light.shadowTone 阴影色调光源配置,用于模拟太空背景光
 *      Tips: 阴影色调光源的作用是为了让外行星的背光面不会纯黑,而是有一点冷色调的光,增加立体感,
 *      Tips: 模拟行星在星际背景中被微弱光散射的视觉效果
 *      Tips: 可以认为阴影色调光源用于让外行星的背光面看起来更有立体感
 * @property {Number} light.shadowTone.skyColor 阴影色调光源的天空颜色 (冷色调的颜色,模拟太空中的微弱环境光)
 * @property {Number} light.shadowTone.groundColor 阴影色调光源的地面颜色 (纯黑色即可,因为几乎不需要)
 * @property {Number} light.shadowTone.intensity 阴影色调光源强度 (建议在 [0.12, 0.35] 范围内)
 * @property {import('three').Vector3} light.shadowTone.position 阴影色调光源位置 (阴影色调光源的位置不会影响照明效果,但建议放在原点以保持一致性)
 * @property {Object} light.blackLift 黑位提升光源配置,用于模拟太空中的全局微弱环境光
 *      Tips: 黑位提升光源的作用是为了给外行星一个极微弱的全局底色,消除完全黑色的像素,
 *      Tips: 让贴图的暗部细节(例如土星环的暗面/木星条纹的阴影部分)不至于成为纯黑色,
 *      Tips: 而是有一些冷色调的颜色,增加视觉效果
 *      Tips: 可以认为黑位提升光源用于让整个场景中不会存在完全黑色的像素
 *      Tips: blackLift一词借用电影调色术语"lift the blacks",表示把画面最低亮度从纯黑抬升一点的意思
 * @property {Number} light.blackLift.color 黑位提升光源颜色 (冷色调的颜色,模拟太空中的微弱环境光)
 * @property {Number} light.blackLift.intensity 黑位提升光源强度 (建议在 [0.01, 0.06] 范围内)
 * @property {import('three').Vector3} light.blackLift.position 黑位提升光源位置
 * @property {import('three').Vector3} position 太阳位置
 * @property {Object} label 太阳标签相关配置
 * @property {bodyType} label.bodyType 标签的天体类型,用于区分不同类型天体的标签样式
 * */
export const config = {
    name: 'Sun',
    groupName: 'sunRoot',
    axisName: 'sunAxis',
    path: '/assets/sun/scene.gltf',
    emissive: {
        color: 0xFFF2D6,
        intensity: 3.5,
    },
    scale: {
        size: 20,
    },
    hover: {
        radius: 10.0,
    },
    autoRotation: {
        speed: 0.01,
        dipAngle: 7.25,
    },
    light: {
        principal: {
            color: 0xFFF0C9,
            intensity: 25000,
            distance: 0,
            decay: 2,
            castShadow: true,
            shadow: {
                bias: -0.00002,
                mapSize: {
                    x: 2048,
                    y: 2048,
                },
                camera: {
                    near: 0.5,
                    far: 1200,
                },
                normalBias: 0.02,
                radius: 2,
            },
            position: new THREE.Vector3(0, 0, 0),
        },
        fill: {
            color: 0xFFF0C9,
            intensity: 6,
            distance: 0,
            decay: 0,
            castShadow: false,
            position: new THREE.Vector3(0, 0, 0),
        },
        shadowTone: {
            skyColor: 0x223344,
            groundColor: 0x000000,
            intensity: 0.35,
            position: new THREE.Vector3(0, 0, 0),
        },
        blackLift: {
            color: 0x0B1520,
            intensity: 0.06,
            position: new THREE.Vector3(0, 0, 0),
        },
    },
    position: new THREE.Vector3(0, 0, 0),
    label: {
        bodyType: bodyType.sun,
    }
}

/**
 * @type {import('three').Group} 本常量用于定义太阳自转轴组.用于控制太阳的自转轴倾斜
 * */
export const sunAxis = new THREE.Group()
sunAxis.name = config.axisName
sunAxis.userData.bodyType = config.label.bodyType
sunAxis.userData.hoverRadius = config.hover.radius

/**
 * @type {import('three').Group} 太阳组.用于包含太阳模型和相关光源
 * */
const sunRoot = new THREE.Group()
sunRoot.name = config.groupName

/**
 * @type {Array<import('three').Mesh>} 可拾取对象数组.用于存储太阳模型中所有可以被鼠标悬停检测的物体
 * */
export let pickableMeshes = []

/**
 * 本函数用于初始化太阳模型 并将其添加到sunRoot组中
 * @return {Promise<void>}
 * @throws {Error} 如果加载太阳模型失败则抛出错误
 * */
export async function initSun() {
    let gltf = null
    try {
        gltf = await loadGLTF(config.path)
    } catch (err) {
        console.error('加载太阳模型失败: ', err)
        throw err
    }

    const model = gltf.scene
    setEmissive(model)
    scaleModel(model, config.scale.size)
    centerModelToOrigin(model)

    pickableMeshes = listMeshes(model)
    for (const pickableMesh of pickableMeshes) {
        // Tips: 这里自定义属性的原因:
        // Tips: 因为在显示label时,需要找一个静止的物体作为锚点,来计算label的位置
        // Tips: 而所有的天体模型都会有自转,所以使用自转轴组作为锚点.这里将自转轴组对象的名称写入到每个可拾取的Mesh对象上,
        // Tips: 是为了在后续的label显示逻辑中,能够通过悬停的Mesh找到对应的自转轴组对象
        pickableMesh.userData.anchorPointName = config.axisName
    }

    sunRoot.clear()
    sunRoot.add(model)
    // 创建太阳的光源组并添加到太阳组中
    const lightGroup = createLightGroup()
    sunRoot.add(lightGroup)
    // 仅开发环境显示辅助线
    // 该辅助线用于确认自转轴方向旋转的是否正确
    if (import.meta.env.DEV) {
        const axisHelper = new THREE.AxesHelper(15)
        sunRoot.add(axisHelper)
    }

    // 旋转自转轴以实现倾斜效果
    // 即: 视觉上看起来的倾斜,其实是先旋转自转轴,然后再绕着这个旋转后的自转轴旋转的
    sunAxis.rotation.z = THREE.MathUtils.degToRad(config.autoRotation.dipAngle)
    sunAxis.clear()
    sunAxis.add(sunRoot)
    sunAxis.position.set(
        config.position.x,
        config.position.y,
        config.position.z
    )
}

/**
 * 本函数用于设置给定的模型的自发光效果
 * @param {import('three').Object3D} model 需要设置自发光效果的模型
 * @return {void}
 * */
function setEmissive(model) {
    const sunEmissive = new THREE.Color(config.emissive.color)
    model.traverse((obj) => {
        // Tips: 这里isMesh报Unresolved variable isMesh的原因:
        // Tips: 是因为three.js的类型定义文件中没有正确声明isMesh属性
        // Tips: 但实际上在运行时每个Mesh对象都会有这个属性
        // Tips: 而且由于traverse()方法会递归遍历自身及其后代 所以在运行时,这里的obj有可能是:
        // Tips: Group/Light/Camera等 这些对象是没有isMesh属性的(只有Mesh对象才有isMesh属性且值为true)
        if (!obj.isMesh) {
            return
        }

        let materials = obj.material
        if (!Array.isArray(materials)) {
            materials = [obj.material]
        }

        for (const material of materials) {
            if (material === null || material === undefined) {
                continue
            }

            // 只对支持emissive属性(自发光属性)的材质进行修改
            if (material.isMeshStandardMaterial ||
                material.isMeshPhysicalMaterial ||
                material.isMeshPhongMaterial ||
                material.isMeshLambertMaterial) {
                material.emissive = sunEmissive
                material.emissiveIntensity = config.emissive.intensity
                material.needsUpdate = true
            }
        }
    })
}

/**
 * 本函数用于创建太阳的光源组
 * @return {import('three').Group} 太阳光源组
 * */
function createLightGroup() {
    const lightGroup = new THREE.Group()

    const principalLight = createPrincipalLight()
    lightGroup.add(principalLight)

    const fillLight = createFillLight()
    lightGroup.add(fillLight)

    const shadowToneLight = createShadowToneLight()
    lightGroup.add(shadowToneLight)

    const blackLiftLight = createBlackLiftLight()
    lightGroup.add(blackLiftLight)

    return lightGroup
}

/**
 * 本函数用于创建主光源
 * @return {import('three').PointLight} 主光源
 * */
function createPrincipalLight() {
    // 光源配置
    const principalLightConfig = config.light.principal
    const principalLight = new THREE.PointLight(
        principalLightConfig.color,
        principalLightConfig.intensity,
        principalLightConfig.distance,
        principalLightConfig.decay,
    )
    principalLight.castShadow = principalLightConfig.castShadow

    // 阴影配置
    const shadowConfig = principalLightConfig.shadow
    principalLight.shadow.bias = shadowConfig.bias
    principalLight.shadow.mapSize.set(
        shadowConfig.mapSize.x,
        shadowConfig.mapSize.y,
    )
    principalLight.shadow.camera.near = shadowConfig.camera.near
    principalLight.shadow.camera.far = shadowConfig.camera.far
    principalLight.shadow.normalBias = shadowConfig.normalBias
    principalLight.shadow.radius = shadowConfig.radius

    // 位置配置
    principalLight.position.set(
        principalLightConfig.position.x,
        principalLightConfig.position.y,
        principalLightConfig.position.z,
    )

    return principalLight
}

/**
 * 本函数用于创建远距离补光光源
 * @return {import('three').PointLight} 远距离补光光源
 * */
function createFillLight() {
    // 光源配置
    const fillLightConfig = config.light.fill
    const fillLight = new THREE.PointLight(
        fillLightConfig.color,
        fillLightConfig.intensity,
        fillLightConfig.distance,
        fillLightConfig.decay,
    )

    // 图层配置
    fillLight.layers.set(layers.outerPlanets)
    fillLight.castShadow = fillLightConfig.castShadow

    // 位置配置
    fillLight.position.set(
        fillLightConfig.position.x,
        fillLightConfig.position.y,
        fillLightConfig.position.z,
    )

    return fillLight
}

/**
 * 本函数用于创建阴影色调光源
 * @return {import('three').HemisphereLight} 阴影色调光源
 * */
function createShadowToneLight() {
    // 光源配置
    const shadowToneLightConfig = config.light.shadowTone
    const shadowToneLight = new THREE.HemisphereLight(
        shadowToneLightConfig.skyColor,
        shadowToneLightConfig.groundColor,
        shadowToneLightConfig.intensity,
    )

    // 图层配置
    shadowToneLight.layers.set(layers.outerPlanets)

    // 位置配置
    shadowToneLight.position.set(
        shadowToneLightConfig.position.x,
        shadowToneLightConfig.position.y,
        shadowToneLightConfig.position.z,
    )

    return shadowToneLight
}

/**
 * 本函数用于创建黑位提升光源
 * @return {import('three').AmbientLight} 黑位提升光源
 * */
function createBlackLiftLight() {
    // 光源配置
    const blackLiftLightConfig = config.light.blackLift
    const blackLiftLight = new THREE.AmbientLight(
        blackLiftLightConfig.color,
        blackLiftLightConfig.intensity,
    )

    // 图层配置
    blackLiftLight.layers.set(layers.outerPlanets)

    // 位置配置
    blackLiftLight.position.set(
        blackLiftLightConfig.position.x,
        blackLiftLightConfig.position.y,
        blackLiftLightConfig.position.z,
    )

    return blackLiftLight
}

/**
 * 本函数用于设置太阳自转
 * */
export function setAutoRotation() {
    if (sunRoot.rotation.y >= Math.PI * 2) {
        sunRoot.rotation.y = 0
    }
    sunRoot.rotation.y += config.autoRotation.speed
}
