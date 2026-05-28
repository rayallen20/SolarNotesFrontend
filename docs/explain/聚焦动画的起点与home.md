# 聚焦动画里的「起点 from」与「home」

> 缘起:`docs/design/聚焦与相机动画迁移设计.md` §5.5 中 `initFocusAnimation()` 的 JSDoc 写着「记录起点、(必要时)记录 home」。初读很容易把「动画起点」和「home」当成同一个东西——因为在「第一次进入聚焦」那一刻它们的值**确实相等**。这份文档讲清楚二者到底差在哪、为什么必须分开存两份;它们的区别只在**连续换焦**时才暴露出来。

## 1. 一句话区分

聚焦相机动画里有两个「位姿快照」。一个**位姿** = 一对 `THREE.Vector3`:相机位置 + 轨道中心(`controls.target`),因为 OrbitControls 的状态就是由这两者决定的。

- **起点 `from*`**(`fromCameraPosition` / `fromControlsTarget`):这一**段**动画从哪儿出发 =「相机此刻在哪」。每段动画开头都重新拍一次(进入、退出、换焦都覆盖)。
- **home `home*`**(`homeCameraPosition` / `homeControlsTarget`):进入聚焦**之前**那个自由浏览视角 =「彻底退出时要回到哪」。整个聚焦会话只拍**一次**,换焦不覆盖。

> 一句话:`from` 是**相对的、每段各自的**(永远是「现在相机在哪」);`home` 是**绝对的、整个会话唯一的**(只在第一次从 idle 进来时拍一张,专留给退出)。

## 2. 两者的写入与使用时机

|        | 起点 `from*`                                  | `home*`                                              |
| ------ | --------------------------------------------- | ---------------------------------------------------- |
| 变量   | `fromCameraPosition` / `fromControlsTarget`   | `homeCameraPosition` / `homeControlsTarget`          |
| 含义   | 本段动画的出发点 = 相机此刻的位姿             | 进入聚焦前的自由视角 = 退出时的归宿                   |
| 何时写 | **每段动画**开头都写(进入 / 退出 / 换焦)     | **仅** idle→focusing 第一次进入时写,受 `shouldCaptureHome` 守卫 |
| 用途   | lerp 的 **from**(起点向量)                   | 退出动画 lerp 的 **to**(终点向量)                   |
| 生命周期 | 短:每段动画各自重置                         | 长:整个聚焦会话唯一,换焦不覆盖                      |

### 代码证据

进入聚焦的一次性建立 `initFocusAnimation()`——`from` 无条件写,`home` 受守卫:

```js
function initFocusAnimation(store, camera, controls, nowMs) {
    // ...求 targetPosition...

    // 记录本段动画起点 —— 每次都写:相机此刻在哪,这段就从哪开始
    fromCameraPosition.copy(camera.position)
    fromControlsTarget.copy(controls.target)

    // 仅"从 idle 进入聚焦"时记录 home(re-focus 不覆盖,保证退出时回到最初位置)
    if (store.animation.shouldCaptureHome) {
        homeCameraPosition.copy(camera.position)
        homeControlsTarget.copy(controls.target)
    }

    // ...计算终点 to*(由目标天体的世界坐标算出)...
    controls.enabled = false
    store.markAnimationStart(nowMs)
}
```

退出聚焦的一次性建立 `initClearAnimation()`——终点直接取 `home`:

```js
function initClearAnimation(store, camera, controls, nowMs) {
    fromCameraPosition.copy(camera.position)    // 起点:当前(可能在 A 或 B 旁边)
    fromControlsTarget.copy(controls.target)
    toCameraPosition.copy(homeCameraPosition)   // 终点:home —— 退出就是回 home
    toControlsTarget.copy(homeControlsTarget)
    controls.enabled = false
    store.markAnimationStart(nowMs)
}
```

注意一个**不对称**:**进入**动画的终点 `to*` 是由「目标天体」算出来的;**退出**动画的终点 `to*` 则直接拷 `home*`。而 `from*` 在两个方向上都只是「当前相机」。每帧的插值对两端一视同仁:

