# Label 文字接入 — 淡出期间内容快照

> **前置**:
> - [阶段 8 投射检测+悬停状态机迁移设计](../design/投射检测与悬停状态机迁移设计.md)
> - [屏幕投影半径计算偏差_方案A实施](./屏幕投影半径计算偏差_方案A实施.md)(其中 §1.4 提到本工作:`labelText` 通过 `activeEntity = anchor` 重构后**已经能在 store 层算出正确文本**,只差 ContentLayer 模板的消费)
>
> **范围**:把 `SolarLabel` → `ContentLayer` 内的 `h2` / `p` 接到 `hoverStore.labelText`,并通过**本地快照模式**保证 label 淡出动画(0.5s)期间文字保持稳定,而不是随 `activeEntity` 变 `null` 而立即清空。

---

## 1. 背景

经过阶段 8 的"activeEntity 改 anchor"重构后:

- `stores/hover.js:159-169` 的 `labelText` computed **已经在 store 层就绪**:`activeEntity` 现在是 anchor(`sunAxis` / `planet.root`),anchor 上挂有 `title` / `intro`,computed 能直接读到正确的文本
- 但 `ContentLayer.vue` 模板里的 `<h2>` 与 `<p>` 仍然是硬编码占位文本(`"网络安全管理"` / `"150 字之内的内容..."`)

阶段 8 的最后一块拼图就是把这两个 DOM 节点接上 store,完成"hover 一颗天体 → 看到该天体的 title 与 intro"这条视觉反馈链路。

直接绑定 `{{ hoverStore.labelText?.title }}` 行不行?**能跑,但有 UX 瑕疵**——见 §3。

---

## 2. 设计目标

| 触发场景 | 期望行为 |
|---|---|
| 悬停某颗天体(进入 body 阶段) | `h2` / `p` 显示该天体的 title / intro |
| 不松开地从天体 A 划到天体 B(body → body 切换) | label 容器保持显示,内容**立即**切换到 B 的 title / intro,无过渡感 |
| 离开天体(进入 idle 阶段)→ label 开始淡出(opacity 1 → 0,0.5s) | **淡出期间文字保持上一颗天体的内容,与 opacity 一起渐隐**,而不是文字先消失、容器再淡掉 |
| 淡出结束后,再次悬停新天体 | 新天体的 title / intro 显示出来,label 重新淡入 |

---

## 3. 关键设计:为什么不能直接绑定,而要做本地快照

### 3.1 直接绑定的问题

如果模板直接写:

```vue
<h2>{{ hoverStore.labelText?.title ?? '' }}</h2>
<p>{{ hoverStore.labelText?.intro ?? '' }}</p>
```

时序如下(以"离开天体"为例):

1. 用户鼠标移出 Earth → tickHover 走到 `handleBody` 的"未命中 + 距离不在粘滞环"分支 → `store.enterIdle()`
2. `enterIdle()`:`phase = idle`、`activeEntity = null`
3. `labelText` computed 重算 → `null`(因为 `activeEntity` 是 null)
4. `shouldShowLabel` computed 重算 → `false`
5. `SolarLabel` 模板上的 `:class="{'is-visible': shouldShowLabel}"` 移除 `.is-visible` → CSS 触发 `opacity: 1 → 0` 的 0.5s 过渡
6. **与此同时**,`ContentLayer` 的 `h2` / `p` 因为 `labelText` 变 null,内容立刻变成空字符串

**视觉效果**:`opacity` 还在 1 但内容已经空了 → label 容器**先变空白**,然后再淡掉 → 双重消失感,显得不连贯。

### 3.2 本地快照如何修复

在 `ContentLayer` 内部维护一个 `labelTextSnapshot` ref,用 `watch` 监听 `hoverStore.labelText`:

- `labelText` 变为**非 null**(进入 body / sticky / label)→ 同步到 snapshot
- `labelText` 变为 **null**(进入 idle)→ snapshot **不更新**,继续持有上一帧的值

模板绑定 snapshot 而不是直读 `labelText`。

