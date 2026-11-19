// 录制官网的功能演示动图。
// 用法：KEYSKIN_DIR=../keyskin node scripts/record-demos.mjs [场景名...]
// 需要 keyskin 仓库已 npm ci，以及系统里的 ffmpeg。
// 在 keyskin 的网页版里用 Playwright 真实操作一遍，按 CDP 截屏帧（保留每帧时间戳）合成视频，
// 输出 dist/assets/demos/<场景>.mp4、<场景>.gif（动图）与 <场景>.jpg（封面）。
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

const keyskin = resolve(process.env.KEYSKIN_DIR ?? "../keyskin")
const outDir = resolve(new URL("../dist/assets/demos", import.meta.url).pathname)
mkdirSync(outDir, { recursive: true })
const require = createRequire(join(keyskin, "package.json"))
const { chromium } = require("playwright")
const { createServer } = await import(require.resolve("vite"))
const server = await createServer({ root: keyskin, configFile: join(keyskin, "vite.config.ts"), logLevel: "error", server: { port: 41850, strictPort: false, host: "127.0.0.1" } })
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
  const context = await browser.newContext({ viewport, colorScheme, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-tour-v1", "done")
    delete window.showSaveFilePicker
    window.showSaveFilePicker = undefined
  })
  await page.addInitScript(`window.__demoTouch = ${touch};` + CURSOR)
  await page.goto(baseURL)
  await page.waitForSelector(touch ? "#mobile-welcome-new" : "#file-project-chooser .template-card")
  const pointer = { x: viewport.width * 0.62, y: viewport.height * 0.7 }
  const ui = makeUi(page, pointer)
  let cover
  ui.markCover = async () => { cover = await page.screenshot({ type: "jpeg", quality: 94, scale: "css" }) }
  await page.mouse.move(pointer.x, pointer.y)
  if (setup) await setup(page, ui)
  await page.waitForTimeout(400)

  const frames = []
  const cdp = await context.newCDPSession(page)
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    frames.push({ data: Buffer.from(data, "base64"), t: metadata.timestamp })
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {})
  })
  const started = Date.now() / 1000
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: viewport.width * 2, maxHeight: viewport.height * 2, everyNthFrame: 1 })
  await page.waitForTimeout(300)
  await run(page, ui)
  await page.waitForTimeout(900)
  const ended = Date.now() / 1000
  await cdp.send("Page.stopScreencast")
  await context.close()
  encode(name, frames, started, ended, viewport, crop, cover)
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
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    return { x: box.x + box.width * fx, y: box.y + box.height * fy }
  }
  return {
    wait: (ms) => page.waitForTimeout(ms),
    async hover(target, fx, fy, ms) {
      const point = await centerOf(target, fx, fy)
      await glide(point.x, point.y, ms)
    },
    async click(target, { fx, fy, ms, pause = 140 } = {}) {
      const point = await centerOf(target, fx, fy)
      await glide(point.x, point.y, ms)
      await page.waitForTimeout(pause)
      await page.mouse.down()
      await page.waitForTimeout(70)
      await page.mouse.up()
    },
    async drag(source, target, { fx, fy, marker } = {}) {
      const from = await centerOf(source)
      const to = await centerOf(target, fx, fy)
      await glide(from.x, from.y)
      await page.mouse.down()
      await page.waitForTimeout(120)
      await glide(to.x, to.y, 900)
      await marker?.waitFor({ state: "visible" })
      await page.waitForTimeout(600)
      await page.mouse.up()
    },
    async canvas(fx, fy, options = {}) {
      return this.click("#preview", { ...options, fx, fy })
    },
  }
}

