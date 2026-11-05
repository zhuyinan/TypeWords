export type ParsedWordEntry = {
  raw: string
  word: string
  phonetic: string
  cn: string
  valid: boolean
  reason?: 'empty' | 'no-word' | 'no-cn' | 'duplicate'
}

const POS_TOKEN = /^(n|v|vt|vi|adj|adv|prep|conj|pron|aux|abbr|int|num|art)\.?$/i

function findFirstCJKIndex(s: string): number {
  const m = s.match(/[\u4e00-\u9fff]/)
  return m ? s.indexOf(m[0]) : -1
}

/** 提取 /ˈæpl/ 或 [ˈæpl] 形式的音标（段内须含非 ASCII 字符，避免误伤普通括号内容） */
function extractPhonetic(line: string): { phonetic: string; rest: string } {
  const m = line.match(/([/[])([^/[\]]+)([/\]])/)
  if (m && m.index !== undefined && /[^\x00-\x7F]/.test(m[2])) {
    return {
      phonetic: m[2].trim(),
      rest: (line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length)).trim(),
    }
  }
  return { phonetic: '', rest: line }
}

/** 从 CJK 之前的英文段拆出单词与词性：词性标记(n./vi.等)及其以后并入释义 */
function splitEnglishHead(head: string): { word: string; tail: string } {
  const tokens = head.trim().split(/\s+/).filter(Boolean)
  const posIdx = tokens.findIndex(t => POS_TOKEN.test(t))
  if (posIdx === -1) return { word: tokens.join(' '), tail: '' }
  return { word: tokens.slice(0, posIdx).join(' '), tail: tokens.slice(posIdx).join(' ') }
}

export function parseWordList(text: string): ParsedWordEntry[] {
  const seen = new Set<string>()
  return text.split(/\r?\n/).map(raw => {
    const base: ParsedWordEntry = { raw, word: '', phonetic: '', cn: '', valid: false }
    let line = raw.trim()
    if (!line) return { ...base, reason: 'empty' as const }

    // 剥学校单词表序号前缀：1. / 2、 / 3)
    line = line.replace(/^\d+\s*[.、)．]\s*/, '')

    const { phonetic, rest } = extractPhonetic(line)
    const cjkIdx = findFirstCJKIndex(rest)
    if (cjkIdx === 0) return { ...base, phonetic, reason: 'no-word' as const }

    if (cjkIdx === -1) {
      const { word } = splitEnglishHead(rest)
      return { ...base, word, reason: 'no-cn' as const }
    }

    const { word, tail } = splitEnglishHead(rest.slice(0, cjkIdx))
    const cn = [tail, rest.slice(cjkIdx).trim()].filter(Boolean).join(' ')
    if (!word || !/^[a-zA-Z][a-zA-Z' -]*$/.test(word)) {
      return { ...base, phonetic, word, cn, reason: 'no-word' as const }
    }
    const key = word.toLowerCase()
    if (seen.has(key)) return { ...base, word, cn, reason: 'duplicate' as const }
    seen.add(key)
    return { ...base, word, cn, phonetic, valid: true }
  })
}
