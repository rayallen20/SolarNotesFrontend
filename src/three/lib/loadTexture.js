import * as THREE from 'three'

/**
 * 本函数用于返回一个Promise对象 该Promise用于加载指定路径的贴图
 * @param {String} path 贴图的路径
 * @return {Promise<import('three').Texture>} Promise对象 包含加载完成的贴图
 * */
export function loadTexture(path) {
    return new Promise((resolve, reject) => {
        new THREE.TextureLoader()
            .load(
                path,
                (texture) => {
                    resolve(texture)
                },
                undefined,
                (err) => {
                    reject(err)
                }
            )
    })
}