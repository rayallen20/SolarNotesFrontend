import * as THREE from 'three'
import {EffectComposer} from "three/examples/jsm/postprocessing/EffectComposer.js";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass.js";
import {renderer} from "@/three/base/renderer.js";
import {scene} from "@/three/base/scene.js";
import {camera} from "@/three/base/camera.js";
import {UnrealBloomPass} from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass.js";
import {layers} from "@/three/base/layers.js";

/**
 * @type {Object} 后处理管线配置对象
 * @property {Object} bloomPass bloomPass工序配置对象
 * @property {import('three').Vector2} bloomPass.resolution 辉光效果输出纹理的宽高,通常设置为与屏幕分辨率相同
 * @property {Number} bloomPass.strength 辉光效果的强度,数值越大辉光越明显
 * @property {Number} bloomPass.radius 辉光效果的半径,数值越大辉光越模糊
 * @property {Number} bloomPass.threshold 辉光效果的阈值,只有亮度高于该阈值的像素可以产生辉光
 * */
const config = {
    bloomPass: {
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        strength: 2.2,
        radius: 0.55,
        threshold: 0.88,
    }
}

/**
 * @type {RenderPass}
 * 本常量用于定义后处理管线中的一道工序(pass这个单词本身就有`n. 一次扫描`的意思,放在3D开发的场景中,就表示管线中的一道工序),
 * 本工序用于将3D场景渲染成2D图像,作为后续工序的输入使用
 * */
const renderPass = new RenderPass(scene, camera)

/**
 * @type {UnrealBloomPass}
 * 本工序用于在图像上提取高亮像素并制造光晕
 * */
const bloomPass = new UnrealBloomPass(
    config.bloomPass.resolution,
    config.bloomPass.strength,
    config.bloomPass.radius,
    config.bloomPass.threshold,
)

/**
 * @type {EffectComposer}
 * 本常量用于定义渲染辉光的Pass管线,用于顺序执行 RenderPass + UnrealBloomPass
 * 本管线的输出结果是一个纯辉光画面(该画面会输出到离屏纹理而非直接输出到屏幕上),供后续的 shaderPass 合成使用
 * Tips: 渲染前需配合 `darkenNonBloomed()`函数,将非 bloom 层的物体临时替换成黑色材质,以便让本管线输出到离屏纹理的是:
 * Tips: 只有太阳辉光,其他全黑的纯辉光画面,然后供后续的 shaderPass 合成使用
 * */
const bloomComposer = new EffectComposer(renderer)

/**
 * @type {ShaderPass}
 * 本工序用于将场景的正常渲染结果和bloomComposer的辉光结果进行叠加(Add),最终输出到屏幕上
 * Tips: 该工序的输入有2个纹理:
 *      1. 场景的正常渲染结果(baseTexture)
 *      2. bloomComposer的辉光结果(bloomTexture)
 * Tips: 该工序的输出是将上述两个纹理进行叠加后的结果
 * */
