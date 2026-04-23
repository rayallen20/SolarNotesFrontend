import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader'

/**
 * 本函数用于异步加载GLTF模型
 * @param {String} path GLTF模型文件的URL路径
 * @return {Promise<import('three/examples/jsm/loaders/GLTFLoader').GLTF>} Promise对象 resolve时返回加载完成的GLTF对象
 * */
export function loadGLTF(path) {
    return new Promise((resolve, reject) => {
        new GLTFLoader()
            .load(
                path,
                (gltf) => {
                    resolve(gltf)
                },
                undefined,
                (err) => {
                    reject(err)
                }
            )
    })
}
