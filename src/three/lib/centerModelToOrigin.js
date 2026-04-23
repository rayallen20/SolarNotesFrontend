import * as THREE from "three";

/**
 * 本函数用于将模型的中心点移动到坐标原点
 * @param {import('three').Object3D} model 需要居中处理的模型对象
 */
export function centerModelToOrigin(model) {
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    const center = new THREE.Vector3()
    box.getCenter(center)

    // 把模型往反方向挪回原点
    model.position.sub(center)
}
