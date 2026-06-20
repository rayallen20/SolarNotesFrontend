# 天体简介接口接入(`GET /api/v1/planet/list`)

> **目标**:把太阳/行星 label 的 `title`/`intro` 与各天体 `id` 从前端写死,改为从后端「天体简介接口」按 `name` 回填;并补上首次初始化失败的提示、返回太阳系时的刷新。
>
> **已确认决策**:
> - **build-then-apply,单一写入口**:`initEngine` 只建骨架(几何/模型/灯光),label 内容由新函数 `applyBodyMeta(bodies)` 按 `name` 回填——`id`/`title`/`intro` 一并写到天体锚点组的 `userData`:`title`/`intro` 供 hover label 与聚焦 panel 显示;`id` 供聚焦点击时作请求体参数(聚焦取到的 `focusedEntity` 即锚点组,可直接读 `userData.id`)。该函数被 `onMounted`(首次)与 `onActivated`(刷新)**两处复用**。
> - **为什么不走「合并 config 再 initEngine」**:`userData` 是 import 期从 config **值拷贝**的,且 keep-alive 下 `initEngine` 不重建;刷新时改 config 无法回灌活动场景,故运行时真相源是 `userData`,只能直接写。
> - **生命周期**:`onMounted` 先 fetch 再 build(fetch 快、失败就不白加载 9 个模型),`applyBodyMeta` 后再置 `isEngineReady=true`(无空 label 闪现);`onActivated` 用 `if (isEngineReady)` 守卫只在**二次进入**刷新(首次激活时引擎未就绪、自动跳过,不双拉)。
> - **失败语义(非对称)**:首次(onMounted)fetch/build/apply 任一失败 → 弹提示、`isEngineReady` 保持 false、引擎不启动;刷新(onActivated)失败 → 保留旧数据、引擎照常跑、仅 `console` 记一笔。
> - **报错提示**:新建 `SceneErrorHint.vue`,**背景/模糊/圆角与 `KeyboardHint` 一致**(`rgba(10,22,34,0.25)` + `blur(4px)`),仅描边/文字换暖色暗示「错误」;信息型、不带重试按钮。
>
> **触及文件**:`lib/request.js`(前置修正)、`api/planet.js`、`three/sun.js`、`three/planet/config.js`、`three/planet/planet.js`、**新建** `three/applyBodyMeta.js`、**新建** `components/SceneErrorHint.vue`、`pages/SolarCanvas.vue`。

---

## 0. 数据流总览

```
后端 /api/v1/planet/list
  → request.js 响应拦截器:解包到 data、非 200 reject
    → api/planet.js getList()  ── resolve 为 { planets: [...] }
      → SolarCanvas onMounted/onActivated
        → applyBodyMeta(planets)  ── 按 name 匹配
            └─ id/title/intro → sunAxis.userData / planet.root.userData
                                 (title/intro 供 hover label 与聚焦 panel;id 供聚焦点击发请求)
```

---

## 1. 前置修正 · `src/lib/request.js`

两处改动:**1.1** 请求拦截器的运行时 bug(必须,否则请求发不出);**1.2** 把默认导出的实例类型收窄为 `HttpClient`(消除各 api 函数 `@return` 的类型告警)。响应拦截器**已经正确**(解包 `data`、非 200 reject),不用动。

### 1.1 请求拦截器必须 `return config`(运行时)

```js
// 改前(返回 undefined,会让请求的 config 变成 undefined,请求无法发出)
axiosInstance.interceptors.request.use((config) => {})

// 改后(务必 return config)
axiosInstance.interceptors.request.use((config) => {
    // 后续若有 token 校验:在此往 config.headers 注入后再 return config
    return config
})
```

> 接入后,`getList()` 的 resolve 值是响应拦截器返回的 `payload.data`,即 `{ planets: [...] }`(不是完整 AxiosResponse、也不是 `response.data`)。下文据此取 `planets`。

### 1.2 默认导出收窄为 `HttpClient`(类型)

**为什么**:axios 静态类型里 `.get()` 恒返回 `Promise<AxiosResponse<any>>`(完整响应对象),但响应拦截器在运行时把它解包成了 `payload.data`。类型检查器看不见拦截器,仍以为 `.get()` 出的是 `AxiosResponse`,于是与各 api 函数 `@return` 标的 `Promise<{...}>` 对不上,报 `Returned expression type ... is not assignable`。修法:既然「解包成 data」是这个实例所有方法的统一行为,就在导出处把方法返回类型统一收窄为 `Promise<any>`,最终数据类型交由各 api 函数自己的 `@return` 去标。

