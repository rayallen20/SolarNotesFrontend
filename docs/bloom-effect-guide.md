# 太阳光晕(Bloom)效果实现指南

本文档梳理原项目(`/Users/yanglei/Desktop/universeBlog`)中太阳光晕效果的实现原理,并给出迁移到当前 Vue 工程的实施步骤。

---

## Part 1:为什么需要"选择性 Bloom",以及整体思路

### 1.1 Bloom 是什么

**Bloom(光晕 / 泛光)** = 把画面里"足够亮"的像素,向周围扩散出柔和的光斑,模拟真实相机/眼睛面对强光时的眩光效果。

### 1.2 Post-processing(后期处理)是什么

Three.js 默认流程:**3D 场景 → renderer.render() → 屏幕**,中间没有"后期加工"。

后期处理的思路:

> **3D 场景 → 先渲染到一张"离屏纹理(render target)" → 在这张 2D 纹理上再做 N 次图像处理 → 最后才显示到屏幕**

这个"把 2D 纹理来回加工"的流水线,就是 `EffectComposer` 管理的事情。

### 1.3 直接加一个 UnrealBloomPass 为什么不行

`UnrealBloomPass` 的工作方式是:**所有**超过阈值亮度的像素都会泛光。

- 太阳(自发光 emissive,非常亮)→ 产生光晕 ✓
- 白色的行星高光、天空球的亮块、贴图里的高光点 → 也产生光晕 ✗

所以必须有办法"**告诉 Bloom Pass 只处理太阳**",这就是 selective bloom。

### 1.4 selective bloom 的完整策略

原项目采用的是 **"双 Composer + 遮罩"** 方案:

```
                  ┌── 先把非太阳物体的材质临时替换为纯黑
                  │
Composer A        │   (只有太阳还发光,其他都是黑的)
(bloomComposer) ──┤
                  │   → RenderPass 渲染这个"只剩太阳"的场景
                  │   → UnrealBloomPass 只对太阳的亮像素泛光
                  │
                  └── 输出到一张离屏纹理 (bloomComposer.renderTarget2.texture)
                     【这张纹理里只有太阳的光晕,其他地方全是黑】

                  ┌── 恢复所有物体的正常材质
                  │
Composer B        │   → RenderPass 正常渲染整个场景(太阳+行星+天空球…)
(finalComposer) ──┤
                  │   → ShaderPass 把 A 的光晕纹理"加法叠加"上去
                  │     (base + bloom,黑的地方相加等于没变,光晕的地方变亮)
                  │
                  └── 输出到屏幕
```

---

## Part 2:逐个对象讲解

### 2.1 `EffectComposer` —— 流水线管理者

```js
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
const composer = new EffectComposer(renderer)
```

- **作用**:管理一条"pass 队列",每个 pass 的输出作为下一个 pass 的输入
- **内部机制**:有两个离屏 `WebGLRenderTarget`(rt1、rt2),pass 之间 **ping-pong**(乒乓互换)——第一个 pass 读 rt1 写 rt2,下一个 pass 读 rt2 写 rt1,以此类推
- **默认最后一个 pass 输出到屏幕**,除非设置 `composer.renderToScreen = false`(就像 `bloomComposer` 那样,输出到纹理给别人用)
- **读取输出**:`composer.renderTarget2.texture` 是惯例上的"最终输出"——因为最后一次 ping-pong 后,结果正好落在 rt2

### 2.2 `RenderPass` —— 最基础的 pass:渲染 3D 场景

```js
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
const renderScene = new RenderPass(scene, camera)
```

- **作用**:就是平时的 `renderer.render(scene, camera)`,只不过**输出到离屏纹理**(而不是屏幕)
- 两个 Composer 都需要先跑一个 RenderPass 才能拿到"场景的 2D 图像"

### 2.3 `UnrealBloomPass` —— 光晕核心算法

```js
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),  // 纹理分辨率
    2.2,   // strength:光晕强度(0~N)
    0.55,  // radius:光晕扩散半径(0~1)
    0.88   // threshold:亮度阈值,只有超过这个值才会泛光(0~1)
)
```

