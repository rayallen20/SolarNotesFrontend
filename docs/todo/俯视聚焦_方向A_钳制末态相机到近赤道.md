# 俯视聚焦 — 方向 A:钳制末态相机到"近赤道"

> 缘起:`docs/todo/俯视聚焦时天体偏离视口右侧_钳制相机极角.md` 的 20° 钳制(距极点)落地后实测发现**钳制角度太宽松**——按真实 `targetShift/desireDistance ≈ 0.82`,相机在 elevation 70° 时天体 NDC y ≈ -1.23(出屏底)。本方向是"加强版钳制":不再让相机"远离极点 20°"就停,而是**直接钳到接近赤道(水平视线)**,代价是 UX 上聚焦时相机会显著下沉/上扬到近平视。
>
> 平行方向是 `俯视聚焦_方向B_反算lookAt方向.md`,数学上能严格让天体落在 NDC (X_target, 0),但要重算 lookAt 方向。**先按本方向跑一遍代码、再按 B 跑一遍**,凭手感选效果对的那个。

---

## 1. 与原 doc 的关键差别

| | 原 doc(`MIN_POLAR_OFFSET_DEG = 20`) | 本方向(`MAX_ELEVATION_DEG = 15`) |
|---|---|---|
| 钳制条件 | 距视场极点 ≥ 20° | 距赤道 ≤ 15°(等价距极点 ≥ 75°) |
| 钳制后相机 elevation | ≤ 70° | ≤ 15° |
| 钳制触发的语义 | "相机不能贴极点" | "聚焦时相机几乎平视天体" |
| 末态 NDC y 残余 | -1.23 ~ -0.30(可见严重) | -0.24 ~ -0.08(基本贴近水平中线) |
| 用户从俯视进入聚焦的视觉感受 | 相机微微低头 | 相机**显著下沉到近平视**,俯视感损失明显 |

数学上看,残余偏移公式 `|sin(α)·cos(α)·(1-cos(Δφ))| / cos(α)·... / tan(fovY/2)` 在 α(相机 elevation)很小时整体 → 0。`α ≤ 15°` 时残余 ≤ 24%,`α ≤ 10°` 时残余 ≤ 16%,**只要把相机末态压到接近赤道,问题就消失**。

---

## 2. 改动详情

### 2.1 常量替换(`src/three/interaction/focus.js:14-26`)

**改前**(现状):

```js
const MIN_POLAR_OFFSET_DEG = 20

/**
 * @type {Number} 从被聚焦天体指向相机方向的单位向量在Y轴上的分量绝对值的最大值
 * */
const MAX_Y_ABS = Math.cos(THREE.MathUtils.degToRad(MIN_POLAR_OFFSET_DEG))

/**
 * @type {Number} 从被聚焦天体指向相机方向的单位向量在XZ平面上分量的最小长度
 * */
const MIN_XZ_LEN = Math.sin(THREE.MathUtils.degToRad(MIN_POLAR_OFFSET_DEG))
```

**改后**:

```js
/**
 * @type {Number} 聚焦末态相机相对天体的最大elevation角度(单位: 度)
 *      - 相机elevation > 该值时, 钳制到该值,等价于"末态相机几乎平视天体"
 *      - 调小: 末态相机更靠近赤道, NDC y残余更小, 俯视感损失更多
 *      - 调大: 末态相机保留更多俯视感, 但NDC y残余更大
 *      详细 trade-off 见对应 todo doc §3
 * */
const MAX_ELEVATION_DEG = 15

/**
 * @type {Number} 派生量: targetToCameraDirection.y 的绝对值上限 = sin(MAX_ELEVATION_DEG)
 *      超过此值时触发钳制
 * */
const MAX_Y_ABS = Math.sin(THREE.MathUtils.degToRad(MAX_ELEVATION_DEG))

/**
 * @type {Number} 派生量: 钳制后targetToCameraDirection在XZ平面内的投影长度 = cos(MAX_ELEVATION_DEG)
 * */
const MIN_XZ_LEN = Math.cos(THREE.MathUtils.degToRad(MAX_ELEVATION_DEG))
```

注意 `cos` 和 `sin` 与原 doc **互换**了——`MAX_Y_ABS` 在原 doc 里是 `cos(距极角)`,本方向里是 `sin(elevation角)`;`MIN_XZ_LEN` 同理互换。这是因为参考系从"距极点角度"换成了"距赤道角度",`Y分量 = sin(elevation) = cos(距极点)`,两者互补。

### 2.2 钳制块(`focus.js:148-167`)**无需改动**

钳制 if 块的结构不变:

```js
if (Math.abs(targetToCameraDirection.y) > MAX_Y_ABS) {
    const verticalSign = Math.sign(targetToCameraDirection.y) || 1
    const horizontalLen = Math.hypot(targetToCameraDirection.x, targetToCameraDirection.z)

    if (horizontalLen < 1e-6) {
        targetToCameraDirection.set(MIN_XZ_LEN, verticalSign * MAX_Y_ABS, 0)
    } else {
        const scale = MIN_XZ_LEN / horizontalLen
        targetToCameraDirection.x *= scale
        targetToCameraDirection.z *= scale
        targetToCameraDirection.y = verticalSign * MAX_Y_ABS
    }
}
```

逻辑完全相同——只是 `MAX_Y_ABS` 现在的数值从 0.94 变成 0.26,触发条件从 `|y| > 0.94`(极少触发)变成 `|y| > 0.26`(相机一旦超过 15° elevation 就触发)。

### 2.3 钳制注释更新

