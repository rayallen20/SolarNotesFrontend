# 行星模块迁移与重构指南

## 背景

原项目 `/Users/yanglei/Desktop/universeBlog/src/planet/createPlanet.js` 中的行星实现,采用的是「闭包工厂函数」模式 —— 一个 `createPlanet(config)` 函数内部创建并维护私有状态(`model` / `orbitAngle` / `pickableMeshes`),然后返回一个对象,该对象包含若干共享闭包的内层函数(`init` / `update` / `getPickableMeshes`)。

```
旧项目:createPlanet(config) → { axis, init, update, getPickableMeshes }
                                       ↑
                                       这三个函数共享 createPlanet 闭包内的私有变量
```

这种组织结构是 AI 在最后阶段重新整理代码时引入的,与项目其他模块(`sun.js` / `skySphere.js` 等使用「模块级状态 + 一组顶层函数」的模式)风格不一致。

本次迁移借机将其重构回多个独立的顶层函数。

---

## 重构目标

- 不再在 `createPlanet` 内部创建并返回多个内层函数
- 将 `init` / `update` / `getPickableMeshes` 改造为模块顶层独立函数
- 单颗行星的运行时状态(原本的闭包私有变量)改为一个**显式的 `Planet` 数据对象**,由各顶层函数接收为参数

```
新设计:createPlanet(config) → Planet { config, axis, root, spin, model, ... }   纯数据对象
        initPlanet(planet)              ← 顶层函数,接收 planet 作为参数
        updatePlanet(planet, needRevolution)
        getPlanetPickableMeshes(planet)
```

权衡:状态从「方法调用即用」变成「显式传参」—— 调用方需要拿着 planet 引用调函数。**好处**是 init / update / getPickableMeshes 都成了顶层独立函数,可单独读、单独测、单独调用,与 `sun.js` / `skySphere.js` 「模块级状态 + 顶层函数」的整体风格一致。

---

## 文件划分

```
src/three/planet/
  config.js      ← 已有:PlanetConfig 列表 + typedef
  planet.js      ← 单颗行星:createPlanet / initPlanet / updatePlanet / getPlanetPickableMeshes
  index.js       ← 多颗协调:planets / initPlanets / updatePlanets / getAllPickableMeshes
  helper/        ← 由原项目迁移过来的 helper 模块
    position.js
    orbitPath.js
    revolution.js
    autoRotation.js
```

---

## 单颗行星模块 `planet.js`

### typedef:`Planet`

`Planet` 是单颗行星的运行时状态对象。它在 `createPlanet()` 中被同步创建(此时层级 Group 已搭好,但模型尚未加载),随后在 `initPlanet()` 中被异步填充模型相关字段。

```js
/**
 * @typedef {Object} Planet 单颗行星的运行时状态
 * @property {PlanetConfig} config 行星配置项
 * @property {import('three').Group} axis 轨道倾角层 — 加到 scene 的入口
 * @property {import('three').Group} root 公转层 — 沿椭圆轨道运动
 * @property {import('three').Group} spin 自转层 — 绕自身Y轴旋转
 * @property {import('three').Object3D|null} model 行星 GLTF 模型 Tips: initPlanet 之前为 null
 * @property {Number} orbitAngle 当前公转角(单位:弧度)
 * @property {Array<import('three').Mesh>} pickableMeshes 可拾取网格列表 Tips: initPlanet 之前为空数组
 * */
```

> Tips:`PlanetConfig` 已在 `config.js` 中 typedef,无需重复定义,直接引用即可。

---

### 函数:`createPlanet(config)`

**职责**:同步创建一颗行星的初始状态,只搭好 axis / root / spin 三层 Group 并挂载交互所需的 `userData`,**不加载模型**。

之所以把"创建层级"和"加载模型"拆开:`createPlanet` 同步、轻量,模块加载时即可完成,生成的 `Planet` 数组可立即被引用;`initPlanet` 异步、重(GLTF 网络加载),允许并行启动。

```js
/**
 * 本函数用于同步创建一颗行星的初始状态(不加载模型,只搭好层级Group):
 * 1. 创建 axis / root / spin 三层 Group
 * 2. 在 root 上挂载交互所需的 userData
 * @param {PlanetConfig} config 行星配置
 * @returns {Planet}
 * */
function createPlanet(config) {
    const axis = new THREE.Group()
    axis.name = config.axisName

    const root = new THREE.Group()
    root.name = config.groupName
    root.userData.bodyType = config.label.bodyType
    root.userData.label = config.label.name
    root.userData.intro = config.label.intro

    const spin = new THREE.Group()
    spin.name = config.spinName

    return {
        config,
        axis,
        root,
        spin,
        model: null,
        orbitAngle: 0,
        pickableMeshes: [],
    }
}
```

