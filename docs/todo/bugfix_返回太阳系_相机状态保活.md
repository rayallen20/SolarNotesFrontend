# Bugfix · 返回太阳系页相机偏移 + 卡顿(keep-alive 保活)

> **现象**:从 `ArticleReader` 点 `HeaderBar` 的"返回太阳系"回到 `SolarCanvas` 时:① 聚焦状态保留、但天体在屏幕上偏移;② 回来时卡一下。
>
> **根因(同一个)**:`SolarCanvas` 在 `onBeforeUnmount` 里 `dispose()` 整套引擎、回来又 `initEngine()` 全量重建。
> - `camera` 是模块单例、位置跨导航**保留**;但 `controls` 被 `dispose` 掉、回来 `createOrbitControls` 把 `target` 重置回原点并 `controls.update()` → 相机被重新指向原点 → 聚焦的天体偏移(症状①)。
> - `dispose` 释放了全部 GL 资源、回来 `initEngine` 重新加载 EXR/PMREM/天空球/行星模型 + 重建 composers/controls → 这一下重建就是卡顿(症状②)。
>
> **解法(方案 A)**:用框架的 `<keep-alive>` 保活 `SolarCanvas`,导航离开 = **暂停**(停 RAF,保留场景/相机/控制器),回来 = **恢复**。不再 dispose/重建 → 两症状同消。
>
> **触及 4 个文件**:`App.vue`(keep-alive)、`three/engine.js`(拆出 resume/pause)、`pages/SolarCanvas.vue`(生命周期接线)、`composables/useKeyboardFocusNav.js`(键盘监听改挂激活/失活)。

---

## 为什么是 4 个文件而不是 1 个

- **必须暂停 RAF(不能只 keep-alive 让它后台空跑)**:keep-alive 失活时组件 DOM 被移到文档外,canvas `clientHeight` 变 0。动画循环里的 `tickMinScreenSize`(`minScreenSize.js:29,43,48-49`)会算出 `11 / 0 = Infinity`,把所有非聚焦行星强制放大到 `MAX_BOOST`;同时还在对一张看不见的画布跑全套 bloom 渲染,纯浪费 GPU。故离开要 `pauseEngine()`。
- **必须改键盘 composable**:keep-alive 下导航离开走的是 `onDeactivated`,**不再触发 `onBeforeUnmount`**。`useKeyboardFocusNav` 的 `window` keydown 监听若仍挂在 `onBeforeUnmount` 卸载,就会在你读文章时**继续生效**(←/→/ESC 操作隐藏的太阳系)。改挂 `onActivated/onDeactivated` 即可只在太阳系页显示期间生效。
- **canvas 上的 pointer 监听无需改**:画布失活时脱离文档、不会触发 pointer 事件,天然只在显示期间有效。只有 `window` 级监听(keydown)需要按激活态管理。

---

## 1. `src/App.vue` —— 套 keep-alive

**模板**整段替换:

```vue
<template>
    <div class="app">
        <RouterView v-slot="{ Component }">
            <keep-alive include="SolarCanvas">
                <component :is="Component"></component>
            </keep-alive>
        </RouterView>
    </div>
</template>
```

> `include="SolarCanvas"` 匹配 `SolarCanvas.vue` 里的 `defineOptions({name:'SolarCanvas'})`,**只保活太阳系页**;`ArticleReader` 不在 include 内,仍按原样 mount/unmount(每次进文章页都重新渲染,符合预期)。

---

## 2. `src/three/engine.js` —— 把"运行"从"构建"里拆出来

### 2.1 `initEngine`:删掉"步骤 7/8"(监听 resize + 启动动画循环)

把这段(原 104-109 行附近):

```js
        // 6.3 为外行星设置补光图层
        markOuterPlanetsLayer()

        // 7. 监听视口大小变化
        window.addEventListener('resize', onWindowResize)

        // 8. 启动动画循环
        startAnimation()
    } catch (err) {
```

改成:

```js
        // 6.3 为外行星设置补光图层
        markOuterPlanetsLayer()
    } catch (err) {
```

同时把 `initEngine` 函数头 JSDoc 里的这两行删掉(它俩已移到 `resumeEngine`):

```js
 * 7. 监听视口大小变化
 * 8. 启动动画循环
```

### 2.2 `startAnimation`:删掉每帧的遗留调试打印

