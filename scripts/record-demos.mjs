// 录制官网的功能演示动图。
// 用法：KEYSKIN_DIR=../keyskin node scripts/record-demos.mjs [场景名...]
// 需要 keyskin 仓库已 npm ci，以及系统里的 ffmpeg。
// 在 keyskin 的网页版里用 Playwright 真实操作一遍，按 CDP 截屏帧（保留每帧时间戳）合成视频，
// 输出 dist/assets/demos/<场景>.mp4、<场景>.gif（动图）与 <场景>.jpg（封面）。
import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const keyskin = resolve(process.env.KEYSKIN_DIR ?? "../keyskin")
const outDir = resolve(new URL("../dist/assets/demos", import.meta.url).pathname)
mkdirSync(outDir, { recursive: true })
const require = createRequire(join(keyskin, "package.json"))
const { chromium } = require("playwright")
const { createServer } = await import(require.resolve("vite"))
// 动效演示用 keyskin 测试里带 animationConfig 的 BDA 样例
const bdaFixture = () => import(join(keyskin, "tests/helpers/bda-animation-fixture.mjs"))

const server = await createServer({ root: keyskin, configFile: join(keyskin, "vite.config.ts"), logLevel: "error", server: { port: 41850, host: "127.0.0.1" } })
await server.listen()
const baseURL = `http://127.0.0.1:${server.httpServer.address().port}/`
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  env: { ...process.env, LC_ALL: "C.UTF-8" },
})

// 录屏时注入的假光标：headless 浏览器没有鼠标指针，演示里需要看到点在哪里。
const CURSOR = `(() => {
  const arrow = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><path d="M4 2 L4 21 L9 16.5 L12.5 24 L15.5 22.7 L12 15.5 L19 15.5 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>')
  const install = () => {
    if (document.getElementById("__demo-cursor")) return
    const cursor = document.createElement("div")
    cursor.id = "__demo-cursor"
    Object.assign(cursor.style, { position: "fixed", left: "-40px", top: "-40px", width: "26px", height: "26px", zIndex: 2147483647,
      pointerEvents: "none", backgroundImage: "url(" + JSON.stringify(arrow) + ")", backgroundSize: "26px 26px", transform: "translate(-4px,-2px)",
      filter: "drop-shadow(0 2px 3px rgba(0,0,0,.25))" })
    // 触屏场景显示成手指按压的圆点
    if (window.__demoTouch) Object.assign(cursor.style, { backgroundImage: "none", width: "30px", height: "30px", borderRadius: "50%",
      background: "rgba(120,120,128,.35)", border: "2px solid rgba(255,255,255,.85)", transform: "translate(-15px,-15px)" })
    document.documentElement.append(cursor)
    addEventListener("mousemove", (event) => { cursor.style.left = event.clientX + "px"; cursor.style.top = event.clientY + "px" }, true)
    addEventListener("mousedown", (event) => {
      const ring = document.createElement("div")
      Object.assign(ring.style, { position: "fixed", left: event.clientX - 18 + "px", top: event.clientY - 18 + "px", width: "36px", height: "36px",
        borderRadius: "50%", background: "rgba(10,132,255,.28)", border: "2px solid rgba(10,132,255,.7)", zIndex: 2147483646,
        pointerEvents: "none", transition: "transform 420ms ease-out, opacity 420ms ease-out", transform: "scale(.4)" })
      document.documentElement.append(ring)
      requestAnimationFrame(() => { ring.style.transform = "scale(1.25)"; ring.style.opacity = "0" })
      setTimeout(() => ring.remove(), 500)
    }, true)
  }
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install)
  else install()
})()`