拦截器照旧不动,仅在文件末尾加 `HttpClient` typedef 并把默认导出收窄:

```js
/**
 * 经响应拦截器解包后的axios实例: 各请求方法直接resolve出后端payload.data(而非AxiosResponse整体)
 * 此处把返回类型收窄为Promise<any>,最终数据类型交由各API函数自己的@return标注
 * @typedef {Object} HttpClient
 * @property {(url: String, config?: import('axios').AxiosRequestConfig) => Promise<any>} get
 * @property {(url: String, data?: any, config?: import('axios').AxiosRequestConfig) => Promise<any>} post
 * @property {(url: String, data?: any, config?: import('axios').AxiosRequestConfig) => Promise<any>} put
 * @property {(url: String, config?: import('axios').AxiosRequestConfig) => Promise<any>} delete
 * @property {(url: String, data?: any, config?: import('axios').AxiosRequestConfig) => Promise<any>} patch
 * */

export default /** @type {HttpClient} */ (axiosInstance)
```

> - 收窄后 `.get()` 在函数体内是 `Promise<any>`,`any` 可赋给任何类型,故 `api/planet.js` 里 `return axiosInstance.get(uri)` 不再报错,`@return` 成为该接口类型的权威标注。
> - 取舍:此法换不来「IDE 校验 `@return` 与 `.get()` 实际形状是否一致」——但该校验本就拿不到(真实形状由运行时拦截器 + 后端 payload 决定);`Promise<any>` + 权威 `@return` 已是最诚实的表达。
> - 副作用:别处若 `import` 该默认导出后去碰 `.interceptors`/`.defaults` 会丢类型提示;api 层只调 `.get/.post`,无影响。
> - 方法列表按需增减:现仅用 `get`,留 `post/put/delete/patch` 给后续接口铺路,嫌多可只留 `get`。

---

## 2. `src/api/planet.js` · 导出 `getList`

```js
import axiosInstance from "@/lib/request.js";

/**
 * 本函数拉取天体简介列表
 * Tips: 经 request.js 响应拦截器解包,resolve 值为后端 data 部分,即 { planets: [...] };
 *       非 200 业务码 / 网络错误会 reject
 * @return {Promise<{planets: Array<import('@/three/applyBodyMeta.js').BodyMeta>}>}
 * */
export function getList() {
    const uri = "/v1/planet/list"
    return axiosInstance.get(uri)
}
```

改动:
- **加 `export`**(原文件无导出,`SolarCanvas` 需要具名引入)。
- **uri 保持 `/v1/planet/list`**(原样、不带 `/api`)。
- **`@return` 无需 cast**:得益于 §1.2 把实例收窄为 `HttpClient`(`.get()` → `Promise<any>`),此处直接 `return axiosInstance.get(uri)` 即可,`@return` 标的 `Promise<{planets}>` 不再报 not-assignable。

> 约定(已定):`/api` 已写进 `.env` 的 baseURL(`VITE_API_BASE_URL=http://192.168.1.151:4060/api`),故各 api 函数的 uri 一律相对 `/api` 根来写、不再重复 `/api`。拼接后正好是:
> `http://192.168.1.151:4060/api` + `/v1/planet/list` = `http://192.168.1.151:4060/api/v1/planet/list`。

---

## 3. step1 · 删写死字段 + 导出 sun config

### 3.1 `src/three/sun.js`

**① 导出 `config`、删掉写死的 `id`**(`config` 声明处):

```js
// 改前
const config = {
    id: 1,
    name: 'Sun',
    groupName: 'sunRoot',
    // ...

// 改后(加 export 供 applyBodyMeta 读 config.name 匹配;删掉 id 行 —— 天体 id 改由 applyBodyMeta 写到锚点组 userData)
export const config = {
    name: 'Sun',
    groupName: 'sunRoot',
    // ...
```

**② `label` 只留 `bodyType`**:

```js
// 改前
    label: {
        bodyType: bodyType.sun,
        title: '太阳',
        intro: '一段太阳的介绍文字'
    }

// 改后
    label: {
        bodyType: bodyType.sun,
    }
```