把(原 177-180 行附近):

```js
    // 8. 渲染辉光效果
    renderBloomFrame()

    console.log(camera.position)
}
```

改成:

```js
    // 8. 渲染辉光效果
    renderBloomFrame()
}
```

### 2.3 新增 `resumeEngine` / `pauseEngine`(放在 `startAnimation` 之后、`dispose` 之前)

```js
/**
 * 本函数用于恢复(或首次启动)引擎运行:
 * 1. 同步一次视口尺寸(防止暂停期间视口发生变化导致画面拉伸)
 * 2. 注册视口大小变化监听
 * 3. 启动动画循环
 * Tips: 幂等 —— 动画循环已在运行时直接返回,避免重复调度requestAnimationFrame
 * */
export function resumeEngine() {
    if (rafId !== null) {
        return
    }

    onWindowResize()
    window.addEventListener('resize', onWindowResize)
    startAnimation()
}

/**
 * 本函数用于暂停引擎运行(离开太阳系页、进入文章页时调用):
 * 1. 注销视口大小变化监听
 * 2. 停止动画循环
 * Tips: 仅停止"运行",不销毁场景/相机/控制器/渲染器,以便resumeEngine()能从原状态无缝继续
 * */
export function pauseEngine() {
    window.removeEventListener('resize', onWindowResize)

    if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
    }
}
```

### 2.4 `dispose`:改为复用 `pauseEngine`(仅在真正卸载时调用)

整个 `dispose` 函数(原 182-219 行)替换为:

```js
/**
 * 本函数用于彻底销毁3D场景(仅在组件真正卸载时调用):
 * 1. 暂停引擎(注销视口监听 + 停止动画循环)
 * 2. 销毁轨道控制器
 * 3. 销毁后期处理管线
 * 4. 销毁渲染器
 * 5. 复位悬停状态机的引用
 * 6. 复位聚焦状态机的引用
 * */
function dispose () {
    // 1. 暂停引擎(注销视口监听 + 停止动画循环)
    pauseEngine()

    // 2. 销毁轨道控制器
    if (controls !== null) {
        controls.dispose()
        controls = null
    }

    // 3. 销毁后期处理管线
    disposeBloom()

    // 4. 销毁渲染器
    renderer.dispose()

    // 5. 复位悬停状态机的引用
    hoverStore = null

    // 6. 复位聚焦状态机的引用
    focusStore = null
}
```

> 不变量:`resumeEngine` 只会在 `initEngine` 之后、`dispose` 之前被调用(由 `SolarCanvas` 的 `syncEngineRunning` 保证),故 `dispose` 后 `controls=null` 不会被 `resumeEngine` 触碰。

---

## 3. `src/pages/SolarCanvas.vue` —— 生命周期接线

### 3.1 import 调整

```js
import {onMounted, onUnmounted, onActivated, onDeactivated, useTemplateRef} from 'vue'
```

```js
import {initEngine, resumeEngine, pauseEngine} from "@/three/engine.js";
```

### 3.2 新增两个标量(放在 `isUnmounted` 声明之后)

```js
/**
 * @type {Boolean} 标识引擎是否已构建完成(onMounted中的initEngine是否已resolve)
 * */
let isEngineReady = false

/**
 * @type {Boolean} 标识组件当前是否处于激活态(被keep-alive显示中)
 * */
let isActive = false
```

### 3.3 新增 `syncEngineRunning`(放在 `onPointerUp` 之后、`onMounted` 之前)

```js
/**
 * 本函数按"引擎已就绪 且 组件处于激活态"为条件,同步引擎的运行/暂停:
 *      - 就绪 且 激活: 恢复引擎(启动动画循环)
 *      - 就绪 但 未激活: 暂停引擎(停止动画循环,但保留场景)
 *      - 未就绪: 不操作(待onMounted的initEngine完成后,由其再次调用本函数)
 * Tips: resumeEngine/pauseEngine均幂等,故本函数可被多个生命周期钩子安全地重复调用
 * */
function syncEngineRunning() {
    if (!isEngineReady) {
        return
    }

    if (isActive) {
        resumeEngine()
    } else {
        pauseEngine()
    }
}
```

### 3.4 替换 `onMounted` + `onBeforeUnmount` 这两个钩子为下面 4 个钩子