/** 一个场景：新开窗口，setup 后开始录制，run 里的操作都会进入视频。 */
async function scene(name, { viewport, colorScheme = "light", touch = false, setup, run, crop }) {
  const context = await browser.newContext({ viewport, colorScheme, bypassCSP: true, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch })
  const page = await context.newPage()
  page.on("pageerror", (error) => console.log(`  [${name}] page error: ${error.message}`))
  await page.addInitScript(() => {
    localStorage.clear()
    delete window.showSaveFilePicker
    window.showSaveFilePicker = undefined
  })
  await page.addInitScript(`window.__demoTouch = ${touch};` + CURSOR)
  await page.goto(baseURL)
  await page.waitForSelector(".template-card")
  const pointer = { x: viewport.width * 0.62, y: viewport.height * 0.7 }
  const ui = makeUi(page, pointer)
  await page.mouse.move(pointer.x, pointer.y)
  if (setup) await setup(page, ui)
  await page.waitForTimeout(400)

  const frames = []
  const cdp = await context.newCDPSession(page)
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    frames.push({ data: Buffer.from(data, "base64"), t: metadata.timestamp })
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {})
  })
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: viewport.width * 2, maxHeight: viewport.height * 2, everyNthFrame: 1 })
  const started = Date.now() / 1000
  // 静止画面不会产生新帧，用一个看不见的像素闪动保证首尾都有帧。
  await page.waitForTimeout(300)
  await run(page, ui)
  await page.waitForTimeout(900)
  const ended = Date.now() / 1000
  await cdp.send("Page.stopScreencast")
  await context.close()
  encode(name, frames, started, ended, viewport, crop)
}

function makeUi(page, pointer) {
  const glide = async (x, y, ms = 520) => {
    const steps = Math.max(8, Math.round(ms / 16))
    const from = { ...pointer }
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e)
    }
    pointer.x = x
    pointer.y = y
  }
  const centerOf = async (target, fx = 0.5, fy = 0.5) => {
    const locator = typeof target === "string" ? page.locator(target).first() : target
    await locator.waitFor({ state: "visible" })
    const box = await locator.boundingBox()
    return { x: box.x + box.width * fx, y: box.y + box.height * fy }
  }
  return {
    glide,
    wait: (ms) => page.waitForTimeout(ms),
    async hover(target, fx, fy, ms) {
      const point = await centerOf(target, fx, fy)
      await glide(point.x, point.y, ms)
    },
    async click(target, { fx, fy, ms, modifiers = [], pause = 140 } = {}) {
      const point = await centerOf(target, fx, fy)
      await glide(point.x, point.y, ms)
      await page.waitForTimeout(pause)
      for (const key of modifiers) await page.keyboard.down(key)
      await page.mouse.down()
      await page.waitForTimeout(70)
      await page.mouse.up()
      for (const key of modifiers) await page.keyboard.up(key)
    },
    async canvas(fx, fy, options = {}) {
      return this.click("#preview", { ...options, fx, fy })
    },
    async drag(target, dx, dy, { fx, fy, ms = 700 } = {}) {
      const point = await centerOf(target, fx, fy)
      await glide(point.x, point.y)
      await page.mouse.down()
      await page.waitForTimeout(120)
      await glide(point.x + dx, point.y + dy, ms)
      await page.waitForTimeout(120)
      await page.mouse.up()
    },
    async type(text, delay = 90) {
      await page.keyboard.type(text, { delay })
    },
  }
}

