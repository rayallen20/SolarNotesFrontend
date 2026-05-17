/**
 * @typedef {Object} bodyType 本常量用于定义天体类型的枚举值
 * @property {String} sun 标识天体类型为太阳
 * @property {String} planet 表示天体类型为行星
 * */
const bodyType = Object.freeze({
    sun: 'sun',
    planet: 'planet',
})

/**
 * @typedef {Object} planetZone 本常量用于定义行星运行区域的枚举值
 * @property {String} inner 标识行星的运行区域为小行星带以内, 包括水星/金星/地球/火星
 * @property {String} outer 标识行星的运行区域为小行星带以外, 包括木星/土星/天王星/海王星
 * */
const planetZone = Object.freeze({
    inner: 'inner',
    outer: 'outer',
})

export {
    bodyType,
    planetZone,
}