<template>
  <div class="chat-page">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-left">
        <a-button type="text" @click="router.push('/')">
          <template #icon><arrow-left-outlined /></template>
        </a-button>
        <span class="app-name-display">{{ appInfo?.appName || '新应用' }}</span>
        <a-tag v-if="codeGenTypeLabel" class="code-gen-type-tag" color="blue">
          {{ codeGenTypeLabel }}
        </a-tag>
      </div>
      <div class="header-right">
        <a-button @click="openAppInfoModal">
          <template #icon><info-circle-outlined /></template>
          应用详情
        </a-button>
        <a-button :loading="downloading" @click="handleDownloadCode">
          <template #icon><download-outlined /></template>
          下载代码
        </a-button>
        <a-button type="primary" :loading="deploying" @click="handleDeploy">
          <template #icon><cloud-upload-outlined /></template>
          部署
        </a-button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="chat-content">
      <!-- Left: Chat Area -->
      <div class="chat-panel" :style="{ width: chatPanelWidth + 'px' }">
        <div class="messages-area" ref="messagesRef">
          <!-- 顶部「加载更多历史消息」按钮 -->
          <div v-if="chatHistoryHasMore && messages.length > 0" class="load-more-wrapper">
            <a-button
              size="small"
              :loading="chatHistoryLoading"
              @click="loadChatHistory(true)"
            >
              加载更多历史消息
            </a-button>
          </div>
          <div v-else-if="!chatHistoryHasMore && messages.length > 0" class="history-end-tip">
            — 没有更多历史消息了 —
          </div>
          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="['message-row', msg.role === 'user' ? 'user-row' : 'ai-row']"
          >
            <!-- AI Avatar -->
            <div v-if="msg.role === 'ai'" class="avatar-wrapper">
              <a-avatar :size="32" :src="logoUrl" class="ai-avatar" />
            </div>
            <!-- User Avatar -->
            <div v-if="msg.role === 'user'" class="avatar-wrapper">
              <a-avatar :size="32" :src="loginUserStore.loginUser.userAvatar" class="user-avatar">
                {{ (loginUserStore.loginUser.userName || '我')[0] }}
              </a-avatar>
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
                        <a-button size="small" type="text" class="copy-btn" @click="copyCode(block.content, block.lang)">
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
          <a-alert
            v-if="selectedElement"
            class="selected-el-alert"
            type="info"
            closable
            @close="clearSelected"
          >
            <template #message>
              <div class="sel-line">选中元素：{{ selectedElementLabel }}</div>
            </template>
            <template #description>
              <div v-if="selectedElement.textContent" class="sel-line">
                内容：{{ selectedElement.textContent }}
              </div>
              <div class="sel-line">选择器：{{ selectedElement.selector }}</div>
            </template>
          </a-alert>
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

      <!-- Resizer: Drag to resize panels -->
      <div
        class="panel-resizer"
        :class="{ 'is-dragging': isResizing }"
        @mousedown="startResize"
        title="拖动调整面板宽度"
      >
        <div class="resizer-handle"></div>
      </div>

      <!-- Right: Preview/Code Panel -->
      <div class="preview-panel">
        <!-- Panel Tab Bar -->
        <div class="panel-tabs">
          <div class="tab-group">
            <a-button
              :type="rightPanelMode === 'code' ? 'primary' : 'text'"
              size="small"
              @click="switchRightPanelMode('code')"
            >
              <template #icon><code-outlined /></template>
              代码
            </a-button>
            <a-button
              :type="rightPanelMode === 'preview' ? 'primary' : 'text'"
              size="small"
              @click="switchRightPanelMode('preview')"
            >
              <template #icon><eye-outlined /></template>
              预览
            </a-button>
          </div>
          <div v-if="rightPanelMode === 'preview'" class="preview-actions">
            <a-button
              size="small"
              :type="editMode ? 'primary' : 'text'"
              :danger="editMode"
              :disabled="!previewUrl"
              @click="toggleEditMode"
            >
              <template #icon><edit-outlined /></template>
              {{ editMode ? '退出编辑' : '编辑模式' }}
            </a-button>
            <a-button
              size="small"
              type="text"
              :disabled="!previewUrl"
              @click="handleOpenInNewWindow"
            >
              <template #icon><export-outlined /></template>
              新窗口打开
            </a-button>
            <a-button size="small" type="text" @click="handleRefreshPreview">
              <template #icon><reload-outlined /></template>
              刷新
            </a-button>
          </div>
        </div>

        <!-- Code View -->
        <div v-if="rightPanelMode === 'code'" class="code-panel">
          <div v-if="codeFilesLoading" class="panel-placeholder">
            <LoadingOutlined style="font-size: 48px; color: #D4C4B0" spin />
            <p>正在加载项目代码文件...</p>
          </div>
          <div v-else-if="codeFiles.length > 0" class="code-panel-content">
            <!-- File Tree -->
            <div class="file-list">
              <div class="file-list-header">文件</div>
              <div
                v-for="item in flatFileTree"
                :key="item.path"
                :class="[
                  'tree-item',
                  item.type === 'folder' ? 'tree-folder' : 'tree-file',
                  { active: item.type === 'file' && activeFilePath === item.path },
                ]"
                :style="{ paddingLeft: 12 + item.depth * 16 + 'px' }"
                @click="handleTreeItemClick(item)"
              >
                <span class="tree-icon">
                  <folder-open-outlined v-if="item.type === 'folder' && expandedKeys.has(item.path)" />
                  <folder-outlined v-else-if="item.type === 'folder'" />
                  <file-outlined v-else />
                </span>
                <span class="file-name">{{ item.name }}</span>
              </div>
            </div>
            <!-- File Content -->
            <div class="file-content">
              <div class="file-content-header">
                <span>{{ activeFile?.path || '请选择文件' }}</span>
              </div>
              <pre v-if="activeFile" class="file-code"><code v-html="highlightCode(activeFile.content || '', activeFile.lang)"></code></pre>
              <div v-else class="file-empty-tip">从左侧选择文件查看代码</div>
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
              ref="previewIframeRef"
              :src="previewUrl"
              class="preview-iframe"
              :key="iframeKey"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              @load="onIframeLoad"
            />
          </div>
          <div v-else-if="buildingVue" class="panel-placeholder">
            <LoadingOutlined style="font-size: 48px; color: #D4C4B0" spin />
            <p>正在构建 Vue 项目，请稍候（约1~3分钟）...</p>
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

    <!-- App Info Modal -->
    <a-modal
      v-model:open="appInfoModalVisible"
      title="应用详情"
      :footer="null"
      :width="460"
      wrap-class-name="app-info-modal"
    >
      <div class="app-info-list">
        <div class="info-row">
          <span class="info-label">创建者：</span>
          <span class="info-value creator-cell">
            <a-avatar :size="24" :src="appInfo?.user?.userAvatar">
              {{ (appInfo?.user?.userName || '匿')[0] }}
            </a-avatar>
            <span class="creator-name">{{ appInfo?.user?.userName || '匿名用户' }}</span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">创建时间：</span>
          <span class="info-value">{{ formatDateTime(appInfo?.createTime) }}</span>
        </div>
        <div v-if="codeGenTypeLabel" class="info-row">
          <span class="info-label">生成类型：</span>
          <span class="info-value">
            <a-tag class="code-gen-type-tag" color="blue">{{ codeGenTypeLabel }}</a-tag>
          </span>
        </div>
        <div v-if="appInfo?.deployKey" class="info-row">
          <span class="info-label">部署地址：</span>
          <span class="info-value">
            <a :href="deployedAppUrl" target="_blank" rel="noopener noreferrer">{{ deployedAppUrl }}</a>
          </span>
        </div>
        <div v-if="appInfo?.deployedTime" class="info-row">
          <span class="info-label">部署时间：</span>
          <span class="info-value">{{ formatDateTime(appInfo?.deployedTime) }}</span>
        </div>
      </div>
      <div class="app-info-actions">
        <a-button type="primary" @click="goToEditPage">
          <template #icon><edit-outlined /></template>
          修改
        </a-button>
        <a-button danger :loading="deleting" @click="handleDelete">
          <template #icon><delete-outlined /></template>
          删除
        </a-button>
      </div>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  CloudUploadOutlined,
  UploadOutlined,
  ArrowUpOutlined,
  CodeOutlined,
  CopyOutlined,
  EyeOutlined,
  ReloadOutlined,
  ExportOutlined,
  FileOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  PauseOutlined,
  InfoCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LoadingOutlined,
} from '@ant-design/icons-vue'
import { getAppVoById, deployApp, deleteApp, downloadAppCode } from '@/api/appController'
import { listAppChatHistory } from '@/api/chatHistoryController'
import { listStaticSourceFiles, type SourceFileVO } from '@/api/staticResourceController'
import { useLoginUserStore } from '@/stores/loginUser'
import { createVisualEditor, type SelectedElementInfo } from '@/utils/visualEditor'
import logoUrl from '@/assets/logo.png'
import dayjs from 'dayjs'
import { formatCode } from '@/utils/codeFormatter'
import {
  buildFileTree,
  collectFolderPaths,
  findFileInTree,
  flattenFileTree,
  getFirstFilePath,
  parseCodeFilesFromMessages,
  type CodeFile,
  type FlatTreeItem,
} from '@/utils/fileTree'
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
// 预览静态资源使用相对路径，经 Vite 代理走主网站同源，
// 这样可视化编辑才能访问 iframe.contentDocument 注入脚本（同域名前提）
const PREVIEW_BASE_URL = '/api'