- **算法**:源自 Unreal Engine。大致是"提取高亮像素 → 多层 downsample + 高斯模糊 → upsample 合成 → 叠加回原图"
- **threshold 是关键**:阈值越高,越少像素能泛光;阈值越低,泛光越普遍
- 它会**把 bloom 直接叠加到自己的输入图像上**作为输出(不是只输出光晕)—— 但对 `bloomComposer` 来说,输入已经是"只有太阳亮、其他都是黑的"图像了,所以叠加后也只是"太阳+太阳的光晕",其他地方仍是黑的

### 2.4 `ShaderPass` —— 自定义 GLSL Pass

```js
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'
const finalPass = new ShaderPass(
    new THREE.ShaderMaterial({
        uniforms: {
            baseTexture:  { value: null },   // ← 由 Composer 自动填充前一个 pass 的结果
            bloomTexture: { value: bloomComposer.renderTarget2.texture },  // ← 来自 A composer
        },
        vertexShader: /* glsl */,
        fragmentShader: /* glsl */,
    }),
    'baseTexture',  // 告诉 ShaderPass "把上一个 pass 的结果写进 baseTexture 这个 uniform"
)
```

- 第二个参数 `'baseTexture'` 特别关键:它告诉 ShaderPass "链式输入的纹理对应哪个 uniform 名"。默认是 `tDiffuse`,这里改成了 `baseTexture`
- Fragment shader 的逻辑非常简单:

```glsl
vec4 base  = texture2D(baseTexture,  vUv);  // 正常场景像素
vec4 bloom = texture2D(bloomTexture, vUv);  // 光晕像素(非太阳处=黑)
gl_FragColor = base + bloom;                // 加法叠加
```

加法叠加 = 真实光的叠加方式(黑色 RGB=(0,0,0) 加任何颜色都保持原色;非黑处的颜色被"点亮")。这比 `mix(base, bloom, 0.5)` 一类的混合更物理。

### 2.5 `bloomLayer` + `darkenNonBloomed` —— 非太阳物体临时变黑

```js
const bloomLayer = new THREE.Layers()
bloomLayer.set(BLOOM_SCENE)   // bloomLayer 只含 bloom 层(layer 1)

function darkenNonBloomed(obj) {
    if (obj.isMesh && !bloomLayer.test(obj.layers)) {
        materials[obj.uuid] = obj.material      // 备份原材质
        obj.material = darkMaterial             // 换成纯黑
    }
}

function restoreMaterial(obj) {
    if (materials[obj.uuid]) {
        obj.material = materials[obj.uuid]      // 恢复原材质
        delete materials[obj.uuid]
    }
}
```

- `bloomLayer` 在这里是个**独立的 Layers 对象**(和光源/摄像机的 layers 是同一套 bit-mask 系统,但这个对象只是用来做比较的工具,不挂在任何 Object3D 上)
- `bloomLayer.test(obj.layers)` = "该物体是否在 bloom 层?"
- 每一帧渲染 A Composer 前,遍历场景把非 bloom 层的 Mesh 换成黑材质;A 渲染完再遍历恢复

**为什么要"备份+恢复"?**
因为 B Composer 紧接着要渲染正常场景,必须用原材质。所以不能永久替换,只能"临帧"替换。

### 2.6 每帧的顺序(关键!)

```js
scene.traverse(darkenNonBloomed)   // 第1步:非太阳 Mesh 临时变黑
bloomComposer.render()              // 第2步:渲染"只剩太阳"的场景 → 得到光晕纹理
scene.traverse(restoreMaterial)     // 第3步:恢复所有物体的原材质
finalComposer.render()              // 第4步:正常渲染 + 叠加光晕 → 上屏
```

**顺序不能错**:第 3 步必须在第 4 步之前,否则屏幕上全是黑的物体。

---

## Part 3:迁移到 Vue 工程的实施步骤

### 3.1 文件结构建议

新建 **`src/three/bloom.js`**(或 `postprocess.js`,看偏好),它暴露:

| 导出 | 作用 |
|---|---|
| `initBloom(scene, camera, renderer)` | 搭好两个 Composer、bloomLayer、darkMaterial 等内部状态 |
| `markAsBloomObject(object3D)` | 一个小工具,把某个对象子树的 layers enable bloom 层(封装遍历逻辑) |
| `renderBloomFrame()` | 每帧调用的渲染函数,包含"变黑 → A 渲染 → 恢复 → B 渲染"完整 4 步 |
| `resizeBloom(width, height)` | 窗口 resize 时同步两个 Composer 的 size |
| `disposeBloom()` | 释放两个 Composer 和 darkMaterial |

