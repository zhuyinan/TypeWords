import { beforeEach, describe, expect, it, vi } from 'vitest'

const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
})

import { getActiveUser, setActiveUser, hasChosenUser, scopedKey, USER_KEY } from '../app/core/utils/userScope'

describe('userScope', () => {
  beforeEach(() => { Object.keys(store).forEach(k => delete store[k]) })

  it('未选择时默认用户为 default', () => {
    expect(getActiveUser()).toBe('default')
    expect(hasChosenUser()).toBe(false)
  })

  it('key 加默认前缀', () => {
    expect(scopedKey('typing-word-dict')).toBe('default:typing-word-dict')
  })

  it('设置用户后 key 带该用户前缀', () => {
    setActiveUser('duoduo')
    expect(getActiveUser()).toBe('duoduo')
    expect(hasChosenUser()).toBe(true)
    expect(scopedKey('typing-word-dict')).toBe('duoduo:typing-word-dict')
  })

  it('切换用户后前缀跟着切', () => {
    setActiveUser('duoduo')
    setActiveUser('miaomiao')
    expect(scopedKey('PracticeSaveWord')).toBe('miaomiao:PracticeSaveWord')
  })

  it('USER_KEY 本身不做前缀处理', () => {
    expect(USER_KEY).toBe('typewords-active-user')
    expect(scopedKey(USER_KEY)).toBe(`default:${USER_KEY}`)
  })
})
