import {config as sunConfig, sunAxis} from "@/three/sun.js";
import {planets} from "@/three/planet/index.js";

/**
 * @typedef {Object} BodyMeta 后端API中返回的单个天体简介对象(含id)
 * @property {Number} id 天体id
 * @property {String} name 天体名称(与前端的config.name值完全相同,用作匹配键)
 * @property {String} title label中的标题部分
 * @property {String} intro label中的介绍部分
 * */

/**
 * 本函数用于将后端返回的天体简介对象按name字段值写入到各天体锚点组的userData上
 *      - title/intro: 作为hover时的label和focus时的panel的显示数据源
 *      - id: 后续作为触发focus时的请求体参数使用
 * Tips: 后端返回的planets中包含太阳的天体简介对象,故此处太阳与行星一并参与匹配
 * Tips: 本函数为纯应用操作,可以被onMounted()和onActivated()生命周期服用
 * @param {Array<BodyMeta>} bodies 后端返回的planets属组
 * */
export function applyBodyMeta(bodies) {
    // 以name为key,建立查找Map
    const metaByName = new Map(bodies.map(meta => [meta.name, meta]))

    // 太阳: 锚点组为sunAxis
    applyMetaToBody(sunConfig.name, sunAxis, metaByName)

    // 行星: 锚点组为planet.root
    for (const planet of planets) {
        applyMetaToBody(planet.config.name, planet.root, metaByName)
    }
}

/**
 * 本函数用于将查找Map中匹配到的id和简介写入到给定天体锚点组的userData上
 * @param {String} name 天体名称(匹配键,来自前端的config.name)
 * @param {import('three').Group} anchorGroup 天体锚点组(id/简介写入其userData上)
 * @param {Map<String, BodyMeta>} metaByName name与天体简介对象的映射Map
 * */
function applyMetaToBody(name, anchorGroup, metaByName) {
    const meta = metaByName.get(name)

    // 后端未返回给定名称的天体简介对象,则告警
    if (meta === undefined) {
        console.warn(`未匹配到给定的天体简介对象,已跳过: ${name}`)
        return
    }

    anchorGroup.userData.id = meta.id
    anchorGroup.userData.title = meta.title
    anchorGroup.userData.intro = meta.intro
}