---

### 函数:`initPlanet(planet)`

**职责**:异步加载行星 GLTF 模型,并完成层级挂载、轨道倾角、初始位置、轨道辅助线等一切"模型就位后才能做的事"。

```js
/**
 * 本函数用于异步加载行星模型并完成层级挂载:
 * 1. 加载 GLTF
 * 2. 设置阴影/缩放/居中
 * 3. 收集可拾取网格并挂上锚点信息
 * 4. 按 spin -> root -> axis 顺序挂载
 * 5. 设置轨道倾角
 * 6. 初始化行星在轨道上的位置
 * 7. 创建并添加轨道辅助线
 * @param {Planet} planet
 * */
async function initPlanet(planet) {
    const gltf = await loadGLTF(planet.config.path)

    planet.model = gltf.scene
    setShadowCastReceive(planet.model)
    scaleModel(planet.model, planet.config.scale)
    centerModelToOrigin(planet.model)

    planet.pickableMeshes = listMeshes(planet.model)
    for (const mesh of planet.pickableMeshes) {
        mesh.userData.anchorPointName = planet.config.groupName
    }

    planet.spin.clear()
    planet.spin.add(planet.model)
    planet.root.clear()
    planet.root.add(planet.spin)
    planet.axis.clear()
    planet.axis.add(planet.root)

    planet.axis.rotation.x = THREE.MathUtils.degToRad(planet.config.orbit.dipAngle)

    initOrbitalGroupPosition(
        planet.root,
        planet.orbitAngle,
        planet.config.orbit.semiMajorAxis,
        planet.config.orbit.eccentricity,
    )

    const orbitPath = createOrbitPath(
        planet.config.orbit.semiMajorAxis,
        planet.config.orbit.eccentricity,
        {
            name: planet.config.id + 'Orbit',
            segment: 256,
            color: 0x888888,
            transparent: true,
            opacity: 0.6,
        },
    )
    planet.axis.add(orbitPath)
}
```

---

### 函数:`updatePlanet(planet, needRevolution)`

**职责**:被动画循环调用,逐帧更新一颗行星的公转(可关闭)和自转。

```js
/**
 * 本函数用于逐帧更新一颗行星的公转和自转
 * @param {Planet} planet
 * @param {Boolean} needRevolution 是否需要更新公转 Tips: false 时仅自转
 * */
function updatePlanet(planet, needRevolution) {
    if (needRevolution) {
        planet.orbitAngle += planet.config.orbit.speed
        setOrbitalGroupPosition(
            planet.root,
            planet.orbitAngle,
            planet.config.orbit.semiMajorAxis,
            planet.config.orbit.eccentricity,
        )
    }
    setSpinAutoRotation(planet.spin, planet.config.rotationSpeed)
}
```

---

### 函数:`getPlanetPickableMeshes(planet)`

**职责**:返回这颗行星的可拾取网格列表,供鼠标交互模块使用。

```js
/**
 * 本函数用于获取行星的可拾取网格列表
 * @param {Planet} planet
 * @returns {Array<import('three').Mesh>}
 * */
function getPlanetPickableMeshes(planet) {
    return planet.pickableMeshes
}
```

---

### `planet.js` 完整 import 与 export

```js
import * as THREE from 'three'
import {loadGLTF} from "@/three/lib/loadGLTF.js"
import {setShadowCastReceive} from "@/three/lib/setShadow.js"
import {scaleModel} from "@/three/lib/scalModel.js"
import {centerModelToOrigin} from "@/three/lib/centerModelToOrigin.js"
import {listMeshes} from "@/three/lib/listMeshes.js"
import {initOrbitalGroupPosition} from "@/three/planet/helper/position.js"
import {createOrbitPath} from "@/three/planet/helper/orbitPath.js"
import {setOrbitalGroupPosition} from "@/three/planet/helper/revolution.js"
import {setSpinAutoRotation} from "@/three/planet/helper/autoRotation.js"

// ...上面的 typedef 和 4 个函数定义...

export {
    createPlanet,
    initPlanet,
    updatePlanet,
    getPlanetPickableMeshes,
}
```

> Tips:helper 与 lib 的具体路径以新项目实际目录为准,本文件给出的是建议位置。

---

## 协调入口模块 `planet/index.js`

`planet.js` 只关心**单颗行星**。所有"对所有行星统一处理"的逻辑(批量初始化、批量更新、聚合可拾取网格)放在 `index.js` —— 它持有 `planets` 数组,并对外暴露面向 `engine.js` 的 API。

