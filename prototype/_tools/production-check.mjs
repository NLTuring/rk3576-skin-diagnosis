import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' })
const errors = []
const externalRequests = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
page.on('request', request => {
  if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url())
})
await page.goto('http://127.0.0.1:4173/')
await expect(page.getByTestId('body-map')).toHaveAttribute('data-renderer', '3d')
await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
await mkdir('artifacts', { recursive: true })
await page.screenshot({ path: 'artifacts/10-production-home.png', fullPage: true })
await page.getByRole('button', { name: '为这一处复查', exact: true }).click()
await page.getByRole('button', { name: '痒', exact: true }).click()
await page.getByRole('button', { name: '几天', exact: true }).click()
await page.getByRole('button', { name: '基本不变', exact: true }).click()
await page.getByLabel('补充一句话').fill('构建版本中的测试记录')
await page.getByRole('button', { name: '查看本次观察', exact: true }).click()
await expect(page.getByRole('heading', { name: '本次尚未进行 AI 识别' })).toBeVisible()
await page.getByRole('button', { name: '保存本次记录', exact: true }).click()
await expect(page.getByRole('status')).toContainText('观察记录已保存')
await page.reload()
await expect(page.getByText('构建版本中的测试记录', { exact: true })).toBeVisible()
expect(errors).toEqual([])
expect(externalRequests).toEqual([])
const report = { date: new Date().toISOString(), viewport: '1366 × 900', model: '3D loaded', savedTextAfterReload: true, errors, externalRequests }
await writeFile('artifacts/production-smoke.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
