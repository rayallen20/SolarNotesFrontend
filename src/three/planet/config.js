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
 * @property {String} title 天体对应的label标题
 * @property {String} intro 天体对应的label介绍
 * */

/**
 * @typedef {Object} PlanetConfig 行星配置项
 * @property {Number} id 行星id
 * @property {String} name 天体名称(用于程序内部标识)
 * @property {String} axisName 轨道面倾角层Group的名称
 * @property {String} groupName 行星公转层Group的名称
 * @property {String} spinName 行星自转层Group的名称
 * @property {String} path 行星模型的GLTF文件路径
 * @property {Number} scale 模型缩放比例
 * @property {Number} rotationSpeed 行星自转速度 (单位: 弧度/帧) (负值表示逆向自转,如金星)
 * @property {OrbitConfig} orbit 轨道配置项
 * @property {LabelConfig} label 标签配置项
 * @property {planetZone} planetZone 行星运行区域(小行星带内/外)
 * */

/**
 * @type {Array<PlanetConfig>} 行星配置项列表
 * */
export const config = [
    {
        id: 1,
        name: 'Mercury',
        axisName: 'mercuryAxis',
        groupName: 'mercuryRoot',
        spinName: 'mercurySpin',
        path: '/assets/mercury/scene.gltf',
        scale: 1,
        rotationSpeed: 0.04,
        orbit: {
            semiMajorAxis: 15,
            eccentricity: 0.2056,
            dipAngle: 7,
            speed: 0.01,
        },
        label: {
            bodyType: bodyType.planet,
            title: '水星',
            intro: '一段水星的介绍文字',
        },
        planetZone: planetZone.inner,
    },
    {
        id: 2,
        name: 'Venus',
        axisName: 'venusAxis',
        groupName: 'venusRoot',
        spinName: 'venusSpin',
        path: '/assets/venus/scene.gltf',
        scale: 2.5,
        rotationSpeed: -0.0096,
        orbit: {
            semiMajorAxis: 28,
            eccentricity: 0.0068,
            dipAngle: 3.39,
            speed: 0.0039,
        },
        label: {
            bodyType: bodyType.planet,
            title: '金星',
            intro: '一段金星的介绍文字',
        },
        planetZone: planetZone.inner,
    },
    {
        id: 3,
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
            title: '地球',
            intro: '一段地球的介绍文字',
        },
        planetZone: planetZone.inner,
    },
    {
        id: 4,
        name: 'Mars',
        axisName: 'marsAxis',
        groupName: 'marsRoot',
        spinName: 'marsSpin',
        path: '/assets/mars/scene.gltf',
        scale: 1.4,
        rotationSpeed: 0.12,
        orbit: {
            semiMajorAxis: 59.21,
            eccentricity: 0.0934,
            dipAngle: 1.85,
            speed: 0.0013,
        },
        label: {
            bodyType: bodyType.planet,
            title: '火星',
            intro: '一段火星的介绍文字',
        },
        planetZone: planetZone.inner,
    },
    {
        id: 5,
        name: 'Jupiter',
        axisName: 'jupiterAxis',
        groupName: 'jupiterRoot',
        spinName: 'jupiterSpin',
        path: '/assets/jupiter/scene.gltf',
        scale: 29.3,
        rotationSpeed: 0.23,
        orbit: {
            semiMajorAxis: 202.227,
            eccentricity: 0.0489,
            dipAngle: 1.304,
            speed: 0.0002,
        },
        label: {
            bodyType: bodyType.planet,
            title: '木星',
            intro: '一段木星的介绍文字',
        },
        planetZone: planetZone.outer,
    },
    {
        id: 6,
        name: 'Saturn',
        axisName: 'saturnAxis',
        groupName: 'saturnRoot',
        spinName: 'saturnSpin',
        path: '/assets/saturn/scene.gltf',
        scale: 24.7,
        rotationSpeed: 0.07,
        orbit: {
            semiMajorAxis: 370.611,
            eccentricity: 0.0542,
            dipAngle: 2.484,
            speed: 0.00008,
        },
        label: {
            bodyType: bodyType.planet,
            title: '土星',
            intro: '一段土星的介绍文字',
        },
        planetZone: planetZone.outer,
    },
    {
        id: 7,
        name: 'Uranus',
        axisName: 'uranusAxis',
        groupName: 'uranusRoot',
        spinName: 'uranusSpin',
        path: '/assets/uranus/scene.gltf',
        scale: 10.5,
        rotationSpeed: 0.13,
        orbit: {
            semiMajorAxis: 745.773,
            eccentricity: 0.0472,
            dipAngle: 0.771,
            speed: 0.00003,
        },
        label: {
            bodyType: bodyType.planet,
            title: '天王星',
            intro: '一段天王星的介绍文字',
        },
        planetZone: planetZone.outer,
    },
    {
        id: 8,
        name: 'Neptune',
        axisName: 'neptuneAxis',
        groupName: 'neptuneRoot',
        spinName: 'neptuneSpin',
        path: '/assets/neptune/scene.gltf',
        scale: 10.2,
        rotationSpeed: 0.34,
        orbit: {
            semiMajorAxis: 1165.91,
            eccentricity: 0.0087,
            dipAngle: 1.77,
            speed: 0.00001,
        },
        label: {
            bodyType: bodyType.planet,
            title: '海王星',
            intro: '一段海王星的介绍文字',
        },
        planetZone: planetZone.outer,
    },
]