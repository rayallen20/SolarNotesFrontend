/**
 * 本函数用于为给定3D对象及其子Mesh对象设置投射阴影和接收阴影属性
 * @param {import('three').Object3D} object3D 需要设置阴影属性的3D对象
 * @param {Boolean} castShadow 是否启用投射阴影,默认为true
 * @param {Boolean} receiveShadow 是否启用接收阴影,默认为true
 * */
export function setShadowCastReceive(object3D, castShadow = true, receiveShadow = true) {
    object3D.traverse((obj) => {
        if (!obj.isMesh) {
            return
        }

        obj.castShadow = castShadow
        obj.receiveShadow = receiveShadow
    })
}