```js
// advanceCameraLerp():from* ──k──▶ to*
camera.position.lerpVectors(fromCameraPosition, toCameraPosition, k)
controls.target.lerpVectors(fromControlsTarget, toControlsTarget, k)
```

> `target.updateWorldMatrix()` / `getWorldPosition()` 这些「读世界坐标」的含义,见 [世界坐标与本地坐标.md](./世界坐标与本地坐标.md)。

## 3. 决定性场景:换焦 A→B

单焦点(进去一个天体、再退出)场景下,`from` 和 `home` 看不出区别。真正分道扬镳的是**连续聚焦多个天体**:

```
① 自由浏览,视角 H。点击天体 A
   idle → focusing,shouldCaptureHome = true
   → home = H,from = H        (此刻二者相同 ← 容易混淆的根源)
   动画:H ──▶ A

② 已聚焦 A,相机停在 A 旁的视角 P_A。又点击天体 B(换焦)
   仍是 focusing,但上一刻 phase 是 focused,不是 idle
   → shouldCaptureHome = false → home 不动,仍是 H
   → from 重置为 P_A
   动画:P_A ──▶ B

③ 退出聚焦
   clearing,initClearAnimation:from = 当前 P_B,to = home = H
   动画:P_B ──▶ H        ← 回到最初的自由视角,而不是回到 A
```

## 4. 为什么必须分两份

**关键**:假如没有 `home`、退出时拿 `from` 当终点,第 ③ 步只会回到 `P_A`(上一段动画的起点),而不是用户最初进来的 `H`——那就错了。

`from` 会被每一次换焦覆盖,它记不住「最开始」。所以必须有一个**被换焦覆盖不了、钉死在最初**的快照,这就是 `home`。

- `from`:回答「这段动画从哪开始」→ 跟着每段走。
- `home`:回答「用户最初是从哪个视角进来的」→ 拍一次,之后无论换焦几次都不变。

## 5. 是谁保证了「home 只记一次」

是 store 里的 `shouldCaptureHome` 这个守卫。组件请求聚焦时:

```js
// useFocusStore.requestFocus(anchor)
animation.shouldCaptureHome = (phase.value === FocusPhase.idle)  // 仅「从 idle 进来」才为真
```

于是 `initFocusAnimation()` 里的 `if (store.animation.shouldCaptureHome)` 只在 idle→focusing 那一次成立;后续的换焦(focused→focusing)它为 `false`,`home` 自然不被覆盖。

> `shouldCaptureHome`(而非 `captureHome`)、`needsInit`(而非 `setupPending`)这些命名的来龙去脉,见设计文档 §5.4 与 §5.5。

## 6. 容易混淆的点

1. **「第一次进入时 from == home」不代表它们是同一个东西**——只是那一刻恰好都等于「当前相机」。换焦后立刻分开。
2. **`from` / `home` / `to` 是三个角色,不是三份无关数据**:`from` 永远是「当前」,`to` 是「这段去哪」(进入→天体算出,退出→home),`home` 只是给退出用的那个特殊 `to` 来源。
3. **一个「位姿」是两个向量**:相机位置 + 轨道中心(`controls.target`)。少存 `controls.target`,动画结束后绕轨道的中心会跳。
4. **`home` 存的是「聚焦前」而不是「上一个天体」**:这正是它存在的意义——退出永远回到用户自己选的那个自由视角。

## 7. 小结

- **起点 `from*`**:每段动画的出发点,永远 = 相机此刻位姿,每段都覆盖;充当 lerp 的 from。
- **home `home*`**:进入聚焦前的自由视角,只在 idle→focusing 记一次(`shouldCaptureHome` 守卫),换焦不覆盖;充当退出动画 lerp 的 to。
- 二者在**首次进入**时值相等,在**连续换焦**时分离——后者正是必须分开两份的理由。