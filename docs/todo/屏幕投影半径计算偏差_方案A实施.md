# 屏幕投影半径计算偏差 — 修复方案(含 activeEntity 重构)

> 前置阅读:[`屏幕投影半径计算偏差.md`](./屏幕投影半径计算偏差.md)。本文档落地方案 A,且**在原 bug 文档之上做了一个架构改动**:把状态机的 `activeEntity` 从 raycaster 命中的 **leaf mesh** 改为对应天体的 **anchor**(`sunAxis` / `planet.root`)。
>
> 该重构本身不是 bug 修复,但它**让 hoverRadius 的修复变得显著更干净**——之前的修复需要在 `getLocalBoundingSphere` 里做 `findAncestorByName` + 几何 center 派生,改造后 `getLocalBoundingSphere` 几乎不需要逻辑;同时附带解决了"`labelText` computed 拿不到 title/intro"这个之前列为"未尽事项"的连带问题。
>
> 本文档分两部分:
> - **第 1 部分**:`activeEntity` 重构 —— 影响面、各处该怎么改
> - **第 2 部分**:`hoverRadius` 取值 + `getLocalBoundingSphere` 重构

---

# 第 1 部分:`activeEntity` 从 leaf mesh 改为 anchor

## 1.1 重构动机

当前的 `activeEntity` 存的是 raycaster 直接命中的 **leaf mesh**(`intersects[0].object`)。所有"需要语义天体信息"的下游(`getLocalBoundingSphere` 算半径、`labelText` 读 title/intro、未来阶段 9 的相机聚焦)都得从 leaf 上溯到 anchor 才能拿到自己想要的数据。

这种设计有两个问题:
1. **同一件转换重复做 N 遍** —— 每个下游都得各自调一次 `findAncestorByName`
2. **`activeEntity` 的语义不诚实** —— 它叫"激活的天体",但实际是天体里某个被打中的子 mesh,不是天体本身

把转换收到 **`enterBody` 这一个边界点** 上:
- `enterBody(leaf)` 内部用 `findAncestorByName` 上溯到 anchor,把 anchor 写入 `activeEntity`
- 下游全部直读 `activeEntity`,不再做反查
- `activeEntity` 的语义变成"用户当前焦点的天体"——所见即所得

## 1.2 影响面总览

| 文件 | 影响 | 修改方向 |
|---|---|---|
| `src/stores/hover.js` | `enterBody` 实现需要加入 anchor 解析 | 内部调 `findAncestorByName`,把结果写入 `activeEntity` |
| `src/stores/hover.js` | `activeEntity` 的 typedef | 改为"焦点天体的 anchor 引用",更新各阶段的说明 |
| `src/stores/hover.js` | `labelText` computed | 直接读 `activeEntity.userData.title`,**不再需要**反查 |
| `src/three/interaction/hover.js` | `handleBody` 的"是否切换天体"比较 | **删除**:enterBody 同值短路了,调用方不再需要预判 |
| `src/three/sun.js` / `src/three/planet/planet.js` | leaf mesh 上的 `anchorPointName` | **保留**(供 `enterBody` 上溯);其他既有用法不变 |
| `src/three/lib/projection.js` | `getLocalBoundingSphere` 的输入 | 见第 2 部分 —— `object` 现在是 anchor 而不是 leaf,实现大幅简化 |

## 1.3 `stores/hover.js` — `enterBody` 重写

文件顶部增加 import:

```js
import { findAncestorByName } from '@/three/lib/findAncestorByName.js'
```

`enterBody` 重写为:

```js
/**
 * 本函数用于将状态机切换到 body 状态。
 *
 * 关键职责:把 raycaster 命中的 leaf mesh 上溯到对应天体的 anchor,
 * 然后把 anchor(而非 leaf)写入 activeEntity。
 *
 * @param {import('three').Object3D} hitObject 投射检测命中的 leaf mesh
 *     (即 raycaster.intersectObjects 返回的 intersects[0].object)
 * */
function enterBody(hitObject) {
    // 防御性检查:label 状态下不允许从外部强制切回 body(详见 5.8.2)
    if (isActiveLocked.value) {
        return
    }

    // 上溯到天体的 anchor (sunAxis / planet.root)
    const anchorName = hitObject.userData.anchorPointName
    if (typeof anchorName !== 'string' || anchorName === '') {
        return
    }
    const anchor = findAncestorByName(hitObject, anchorName)
    if (anchor === null) {
        return
    }

    phase.value = HoverPhase.body
    activeEntity.value = anchor
}
```

