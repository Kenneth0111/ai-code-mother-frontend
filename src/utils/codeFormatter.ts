/**
 * 轻量代码美化器
 *
 * 解决问题：模型常会输出"一行多条声明"的紧凑 CSS / JS（例如
 * `*{margin:0;padding:0;box-sizing:border-box}body{...}`），
 * 直接渲染会导致代码全堆在一起。这里在展示前对 CSS / JavaScript
 * 做基础换行 + 缩进；HTML 等其他语言保持原样（HTML 标签结构本身
 * 就有可读的换行）。
 *
 * 实现要点：
 * - 纯字符串扫描，规避字符串 / 模板字符串 / 注释 / 正则中的特殊字符
 * - 对流式中尚未闭合的代码也能 graceful 输出，不抛异常
 * - 不引入额外依赖
 */

const INDENT_UNIT = '  '

const indentStr = (depth: number): string =>
  INDENT_UNIT.repeat(Math.max(0, depth))

/**
 * CSS 美化：在 `{` `}` `;` 处换行并按层级缩进，
 * 兼容 @media / @keyframes 等嵌套 at-rule。
 */
export const formatCss = (code: string): string => {
  if (!code) return code

  let out = ''
  let buf = ''
  let depth = 0

  // 把当前缓冲区里的"声明片段"按一行写入
  const flushDecl = () => {
    const t = buf.replace(/\s+/g, ' ').trim()
    if (t) out += indentStr(depth) + t + '\n'
    buf = ''
  }

  let i = 0
  const n = code.length

  while (i < n) {
    const ch = code[i]
    const next = code[i + 1]

    // 块注释 /* ... */ 整体保留在当前位置
    if (ch === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2)
      const seg = end === -1 ? code.slice(i) : code.slice(i, end + 2)
      buf += seg
      i += seg.length
      continue
    }

    // 字符串 (CSS 中的 url("...") 或 content: '...')
    if (ch === '"' || ch === "'") {
      const q = ch
      let j = i + 1
      while (j < n) {
        if (code[j] === '\\') {
          j += 2
          continue
        }
        if (code[j] === q) {
          j++
          break
        }
        j++
      }
      buf += code.slice(i, j)
      i = j
      continue
    }

    if (ch === '{') {
      const head = buf.replace(/\s+/g, ' ').trim()
      out += indentStr(depth) + (head ? head + ' {' : '{') + '\n'
      buf = ''
      depth++
      i++
      continue
    }

    if (ch === '}') {
      flushDecl()
      depth = Math.max(0, depth - 1)
      out += indentStr(depth) + '}\n'
      i++
      continue
    }

    if (ch === ';') {
      buf += ';'
      flushDecl()
      i++
      continue
    }

    if (ch === '\n' || ch === '\r' || ch === '\t') {
      buf += ' '
      i++
      continue
    }

    buf += ch
    i++
  }

  // 尾部残留（缺少分号收尾的声明）
  const tail = buf.replace(/\s+/g, ' ').trim()
  if (tail) out += indentStr(depth) + tail + '\n'

  return out
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .filter((l, idx, arr) => !(l === '' && (idx === 0 || arr[idx - 1] === '')))
    .join('\n')
    .trim()
}

/**
 * JavaScript 美化：在 `{` `}` `;` 处换行并按层级缩进。
 *
 * 注意事项：
 * - 严格规避 string / template / regex / 注释里的字符
 * - 通过 parenDepth 让 for(;;) 中的分号不被换行
 * - } 后若紧跟 else / catch / finally / while 保持同行
 */
