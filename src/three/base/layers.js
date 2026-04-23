/**
 * 本常量用于定义项目中所有图层层号的含义
 * Tips: three.js中,每个Object3D的layers是32位掩码,最多32层,即layers的有效取值在[0, 31]范围内
 * Tips: 光源/物体/摄像机的layers,三者必须有交集才会参与渲染或光照计算
 * Tips: 所谓有交集是指:
 *      fillLight: {2}
 *      外行星: {0, 2}
 *      camera: {0, 2}
 *      三者不相同(fillLight是{2},其他是{0, 2}),但有交集{2},所以外行星会被fillLight照亮
 * @type {Object}
 * @property {Number} default 默认层,three.js 中所有对象默认都在此层
 * @property {Number} bloom 光晕后期处理层,仅太阳及其子对象位于此层
 * @property {Number} outerPlanets 外行星补光层,fillLight/shadowToneLight/blackLiftLight 独占此层,外行星与摄像机启用此层
 * */
export const layers = {
    default: 0,
    bloom: 1,
    outerPlanets: 2
}