# 目录接口接入 · Part 2 · 两个入口

> 本篇是「获取目录接口」接入的第 2 步:把进入文章页的**两个入口**接好。**前置:Part 1(异步目录核心)已落地**(`RequestStatus`、`api/catalogue.js`、`article` store 改造、`useCatalogueSync`、路由 `/article/:id?`、加载门等)。
>
> **本篇范围**
> - `LuminousAction` 加 `to` 属性:让 link 形态的跳转目标可由外部传入(默认仍指向文章页)。
> - `SolarPanel` 的 See More:书单非空才显示(`v-if`),点击带「该天体第 1 本书」的 id 跳转。
> - `PanelList` 书目链接:核对在 `/article/:id` 下跳转正确(预计无代码改动)。
>
> **已确认决策**
> - 「书单为空则不显示 See More」(Part 1 §11 提过、本应在书籍列表那步做)在此一并补上。
> - 路由**收紧**为必填 `/article/:id`(严谨方案),并把 `LuminousAction.to` 改为 link 必传以堵住缺参陷阱——详见 §4。
>
> **本篇触及文件**
> - 改:`src/components/common/LuminousAction.vue`、`src/components/SolarPanel.vue`
> - 核对(预计不改):`src/components/panel/PanelList.vue`
>
> **落地方式**:按 §1→§3 顺序照抄(先给 `LuminousAction` 加属性,再让 `SolarPanel` 用它);§5 自测。

---

## §0. 两个入口回顾

```
入口 A: PanelList 里的某本书 <RouterLink>
        :to="{name:'article', params:{id: book.id}}"      → /article/{book.id}
        (Part 1 已就绪,本篇仅核对)

入口 B: SolarPanel 底部的 See More <LuminousAction type=link>
        - v-if="bookStore.bookList.length > 0"             书单为空 → 不显示
        - :to="{name:'article', params:{id: bookStore.bookList[0].id}}"
                                                            → /article/{第1本书的id}

  两个入口都落到 /article/:id,由 Part 1 的 useCatalogueSync 按 id 拉取目录。
```

---

## §1. 改 · `src/components/common/LuminousAction.vue`(加 `to` 属性)

link 形态现在把 `:to` 写死成 `{name:'article'}`。改成由外部 `to` 属性传入;因路由已收紧为必填 `:id`、link 必然要带 id 跳转,故 `to` **不给默认值、link 时必传**,并在 setup 加一行校验:漏传就 `console.error`。

**模板**:link 那行的 `:to` 改成绑定属性:

```vue
        <RouterLink v-if="type === ActionType.link" :to="to" class="luminous-link">See More</RouterLink>
```

**脚本** `defineProps`:在 `type` 之后追加 `to`(对象型默认值用工厂函数返回):

```js
const props = defineProps({
    type: {
        type: String,
        required: true,
        validator(value) {
            if (value === ActionType.button) {
                return true
            }

            if (value === ActionType.link) {
                return true
            }

            console.error('Luminous button: usage must be \'button\' or \'link\'')
            return false
        }
    },
    // 链接形态(type为link)的跳转目标,透传给内部RouterLink;link形态必传,故不给默认值
    to: {
        type: [String, Object],
        default: null,
    },
})

// link形态必须提供跳转目标(button形态不走RouterLink,无需to)
if (props.type === ActionType.link && props.to === null) {
    console.error('LuminousAction: \'to\' is required when type is \'link\'')
}
```

> 对另一处调用方 `ContentLayer.vue` 无影响:它用的是 `type=button`(走 `<button>` 分支),不读 `to`;`to` 保持 `null` 也不会触发上面的校验(校验只针对 `type=link`)。

---

## §2. 改 · `src/components/SolarPanel.vue`(See More 接 bookStore)

取 `bookStore`,给 See More 加「空书单不渲染」的 `v-if` 和带首本书 id 的 `:to`。

**模板**:把原来的 `<LuminousAction :type="ActionType.link"></LuminousAction>` 改成:

```vue
        <LuminousAction
            v-if="bookStore.bookList.length > 0"
            :type="ActionType.link"
            :to="{name: 'article', params: {id: bookStore.bookList[0].id}}"
        ></LuminousAction>
```

**脚本**:加 `useBookStore` 的 import,并在 `focusStore` 之后取实例:

```js
import {useBookStore} from "@/stores/book.js";
```

```js
/**
 * @type {import('@/stores/book.js').BookStore} 书籍列表状态机的store实例
 * */
const bookStore = useBookStore()
```

> `v-if` 为假时整个元素不渲染,`:to` 里的 `bookStore.bookList[0].id` 也不会求值,故空书单时不存在「读 `[0]` 报错」的问题。loading/失败态下 `bookList` 本就是空数组,See More 自然隐藏——这也正是「书单为空不显示」那条逻辑的落点。

---

## §3. 核对 · `src/components/panel/PanelList.vue`(预计不改)

PanelList 的书目 `<RouterLink>` 在书籍列表那步已写成:

```vue
            <RouterLink :to="{name: 'article', params: {id: book.id}}" class="link">
```

Part 1 给路由补上 `:id` 段后,这条链接即可正确跳到 `/article/{book.id}`。**本篇只需核对、无需改动**。

---

## §4. 路由:收紧为必填 `/article/:id`(已确认)

采用**严谨**方案:路由用必填 `:id`,文章页语义上「必然属于某本书」,不接受无 id 的 `/article`。

为堵住「必填 + `LuminousAction` 默认 `to` 不带 id」那个潜在缺参陷阱,配套:

- `LuminousAction` 的 `to` **不给默认值**(默认 `null`),并在 setup 校验:`type==='link'` 却没传 `to` 就 `console.error`(见 §1)。这样「link 忘了传 to」会在组件层报出清晰错误,而非抛一个 vue-router 缺参异常。
- 现有 link 调用只有 `SolarPanel` 的 See More,已 `v-if` + 带 id,满足必传;`ContentLayer` 用 button,不涉及。

> **落地提醒**:路由必填的改动在 **Part 1 §6**。Part 1 落地、Part 2 未落地的窗口里,`SolarPanel` 旧 See More 不带 id,会报 `Missing required param "id"`。把 Part 1 §6 与本篇 §1、§2 **连着落、落完统一自测**,该窗口即不存在。

---

## §5. 验证清单

- [ ] 聚焦「有书」的天体 → panel 底部出现 See More;点击 → 跳到 `/article/{第1本书id}` 并加载该书目录。
- [ ] 聚焦「无书」的天体(或请求中 / 失败)→ See More **不显示**。
- [ ] PanelList 里点某本书 → 跳到 `/article/{该书id}` 并加载该书目录。
- [ ] 切换不同天体,See More 的目标 id 跟着 `bookList[0]` 变化。
- [ ] `ContentLayer` 的 See More 按钮(`type=button`,聚焦用)行为不回归。
- [ ] 控制台无 `vue-router` 缺参告警(See More 有 `v-if` + 带 id;`LuminousAction` link 必传 `to` 已加校验)。

---

## §6. 备注

- 至此「获取目录接口」前端接入完成:两个入口 → `/article/:id` → `useCatalogueSync` 拉目录 → 加载门 → 目录树渲染。
- 下一支 API(叶子节点正文 / 文章详情)接入时,再处理 `treeQuery.js` 里 `getLeafContent / buildSampleMarkdown` 那段临时桩,并把叶子节点的 `id` 接入正文请求。