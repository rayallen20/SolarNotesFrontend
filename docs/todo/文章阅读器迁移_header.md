# 文章阅读器迁移 · 迁移 `.header`(含页面根落地)

> **范围**:Step 1(结构 + 样式)的第一块——把源 `.header` 迁为 `src/components/article/HeaderBar.vue`,并在 `ArticleReader.vue` 建立 `.article-reader` 页面根(承接源 `index.css` 的页面级样式)。
>
> **纯静态、不接行为**:页头标题(`<h2>`)先写死,真实路径标题(`store.pageTitle`)留到 Step 2;"返回太阳系"用 `router-link`(属静态导航,不算要 defer 的"行为")。
>
> **关联**:迁移设计 §6(路由整合)、§8(CSS 收敛);`字体迁移.md`(系统字体 PingFang SC 不迁的先例)。
>
> **图标类名**:以实际导出为准(见 §0),header 用 `icon-icon-left`。

---

## 0. 字体图标类名(以实际导出为准)

文章阅读器用到的字体图标,合并导出后 `src/assets/iconfont/iconfont.css` 里的**实际类名**(直接照用,不重导出):

| 图标 | 实际类名 | 用在 |
|---|---|---|
| 返回箭头 | `icon-icon-left` | header(本步) |
| 文件夹箭头 | `icon-icon-right` | 目录树 |
| 文件 | `icon-icon_file` | 目录树 |
| 专注目录 | `icon-icon_mulu` | 文章区按钮 |

> 双 `icon-` 是 iconfont.cn 上填的 `font_class` 叠加项目 `css_prefix_text`(`icon-`)所得;`file`/`mulu` 用下划线、`left`/`right` 用连字符也是导出原样——按现状照用即可。
>
> 本步(header)只用到 `icon-icon-left`,下面 §2/§3 已按此书写。
>
> 图标是从新素材库找的**视觉近似替换**(原素材已不可得):验证时能正常渲染即可,不要求与原项目像素一致。

---

## 1. 源 `index.css` 逐条去向(页面根落地)

源 `universeBlogContent/assets/index.css` 是「文章阅读器的**页面级全局**」,**不能并进**本项目全局 `src/assets/index.css`(那是 3D 应用的根,`body`/`button`/`:root` 一旦全局化会泄漏到 `/solar`:背景图盖住星空、按钮重置掀翻 KeyboardHint 边框)。逐条拆到 `.article-reader` 页面根:

| 源 `index.css` 规则 | 去向 | 本次? |
|---|---|---|
| `* { box-sizing: border-box }` | **丢弃** —— 本项目 `reset.css` + `index.css` 已全局有 box-sizing | — |
| `body { flex / column / 100vh / overflow:hidden / background }` | **`.article-reader`**(ArticleReader.vue scoped) | ✅ 本次(header 的定位容器) |
| `:root { --tree-indent / --tree-base / --tree-line-color / --tree-line-width / --row-height }` | **`.article-reader`**(自定义属性靠继承穿透组件边界) | 迁树时再加 |
| `button { border:none; outline:none }` | **`.article-reader :deep(button)`**(绝不全局,否则掀翻 3D UI 按钮边框) | 迁文章区时再加 |

> **为什么页面根是 header 的前提**:源 `.header { flex: 0 0 100px }` 依赖父级是 `display:flex; flex-direction:column` 的竖向容器——所以得先把 `.article-reader` 立成这个容器,header 才能定位成"顶部 100px 固定条"。

---

## 2. 修改 `src/pages/ArticleReader.vue`(建页面根 + 挂 HeaderBar)

把占位 stub 整体替换为:

```vue
<template>
    <div class="article-reader">
        <HeaderBar></HeaderBar>
        <!-- 后续:目录区 + 文章区(.articleWrap),本步先留空 -->
    </div>
</template>

<script setup>
import HeaderBar from "@/components/article/HeaderBar.vue";

defineOptions({
    name: 'ArticleReader',
})
</script>

<style scoped>
.article-reader {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    /* 源 index.css 的 body 背景;图片实际在 src/assets/img/ */
    background: url('@/assets/img/background.jpg') lightgray 50% / cover no-repeat;
    /* 迁树时再补:--tree-indent / --tree-base / --tree-line-color / --tree-line-width / --row-height */
}
</style>
```

要点:
- **删掉** stub 里的文案 `目录+详情页面` 和 `.article-reader { color: black }`(黑字在深色背景上不可读;本项目 `reset.css` 已全局 `color: white`,header 内各元素也都有自己的颜色)。
- `height: 100vh` 是视口单位,不依赖 `#app` / `.app` 的高度;`reset.css` 已清零 `body` margin,顶部不会留缝。
- 背景图 `url('@/assets/img/background.jpg')` 用 `@` 别名,Vite 解析 + 哈希。

