# 行星模块实现 Review 问题清单

> Review 日期:2026-04-28
> 范围:8 颗行星的公转和自转首次实现完成后(原工程中"为外行星补光"的部分尚未实现)
> 参考设计文档:`docs/design/行星模块重构指南.md`

## 1. Review 范围

涉及文件:
- `src/three/planet/planet.js` —— 单颗行星模块
- `src/three/planet/index.js` —— 多颗行星协调入口
- `src/three/planet/config.js` —— 8 颗行星的配置项
- `src/three/planet/helper/position.js` —— 位置计算
- `src/three/planet/helper/orbitPath.js` —— 轨道辅助线
- `src/three/planet/helper/revolution.js` —— 公转更新
- `src/three/planet/helper/autoRotation.js` —— 自转更新
- `src/three/engine.js` —— 接入主引擎

整体结论:`Planet` 数据对象 + 顶层函数的抽象按设计文档落地干净。但有 4 个 correctness 问题、3 个中等问题、5 个微调建议。

---

## 2. 🔴 严重问题(必须修)

### 2.1 `startAnimation` 中 `updatePlanets` 在 `renderBloomFrame` 之后

**位置**:`src/three/engine.js` line 89-106

**现状**:
```js
function startAnimation () {
    rafId = requestAnimationFrame(startAnimation)

    setSkySphereAutoRotation()  // 1. 更新天空球
    setSunAutoRotation()        // 2. 更新太阳
    controls.update()           // 3. 更新控制器
    renderBloomFrame()          // 4. 渲染 ← 渲染发生在这里
    updatePlanets(true)         // 5. 更新行星 ← ❌ 渲染之后才更新
}
```

**问题**:常规渲染循环是「先更新所有 state,再渲染」。这里天空球(1)、太阳(2)、控制器(3) 都在渲染前更新,**唯独行星在渲染之后更新**。第 N 帧渲染的是行星上一帧的位置(滞后 1 帧)。

60fps 下肉眼看不出,但:
- 与 sky / sun 的更新顺序不一致
- JSDoc 第 5 步注释跟着错
- 将来做"暂停时刷一帧"等操作,顺序错会导致"暂停后画面跳一帧"

**修复**:把 `updatePlanets` 提到 `renderBloomFrame` 之前。

```js
function startAnimation () {
    rafId = requestAnimationFrame(startAnimation)

    setSkySphereAutoRotation()  // 1. 更新天空球
    setSunAutoRotation()        // 2. 更新太阳
    updatePlanets(true)         // 3. 更新行星
    controls.update()           // 4. 更新控制器
    renderBloomFrame()          // 5. 渲染
}
```

JSDoc 注释里的顺序也对应改。

---

### 2.2 `autoRotation.js` 不能处理负旋转速度(金星)

**位置**:`src/three/planet/helper/autoRotation.js`

**现状**:
```js
export function setSpinAutoRotation(planet) {
    const model = planet.spin
    const speed = planet.config.rotationSpeed
    if (model.rotation.y >= Math.PI * 2) {
        model.rotation.y = 0
    }

    model.rotation.y += speed
}
```

**问题**:金星的 `rotationSpeed: -0.0096`(逆向自转)。逐帧追踪:
- Frame 1: `rotation.y` = 0 → 检查 `0 >= 2π`?否 → +(-0.0096) → -0.0096
- Frame 2: -0.0096 → 检查 `-0.0096 >= 2π`?否 → -0.0192
- ……一路单调递减,**reset 分支永远不会触发**

Three.js 处理任意大小的 Euler 角不会出错,但长时间运行(天级)会浮点精度退化。

**问题进一步**:这个 reset 逻辑本身就不对——

```js
if (model.rotation.y >= Math.PI * 2) {
    model.rotation.y = 0   // ❌ 直接置 0 丢弃了"超出 2π 的部分"
}
model.rotation.y += speed
```

举例:`rotation.y = 6.28`,本帧应该 + 0.04 = 6.32,然后规约到 6.32 - 2π ≈ 0.0368。但当前代码先看 6.28 < 2π 不 reset → +0.04 → 6.32;下一帧才发现 6.32 ≥ 2π,直接置 0,**丢失了 0.0368 弧度**。

**修复**(同时解决"reset 顺序错"和"负速度"):

```js
export function setSpinAutoRotation(planet) {
    const model = planet.spin
    const speed = planet.config.rotationSpeed

    model.rotation.y += speed
    model.rotation.y = model.rotation.y % (Math.PI * 2)
}
```

JS 的 `%` 是「截断取余」,结果符号跟被除数相同:

- 顺向自转(其他行星):`rotation.y` 落在 `[0, 2π)`
- 逆向自转(金星):`rotation.y` 落在 `(-2π, 0]`

