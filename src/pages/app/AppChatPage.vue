<template>
  <div class="chat-page">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-left">
        <a-button type="text" @click="router.push('/')">
          <template #icon><arrow-left-outlined /></template>
        </a-button>
        <span class="app-name-display">{{ appInfo?.appName || '新应用' }}</span>
      </div>
      <div class="header-right">
        <a-button type="primary" :loading="deploying" @click="handleDeploy">
          <template #icon><cloud-upload-outlined /></template>
          部署
        </a-button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="chat-content">
      <!-- Left: Chat Area -->
      <div class="chat-panel">
        <div class="messages-area" ref="messagesRef">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="['message-row', msg.role === 'user' ? 'user-row' : 'ai-row']"
          >
            <!-- AI Avatar -->
            <div v-if="msg.role === 'ai'" class="avatar-wrapper">
              <a-avatar :size="32" style="background: #FF8C42">🐱</a-avatar>
            </div>
            <!-- Message Bubble -->
            <div :class="['message-bubble', msg.role === 'user' ? 'user-bubble' : 'ai-bubble']">
              <!-- User messages -->
              <div v-if="msg.role === 'user'" class="message-text">{{ msg.content }}</div>
              <!-- AI messages with markdown parsing -->
              <div v-else class="ai-message-content">
                <div
                  v-for="(block, bIdx) in parseMessageBlocks(msg.content)"
                  :key="bIdx"
                  :class="block.type === 'code' ? 'code-block-wrapper' : 'text-block'"
                >
                  <!-- Text block -->
                  <template v-if="block.type === 'text'">
                    <span class="thinking-text" v-html="renderInlineText(block.content)"></span>
                  </template>
                  <!-- Code block -->
                  <template v-else>
                    <div class="code-block">
                      <div class="code-block-header">
                        <span class="code-lang">{{ block.lang || 'code' }}</span>
                        <a-button size="small" type="text" class="copy-btn" @click="copyCode(block.content)">
                          <template #icon><copy-outlined /></template>
                        </a-button>
                      </div>
                      <pre class="code-content"><code v-html="highlightCode(block.content, block.lang)"></code></pre>
                    </div>
                  </template>
                </div>
                <!-- Streaming cursor -->
                <span v-if="msg.loading" class="streaming-cursor"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Input Area -->
        <div class="input-area">
          <div class="input-card">
            <a-textarea
              v-model:value="inputText"
              :auto-size="{ minRows: 2, maxRows: 6 }"
              :bordered="false"
              placeholder="描述越详细，页面越具体，可以一步一步完善生成效果"
              @pressEnter.prevent="handleSend"
              :disabled="streaming"
            />
            <div class="input-bottom">
              <div class="input-tools">
                <a-button size="small"><upload-outlined /> 上传</a-button>
                <a-button size="small">✨ 优化</a-button>
              </div>
              <a-button
                v-if="!streaming"
                type="primary"
                shape="circle"
                :disabled="!inputText.trim()"
                @click="handleSend"
              >
                <template #icon><arrow-up-outlined /></template>
              </a-button>
              <a-button
                v-else
                type="primary"
                shape="circle"
                danger
                @click="stopStreaming"
              >
                <template #icon><pause-outlined /></template>
              </a-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Preview/Code Panel -->
      <div class="preview-panel">
        <!-- Panel Tab Bar -->
        <div class="panel-tabs">
          <div class="tab-group">
            <a-button
              :type="rightPanelMode === 'code' ? 'primary' : 'text'"
              size="small"
              @click="rightPanelMode = 'code'"
            >
              <template #icon><code-outlined /></template>
              代码
            </a-button>
            <a-button
              :type="rightPanelMode === 'preview' ? 'primary' : 'text'"
              size="small"
              @click="rightPanelMode = 'preview'"
            >
              <template #icon><eye-outlined /></template>
              预览
            </a-button>
          </div>
          <a-button
            v-if="rightPanelMode === 'preview'"
            size="small"
            type="text"
            @click="refreshPreview"
          >
            <template #icon><reload-outlined /></template>
          </a-button>
        </div>

        <!-- Code View -->
        <div v-if="rightPanelMode === 'code'" class="code-panel">
          <div v-if="codeFiles.length > 0" class="code-panel-content">
            <!-- File List -->
            <div class="file-list">
              <div class="file-list-header">文件</div>
              <div
                v-for="(file, idx) in codeFiles"
                :key="idx"
                :class="['file-item', { active: activeFileIndex === idx }]"
                @click="activeFileIndex = idx"
              >
                <file-outlined />
                <span class="file-name">{{ file.name }}</span>
              </div>
            </div>
            <!-- File Content -->
            <div class="file-content">
              <div class="file-content-header">
                <span>{{ codeFiles[activeFileIndex]?.name }}</span>
              </div>
              <pre class="file-code"><code v-html="highlightCode(codeFiles[activeFileIndex]?.content || '', codeFiles[activeFileIndex]?.lang)"></code></pre>
            </div>
          </div>
          <div v-else class="panel-placeholder">
            <code-outlined style="font-size: 48px; color: #D4C4B0" />
            <p>生成的代码文件将在这里显示</p>
          </div>
        </div>

        <!-- Preview View -->
        <div v-else class="preview-view">
          <div v-if="previewUrl" class="preview-container">
            <iframe
              :src="previewUrl"
              class="preview-iframe"
              :key="iframeKey"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
          <div v-else class="panel-placeholder">
            <eye-outlined style="font-size: 48px; color: #D4C4B0" />
            <p>网页预览将在生成完成后显示</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Deploy Result Modal -->
    <a-modal
      v-model:open="deployModalVisible"
      title="部署成功"
      :footer="null"
    >
      <a-result status="success" title="应用部署成功！">
        <template #extra>
          <p>访问地址：</p>
          <a :href="deployUrl" target="_blank" rel="noopener noreferrer">{{ deployUrl }}</a>
          <br /><br />
          <a-button type="primary" @click="copyUrl">复制链接</a-button>
        </template>
      </a-result>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  CloudUploadOutlined,
  UploadOutlined,
  ArrowUpOutlined,
  CodeOutlined,
  CopyOutlined,
  EyeOutlined,
  ReloadOutlined,
  FileOutlined,
  PauseOutlined,
} from '@ant-design/icons-vue'
import { getAppVoById, deployApp } from '@/api/appController'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import bash from 'highlight.js/lib/languages/bash'
import scss from 'highlight.js/lib/languages/scss'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('vue', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('python', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('scss', scss)

const BASE_URL = 'http://localhost:8123/api'

interface MessageBlock {
  type: 'text' | 'code'
  content: string
  lang?: string
}

interface CodeFile {
  name: string
  content: string
  lang: string
}

interface ChatMessage {
  role: 'user' | 'ai'
  content: string
  loading?: boolean
}

const route = useRoute()
const router = useRouter()

const appId = ref<string>(route.params.id as string)
const appInfo = ref<API.AppVO>()
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const streaming = ref(false)
const deploying = ref(false)
const previewUrl = ref('')
const iframeKey = ref(0)
const messagesRef = ref<HTMLElement>()
const rightPanelMode = ref<'code' | 'preview'>('preview')
const activeFileIndex = ref(0)
const eventSourceRef = ref<EventSource | null>(null)

const deployModalVisible = ref(false)
const deployUrl = ref('')

const parseMessageBlocks = (content: string): MessageBlock[] => {
  if (!content) return []

  const blocks: MessageBlock[] = []
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim()
      if (textContent) {
        blocks.push({ type: 'text', content: textContent })
      }
    }
    blocks.push({
      type: 'code',
      content: match[2].trim(),
      lang: match[1] || 'plaintext',
    })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim()
    if (remaining) {
      blocks.push({ type: 'text', content: remaining })
    }
  }

  return blocks
}