**③ 删掉 `sunAxis` 上 `title`/`intro` 的 userData 赋值**(保留 `bodyType`/`hoverRadius`):

```js
// 改前
sunAxis.userData.bodyType = config.label.bodyType
sunAxis.userData.title = config.label.title
sunAxis.userData.intro = config.label.intro
sunAxis.userData.hoverRadius = config.hover.radius

// 改后
sunAxis.userData.bodyType = config.label.bodyType
sunAxis.userData.hoverRadius = config.hover.radius
```

> 顶部那段 JSDoc 里 `label.title/intro`、`id` 的描述可顺手清理(非必须,不影响运行)。

### 3.2 `src/three/planet/config.js`

数组里**每个**行星元素:删 `id` 行、删 `label.title`/`label.intro`(保留 `bodyType`)。以水星为例,其余 7 个(Venus/Earth/Mars/Jupiter/Saturn/Uranus/Neptune)同样处理:

```js
// 改前
    {
        id: 2,
        name: 'Mercury',
        // ...
        label: {
            bodyType: bodyType.planet,
            title: '水星',
            intro: '一段水星的介绍文字',
        },
        // ...
    },

// 改后
    {
        name: 'Mercury',
        // ...
        label: {
            bodyType: bodyType.planet,
        },
        // ...
    },
```

> 顶部 typedef:`LabelConfig` 的 `title`/`intro` 可删(已不在 `config.label` 上);`PlanetConfig` 的 `id` 保留(运行时由后端回填)。

### 3.3 `src/three/planet/planet.js`

`createPlanet` 内删 `title`/`intro` 两行(保留 `bodyType`/`hoverRadius`):

```js
// 改前
    root.userData.bodyType = config.label.bodyType
    root.userData.title = config.label.title
    root.userData.intro = config.label.intro
    root.userData.hoverRadius = config.hover.radius

// 改后
    root.userData.bodyType = config.label.bodyType
    root.userData.hoverRadius = config.hover.radius
```

---

## 4. 新建 `src/three/applyBodyMeta.js`

```js
import {config as sunConfig, sunAxis} from "@/three/sun.js";
import {planets} from "@/three/planet/index.js";

/**
 * @typedef {Object} BodyMeta 后端返回的单个天体简介
 * @property {Number} id 天体id
 * @property {String} name 天体名称(与前端 config.name 对应,作为匹配键)
 * @property {String} title 天体label标题
 * @property {String} intro 天体label介绍
 * */

/**
 * 本函数把后端返回的天体简介按 name 回填到前端各天体的锚点组 userData 上:
 *      - title / intro → hover label 与聚焦 panel 的显示数据源
 *      - id → 聚焦点击天体时作为请求体参数(聚焦取到的 focusedEntity 即锚点组,可直接读 userData.id)
 * Tips: 后端 planets 含太阳(name 为 'Sun'),故太阳与行星一并参与匹配
 * Tips: 本函数为纯应用操作,可被 onMounted(首次)与 onActivated(刷新)复用
 * @param {Array<BodyMeta>} bodies 后端返回的 planets 数组
 * */
export function applyBodyMeta(bodies) {
    // 以 name 为键建立查找表
    const metaByName = new Map(bodies.map(meta => [meta.name, meta]))

    // 太阳:锚点组为 sunAxis
    applyMetaToBody(sunConfig.name, sunAxis, metaByName)

    // 行星:锚点组为 planet.root
    for (const planet of planets) {
        applyMetaToBody(planet.config.name, planet.root, metaByName)
    }
}

/**
 * 本函数把查找表中匹配到的简介写到单个天体锚点组的 userData 上
 * @param {String} name 天体名称(匹配键,来自前端 config.name)
 * @param {import('three').Group} anchorGroup 天体锚点组(id / title / intro 写至其 userData)
 * @param {Map<String, BodyMeta>} metaByName name → 简介 的查找表
 * */
function applyMetaToBody(name, anchorGroup, metaByName) {
    const meta = metaByName.get(name)
    // 后端未返回该天体(例如 name 对不上)→ 保留现状并告警,不写入
    if (meta === undefined) {
        console.warn(`未匹配到天体简介,已跳过: ${name}`)
        return
    }

    anchorGroup.userData.id = meta.id
    anchorGroup.userData.title = meta.title
    anchorGroup.userData.intro = meta.intro
}
```

