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
document.querySelectorAll(".hero-media video, video[data-lazy]").forEach((video) => {
  if (reducedMotion) {
    video.removeAttribute("autoplay")
    video.controls = true
    video.pause()
  }
  videoObserver.observe(video)
})

// 功能演示：左侧列表切换右侧视频，播完自动下一段。
const theater = document.querySelector("[data-theater]")
if (theater) {
  const tabs = [...theater.querySelectorAll('[role="tab"]')]
  const stage = theater.querySelector(".theater-stage")
  const video = theater.querySelector("[data-stage-video]")
  const caption = theater.querySelector("[data-stage-caption]")
  const gif = theater.querySelector("[data-stage-gif]")
  let current = 0
  let inView = false
  if (reducedMotion) video.controls = true

  const progressOf = (tab) => tab.querySelector(".tab-progress span")

  const select = (index, { focus = false, autoplay = true } = {}) => {
    current = (index + tabs.length) % tabs.length
    const tab = tabs[current]
    const name = tab.dataset.demo
    tabs.forEach((item, i) => {
      item.setAttribute("aria-selected", String(i === current))
      item.tabIndex = i === current ? 0 : -1
      progressOf(item).style.transform = "scaleX(0)"
    })
    if (focus) tab.focus()
    stage.dataset.shape = tab.dataset.shape
    stage.toggleAttribute("data-switching", true)
    window.setTimeout(() => {
      video.poster = `assets/demos/${name}.jpg`
      video.src = `assets/demos/${name}.mp4`
      caption.textContent = `真实录屏 · ${tab.querySelector(".tab-title").textContent}`
      gif.href = `assets/demos/${name}.gif`
      stage.toggleAttribute("data-switching", false)
      if (autoplay && inView) play(video)
    }, reducedMotion ? 0 : 180)
    // 窄屏时列表横向滚动，让当前项保持可见。
    tab.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion ? "auto" : "smooth" })
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
    if (!video.duration) return
    progressOf(tabs[current]).style.transform = `scaleX(${video.currentTime / video.duration})`
  })
  video.addEventListener("ended", () => select(current + 1))

  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting
    if (inView) play(video)
    else video.pause()
  }, { threshold: 0.3 }).observe(stage)
}