/** 按帧时间戳把截屏合成固定帧率的 mp4，并转出动图 GIF 与封面。 */
function encode(name, frames, started, ended, viewport, crop, cover) {
  const usable = frames.filter((frame) => frame.t >= started)
  assert.ok(usable.length > 1, `${name} 没有录到操作帧`)
  const work = mkdtempSync(join(outDir, `.record-${name}-`))
  const list = []
  try {
    usable.forEach((frame, index) => {
      const file = join(work, `${String(index).padStart(5, "0")}.jpg`)
      writeFileSync(file, frame.data)
      const next = usable[index + 1]?.t ?? ended
      list.push(`file '${file}'`, `duration ${Math.max(0.001, next - frame.t).toFixed(4)}`)
    })
    list.push(`file '${join(work, `${String(usable.length - 1).padStart(5, "0")}.jpg`)}'`)
    writeFileSync(join(work, "list.txt"), list.join("\n"))
    const cropFilter = crop ? `crop=iw*${crop.w}/${viewport.width}:ih*${crop.h}/${viewport.height}:iw*${crop.x}/${viewport.width}:ih*${crop.y}/${viewport.height},` : ""
    const width = crop?.out ?? 1600
    const base = `${cropFilter}fps=30,scale=${width}:-2:flags=lanczos`
    const mp4 = join(work, `${name}.mp4`)
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(work, "list.txt"),
      "-vf", `${base},format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-movflags", "+faststart", "-an", mp4])
    // GIF 方便发到聊天软件或贴进 README：降到 12 帧、限宽 800，用整段视频生成调色板。
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4, "-vf",
      `fps=12,scale=${Math.min(width / 2, 800)}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
      "-loop", "0", join(work, `${name}.gif`)])
    const coverInput = join(work, "cover.jpg")
    if (cover) writeFileSync(coverInput, cover)
    const posterInput = cover ? ["-i", coverInput, "-vf", `${cropFilter}scale=${width}:-2`] : ["-sseof", "-0.5", "-i", mp4]
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...posterInput, "-frames:v", "1", "-q:v", "3", join(work, `${name}.jpg`)])
    for (const ext of ["mp4", "gif", "jpg"]) {
      const file = `${name}.${ext}`
      renameSync(join(work, file), join(outDir, file))
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  console.log(`  ${name}: ${usable.length} frames, ${(ended - started).toFixed(1)}s`)
}

// 只从应用的内置模板列表新建；不上传测试夹具，也不重新导入导出的文件。
const BDS = "official-android-bds"
const XIAOMI = "xiaomi-unified-rounded-blur"
const OPPO = "oppo-dual-color"
const template = (id) => `[role="listbox"][aria-label="内置模板"] [data-template="${id}"]:visible`

async function openTemplate(page, id, ui) {
  const card = page.locator(template(id))
  if (ui) await ui.click(card)
  else await card.click()
  await page.waitForSelector(".canvas-wrap:not(.empty)")
  await page.waitForFunction(() => document.querySelector("#preview")?.getBoundingClientRect().height > 60)
  await page.waitForFunction(() => !document.querySelector("#file-operation-dialog").open)
}

const scenes = {}
const DESKTOP = { width: 1280, height: 800 }
const PHONE_CROP = { x: 453, y: 99, w: 338, h: 674, out: 676 }
const keyboard26 = 'button[data-path$="/py_26.ini"]'
const mode = (value) => `button[data-mode-choice="${value}"]:visible`
const workspace = (value) => `button[data-workspace-page="${value}"]:visible`

scenes.preview = () => scene("preview", {
  viewport: DESKTOP,
  async run(page, ui) {
    await ui.hover(template(BDS), 0.5, 0.4)
    await ui.wait(500)
    await openTemplate(page, XIAOMI, ui)
    await ui.wait(650)
    await ui.hover("#device")
    await page.selectOption("#device", "iphone-17-pro")
    await ui.wait(1100)
    await ui.click('[data-mobile-choice="theme"]:visible')
    assert.equal(await page.locator("#theme").inputValue(), "dark")
    await ui.wait(1000)
    await ui.click('[data-mobile-choice="orientation"]:visible')
    assert.equal(await page.locator("#orientation").inputValue(), "land")
    await ui.wait(1100)
    await ui.click('[data-mobile-choice="orientation"]:visible')
    await ui.wait(750)
    await ui.click('[data-mobile-choice="theme"]:visible')
  },
})