> 依赖前提:`sun.js` 已 `export const config`(见 3.1);`sunAxis` 与 `planets` 原本就已导出。

---

## 5. 新建 `src/components/SceneErrorHint.vue`

风格对齐 `KeyboardHint`(同背景/模糊/圆角),仅描边与文字换暖色;居中显示(初始化失败时整屏为空,居中比底部更合适)。

```vue
<template>
    <Transition name="scene-error-fade">
        <div
            v-if="visible"
            class="scene-error-hint"
            role="alert"
        >
            <p class="text">太阳系场景加载失败,请刷新页面后重试</p>

            <button class="close" aria-label="关闭" @click="$emit('close')">
                <i class="iconfont icon-a-closeicon-close" aria-hidden="true"></i>
            </button>
        </div>
    </Transition>
</template>

<script setup>
defineOptions({
    name: 'SceneErrorHint',
})

defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
})

defineEmits(['close'])
</script>

<style scoped>
.scene-error-hint {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 8px;
    /* 背景 / 模糊与 KeyboardHint 一致(磨砂、些许透明) */
    background: rgba(10, 22, 34, 0.25);
    backdrop-filter: blur(4px);
    /* 描边换暖色,暗示「错误」,其余风格保持一致 */
    border: 1px solid rgba(255, 138, 128, 0.45);
    color: #FFD9D4;
    font-size: 14px;
    line-height: 1;
    user-select: none;
}

.scene-error-hint .text {
    margin: 0;
}

.scene-error-hint .close {
    background: transparent;
    border: none;
    color: inherit;
    opacity: 0.6;
    line-height: 1;
    padding: 0 2px;
    /* 图标在按钮内垂直居中 */
    display: inline-flex;
    align-items: center;
}

.scene-error-hint .close:hover {
    opacity: 1;
}

.scene-error-hint .close .icon-a-closeicon-close {
    /* 覆盖 .iconfont 自带的 16px */
    font-size: 16px;
    cursor: url("@/assets/cursors/cursor-pointer.png") 12 0, pointer;
}

.scene-error-fade-enter-active, .scene-error-fade-leave-active {
    transition: opacity 0.4s ease;
}

.scene-error-fade-enter-from, .scene-error-fade-leave-to {
    opacity: 0;
}
</style>
```

> - 由父组件(`SolarCanvas`)通过 `:visible` 控制显隐、`@close` 收回;组件内 `Transition` 负责淡入淡出(与 `KeyboardHint` 同套路)。
> - 暖色描边图标用的是已存在的 `icon-a-closeicon-close`;若你的 iconfont 里有警告图标,可自行在文字前加一个,这里不依赖未知图标。
> - 文案固定、无重试按钮(信息型)。将来要重试再加。

---

## 6. `src/pages/SolarCanvas.vue` · 接线

### 6.1 import 区 + 新增状态

```js
// 1) vue 增加 ref
import {onMounted, onBeforeUnmount, useTemplateRef, onActivated, onDeactivated, ref} from 'vue'

// 2) 新增三行 import
import {applyBodyMeta} from "@/three/applyBodyMeta.js";
import {getList} from "@/api/planet.js";
import SceneErrorHint from "@/components/SceneErrorHint.vue";
```

在其它 `let isActive = false` 等状态附近,加一个响应式标志:

```js
/**
 * @type {import('vue').Ref<Boolean>} 首次初始化是否失败(驱动错误提示显隐)
 * */
const hasInitError = ref(false)
```

### 6.2 改写 `onMounted`(fetch → build → apply → 监听 → 就绪)

```js
onMounted(async () => {
    try {
        // 1. 拉取天体简介(拦截器已解包+对非200 reject;失败 fail-fast,不进入昂贵的模型加载)
        const {planets} = await getList()

        // 2. 构建3D场景骨架
        const engine = await initEngine(containerRef.value, hoverStore, focusStore)
        if (isUnmounted) {
            engine.dispose()
            return
        }
        dispose = engine.dispose
        canvas = engine.canvas

        // 3. 把简介按 name 回填到已建好的场景
        applyBodyMeta(planets)

        // 4. 绑定 canvas 的 pointer 事件
        canvas.addEventListener('pointermove', onPointerMove)
        canvas.addEventListener('pointerenter', onPointerEnter)
        canvas.addEventListener('pointerleave', onPointerLeave)
        canvas.addEventListener('pointerdown', onPointerDown)
        canvas.addEventListener('pointerup', onPointerUp)

        // 5. 引擎就绪,按当前激活状态决定是否启动动画循环
        isEngineReady = true
        syncEngineRunning()
    } catch (err) {
        // 首次初始化失败(拉取/构建/回填任一环)→ 提示用户;isEngineReady 保持 false,引擎不启动
        console.error('太阳系场景初始化失败: ', err)
        hasInitError.value = true
    }
})
```

