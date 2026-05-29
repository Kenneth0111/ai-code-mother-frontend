/** 代码面板中展示的文件信息 */
export interface CodeFile {
  /** 相对路径，如 src/pages/Home.vue */
  path: string
  /** 文件名，如 Home.vue */
  name: string
  content: string
  lang: string
}

/** 文件树节点 */
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
  content?: string
  lang?: string
}

/** 扁平化后的树节点，便于 v-for 渲染 */
export interface FlatTreeItem {
  name: string
  path: string
  type: 'file' | 'folder'
  depth: number
  content?: string
  lang?: string
}

const EXCLUDED_DIRS = new Set(['dist', 'node_modules'])

/** Vue 工程工具写入文件的消息格式 */
const TOOL_FILE_REGEX = /\[工具调用🔧\]\s*写入文件\s+([^\n\r]+)\r?\n```(\w*)\r?\n?([\s\S]*?)```/g

const CODE_BLOCK_REGEX = /```(\w*)\n?([\s\S]*?)```/g

const shouldExcludePath = (filePath: string): boolean => {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.split('/').some((part) => EXCLUDED_DIRS.has(part))
}

const inferLangFromPath = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    html: 'html',
    css: 'css',
    js: 'javascript',
    ts: 'typescript',
    vue: 'vue',
    json: 'json',
    jsx: 'jsx',
    tsx: 'tsx',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
  }
  return map[ext] || ext || 'plaintext'
}

const normalizeLangKey = (lang: string): string => {
  const l = lang.toLowerCase()
  if (l === 'js') return 'javascript'
  if (l === 'ts') return 'typescript'
  return l
}

const getExtByLang = (lang: string): string => {
  const map: Record<string, string> = {
    html: '.html',
    css: '.css',
    javascript: '.js',
    js: '.js',
    typescript: '.ts',
    ts: '.ts',
    vue: '.vue',
    jsx: '.jsx',
    tsx: '.tsx',
    json: '.json',
    python: '.py',
    java: '.java',
    scss: '.scss',
    less: '.less',
    xml: '.xml',
    yaml: '.yml',
  }
  return map[lang] || `.${lang}`
}

const guessFileName = (content: string, lang: string, ext: string, index: number): string => {
  if (lang === 'html' || ext === '.html') return 'index.html'
  if (lang === 'css' || ext === '.css') return index === 0 ? 'style.css' : `style${index}.css`
  if (lang === 'javascript' || lang === 'js') return index === 0 ? 'script.js' : `script${index}.js`
  return `file${index > 0 ? index : ''}${ext}`
}

/** 从单条 AI 消息中解析带真实路径的文件 */
const parseToolWrittenFiles = (content: string): CodeFile[] => {
  const files: CodeFile[] = []
  let match: RegExpExecArray | null
  const regex = new RegExp(TOOL_FILE_REGEX.source, 'g')
  while ((match = regex.exec(content)) !== null) {
    const path = match[1].trim().replace(/\\/g, '/')
    if (shouldExcludePath(path)) continue
    const lang = match[2] || inferLangFromPath(path)
    files.push({
      path,
      name: path.split('/').pop() || path,
      content: match[3].trim(),
      lang,
    })
  }
  return files
}

/** 从单条 AI 消息中解析普通代码块（HTML / 多文件模式兜底） */
const parsePlainCodeBlocks = (content: string): CodeFile[] => {
  const files: CodeFile[] = []
  const langCounters: Record<string, number> = {}
  let match: RegExpExecArray | null
  const regex = new RegExp(CODE_BLOCK_REGEX.source, 'g')
  while ((match = regex.exec(content)) !== null) {
    const blockContent = match[2].trim()
    if (!blockContent) continue
    const lang = match[1] || 'plaintext'
    const ext = getExtByLang(lang)
    const key = normalizeLangKey(lang)
    const sameTypeIndex = langCounters[key] ?? 0
    const path = guessFileName(blockContent, lang, ext, sameTypeIndex)
    langCounters[key] = sameTypeIndex + 1
    files.push({
      path,
      name: path,
      content: blockContent,
      lang,
    })
  }
  return files
}

