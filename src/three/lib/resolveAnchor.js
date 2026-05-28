import {findAncestorByName} from "@/three/lib/findAncestorByName.js";

/**
 * 本函数用于将投射检测命中的叶子节点Mesh转换为对应的天体锚点(sunAxis/planet.root)
 * @param {import('three').Object3D|null} hitObject 投射检测命中的叶子节点Mesh
 * @return {import('three').Object3D|null} 若在祖先Mesh中找到对应的天体锚点对象则返回该对象;否则返回null
 * */
function resolveAnchor(hitObject) {
    if (hitObject === null || hitObject === undefined) {
        return null
    }

    const anchorName = hitObject.userData.anchorPointName
    if (typeof anchorName !== 'string' || anchorName === '') {
        return null
    }

    return findAncestorByName(hitObject, anchorName)
}

export {
    resolveAnchor,
}