### 6.3 新增 `refreshBodyMeta` + 在 `onActivated` 调用

在 `onActivated` 上方新增刷新函数:

```js
/**
 * 本函数在返回太阳系时刷新天体简介:重新拉取并按 name 重灌活动场景。
 * 刷新失败不影响现有场景:保留旧数据、引擎照常运行,仅记录日志。
 * */
async function refreshBodyMeta() {
    try {
        const {planets} = await getList()
        applyBodyMeta(planets)
    } catch (err) {
        console.error('刷新天体简介失败,保留现有内容: ', err)
    }
}
```

`onActivated` 末尾加刷新(用 `isEngineReady` 守卫,首次激活时引擎未就绪、自动跳过,不双拉):

```js
onActivated(() => {
    isActive = true
    syncEngineRunning()

    // 已就绪(即二次进入)才刷新;首次激活由 onMounted 负责首次拉取
    if (isEngineReady) {
        refreshBodyMeta()
    }
})
```

> `onDeactivated` / `onBeforeUnmount` 不变。

### 6.4 模板挂载错误提示

```html
        <KeyboardHint></KeyboardHint>
        <SceneErrorHint :visible="hasInitError" @close="hasInitError = false"></SceneErrorHint>
```

---

## 7. 验证

- [ ] **前置**:`request.js` 请求拦截器已 `return config`、默认导出已收窄为 `HttpClient`(api 层 `@return` 无 not-assignable 告警);`getList` 已 `export`、uri 为 `/v1/planet/list`(不带 `/api`,因 baseURL 已含);拼出的完整 URL 正好是 `http://192.168.1.151:4060/api/v1/planet/list`。
- [ ] **首次进入正常**:太阳/水星 hover 出来的是后端文案(太阳「操作系统」、水星「数据库」),其余天体为「暂无」;无「空 label 闪一下」。
- [ ] **失败提示**:把后端停掉(或 uri 改错)再进太阳系 → 居中弹出 `SceneErrorHint`、3D 不启动;点关闭可收回;风格与 `KeyboardHint` 一致(磨砂半透),仅描边/文字偏暖。
- [ ] **刷新生效**:进入太阳系 → 去文章页 → 后端改某天体 title/intro → 返回太阳系,hover 该天体显示新文案(无需整页刷新)。
- [ ] **刷新失败不破坏**:在文章页停掉后端 → 返回太阳系,场景照常运行、显示旧文案,仅 console 有一条告警。
- [ ] **不双拉**:首次进入太阳系,Network 里 `planet/list` 只发**一次**(onActivated 因 `isEngineReady` 尚 false 跳过)。
- [ ] **id 已回填**:断点/日志看 `planet.root.userData.id` 与 `sunAxis.userData.id` 为后端值(供后续聚焦点击发请求用)。
- [ ] **无残留**:全项目搜不到写死的 `title: '太阳'` / `intro: '一段…介绍文字'`;`createPlanet`、`sunAxis` 不再赋 `userData.title/intro`。

---

## 8. 备注

- **id 的去处**:写到锚点组 `userData.id`(与 title/intro 同处)。依据:聚焦功能点击天体后,`focusStore.focusedEntity` 存的就是锚点组、其 `panelText` 已在读 `userData.title/intro`;故聚焦点击发请求时 `focusedEntity.userData.id` 可直接取用,无需由对象反查 config。
- **业务码已集中处理**:非 200 由 `request.js` 响应拦截器统一 reject,组件层不再各自判码——后续新接口沿用这套即可。
- **命名可调**:`applyBodyMeta` / `SceneErrorHint` / `hasInitError` 如不合口味可改,改动范围已在上面各处标清。
- 本项落地后,memory `project_solarcanvas_keepalive_lifecycle` 的「引擎三段式 / 新增副作用挂激活钩子」约束依旧适用:`applyBodyMeta` 的刷新正是挂在 `onActivated` 上的范例。