/** 从所有 AI 消息聚合代码文件，同路径以后出现的为准 */
export const parseCodeFilesFromMessages = (
  messages: Array<{ role: string; content: string }>,
): CodeFile[] => {
  const fileMap = new Map<string, CodeFile>()
  let hasToolFiles = false

  for (const msg of messages) {
    if (msg.role !== 'ai' || !msg.content) continue
    const toolFiles = parseToolWrittenFiles(msg.content)
    if (toolFiles.length > 0) {
      hasToolFiles = true
      for (const file of toolFiles) {
        fileMap.set(file.path, file)
      }
    }
  }

  if (hasToolFiles) {
    return Array.from(fileMap.values()).sort((a, b) => a.path.localeCompare(b.path))
  }

  // HTML / 多文件模式：仅解析最后一条 AI 消息
  const lastAiMsg = [...messages].reverse().find((m) => m.role === 'ai' && m.content)
  if (!lastAiMsg) return []
  return parsePlainCodeBlocks(lastAiMsg.content)
}

const sortTreeNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/** 将扁平文件列表构建为目录树 */
export const buildFileTree = (files: CodeFile[]): FileTreeNode[] => {
  const root: FileTreeNode[] = []

  const findOrCreateFolder = (children: FileTreeNode[], name: string, path: string): FileTreeNode => {
    let folder = children.find((n) => n.type === 'folder' && n.name === name)
    if (!folder) {
      folder = { name, path, type: 'folder', children: [] }
      children.push(folder)
    }
    return folder
  }

  for (const file of files) {
    if (shouldExcludePath(file.path)) continue
    const parts = file.path.replace(/\\/g, '/').split('/').filter(Boolean)
    if (parts.length === 0) continue

    let currentChildren = root
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isFile = i === parts.length - 1

      if (isFile) {
        currentChildren.push({
          name: part,
          path: currentPath,
          type: 'file',
          content: file.content,
          lang: file.lang,
        })
      } else {
        const folder = findOrCreateFolder(currentChildren, part, currentPath)
        currentChildren = folder.children!
      }
    }
  }

  const sortRecursive = (nodes: FileTreeNode[]): FileTreeNode[] => {
    const sorted = sortTreeNodes(nodes)
    for (const node of sorted) {
      if (node.type === 'folder' && node.children) {
        node.children = sortRecursive(node.children)
      }
    }
    return sorted
  }

  return sortRecursive(root)
}

/** 将目录树扁平化为可渲染列表 */
export const flattenFileTree = (
  nodes: FileTreeNode[],
  expandedKeys: Set<string>,
  depth = 0,
): FlatTreeItem[] => {
  const result: FlatTreeItem[] = []
  for (const node of nodes) {
    result.push({
      name: node.name,
      path: node.path,
      type: node.type,
      depth,
      content: node.content,
      lang: node.lang,
    })
    if (node.type === 'folder' && expandedKeys.has(node.path) && node.children?.length) {
      result.push(...flattenFileTree(node.children, expandedKeys, depth + 1))
    }
  }
  return result
}

/** 收集所有文件夹路径，用于默认展开 */
export const collectFolderPaths = (nodes: FileTreeNode[]): string[] => {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      paths.push(node.path)
      if (node.children) {
        paths.push(...collectFolderPaths(node.children))
      }
    }
  }
  return paths
}

/** 获取第一个文件的路径 */
export const getFirstFilePath = (nodes: FileTreeNode[]): string | undefined => {
  for (const node of nodes) {
    if (node.type === 'file') return node.path
    if (node.type === 'folder' && node.children) {
      const nested = getFirstFilePath(node.children)
      if (nested) return nested
    }
  }
  return undefined
}

/** 根据路径在树中查找文件节点 */
export const findFileInTree = (nodes: FileTreeNode[], path: string): FileTreeNode | undefined => {
  for (const node of nodes) {
    if (node.type === 'file' && node.path === path) return node
    if (node.type === 'folder' && node.children) {
      const found = findFileInTree(node.children, path)
      if (found) return found
    }
  }
  return undefined
}