两种取值在视觉上等价(`sin/cos` 周期 2π),Three.js 也接受任意实数。保留符号反而有好处——调试时打印 `rotation.y`,负值能直接看出"金星在逆转",正值是"顺转",方向直觉不丢。

> 注:只有当下游代码假设 `rotation.y ≥ 0`(本场景不需要)、或要做角度比较 / 序列化对齐时,才需要把结果统一规整到 `[0, 2π)`,写成 `((x % 2π) + 2π) % 2π`(称为"欧几里得取余")。这里没有这种约束,简单 `%` 即可。

---

### 2.3 `revolution.js` 角度规约同样有 reset 顺序 bug

**位置**:`src/three/planet/helper/revolution.js` line 12-15

**现状**:
```js
planet.orbitAngle += planet.config.orbit.speed
if (planet.orbitAngle >= Math.PI * 2) {
    planet.orbitAngle = 0   // ❌ 同样丢弃了超出部分
}
```

**问题**:公转的 `speed` 都是正值,所以不会有金星那种永远不 reset 的问题。但和 ② 一样,reset 时直接置 0,丢失了超出 2π 的小段。

**修复**:用模运算,或减 2π:

```js
// 方案 A:用模运算,简洁
planet.orbitAngle = (planet.orbitAngle + planet.config.orbit.speed) % (Math.PI * 2)

// 方案 B:保留显式判断
planet.orbitAngle += planet.config.orbit.speed
if (planet.orbitAngle >= Math.PI * 2) {
    planet.orbitAngle -= Math.PI * 2
}
```

任选其一。

---

### 2.4 Neptune 的命名是 PascalCase,与其他 7 颗不一致

**位置**:`src/three/planet/config.js` line 192-196

**现状**:
```js
{
    id: 8,
    name: 'Neptune',
    groupName: 'NeptuneRoot',  // ❌ 其他 7 颗:'mercuryRoot' / 'venusRoot' / ...
    axisName: 'NeptuneAxis',   // ❌
    spinName: 'NeptuneSpin',   // ❌
    ...
}
```

**问题**:其他 7 颗行星都用 camelCase(`mercuryRoot`、`venusRoot`、...),Neptune 用 PascalCase。如果后续用 `scene.getObjectByName('neptuneRoot')` 找海王星会找不到。

**修复**:

```js
groupName: 'neptuneRoot',
axisName: 'neptuneAxis',
spinName: 'neptuneSpin',
```

---

## 3. 🟡 中等问题

### 3.1 `orbitAngle` 单位 JSDoc 错误:写的是"角度",实际是"弧度"

**位置**:
- `src/three/planet/planet.js` line 19
- `src/three/planet/helper/position.js` line 17

**现状**:
```js
// planet.js:
* @property {Number} orbitAngle 行星当前公转位置的角度(单位: 角度)

// position.js:
* @param {Number} angle 行星在轨道上的角度位置 (单位: 角度)
```

**问题**:实际代码用的是**弧度**——`Math.cos(angle)` / `Math.sin(angle)` 接收弧度;`Math.PI * 2` 这种比较也只在弧度下有意义。注释说成"角度"会误导读代码的人。

> Tips:`OrbitConfig.dipAngle` 的注释 `Tips: 单位是角度,而非弧度` 是对的——那个字段确实是角度,代码里用 `THREE.MathUtils.degToRad()` 转。**只有 `orbitAngle` 注释错了**。

**修复**:把两处的 `(单位: 角度)` 改成 `(单位: 弧度)`。

---

### 3.2 `bodyType` 枚举使用不一致——只有 Mercury 用了 enum

**位置**:`src/three/planet/config.js`

**现状**:
```js
// Mercury:
label: { bodyType: bodyType.planet, ... }   // ✅

// Venus 到 Neptune:
label: { bodyType: 'planet', ... }          // ❌ 字面量
```

**问题**:字符串值都一样,运行时不出 bug,但绕过了 `bodyType` 枚举,失去"将来如果改 `bodyType.planet = 'PLANET'`,所有地方一起更新"的好处。

**修复**:把 Venus 到 Neptune 的 `bodyType: 'planet'` 都改成 `bodyType: bodyType.planet`(需要顶部 import 已经存在,确认即可)。

---

### 3.3 typo:"自传层" 应该是 "自转层"

**位置**:`src/three/planet/planet.js` line 17

**现状**:
```js
* @property {import('three').Group} spin 自传层 用于定义行星绕自身Y轴的自转运动
                                          ↑
                                     应该是 "自转层"
```

**问题**:「自传」(autobiography)和「自转」(rotation)字形相近但含义完全不同。

**修复**:改成"自转层"。

---

## 4. 🟢 微调建议(非必须)

### 4.1 导出函数命名不一致

**位置**:`src/three/planet/planet.js` line 142-147