把原来的 `onMounted(async () => {...})` 与 `onBeforeUnmount(() => {...})` 整体替换为:

```js
onMounted(async () => {
    const engine = await initEngine(containerRef.value, hoverStore, focusStore)
    if (isUnmounted) {
        engine.dispose()
        return
    }

    dispose = engine.dispose
    canvas = engine.canvas

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerenter', onPointerEnter)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)

    // 引擎构建完成,按当前激活态决定是否启动动画循环
    isEngineReady = true
    syncEngineRunning()
})

onActivated(() => {
    isActive = true
    syncEngineRunning()
})

onDeactivated(() => {
    isActive = false
    syncEngineRunning()
})

onUnmounted(() => {
    isUnmounted = true
    isActive = false

    if (canvas !== null) {
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerenter', onPointerEnter)
        canvas.removeEventListener('pointerleave', onPointerLeave)
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointerup', onPointerUp)
    }

    if (dispose !== null) {
        dispose()
    }
})
```

> 时序(关键的异步竞态都已覆盖):
> - 首次进入:`onActivated`(isActive=true,但 ready=false→跳过)→ `initEngine` resolve → ready=true、`syncEngineRunning()` → resume。开始渲染。
> - 去文章页:`onDeactivated`(isActive=false)→ pause。停。
> - 回太阳系:`onActivated`(isActive=true)→ resume。续。
> - 首屏加载途中就被切走(极端):resolve 后 `syncEngineRunning` 见 isActive=false → pause,不会后台空跑。
> - `useKeyboardFocusNav()` 调用保持在 `<script setup>` 末尾原位不动(它内部已改为挂激活/失活,见第 4 节)。

---

## 4. `src/composables/useKeyboardFocusNav.js` —— 键盘监听改挂激活/失活

### 4.1 import

```js
import {onActivated, onDeactivated} from "vue";
```

### 4.2 `useKeyboardFocusNav`(原 67-70 行)

```js
export function useKeyboardFocusNav() {
    onActivated(() => window.addEventListener('keydown', onKeydown))
    onDeactivated(() => window.removeEventListener('keydown', onKeydown))
}
```

> 这样 keydown 监听只在太阳系页显示期间存在;进文章页(SolarCanvas 失活)即注销,←/→/ESC 不再误触隐藏的太阳系。

---

## 5. 验证

**原始两个 bug:**
- [ ] 聚焦某行星 → 进文章页 → 返回:该行星在屏幕上的位置/取景与离开时**完全一致**,无偏移。
- [ ] 返回太阳系**不卡**(无重建)。

**保活引入的新点(务必一并验):**
- [ ] 在文章页按 ←/→/ESC:太阳系的聚焦状态**不发生变化**(keydown 监听已随失活注销)。
- [ ] 在文章页期间太阳系引擎**确实暂停**:可临时在 `pauseEngine`/`resumeEngine` 各加一行 `console.log` 确认成对触发(验证后删掉);或用 DevTools Performance 看进文章页后无渲染帧。
- [ ] 在文章页时缩放浏览器窗口 → 返回:画布尺寸与新视口匹配不拉伸(`resumeEngine` 里 `onWindowResize()` 已兜底)。
- [ ] 反复多次"进文章页→返回":无累积卡顿、无内存增长(印证不再每次重建)。

**一个行为变化(需你确认是否接受):**
- [ ] `KeyboardHint`(以及 `SolarLabel`/`SolarPanel`)的 `onMounted` 现在**只在首次进入太阳系时跑一次**,返回时不再重跑。若 `KeyboardHint` 的提示横幅是"每次进太阳系都该出现一次",则需把它的 `onMounted` 逻辑改挂 `onActivated`(单独的小改动,本步先不动,看你实测后决定)。

---

## 6. 备注

- 这版把引擎生命周期理顺成三段:`initEngine`(构建一次)/ `resumeEngine`+`pauseEngine`(运行/暂停,随导航)/ `dispose`(真正卸载时销毁,keep-alive 下日常几乎不触发)。
- 之所以选 keep-alive 而非手写持久化引擎:保活由框架托管组件实例与 canvas DOM,省掉手动搬运 canvas、手动 init-guard,出错面更小。
- 关联:[[feedback_per_step_todo_docs]](本文档照抄落地)、[[feedback_docs_only_edits]](src 由你落地)。
