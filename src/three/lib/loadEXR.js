import * as THREE from 'three'
import { EXRLoader } from 'three/addons/loaders/EXRLoader'

/**
 * 本函数用于返回一个Promise对象 该Promise用于加载EXR格式的环境贴图
 * @param path {String} EXR文件路径
 * @return {Promise<THREE.DataTexture|THREE.CompressedTexture>} Promise对象 包含加载完成的EXR贴图
 * */
export function loadEXR(path) {
    return new Promise((resolve, reject) => {
        new EXRLoader()
            .setDataType(THREE.FloatType)
            .load(
                path,
                // onload回调
                (texture) => {
                    resolve(texture)
                },
                // onProgress回调
                undefined,
                // onError回调
                (err) => {
                    reject(err)
                }
            )
    })
}