> 三层 `typeof/!== null` 守卫是**防御 `undefined.userData` 报错**——若 leaf 上漏配 `anchorPointName` 或 anchor 找不到,enterBody 静默 no-op,该天体表现为"无法被悬停"(fail-loud 视觉反馈)。

### 1.3.1 为什么 `phase.value = HoverPhase.body` 是无条件写入

`enterBody` 是状态机里"任何阶段 → body 阶段"的**唯一通路**,从 4 个调用方进入:

| 调用方 | 调用时 phase | 调用后期望 phase | 调用后 `activeEntity` |
|---|---|---|---|
| `handleIdle`(`hover.js:101-106`) | `idle` | `body` | null → 新 anchor |
| `handleBody`(改造后,本帧仍命中) | `body` | `body`(不变) | 不变 或 切到新 anchor |
| `handleSticky`(`hover.js:179-181`,鼠标从粘滞区移回天体) | `sticky` | `body` | 不变(粘滞期间已锁定) |
| `handleLabel`(`hover.js:220-224`,鼠标离 label 后命中天体) | `label` | `body` | 不变 |

关键观察:**`handleSticky` 与 `handleLabel` 这两条路径调用 `enterBody` 时,`activeEntity` 通常不变**(粘滞与 label 阶段都从 body 继承 `activeEntity`,鼠标移回的若是同一颗天体,anchor 自然就等于当前的 `activeEntity`)。

如果只在 `anchor !== activeEntity.value` 的分支里写 `phase`,这两条路径会因为 `anchor === activeEntity.value` 而**跳过 phase 写入,导致状态机卡死在 sticky / label**——鼠标"从粘滞区移回本体"看起来没反应,"离开 label 又落到天体上"也看起来没反应。

走具体例子:用户悬停 Earth → phase=body → 鼠标轻微离开 Earth 边缘 → phase=sticky(`activeEntity` 仍是 `earthRoot`)→ 鼠标又移回 Earth 本体 → `handleSticky` 调 `enterBody(earthLeaf)`:

1. `enterBody` 内 anchor 解析得到 `earthRoot`
2. `anchor === activeEntity.value` —— **`true`**(两者都是 `earthRoot`)
3. 若条件式跳过 `phase` 写入,phase 仍停留在 `sticky`,**永远回不到 body**

所以 `phase.value = HoverPhase.body` 必须无条件执行 —— 它**本质上是"转移到 body 阶段"这条语义的载体**,与 `activeEntity` 是否变更无关。

### 1.3.2 为什么不需要"同 anchor 短路"判断

可能直觉是"如果 `anchor === activeEntity.value`,就不要再写一次 `activeEntity.value = anchor` 以避免触发响应式"。**这种短路在 Vue 3 下是不必要的**:

- `activeEntity` 是 `shallowRef`(`stores/hover.js:60`)
- Vue 3 的 ref 在赋值时内部用 `Object.is(newValue, oldValue)` 检测变化(见 Vue 源码 `@vue/reactivity` 的 `triggerRef`)
- **同引用赋值不会触发任何 watcher / computed 重算 / 模板重渲染** —— Vue 在 ref 层就短路了

也就是说,即便 `anchor === activeEntity.value`,直接写 `activeEntity.value = anchor` 也是 0 副作用的"假写入"。再多套一层 `if` 反而:

1. 增加阅读负担(让人误以为"同 anchor 时需要特殊处理")
2. 容易写错(就像之前那版 — 在短路分支里漏了 phase 写入会破坏 sticky/label→body 转换)
3. 重复 Vue 已经做好的事(违反 DRY)

所以 `enterBody` 的最终形态是"**守卫 → 上溯 → 无条件写 phase + activeEntity**",没有任何中间状态判断。Vue 的响应式系统会自动处理重复赋值的短路。

`activeEntity` 的 typedef 同步更新(对应 `stores/hover.js:51-59`):

```js
/**
 * @type {import('vue').ShallowRef<import('three').Object3D|null>} 当前焦点天体的 anchor 引用
 *      - idle 状态: null
 *      - body 状态: 投射检测命中 mesh 上溯得到的 anchor(sunAxis 或 planet.root)
 *      - sticky 状态: 从 body 状态继承,不随本帧 raycaster 是否命中而变
 *      - label 状态: 从 body/sticky 状态继承,因 isActiveLocked 为 true,本帧 raycaster 命中谁都不切换
 *      Tips: 每帧 raycaster 的瞬时命中是 leaf mesh,由 enterBody 上溯转换为 anchor 后写入此字段
 *      Tips: 由于 activeEntity 现已是 anchor,下游(calcProjection / labelText)可以直接读取
 *           anchor 上的 userData,不再需要反查
 * */
```