scenes.typing = () => scene("typing", {
  viewport: DESKTOP,
  crop: PHONE_CROP,
  async setup(page) {
    await openTemplate(page, XIAOMI)
    await page.locator(keyboard26).click()
    await page.locator(mode("preview")).click()
    await page.selectOption("#device", "iphone-17-pro")
  },
  async run(page, ui) {
    const keys = { n: [0.69, 0.56], i: [0.75, 0.16], h: [0.60, 0.36], a: [0.10, 0.36], o: [0.85, 0.16] }
    for (const letter of "nihao") {
      const [fx, fy] = keys[letter]
      await ui.canvas(fx, fy, { ms: 260, pause: 70 })
      await ui.wait(320)
    }
  },
})

scenes.edit = () => scene("edit", {
  viewport: DESKTOP,
  async setup(page) { await openTemplate(page, XIAOMI) },
  async run(page, ui) {
    await ui.click(mode("edit"))
    await ui.wait(500)
    await ui.canvas(0.42, 0.25)
    const width = page.locator("[data-key-field=width]:visible")
    const original = await width.inputValue()
    await ui.wait(650)
    await ui.click(width, { fx: 0.7 })
    await width.fill(String(Number(original) + 35))
    await width.press("Enter")
    assert.notEqual(await width.inputValue(), original)
    await ui.wait(1250)
    await ui.click("#desktop-undo")
    assert.equal(await width.inputValue(), original)
  },
})

scenes.source = () => scene("source", {
  viewport: DESKTOP,
  async setup(page) {
    await openTemplate(page, XIAOMI)
    await page.locator(mode("edit")).click()
  },
  async run(page, ui) {
    await ui.click("#inspector-source-toggle")
    await ui.wait(650)
    await ui.canvas(0.42, 0.25)
    await ui.wait(1000)
    const line = page.locator(".cm-line.cm-source-selected", { hasText: "VIEW_RECT=" }).first()
    await ui.click(line, { fx: 0.35 })
    const original = (await line.textContent()).trim()
    const updated = original.replace(/^(VIEW_RECT=)(\d+)/, (_, field, x) => field + (Number(x) + 35))
    assert.notEqual(updated, original)
    await page.keyboard.press("Home")
    await page.keyboard.press("Shift+End")
    await page.keyboard.insertText(updated)
    await page.locator(".cm-line", { hasText: updated }).waitFor()
    await ui.wait(1250)
    await ui.hover("#preview", 0.42, 0.25)
  },
})

scenes.resources = () => scene("resources", {
  viewport: DESKTOP,
  async setup(page) { await openTemplate(page, XIAOMI) },
  async run(page, ui) {
    await ui.click(workspace("resources"))
    await ui.wait(950)
    await ui.click('#resource-page-tabs [data-resource-catalog="all"]')
    await ui.wait(750)
    await ui.click('#resource-page-tabs [data-resource-page="image"]:visible')
    await ui.wait(700)
    const card = page.locator("#resource-gallery .ui-image-card").first()
    await ui.hover(card)
    await card.dblclick()
    await page.waitForSelector("#atlas-editor-dialog[open] #atlas-canvas")
    await ui.wait(1200)
  },
})

scenes.motion = () => scene("motion", {
  viewport: DESKTOP,
  async setup(page) { await openTemplate(page, OPPO) },
  async run(page, ui) {
    await ui.click(mode("edit"))
    await ui.click(workspace("animation"))
    const card = page.locator('#animation-library [data-animation-id="ANIM3"]')
    await ui.wait(650)
    await ui.click(card)
    await ui.wait(650)
    const marker = page.locator(".animation-drop-target .ui-badge", { hasText: /^按键 / })
    await ui.drag(card, "#preview", { fx: 0.44, fy: 0.46, marker })
    const dialog = page.getByRole("dialog", { name: "应用动画", exact: true })
    await dialog.waitFor()
    assert.match(await dialog.innerText(), /动画 3 → 按键 \d+/)
    await ui.wait(1550)
    await ui.markCover()
    await ui.click(dialog.getByRole("button", { name: "应用", exact: true }))
    await dialog.waitFor({ state: "detached" })
    const undo = page.locator("#desktop-undo")
    await page.waitForSelector("#desktop-undo:enabled")
    await ui.hover(undo)
    await ui.wait(900)
    await ui.click(undo)
    assert.ok(await undo.isDisabled())
  },
})