/** 按帧时间戳把截屏合成固定帧率的 mp4，并转出动图 webp 与封面。 */
function encode(name, frames, started, ended, viewport, crop) {
  const work = mkdtempSync(join(tmpdir(), `demo-${name}-`))
  const usable = frames.filter((frame) => frame.t >= started - 0.05)
  const list = []
  usable.forEach((frame, index) => {
    const file = join(work, `${String(index).padStart(5, "0")}.jpg`)
    writeFileSync(file, frame.data)
    const next = usable[index + 1]?.t ?? ended
    list.push(`file '${file}'`, `duration ${Math.max(0.001, next - frame.t).toFixed(4)}`)
  })
  list.push(`file '${join(work, `${String(usable.length - 1).padStart(5, "0")}.jpg`)}'`)
  writeFileSync(join(work, "list.txt"), list.join("\n"))
  // 截屏帧不一定是 2 倍像素，按第一帧的实际宽度换算裁剪区域。
  const frameWidth = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width", "-of", "csv=p=0", join(work, "00000.jpg")], { encoding: "utf8" }))
  const k = frameWidth / viewport.width
  const px = (value) => Math.round(value * k / 2) * 2
  const cropFilter = crop ? `crop=${px(crop.w)}:${px(crop.h)}:${px(crop.x)}:${px(crop.y)},` : ""
  const width = crop?.out ?? 1600
  const base = `${cropFilter}fps=30,scale=${width}:-2:flags=lanczos`
  const mp4 = join(outDir, `${name}.mp4`)
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(work, "list.txt"),
    "-vf", `${base},format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-movflags", "+faststart", "-an", mp4])
  // GIF 方便发到聊天软件或贴进 README：降到 12 帧、限宽 800，用整段视频生成调色板。
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4, "-vf",
    `fps=12,scale=${Math.min(width / 2, 800)}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    "-loop", "0", join(outDir, `${name}.gif`)])
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-sseof", "-0.5", "-i", mp4, "-frames:v", "1", "-q:v", "3", join(outDir, `${name}.jpg`)])
  rmSync(work, { recursive: true, force: true })
  console.log(`  ${name}: ${usable.length} frames, ${(ended - started).toFixed(1)}s`)
}

async function openTemplate(page, template) {
  await page.locator(`.template-grid .template-card[data-template="${template}"]`).click()
  await settle(page)
}

async function settle(page) {
  await page.waitForSelector(".canvas-wrap:not(.empty)")
  await page.waitForFunction(() => document.querySelector("#preview")?.getBoundingClientRect().height > 60)
  await page.waitForFunction(() => {
    const dialog = document.querySelector("#file-operation-dialog")
    return !dialog?.open || !document.querySelector("#file-operation-close")?.disabled
  }, null, { timeout: 60000 })
  const close = page.locator("#file-operation-dialog[open] #file-operation-close")
  if (await close.isVisible().catch(() => false)) await close.click()
  await page.waitForTimeout(600)
}

const scenes = {}
const only = process.argv.slice(2)
const pick = (name) => !only.length || only.includes(name)

const DESKTOP = { width: 1280, height: 800 }
// 画布区域（桌面布局 1280×800 下左右两栏之间），用于只展示画布的场景。
const PHONE_CROP = { x: 362, y: 98, w: 440, h: 672, out: 880 }

async function openXiaomi(page, device) {
  await openTemplate(page, "xiaomi-unified-rounded-blur")
  if (device) await page.selectOption("#device", device)
  await page.waitForTimeout(500)
}

/** 原生下拉框在截屏里不显示，演示时先移过去点一下，再直接选值。 */
async function choose(page, ui, selector, value) {
  await ui.click(selector)
  await page.keyboard.press("Escape")
  await page.selectOption(selector, value)
}

// 1. 从模板开始，切换设备、明暗与横竖屏
scenes.preview = () => scene("preview", {
  viewport: DESKTOP,
  async run(page, ui) {
    await ui.hover('.template-card[data-template="official-android-bds"]', 0.5, 0.4, 700)
    await ui.wait(350)
    await ui.hover('.template-card[data-template="iqoo-rounded-black"]', 0.5, 0.4, 600)
    await ui.wait(300)
    await ui.click('.template-card[data-template="xiaomi-unified-rounded-blur"]', { fx: 0.5, fy: 0.4 })
    await settle(page)
    await ui.wait(700)
    await choose(page, ui, "#device", "iphone-17-pro")
    await ui.wait(1200)
    await ui.click('[data-theme-choice="dark"]')
    await ui.wait(1200)
    await ui.click('[data-orientation-choice="land"]')
    await ui.wait(1400)
    await ui.click('[data-orientation-choice="port"]')
    await ui.wait(500)
    await choose(page, ui, "#device", "pixel-10-pro")
    await ui.wait(1100)
    await ui.click('[data-theme-choice="light"]')
    await ui.wait(900)
  },
})

