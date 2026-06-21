# feature · 书籍列表接口接入(聚焦天体 → panel 书单)

> **已确认决策**
> - 聚焦任一天体(**含太阳**)都拉取书单;请求体字段 `planet.id` 取自聚焦天体的 `userData.id`。
> - 后端已把该接口改为 **POST**(`GET` 带 body 在浏览器端发不出去),前端用 `axiosInstance.post`。
> - 采用**方案 B1**:focus 状态机保持纯;新增一个 composable(`useBookListSync`)负责"监听聚焦天体 → 拉书单 → 写入书单 store",书单 store 只存纯状态、零 IO。这与 `useKeyboardFocusNav → focusStore` 同构。
> - 状态用三态枚举 `BookListStatus`(loading/success/failed),失败时清空书单(不残留上次内容)并显示"加载失败 + 重试";切换天体瞬间也清空。
> - `book.id` 现在就进数据(`:key`、`:to` 的 `params`),article 路由接收 `:id` 留到下个接口再改。
>
> **触及文件**
> - 新建:`src/api/book.js`、`src/stores/book.js`、`src/composables/useBookListSync.js`
> - 修改:`src/lib/enum.js`、`src/components/panel/PanelList.vue`、`src/pages/SolarCanvas.vue`

---

## 0. 数据流总览

```
[三个聚焦入口]                         [状态机]
SolarCanvas.onPointerUp(点3D天体) ┐
ContentLayer.onFocusClick(点按钮) ┼─► focusStore.requestFocus(anchor)
useKeyboardFocusNav(键盘←/→)      ┘        └─► focusedEntity = anchor
                                                     │
                                                     ▼ (watch)
                                    useBookListSync 监听 focusedEntity / reloadNonce
                                                     │
                          ┌──────────────────────────┼──────────────────────────┐
                          ▼ entity===null            ▼ entity!==null             │
                     bookStore.clear()        bookStore.startLoading()           │
                                                     │  getList(entity.userData.id) [POST]
                                          ┌──────────┴──────────┐                │
                                          ▼ 成功                ▼ 失败            │
                                  bookStore.setBookList   bookStore.markFailed   │
                                          └──────────┬──────────┘                │
                                                     ▼                           │
                                    PanelList 读 bookStore.status / bookList 渲染 │
                                          失败 → 加载失败 + [重试] ───────────────┘
                                          其余 → <li> 书单
```

- 三处入口本就全部经 `requestFocus` 把 `focusedEntity` 改掉,watch 自动覆盖三者,**零重复**。
- 相机动画(`requestFocus`/`tickFocus`)与书单请求**解耦**:谁都不等谁。
- 点"重试" → `requestReload()` 自增 `reloadNonce` → watch 用**当前** `focusedEntity` 重新走一遍。

---

## 1. 修改 · `src/lib/enum.js`(新增 `BookListStatus`)

在文件中(与现有 `FocusPhase` 等并列)**新增**下面这个枚举:

```js
/**
 * @typedef {Object} BookListStatus 本枚举项用于标识panel书单的加载状态
 * @property {String} loading 正在请求书单
 * @property {String} success 书单请求成功(列表可能为空,表示该天体下暂无书籍)
 * @property {String} failed 书单请求失败
 * */
const BookListStatus = Object.freeze({
    loading: 'loading',
    success: 'success',
    failed: 'failed',
})
```

并把它加进文件末尾的 `export` 块:

```js
export {
    ActionType,
    HoverPhase,
    FocusPhase,
    CatalogueNodeType,
    RenderPhase,
    FocusedPane,
    BookListStatus,
}
```

---

## 2. 新建 · `src/api/book.js`

```js
import axiosInstance from "@/lib/request.js";

/**
 * 本函数用于请求指定天体的书籍列表API
 * @param {Number} planetId 聚焦天体的id(取自anchor.userData.id)
 * @return {Promise<{bookList: Array<import('@/stores/book.js').BookItem>}>} 含书籍列表的Promise对象
 * */
function getList(planetId) {
    const uri = "/v1/book/list"
    return axiosInstance.post(uri, {planet: {id: planetId}})
}

export {
    getList,
}
```

> - `@return` 标的 `BookItem` 在 §3 的 store 中定义(前向引用),与"`BodyMeta` 定义在 `applyBodyMeta.js`、`api/planet.js` 引用它"同构。
> - `request.js` 的默认导出已收窄为 `HttpClient`(`.post()` → `Promise<any>`,见 `feature_天体简介接口接入.md` §1.2),此处 `@return` 不会报 not-assignable。
> - 拼出的完整 URL:`baseURL(http://192.168.1.151:4060/api)` + `/v1/book/list` = `http://192.168.1.151:4060/api/v1/book/list`。

---

## 3. 新建 · `src/stores/book.js`(纯状态,零 IO)

