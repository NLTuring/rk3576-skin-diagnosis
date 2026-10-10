import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const directory = path.resolve('artifacts')
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' })
const page = await context.newPage()
const errors = []
const remote = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') remote.push(request.url()) })
const shot = name => page.screenshot({ path: path.join(directory, name + '.png'), fullPage: true })
await page.goto('http://127.0.0.1:5173/')
await page.locator('[data-renderer="3d"]').waitFor()
await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
await shot('01-home')
await page.getByRole('button', { name: '前后对照', exact: true }).click()
await shot('04-compare')
await page.getByRole('button', { name: '返回手账', exact: true }).click()
await page.getByRole('button', { name: '为这一处复查', exact: true }).click()
await page.getByRole('button', { name: '使用内置示例', exact: true }).click()
await page.getByRole('button', { name: '痒', exact: true }).click()
await page.getByRole('button', { name: '几天', exact: true }).click()
await page.getByRole('button', { name: '基本不变', exact: true }).click()
await shot('02-check')
await page.getByRole('button', { name: '查看本次观察', exact: true }).click()
await shot('03-result')
await page.getByRole('button', { name: '返回修改', exact: true }).click()
await page.evaluate(() => {
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 800; canvas.height = 600
    const paint = canvas.getContext('2d')
    paint.fillStyle = '#8e968c'; paint.fillRect(0, 0, 800, 600)
    paint.strokeStyle = '#c4cbbd'; paint.lineWidth = 1
    for (let x = 0; x < 800; x += 80) { paint.beginPath(); paint.moveTo(x, 0); paint.lineTo(x, 600); paint.stroke() }
    for (let y = 0; y < 600; y += 60) { paint.beginPath(); paint.moveTo(0, y); paint.lineTo(800, y); paint.stroke() }
    paint.fillStyle = '#eef0e8'; paint.font = '18px sans-serif'; paint.fillText('CAMERA TEST / SYNTHETIC FRAME', 24, 570)
    return canvas.captureStream(10)
  } })
})
await page.getByRole('button', { name: '摄像头拍摄', exact: true }).click()
await page.getByRole('button', { name: '拍摄照片', exact: true }).waitFor()
await shot('05-camera-synthetic')
await page.getByRole('button', { name: '返回本次记录', exact: true }).click()
await page.getByRole('button', { name: '家庭成员', exact: true }).click()
await page.getByRole('button', { name: '放弃本次记录并离开', exact: true }).click()
await shot('06-family')
await page.getByRole('button', { name: '复查计划', exact: true }).click()
await shot('07-plans')
await page.getByRole('button', { name: '本地档案与设置', exact: true }).click()
await shot('08-local-data')
await page.setViewportSize({ width: 390, height: 844 })
await page.getByRole('button', { name: '身体手账', exact: true }).click()
await page.locator('[data-renderer="3d"]').waitFor()
await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
await shot('09-narrow-home')
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
console.log(JSON.stringify({ directory, errors, remote, narrowOverflow: overflow }, null, 2))
await browser.close()
