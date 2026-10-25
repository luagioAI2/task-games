#!/usr/bin/env node
/**
 * 量上边栏的几何（独立网页形态，同一套 HUD 代码）。
 *
 * 为什么要量：用户说「上面空了一块」—— 空多少必须是个数字，
 * 而且「改完变好了」也只能用数字说（hud 高度 / 有没有横向溢出 / 每个元素多宽）。
 *
 * 用法: node scripts/_hud-geo.mjs [url] [宽,宽,...]
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(join(process.cwd(), 'noop.js'))
const puppeteer = require('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core')

const URL = process.argv[2] || 'http://127.0.0.1:4397/index.html'
const WIDTHS = (process.argv[3] || '390,360').split(',').map(Number)

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForFunction('window.__farm && window.__farm.farm', { timeout: 60000 })

// 跳过开场卡片，别让它影响布局
await page.evaluate(() => {
  const g = window.__farm
  g.farm.s.onboard = 3
  document.querySelectorAll('.modal, .scrim, .coach').forEach((e) => e.remove())
  g.farm.emit({ type: 'change' })
})
await new Promise((r) => setTimeout(r, 600))

for (const w of WIDTHS) {
  await page.setViewport({ width: w, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  // 光 setViewport 有时赶不上游戏自己的 resize 重排（画布是定像素的），
  // 再补一次 resize 并多等一会儿，否则量到的是上一档宽度的布局。
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  await new Promise((r) => setTimeout(r, 1000))
  const raw = await page.evaluate(() => {
    const ui = document.getElementById('ui')
    const r = (el) => {
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }
    }
    const bar = ui.querySelector('.topbar')
    const sub = ui.querySelector('.subbar')
    const seg = ui.querySelector('.seg')
    const spacer = ui.querySelector('.topbar .spacer')
    return JSON.stringify({
      innerW: window.innerWidth,
      uiW: Math.round(ui.getBoundingClientRect().width),
      colW: Math.round(ui.parentElement.getBoundingClientRect().width),
      canvasW: Math.round(document.querySelector('canvas')?.getBoundingClientRect().width || 0),
      mq380: window.matchMedia('(max-width:380px)').matches,
      hud: r(ui.querySelector('.hud')),
      bar: r(bar),
      sub: r(sub),
      seg: r(seg),
      spacer: spacer ? Math.round(spacer.getBoundingClientRect().width) : null,
      zoneBtns: [...(seg ? seg.querySelectorAll('[data-zone]') : [])].map((b) => `${b.textContent}:${Math.round(b.getBoundingClientRect().width)}`),
      wx: r(ui.querySelector('.wx')),
      fold: r(ui.querySelector('#foldBtn')),
      log: r(ui.querySelector('#logBtn')),
      gear: r(ui.querySelector('#setBtn')),
      badge: r(ui.querySelector('#lvBadge')),
      // 溢出判据：分段胶囊有没有超出上栏的可用宽度
      segOverflow: bar && seg ? Math.round(seg.getBoundingClientRect().right - bar.getBoundingClientRect().right) : null,
      barScrollW: bar ? bar.scrollWidth : null,
      barClientW: bar ? bar.clientWidth : null,
      // 上栏里第一个元素左边缘 vs 最后一个元素右边缘 —— 中间空了多少
      gapBadgeToSeg: (() => {
        const b = ui.querySelector('#lvBadge'), s = seg
        if (!b || !s) return null
        return Math.round(s.getBoundingClientRect().left - b.getBoundingClientRect().right)
      })(),
      gapSegToLog: (() => {
        const s = seg, l = ui.querySelector('#logBtn')
        if (!s || !l) return null
        return Math.round(l.getBoundingClientRect().left - s.getBoundingClientRect().right)
      })(),
    })
  })
  console.log(`\n[${w}px]`, JSON.stringify(JSON.parse(raw), null, 1).replace(/\n\s*/g, ' '))
}

await browser.close()
