import * as THREE from 'three'

/**
 * 本函数用于缩放模型
 * @param {import('three').Object3D} model 需要缩放的模型
 * @param {number} scaleSize 目标尺寸 超过1为放大 小于1为缩小
 * @return {void}
 * */
export function scaleModel(model, scaleSize) {
    // 获取模型的包围盒并计算包围盒尺寸
    const box = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3()
    box.getSize(size)

    // 仅开发环境打印原盒模型尺寸
    if (import.meta.env.DEV) {
        console.log(model.name, ' Origin Box Size: ', size)
    }

    // 按最大边缩放模型
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = scaleSize / maxDim
    model.scale.setScalar(scale)

    // 仅开发环境获取缩放后的包围盒并计算包围盒尺寸
    if (import.meta.env.DEV) {
        const scaledBox = new THREE.Box3().setFromObject(model)
        const scaledSize = new THREE.Vector3()
        scaledBox.getSize(scaledSize)
        console.log(model.name, ' Resize Box Size: ', scaledSize)
    }
}