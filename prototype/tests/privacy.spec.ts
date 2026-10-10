import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

declare global {
  interface Window {
    cameraTracks: MediaStreamTrack[]
    resolveCameras: (() => void)[]
  }
}

test('capture excludes the ghost overlay and stops every camera track', async ({ page }) => {
  await page.addInitScript(() => {
    window.cameraTracks = []
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 640; canvas.height = 480
      const paint = canvas.getContext('2d')!
      paint.fillStyle = '#2470a3'
      paint.fillRect(0, 0, canvas.width, canvas.height)
      const stream = canvas.captureStream(10)
      window.cameraTracks.push(...stream.getTracks())
      return stream
    } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: '为这一处复查', exact: true }).click()
  await page.getByRole('button', { name: '摄像头拍摄', exact: true }).click()
  await expect(page.getByTestId('ghost-reference')).toBeVisible()
  await page.getByRole('slider', { name: '参考图透明度' }).press('End')
  await expect(page.getByTestId('ghost-reference')).toHaveCSS('opacity', '0.7')
  await page.getByRole('button', { name: '拍摄照片', exact: true }).click()
  const pixels = await page.getByRole('img', { name: '本次独立拍摄的照片' }).evaluate(async image => {
    await (image as HTMLImageElement).decode()
    const canvas = document.createElement('canvas')
    canvas.width = 640; canvas.height = 480
    const context = canvas.getContext('2d')!
    context.drawImage(image as HTMLImageElement, 0, 0)
    return [[320, 240], [100, 100], [500, 380]].map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data))
  })
  for (const pixel of pixels) {
    for (const [index, value] of [36, 112, 163, 255].entries()) expect(Math.abs(pixel[index] - value)).toBeLessThanOrEqual(3)
  }
  await expect.poll(() => page.evaluate(() => window.cameraTracks.every(track => track.readyState === 'ended'))).toBe(true)
  await page.getByRole('button', { name: '使用这张照片', exact: true }).click()
  await expect(page.getByRole('img', { name: '本次临时照片' })).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  await expect(page.getByText('本地照片', { exact: true })).toBeVisible()
})

test('leaving before camera permission resolves also closes the late stream', async ({ page }) => {
  await page.addInitScript(() => {
    window.cameraTracks = []
    window.resolveCameras = []
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: () => new Promise<MediaStream>(resolve => {
      const canvas = document.createElement('canvas')
      canvas.width = 40; canvas.height = 30
      const stream = canvas.captureStream(1)
      window.cameraTracks.push(...stream.getTracks())
      window.resolveCameras.push(() => resolve(stream))
    }) })
  })
  await page.goto('/')
  await page.getByRole('button', { name: '为这一处复查', exact: true }).click()
  await page.getByRole('button', { name: '摄像头拍摄', exact: true }).click()
  await expect(page.getByText('正在打开摄像头', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '改用已有照片', exact: true }).click()
  const pending = await page.evaluate(() => { window.resolveCameras.forEach(resolve => resolve()); return window.cameraTracks.length })
  expect(pending).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => window.cameraTracks.every(track => track.readyState === 'ended'))).toBe(true)
  await expect(page.getByRole('heading', { name: '记录今天的变化。' })).toBeVisible()
})

test('switching sections guards an unsaved draft and preserves it when canceled', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '为这一处复查', exact: true }).click()
  await page.getByLabel('补充一句话').fill('还未保存的感受')
  await page.getByRole('button', { name: '家庭成员', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '先把这一页留好' })).toBeVisible()
  await page.getByRole('button', { name: '返回', exact: true }).click()
  await expect(page.getByLabel('补充一句话')).toHaveValue('还未保存的感受')
  await page.getByRole('button', { name: '家庭成员', exact: true }).click()
  await page.getByRole('button', { name: '放弃本次记录并离开', exact: true }).click()
  await page.getByRole('button', { name: '身体手账', exact: true }).click()
  await expect(page.getByText('还未保存的感受', { exact: true })).toHaveCount(0)
})

test('export omits photos by default and includes them only on explicit selection', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '本地档案与设置', exact: true }).click()
  await page.getByRole('button', { name: '导出本地档案', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: '同时包含已保存的照片' })).not.toBeChecked()
  const firstDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出观察记录', exact: true }).click()
  const firstFile = await (await firstDownload).path()
  const first = JSON.parse(await readFile(firstFile!, 'utf8'))
  expect(first.observations).toHaveLength(3)
  expect(first.observations.every((entry: { photo?: string }) => entry.photo === undefined)).toBe(true)
  await page.getByRole('button', { name: '导出本地档案', exact: true }).click()
  await page.getByRole('checkbox', { name: '同时包含已保存的照片' }).check()
  const secondDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出观察记录', exact: true }).click()
  const secondFile = await (await secondDownload).path()
  const second = JSON.parse(await readFile(secondFile!, 'utf8'))
  expect(second.observations.some((entry: { photo?: string }) => Boolean(entry.photo))).toBe(true)
})

test('a failed local transaction never claims a record was saved or drops its draft', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '为这一处复查', exact: true }).click()
  await page.getByRole('button', { name: '痒', exact: true }).click()
  await page.getByRole('button', { name: '几天', exact: true }).click()
  await page.getByRole('button', { name: '基本不变', exact: true }).click()
  await page.getByLabel('补充一句话').fill('存储失败也不能丢失')
  await page.getByRole('button', { name: '查看本次观察', exact: true }).click()
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      IDBObjectStore.prototype.put = original
      const request = original.apply(this, args)
      this.transaction.abort()
      return request
    }
  })
  await page.getByRole('button', { name: '保存本次记录', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('未')
  await expect(page.getByRole('heading', { name: '本次尚未进行 AI 识别' })).toBeVisible()
  await page.getByRole('button', { name: '返回修改', exact: true }).click()
  await expect(page.getByLabel('补充一句话')).toHaveValue('存储失败也不能丢失')
  await page.getByRole('button', { name: '查看本次观察', exact: true }).click()
  await page.getByRole('button', { name: '保存本次记录', exact: true }).click()
  await expect(page.getByText('存储失败也不能丢失', { exact: true })).toBeVisible()
})

test('an unreadable local archive is preserved instead of replaced with demo records', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dermascope-local-journal-v1', 1)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction('journal', 'readwrite')
      tx.objectStore('journal').put({ version: 999, originalContent: 'must-be-preserved' }, 'state')
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
  }))
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('现有数据未被覆盖')
  const saved = await page.evaluate(() => new Promise<{ version: number; originalContent: string }>(resolve => {
    const open = indexedDB.open('dermascope-local-journal-v1', 1)
    open.onsuccess = () => {
      const db = open.result
      const request = db.transaction('journal').objectStore('journal').get('state')
      request.onsuccess = () => { resolve(request.result); db.close() }
    }
  }))
  expect(saved).toEqual({ version: 999, originalContent: 'must-be-preserved' })
})