效果:
- 淡出期间 `labelText` 是 null,但 snapshot 仍是"地球 / ..." → `h2` / `p` 内容保持
- CSS 单独管 opacity → 文字"陪着"opacity 一起淡掉
- 用户感受:label 整体在淡出,**没有内容先消失的瑕疵**

> 这个设计的核心是:**让 DOM 文本的生命周期跟随视觉(opacity)的生命周期,而不是跟随数据(activeEntity)的生命周期**。

---

## 4. 实现(完整的 `ContentLayer.vue`)

```vue
<template>
    <div class="content-layer">
        <!-- 内容区域开始 -->
        <div class="content">
            <h2>{{ labelTextSnapshot?.title ?? '' }}</h2>
            <div class="cut-off-line"></div>
            <p>{{ labelTextSnapshot?.intro ?? '' }}</p>
        </div>
        <!-- 内容区域结束 -->

        <!-- 底部按钮区域开始 -->
        <LuminousAction :type="ActionType.button" class="bottom-button"></LuminousAction>
        <!-- 底部按钮区域结束 -->
    </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import LuminousAction from "@/components/common/LuminousAction.vue"
import { ActionType } from "@/lib/enum.js"
import { useHoverStore } from "@/stores/hover.js"

defineOptions({
    name: 'ContentLayer',
})

/**
 * @type {import('@/stores/hover.js').HoverStore} 悬停状态机的 store 实例
 * */
const hoverStore = useHoverStore()

/**
 * @type {import('vue').Ref<import('@/stores/hover.js').LabelText|null>} label 文本本地快照
 *
 * 设计目的:让 label 淡出动画期间(opacity 1→0,共 0.5s)文字保持不变,而不是随
 * activeEntity 变 null 而立即清空 —— 否则会出现"文字先消失、容器再淡掉"的双重消失感。
 *
 * 更新规则:
 *     - hoverStore.labelText 变为非 null(进入 body / sticky / label)→ 同步到 snapshot
 *     - hoverStore.labelText 变为 null(进入 idle)→ snapshot **不更新**,
 *       继续持有上一颗天体的内容,直到下一次有非 null 值到来
 *
 * 详细设计与时序分析见 docs/todo/Label文字接入_淡出快照.md
 * */
const labelTextSnapshot = ref(null)

watch(
    () => hoverStore.labelText,
    (newVal) => {
        if (newVal !== null) {
            labelTextSnapshot.value = newVal
        }
    },
    { immediate: true }
)
</script>

<style scoped>
/* CSS 一行不动,保持原状 */

/* 内容层开始 */
.content-layer {
    position: absolute;
    inset: 0;
    /* 内容层在最上方 可以遮挡边框层和装饰层 */
    z-index: 30;
}
/* 内容层结束 */

/* 内容区域开始 */
.content-layer .content {
    position: absolute;
    width: 383px;
    height: 200px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    color: #ffffff;
}

.content-layer .content h2 {
    margin-bottom: 10px;
    font-size: 20px;
    font-style: normal;
    font-weight: 900;
    line-height: 20px;
    letter-spacing: 1px;
}

.content-layer .content .cut-off-line {
    margin-bottom: 10px;
    width: 60px;
    height: 3px;
    /* 从左到右 由暗到亮 */
    background: linear-gradient(
        90deg,
        rgba(32, 198, 216, 0.4) 0%,
        rgba(32, 198, 216, 1) 100%
    );
    clip-path: polygon(
        6px 0,
        60px 0,
        54px 3px,
        0 3px
    );
}

.content-layer .content p {
    width: 100%;
    height: 154px;
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 22px;
    letter-spacing: 1px;
}

.content-layer .bottom-button {
    position: absolute;
    left: calc(var(--btn-center-x) - var(--btn-width) / 2);
    bottom: 0;
}
/* 内容区域结束 */
</style>
```

**模板改动只有 2 处**:`<h2>` 和 `<p>` 的内容从硬编码占位文字改为 `labelTextSnapshot?.title / .intro`。

**script 改动**:
- 新增 `import { ref, watch } from 'vue'`
- 新增 `import { useHoverStore } from "@/stores/hover.js"`
- 新增 `hoverStore` / `labelTextSnapshot` / `watch` 三段