interface MessageBlock {
  type: 'text' | 'code'
  content: string
  lang?: string
}

interface ChatMessage {
  role: 'user' | 'ai'
  content: string
  loading?: boolean
}

const route = useRoute()
const router = useRouter()
const loginUserStore = useLoginUserStore()

const appId = ref<string>(route.params.id as string)
const appInfo = ref<API.AppVO>()
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const streaming = ref(false)
const deploying = ref(false)
const downloading = ref(false)
const previewUrl = ref('')
const buildingVue = ref(false)
const iframeKey = ref(0)
const messagesRef = ref<HTMLElement>()

// 可视化编辑相关
const previewIframeRef = ref<HTMLIFrameElement>()
const editMode = ref(false)
const selectedElement = ref<SelectedElementInfo | null>(null)
const visualEditor = createVisualEditor()
const rightPanelMode = ref<'code' | 'preview'>('preview')
const activeFilePath = ref('')
const expandedKeys = ref<Set<string>>(new Set())
const eventSourceRef = ref<EventSource | null>(null)
const projectCodeFiles = ref<CodeFile[]>([])
const codeFilesLoading = ref(false)
const codeFilesLoadedKey = ref('')

const deployModalVisible = ref(false)
const deployUrl = ref('')

const deployedAppUrl = computed(() => {
  if (!appInfo.value?.deployKey) return ''
  return `http://localhost/${appInfo.value.deployKey}/`
})