scenes.export = () => scene("export", {
  viewport: DESKTOP,
  async setup(page) { await openTemplate(page, XIAOMI) },
  async run(page, ui) {
    await ui.click("#workspace-export")
    await ui.wait(800)
    await ui.click('#share-dialog label:has(input[value="bda:android"])')
    await ui.wait(750)
    const pending = page.waitForEvent("download", { timeout: 30000 })
    await ui.click("#share-export")
    const confirm = page.getByRole("button", { name: "确认并继续", exact: true })
    await confirm.waitFor()
    await ui.wait(1700)
    await ui.click(confirm)
    const download = await pending
    assert.match(download.suggestedFilename(), /\.bda$/)
    assert.equal(await download.failure(), null)
    await page.waitForSelector('#file-operation-dialog[open][data-outcome="success"]')
    await ui.wait(1200)
  },
})

scenes.adb = () => scene("adb", {
  viewport: DESKTOP,
  async setup(page) {
    await openTemplate(page, XIAOMI)
    await page.evaluate(async () => {
      // 只在这个录制页面模拟桌面端返回，不执行 ADB，也不访问设备。
      const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))
      let reportProgress
      window.__TAURI_INTERNALS__ = {
        transformCallback(callback) { reportProgress = callback; return 1 },
        async invoke(command, payload, options) {
          if (command === "test_adb_connection") {
            await wait(650)
            return "演示设备（模拟）"
          }
          if (command !== "share_skin_adb") return
          const { format, name } = JSON.parse(options.headers["x-keyskin-args"])
          if (!(payload instanceof Uint8Array) || !payload.length || format !== "bds" || !name.endsWith(".bds")) {
            throw new Error("录制收到了无效的 BDS 皮肤数据")
          }
          reportProgress({ index: 0, message: "正在向模拟 Android 设备推送皮肤…" })
          await wait(1550)
          reportProgress({ index: 1, message: "皮肤文件已送达模拟设备" })
          await wait(1000)
        },
      }
      const { wireAdbShare } = await import("/src/app/adb-share.ts")
      wireAdbShare()
      const note = document.createElement("span")
      note.id = "record-adb-note"
      note.textContent = "模拟演示 · 未连接真机"
      Object.assign(note.style, { position: "fixed", left: "50%", bottom: "16px", translate: "-50% 0", zIndex: 2147483646,
        color: "#fff", background: "#18294b", padding: "7px 13px", borderRadius: "8px", fontSize: "14px", pointerEvents: "none" })
      document.body.append(note)
    })
  },
  async run(page, ui) {
    await ui.click('[data-settings-entry="settings"]:visible')
    await ui.click("#settings-adb-nav")
    await ui.wait(1100)
    await ui.click("#adb-test")
    await page.locator("#adb-test-status").filter({ hasText: "连接成功：演示设备（模拟）" }).waitFor()
    await ui.wait(1700)
    await ui.click("#settings-save")
    await page.locator("#settings-workspace").waitFor({ state: "hidden" })
    await ui.click("#workspace-export")
    const note = page.locator("#record-adb-note")
    await note.evaluate(el => {
      // 分享对话框在顶层，录制提示随对话框显示。
      document.querySelector("#share-title").after(el)
      Object.assign(el.style, { position: "static", translate: "none", display: "inline-block", marginTop: "6px" })
    })
    await ui.wait(950)
    await ui.click("#adb-share")
    await page.locator("#file-operation-detail").filter({ hasText: "正在向模拟 Android 设备推送皮肤" }).waitFor()
    await ui.markCover()
    await page.waitForFunction(() => document.querySelector("#event-log").textContent === "分享到 ADB完成")
    await note.evaluate(el => { el.textContent = "模拟演示 · 皮肤推送完成" })
    await ui.wait(1850)
  },
})