// 2. 交互预览：在模拟手机里打字
const KEYS26 = { n: [0.70, 0.55], i: [0.75, 0.15], h: [0.60, 0.35], a: [0.10, 0.35], o: [0.85, 0.15], w: [0.15, 0.15], m: [0.80, 0.55], e: [0.25, 0.15], s: [0.20, 0.35], d: [0.30, 0.35], j: [0.70, 0.35], backspace: [0.93, 0.55] }
scenes.typing = () => scene("typing", {
  viewport: DESKTOP,
  crop: PHONE_CROP,
  async setup(page, ui) {
    await openXiaomi(page, "iphone-17-pro")
    await page.locator(".sidebar-overview button", { hasText: "拼音 26 键" }).first().click()
    await page.waitForTimeout(800)
    await ui.glide(700, 700, 10)
  },
  async run(page, ui) {
    for (const letter of "nihao") {
      const [fx, fy] = KEYS26[letter]
      await ui.canvas(fx, fy, { ms: 260, pause: 60 })
      await ui.wait(260)
    }
    await ui.wait(700)
    for (let i = 0; i < 5; i += 1) {
      await ui.canvas(...KEYS26.backspace, { ms: i ? 120 : 500, pause: 40 })
      await ui.wait(140)
    }
    await ui.wait(400)
    for (const letter of "jianshe") {
      const [fx, fy] = KEYS26[letter]
      await ui.canvas(fx, fy, { ms: 260, pause: 60 })
      await ui.wait(240)
    }
    await ui.wait(900)
  },
})

// 3. 编辑模式：拖动按键、对齐辅助线、检查器精确修改与撤销
scenes.edit = () => scene("edit", {
  viewport: DESKTOP,
  async setup(page) {
    await openXiaomi(page)
  },
  async run(page, ui) {
    await ui.click(page.getByRole("button", { name: "编辑模式", exact: true }))
    await ui.wait(500)
    await ui.canvas(0.42, 0.25)
    await ui.wait(700)
    await ui.click('[data-key-mode="move"]:visible')
    await ui.wait(400)
    await ui.drag("#preview", 70, 40, { fx: 0.42, fy: 0.25, ms: 1100 })
    await ui.wait(1000)
    const width = page.locator("[data-key-field=width]:visible")
    await ui.click(width, { fx: 0.7 })
    await ui.wait(300)
    await width.fill("300")
    await width.press("Enter")
    await ui.wait(1300)
    await ui.click("#desktop-undo")
    await ui.wait(700)
    await ui.click("#desktop-undo")
    await ui.wait(900)
    await ui.canvas(0.30, 0.62)
    await ui.wait(300)
    await ui.canvas(0.55, 0.62, { modifiers: ["Control"] })
    await ui.wait(900)
    await ui.hover('#inspector-multi-layout [data-layout-action="same-height"]', 0.5, 0.5, 600)
    await ui.wait(1000)
  },
})

// 4. 源代码：选中按键定位配置，改一行，画布同步
scenes.source = () => scene("source", {
  viewport: DESKTOP,
  async setup(page, ui) {
    await openXiaomi(page)
    await page.getByRole("button", { name: "编辑模式", exact: true }).click()
    await page.waitForTimeout(400)
  },
  async run(page, ui) {
    await ui.click('[data-inspector-tab="source"]')
    await ui.wait(600)
    await ui.canvas(0.88, 0.62)
    await ui.wait(1100)
    await ui.canvas(0.42, 0.25)
    await ui.wait(1100)
    const line = page.locator("#source .cm-line.cm-source-selected", { hasText: "BACK_STYLE=" }).first()
    await ui.click(line, { fx: 0.9 })
    await page.keyboard.press("End")
    await ui.wait(300)
    for (let i = 0; i < 3; i += 1) { await page.keyboard.press("Backspace"); await ui.wait(90) }
    await ui.type("414", 160)
    await ui.wait(1600)
    await ui.hover("#preview", 0.42, 0.25, 700)
    await ui.wait(1200)
  },
})

