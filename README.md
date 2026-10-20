# BdiEditor-Web

BdiEditor 的开源介绍与教程网站，面向百度、搜狗、手心三种手机输入法皮肤生态。

在线站点（当前 Sites 部署为账号私有预览）：https://bdieditor-guide.equalthyme11.chatgpt.site
公开源码：https://github.com/rekazer0/BdiEditor-Web

## 内容

- 介绍页：编辑器工作流、格式边界、隐私与开源入口
- 教程页：12 个可搜索章节，分为“界面操作”和“源代码操作”
- 图片：当前 BdiEditor 的真实预览截图和移动端截图
- 样本：百度 BDS、搜狗转换模板、手心 SXI，可直接下载跟练

## 本地预览

无需安装依赖：

```bash
python3 -m http.server 4173 --directory dist
```

浏览器打开 http://127.0.0.1:4173/。

## 依据

教程内容依据当前 [BdiEditor](https://github.com/rekazer0/BdiEditor) 的 README、源码、研究记录和《百度手机输入法皮肤工具书 V6》整理。跨格式转换仍应以目标输入法真机安装结果为最终验收。

## License

GPL-3.0