**CSS 完全不动**。

---

## 5. 时序分析(对照状态机几个关键节点)

| # | 时序节点 | `hoverStore.labelText` | `labelTextSnapshot` | DOM 表现 |
|---|---|---|---|---|
| 1 | 初始挂载,phase=idle | `null` | `null`(immediate 跑了一次,但 null 守卫不更新) | label 隐藏,`h2` / `p` 为空 |
| 2 | 鼠标悬停 Earth → phase=body | `{ title: '地球', intro: '...' }` | 更新为同值 | label 淡入(0.5s),显示"地球 / ..." |
| 3 | 鼠标快速划到 Mars → phase=body(切换 activeEntity) | `{ title: '火星', intro: '...' }` | 更新为火星 | label 保持显示,内容**立即**切换为"火星 / ..." |
| 4 | 鼠标移出 Mars → phase=idle | `null` | **保持"火星 / ..." 不动** | label 淡出(0.5s),期间一直显示"火星 / ..." |
| 5 | 淡出完成,继续 idle | `null` | 仍是"火星 / ..."(但视觉不可见) | label 完全隐藏(visibility: hidden + pointer-events: none) |
| 6 | 鼠标悬停 Jupiter → phase=body | `{ title: '木星', intro: '...' }` | 更新为木星 | label 淡入,显示"木星 / ..." |

**关键节点 #4 与 #5**:这两步对比 §3.1 直接绑定时的对应步骤,可以看出 snapshot 模式让"内容生命周期"与"opacity 生命周期"对齐,而不是与"`activeEntity` 生命周期"对齐。

---

## 6. 边缘情况

### 6.1 A → null → B 的快速切换(最复杂场景)

用户在 Earth 上 hover → 离开(label 开始淡出)→ **淡出未完成时**又快速划到 Mars,时序:

1. Earth → 离开:`labelText: 地球 → null`,snapshot 保持"地球",label 开始淡出(opacity 比如已经降到 0.5)
2. 划到 Mars(可能经过 sticky):`labelText: null → 火星`,snapshot 更新为"火星"
3. 同时 `shouldShowLabel: false → true`,`.is-visible` 被重新加上
4. opacity 从淡出的半路(0.5)反向往 1 走

**视觉效果**:label 看起来还没消失就**先变了文字(地球 → 火星),然后又重新淡入到完全可见**。

略有"瞬切"感,但**比"地球文字先消失再变火星"要好**——用户能感觉到 hover 焦点切换。

> 如果将来想做"交叉淡入淡出"(地球文字淡出 + 火星文字淡入,两层重叠),需要在 ContentLayer 里维护两份 snapshot + 两套 opacity 通道。**本次不必预先支持**——上面的简化版已经能覆盖 95% 的常规交互。

### 6.2 初始挂载,`labelText` 已经非 null

`watch` 的 `immediate: true` 让回调在挂载时立即跑一次。如果 SolarLabel 是路由切换后才挂载、而此时父组件的状态机已经处于 body 阶段(`activeEntity` 非 null),`labelText` 一开始就是有值的。`immediate` 让 snapshot 在挂载时就同步好,避免出现"挂载后第一帧 snapshot 还是 null,h2/p 空一帧"的视觉缺口。

### 6.3 `labelTextSnapshot` 的响应式粒度

`ref` 默认对 object 做 reactive 代理。`LabelText` 只有 `title` / `intro` 两个 string 字段,模板只用 `?.title` / `?.intro` 浅读,代理代价可忽略。**不需要换成 `shallowRef`**——除非将来 `LabelText` 字段变多,再视情况优化。

### 6.4 `LabelText` typedef 没 export 也能用 JSDoc 引用

`stores/hover.js:37-41` 的 `LabelText` typedef 没有 `export`,但 JSDoc 的 `import('@/stores/hover.js').LabelText` 这种 typeof 引用 IDE 仍能解析(typedef 在 JSDoc 层就是文件级"声明",不需要 export 也能被外部以路径方式引用)。所以 `ContentLayer.vue` 里的 `Ref<LabelText|null>` 注解不需要 `stores/hover.js` 额外导出任何东西。

