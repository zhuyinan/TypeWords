// 统一存储层：集中式（Mac mini 服务端）优先，浏览器 IndexedDB 兜底
// 接口签名与 idb-keyval 一致，上层调用点零改动
import * as idb from 'idb-keyval'

const API = '/api/data'

async function http(method: string, key: string, body?: unknown) {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${API}?key=${encodeURIComponent(key)}`, init)
  if (method === 'GET') {
    if (res.status === 404) return undefined
    if (!res.ok) throw new Error(`storage GET ${res.status}`)
    return res.json()
  }
  if (!res.ok) throw new Error(`storage ${method} ${res.status}`)
}

/**
 * 读：服务器优先；网络异常时回退本地 IndexedDB（离线可用，恢复后以服务器为准）
 */
export async function get(key: string): Promise<any> {
  try {
    return await http('GET', key)
  } catch {
    return idb.get(key)
  }
}

/**
 * 写：双写——先落服务器（权威数据），成功后同步一份到本地 idb 作离线缓存
 */
export async function set(key: string, value: any): Promise<void> {
  try {
    await http('PUT', key, value)
  } catch {
    // 离线兜底：仅写本地，联网后下次写入会覆盖服务器旧值（家用可接受）
  }
  await idb.set(key, value)
}

export async function del(key: string): Promise<void> {
  try {
    await http('DELETE', key)
  } catch {
    /* 离线 */
  }
  await idb.del(key)
}

/** 同 idb-keyval 的 update(key, updater)：读-改-写 */
export async function update(key: string, updater: (val: any) => any): Promise<void> {
  const current = await get(key)
  const next = updater(current)
  await set(key, next)
}

/**
 * 一次性迁移：把本地 IndexedDB 中已有、服务器还没有的 key 推到服务器。
 * 幂等（服务器已有则以服务器为准），新设备本地为空则零动作。
 * 应用启动时调用一次即可。
 */
export async function migrateIdbToServer(): Promise<void> {
  try {
    const keys = await idb.keys()
    const values = await idb.getMany(keys)
    let pushed = 0
    for (let i = 0; i < keys.length; i++) {
      const key = String(keys[i])
      try {
        const remote = await http('GET', key)
        if (remote === undefined) {
          await http('PUT', key, values[i])
          pushed++
        }
      } catch {
        return // 离线：放弃本次迁移，下次启动再试
      }
    }
    if (pushed > 0) console.log(`[storage] migrated ${pushed} keys to server`)
  } catch {
    /* 无本地数据 */
  }
}