```js
import {config as planetConfigs} from '@/three/planet/config.js'
import {
    createPlanet,
    initPlanet,
    updatePlanet,
    getPlanetPickableMeshes,
} from '@/three/planet/planet.js'

/**
 * @type {Array<Planet>} 所有行星实例列表
 * Tips: 模块加载时即创建了 Group 层级,但模型尚未加载,需调用 initPlanets() 异步加载
 * */
const planets = planetConfigs.map(createPlanet)

/**
 * 本函数用于并行加载所有行星模型并完成挂载
 * @returns {Promise<void>}
 * */
async function initPlanets() {
    await Promise.all(planets.map(initPlanet))
}

/**
 * 本函数用于逐帧更新所有行星的公转和自转
 * @param {Boolean} needRevolution 是否需要更新公转
 * */
function updatePlanets(needRevolution) {
    for (const planet of planets) {
        updatePlanet(planet, needRevolution)
    }
}

/**
 * 本函数用于获取所有行星的可拾取网格(用于鼠标拾取)
 * @returns {Array<import('three').Mesh>}
 * */
function getAllPickableMeshes() {
    return planets.flatMap(getPlanetPickableMeshes)
}

export {
    planets,
    initPlanets,
    updatePlanets,
    getAllPickableMeshes,
}
```

---

## 在 `engine.js` 中接入

按 `sun.js` / `skySphere.js` 已有的接入模式,行星模块的接入应当形态一致:

```js
import {planets, initPlanets, updatePlanets} from "@/three/planet/index.js"
```

### `initEngine` 中(在 `initSun` 之后,`initComposers` 之前)

```js
// 2.4 行星
await initPlanets()
for (const planet of planets) {
    scene.add(planet.axis)
}
```

### `startAnimation` 中(在 `setSunAutoRotation` 之后,`renderBloomFrame` 之前)

```js
// 3. 更新所有行星
updatePlanets(true)
```

### `dispose` 中(可选)

如果未来加上行星的 dispose 逻辑(释放 GLTF 几何/材质),也走 `index.js` 里聚合的 `disposePlanets()` 函数。当前阶段先不实现。

---

## 迁移注意点

### ① `orbitAngle` 从「盒装对象 `{value}`」改成「数值」

原项目里 `orbitAngle = { value: 0 }`,这种「盒装」写法是为了能按引用传给 helper 函数 `setOrbitalGroupPosition(root, orbitAngle, ...)`,让 helper 内部读 `angle.value`。

本次重构建议直接用**数值**:`planet.orbitAngle: Number`。这意味着 `setOrbitalGroupPosition` 的签名也要改成接收数字而非盒装对象。**迁移 helper 的时候顺手改掉**,这样调用代码更直观。

如果某些 helper 不便修改、需要保留盒装语义,那就改成在调用处临时包装:

```js
setOrbitalGroupPosition(planet.root, {value: planet.orbitAngle}, ...)
```

但不建议在 `Planet` 数据对象本身保留盒装。

---

### ② helper 路径与依赖

`loadGLTF` / `listMeshes` / `setShadowCastReceive` / `scaleModel` / `centerModelToOrigin` 这些 lib 函数,以及 `helper/` 下的轨道相关函数,都需要先从原项目迁移过来。**编码顺序建议**:

1. 先迁移 lib 下的通用工具(GLTF 加载、几何处理)
2. 再迁移 `planet/helper/` 下的轨道函数
3. 最后写 `planet.js` 与 `planet/index.js`

---

### ③ typedef 命名一致性

当前 `config.js` 中:

| typedef 名 | 风格 |
|---|---|
| `OrbitConfig` | PascalCase ✅ |
| `labelConfig` | camelCase ❌ |
| `PlanetConfig` | PascalCase ✅ |

建议把 `labelConfig` 改成 `LabelConfig`,同时更新 `PlanetConfig` 中的引用 `@property {LabelConfig} label`。这是个小一致性问题,趁此次重构改干净。

---

### ④ `update` 接收 `needRevolution` 参数

原版 `update(needRevolution)` 接收一个布尔参数。当前没看到调用处怎么用,但这个语义("是否更新公转")要保留 —— 未来可能用于「时间暂停」或「仅自转预览」之类的 UI 状态。

`updatePlanets(needRevolution)` 把这个参数透传到每颗行星即可。

---

## 实现顺序建议

1. ✅ `config.js` 已就位(本文件已完成 typedef + 配置项)
2. ⏳ 迁移 `lib/` 下的通用工具
3. ⏳ 迁移 `planet/helper/` 下的轨道函数(顺便统一 angle 接口为数值)
4. ⏳ 编写 `planet/planet.js`(typedef + 4 个函数)
5. ⏳ 编写 `planet/index.js`(协调入口)
6. ⏳ 在 `engine.js` 中接入(initEngine / startAnimation 各一处)
7. ⏳ 联调:启动 dev 服务器,确认水星出现在轨道上、公转/自转生效、可被鼠标拾取