## 1.4 `stores/hover.js` — `labelText` computed 简化

当前(`stores/hover.js:158-171`):

```js
const labelText = computed(() => {
    const entity = activeEntity.value
    if (entity === null) return null
    return {
        title: entity.userData.title,   // 当 entity 是 leaf 时读到 undefined
        intro: entity.userData.intro,
    }
})
```

改造后**代码不变**,但语义对了 —— `activeEntity` 现在是 anchor,而 anchor 上已挂载了 `title`/`intro`(`sun.js:144-146`、`planet.js:48-50`),所以这个 computed 真正能拿到值。

之前列为"未尽事项"的 §8.2(labelText 在 leaf 上读不到 title/intro)**本次顺手解决**,无需额外改动。

## 1.5 `three/interaction/hover.js` — `handleBody` 删除"切换天体"比较

当前(`hover.js:128-135`):

```js
const hitObject = pickHoveredBody(pointer.ndcCoordinate, camera)
if (hitObject !== null) {
    if (hitObject !== store.activeEntity) {       // ← 删除这一层比较
        store.enterBody(hitObject)
    }
    return
}
```

改造后:

```js
const hitObject = pickHoveredBody(pointer.ndcCoordinate, camera)
if (hitObject !== null) {
    store.enterBody(hitObject)
    return
}
```

**为什么必须删**:`hitObject` 是 leaf,而 `store.activeEntity` 现在是 anchor。两者必然不相等,该判断永远为真,失去意义。

**为什么删了不会出问题**:`enterBody` 内部已经有"同 anchor 短路"(`if (anchor === activeEntity.value) return` after setting phase)。每帧调用 `enterBody` 不会引发重复的 `activeEntity` 写入。

**`handleSticky` 和 `handleLabel` 不需要改** —— 它们调用 `enterBody` 时已经是无条件调用,没有这种基于 `activeEntity` 的预判逻辑。

## 1.6 leaf mesh 的 `anchorPointName` 仍然保留

`sun.js:184` 和 `planet.js:96` 中给每个 leaf mesh 挂 `userData.anchorPointName = config.axisName / config.groupName` 的代码**不动**。

它们的用途从"被 calcProjection / labelText 反查"变成了**"被 enterBody 上溯使用"**——只是消费者换了,但 leaf 仍然需要这个字段。

---

# 第 2 部分:`hoverRadius` 取值 + `getLocalBoundingSphere` 重构

## 2.1 配置位置:挂在 anchor 上(与 title/intro 同一处)

`hoverRadius` 沿用项目现有的"语义数据挂 anchor"的模式:

| userData 字段 | 挂在哪 | 现有 / 新增 |
|---|---|---|
| `anchorPointName` | leaf mesh | 现有 |
| `title` / `intro` / `bodyType` | anchor | 现有 |
| `hoverRadius` | anchor | **新增** |

### 2.1.1 `src/three/planet/config.js`

新增 typedef:

```js
/**
 * @typedef {Object} HoverConfig 行星 hover 区域配置项
 * @property {Number} radius 世界坐标系下的 hover 半径(单位:与场景的世界单位一致)
 *      Tips: 由于 activeEntity 是 anchor(planet.root / sunAxis),且 anchor 自身没有 scale,
 *      getWorldScale(anchor) = 1。因此该字段的值会被原样作为世界空间下的半径使用。
 *      Tips: 推荐值见 `docs/todo/屏幕投影半径计算偏差_方案A实施.md` §2.3
 * */

/**
 * @typedef {Object} PlanetConfig 行星配置项
 * ... 其他字段不变 ...
 * @property {HoverConfig} hover hover 区域配置项
 * ...
 * */
```

每个行星 config 加 `hover` 字段(数值见 §2.3):

```js
{
    id: 1,
    name: 'Mercury',
    // ...
    scale: 1,
    hover: {
        radius: 0.5,
    },
    // ...
}
```

### 2.1.2 `src/three/sun.js`

config 加 hover 字段:

```js
const config = {
    // ...
    scale: { size: 4 },
    hover: {
        radius: 2.0,
    },
    // ...
}
```

`sunAxis` 初始化处与现有 `title`/`intro` 并列(对应 `sun.js:144-146`):

