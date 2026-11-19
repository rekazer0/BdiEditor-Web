// 键设官网：进场动画、按可见性播放演示视频、功能演示切换。
document.documentElement.classList.remove("no-js")

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches

// 进场动画
const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    entry.target.classList.add("is-visible")
    revealObserver.unobserve(entry.target)
  }
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 })
document.querySelectorAll(".reveal").forEach((node) => revealObserver.observe(node))

// 用户设置了减少动态效果时不自动播放，改为显示播放控件。
const play = (video) => {
  if (reducedMotion) return
  video.play().catch(() => {})
}

// 演示视频只在进入视口时播放，离开就暂停，省流量也省电。
const videoObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const video = entry.target
    if (entry.isIntersecting) {
      if (video.preload === "none") video.preload = "auto"
      play(video)
    } else {
      video.pause()
    }
  }
}, { threshold: 0.25 })
document.querySelectorAll("video[data-lazy]").forEach((video) => {
  if (reducedMotion) {
    video.controls = true
    video.pause()
  }
  videoObserver.observe(video)
})

// 功能演示：左侧列表切换右侧视频或 GIF，视频播完自动下一段。
const theater = document.querySelector("[data-theater]")
if (theater) {
  const list = theater.querySelector(".theater-list")
  const tabs = [...list.querySelectorAll('[role="tab"]')]
  const stage = theater.querySelector(".theater-stage")
  const video = theater.querySelector("[data-stage-video]")
  const caption = theater.querySelector("[data-stage-caption]")
  const gif = theater.querySelector("[data-stage-gif]")
  const image = theater.querySelector("[data-stage-image]")
  const toggle = theater.querySelector("[data-stage-toggle]")
  let gifPlaying = false
  let current = 0
  let inView = false

  const progressOf = (tab) => tab.querySelector(".tab-progress span")

  const syncMedia = () => {
    if (image.hidden) {
      if (inView) play(video)
      else video.pause()
      return
    }
    image.src = inView && gifPlaying ? gif.href : `assets/demos/${tabs[current].dataset.demo}.jpg`
    toggle.textContent = gifPlaying ? "停止 GIF" : "播放 GIF"
  }

  toggle.addEventListener("click", () => {
    gifPlaying = !gifPlaying
    syncMedia()
  })

  const select = (index, { focus = false } = {}) => {
    current = (index + tabs.length) % tabs.length
    const tab = tabs[current]
    const name = tab.dataset.demo
    tabs.forEach((item, i) => {
      item.setAttribute("aria-selected", String(i === current))
      item.tabIndex = i === current ? 0 : -1
      progressOf(item).style.transform = "scaleX(0)"
    })
    if (focus) tab.focus({ preventScroll: true })
    const title = tab.querySelector(".tab-title").textContent
    stage.dataset.shape = tab.dataset.shape
    stage.setAttribute("aria-labelledby", tab.id)
    const showGif = tab.hasAttribute("data-gif")
    video.hidden = showGif
    image.hidden = toggle.hidden = !showGif
    gifPlaying = showGif && !reducedMotion
    if (showGif) {
      video.pause()
      image.alt = `演示：${title}`
    } else {
      image.removeAttribute("src")
      video.poster = `assets/demos/${name}.jpg`
      video.src = `assets/demos/${name}.mp4`
      video.setAttribute("aria-label", `演示：${title}`)
    }
    caption.textContent = `真实录屏 · ${title}`
    gif.href = `assets/demos/${name}.gif`
    syncMedia()
    // 只滚动横向选项列表，自动换片不移动页面。
    if (list.scrollWidth > list.clientWidth) {
      const item = tab.getBoundingClientRect()
      const track = list.getBoundingClientRect()
      list.scrollBy({ left: item.left < track.left ? item.left - track.left : Math.max(0, item.right - track.right + 4), behavior: reducedMotion ? "auto" : "smooth" })
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(index))
    tab.addEventListener("keydown", (event) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
      if (event.key === "Home") select(0, { focus: true })
      else if (event.key === "End") select(tabs.length - 1, { focus: true })
      else if (step) select(current + step, { focus: true })
      else return
      event.preventDefault()
    })
  })

  video.addEventListener("timeupdate", () => {
    if (video.hidden || !video.duration) return
    progressOf(tabs[current]).style.transform = `scaleX(${video.currentTime / video.duration})`
  })
  video.addEventListener("ended", () => {
    if (!video.hidden && !reducedMotion) select(current + 1)
  })

  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting
    syncMedia()
  }, { threshold: 0.3 }).observe(stage)
}