// codeGenType -> 展示文案映射
const CODE_GEN_TYPE_LABELS: Record<string, string> = {
  html: 'HTML 单页面',
  multi_file: 'MULTI_FILE 多文件',
  vue_project: 'VUE 工程项目',
}

const codeGenTypeLabel = computed(() => {
  const type = appInfo.value?.codeGenType
  if (!type) return ''
  return CODE_GEN_TYPE_LABELS[type] || type
})

const appInfoModalVisible = ref(false)
const deleting = ref(false)

// 对话历史游标分页相关状态
const CHAT_HISTORY_PAGE_SIZE = 10
const chatHistoryLoading = ref(false)
const chatHistoryHasMore = ref(true)
// 已加载历史消息中「最早一条」的 createTime，用作游标向前翻页
const earliestCreateTime = ref<string | undefined>(undefined)

// 左侧聊天面板宽度（可拖动调整）
const CHAT_PANEL_MIN_WIDTH = 320
const CHAT_PANEL_MAX_RATIO = 0.75 // 最多占据窗口宽度的 75%
const CHAT_PANEL_STORAGE_KEY = 'chat-panel-width'
const chatPanelWidth = ref<number>(480)
const isResizing = ref(false)

// 拖动相关：使用纯 DOM 事件而非 Vue 事件，避免拖动过程中跨元素导致丢失
let resizeStartX = 0
let resizeStartWidth = 0

const clampWidth = (w: number): number => {
  const maxByWindow = Math.floor(window.innerWidth * CHAT_PANEL_MAX_RATIO)
  return Math.min(Math.max(w, CHAT_PANEL_MIN_WIDTH), maxByWindow)
}

const doResize = (e: MouseEvent) => {
  if (!isResizing.value) return
  const delta = e.clientX - resizeStartX
  chatPanelWidth.value = clampWidth(resizeStartWidth + delta)
}

const stopResize = () => {
  if (!isResizing.value) return
  isResizing.value = false
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
  // 拖动结束恢复全局样式
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  // 记忆用户偏好
  try {
    localStorage.setItem(CHAT_PANEL_STORAGE_KEY, String(chatPanelWidth.value))
  } catch {
    // 忽略 localStorage 不可用的情况
  }
}

const startResize = (e: MouseEvent) => {
  e.preventDefault()
  isResizing.value = true
  resizeStartX = e.clientX
  resizeStartWidth = chatPanelWidth.value
  // 拖动期间禁用文本选中、统一光标
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
}