```js
sunAxis.userData.bodyType = config.label.bodyType
sunAxis.userData.title = config.label.title
sunAxis.userData.intro = config.label.intro
sunAxis.userData.hoverRadius = config.hover.radius   // ← 新增
```

### 2.1.3 `src/three/planet/planet.js`

`createPlanet()` 中的 userData 挂载块下追加一行(对应 `planet.js:48-50`):

```js
root.userData.bodyType = config.label.bodyType
root.userData.title = config.label.title
root.userData.intro = config.label.intro
root.userData.hoverRadius = config.hover.radius   // ← 新增
```

## 2.2 `hoverRadius` 的语义:世界空间下的半径

这是 activeEntity 重构带来的**重要副作用**,容易被忽略。

`calcProjection` 内部:

```js
object.getWorldScale(worldScale)
const maxScale = Math.max(worldScale.x, worldScale.y, worldScale.z) || 1
const radiusWorld = radiusLocal * maxScale
```

由于 `activeEntity` 现在是 anchor:

- `sunAxis.scale = (1, 1, 1)`,父链(scene)无 scale → `getWorldScale(sunAxis) = 1`
- `planet.root.scale = (1, 1, 1)`,父链(planet.axis 只有旋转、scene 无 scale)→ `getWorldScale(planet.root) = 1`

所以 `radiusWorld = hoverRadius × 1 = hoverRadius`——**`hoverRadius` 的数值就是世界空间下的半径**。

### 2.2.1 关于命名:为什么去掉 "Local" 字眼

基于上面的等式 `radiusWorld = hoverRadius × 1 = hoverRadius`,用户配置层的字段名做了简化:

| 层级 | 当前命名 | 早期讨论命名 | 是否含 Local |
|---|---|---|---|
| 配置 typedef 字段 | `HoverConfig.radius` | `HoverConfig.localRadius` | 去掉 |
| 配置实例字面值 | `config.hover.radius` | `config.hover.localRadius` | 去掉 |
| 运行时 userData 键 | `anchor.userData.hoverRadius` | `anchor.userData.hoverRadius` | 去掉 |
| 数学层类型 | `LocalBoundingSphere` | `LocalBoundingSphere` | **保留** |
| 数学层字段 | `LocalBoundingSphere.radiusLocal` / `centerLocal` | 同左 | **保留** |
| 数学函数名 | `getLocalBoundingSphere` | 同左 | **保留** |
| userData 缓存键 | `__hoverLocalSphere` | 同左 | **保留**(指代缓存的 `LocalBoundingSphere`) |

**分层原因**:

- **用户配置层去 Local** —— 用户写下的数值就是"世界空间下天体的 hover 半径",无需再让读者脑子里做一次 local → world 换算。配置层应该说人话。
- **数学层保留 Local** —— `LocalBoundingSphere` / `radiusLocal` / `centerLocal` 描述的是"object 局部坐标系下的几何量",是 `calcProjection` 内部 `radiusLocal × maxScale = radiusWorld` 这个数学行为的载体。如果未来某天给 anchor 加了 scale(例如用 `axis.scale.setScalar(2)` 整体放缩),`maxScale ≠ 1`,radiusLocal 与 radiusWorld 立刻数值分化 —— 此时数学层的 Local 命名仍然准确。

> 用户配置层与数学层之间的"翻译"发生在 `getLocalBoundingSphere` 内部 —— 它读 `hoverRadius`、写 `radiusLocal`。这层翻译目前是"赋值即对齐"(因为数值重合),将来若 anchor 体系发生变化,这里也是唯一需要调整的点。详见 §2.4 代码内的注释。

**对比之前的"几何本地空间"语义**:

| 天体 | 旧版(`activeEntity = leaf`,几何本地空间) | 新版(`activeEntity = anchor`,世界空间) |
|---|---|---|
| Sun | 10.0(GLTF size = 20,本地半径 10,× scale 0.2 = 世界半径 2.0) | **2.0**(直接就是世界半径) |
| Mercury | 1.0(本地半径 1,× scale 0.5 = 世界半径 0.5) | **0.5** |
| Uranus | 597.0(本地半径 597,× scale 0.0088 = 世界半径 5.25) | **5.25** |

新值更直观,不需要心算缩放系数。

## 2.3 推荐值(基于 GLTF 离线分析)

通过离线读取 `public/assets/*/scene.gltf` 的 POSITION accessor `min`/`max`,得到每个天体本体在几何本地空间的 AABB;乘以 `scaleModel` 的 `scaleSize / maxDim` 系数,得到世界空间下的本体半径。该值即推荐 `hoverRadius`(可在 §3.2 红圈调试微调):

