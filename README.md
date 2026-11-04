# 键设 KeySkin 官网

[键设 KeySkin](https://github.com/rekazer0/keyskin) 的官方网站：一款面向百度（BDI / BDS / BDA）、搜狗（SSF / MSSF）与手心（SXI）输入法皮肤的可视化编辑器。

![交互预览：在模拟手机里用 26 键打字](dist/assets/demos/typing.gif)

## 页面内容

- 首屏：产品介绍、在线使用与下载入口，配一段真实录屏
- 功能演示：7 段可切换的录屏（实时预览、交互预览、编辑按键、源码联动、动效设计、跨格式导出、移动端），播完自动下一段，每段都可下载 GIF
- 功能详解、格式支持、更多能力、快速上手、下载与开源信息
- 自动适配浅色 / 深色与手机屏幕；开启“减少动态效果”时不自动播放

## 本地预览

纯静态站点，无需安装依赖：

```bash
npm run serve        # 等同于 python3 -m http.server 4173 --directory dist
npm test             # 检查文案、演示素材与页面引用的文件
```

浏览器打开 http://127.0.0.1:4173/。

## 重新录制功能演示

`dist/assets/demos/` 里的视频（`.mp4`）、动图（`.gif`）与封面（`.jpg`）都由脚本在键设网页版里真实操作后生成。编辑器界面更新后可以重录：

```bash
git clone https://github.com/rekazer0/keyskin ../keyskin
(cd ../keyskin && npm ci)
KEYSKIN_DIR=../keyskin npm run record            # 全部场景
KEYSKIN_DIR=../keyskin npm run record -- typing  # 只录某一段
```

需要系统里有 `ffmpeg`。若 Playwright 找不到浏览器，用 `CHROMIUM_PATH` 指定 Chromium 路径。

## License

GPL-3.0
