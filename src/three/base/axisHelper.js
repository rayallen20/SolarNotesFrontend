import * as THREE from 'three'

/**
 * 本常量用于定义坐标轴辅助线的相关配置
 * @type {Object}
 * @property {Number} size 坐标轴辅助线的长度
 * @property {String} name 坐标轴辅助线对象的名称
 * */
const config = {
    size: 50,
    name: 'axesHelper',
}

/**
 * 本常量用于定义坐标轴辅助线实例
 * @type {import('three').AxesHelper}
 * */
export const axesHelper = new THREE.AxesHelper(config.size)
axesHelper.name = config.name