```js
import {defineStore} from "pinia";
import {ref} from "vue";
import {BookListStatus} from "@/lib/enum.js";

/**
 * @typedef {Object} BookItem panel书单中的一项
 * @property {Number} id 书籍id(暂存,后续请求文章详情API时使用)
 * @property {String} title 书籍标题(渲染在<li>上)
 * */

export const useBookStore = defineStore('book', () => {
    // state
    /**
     * @type {import('vue').Ref<Array<BookItem>>} 当前聚焦天体的书单
     * */
    const bookList = ref([])

    /**
     * @type {import('vue').Ref<String>} 书单加载状态(取值见BookListStatus)
     * */
    const status = ref(BookListStatus.success)

    /**
     * @type {import('vue').Ref<Number>} 重试信号: 自增以重新触发useBookListSync中的拉取
     * */
    const reloadNonce = ref(0)

    // mutations
    /**
     * 切换聚焦天体/重试时调用: 清掉上一个天体的书单并进入loading
     * */
    function startLoading() {
        bookList.value = []
        status.value = BookListStatus.loading
    }

    /**
     * 书单请求成功时调用
     * @param {Array<BookItem>} list 后端返回的书单
     * */
    function setBookList(list) {
        bookList.value = list
        status.value = BookListStatus.success
    }

    /**
     * 书单请求失败时调用: 清空书单(不残留上次内容)并标记失败
     * */
    function markFailed() {
        bookList.value = []
        status.value = BookListStatus.failed
    }

    /**
     * 退出聚焦时调用: 清空书单并复位状态
     * */
    function clear() {
        bookList.value = []
        status.value = BookListStatus.success
    }

    /**
     * "重试"按钮调用: 自增重试信号,触发useBookListSync用当前聚焦天体重新拉取
     * */
    function requestReload() {
        reloadNonce.value++
    }

    return {
        // state
        bookList, status, reloadNonce,

        // mutations
        startLoading, setBookList, markFailed, clear, requestReload,
    }
})

/**
 * @typedef {ReturnType<typeof useBookStore>} BookStore 书单状态机的store实例
 * */
```

> `requestReload` 的命名故意对齐 focus store 的 `requestFocus`/`requestClear`。

---

## 4. 新建 · `src/composables/useBookListSync.js`(主角:聚焦 → 书单)

```js
import {watch} from "vue";
import {useFocusStore} from "@/stores/focus.js";
import {useBookStore} from "@/stores/book.js";
import {getList} from "@/api/book.js";

/**
 * 本函数用于把"当前聚焦天体"同步为"该天体的书单":
 *      - 监听聚焦天体(focusedEntity)与重试信号(reloadNonce)的变化
 *      - 聚焦某天体: 拉取其书单写入bookStore
 *      - 退出聚焦(focusedEntity为null): 清空书单
 * 在SolarCanvas的setup中调用一次即可; watch随组件作用域自动回收,无需手动停止
 * */
export function useBookListSync() {
    const focusStore = useFocusStore()
    const bookStore = useBookStore()

    watch(
        [() => focusStore.focusedEntity, () => bookStore.reloadNonce],
        async (newValues) => {
            // newValues 是 [focusedEntity新值, reloadNonce新值]; 只取源0聚焦天体, 源1(reloadNonce)仅用于触发、值不用
            const entity = newValues[0]

            // 退出聚焦: 清空书单
            if (entity === null) {
                bookStore.clear()
                return
            }

            // 切换聚焦天体/重试: 先清掉上一个天体的内容并进入loading
            bookStore.startLoading()

            try {
                const {bookList} = await getList(entity.userData.id)
                // 竞态守卫: await期间聚焦可能已切走,仅当仍聚焦在entity上时才写入
                if (focusStore.focusedEntity === entity) {
                    bookStore.setBookList(bookList)
                }
            } catch (err) {
                console.error('获取书籍列表失败: ', err)
                if (focusStore.focusedEntity === entity) {
                    bookStore.markFailed()
                }
            }
        },
    )
}
```

> - watch 是惰性的(无 `immediate`):挂载时 `focusedEntity` 为 null,不会触发首次空请求。
> - 多源 watch:回调收到的 `newValues` 是 `[focusedEntity新值, reloadNonce新值]`,`focusedEntity` 或 `reloadNonce` 任一变化都会触发。这里只取 `newValues[0]`(聚焦天体);`reloadNonce` 仅用于触发、值用不到,故不取(也没取 oldValues)。
> - `startLoading()` 只改 `bookList`/`status`(都不在 watch 源里),不会自触发。

---

## 5. 修改 · `src/components/panel/PanelList.vue`

### 5.1 template(失败分支 + 动态书单)

**改前:**

```vue
<template>
<div class="panel-list">
    <ul class="flex-wrap">
        <li class="flex-item" v-for="index in 8" :key="index">
            <Trapezoid></Trapezoid>
            <RouterLink :to="{name: 'article'}" class="link">一些文字</RouterLink>
        </li>
    </ul>
</div>
</template>
```

**改后:**