// 5. 动效设计：动画列表与播放器
scenes.motion = () => scene("motion", {
  viewport: DESKTOP,
  async setup(page) {
    const { bdaAnimatedSkinBytes } = await bdaFixture()
    await page.locator("#browser-open").setInputFiles({ name: "动效示例.bda", mimeType: "application/octet-stream", buffer: Buffer.from(bdaAnimatedSkinBytes()) })
    await settle(page)
  },
  async run(page, ui) {
    await ui.click('.sidebar-overview button[data-nav-mode="motion"]')
    await page.waitForSelector("#animation-library .ui-listbox")
    await ui.wait(900)
    const play = page.locator(".ui-animation-transport button").first()
    await ui.click(play)
    await ui.wait(2600)
    const rows = page.locator("#animation-library .ui-listbox [role=option]")
    await ui.click(rows.nth(5))
    await ui.wait(500)
    await ui.click(play)
    await ui.wait(2400)
    await ui.click(rows.nth(1))
    await ui.wait(500)
    await ui.click(play)
    await ui.wait(2400)
  },
})

// 6. 导出为手心皮肤，再打开导出的文件
scenes.export = () => scene("export", {
  viewport: DESKTOP,
  async setup(page) {
    await openXiaomi(page, "iphone-17-pro")
  },
  async run(page, ui) {
    await ui.click(".pen-file-menu > summary")
    await ui.wait(500)
    await ui.hover('.pen-file-menu [data-export-format="bdi"]', 0.4, 0.5, 400)
    await ui.wait(250)
    await ui.hover('.pen-file-menu [data-export-format="bds"]', 0.4, 0.5, 300)
    await ui.wait(250)
    const pending = page.waitForEvent("download", { timeout: 60000 })
    await ui.click('.pen-file-menu [data-export-format="sxi"]', { fx: 0.4 })
    const download = await pending
    await page.locator('#file-operation-dialog[open][data-outcome="success"]').waitFor()
    await ui.wait(900)
    await ui.click("#file-operation-close")
    await ui.wait(400)
    const bytes = await download.createReadStream().then((stream) => new Promise((done) => {
      const chunks = []
      stream.on("data", (chunk) => chunks.push(chunk))
      stream.on("end", () => done(Buffer.concat(chunks)))
    }))
    await ui.click(".pen-file-menu > summary")
    await ui.wait(300)
    await ui.hover("#open", 0.4, 0.5, 400)
    await ui.wait(300)
    await page.keyboard.press("Escape")
    await page.locator("#browser-open").setInputFiles({ name: "小米统一圆角.sxi", mimeType: "application/octet-stream", buffer: bytes })
    // 当前皮肤未保存，打开新文件前会先询问
    await ui.click(page.locator("#unsaved-dialog").getByRole("button", { name: "不保存", exact: true }))
    await settle(page)
    await ui.wait(800)
    await ui.hover("#document-name", 0.5, 0.5, 600)
    await ui.wait(1500)
  },
})

// 7. 手机浏览器：上下分屏
scenes.mobile = () => scene("mobile", {
  viewport: { width: 390, height: 844 },
  touch: true,
  crop: { x: 0, y: 0, w: 390, h: 844, out: 780 },
  async run(page, ui) {
    await ui.click('.template-card[data-template="xiaomi-unified-rounded-blur"]', { fx: 0.5, fy: 0.4 })
    await settle(page)
    await ui.wait(700)
    await ui.click(page.locator("button:visible", { hasText: "拼音 26 键" }).first())
    await ui.wait(1000)
    await ui.drag("#mobile-split-handle", 0, -150, { ms: 800 })
    await ui.wait(800)
    for (const [fx, fy] of [[0.62, 0.15], [0.12, 0.38], [0.66, 0.6]]) {
      await ui.canvas(fx, fy, { ms: 300 })
      await ui.wait(350)
    }
    await ui.wait(500)
    const theme = page.locator('[data-mobile-choice="theme"]:visible')
    const orientation = page.locator('[data-mobile-choice="orientation"]:visible')
    await ui.click(theme)
    await ui.wait(1100)
    await ui.click(orientation)
    await ui.wait(1300)
    await ui.click(orientation)
    await ui.wait(700)
    await ui.click(theme)
    await ui.wait(800)
  },
})

for (const [name, run] of Object.entries(scenes)) if (pick(name)) {
  console.log(`scene ${name}`)
  await run()
}
await browser.close()
await server.close()
