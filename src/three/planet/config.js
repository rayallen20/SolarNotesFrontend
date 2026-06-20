import {bodyType, planetZone} from "@/three/enum.js";

/**
 * @typedef {Object} OrbitConfig 行星轨道配置项
 * @property {Number} semiMajorAxis 椭圆轨道半长轴长度
 * @property {Number} eccentricity 椭圆轨道离心率.0为正圆,值越接近1则椭圆越扁
 * @property {Number} dipAngle 轨道倾角 Tips: 单位是角度,而非弧度.使用时需要转换为弧度
 * @property {Number} speed 公转速度 (单位: 弧度/帧)
 * */

/**
 * @typedef {Object} LabelConfig 行星标签配置项
 * @property {bodyType} bodyType 天体类型
 * */

/**
 * @typedef {Object} HoverConfig 行星hover区域配置项
 * @property {Number} radius 世界坐标系下的hover区域半径(单位: 与场景的世界单位一致)
 * */

/**
 * @typedef {Object} PlanetConfig 行星配置项
 * @property {String} name 天体名称(用于程序内部标识)
 * @property {String} axisName 轨道面倾角层Group的名称
 * @property {String} groupName 行星公转层Group的名称
 * @property {String} spinName 行星自转层Group的名称
 * @property {String} path 行星模型的GLTF文件路径
 * @property {Number} scale 模型缩放比例
 * @property {Number} rotationSpeed 行星自转速度 (单位: 弧度/帧) (负值表示逆向自转,如金星)
 * @property {OrbitConfig} orbit 轨道配置项
 * @property {LabelConfig} label 标签配置项
 * @property {HoverConfig} hover hover区域配置项
 * @property {planetZone} planetZone 行星运行区域(小行星带内/外)
 * */

/**
 * @type {Array<PlanetConfig>} 行星配置项列表
 * */
export const config = [
    {
        name: 'Mercury',
        axisName: 'mercuryAxis',
        groupName: 'mercuryRoot',
        spinName: 'mercurySpin',
        path: '/assets/mercury/scene.gltf',
        scale: 1,
        rotationSpeed: 0.04,
        orbit: {
            semiMajorAxis: 24.14,
            eccentricity: 0.2056,
            dipAngle: 7,
            speed: 0.01,
        },
        label: {
            bodyType: bodyType.planet,
        },
        hover: {
            radius: 0.5,
        },
        planetZone: planetZone.inner,
    },
    {
        name: 'Venus',
        axisName: 'venusAxis',
        groupName: 'venusRoot',
        spinName: 'venusSpin',
        path: '/assets/venus/scene.gltf',
        scale: 2.5,
        rotationSpeed: -0.0096,
        orbit: {
            semiMajorAxis: 32.99,
            eccentricity: 0.0068,
            dipAngle: 3.39,
            speed: 0.0039,
        },
        label: {
            bodyType: bodyType.planet,
        },
        hover: {
            radius: 1.25,
        },
        planetZone: planetZone.inner,
    },
    {
        name: 'Earth',
        axisName: 'earthAxis',
        groupName: 'earthRoot',
        spinName: 'earthSpin',
        path: '/assets/earth/scene.gltf',
        scale: 2.6,
        rotationSpeed: 0.08,
        orbit: {
            semiMajorAxis: 38.86,
            eccentricity: 0.0167,
            dipAngle: 0,
            speed: 0.0024,
        },
        label: {
            bodyType: bodyType.planet,
        },
        hover: {
            radius: 1.3,
        },
        planetZone: planetZone.inner,
    },
    {
        name: 'Mars',
        axisName: 'marsAxis',
        groupName: 'marsRoot',
        spinName: 'marsSpin',
        path: '/assets/mars/scene.gltf',
        scale: 1.4,
        rotationSpeed: 0.12,
        orbit: {
            semiMajorAxis: 47.97,
            eccentricity: 0.0934,
            dipAngle: 1.85,
            speed: 0.0013,
        },
        label: {
            bodyType: bodyType.planet,
        },
        hover: {
            radius: 0.7,
        },
        planetZone: planetZone.inner,
    },
    {
        name: 'Jupiter',
        axisName: 'jupiterAxis',
        groupName: 'jupiterRoot',
        spinName: 'jupiterSpin',
        path: '/assets/jupiter/scene.gltf',
        scale: 29.3,
        rotationSpeed: 0.23,
        orbit: {
            semiMajorAxis: 88.65,
            eccentricity: 0.0489,
            dipAngle: 1.304,
            speed: 0.0002,
        },
        label: {
            bodyType: bodyType.planet,
        },
        hover: {
            // Tips: 含行星带则radius应为14.65
            radius: 8.14,
        },
        planetZone: planetZone.outer,
    },
    {
        name: 'Saturn',
        axisName: 'saturnAxis',
        groupName: 'saturnRoot',
        spinName: 'saturnSpin',
        path: '/assets/saturn/scene.gltf',
        scale: 24.7,
        rotationSpeed: 0.07,
        orbit: {
            semiMajorAxis: 120.02,
            eccentricity: 0.0542,
            dipAngle: 2.484,
            speed: 0.00008,
        },
        label: {
            bodyType: bodyType.planet,
        },
        hover: {
            radius: 12.35,
        },
        planetZone: planetZone.outer,
    },
    {
        name: 'Uranus',
        axisName: 'uranusAxis',
        groupName: 'uranusRoot',
        spinName: 'uranusSpin',
        path: '/assets/uranus/scene.gltf',
        scale: 10.5,
        rotationSpeed: 0.13,
        orbit: {
            semiMajorAxis: 170.24,
            eccentricity: 0.0472,
            dipAngle: 0.771,
            speed: 0.00003,
        },
        label: {
            bodyType: bodyType.planet,
        },
        hover: {
            radius: 5.25,
        },
        planetZone: planetZone.outer,
    },
    {
        name: 'Neptune',
        axisName: 'neptuneAxis',
        groupName: 'neptuneRoot',
        spinName: 'neptuneSpin',
        path: '/assets/neptune/scene.gltf',
        scale: 10.2,
        rotationSpeed: 0.34,
        orbit: {
            semiMajorAxis: 212.85,
            eccentricity: 0.0087,
            dipAngle: 1.77,
            speed: 0.00001,
        },
        label: {
            bodyType: bodyType.planet,
        },
        hover: {
            radius: 5.1,
        },
        planetZone: planetZone.outer,
    },
]