/**
 * 本函数用于在3D对象的祖先链中查找具有指定名称的祖先对象
 * @param {import('three').Object3D} object 给定的3D对象
 * @param {String} name 目标祖先对象的名称
 * @return {import('three').Object3D|null} 找到祖先对象则返回该对象 否则返回null
 * */
function findAncestorByName(object, name) {
    let current = object

    while (current !== null) {
        if (current.name === name) {
            return current
        }

        current = current.parent
    }

    return null
}

export {
    findAncestorByName,
}