| 天体 | GLTF size | scaleSize | model_max_dim | maxScale | 本体世界半径 | 推荐 `hoverRadius` |
|---|---|---|---|---|---|---|
| Sun | 20 × 20 × 20 | 4 | 20 | 0.2 | 2.0 | **2.0** |
| Mercury | 2 × 2 × 2 | 1 | 2 | 0.5 | 0.5 | **0.5** |
| Venus | 2 × 2 × 2(共用 Mercury 模型) | 2.5 | 2 | 1.25 | 1.25 | **1.25** |
| Earth | 1.97 × 2.00 × 1.97 | 2.6 | 2.00 | 1.30 | 1.30 | **1.3** |
| Mars | 1.97 × 1.97 × 2.00 | 1.4 | 2.00 | 0.70 | 0.70 | **0.7** |
| Jupiter(本体) | 20 × 20 × 20 | 29.3 | 36(扁盘) | 0.814 | 8.14 | **8.14** |
| Jupiter(含扁盘) | 36 × 36 × 0(扁盘) | 29.3 | 36 | 0.814 | 14.65 | **14.65** |
| Saturn(含光环) | 2.4 × 0.009 × 2.4(光环) | 24.7 | 2.4 | 10.29 | 12.35 | **12.35** |
| Uranus | 1194 × 1194 × 1194 | 10.5 | 1194 | 0.0088 | 5.25 | **5.25** |
| Neptune | 1.97 × 2.00 × 1.97(共用 Earth 模型) | 10.2 | 2.00 | 5.10 | 5.10 | **5.1** |

**Jupiter 的二选一**:Jupiter 的 GLTF 含一个 36×36×0 的扁盘 mesh,木星实际上有非常暗淡的环,视觉上多数渲染默认不显示。**先按 8.14 配**,在浏览器里不悬停任何天体时观察木星外观:

- 看不到环 / 光晕 → 保持 8.14
- 能看到外圈环 → 改为 14.65(覆盖扁盘)

## 2.4 `getLocalBoundingSphere` 重构

`activeEntity` 变成 anchor 之后,`getLocalBoundingSphere` 的输入也变成 anchor。这带来两个简化:

| 关注点 | 旧版(activeEntity=leaf) | 新版(activeEntity=anchor) |
|---|---|---|
| `radiusLocal` | 沿 `anchorPointName` 上溯到 anchor 读取 | **直接读 `object.userData.hoverRadius`**(object 已经是 anchor) |
| `centerLocal` | 需要从 `geometry.boundingSphere.center` 派生(处理 Mercury/Venus/Mars 偏移) | **直接用 `(0, 0, 0)`**(anchor 自身已经定位在天体世界中心) |

### 2.4.1 为什么 `centerLocal = (0, 0, 0)` 现在自动正确

每颗天体的 anchor:
- Sun:`sunAxis` 的世界位置 = `(0, 0, 0)` —— 太阳就在世界原点
- 行星:`planet.root` 的世界位置 = 该行星当前的公转坐标 —— `centerModelToOrigin` 已经把 GLTF 模型的几何中心对齐到了 `planet.spin` 的原点,而 `planet.spin` 在 `planet.root` 的原点,所以 `planet.root` 的世界位置 = 行星几何中心的世界位置

也就是说,anchor 的世界变换矩阵 `matrixWorld` 把 `(0, 0, 0)_anchor_local` 映射到了**天体几何中心的世界坐标**。我们再让 `centerLocal = (0, 0, 0)`,投影圆心就准了。

**Mercury / Venus / Mars 的 vertices 偏移问题彻底消失** —— 那个问题是因为 leaf mesh 的 `(0, 0, 0)_mesh_local` 落在 AABB 一角而不是球心,但 `centerModelToOrigin` 调整的是 `model.position` 来补偿这件事,让**模型整体**的 AABB 中心对齐到 spin 的原点。所以从 anchor 看下去,中心永远是对的。

### 2.4.2 完整的 `getLocalBoundingSphere` 新版本