// 窗口尺寸变化时，确保面板宽度仍在合法范围内
const handleWindowResize = () => {
  chatPanelWidth.value = clampWidth(chatPanelWidth.value)
}

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
  // 模型常输出"一行多条声明"的紧凑 CSS / JS，先美化再交给 hljs 上色，
  // 避免在 UI 中所有代码挤成一行
  const formatted = formatCode(code, lang)
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(formatted, { language: lang }).value
    }
    return hljs.highlightAuto(formatted).value
  } catch {
    return formatted.replace(/</g, '&lt;').replace(/>/g, '&gt;')
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

const buildSourceDeployKey = (): string => {
  if (!appInfo.value?.codeGenType || !appInfo.value?.id) return ''
  return `${appInfo.value.codeGenType}_${appInfo.value.id}`
}

const normalizeSourceFile = (file: SourceFileVO): CodeFile => ({
  path: file.path,
  name: file.name || file.path.split('/').pop() || file.path,
  content: file.content || '',
  lang: file.lang || 'plaintext',
})

const loadProjectCodeFiles = async (force = false) => {
  const deployKey = buildSourceDeployKey()
  if (!deployKey || codeFilesLoading.value) return
  if (!force && codeFilesLoadedKey.value === deployKey) return

  codeFilesLoading.value = true
  try {
    const res = await listStaticSourceFiles({ deployKey })
    if (res.data.code === 0) {
      projectCodeFiles.value = (res.data.data || []).map(normalizeSourceFile)
      codeFilesLoadedKey.value = deployKey
      return
    }
    message.warning(res.data.message || '项目代码文件加载失败')
  } catch {
    message.warning('项目代码文件加载失败')
  } finally {
    codeFilesLoading.value = false
  }
}

const switchRightPanelMode = (mode: 'code' | 'preview') => {
  rightPanelMode.value = mode
  if (mode === 'code') {
    void loadProjectCodeFiles()
  }
}

watch(
  () => buildSourceDeployKey(),
  (deployKey, previousDeployKey) => {
    if (deployKey !== previousDeployKey) {
      projectCodeFiles.value = []
      codeFilesLoadedKey.value = ''
    }
  },
)

const codeFiles = computed<CodeFile[]>(() => {
  if (projectCodeFiles.value.length > 0) {
    return projectCodeFiles.value
  }
  return parseCodeFilesFromMessages(messages.value)
})

const fileTree = computed(() => buildFileTree(codeFiles.value))

const flatFileTree = computed(() => flattenFileTree(fileTree.value, expandedKeys.value))

const activeFile = computed(() => {
  if (!activeFilePath.value) return undefined
  const node = findFileInTree(fileTree.value, activeFilePath.value)
  if (!node || node.type !== 'file') return undefined
  return {
    path: node.path,
    name: node.name,
    content: node.content || '',
    lang: node.lang || 'plaintext',
  }
})

const handleTreeItemClick = (item: FlatTreeItem) => {
  if (item.type === 'folder') {
    const next = new Set(expandedKeys.value)
    if (next.has(item.path)) {
      next.delete(item.path)
    } else {
      next.add(item.path)
    }
    expandedKeys.value = next
    return
  }
  activeFilePath.value = item.path
}

watch(
  fileTree,
  (tree) => {
    if (tree.length === 0) {
      activeFilePath.value = ''
      expandedKeys.value = new Set()
      return
    }
    // 默认展开所有目录（不含 dist / node_modules）
    expandedKeys.value = new Set(collectFolderPaths(tree))
    const firstFile = getFirstFilePath(tree)
    if (firstFile && (!activeFilePath.value || !findFileInTree(tree, activeFilePath.value))) {
      activeFilePath.value = firstFile
    }
  },
  { immediate: true },
)

const copyCode = (code: string, lang?: string) => {
  // 复制时同样使用格式化后的内容，保持与展示一致
  const formatted = formatCode(code, lang)
  navigator.clipboard.writeText(formatted).then(() => {
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

// 后端 ChatHistory -> 前端 ChatMessage
const convertHistoryToMessage = (h: API.ChatHistory): ChatMessage => ({
  role: h.messageType === 'ai' ? 'ai' : 'user',
  content: h.message || '',
})

// 加载对话历史（游标分页）
// - 首次加载（isLoadMore = false）：不传 lastCreateTime，返回最新的 N 条 → reverse 后展示到底部
// - 加载更多（isLoadMore = true）：传当前已加载消息中最早一条的 createTime，向前翻一页
const loadChatHistory = async (isLoadMore = false) => {
  if (chatHistoryLoading.value) return
  if (isLoadMore && !chatHistoryHasMore.value) return
  chatHistoryLoading.value = true
  try {
    // 注意：雪花 ID 长度 18-19 位，超过 Number.MAX_SAFE_INTEGER，
    // 一旦用 Number() 转换会丢失末几位精度，导致后端按错误 ID 查询时报"应用不存在"。
    // 因此这里保持字符串形式，避免雪花 ID 精度丢失。
    const params: API.listAppChatHistoryParams = {
      appId: appId.value,
      pageSize: CHAT_HISTORY_PAGE_SIZE,
    }
    if (isLoadMore && earliestCreateTime.value) {
      params.lastCreateTime = earliestCreateTime.value
    }
    const res = await listAppChatHistory(params)
    if (res.data.code !== 0 || !res.data.data) {
      message.error('加载对话历史失败：' + (res.data.message || '未知错误'))
      return
    }
    // 后端按 createTime 降序返回，数组最后一条即为「最早」的一条，作为下一次游标
    const records = res.data.data.records ?? []
    if (records.length > 0) {
      const oldest = records[records.length - 1]
      if (oldest.createTime) {
        earliestCreateTime.value = oldest.createTime
      }
    }
    // 转换并反转：让 messages 内部保持「上方旧、下方新」的顺序
    const newMessages = records.map(convertHistoryToMessage).reverse()
    if (isLoadMore) {
      // 加载更多时需要保持当前视觉位置不被打乱（防止滚动跳动）
      const el = messagesRef.value
      const prevScrollHeight = el?.scrollHeight ?? 0
      const prevScrollTop = el?.scrollTop ?? 0
      messages.value.unshift(...newMessages)
      await nextTick()
      if (el) {
        el.scrollTop = el.scrollHeight - prevScrollHeight + prevScrollTop
      }
    } else {
      messages.value.unshift(...newMessages)
    }
    // 不足一页 → 没有更多了
    if (records.length < CHAT_HISTORY_PAGE_SIZE) {
      chatHistoryHasMore.value = false
    }
  } catch {
    message.error('加载对话历史失败')
  } finally {
    chatHistoryLoading.value = false
  }
}

// 拼接预览静态资源地址
const buildPreviewUrl = (): string => {
  if (!appInfo.value?.codeGenType || !appInfo.value?.id) return ''
  const base = `${PREVIEW_BASE_URL}/static/${appInfo.value.codeGenType}_${appInfo.value.id}`
  // Vue 工程项目构建产物在 dist/index.html
  if (appInfo.value?.codeGenType === 'vue_project') {
    return `${base}/dist/index.html`
  }
  return `${base}/`
}

// 强制展示预览：无条件设置 previewUrl 并刷新 iframe
// 用于 SSE done 事件场景——此时后端已确认代码生成完毕，无需再做 HEAD 探测
const showPreviewDirect = () => {
  const url = buildPreviewUrl()
  if (!url) return
  previewUrl.value = url
  iframeKey.value++
}

// 探测静态资源是否已生成（用于挂载时判断历史产物是否存在）
// retries：失败后再试几次（每次间隔 800ms）
const probePreview = async (retries = 0): Promise<boolean> => {
  const url = buildPreviewUrl()
  if (!url) {
    previewUrl.value = ''
    return false
  }
  try {
    const resp = await fetch(url, { method: 'HEAD', credentials: 'include' })
    if (resp.ok) {
      previewUrl.value = url
      iframeKey.value++
      return true
    }
  } catch {
    // 探测失败（CORS / 网络 / 资源不存在）一律走重试 / 占位符兜底
  }
  if (retries > 0) {
    await new Promise((r) => setTimeout(r, 800))
    return probePreview(retries - 1)
  }
  return false
}

// 轮询后端构建状态，构建完成后再展示预览
const pollBuildStatus = async () => {
  const maxAttempts = 90 // 最多轮询 90 次，每次 2 秒 = 3 分钟
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const resp = await fetch(`${BASE_URL}/app/build/status?appId=${appId.value}`, {
        credentials: 'include',
      })
      if (resp.ok) {
        const result = await resp.json()
        const status = result.data
        if (status === 'success') {
          buildingVue.value = false
          showPreviewDirect()
          return
        }
        if (status === 'failed') {
          buildingVue.value = false
          message.error('Vue 项目构建失败，请检查生成的代码')
          return
        }
      }
    } catch {
      // 网络错误继续重试
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  buildingVue.value = false
  message.warning('构建超时，请手动刷新预览')
}

// 用户手动点击刷新按钮：直接重新加载 iframe，让浏览器自己决定 200/404
const handleRefreshPreview = () => {
  if (!previewUrl.value) {
    // 还没设置过 URL，先探测一下，避免直接显示 404
    probePreview(1).then((ok) => {
      if (!ok) message.info('预览尚未生成，请稍后再试')
    })
    return
  }
  iframeKey.value++
}

// 选中元素的简要展示文案（标签 + id + class）
const selectedElementLabel = computed(() => {
  const el = selectedElement.value
  if (!el) return ''
  let label = el.tagName
  if (el.id) label += `#${el.id}`
  if (el.className) label += `.${el.className.trim().split(/\s+/).join('.')}`
  return label
})

// iframe 加载完成：重新绑定，若处于编辑模式则重新注入编辑脚本
const onIframeLoad = () => {
  visualEditor.setIframe(previewIframeRef.value ?? null)
  if (editMode.value) {
    visualEditor.enterEditMode()
  }
}

// 清除当前选中的元素
const clearSelected = () => {
  selectedElement.value = null
  visualEditor.clearSelection()
}

// 切换编辑模式
const toggleEditMode = () => {
  if (editMode.value) {
    editMode.value = false
    visualEditor.exitEditMode()
    clearSelected()
    return
  }
  // 进入编辑模式前确保停留在预览 tab
  rightPanelMode.value = 'preview'
  editMode.value = true
  visualEditor.setIframe(previewIframeRef.value ?? null)
  visualEditor.enterEditMode()
}

// 在新的浏览器标签页中打开生成的网站
const handleOpenInNewWindow = () => {
  if (!previewUrl.value) {
    message.info('预览尚未生成，请稍后再试')
    return
  }
  window.open(previewUrl.value, '_blank')
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
  }
  rightPanelMode.value = 'preview'
  // Vue 工程在 SSE 结束后还会异步执行 npm install + build，需轮询构建状态
  if (appInfo.value?.codeGenType === 'vue_project') {
    buildingVue.value = true
    await pollBuildStatus()
  } else {
    showPreviewDirect()
  }
}

const sendMessage = async (msg: string) => {
  if (!msg.trim() || streaming.value) return

  messages.value.push({ role: 'user', content: msg })
  // 占位 AI 消息，记录其在数组中的索引，后续通过索引访问响应式代理对象
  const aiMsgIndex = messages.value.length
  messages.value.push({ role: 'ai', content: '', loading: true })
  scrollToBottom()

  streaming.value = true
  closeEventSource()

  await new Promise<void>((resolve) => {
    let streamCompleted = false

    // 通过索引获取响应式代理，所有修改必须通过它才能触发模板更新
    const getAiMsg = () => messages.value[aiMsgIndex]

    const finishGeneration = async (shouldRefresh = true) => {
      if (streamCompleted) return
      streamCompleted = true
      const aiMsg = getAiMsg()
      if (aiMsg) aiMsg.loading = false
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
      const aiMsg = getAiMsg()
      if (aiMsg) {
        aiMsg.loading = false
        if (!aiMsg.content) {
          aiMsg.content = '生成失败，请重试'
        }
      }
      streaming.value = false
      closeEventSource()
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

      // 流式接收：每一个 chunk 直接通过响应式代理累加到 content，触发实时打字机渲染
      eventSource.onmessage = (event) => {
        if (streamCompleted) return
        const content = parseSseContent(event.data)
        if (!content) return
        const aiMsg = getAiMsg()
        if (!aiMsg) return
        aiMsg.content += content
        aiMsg.loading = true
        scrollToBottom()
      }

      // 后端结束事件：event: done
      eventSource.addEventListener('done', () => {
        void finishGeneration()
      })

      eventSource.onerror = (event) => {
        if (streamCompleted) return
        // 部分 SSE 实现会以关闭连接的方式结束，没有显式 done 事件
        const aiMsg = getAiMsg()
        if (aiMsg && aiMsg.content) {
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
  let msg = inputText.value.trim()
  // 若处于编辑模式且选中了元素，把元素信息拼进提示词
  if (selectedElement.value) {
    msg = visualEditor.buildPrompt(msg, selectedElement.value)
  }
  inputText.value = ''
  // 发送后清除选中并退出编辑模式
  if (editMode.value || selectedElement.value) {
    editMode.value = false
    visualEditor.exitEditMode()
    selectedElement.value = null
  }
  sendMessage(msg)
}

const handleDeploy = async () => {
  deploying.value = true
  const hideLoading = message.loading('正在构建并部署应用，可能需要几分钟，请耐心等待...', 0)
  try {
    const res = await deployApp({ appId: appId.value })
    if (res.data.code === 0 && res.data.data) {
      deployUrl.value = res.data.data
      deployModalVisible.value = true
      // 刷新应用信息以获取最新的 deployKey 和 deployedTime
      const appRes = await getAppVoById({ id: appId.value })
      if (appRes.data.code === 0 && appRes.data.data) {
        appInfo.value = appRes.data.data
      }
    } else {
      message.error('部署失败：' + (res.data.message || '未知错误'))
    }
  } catch {
    message.error('部署失败，请检查代码是否已生成或网络是否正常')
  } finally {
    hideLoading()
    deploying.value = false
  }
}

// 从响应头 Content-Disposition 中解析下载文件名
const parseFileNameFromHeader = (disposition?: string): string => {
  if (!disposition) return ''
  // 优先匹配 RFC 5987 的 filename*（可能含 URL 编码的中文名）
  const utf8Match = /filename\*=(?:UTF-8'')?["']?([^;"']+)["']?/i.exec(disposition)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }
  const match = /filename=["']?([^;"']+)["']?/i.exec(disposition)
  return match?.[1] ?? ''
}

const handleDownloadCode = async () => {
  if (!appId.value) return
  downloading.value = true
  const hideLoading = message.loading('正在打包代码，请稍候...', 0)
  try {
    const res = await downloadAppCode(
      { appId: appId.value },
      { responseType: 'blob' },
    )
    const blob = res.data as Blob
    // 后端出错时可能返回 JSON 错误体（仍是 blob），这里探测并提示
    if (blob.type && blob.type.includes('application/json')) {
      const text = await blob.text()
      let msg = '下载失败'
      try {
        const parsed = JSON.parse(text)
        msg = '下载失败：' + (parsed.message || '未知错误')
      } catch {
        // 解析失败保持默认提示
      }
      message.error(msg)
      return
    }
    const disposition = (res.headers?.['content-disposition'] ??
      res.headers?.['Content-Disposition']) as string | undefined
    const fileName =
      parseFileNameFromHeader(disposition) || `${appInfo.value?.appName || appId.value}.zip`
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success('代码下载成功')
  } catch {
    message.error('下载失败，请检查代码是否已生成或网络是否正常')
  } finally {
    hideLoading()
    downloading.value = false
  }
}

const copyUrl = () => {
  navigator.clipboard.writeText(deployUrl.value).then(() => {
    message.success('链接已复制')
  })
}

const formatDateTime = (time?: string): string => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const openAppInfoModal = () => {
  appInfoModalVisible.value = true
}

// 关闭"应用详情"弹窗后跳转到完整编辑页
const goToEditPage = () => {
  if (!appId.value) return
  appInfoModalVisible.value = false
  router.push(`/app/edit/${appId.value}`)
}

const handleDelete = () => {
  if (!appId.value) return
  Modal.confirm({
    title: '确认删除该应用？',
    content: '删除后将无法恢复，请谨慎操作。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      deleting.value = true
      try {
        const res = await deleteApp({ id: appId.value })
        if (res.data.code === 0 && res.data.data) {
          message.success('删除成功')
          appInfoModalVisible.value = false
          router.push('/')
        } else {
          message.error('删除失败：' + (res.data.message || '未知错误'))
        }
      } catch {
        message.error('删除失败')
      } finally {
        deleting.value = false
      }
    },
  })
}

onMounted(async () => {
  // 挂载可视化编辑：监听 iframe 回传的选中元素
  visualEditor.mount()
  visualEditor.onSelect((info) => {
    selectedElement.value = info
  })
  visualEditor.onClear(() => {
    selectedElement.value = null
  })

  // 恢复用户上次拖动的面板宽度
  try {
    const saved = localStorage.getItem(CHAT_PANEL_STORAGE_KEY)
    if (saved) {
      const parsed = Number(saved)
      if (!Number.isNaN(parsed)) {
        chatPanelWidth.value = clampWidth(parsed)
      }
    }
  } catch {
    // 忽略
  }
  window.addEventListener('resize', handleWindowResize)

  try {
    const res = await getAppVoById({ id: appId.value })
    if (res.data.code !== 0 || !res.data.data) {
      message.error('获取应用信息失败')
      router.push('/')
      return
    }
    appInfo.value = res.data.data

    // 加载最近一页对话历史
    await loadChatHistory(false)

    // 有 ≥ 2 条对话记录时，认为该应用已经生成过产物，直接展示网站预览
    if (messages.value.length >= 2 && appInfo.value.codeGenType) {
      if (appInfo.value.codeGenType === 'vue_project') {
        // Vue 项目：先探测 dist 是否已存在，不存在则轮询构建状态
        const exists = await probePreview(0)
        if (!exists) {
          buildingVue.value = true
          void pollBuildStatus()
        }
      } else {
        void probePreview(0)
      }
    }

    // 仅当「是应用所有者」且「无任何对话历史」时，才把 initPrompt 作为首条消息自动触发
    const isOwner =
      appInfo.value.userId != null &&
      loginUserStore.loginUser.id != null &&
      String(appInfo.value.userId) === String(loginUserStore.loginUser.id)
    if (isOwner && messages.value.length === 0 && appInfo.value.initPrompt) {
      await sendMessage(appInfo.value.initPrompt)
    } else {
      // 已有历史消息：滚到底部，模拟「打开聊天记录」的体验
      scrollToBottom()
    }
  } catch {
    message.error('获取应用信息失败')
    router.push('/')
  }
})

onBeforeUnmount(() => {
  closeEventSource()
  visualEditor.destroy()
  // 防止组件卸载时仍有未释放的全局事件监听
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
  window.removeEventListener('resize', handleWindowResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
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

.code-gen-type-tag {
  margin: 0;
  border-radius: 6px;
  font-weight: 500;
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

/* Left Panel - Chat：宽度由 :style 内联控制，可拖动调整 */
.chat-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-warm, #FFF9EE);
  overflow: hidden;
}

/* Resizer：可左右拖动的分隔条 */
.panel-resizer {
  flex-shrink: 0;
  position: relative;
  width: 6px;
  cursor: col-resize;
  background: var(--color-border-soft, #F0E4D4);
  transition: background-color 0.15s ease;
  user-select: none;
}

.panel-resizer:hover,
.panel-resizer.is-dragging {
  background: var(--color-primary-light, #FFB07A);
}

/* 中央把手提示，hover/拖动时更显眼 */
.resizer-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 36px;
  border-radius: 2px;
  background: var(--color-text-light, #A89585);
  opacity: 0.35;
  transition: opacity 0.15s ease, background-color 0.15s ease;
  pointer-events: none;
}

.panel-resizer:hover .resizer-handle,
.panel-resizer.is-dragging .resizer-handle {
  opacity: 1;
  background: #fff;
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

/* 顶部「加载更多 / 没有更多」提示 */
.load-more-wrapper {
  display: flex;
  justify-content: center;
  margin: 4px 0 16px;
}

.load-more-wrapper :deep(.ant-btn) {
  background: var(--color-card-bg, #FFFCF5) !important;
  border: 1px dashed var(--color-border-soft, #F0E4D4) !important;
  color: var(--color-text-mid, #7A6555) !important;
  border-radius: 16px !important;
  padding: 0 16px !important;
  height: 28px !important;
  font-size: 12px;
}

.load-more-wrapper :deep(.ant-btn:hover) {
  color: var(--color-primary, #FF8C42) !important;
  border-color: var(--color-primary-light, #FFB07A) !important;
}

.history-end-tip {
  text-align: center;
  margin: 4px 0 16px;
  font-size: 12px;
  color: var(--color-text-light, #A89585);
  letter-spacing: 1px;
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

.ai-avatar {
  background: #FFF3E6 !important;
  border: 1px solid var(--color-border-soft, #F0E4D4);
  padding: 2px;
}

.ai-avatar :deep(img) {
  object-fit: contain;
}

.user-avatar {
  background: var(--color-primary, #FF8C42) !important;
  color: #fff !important;
  font-weight: 600;
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

/* 选中元素提示 */
.selected-el-alert {
  margin-bottom: 8px;
  border-radius: 10px;
}

.selected-el-alert .sel-line {
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
}

.selected-el-alert :deep(.ant-alert-message) .sel-line {
  font-weight: 600;
  font-size: 13px;
}

.selected-el-alert :deep(.ant-alert-description) .sel-line {
  font-family: 'Fira Code', 'Consolas', monospace;
  color: var(--color-text-mid, #7A6555);
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

.preview-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.preview-actions :deep(.ant-btn) {
  border-radius: 6px !important;
  font-size: 13px;
}

.preview-actions :deep(.ant-btn-text) {
  color: var(--color-text-mid, #7A6555) !important;
}

.preview-actions :deep(.ant-btn-text:hover) {
  color: var(--color-primary, #FF8C42) !important;
  background: rgba(255, 140, 66, 0.08) !important;
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
  width: 220px;
  min-width: 180px;
  max-width: 280px;
  border-right: 1px solid var(--color-border-soft, #F0E4D4);
  background: rgba(255, 255, 255, 0.6);
  overflow-y: auto;
  flex-shrink: 0;
}

.file-list-header {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-light, #A89585);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.95);
  z-index: 1;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 6px 0;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-mid, #7A6555);
  transition: background-color 0.15s, color 0.15s;
  user-select: none;
}

.tree-item:hover {
  background: rgba(255, 140, 66, 0.06);
  color: var(--color-text-dark, #4A3728);
}

.tree-item.active {
  background: rgba(255, 140, 66, 0.12);
  color: var(--color-primary, #FF8C42);
  font-weight: 500;
}

.tree-folder {
  font-weight: 500;
}

.tree-icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  font-size: 14px;
  color: var(--color-text-light, #A89585);
}

.tree-item.active .tree-icon {
  color: var(--color-primary, #FF8C42);
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
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
  font-family: 'Fira Code', 'Consolas', monospace;
  color: var(--color-text-mid, #7A6555);
  background: rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid var(--color-border-soft, #F0E4D4);
}

.file-empty-tip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-light, #A89585);
  font-size: 14px;
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
/* App Info Modal —— a-modal 通过 portal 挂载到 body 之外，因此样式需要写在非 scoped 块中。
   使用 .app-info-modal 命名空间限定作用范围，避免污染其他 Modal。 */
.app-info-modal .app-info-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 24px;
}

.app-info-modal .info-row {
  display: flex;
  align-items: center;
  font-size: 14px;
  line-height: 1.6;
}

.app-info-modal .info-label {
  width: 88px;
  flex-shrink: 0;
  color: #7A6555;
}

.app-info-modal .info-value {
  flex: 1;
  color: #4A3728;
  word-break: break-all;
}

.app-info-modal .creator-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.app-info-modal .creator-name {
  font-weight: 500;
}

.app-info-modal .app-info-actions {
  display: flex;
  gap: 12px;
}

.app-info-modal .app-info-actions .ant-btn {
  flex: 1;
}

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