export const formatJs = (code: string): string => {
  if (!code) return code

  let out = ''
  let depth = 0
  let parenDepth = 0
  let needsIndent = true
  // 上一个非空白字符，用于判断 `/` 是除号还是正则起始
  let lastSig = ''

  const append = (s: string) => {
    if (needsIndent && s.trim() !== '') {
      out += indentStr(depth)
      needsIndent = false
    }
    out += s
  }
  const newline = () => {
    out = out.replace(/[ \t]+$/, '')
    if (!out.endsWith('\n')) out += '\n'
    needsIndent = true
  }

  let i = 0
  const n = code.length

  while (i < n) {
    const ch = code[i]
    const next = code[i + 1]

    // 行注释
    if (ch === '/' && next === '/') {
      let j = i
      while (j < n && code[j] !== '\n') j++
      append(code.slice(i, j))
      newline()
      i = j + 1
      continue
    }

    // 块注释
    if (ch === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2)
      const seg = end === -1 ? code.slice(i) : code.slice(i, end + 2)
      append(seg)
      i += seg.length
      lastSig = '*'
      continue
    }

    // 字符串 "..." 或 '...'
    if (ch === '"' || ch === "'") {
      const q = ch
      let j = i + 1
      while (j < n) {
        if (code[j] === '\\') {
          j += 2
          continue
        }
        if (code[j] === q) {
          j++
          break
        }
        if (code[j] === '\n') break
        j++
      }
      append(code.slice(i, j))
      lastSig = q
      i = j
      continue
    }

    // 模板字符串 `...${expr}...`
    if (ch === '`') {
      let j = i + 1
      while (j < n) {
        if (code[j] === '\\') {
          j += 2
          continue
        }
        if (code[j] === '`') {
          j++
          break
        }
        if (code[j] === '$' && code[j + 1] === '{') {
          let d = 1
          j += 2
          while (j < n && d > 0) {
            if (code[j] === '{') d++
            else if (code[j] === '}') d--
            j++
          }
          continue
        }
        j++
      }
      append(code.slice(i, j))
      lastSig = '`'
      i = j
      continue
    }

    // 粗略识别正则字面量：仅当上一个有意义字符暗示需要表达式时
    if (
      ch === '/' &&
      (lastSig === '' || /[=({[,;!&|?:+\-*%^~<>]/.test(lastSig))
    ) {
      let j = i + 1
      let inClass = false
      let ok = false
      while (j < n) {
        if (code[j] === '\\') {
          j += 2
          continue
        }
        if (code[j] === '[') inClass = true
        else if (code[j] === ']') inClass = false
        else if (code[j] === '/' && !inClass) {
          j++
          ok = true
          break
        } else if (code[j] === '\n') break
        j++
      }
      if (ok) {
        while (j < n && /[gimsuy]/.test(code[j])) j++
        append(code.slice(i, j))
        lastSig = '/'
        i = j
        continue
      }
    }

    if (ch === '{') {
      // 上一个 token 是字母/数字/) 时补一个空格，让 `function foo() {` 更自然
      if (lastSig && /[\w)\]]/.test(lastSig)) {
        out = out.replace(/[ \t]*$/, '') + ' '
      }
      append('{')
      depth++
      newline()
      lastSig = '{'
      i++
      continue
    }

    if (ch === '}') {
      out = out.replace(/[ \t]+$/, '')
      if (out.length > 0 && !out.endsWith('\n')) out += '\n'
      depth = Math.max(0, depth - 1)
      out += indentStr(depth) + '}'
      needsIndent = false
      lastSig = '}'
      i++

      // 跳过 } 后的空白，根据下一个非空白决定是否换行
      let j = i
      while (j < n && /[ \t]/.test(code[j])) j++
      const after = code[j]
      const wordMatch = code.slice(j).match(/^([a-zA-Z_$][\w$]*)/)
      if (wordMatch && /^(else|catch|finally|while)$/.test(wordMatch[1])) {
        out += ' '
        i = j
      } else if (
        after === ')' ||
        after === ']' ||
        after === ',' ||
        after === ';' ||
        after === '.'
      ) {
        // 让闭合符 / 链式调用紧贴 `}`，不强制换行
        i = j
      } else {
        newline()
        i = j
      }
      continue
    }

    if (ch === '(') {
      append('(')
      parenDepth++
      lastSig = '('
      i++
      continue
    }
    if (ch === ')') {
      out = out.replace(/[ \t]+$/, '')
      append(')')
      parenDepth = Math.max(0, parenDepth - 1)
      lastSig = ')'
      i++
      continue
    }

    if (ch === ';') {
      append(';')
      lastSig = ';'
      i++
      // for( ; ; ) 内部的分号不换行
      if (parenDepth > 0) continue
      while (i < n && /[ \t]/.test(code[i])) i++
      newline()
      continue
    }

    if (ch === '\n' || ch === '\r') {
      // 我们自己控制换行，丢弃源码里的原始换行
      i++
      continue
    }

    if (ch === ' ' || ch === '\t') {
      if (!needsIndent && !out.endsWith(' ') && !out.endsWith('\n')) {
        append(' ')
      }
      let j = i + 1
      while (j < n && /[ \t]/.test(code[j])) j++
      i = j
      continue
    }

    append(ch)
    if (!/\s/.test(ch)) lastSig = ch
    i++
  }

  return out
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .filter((l, idx, arr) => !(l === '' && (idx === 0 || arr[idx - 1] === '')))
    .join('\n')
    .trim()
}

/**
 * 按语言分发到对应的美化器；不识别的语言返回原文。
 */
export const formatCode = (code: string, lang?: string): string => {
  if (!code) return code
  const l = (lang || '').toLowerCase()
  if (l === 'css' || l === 'scss' || l === 'less') {
    return formatCss(code)
  }
  if (l === 'javascript' || l === 'js' || l === 'typescript' || l === 'ts') {
    return formatJs(code)
  }
  return code
}