```js
/**
 * 本函数用于获取给定 3D 物体在其本地坐标系下的包围球球心和半径
 *
 * 设计契约:
 *     - 调用方传入的 object 必须是天体的 anchor(sunAxis / planet.root),
 *       其 userData 上必须配 `hoverRadius`(正数,世界空间下的半径)
 *     - 任一环节缺失(配置项不存在 / 值不是正数)视为配置错误,
 *       本函数返回 radiusLocal = 0 的 sphere,投影圆将缩成一个点 ——
 *       视觉上立即可见,便于开发期一眼发现漏配
 *     - centerLocal 始终为 (0, 0, 0):anchor 自身的世界位置已经对齐到天体几何中心,
 *       无需再从几何派生
 *
 * Tips: 返回值会被缓存到 anchor 的 userData 中,后续调用直接命中缓存。
 *       调用方不应修改返回字段。
 *
 * @param {import('three').Object3D} object 天体的 anchor(由 enterBody 写入 activeEntity 后传入)
 * @return {LocalBoundingSphere} 物体包围球在物体本地坐标系下的球心和半径
 * */
function getLocalBoundingSphere(object) {
    const cacheKey = '__hoverLocalSphere'
    const cached = object.userData[cacheKey]
    if (cached !== null && cached !== undefined) {
        return cached
    }

    /** @type {LocalBoundingSphere} */
    const localSphere = {
        centerLocal: new THREE.Vector3(),
        radiusLocal: 0,
    }

    // 配置层 hoverRadius(世界空间下的数值)直接存入数学层 radiusLocal:
    // anchor 没有 scale,calcProjection 内部 radiusLocal × maxScale = radiusLocal × 1 = radiusWorld,
    // 两层在数值上重合,可以直接赋值。详见 §2.2.1 关于"用户配置层 / 数学层"的分层说明。
    const configured = object.userData.hoverRadius
    if (typeof configured === 'number' && configured > 0) {
        localSphere.radiusLocal = configured
    }

    object.userData[cacheKey] = localSphere
    return localSphere
}
```

**从旧版删除的内容**:
- `import { findAncestorByName } from ...`
- `anchorPointName` 上溯逻辑
- Mesh 分支(`object.isMesh && object.geometry...`)中的 `geometry.boundingSphere.center` 派生
- 非 Mesh 分支(`Box3.getBoundingSphere`,即原 bug 文档 §1.2 点名的 1.73x 偏差源头)

**保留**:
- 守卫 `typeof configured === 'number' && configured > 0` —— 这是防御 `undefined` 字段读出非数值,不是"配置缺失时回退到近似值"。配置缺失 → `radiusLocal = 0` → 投影圆缩为 0 → fail-loud。

## 2.5 `calcProjection` 末尾去掉 `/ 2`

`projection.js:122-123`:

```js
const radiusPx = Math.hypot(deltaX, deltaY) / 2     // ← 旧版
```

改为:

```js
const radiusPx = Math.hypot(deltaX, deltaY)         // 去掉 /2 与 TODO 注释
```

## 2.6 `projection.js` 顶部模块级常量清理

被删的 fallback 分支用到的模块级缓存常量,**若 `calcProjection` 主体不再引用**,顺手清理:

```js
// 删除候选(仅在被删的分支中用过):
const box = new THREE.Box3()
const sphere = new THREE.Sphere()
const inverseMatrixWorld = new THREE.Matrix4()
```

保留:`centerWorld` / `centerNDC` / `cameraRightSampleWorld` / `cameraRightSampleNDC` / `cameraRightWorld` / `worldScale`(`calcProjection` 主体仍在使用)。

> 改动前在文件里全文搜一下,确认 `box`、`sphere`、`inverseMatrixWorld` 这三个常量只在被删的分支中出现,再删除。

---

# 第 3 部分:完整实施步骤

按照"依赖方向从底向上"的顺序执行,每步改完先 `npm run dev` 看下没报错再下一步:

### 步骤 1:配置项准备(无运行时副作用)

1. `src/three/planet/config.js`
   - 新增 `HoverConfig` typedef
   - `PlanetConfig` typedef 加 `hover` 字段
   - 每个行星 config 加 `hover: { radius: <§2.3 表中值> }`

2. `src/three/sun.js`
   - `config` 加 `hover: { radius: 2.0 }`

### 步骤 2:把 `hoverRadius` 挂到 anchor 上

3. `src/three/sun.js`
   - `sunAxis.userData.hoverRadius = config.hover.radius`(与现有 `title`/`intro` 并列)

4. `src/three/planet/planet.js`
   - `createPlanet()` 中 `root.userData.hoverRadius = config.hover.radius`(与现有 `title`/`intro` 并列)

### 步骤 3:store 的 enterBody 重构

