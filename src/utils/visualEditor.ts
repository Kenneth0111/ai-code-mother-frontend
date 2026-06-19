/**
 * 可视化编辑工具
 *
 * 负责主网站与展示网站（iframe）之间的可视化编辑通信：
 * 1. 进入编辑模式时，向 iframe 文档注入高亮样式与编辑脚本；
 * 2. iframe 内脚本监听 hover / click，通过 postMessage 把选中元素信息回传主网站；
 * 3. 主网站监听 message，把选中元素同步给页面，并提供提示词拼接能力。
 *
 * 注意：依赖「主网站与展示网站同域名」，否则无法访问 iframe.contentDocument 注入脚本。
 */

/** 选中元素信息 */
export interface SelectedElementInfo {
  /** 标签名（小写），如 div、button */
  tagName: string
  /** 元素 id（可选） */
  id?: string
  /** 元素 class（已过滤编辑器内部类，可选） */
  className?: string
  /** 元素文本内容（截断到约 100 字，可选） */
  textContent?: string
  /** 简单选择器路径，便于在提示词中描述 */
  selector: string
}

/** 主网站 -> iframe 的控制消息类型 */
const MSG_ENABLE = 'VISUAL_EDITOR_ENABLE'
const MSG_DISABLE = 'VISUAL_EDITOR_DISABLE'
const MSG_CLEAR = 'VISUAL_EDITOR_CLEAR'
/** iframe -> 主网站 的选中消息类型 */
const MSG_SELECT = 'VISUAL_EDITOR_SELECT'

type SelectHandler = (info: SelectedElementInfo) => void
type VoidHandler = () => void

/**
 * 注入到 iframe 内执行的编辑脚本（IIFE 字符串）。
 * 运行在展示网站上下文中，负责 hover / click 高亮与 postMessage 回传。
 */
const buildInjectScript = (): string => `
(function () {
  if (window.__visualEditorInjected__) return;
  window.__visualEditorInjected__ = true;

  var HOVER_CLASS = '__ve-hover__';
  var SELECTED_CLASS = '__ve-selected__';
  var enabled = false;
  var selectedEl = null;

  function isInternalClass(c) {
    return c === HOVER_CLASS || c === SELECTED_CLASS;
  }

  function cleanClassName(el) {
    if (!el || typeof el.className !== 'string') return '';
    return el.className
      .split(/\\s+/)
      .filter(function (c) { return c && !isInternalClass(c); })
      .join(' ');
  }

  function nthChildIndex(node) {
    var i = 1;
    var sib = node;
    while ((sib = sib.previousElementSibling)) i++;
    return i;
  }

  function buildSelector(el) {
    var path = [];
    var node = el;
    while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== 'html' && path.length < 6) {
      var sel = node.tagName.toLowerCase();
      if (node.id) {
        sel += '#' + node.id;
        path.unshift(sel);
        break;
      }
      var cls = cleanClassName(node).split(/\\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) sel += '.' + cls.join('.');
      if (node.parentElement) sel += ':nth-child(' + nthChildIndex(node) + ')';
      path.unshift(sel);
      node = node.parentElement;
    }
    return path.join(' > ');
  }

  function getElementInfo(el) {
    var cls = cleanClassName(el);
    var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    return {
      tagName: el.tagName.toLowerCase(),
      id: el.id || undefined,
      className: cls || undefined,
      textContent: text ? text.slice(0, 100) : undefined,
      selector: buildSelector(el)
    };
  }

  function clearHover() {
    var nodes = document.querySelectorAll('.' + HOVER_CLASS);
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove(HOVER_CLASS);
  }

  function clearSelected() {
    if (selectedEl) {
      selectedEl.classList.remove(SELECTED_CLASS);
      selectedEl = null;
    }
  }

  function onMouseOver(e) {
    if (!enabled) return;
    if (e.target && e.target.classList) e.target.classList.add(HOVER_CLASS);
  }

  function onMouseOut(e) {
    if (!enabled) return;
    if (e.target && e.target.classList) e.target.classList.remove(HOVER_CLASS);
  }

  function onClick(e) {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    if (!el || el.nodeType !== 1) return;
    // 先采集信息，避免选中类影响 className / selector
    var info = getElementInfo(el);
    clearSelected();
    selectedEl = el;
    el.classList.add(SELECTED_CLASS);
    parent.postMessage({ type: '${MSG_SELECT}', payload: info }, '*');
  }

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);

  window.addEventListener('message', function (e) {
    var data = e.data || {};
    switch (data.type) {
      case '${MSG_ENABLE}':
        enabled = true;
        break;
      case '${MSG_DISABLE}':
        enabled = false;
        clearHover();
        clearSelected();
        break;
      case '${MSG_CLEAR}':
        clearSelected();
        break;
    }
  });
})();
`

