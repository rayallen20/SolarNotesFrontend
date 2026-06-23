> # Step 1:目录 store 迁移 + 改名(纯结构重构,零行为变更)
>
> **背景**:`src/stores/catalogue.js` 名为"文章 store",实为整个文章阅读页的状态机,里面挤了**两个请求生命周期**(目录 / 文章)。根问题不是"同文件里命名不够对立",而是"两个 API 塞进了一个文件"。解法是按职责拆成两个 store:
> - `stores/reader/catalogue.js` —— 目录树 + 导航 + 选中 + 折叠 + 焦点/蒙版(本就是现在这个文件的绝大部分)
> - `stores/reader/catalogue.js` —— 拉取到的文章正文 + 其生命周期(Step 2 新建)
>
> 拆开后两个 store 各自拿回**裸名生命周期**(`status` / `reloadNonce` / `startLoading` / `markFailed` / `requestReload`),与已有的 `book.js` 同形,命名不对称从根上消失。
>
> **本步(Step 1)只做目录 store 的"迁移 + 改名",一行业务逻辑都不动。** 文章 store 的新建与"获取文章 API"接入是 Step 2。
>
> ---
>
> **本步不改任何成员名**(裸名全部保留)。只改 store 的**身份**四件套 + 跟随它的局部变量:
> | 维度 | 改前 | 改后 |
> |---|---|---|
> | 文件位置 | `src/stores/catalogue.js` | `src/stores/reader/catalogue.js` |
> | 组合式函数名 | `useArticleStore` | `useCatalogueStore` |
> | `defineStore` id | `'article'` | `'catalogue'` |
> | typedef 类型名 | `ArticleStore` | `CatalogueStore` |
> | 各消费者局部变量 | `articleStore` | `catalogueStore` |
>
> **触及文件(共 8 个)**:
> - 迁移 + 改自身 ×1:`stores/catalogue.js` → `stores/reader/catalogue.js`(§1)
> - 跟随改名 ×6:`useCatalogueSync.js`(§2)、`useCollapseTransition.js`(§3)、`TreeNode.vue`(§4)、`HeaderBar.vue`(§5)、`CatalogueTree.vue`(§6)、`ArticleReader.vue`(§8)
> - 跟随改名(桥)×1:`ArticlePane.vue`(§7)——本步只改名;Step 2 它会再引入第二个 store
>
> **全局替换规则**(7 个消费者通用,三条大小写不同,**区分大小写替换互不误伤**):
> 1. `useArticleStore` → `useCatalogueStore`
> 2. `@/stores/catalogue.js` → `@/stores/reader/catalogue.js`(注意:`@/api/catalogue.js` 是另一个文件,别动)
> 3. `ArticleStore`(typedef,大写 A)→ `CatalogueStore`;小写 `articleStore`(变量)→ `catalogueStore`
>
> **落地顺序**:先 §1(建目录 + 移动 + 改 store 自身),再 §2~§8 逐个消费者,最后一次性编译。
>
> **验收点**:全站行为与改名前**逐项一致**(目录加载 / 折叠展开 / 面包屑 / 焦点蒙版 / 开启文章 / 叶子正文渲染示例 md 都照旧)。这步是可秒验的 no-op。

---

## 0. 数据流总览(本步不变,仅 store 身份改名)

```
路由 :id ──watch──> useCatalogueStore.startLoading/setCatalogue   (useCatalogueSync)
                          │
       catalogue / activeNodeId / collapsedIdSet / focusedPane    (state)
                          │
       nodeIndex → activeNode → renderPhase / breadcrumb / hasMask / articleHtml  (computed)
                          │
   TreeNode / CatalogueTree / HeaderBar / ArticlePane / ArticleReader  (consumers)
```

> 改名前所有箭头都经由 `useArticleStore`;改名后一律经由 `useCatalogueStore`。**箭头与逻辑不变,只换名字。**

---

## 1. 迁移并改名目录 store(provider,先做)

**操作**:
1. 新建目录 `src/stores/reader/`。
2. 把 `src/stores/catalogue.js` **移动**为 `src/stores/reader/catalogue.js`。
3. 文件内部**只改 2 行**(L11、L335),其余一律不动。

> 文件内其它 import 全是 `@/` 别名(`@/lib/treeQuery.js`、`@/lib/enum.js`、`@/api/catalogue.js` …),**不随文件位置变化**,无需改动。

**L11 改前 → 改后**:

```js
// 改前
export const useArticleStore = defineStore('article', () => {
// 改后
export const useCatalogueStore = defineStore('catalogue', () => {
```

**L335 改前 → 改后**:

```js
// 改前
 * @typedef {ReturnType<typeof useArticleStore>} ArticleStore 文章阅读页面状态机存储实例
// 改后
 * @typedef {ReturnType<typeof useCatalogueStore>} CatalogueStore 目录(阅读页导航)状态机存储实例
```

