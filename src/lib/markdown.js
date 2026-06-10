import {marked} from "marked";
import {markedHighlight} from "marked-highlight";
import DOMPurify from "dompurify";
import hljs from "highlight.js";

// marked:用于将Markdown转为HTML,启用常见GFM语法
marked.setOptions({
    gfm: true,
    breaks: true,
})

// 在marked的代码块渲染阶段接入highlight.js语法高亮
marked.use(markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, language) {
        // 若代码块显式声明且是已支持语言 则按声明语言高亮
        if (language && hljs.getLanguage(language)) {
            return hljs.highlight(code, {language}).value
        }

        // 未声明语言时自动猜测 保证仍有可读的高亮效果
        return hljs.highlightAuto(code).value
    },
}))

/**
 * 本函数用于将md文本渲染为安全HTML
 * 处理流程: marked解析 -> highlight.js高亮 -> DOMPurify清洗
 * @param {String} markdown 原始md文档文本
 * @returns {String} 可直接用于innerHTML的HTML字符串
 * */
export function renderMarkdownToHtml(markdown) {
    // 先渲染,再做sanitize,避免脚本/危险属性注入
    const rawHtml = marked.parse(String(markdown || ''), {async: false})
    return DOMPurify.sanitize(rawHtml, {
        USE_PROFILES: {
            html: true
        },
    })
}
