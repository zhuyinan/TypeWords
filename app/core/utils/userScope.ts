export const USER_KEY = 'typewords-active-user'

export function getActiveUser(): string {
  return localStorage.getItem(USER_KEY) || 'default'
}

export function setActiveUser(user: string): void {
  localStorage.setItem(USER_KEY, user)
}

export function hasChosenUser(): boolean {
  return !!localStorage.getItem(USER_KEY)
}

/** 所有持久化 key（IndexedDB / localStorage）必须经此函数加上用户前缀，实现同设备多用户隔离 */
export function scopedKey(key: string): string {
  return `${getActiveUser()}:${key}`
}