5. `src/stores/hover.js`
   - 顶部 import `findAncestorByName`
   - `enterBody` 重写为 §1.3 的版本(anchor 解析 + 同 anchor 短路)
   - `activeEntity` 的 typedef 更新为 §1.3 末尾的版本

### 步骤 4:状态机调用方简化

6. `src/three/interaction/hover.js`
   - `handleBody` 中删除 `if (hitObject !== store.activeEntity)` 这一层比较,直接调 `store.enterBody(hitObject)`

### 步骤 5:projection.js 全部改动

7. `src/three/lib/projection.js`
   - `getLocalBoundingSphere` 重写为 §2.4.2 的精简版
   - `calcProjection` 末尾 `/2` 去掉
   - 删除 `box`/`sphere`/`inverseMatrixWorld` 模块级常量(若不再被引用)

### 步骤 6:浏览器目测

完整刷新页面(不要靠 HMR,见 §4.4),按 §4.1 / §4.2 / §4.3 验收。

---

# 第 4 部分:验收 + 校准

## 4.1 验收清单

- [ ] `activeEntity` 的写入路径:
    - [ ] `enterBody` 内部正确使用 `findAncestorByName` 把 leaf 上溯为 anchor
    - [ ] 任一守卫失败(无 anchorPointName / anchor 找不到 / isActiveLocked)时静默 no-op
    - [ ] `phase.value = HoverPhase.body` 与 `activeEntity.value = anchor` 均为无条件写入(无"同 anchor 短路"if 判断,详见 §1.3.1 / §1.3.2)
- [ ] `handleBody` 中 `hit !== store.activeEntity` 比较已删除
- [ ] `stores/hover.js` 的 `activeEntity` typedef 更新为"anchor 引用"语义
- [ ] `calcProjection` 末尾不再有 `/ 2`
- [ ] `getLocalBoundingSphere`:
    - [ ] 函数体精简到约 15 行,无 `findAncestorByName` import
    - [ ] 无 Mesh / 非 Mesh fallback 分支
    - [ ] 唯一的 radius 来源是 `object.userData.hoverRadius`
    - [ ] `centerLocal` 始终为 `(0, 0, 0)`
- [ ] `projection.js` 顶部 `box`/`sphere`/`inverseMatrixWorld` 三个常量已清理(若不再被引用)
- [ ] 太阳和所有 8 颗行星都在 anchor 上配了 `hoverRadius`:
    - [ ] 太阳:`sunAxis.userData.hoverRadius`
    - [ ] 行星:`planet.root.userData.hoverRadius`(在 `createPlanet` 中)
- [ ] leaf mesh 的 userData 中**没有**额外加 `hoverRadius`(只保留原有的 `anchorPointName`)
- [ ] **fail-loud 验证**:故意删除某颗天体的 `hover.radius`,刷新页面后悬停该天体,投影圆缩为 0
- [ ] **label 文字正确**:悬停每颗天体,label 显示该天体的 title(虽然 ContentLayer 占位文本可能还没接,但 `hoverStore.labelText.value` 在 Vue DevTools 里应能看到正确的 `{ title, intro }`)
- [ ] 红圈调试目测:每颗天体的投影圆与可见轮廓误差 < ±10%(详见 §4.2)
- [ ] 滚轮缩放镜头时,hover 区域跟随同比例变化
- [ ] 无 console 报错和 NaN

## 4.2 红圈调试(目测验证)

在 `SolarCanvas.vue` 临时加一层调试圆,绑定到 `hoverStore.activeProjection`:

```vue
<template>
    <div ref="container" class="solar-canvas"></div>
    <SolarLabel></SolarLabel>

    <!-- 临时调试层(目测合格后删除) -->
    <div
        v-if="hoverStore.activeEntity !== null"
        class="hover-debug-circle"
        :style="{
            left: `${hoverStore.activeProjection.centerPx.x - hoverStore.activeProjection.radiusPx}px`,
            top: `${hoverStore.activeProjection.centerPx.y - hoverStore.activeProjection.radiusPx}px`,
            width: `${hoverStore.activeProjection.radiusPx * 2}px`,
            height: `${hoverStore.activeProjection.radiusPx * 2}px`,
        }"
    ></div>
</template>

<style scoped>
.hover-debug-circle {
    position: fixed;
    pointer-events: none;
    border: 1px solid red;
    border-radius: 50%;
    z-index: 9999;
}
</style>
```

依次悬停每颗天体,对照下表调参:

