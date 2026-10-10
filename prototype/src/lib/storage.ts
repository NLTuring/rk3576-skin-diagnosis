import { validateJournal, type Journal } from '../domain/journal'

export const DATABASE = 'dermascope-local-journal-v1'
function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('journal')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('当前浏览器无法打开本地档案。'))
    request.onblocked = () => reject(new Error('请关闭其他肤镜页面，再重新打开。'))
  })
}
export async function loadJournal(name = DATABASE): Promise<Journal | null> {
  const db = await openDatabase(name)
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('journal', 'readonly')
      const request = tx.objectStore('journal').get('state')
      tx.oncomplete = () => {
        try { resolve(request.result === undefined ? null : validateJournal(request.result)) }
        catch { reject(new Error('本地档案无法读取。现有数据未被覆盖，请先保留备份。')) }
      }
      tx.onerror = () => reject(new Error('读取本地档案失败，请重试。'))
      tx.onabort = () => reject(new Error('读取本地档案已中断。'))
    })
  } finally { db.close() }
}
export async function persistJournal(state: Journal, name = DATABASE): Promise<void> {
  validateJournal(state)
  const db = await openDatabase(name)
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('journal', 'readwrite')
      tx.objectStore('journal').put(state, 'state')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(new Error('未能保存到本地。请检查浏览器存储空间，或先导出备份。'))
      tx.onabort = () => reject(new Error('本次保存未完成，原有档案仍然保留。'))
    })
  } finally { db.close() }
}