const highlightCode = (code: string, lang?: string): string => {
  if (!code) return ''
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  } catch {
    return code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

const renderInlineText = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

const codeFiles = computed<CodeFile[]>(() => {
  const files: CodeFile[] = []
  const lastAiMsg = [...messages.value].reverse().find(m => m.role === 'ai' && m.content)
  if (!lastAiMsg) return files

  const blocks = parseMessageBlocks(lastAiMsg.content)
  for (const block of blocks) {
    if (block.type === 'code' && block.content) {
      const lang = block.lang || 'plaintext'
      const ext = getExtByLang(lang)
      const name = guessFileName(block.content, lang, ext, files.length)
      files.push({ name, content: block.content, lang })
    }
  }
  return files
})

const getExtByLang = (lang: string): string => {
  const map: Record<string, string> = {
    html: '.html', css: '.css', javascript: '.js', js: '.js',
    typescript: '.ts', ts: '.ts', vue: '.vue', jsx: '.jsx',
    tsx: '.tsx', json: '.json', python: '.py', java: '.java',
    scss: '.scss', less: '.less', xml: '.xml', yaml: '.yml',
  }
  return map[lang] || `.${lang}`
}

const guessFileName = (content: string, lang: string, ext: string, index: number): string => {
  if (lang === 'html' || ext === '.html') {
    return 'index.html'
  }
  if (lang === 'css' || ext === '.css') {
    return index === 0 ? 'style.css' : `style${index}.css`
  }
  if (lang === 'javascript' || lang === 'js') {
    return index === 0 ? 'script.js' : `script${index}.js`
  }
  return `file${index > 0 ? index : ''}${ext}`
}

const copyCode = (code: string) => {
  navigator.clipboard.writeText(code).then(() => {
    message.success('代码已复制')
  })
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

const refreshPreview = () => {
  if (appInfo.value?.codeGenType && appInfo.value?.id) {
    previewUrl.value = `${BASE_URL}/static/${appInfo.value.codeGenType}_${appInfo.value.id}/`
    iframeKey.value++
  }
}

const closeEventSource = () => {
  eventSourceRef.value?.close()
  eventSourceRef.value = null
}

const stopStreaming = () => {
  closeEventSource()
  const lastAiMsg = [...messages.value].reverse().find((m) => m.role === 'ai' && m.loading)
  if (lastAiMsg) {
    lastAiMsg.loading = false
  }
  streaming.value = false
}

const parseSseContent = (data: string): string => {
  if (!data || data === '[DONE]') return ''

  try {
    const parsed = JSON.parse(data)
    if (typeof parsed === 'string') return parsed
    return parsed.d ?? parsed.content ?? parsed.data ?? ''
  } catch {
    return data
  }
}

const refreshAppAfterGeneration = async () => {
  const appRes = await getAppVoById({ id: appId.value })
  if (appRes.data.code === 0 && appRes.data.data) {
    appInfo.value = appRes.data.data
    refreshPreview()
    rightPanelMode.value = 'preview'
  }
}

const sendMessage = async (msg: string) => {
  if (!msg.trim() || streaming.value) return

  messages.value.push({ role: 'user', content: msg })
  const aiMsg: ChatMessage = { role: 'ai', content: '', loading: true }
  messages.value.push(aiMsg)
  scrollToBottom()

  streaming.value = true
  closeEventSource()

  await new Promise<void>((resolve) => {
    let streamCompleted = false

    const finishGeneration = async (shouldRefresh = true) => {
      if (streamCompleted) return
      streamCompleted = true
      aiMsg.loading = false
      streaming.value = false
      closeEventSource()

      if (shouldRefresh) {
        try {
          await refreshAppAfterGeneration()
        } catch {
          message.warning('生成完成，但刷新预览失败，请手动刷新')
        }
      }

      scrollToBottom()
      resolve()
    }

    const handleError = (error?: unknown) => {
      if (streamCompleted) return
      console.error('生成代码失败：', error)
      aiMsg.loading = false
      streaming.value = false
      closeEventSource()

      if (!aiMsg.content) {
        aiMsg.content = '生成失败，请重试'
      }
      message.error('生成出错，请重试')
      scrollToBottom()
      resolve()
    }

    try {
      const params = new URLSearchParams({
        appId: appId.value,
        message: msg,
      })
      const eventSource = new EventSource(`${BASE_URL}/app/chat/gen/code?${params}`, {
        withCredentials: true,
      })
      eventSourceRef.value = eventSource

      eventSource.onmessage = (event) => {
        if (streamCompleted) return
        const content = parseSseContent(event.data)
        if (content) {
          aiMsg.content += content
          aiMsg.loading = true
          scrollToBottom()
        }
      }

      eventSource.addEventListener('done', () => {
        void finishGeneration()
      })

      eventSource.onerror = (event) => {
        if (streamCompleted) return

        // Some SSE implementations complete by closing the connection without a done event.
        if (aiMsg.content) {
          void finishGeneration()
          return
        }

        handleError(event)
      }
    } catch (error) {
      handleError(error)
    }
  })
}

const handleSend = () => {
  if (!inputText.value.trim() || streaming.value) return
  const msg = inputText.value.trim()
  inputText.value = ''
  sendMessage(msg)
}

const handleDeploy = async () => {
  deploying.value = true
  try {
    const res = await deployApp({ appId: appId.value })
    if (res.data.code === 0 && res.data.data) {
      deployUrl.value = res.data.data
      deployModalVisible.value = true
    } else {
      message.error('部署失败：' + (res.data.message || '未知错误'))
    }
  } catch {
    message.error('部署失败')
  } finally {
    deploying.value = false
  }
}

const copyUrl = () => {
  navigator.clipboard.writeText(deployUrl.value).then(() => {
    message.success('链接已复制')
  })
}

onMounted(async () => {
  try {
    const res = await getAppVoById({ id: appId.value })
    if (res.data.code === 0 && res.data.data) {
      appInfo.value = res.data.data
      if (appInfo.value.codeGenType) {
        refreshPreview()
      }
      if (appInfo.value.initPrompt) {
        await sendMessage(appInfo.value.initPrompt)
      }
    } else {
      message.error('获取应用信息失败')
      router.push('/')
    }
  } catch {
    message.error('获取应用信息失败')
    router.push('/')
  }
})

onBeforeUnmount(() => {
  closeEventSource()
})
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg-warm, #FFF9EE);
  color: var(--color-text-dark, #4A3728);
  font-family: var(--font-body);
}

.chat-header {
  height: 52px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border-soft, #F0E4D4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-left :deep(.ant-btn) {
  color: var(--color-text-dark, #4A3728) !important;
}

.app-name-display {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-dark, #4A3728);
  font-family: var(--font-display);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Left Panel - Chat */
.chat-panel {
  width: 480px;
  min-width: 380px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border-soft, #F0E4D4);
  background: var(--color-bg-warm, #FFF9EE);
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
}

.messages-area::-webkit-scrollbar {
  width: 6px;
}

.messages-area::-webkit-scrollbar-thumb {
  background: #D4C4B0;
  border-radius: 3px;
}

.messages-area::-webkit-scrollbar-thumb:hover {
  background: #C0A88E;
}

.message-row {
  display: flex;
  margin-bottom: 20px;
  gap: 10px;
}

.user-row {
  flex-direction: row-reverse;
}

.avatar-wrapper {
  flex-shrink: 0;
}

.message-bubble {
  max-width: 90%;
  border-radius: 12px;
  padding: 12px 16px;
}

.user-bubble {
  background: var(--color-primary, #FF8C42);
  color: #fff;
  border-radius: 12px 12px 4px 12px;
  box-shadow: 0 2px 8px rgba(255, 140, 66, 0.2);
}

.ai-bubble {
  background: var(--color-card-bg, #FFFCF5);
  color: var(--color-text-dark, #4A3728);
  border: 1px solid var(--color-border-soft, #F0E4D4);
  border-radius: 12px 12px 12px 4px;
  padding: 12px 16px;
  max-width: 95%;
  box-shadow: 0 1px 4px rgba(74, 55, 40, 0.06);
}

.message-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.6;
}

/* AI message blocks */
.ai-message-content {
  font-size: 14px;
  line-height: 1.7;
}

.text-block {
  margin-bottom: 8px;
}

.thinking-text {
  color: var(--color-text-dark, #4A3728);
  line-height: 1.7;
}

.thinking-text :deep(.inline-code) {
  background: #FFF0E0;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  color: #C05621;
  border: 1px solid #F0E4D4;
}

/* Code Block */
.code-block-wrapper {
  margin: 12px 0;
}

.code-block {
  border-radius: 8px;
  overflow: hidden;
  background: #FFFAF3;
  border: 1px solid var(--color-border-soft, #F0E4D4);
}

.code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #FFF3E6;
  border-bottom: 1px solid var(--color-border-soft, #F0E4D4);
}

.code-lang {
  font-size: 12px;
  color: var(--color-text-light, #A89585);
  text-transform: uppercase;
  font-weight: 500;
}

.copy-btn {
  color: var(--color-text-light, #A89585) !important;
  font-size: 12px;
}

.copy-btn:hover {
  color: var(--color-primary, #FF8C42) !important;
}

.code-content {
  margin: 0;
  padding: 12px 16px;
  overflow-x: auto;
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: #FFFAF3;
}

.code-content code {
  font-family: inherit;
}

.code-content::-webkit-scrollbar {
  height: 6px;
}

.code-content::-webkit-scrollbar-thumb {
  background: #D4C4B0;
  border-radius: 3px;
}

/* Streaming cursor */
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: var(--color-primary, #FF8C42);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Input Area */
.input-area {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border-soft, #F0E4D4);
}

.input-card {
  background: var(--color-card-bg, #FFFCF5);
  border-radius: 12px;
  padding: 12px 16px 8px;
  border: 1px solid var(--color-border-soft, #F0E4D4);
  box-shadow: 0 1px 4px rgba(74, 55, 40, 0.06);
}

.input-card :deep(.ant-input) {
  background: transparent !important;
  color: var(--color-text-dark, #4A3728) !important;
  font-size: 14px;
}

.input-card :deep(.ant-input::placeholder) {
  color: var(--color-text-light, #A89585) !important;
}

.input-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.input-tools {
  display: flex;
  gap: 8px;
}

.input-tools :deep(.ant-btn) {
  color: var(--color-text-mid, #7A6555) !important;
  border-color: var(--color-border-soft, #F0E4D4) !important;
}

.input-tools :deep(.ant-btn:hover) {
  color: var(--color-primary, #FF8C42) !important;
  border-color: var(--color-primary-light, #FFB07A) !important;
}

/* Right Panel */
.preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-warm, #FFF9EE);
}

.panel-tabs {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border-soft, #F0E4D4);
  flex-shrink: 0;
}

.tab-group {
  display: flex;
  gap: 4px;
}

.tab-group :deep(.ant-btn) {
  border-radius: 6px !important;
  font-size: 13px;
}

.tab-group :deep(.ant-btn-text) {
  color: var(--color-text-mid, #7A6555) !important;
}

.tab-group :deep(.ant-btn-text:hover) {
  color: var(--color-primary, #FF8C42) !important;
  background: rgba(255, 140, 66, 0.08) !important;
}

/* Code Panel */
.code-panel {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.code-panel-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.file-list {
  width: 180px;
  min-width: 140px;
  border-right: 1px solid var(--color-border-soft, #F0E4D4);
  background: rgba(255, 255, 255, 0.6);
  overflow-y: auto;
}

.file-list-header {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-light, #A89585);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-mid, #7A6555);
  transition: all 0.15s;
}

.file-item:hover {
  background: rgba(255, 140, 66, 0.06);
  color: var(--color-text-dark, #4A3728);
}

.file-item.active {
  background: rgba(255, 140, 66, 0.12);
  color: var(--color-primary, #FF8C42);
  font-weight: 500;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-content-header {
  padding: 8px 16px;
  font-size: 13px;
  color: var(--color-text-mid, #7A6555);
  background: rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid var(--color-border-soft, #F0E4D4);
}

.file-code {
  flex: 1;
  margin: 0;
  padding: 16px;
  overflow: auto;
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  background: #FFFAF3;
}

.file-code code {
  font-family: inherit;
}

.file-code::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.file-code::-webkit-scrollbar-thumb {
  background: #D4C4B0;
  border-radius: 4px;
}

.file-code::-webkit-scrollbar-thumb:hover {
  background: #C0A88E;
}

/* Preview View */
.preview-view {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.preview-container {
  flex: 1;
  padding: 12px;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(74, 55, 40, 0.08);
}

/* Placeholder */
.panel-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-text-light, #A89585);
}

.panel-placeholder p {
  margin: 0;
  font-size: 14px;
}
</style>

<style>
/* highlight.js theme - Warm Light (matching site theme) */
.hljs {
  color: #4A3728;
  background: #FFFAF3;
}
.hljs-keyword { color: #C05621; }
.hljs-built_in { color: #B44D12; }
.hljs-type { color: #B44D12; }
.hljs-literal { color: #C05621; }
.hljs-number { color: #2B6CB0; }
.hljs-string { color: #38761D; }
.hljs-template-variable { color: #38761D; }
.hljs-regexp { color: #C53030; }
.hljs-title { color: #9C4221; }
.hljs-title.function_ { color: #9C4221; }
.hljs-title.class_ { color: #B44D12; }
.hljs-params { color: #4A3728; }
.hljs-comment { color: #A89585; font-style: italic; }
.hljs-doctag { color: #718096; }
.hljs-meta { color: #C05621; }
.hljs-attr { color: #2B6CB0; }
.hljs-attribute { color: #2B6CB0; }
.hljs-variable { color: #7A6555; }
.hljs-property { color: #2B6CB0; }
.hljs-tag { color: #C05621; }
.hljs-name { color: #C05621; }
.hljs-selector-tag { color: #9C4221; }
.hljs-selector-id { color: #9C4221; }
.hljs-selector-class { color: #9C4221; }
.hljs-section { color: #9C4221; }
.hljs-link { color: #2B6CB0; }
.hljs-operator { color: #4A3728; }
.hljs-punctuation { color: #7A6555; }
.hljs-subst { color: #4A3728; }
.hljs-symbol { color: #C05621; }
.hljs-addition { color: #38761D; background: rgba(56, 118, 29, 0.08); }
.hljs-deletion { color: #C53030; background: rgba(197, 48, 48, 0.08); }
</style>
