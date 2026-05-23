# 路由跳转后页面不变 —— 全局缺少 `<router-view>`

> **现象**:点击 `panel/PanelList.vue:6` 的 `RouterLink`(`:to="{name: 'article'}"`)后,URL 确实变成 `/article`,但页面内容不变。
>
> **结论**:`RouterLink` 本身没问题;问题是**整个项目里没有任何 `<router-view>`**,匹配到的路由组件无处渲染。
>
> **本文档为延后处理项**:当前 `App.vue` 是为开发 panel UI 临时搭的脚手架,现在按正式结构修了就看不到 panel、没法继续调 UI。**待 panel UI 开发完成后**再按本文档修复。

---

## 1. 现象与复现

1. 当前停留在 `/`,页面显示 panel(脚手架状态)。
2. 点击 panel 里 `PanelList.vue:6` 的 `RouterLink` → 地址栏变为 `/article`。
3. 但页面没有切换到 `ArticleReader.vue`(`pages/ArticleReader.vue`,占位内容"目录+详情页面")。

---

## 2. 根本原因

`grep -rn "router-view\|RouterView" src` **返回空** —— 组件树里没有任何路由出口。vue-router 已安装(`main.js` 里 `app.use(router)`)、导航也成功(URL、`route.name` 都变了),但**没有 `<router-view>` 这个插槽**,`ArticleReader.vue` 就无处挂载,所以 DOM 永不更新。

### 2.1 完整因果链

1. `main.js`:`createApp(App).mount('#app')` —— **App.vue 是被 `createApp` 挂载的根组件**,渲染的是 `App.vue:1-6` 那段写死的 `<div class="app"><SolarPanel/></div>`。你看到的画面来自这里,**与路由无关**。
2. 点击 `RouterLink` → 导航成功 → vue-router 去找 `<router-view>` 准备塞入 `ArticleReader.vue`。
3. 树里没有 `<router-view>` → `ArticleReader.vue` 无处渲染 → 屏幕不变。根组件 App 继续渲染写死的 `<SolarPanel>`,它不依赖路由,导航到哪都不变。

### 2.2 `/` 看起来"正常"是个陷阱

`router/index.js:5-9` 把 `/` 映射到了 `component: App`,**自引用**:

```js
{ path: '/', component: App, name: 'index' }
```

App 既是 `createApp` 的根组件,又被注册为 `/` 的路由组件。`/` 上能看到内容,**不是因为路由生效,而是因为 App 作为根组件被直接渲染**。`/` 的路由其实同样失效,只是"根组件 = `/` 的路由组件",才造成路由在工作的错觉。`/article` 一点就露馅。

---

## 3. 为什么现在先不修

`App.vue` 目前是**临时脚手架**:`App.vue:3` 注释掉了 `<SolarCanvas>`、直接渲染 `<SolarPanel>`、`App.vue:21-26` 加了 `background: darkblue` 并挂着 `panel开发完成后记得删除` 的 TODO。这是为了**单独、直观地调 panel 的 UI**。

若现在就按 §4 改成正式结构,panel 会被收回到 `SolarCanvas` 页面里(还要先起 Three.js 场景),不利于单独调 UI。因此**先把 panel UI 收尾,再回来修路由**。在此期间 `/article` 点不动是预期行为(没出口),不是新 bug。

---

## 4. 修复方案(panel UI 完成后执行)

三处改动**必须同时完成**,详见 §4.4 的陷阱说明。

### 4.1 `App.vue` 只当路由外壳

```vue
<template>
    <router-view></router-view>
</template>

<script setup>
import '@/assets/reset.css'
import '@/assets/font.css'
import '@/assets/index.css'

defineOptions({ name: 'App' })
</script>
```

- 移除写死的 `<div class="app">` 包裹、`background: darkblue` 样式、以及 `SolarCanvas` / `SolarPanel` 两个 import。
- 保留三个全局 CSS import。

### 4.2 `router/index.js`:`/` 指向真正的页面 `SolarCanvas`

```js
const routes = [
    { path: '/',        name: 'index',   component: () => import('@/pages/SolarCanvas.vue') },
    { path: '/article', name: 'article', component: () => import('@/pages/ArticleReader.vue') },
]
```

- `/` 由 `component: App` 改为 `SolarCanvas`(解除自引用)。
- 顺带删除文件顶部不再需要的 `import App from "@/App.vue";`(`router/index.js:2`)。
- `/article` 那条无需改动。

### 4.3 `SolarPanel` 迁入 `SolarCanvas.vue`

`SolarCanvas.vue:4` 里 `<SolarLabel>` 已经在了,把 panel 也放进来即可(panel/label 都是太阳系页面的覆盖层,呼应"SolarCanvas 是页面、panel/label 是被它组合的覆盖组件"的结论):

```diff
 <template>
     <div class="solar-canvas">
         <div ref="container" class="canvas-container"></div>
         <SolarLabel></SolarLabel>
+        <SolarPanel></SolarPanel>
     </div>
 </template>
```
```diff
 import SolarLabel from "@/components/SolarLabel.vue";
+import SolarPanel from "@/components/SolarPanel.vue";
```

### 4.4 ⚠️ 必须同时改,不能只加 `<router-view>`

**不要只往 `App.vue` 加 `<router-view>` 而保留 `/` → `component: App`。** 否则在 `/` 上:根 App 的出口会再渲染出"被路由匹配的 App"(`matched[0]` 仍是 App),内层那个出口又没有子路由可渲染(`matched[1]` 为空)→ **页面空白**。所以"给 App 加出口"(§4.1)与"把 `/` 改成 SolarCanvas"(§4.2)是一对**绑定操作**。

---

## 5. 验证清单

- [ ] `grep -rn "router-view" src` 至少能在 `App.vue` 命中一处。
- [ ] 启动后 `/` 正常显示太阳系(canvas + label + panel)。
- [ ] 在 panel 中点击 `PanelList.vue` 的 `RouterLink` → URL 变 `/article` **且**页面切换到 `ArticleReader.vue`。
- [ ] 浏览器后退 → 回到 `/` 的太阳系页面。
- [ ] `App.vue` 中不再有写死的 `SolarCanvas` / `SolarPanel`、darkblue 背景与相关 TODO。
- [ ] `router/index.js` 不再 `import App`,`/` 指向 `SolarCanvas`。

---

## 6. 涉及文件一览

| 文件 | 当前状态 | 修复后 |
|---|---|---|
| `src/App.vue` | 写死 `<SolarPanel>`,无出口,脚手架(darkblue/TODO) | 仅 `<router-view>` + 全局 CSS import |
| `src/router/index.js` | `/` → `component: App`(自引用) | `/` → `SolarCanvas`;删除 `import App` |
| `src/pages/SolarCanvas.vue` | 含 canvas + `<SolarLabel>` | 再加入 `<SolarPanel>` |
| `src/components/panel/PanelList.vue` | `RouterLink` 正常,无需改 | 不变 |
| `src/pages/ArticleReader.vue` | 占位页面,无需改 | 不变 |