---

## 7. 验证清单

改完跑起来,依次做这几件事:

- [ ] **基础显示**:悬停 Earth → label 显示"地球 / 一段地球的介绍文字"
- [ ] **遍历 9 颗天体**:悬停太阳和 8 颗行星,每颗都显示该天体的 title 与 intro
- [ ] **快速切换**:鼠标从 Earth 划到 Mars(不进入 idle)→ label 容器持续可见,内容立即从"地球..."切到"火星..."
- [ ] **淡出关键验证**:鼠标移出场景(进入 idle)→ label 淡出 0.5s 期间**文字保持上一颗天体的内容**(如果显示空字符串说明 snapshot 没生效,检查 watch 中的 null 守卫)
- [ ] **跨 idle 再 hover**:Earth → idle(等淡出完成)→ Jupiter → 看 Jupiter 的 title / intro 是否正确显示
- [ ] **快速划过 idle**(§6.1 边缘情况):Earth → 短暂经过空白区 → Mars,看交互是否符合 §6.1 描述
- [ ] 无 console 报错,无 `Cannot read property 'title' of null` 之类的异常

---

## 8. 与阶段 8 整体的关系

本工作是阶段 8 的**最后一块视觉拼图**:

| 阶段 8 子任务 | 状态 |
|---|---|
| 几何工具(rect / projection / pointer) | ✅ |
| raycaster 重写 | ✅ |
| Pinia store 建立 | ✅ |
| 状态机(tickHover 4-handler) | ✅ |
| SolarCanvas / SolarLabel 事件接入 | ✅ |
| 屏幕投影半径修复(去 `/2`、anchor 配置 hoverRadius) | ✅ |
| `activeEntity` 改 anchor + labelText 在 store 层算正确 | ✅ |
| **ContentLayer 接入 labelText + 淡出快照** | ⬜ **(本文档)** |

完成本工作后,**阶段 8 整体可以正式收尾**,进入阶段 9(点击聚焦 + 相机动画)。阶段 9 也会依赖 `activeEntity` —— 由于本阶段已经把它重构成了 anchor,阶段 9 直接读 `activeEntity` 拿到天体的 root group,可以省掉所有反查逻辑(详见 [屏幕投影半径计算偏差_方案A实施.md §5.4](./屏幕投影半径计算偏差_方案A实施.md))。

---

## 9. 风险与未尽事项

### 9.1 跨 idle 的"瞬切"感(§6.1)

如果实际测试发现 §6.1 的"地球文字突变成火星"的瞬切体验明显不舒服,可以**升级为交叉淡入淡出**:

- ContentLayer 内维护 `currentSnapshot` + `previousSnapshot`
- 切换天体时,`previousSnapshot` 拷贝旧的、`currentSnapshot` 写入新的
- 模板渲染两层,各自 opacity 反向过渡

**不在本次实施范围内**。先用简化版上线,看实际体验决定要不要升级。

### 9.2 LuminousAction 按钮的功能

ContentLayer 底部的 `<LuminousAction>` 按钮当前没接任何回调。这个按钮的点击行为属于阶段 9(点击聚焦)的范畴——届时绑定 `@click` 调 `focusOn(hoverStore.activeEntity)` 即可。**本次不动这个按钮**。

### 9.3 label 内容空字符串的视觉效果

阶段 9 之前,如果出现 `labelText` 一直是 null 的极端场景(例如某个 anchor 漏挂 `title` / `intro`),snapshot 会一直是 null,`h2` / `p` 会显示空字符串。届时 label 容器虽然可见,但内容为空。

不算严重 bug,但等阶段 9 来临之前如果发现某颗天体出现这种情况,可以在 `stores/hover.js:158-168` 的 `labelText` computed 内补一行 fallback:

```js
return {
    title: entity.userData.title ?? '(未命名天体)',
    intro: entity.userData.intro ?? '',
}
```

**本次不预先支持**——保持配置驱动的契约,漏配自己暴露。