```vue
<template>
<div class="panel-list">
    <!-- 加载失败: 列表区内联提示,可点击重试 -->
    <div v-if="bookStore.status === BookListStatus.failed" class="load-error">
        <span>加载失败</span>
        <button type="button" class="retry" @click="bookStore.requestReload()">重试</button>
    </div>
    <!-- 其余状态: 渲染书单(loading时bookList为空,暂渲染为空列表) -->
    <ul v-else class="flex-wrap">
        <li class="flex-item" v-for="book in bookStore.bookList" :key="book.id">
            <Trapezoid></Trapezoid>
            <RouterLink :to="{name: 'article', params: {id: book.id}}" class="link">{{ book.title }}</RouterLink>
        </li>
    </ul>
</div>
</template>
```

### 5.2 script(读 store)

**改前:**

```vue
<script setup>
import Trapezoid from "@/components/common/Trapezoid.vue";
</script>
```

**改后:**

```vue
<script setup>
import Trapezoid from "@/components/common/Trapezoid.vue";
import {useBookStore} from "@/stores/book.js";
import {BookListStatus} from "@/lib/enum.js";

/**
 * @type {import('@/stores/book.js').BookStore} 书单状态机的store实例
 * */
const bookStore = useBookStore()
</script>
```

### 5.3 style(失败提示样式 —— 占位,按设计稿调)

在 `<style scoped>` 内**追加**(现有规则保持不动):

```css
/* 加载失败提示(样式为占位,按设计稿调) */
.panel-list .load-error {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    row-gap: 16px;
    color: #CFE8FF;
}

.panel-list .load-error .retry {
    padding: 6px 20px;
    font-size: 16px;
    color: #CFE8FF;
    background: transparent;
    border: 1px solid rgba(32, 198, 216, 0.35);
    border-radius: 8px;
    cursor: pointer;
    transition: 0.2s;
}

.panel-list .load-error .retry:hover {
    color: #51EEFF;
    border-color: #51EEFF;
}
```

---

## 6. 修改 · `src/pages/SolarCanvas.vue`(接线一行)

### 6.1 在 import 区追加(放在 `SceneErrorHint` 那行之后即可):

```js
import {useBookListSync} from "@/composables/useBookListSync.js";
```

### 6.2 在 `</script>` 之前、`useKeyboardFocusNav()` 之后加一行:

**改前:**

```js
useKeyboardFocusNav()
</script>
```

**改后:**

```js
useKeyboardFocusNav()
useBookListSync()
</script>
```

---

## 7. 验证清单

- [ ] 后端 `/api/v1/book/list` 已为 **POST**;`api/book.js` 用 `axiosInstance.post`、uri 为 `/v1/book/list`,完整 URL 为 `http://192.168.1.151:4060/api/v1/book/list`。
- [ ] `lib/enum.js` 已导出 `BookListStatus`(loading/success/failed)。
- [ ] 聚焦任一天体(**含太阳**):panel 书单按后端返回的 `title` 渲染,`<li>` 数量随返回条数变化(不再写死 8)。
- [ ] **三个入口**——点 3D 天体 / 点 label 聚焦按钮 / 键盘 ←→ ——书单都会刷新(验证三者都经 `requestFocus` → watch 生效)。
- [ ] 键盘快速连切多个天体:最终 panel 显示的是**最后停留**天体的书单(竞态守卫生效,不被先发后到的旧响应覆盖)。
- [ ] 切换聚焦天体的瞬间:不残留上一个天体的书单(`startLoading` 清空)。
- [ ] 退出聚焦(点空白 / ESC):书单清空。
- [ ] 断网或后端报错时聚焦:列表区显示"加载失败 + 重试",且**不残留**上次内容;点"重试"用**当前**聚焦天体重新拉取,成功后正常渲染。
- [ ] `book.id` 已进数据(`:key` 与 `:to` 的 `params` 都用到);article 路由接收 `:id` 留到下个接口再改,现在加上不影响运行。

---

## 8. 备注

- **BookItem 归属**:定义在 `stores/book.js`(数据落地处),`api/book.js` 的 `@return` 前向引用它——与 planet 接入里 `BodyMeta` 定义在 `applyBodyMeta.js`、`api/planet.js` 引用它同构。
- **为何不需要 onActivated/onDeactivated**:`useBookListSync` 的 watch 在 SolarCanvas 的 setup 中创建,随组件作用域自动回收;不像 `useKeyboardFocusNav` 用的是 window 级监听才要手动摘挂。SolarCanvas 被 keep-alive 缓存,setup 只跑一次、watch 只建一次;停用期间聚焦不会变化,不会产生多余请求。
- **loading 态目前渲染为空列表**:若以后要加"加载中"骨架/转圈,只需在 `v-else` 之上补一段 `v-else-if="bookStore.status === BookListStatus.loading"`,状态模型无需改。
- **失败与动画解耦**:请求失败只 `console.error` + 列表区提示,不影响相机动画与 panel 显隐;`title`/`intro` 来自本地 `userData`,失败时也照常显示。