**现状**:
```js
export {
    createPlanet,           // ✅ Planet 后缀
    initPlanet,             // ✅ Planet 后缀
    getPickableMeshes,      // ❌ 没有
    update,                 // ❌ 没有,且 "update" 太通用
}
```

`update` 这个名字在 `index.js` 里被 `import {update}` 时显得没头没尾。

**建议**:统一改成 `updatePlanet` / `getPlanetPickableMeshes`(原设计文档中规划的命名)。

需要同步更新 `index.js` 内的 import。

---

### 4.2 `index.js` 缺 `getAllPickableMeshes()`

**位置**:`src/three/planet/index.js`

**问题**:设计文档规划了这个对外 API,目前未实现。

**建议**:如果鼠标拾取还没做,可以等到那一阶段再加;但**建议至少先占位**,把"行星模块的所有公开 API"完整暴露:

```js
import {
    createPlanet,
    initPlanet,
    updatePlanet,
    getPlanetPickableMeshes,
} from "@/three/planet/planet.js"

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

### 4.3 `initPlanet` JSDoc 缺 `@param`

**位置**:`src/three/planet/planet.js` line 63-77

**问题**:`initPlanet` 函数 JSDoc 没有 `@param {Planet} planet`。同文件其他三个函数(`createPlanet`、`getPickableMeshes`、`update`)都有。

**修复**:补上 `@param {Planet} planet 行星运行时状态对象`。

---

### 4.4 `orbitPath.js` 内部有 `config` 变量,与 `planet.config` 容易混淆

**位置**:`src/three/planet/helper/orbitPath.js` line 12-18

**现状**:
```js
const config = {       // ← 模块内的轨道线视觉配置
    nameSuffix: 'Orbit',
    segment: 256,
    color: 0x888888,
    ...
}

export function createOrbitPath(planet) {
    const semiMajorAxis = planet.config.orbit.semiMajorAxis  // ← 行星 config
    ...
}
```

两个 `config`,一个是模块内常量,一个是 `planet.config`,含义完全不同,看代码时需要切换上下文。

**建议**:把模块内的改名 `orbitVisualConfig` 或 `pathConfig`。

---

### 4.5 helper 内 `@param {Planet}` 跨文件 typedef 引用

**位置**:`src/three/planet/helper/*.js`

**现状**:`position.js`、`revolution.js`、`autoRotation.js`、`orbitPath.js` 内部都用 `@param {Planet}`,但 `Planet` 这个 typedef 是定义在 `planet.js` 里的。

**问题**:JSDoc 标准里 typedef 不会自动跨文件全局可见。JetBrains / VSCode 通常能通过项目级扫描找到,但不是规范保证的行为。

**建议**(可选):如果要完全规范,改成显式 import 形式:
```js
/** @param {import('@/three/planet/planet.js').Planet} planet */
```

不过这会让注释变长,且当前 IDE 实际能用,可以暂不改。

---

## 5. 建议修复顺序

按下面顺序最自然(先改严重 bug,再改一致性,最后微调):

1. **engine.js**: 调整 `startAnimation` 中 `updatePlanets` 的位置(问题 ①)
2. **autoRotation.js**: 改用模运算(问题 ②)
3. **revolution.js**: 改用模运算或减 2π(问题 ③)
4. **config.js**:
   - 修 Neptune 的 PascalCase 命名(问题 ④)
   - 把 Venus 到 Neptune 的 `bodyType` 改为枚举引用(问题 ⑥)
5. **planet.js** + **position.js**: 修 `orbitAngle` 单位注释(问题 ⑤)
6. **planet.js**: 修 typo "自传"→"自转"(问题 ⑦)
7. **planet.js** + **index.js**: 重命名 `update` → `updatePlanet`,`getPickableMeshes` → `getPlanetPickableMeshes`(问题 ⑧)
8. **index.js**: 补 `getAllPickableMeshes()`(问题 ⑨)
9. **planet.js**: 补 `initPlanet` 的 `@param`(问题 ⑩)
10. **orbitPath.js**: 把模块内 `config` 重命名(问题 ⑪)
11. (可选)所有 helper:改用 `import('...').Planet` 显式引用 typedef(问题 ⑫)

---

## 6. 修复后验证

启动 dev server 后目测:

- 内行星(水/金/地/火):能看到清晰的轨道线和公转运动
- 金星:观察自转方向应与其他内行星相反(逆向)
- 外行星(木/土/天/海):因尚未补光会偏暗,**这是预期的,等下一阶段补光**
- 海王星:用 `scene.getObjectByName('neptuneRoot')` 应能找到(验证 ④ 已修)
- DevTools 控制台无 Three.js 警告或报错

如果想再严格一点,跑一段时间(几分钟)后看看公转是否平稳——若看到"卡顿一帧"则说明 ② / ③ 没修干净。