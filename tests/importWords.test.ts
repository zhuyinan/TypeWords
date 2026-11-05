import { describe, expect, it } from 'vitest'
import { parseWordList } from '../app/core/utils/importWords'

describe('parseWordList', () => {
  it('解析 tab 分隔', () => {
    const [e] = parseWordList('apple\t苹果')
    expect(e).toMatchObject({ valid: true, word: 'apple', cn: '苹果' })
  })

  it('剥学校单词表序号前缀 1. / 23、', () => {
    const [a] = parseWordList('1. apple 苹果')
    expect(a).toMatchObject({ word: 'apple', cn: '苹果' })
    const [b] = parseWordList('23、banana 香蕉')
    expect(b.word).toBe('banana')
  })

  it('提取斜杠音标', () => {
    const [e] = parseWordList('go /ɡəʊ/ vi. 去；进行')
    expect(e).toMatchObject({ word: 'go', phonetic: 'ɡəʊ', cn: 'vi. 去；进行' })
  })

  it('提取方括号音标', () => {
    const [e] = parseWordList('apple [ˈæpl] n. 苹果')
    expect(e).toMatchObject({ phonetic: 'ˈæpl', cn: 'n. 苹果' })
  })

  it('词组不被空格切断', () => {
    const [e] = parseWordList('ice cream 冰淇淋')
    expect(e).toMatchObject({ word: 'ice cream', cn: '冰淇淋' })
  })

  it('纯英文无释义 → no-cn', () => {
    const [e] = parseWordList('apple')
    expect(e).toMatchObject({ valid: false, reason: 'no-cn' })
  })

  it('无英文 → no-word', () => {
    const [e] = parseWordList('苹果')
    expect(e).toMatchObject({ valid: false, reason: 'no-word' })
  })

  it('空行 → empty', () => {
    const [e] = parseWordList('   ')
    expect(e.reason).toBe('empty')
  })

  it('重复词大小写不敏感 → duplicate', () => {
    const [, b] = parseWordList('apple 苹果\nApple 苹果')
    expect(b).toMatchObject({ valid: false, reason: 'duplicate' })
  })

  it('Windows 换行符正常分割', () => {
    const r = parseWordList('a 甲\r\nb 乙')
    expect(r).toHaveLength(2)
    expect(r[1].word).toBe('b')
  })
})
