# 分割线公共组件 CutOffLine 抽离

> **范围**:把 `label/ContentLayer.vue` 与 `panel/PanelIntro.vue` 中重复的 `.cut-off-line`(h2 与 p 之间的水平分割线)抽离为公共组件 `src/components/common/CutOffLine.vue`,两个调用方改为引用该组件,各自只保留 `margin-bottom`。
>
> **不改动渲染结构,仅消除重复**;但会**修正 label 分割线的配色**使其符合设计稿(见 §2 决策 2)。

---

## 1. 背景与依据

`ContentLayer.vue:6` 与 `PanelIntro.vue:8` 各有一个 `.cut-off-line`,作 h2 与 p 之间的水平分割线。两处样式高度重复:

| 属性 | `ContentLayer.vue:89-105` | `PanelIntro.vue:42-53` |
|---|---|---|
| width | `60px` | `60px` |
| height | `3px` | `3px` |
| clip-path | `polygon(6px 0, 60px 0, 54px 3px, 0 3px)` | 同左,逐字一致 |
| background | `linear-gradient(90deg, rgba(32,198,216,.4), rgba(32,198,216,1))` | `var(--border)`(纯色) |
| margin-bottom | `10px` | `16px` |

对照设计稿,两处分割线的 **SVG 完全相同**(width/height、path、`linearGradient` 方向与色标 `#21AAFF → #2CFBFF` 全部一致;两份 SVG 仅 `linearGradient` 的 `id` 不同,那是 Figma 导出时按图层自动生成的编号,无任何视觉含义)。

因此真正共同的是 **形状 + 渐变**;唯一应保留在调用方的是 `margin-bottom`(它属于父级的布局间距,不该由分割线自身持有)。

---

## 2. 设计决策

1. **形状 + 渐变全部固化进组件,不开放为 prop / CSS 变量。**
   目前唯一会变的只有 margin,渐变与形状两处完全相同。遵循 YAGNI,也与 `common/Trapezoid.vue`「只把真正会变的部分暴露成 CSS 变量」的克制风格一致。将来若真有第三处要不同配色,再把渐变改成 `var(--xxx, 默认值)` 不迟。

2. **渐变以设计稿为准:`#21AAFF → #2CFBFF`(`90deg` 水平)。**
   - ⚠️ **现状偏差**:当前 `ContentLayer.vue` 用的是 `rgba(32,198,216, .4→1)`(单色青的透明度渐变),**不符设计稿**;`PanelIntro.vue` 是 `var(--border)` 纯色。统一为设计稿配色后:
     - label 分割线观感会从「半透明青」变为「**蓝 → 青**」;
     - panel 分割线从「纯色」变为「**蓝 → 青**」。
   - 这是预期内的修正(以设计稿为准),并非回归。

3. **clip-path 沿用现有代码的 60px 版本** `polygon(6px 0, 60px 0, 54px 3px, 0 3px)`,**不**改成设计稿的 58px 版本(`width:58`、斜切约 `3.43px`)。两者肉眼几乎无差,本次不顺带改渲染。

4. **`margin-bottom` 留在调用方各自的 scoped 样式里,不做成组件 prop。**
   - 机制:`CutOffLine` 的根元素自带 `class="cut-off-line"`;Vue 3 scoped CSS 中,**父组件的 `data-v` 作用域也会施加到子组件的根元素上**。因此调用方现有的选择器 `.content-layer .content .cut-off-line { ... }` / `.panel-intro .cut-off-line { ... }` **仍然能命中** `<CutOffLine>` 的根元素。
   - 推论:调用方**无需再手动传 class**,只要把这条规则的内容缩减到只剩 `margin-bottom` 即可,选择器本身不动。

---

## 3. 新建 `src/components/common/CutOffLine.vue`

```vue
<template>
    <div class="cut-off-line"></div>
</template>

<script setup>
defineOptions({
    name: 'CutOffLine',
})
</script>

<style scoped>
.cut-off-line {
    width: 60px;
    height: 3px;
    /* 从左到右 蓝 -> 青(设计稿: #21AAFF -> #2CFBFF) */
    background: linear-gradient(
        90deg,
        #21AAFF 0%,
        #2CFBFF 100%
    );
    clip-path: polygon(
        6px 0,
        60px 0,
        54px 3px,
        0 3px
    );
}
</style>
```

---

## 4. 修改 `src/components/label/ContentLayer.vue`

### 4.1 `<script setup>`:增加 import(现第 20 行 `LuminousAction` 那条下方)

```js
import CutOffLine from "@/components/common/CutOffLine.vue";
```

### 4.2 template:替换第 6 行的占位 div

```diff
- <div class="cut-off-line"></div>
+ <CutOffLine></CutOffLine>
```

### 4.3 style:第 89-105 行的规则,缩减到只剩 `margin-bottom`

```diff
.content-layer .content .cut-off-line {
    margin-bottom: 10px;
-   width: 60px;
-   height: 3px;
-   /* 从左到右 由暗到亮 */
-   background: linear-gradient(
-       90deg,
-       rgba(32, 198, 216, 0.4) 0%,
-       rgba(32, 198, 216, 1) 100%
-   );
-   clip-path: polygon(
-       6px 0,
-       60px 0,
-       54px 3px,
-       0 3px
-   );
}
```

---

## 5. 修改 `src/components/panel/PanelIntro.vue`

### 5.1 `<script setup>`:增加 import

```diff
 <script setup>
+import CutOffLine from "@/components/common/CutOffLine.vue";
+
 defineOptions({
     name: 'SolarPanel',
 })
 </script>
```

### 5.2 template:替换第 8 行的占位 div

```diff
- <div class="cut-off-line"></div>
+ <CutOffLine></CutOffLine>
```

### 5.3 style:第 42-53 行的规则,缩减到只剩 `margin-bottom`

```diff
.panel-intro .cut-off-line {
    margin-bottom: 16px;
-   width: 60px;
-   height: 3px;
-   background: var(--border);
-   clip-path: polygon(
-       6px 0,
-       60px 0,
-       54px 3px,
-       0 3px
-   );
}
```

---

## 6. 验证清单

- [ ] label、panel 两处分割线均渲染为「蓝 → 青」斜切平行四边形(`#21AAFF → #2CFBFF`)。
- [ ] label 分割线与上方 h2、下方 p 的间距不变(`margin-bottom: 10px` 仍生效)——即「调用方 scoped 规则命中组件根元素」的机制成立。
- [ ] panel 分割线 `margin-bottom: 16px` 仍生效。
- [ ] `ContentLayer.vue` / `PanelIntro.vue` 中不再出现重复的 `width / height / clip-path / background`。
- [ ] 确认 label 分割线由「半透明青」变为「蓝 → 青」是符合设计稿的预期变化,而非意外回归。

---

## 7. 备注(本次不处理)

- `PanelIntro.vue:23` 的 `defineOptions({ name: 'SolarPanel' })` 与文件名 `PanelIntro` 不符(疑为复制遗留),与本次抽离无关,留待单独处理。