把钳制块上方的注释从"距Y轴极点不小于"改为"距赤道不大于":

```js
// 钳制聚焦末态相机的elevation, 使其不超过MAX_ELEVATION_DEG(=15°),
// 让相机几乎平视天体,从而避开 OrbitControls 的 y_axis_end 偏离世界Y轴
// 引起的"天体下沉"现象
if (Math.abs(targetToCameraDirection.y) > MAX_Y_ABS) {
    // ...
}
```

---

## 3. 钳制角度选择

`MAX_ELEVATION_DEG` 的可选值:

| MAX_ELEVATION_DEG | 末态 elevation 上限 | 末态 NDC y 残余 | 俯视感保留 |
|---|---|---|---|
| 5° | ~5° | ~0.08 | 几乎丢失 |
| **10°** | ~10° | ~0.16 | 少量保留 |
| **15°(推荐)** | ~15° | ~0.24 | 部分保留 |
| 20° | ~20° | ~0.30 | 保留较多 |
| 30° | ~30° | ~0.49 | 保留很多,但天体明显下沉 |

15° 是个比较平衡的选择——天体大致在水平中线下方 1/4 屏的位置,目测能接受;同时相机仍有"稍微俯视"的姿态感。

如果你觉得"15° 残余还是有点低"或"15° 视角下沉太狠",在 5°-30° 内调整即可,**只需要改 `MAX_ELEVATION_DEG` 这一个数**,其他两个派生常量自动跟随。

---

## 4. 实施步骤

1. 把 `src/three/interaction/focus.js:14-26` 三个 const 替换为 §2.1 改后版本(改名 + 改 cos/sin)
2. 把 §2.3 的注释更新到位
3. `npm run dev`,刷新页面
4. 按 §5 验收

---

## 5. 验收清单

- [ ] **关键修复**:把镜头拉到俯视(elevation > 60° 起),点击任一天体 → **末态相机自动下沉到近平视(elevation ≤ 15°)**,天体出现在视口右侧、几乎水平中线
- [ ] **拉远拉近不再敏感**:同样的俯视角下,先拉远再点 vs 拉近再点 → 末态天体的屏幕位置**基本一致**,不再随镜头距离而漂移
- [ ] **左右半屏不再敏感**:同样的俯视角下,点击天体在视口左半 vs 右半 → 末态天体位置一致(右侧水平中线附近)
- [ ] **仰视也对称生效**:把镜头压到天体下方往上看(elevation < -60°)→ 末态相机同样上扬到近平视
- [ ] **常规视角不受影响**:用户已在 elevation < 15° 视角下点击天体 → 钳制 if 不进入,行为与改前完全一致
- [ ] `home*` 仍捕获用户**进入聚焦前的原始俯视**位置 → 退出聚焦时相机回到原始俯视(不被钳制结果污染)
- [ ] 无 console 报错

---

## 6. UX 风险与权衡

### 6.1 视角跳变感受

本方向最大代价是**用户从俯视进入聚焦的"视角跳变"会很明显**——用户刚才在俯视行星公转,点了天体后相机突然下沉到近平视。如果跳变让你觉得突兀,可选解决方向(按代价从小到大):

1. **加长动画时长** `durationMs` 从 600 ms 上调到 1000-1200 ms,让视角过渡更柔和。`stores/focus.js` 里 animation typedef 一处修改
2. **MAX_ELEVATION_DEG 适当放宽到 20°-25°**,接受稍大的 NDC y 残余换取更少视角损失
3. **退出聚焦时不回到原始俯视,而是停在钳制后的位置**——`home*` 在钳制之后捕获(改 `focus.js:130-133` 顺序)。但这违反"home 是用户原始视角"的设计意图,不推荐

### 6.2 与方向 B 的比较点

实测两个方向的代码后,主要从这些角度挑:

| 评估角度 | 方向 A | 方向 B |
|---|---|---|
| 实现复杂度 | 几乎零(改 3 个常数) | 需要新增反算逻辑,几十行 |
| 末态天体精确度 | 残余 ~24% NDC y | 严格在 NDC (0.8, 0) |
| UX 视角连续性 | **跳变明显**(俯视 → 近平视) | **保留原视角**(俯视进、俯视出) |
| 极端俯视(elevation > 80°)兜底 | 自然包含 | 需要额外兜底 |
| 退出聚焦的体验 | home 仍是原始俯视,过渡平滑 | home 仍是原始俯视,但与 focus 时相机位姿差别小 |

如果你的产品方向更重 **"视角连续感(用户的视角选择被尊重)"** → 方向 B 大概率赢;如果更重 **"实现简单 + 稳定无 edge case"** → 方向 A 赢。

---

## 7. 未尽事项

### 7.1 设计文档同步

代码侧落地后,`docs/design/聚焦与相机动画迁移设计.md` §5.5 描述 `initFocusAnimation` 的章节需要更新——钳制常量名变了、含义也变了。这一步在本 todo 落地之后单独跟进。

### 7.2 之前那份 todo doc 的处理

`docs/todo/俯视聚焦时天体偏离视口右侧_钳制相机极角.md` §3 trade-off 表里的数值是按错误的 `targetShift/D` 比例算的(我之前估算时用了 0.1 而不是 0.82),与实测不符。**若本方向最终被选中,把那份 doc 标注为"被 `俯视聚焦_方向A_钳制末态相机到近赤道.md` 替代"或直接删除**——它的钳制阈值 20°(距极点)是本方向 15°(距赤道)的反面,逻辑残骸保留容易误导后人。