scenes.toolbar = () => scene("toolbar", {
  viewport: DESKTOP,
  async setup(page) { await openTemplate(page, XIAOMI) },
  async run(page, ui) {
    await ui.click("#workspace-tools-open")
    const tools = page.locator("#workspace-tools-dialog[open]")
    const toolbar = tools.locator("#pinned-toolbar")
    const marker = page.locator(".ui-toolbar-drag-preview")
    await ui.wait(950)
    await ui.drag(tools.locator('[data-workspace-tool="save"]'), toolbar, { marker })
    await ui.wait(700)
    await ui.drag(tools.locator('[data-workspace-tool="mobile-export-open"]'), toolbar, { fx: 0.87, marker })
    await ui.wait(800)
    await ui.markCover()
    await page.keyboard.press("Escape")
    await tools.waitFor({ state: "hidden" })
    const pinned = page.locator("#pinned-toolbar .ui-pinned-tool")
    const order = () => pinned.evaluateAll(nodes => nodes.map(node => node.dataset.toolbarAction))
    assert.deepEqual(await order(), ["save", "mobile-export-open"])
    await ui.wait(750)
    await ui.drag(pinned.nth(1), page.locator("#pinned-toolbar"), { fx: 0.05, marker })
    assert.deepEqual(await order(), ["mobile-export-open", "save"])
    await ui.hover(pinned.nth(0))
    await ui.wait(1000)
  },
})

scenes.theme = () => scene("theme", {
  viewport: DESKTOP,
  async setup(page) { await openTemplate(page, XIAOMI) },
  async run(page, ui) {
    await ui.click('#workspace-navigation [data-settings-entry="settings"]')
    const list = page.getByRole("listbox", { name: "界面主题", exact: true })
    await list.waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll("#settings-theme-list img")].every(image => image.naturalWidth > 0))
    await ui.wait(1000)
    await ui.hover(list, 0.7)
    await page.mouse.wheel(900, 0)
    await ui.wait(550)
    for (const variant of ["rose-quartz", "deep-sea"]) {
      const card = list.locator(`[role="option"][data-value="${variant}"]`)
      await ui.click(card)
      await page.waitForFunction(value => document.documentElement.dataset.interfaceTheme === value, variant)
      assert.equal(await card.getAttribute("aria-selected"), "true")
      await ui.wait(1250)
    }
    await ui.markCover()
    await ui.click("#settings-save")
    await page.locator("#settings-workspace").waitFor({ state: "hidden" })
    assert.equal(await page.evaluate(() => localStorage.getItem("interface-theme")), "deep-sea")
    await ui.wait(1250)
  },
})

scenes.mobile = () => scene("mobile", {
  viewport: { width: 390, height: 844 },
  touch: true,
  crop: { x: 0, y: 0, w: 390, h: 844, out: 780 },
  async run(page, ui) {
    await ui.click("#mobile-welcome-new")
    await ui.wait(800)
    await openTemplate(page, XIAOMI, ui)
    assert.equal(await page.locator("#mode").inputValue(), "preview")
    await ui.wait(850)
    for (const [fx, fy] of [[0.60, 0.42], [0.58, 0.64], [0.80, 0.42]]) {
      await ui.canvas(fx, fy, { ms: 300 })
      await ui.wait(300)
    }
    await ui.click(page.getByRole("button", { name: "开始编辑", exact: true }))
    assert.equal(await page.locator("#mode").inputValue(), "edit")
    await ui.wait(700)
    await ui.canvas(0.42, 0.25)
    await ui.wait(800)
    await ui.click('#mobile-navigation [data-mobile-page="home"]')
    await ui.wait(800)
    await ui.click('#mobile-navigation [data-mobile-page="edit"]')
    await ui.wait(900)
  },
})

try {
  const requested = process.argv.slice(2)
  for (const name of requested.length ? requested : Object.keys(scenes)) {
    assert.ok(Object.hasOwn(scenes, name), `未知演示场景：${name}`)
    console.log(`scene ${name}`)
    await scenes[name]()
  }
} finally {
  await browser.close()
  await server.close()
}