配置集中定义(与项目一贯风格一致):

```js
const config = {
    bloom: {
        strength: 2.2,
        radius: 0.55,
        threshold: 0.88,
    },
}
```

### 3.2 工作流拼装顺序(engine.js 改造)

按调用顺序列出:

```
initEngine(container) 流程:
  1. container.appendChild(renderer.domElement)
  2. await initSceneEnvironment(renderer)
  3. await initSkySphereTexture(); scene.add(skySphere)
  4. await initSun(); scene.add(sunAxis)
  5. markAsBloomObject(sunAxis)                    ← 太阳子树进入 bloom 层
  6. controls = createOrbitControls(...)
  7. initBloom(scene, camera, renderer)            ← 搭建 Composer
  8. startAnimation()

animate 循环里:
  - setSkySphereAutoRotation()
  - setSunAutoRotation()
  - controls.update()
  - renderBloomFrame()                             ← 替换原来的 renderer.render()

dispose 流程里:
  - cancelAnimationFrame(rafId)
  - controls.dispose()
  - disposeBloom()                                 ← 在 renderer.dispose() 之前调
  - renderer.dispose()
```

### 3.3 两个依赖关系必须注意的地方

**① `markAsBloomObject(sunAxis)` 必须在 `initSun()` 之后调用**

太阳的 Mesh 是异步从 GLTF 加载进 `sunAxis` 子树的,加载前 sunAxis 里没有 Mesh,traverse 会落空。

**② `initBloom()` 必须在 `scene`、`camera`、`renderer` 都准备好之后调用**

两个 Composer 构造时依赖 renderer,两个 RenderPass 构造时依赖 scene 和 camera。

### 3.4 利用已有的 `layers.js`

原项目里 `BLOOM_SCENE = 1` 是硬编码的,当前工程里已经有 `layers.bloom: 1`,在 `bloom.js` 里直接用即可:

```js
import {layers} from '@/three/base/layers.js'

const bloomLayer = new THREE.Layers()
bloomLayer.set(layers.bloom)
```

子树标记也是:

```js
function markAsBloomObject(object3D) {
    object3D.traverse((obj) => obj.layers.enable(layers.bloom))
}
```

### 3.5 需要导入的模块路径(配合 jsconfig 决定)

```js
import {EffectComposer}  from 'three/examples/jsm/postprocessing/EffectComposer'
import {RenderPass}      from 'three/examples/jsm/postprocessing/RenderPass'
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass'
import {ShaderPass}      from 'three/examples/jsm/postprocessing/ShaderPass'
```

(工程内已统一选用 `examples/jsm/...` 路径,不要误用 `three/addons/...`。)

### 3.6 一个潜在的改进点(先记下,不必现在做)

原项目的 "每个 Mesh 单独 `materials[obj.uuid] = obj.material`" 方案在场景物体很多时,每帧两次 `scene.traverse` + 一个 HashMap 读写,会有点性能开销。成熟的替代方案是 **`Selective Bloom via Masking`**(给 Mesh 加一个渲染遮罩),但那个复杂得多。当前场景只有十几个天体,完全不用优化。

---

## 小结

| 问题 | 回答 |
|---|---|
| 为什么需要两个 Composer? | A 专门生成"只含太阳光晕"的纹理;B 把这个纹理叠到正常场景上。一个 Composer 做不到"只让太阳泛光" |
| `renderTarget2.texture` 里是什么? | `bloomComposer` 的最终输出——一张只有太阳光晕的黑底纹理 |
| `darkenNonBloomed` 为什么要存在? | `UnrealBloomPass` 会对所有亮像素泛光,没有原生的"只对某些物体"API,必须物理上把其他物体变黑再渲染 |
| `ShaderPass` 的 Shader 做了什么? | 就做了一件事:`base + bloom`,加法叠加 |
| 哪些对象依赖 scene/camera/renderer? | `RenderPass`(scene + camera)、两个 `Composer`(renderer) |
| 每帧必须的 4 步? | ① 非太阳变黑 → ② bloom 渲染 → ③ 恢复材质 → ④ final 渲染 |