| 现象 | 判定 | 行动 |
|---|---|---|
| 红圈和球边贴合,误差 < 10% | 合格 | 锁定该天体的 `hoverRadius` |
| 红圈明显大一圈(20%+) | 偏大 | 该值 × 0.7~0.8 |
| 红圈明显小一圈(20%+) | 偏小 | 该值 × 1.2~1.5 |
| **红圈直接缩成一个点** | 漏配 `hoverRadius` 或 anchor 解析失败 | 检查步骤 1 / 2 / 3 |
| 红圈位置整体偏离球心 | anchor 的世界位置没对齐 | 检查 `centerModelToOrigin` 是否对该模型生效 |

调参完成后:删除 `<div class="hover-debug-circle">` 和对应 CSS。

## 4.3 顺手要做的:重新校准两组阈值

本次修改让 `radiusPx` 从"实际可见半径 × 0.866"变成"实际可见半径",所有依赖 `radiusPx` 的距离阈值都会等效**变大约 15%**,需要复核:

| 阈值 | 现值 | 受影响行为 |
|---|---|---|
| `sticky.enterEdgeDistancePx` | 24 (`stores/hover.js:112`) | 鼠标从天体移开后进入粘滞环的内边界 |
| `sticky.exitEdgeDistancePx` | 36 (`stores/hover.js:113`) | 退出粘滞环回到 idle 的外边界 |
| `labelHysteresis.enterDistancePx` | 8 (`stores/hover.js:123`) | label 周边"近邻区"的内边界 |
| `labelHysteresis.exitDistancePx` | 14 (`stores/hover.js:124`) | "近邻区"的外边界 |

用 §4.2 的红圈层 + 临时在指针位置画一个小点,目测各阈值带的宽度是否符合原始设计意图(粘滞环约 1 个手指宽,近邻带约半个手指宽)。可能不需要改,但**目测确认一次**比直接相信"现状值还能用"要稳。

## 4.4 缓存与 HMR 提醒

`getLocalBoundingSphere` 的结果缓存在 anchor 的 `userData.__hoverLocalSphere` 上。调参时改 `hoverRadius` 后:

- **HMR 不会清这个缓存** —— anchor 是 Three.js 对象,Vite HMR 不接管它
- 必须**完整刷新页面**(Cmd+R / Ctrl+R)才能让新值生效

所以调参流程:改 config.js / sun.js 的数字 → 完整刷新页面 → 观察红圈 → 重复。

---

# 第 5 部分:风险与未尽事项

## 5.1 多 mesh 天体的 hover 区域是"一个值"

`hoverRadius` 放在 anchor 上,raycaster 命中天体的任何一个 leaf mesh,`enterBody` 都会上溯到同一个 anchor,读到同一个 `hoverRadius` —— hover 区域大小恒定,不会因为击中不同子 mesh 而跳变。

由于 `activeEntity` 现在是 anchor 而不是 leaf,**投影圆心也始终落在 anchor 的世界位置(= 天体几何中心),不再受 leaf mesh 几何偏移影响**。Saturn 光环、Jupiter 扁盘等被击中时,投影圆始终居中于天体本体——这是个意外但合理的副作用。

## 5.2 配置契约的执行不强制在编译期

`HoverConfig` 通过 JSDoc/typedef 声明为 `PlanetConfig` 的必填字段,但 JS 运行时不强制——漏配不会在加载时抛错。**fail-loud 的"运行时执行"靠的是投影圆缩成 0 这种视觉反馈**(§4.1 验收清单里的 fail-loud 验证项就是为此设计)。这是一个有意识的权衡:不引入运行时校验框架。

## 5.3 `enterBody` 现在带有上溯逻辑,职责略复杂

`enterBody` 从单纯的"phase + activeEntity 双重写入"变成了"phase + 上溯 + 同值短路 + activeEntity 写入"。理论上违反"action 应该简单"的最佳实践,但代价是非常具体的——只多了 3-5 行,且把转换收到唯一边界点,**整体可读性反而提升**。

如果将来 `enterBody` 还要承载更多逻辑,可以考虑把 anchor 解析单独抽成 `resolveAnchor(leaf)` 工具函数(放在 `three/lib/` 下),`enterBody` 调用它。本次保持内联,不预先抽象。

## 5.4 阶段 9(点击聚焦)的衔接更顺了

本次重构后,阶段 9 需要的"当前焦点天体的 group 引用"**直接就是 `activeEntity`**,不需要再做反查。聚焦动画把相机移到 `activeEntity.position`(即 anchor 的本地原点,经过 `getWorldPosition` 转换为世界坐标)即可。