const shaderPass = new ShaderPass(
    new THREE.ShaderMaterial({
        uniforms: {
            baseTexture: {value: null},
            bloomTexture: {value: bloomComposer.renderTarget2.texture},
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D baseTexture;
            uniform sampler2D bloomTexture;
            varying vec2 vUv;

            void main() {
                vec4 base = texture2D(baseTexture, vUv);
                vec4 bloom = texture2D(bloomTexture, vUv);
                gl_FragColor = base + bloom; // 叠加(Add)
            }
        `,
    }),
    'baseTexture',
)

/**
 * @type {EffectComposer}
 * 本常量用于定义合成最终结果的Pass管线,用于执行 RenderPass + ShaderPass
 * 本管线的输出结果将最终渲染到屏幕上
 * */
const shaderComposer = new EffectComposer(renderer)

/**
 * @type {import('three').Layers}
 * 本常量用于定义辉光图层
 * */
const bloomLayer = new THREE.Layers()
bloomLayer.set(layers.bloom)

/**
 * @type {import('three').MeshBasicMaterial}
 * 本常量用于定义黑色材质
 * */
const darkMaterial = new THREE.MeshBasicMaterial({color: 0x000000})

/**
 * @type {Object} 本常量用于备份被替换为黑色材质的物体的原始材质,以便在 bloomComposer 渲染完成后恢复
 * Tips: 以物体的 uuid 为key,原始材质为value
 * */
const originalMaterials = {}

/**
 * 本函数用于初始化用于后期处理的各Pass管线
 * */
function initComposers() {
    initBloomComposer()
    initShaderComposer()
}

/**
 * 本函数用于初始化渲染辉光的Pass管线,即:
 * 1. 设置管线输出结果到离屏纹理
 * 2. 将 RenderPass 和 UnrealBloomPass 添加到 bloomComposer 中
 * */
function initBloomComposer() {
    // 设置管线将结果不输出到屏幕上(即输出到离屏纹理中)
    bloomComposer.renderToScreen = false
    bloomComposer.addPass(renderPass)
    bloomComposer.addPass(bloomPass)
}

/**
 * 本函数用于初始化渲染合成结果的Pass管线,即:
 * 将 RenderPass 和 ShaderPass 依次添加到管线中,并将结果输出到屏幕上
 * 使得最终输出到屏幕上的结果是场景的正常渲染结果和辉光效果的叠加
 * */
function initShaderComposer() {
    shaderComposer.addPass(renderPass)
    shaderComposer.addPass(shaderPass)
}

/**
 * 本函数用于为给定Object3D对象及其子树添加辉光图层
 * @param {import('three').Object3D} object3D 给定的Object3D对象
 * */
function markAsBloomObject(object3D) {
    object3D.traverse(obj => {
        obj.layers.enable(layers.bloom)
    })
}

/**
 * 本函数用于渲染辉光效果,具体实现为:
 * - step1. 将不需要辉光效果的物体临时替换成黑色材质,以便让 bloomComposer 输出的结果是只有太阳辉光,其他全黑的纯辉光画面
 * - step2. 执行 bloomComposer 渲染辉光效果,输出到离屏纹理中
 * - step3. 恢复被替换成黑色材质的物体的原始材质
 * - step4. 执行 shaderComposer 将场景的正常渲染结果和 bloomComposer 的辉光结果进行叠加(Add),最终输出到屏幕上
 * */
function renderBloomFrame() {
    scene.traverse(darkenNonBloomed)
    bloomComposer.render()
    scene.traverse(restoreMaterial)
    shaderComposer.render()
}

/**
 * 本函数用于将给定物体的材质替换为黑色,若给定物体设置了Bloom图层,则不进行替换
 * @param {import('three').Object3D} object3D 给定的3D物体
 * */
function darkenNonBloomed(object3D) {
    if (!object3D.isMesh) {
        return
    }

    if (bloomLayer.test(object3D.layers)) {
        return
    }

    originalMaterials[object3D.uuid] = object3D.material
    object3D.material = darkMaterial
}

/**
 * 本函数用于恢复给定物体的材质
 * @param {import('three').Object3D} object3D 给定的3D物体
 * */
function restoreMaterial(object3D) {
    if (originalMaterials[object3D.uuid]) {
        object3D.material = originalMaterials[object3D.uuid]
        delete originalMaterials[object3D.uuid]
    }
}

/**
 * 本函数用于重置后期处理管线的渲染结果尺寸
 * @param {Number} width 视口宽度
 * @param {Number} height 视口高度
 * */
function resizeBloom(width, height) {
    bloomComposer.setSize(width, height)
    shaderComposer.setSize(width, height)
}

/**
 * 本函数用于释放后期处理管线处理时所需的资源
 * */
function disposeBloom() {
    bloomComposer.dispose()
    shaderComposer.dispose()
    darkMaterial.dispose()
}

export {
    initComposers,
    markAsBloomObject,
    renderBloomFrame,
    disposeBloom,
    resizeBloom,
}