---

## 3. 新建 `src/components/article/HeaderBar.vue`

结构对应源 `public/index.html` 的 `.header`;`<a href="#">` 改为 `<router-link :to="{ name: 'solar' }">`;`header.css` 整段进 `<style scoped>`。

```vue
<template>
    <div class="header">
        <router-link :to="{ name: 'solar' }">
            <span class="iconfont icon-icon-left"></span>
            <span class="literal">返回太阳系</span>
        </router-link>
        <!-- 静态标题:Step 2 换成 store.pageTitle -->
        <h2>网络安全管理</h2>
    </div>
</template>

<script setup>
defineOptions({
    name: 'HeaderBar',
})
</script>

<style scoped>
.header {
    flex: 0 0 100px;
    display: flex;
    /* TODO: 这个缝隙宽度是看设计稿上 2 个文字之间的间距 */
    column-gap: 54px;
    border-bottom: 2px solid #21AAFF;
    background: rgba(0, 0, 0, 0.40);
}

.header a {
    position: relative;
    background: transparent;
    display: flex;
    align-items: center;
    padding-left: 30px;
    height: 100%;
    transition: all 0.4s;
}

/* Tips: 悬停时无法过渡 background,故用伪元素做悬停颜色渐变过渡 */
.header a::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(90deg, rgba(44, 251, 255, 0.10) 0%, rgba(44, 251, 255, 0.00) 100%);
    opacity: 0.33333;
    transition: opacity 0.5s ease;
}

.header a:hover::before {
    opacity: 1;
}

.header a span {
    color: #2CFBFF;
}

.header a .icon-icon-left {
    font-size: 18px;
}

.header a .literal {
    font-family: "PingFang SC", serif;
    font-size: 18px;
    font-style: normal;
    font-weight: 400;
    letter-spacing: 1px;
}

.header h2 {
    height: 100%;
    display: flex;
    align-items: center;
    color: #FFFFFF;
    font-family: "Source Han Serif CN", serif;
    font-size: 40px;
    font-style: normal;
    font-weight: 900;
    letter-spacing: 2px;
}
</style>
```

**为什么 header.css 进 scoped 就够(无需 `:deep()`)**:
- `.header`、`router-link` 渲染出的 `<a>`、以及插槽里的两个 `<span>`,都由本组件模板渲染、都带 HeaderBar 的 scope 属性 —— 所以 `.header a` / `.header a span` / `.header a::before` / `.header a .literal` 照常命中(`<a>` 是子组件根,默认插槽内容在父作用域编译,均携带本组件 `data-v`)。
- `.iconfont` 字形来自**全局** `iconfont.css`(`App.vue` 已 `import`),`.icon-icon-left:before { content }` 是全局规则,不受 scope 影响。

---

## 4. 字体说明(本步不需补字体)

- `.header a .literal` 用 `"PingFang SC", serif` —— macOS 系统字体,**不迁**,Windows 自动 fallback 到 `serif`(沿用 `字体迁移.md` 的处置)。
- `.header h2` 用 `Source Han Serif CN` **900** —— 本项目已有 Heavy(900),无需补字重(缺的 500 在 `tree.css`,与 header 无关)。

---

## 5. 验证清单(纯视觉 + 导航)

- [ ] `/article` 顶部出现 100px 高的页头:底部 `2px #21AAFF` 边线、半透明黑底 `rgba(0,0,0,.4)`。
- [ ] 左侧"返回太阳系":`icon-icon-left` 箭头 + 文字,均为 `#2CFBFF`;鼠标悬停时有从左到右的青色渐变高亮过渡(伪元素)。
- [ ] 箭头图标**正常渲染、非豆腐块**(依赖 §0 的实际类名 `icon-icon-left`)。
- [ ] 右侧 `<h2>` 标题:白色、40px、900 字重、`letter-spacing: 2px`。
- [ ] 背景图铺满整页(`cover`、居中、不重复)。
- [ ] 点击"返回太阳系" → 跳转 `/solar`(3D 页)。
- [ ] **回到 `/solar` 外观与交互无变化**(背景 / 按钮 / 字体无全局泄漏)——验证页面根 scope 成功。

---

## 6. 备注 / 留松(本步不处理)

- `<h2>` 是写死的静态标题;路径联动(`store.pageTitle`)、目录区 / 文章区都在后续步骤。
- 页面根的 `--tree-*` 变量、`button` 重置本步**不加**,分别留到迁树 / 迁文章区(§1 表已标)。
- `.article-reader` 内 header 之下的空白(`.articleWrap`)留到下一块(目录区)填充。