/** 注入到 iframe 内的高亮样式 */
const INJECT_STYLE = `
.__ve-hover__ {
  outline: 2px dashed #FFB07A !important;
  outline-offset: -2px !important;
  cursor: pointer !important;
}
.__ve-selected__ {
  outline: 3px solid #FF6B1A !important;
  outline-offset: -3px !important;
  background-color: rgba(255, 140, 66, 0.08) !important;
}
`

const STYLE_ELEMENT_ID = '__visual-editor-style__'
const SCRIPT_ELEMENT_ID = '__visual-editor-script__'

export interface VisualEditor {
  /** 绑定（或更新）目标 iframe */
  setIframe: (el: HTMLIFrameElement | null) => void
  /** 进入编辑模式：注入脚本并启用高亮 */
  enterEditMode: () => void
  /** 退出编辑模式：禁用高亮并清除选中 */
  exitEditMode: () => void
  /** 清除当前选中元素 */
  clearSelection: () => void
  /** 注册选中回调 */
  onSelect: (cb: SelectHandler) => void
  /** 注册清除回调 */
  onClear: (cb: VoidHandler) => void
  /** 把选中元素信息拼接进用户提示词 */
  buildPrompt: (userMessage: string, info: SelectedElementInfo) => string
  /** 挂载主网站侧 message 监听 */
  mount: () => void
  /** 卸载并清理 */
  destroy: () => void
}

export const createVisualEditor = (): VisualEditor => {
  let iframe: HTMLIFrameElement | null = null
  const selectHandlers: SelectHandler[] = []
  const clearHandlers: VoidHandler[] = []

  const getIframeDoc = (): Document | null => {
    if (!iframe) return null
    try {
      // 跨域时访问 contentDocument 会抛 SecurityError
      return iframe.contentDocument || iframe.contentWindow?.document || null
    } catch (e) {
      console.warn('[visualEditor] 无法访问 iframe 文档（可能跨域）：', e)
      return null
    }
  }

  const postToIframe = (type: string) => {
    try {
      iframe?.contentWindow?.postMessage({ type }, '*')
    } catch (e) {
      console.warn('[visualEditor] 向 iframe 发送消息失败：', e)
    }
  }

  /** 向 iframe 文档注入样式与脚本（幂等） */
  const inject = (): boolean => {
    const doc = getIframeDoc()
    if (!doc || !doc.head || !doc.body) return false
    try {
      if (!doc.getElementById(STYLE_ELEMENT_ID)) {
        const style = doc.createElement('style')
        style.id = STYLE_ELEMENT_ID
        style.textContent = INJECT_STYLE
        doc.head.appendChild(style)
      }
      if (!doc.getElementById(SCRIPT_ELEMENT_ID)) {
        const script = doc.createElement('script')
        script.id = SCRIPT_ELEMENT_ID
        script.textContent = buildInjectScript()
        doc.body.appendChild(script)
      }
      return true
    } catch (e) {
      console.warn('[visualEditor] 注入编辑脚本失败：', e)
      return false
    }
  }

  const handleMessage = (e: MessageEvent) => {
    // 仅接收来自当前 iframe 的消息
    if (iframe && e.source !== iframe.contentWindow) return
    const data = e.data
    if (!data || data.type !== MSG_SELECT) return
    const info = data.payload as SelectedElementInfo
    selectHandlers.forEach((cb) => cb(info))
  }

  return {
    setIframe(el) {
      iframe = el
    },

    enterEditMode() {
      const ok = inject()
      if (!ok) {
        console.warn('[visualEditor] 编辑脚本注入失败，可视化编辑可能不可用')
        return
      }
      postToIframe(MSG_ENABLE)
    },

    exitEditMode() {
      postToIframe(MSG_DISABLE)
      clearHandlers.forEach((cb) => cb())
    },

    clearSelection() {
      postToIframe(MSG_CLEAR)
      clearHandlers.forEach((cb) => cb())
    },

    onSelect(cb) {
      selectHandlers.push(cb)
    },

    onClear(cb) {
      clearHandlers.push(cb)
    },

    buildPrompt(userMessage, info) {
      const lines: string[] = []
      const attrs: string[] = [info.tagName]
      if (info.id) attrs.push(`id="${info.id}"`)
      if (info.className) attrs.push(`class="${info.className}"`)
      lines.push(userMessage.trim())
      lines.push('')
      lines.push('[用户选中的页面元素]')
      lines.push(`标签: <${attrs.join(' ')}>`)
      lines.push(`选择器: ${info.selector}`)
      if (info.textContent) lines.push(`文本: ${info.textContent}`)
      lines.push('请重点针对该元素进行修改。')
      return lines.join('\n')
    },

    mount() {
      window.addEventListener('message', handleMessage)
    },

    destroy() {
      window.removeEventListener('message', handleMessage)
      selectHandlers.length = 0
      clearHandlers.length = 0
      iframe = null
    },
  }
}