> - `defineStore` 的 id 由 `'article'` 改成 `'catalogue'`:Pinia 用 id 做单例 key,**`'article'` 这个 id 本步腾出来,Step 2 留给新建的文章 store 用**,两者不冲突。
> - 类型名 `ArticleStore` → `CatalogueStore` 与路径**必须改**;描述文案"目录(阅读页导航)状态机…"改不改随你(下文各消费者的 JSDoc 描述同此口径)。
> - **不动**:`articleHtml` 仍留在本 store、仍调 `getLeafContent`(Step 2 才把它搬进文章 store 改读 `article.content`)。

---

## 2. `src/composables/useCatalogueSync.js`(目录同步,紧跟 store)

**L2 import**:

```js
// 改前
import {useArticleStore} from "@/stores/catalogue.js";
// 改后
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
```

**L14 const**:

```js
// 改前
const articleStore = useArticleStore()
// 改后
const catalogueStore = useCatalogueStore()
```

**其余变量引用(逐行核对)**:L19 `catalogueStore.reloadNonce`、L30 `catalogueStore.startLoading()`、L35 `catalogueStore.setCatalogue(catalogue)`、L40 `catalogueStore.markFailed()`。

**注释也一并更新**:L8 `(articleStore.reloadNonce)` → `(catalogueStore.reloadNonce)`;L9 `写入articleStore` → `写入catalogueStore`;**L33 `才写入artcileStore` → `才写入catalogueStore`**(顺手修掉原拼写 `artcileStore`)。

> 本文件无 `@type {...ArticleStore}` 注解,故无 typedef 行要改。

---

## 3. `src/composables/useCollapseTransition.js`

**L2 import**:

```js
// 改前
import {useArticleStore} from "@/stores/catalogue.js";
// 改后
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
```

**L22 const**:

```js
// 改前
const articleStore = useArticleStore()
// 改后
const catalogueStore = useCatalogueStore()
```

**其余变量引用**:L38 `catalogueStore.consumeForceExpanded(nodeId)`。

---

## 4. `src/components/article/TreeNode.vue`

**L64 import**:

```js
// 改前
import {useArticleStore} from "@/stores/catalogue.js";
// 改后
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
```

**L88 JSDoc**:

```js
// 改前
 * @type {import('@/stores/catalogue.js').ArticleStore} 文章阅读页面状态机实例
// 改后
 * @type {import('@/stores/reader/catalogue.js').CatalogueStore} 目录(阅读页导航)状态机实例
```

**L90 const**:

```js
// 改前
const articleStore = useArticleStore()
// 改后
const catalogueStore = useCatalogueStore()
```

**其余变量引用**:L103 `catalogueStore.isCollapsed(props.node.id)`、L110 `catalogueStore.activeNode.id`、L130 `catalogueStore.toggleCollapsed(props.node.id)`、L133 `catalogueStore.selectNode(props.node.id)`。

---

## 5. `src/components/article/HeaderBar.vue`

**L13 import**:

```js
// 改前
import {useArticleStore} from "@/stores/catalogue.js";
// 改后
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
```

**L20 JSDoc**:

```js
// 改前
 * @type {import('@/stores/catalogue.js').ArticleStore} 文章阅读页面状态机实例
// 改后
 * @type {import('@/stores/reader/catalogue.js').CatalogueStore} 目录(阅读页导航)状态机实例
```

**L22 const**:

```js
// 改前
const articleStore = useArticleStore()
// 改后
const catalogueStore = useCatalogueStore()
```

**模板变量引用**:L8 `{{catalogueStore.breadcrumb}}`。

---

## 6. `src/components/article/CatalogueTree.vue`

**L14 import**:

```js
// 改前
import {useArticleStore} from "@/stores/catalogue.js";
// 改后
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
```

**L22 JSDoc**:

```js
// 改前
 * @type {import('@/stores/catalogue.js').ArticleStore} 文章阅读页面状态机实例
// 改后
 * @type {import('@/stores/reader/catalogue.js').CatalogueStore} 目录(阅读页导航)状态机实例
```

**L24 const**:

```js
// 改前
const articleStore = useArticleStore()
// 改后
const catalogueStore = useCatalogueStore()
```

**其余变量引用**:L5(模板)`<TreeNode :node="catalogueStore.catalogue" :depth="0">`、L30 `catalogueStore.isCatalogueActive`、L42 `watch(() => catalogueStore.pendingRevealId, ...)`、L54 `catalogueStore.clearPendingReveal()`。

---

## 7. `src/components/article/ArticlePane.vue`(桥,本步仅改名)

**L61 import**:

```js
// 改前
import {useArticleStore} from "@/stores/catalogue.js";
// 改后
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
```

**L69 JSDoc**:

```js
// 改前
 * @type {import('@/stores/catalogue.js').ArticleStore} 文章阅读页面状态机的实例
// 改后
 * @type {import('@/stores/reader/catalogue.js').CatalogueStore} 目录(阅读页导航)状态机的实例
```

**L71 const**:

```js
// 改前
const articleStore = useArticleStore()
// 改后
const catalogueStore = useCatalogueStore()
```

**其余变量引用(本文件 `articleStore` 出现最多,逐行核对)**:
- 模板:L2 `{'has-mask': catalogueStore.hasMask}`、L5 `catalogueStore.renderPhase`、L8 `catalogueStore.activeNode.name`、**L11 `catalogueStore.articleHtml`**、L13 `catalogueStore.activeNode.createdAt`、L18 `catalogueStore.activeNode.name`、L20 `catalogueStore.activeNode.intro`、L22 `catalogueStore.activeNode.createdAt`、L29 `catalogueStore.renderPhase … !catalogueStore.hasMask`、L31 `catalogueStore.focusCatalogue`、L39 `catalogueStore.hasMask`、L41 `catalogueStore.focusArticle`、L50 `catalogueStore.openArticle`
- 脚本:L77 `catalogueStore.renderPhase`、L140 `watch(() => catalogueStore.activeNode, …)`

> ⚠️ **Step 2 预告(本步不要动)**:L11 的 `articleHtml`、以及 L13/L22 的 `createdAt`,在 Step 2 会改走**新的文章 store**(届时本文件 `import { useArticleStore }` 复活、再 `const articleStore = useArticleStore()`,与这里的 `catalogueStore` 并存)。本步它们仍读 `catalogueStore`。

---

## 8. `src/pages/ArticleReader.vue`(页根)

**L35 import**:

```js
// 改前
import {useArticleStore} from "@/stores/catalogue.js";
// 改后
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
```

**L44 JSDoc**:

```js
// 改前
 * @type {import('@/stores/catalogue.js').ArticleStore} 文章阅读页面状态机实例
// 改后
 * @type {import('@/stores/reader/catalogue.js').CatalogueStore} 目录(阅读页导航)状态机实例
```

**L46 const**:

```js
// 改前
const articleStore = useArticleStore()
// 改后
const catalogueStore = useCatalogueStore()
```

**其余变量引用**:L4 `catalogueStore.status === RequestStatus.loading`、L9 `catalogueStore.status === RequestStatus.failed`、L11 `catalogueStore.requestReload()`、L14 `catalogueStore.status === RequestStatus.success`。

> 成员名 `status` / `requestReload` **保持裸名不变**(这正是拆分的收益),只是变量前缀从 `articleStore` 换成 `catalogueStore`。Step 2 会在本文件 `useCatalogueSync()` 之后再加一行 `useArticleSync()`,本步不加。

---

## 9. 验证清单(Step 1)

文件层:
- [ ] `src/stores/catalogue.js` 已不存在;`src/stores/reader/catalogue.js` 存在
- [ ] `grep -rn "useArticleStore" src/` → **零命中**
- [ ] `grep -rn "stores/catalogue.js" src/` → **零命中**
- [ ] `grep -rn "articleStore" src/` → **零命中**(变量全部改 `catalogueStore`)
- [ ] `grep -rn "ArticleStore" src/` → **零命中**(typedef 全部改 `CatalogueStore`)
- [ ] `defineStore('catalogue'` 唯一;**无** `defineStore('article'`(Step 2 才会新增)

编译/运行(行为应与改名前**逐项一致**):
- [ ] 编译通过,无 "is not defined"、无 "Failed to resolve import"
- [ ] 进文章页:目录正常加载,默认选中根节点(浏览态)
- [ ] 折叠/展开非叶节点:动画正常
- [ ] 面包屑随选中节点更新
- [ ] 点叶子节点:进阅读态,正文渲染示例 md(`getLeafContent` 仍在用,正常)
- [ ] 浏览态点「开启文章」:跳到首个叶子并滚动到位(`nodeIndex.value.get` 已修,正常)
- [ ] 焦点/蒙版切换(专注目录 / 开启文章)正常

---

## 10. 备注

1. 本步是**纯结构重构**,无任何业务逻辑改动;成员名一个没动,只换 store 身份 + 变量名。
2. `articleHtml` 仍在目录 store 里、仍用 `getLeafContent`——Step 2 才把它搬进 `stores/reader/catalogue.js` 并改读 `article.content`,同时删 `getLeafContent` 调用与 `treeQuery.js` 里的桩。
3. `ArticlePane.vue` 是唯一会在 Step 2 **再次改动**的消费者(届时引入第二个 `useArticleStore`);其余 6 个消费者本步改完即终态。
4. **`book.js` 自带裸名** `status` / `reloadNonce` / `startLoading` / `markFailed` / `requestReload`,**与本次改名无关,切勿连带改动**。
5. 完成并自测通过后告诉我,我再出 Step 2(`feature_文章页store拆分_step2_文章store接入API.md`):新建 `stores/reader/catalogue.js` + `api/catalogue.js` + `useArticleSync.js`,目录 store 加 `activeLeafId`,`ArticlePane` 接两个 store,删 treeQuery 桩。