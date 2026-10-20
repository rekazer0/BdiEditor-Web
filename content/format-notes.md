# 搜狗与手心教程内容研究（源码核对）

研究目录：`/Users/kaze/work/bdi`。只读代码与本地文档，没有修改编辑器、没有联网、没有发布。资料截至本轮工作区；若主任务拉取后有变更，以最终 commit 为准。

## 1. 先把三种操作分开

| 格式 | 界面中可以做 | 源代码中应该做 | 不应承诺 |
| --- | --- | --- | --- |
| 搜狗 SSF/MSSF | 背景、前景、颜色、候选栏、输入码、符号列、动画引用与参数、音效；共享样式“单独设置”；多选共同属性 | 原始 phoneSkin.ini、keys.ini、anim.ini、time.ini、sound_android.ini | 增删按键、自由改位置或尺寸；按键动画在画布播放；电脑候选窗皮肤支持 |
| 手心 SXI | 选择按键、前景样式编号、选择图片与切片、增加图片样式并加入前景、替换资源、状态预览 | skin.json 或选中对象的 JSON 片段；几何、动作、候选、气泡、动画与声音配置 | 把概览中生成的 INI/CSS/TIL 当成原始文件编辑；全属性都可由表单直接改 |

证据：README.md:99–115；src/app/ssf-inspector.ts:41–220；src/palm/sxi-edit.ts:13–67；src/app/sxi-documents.ts:28–54；src/app/edit-history.ts:89。SXI 的“属性只读”存在前景编号与图片选择这些明确例外，教程不能一概写“完全不能在界面编辑”。

## 2. 建议的完整课程分类

每篇按“目标 → 适用格式 → 打开哪个对象 → 界面步骤 → 对应源码 → 检查结果 → 常见问题”组织；图文结合。界面操作和源码操作各有独立目录，再用格式标签筛选。

### 共通入门

1. 认识格式：百度 BDI/BDS/BDA、搜狗 SSF/MSSF、手心 SXI；手机包与 PC 包边界。
2. 打开/新建、保存/另存、最近文件、导出与分享、未保存保护。
3. 界面地图：概览/源文件、画布、检查器、属性/源代码/AI 设计。
4. 交互预览和编辑模式；模拟输入不是输入法引擎。
5. 设备、安全区、横竖屏、明暗、缩放平移、辅助线；移动端上下分屏。
6. 单选、多选、Shift 范围选择、撤销/重做、检查器筛选与已改重置。
7. 皮肤结构：信息、布局、样式、图片切片、字体、候选、气泡、动画、声音、预览图。

### 界面操作 / 搜狗

1. 打开 SSF/MSSF，认识“皮肤 / 资源配置 / 键盘布局”概览。
2. “皮肤信息”改名称作者；“外观切换”查看 time.ini 与明暗关系。
3. 选择拼音九键、全键、14 键、大回车、双拼、五笔、笔画、粤语、英文布局；用原包的视觉套官方内建几何。
4. 不选按键时改整体：键盘背景、候选栏、候选字、输入码、默认按键背景/文字；九键另有符号列。
5. 选中按键改背景：共享默认样式与“单独设置”；正常/按下图片。
6. 改前景：keys.ini 的前景图、FG_RECT，或 phoneSkin.ini 的 ICON/ICON_PRESSED；没有前景时“添加前景图”。
7. 改文字：主/副文字、颜色、按下颜色、字体与字号（按原包已有字段）；共享文字与单键覆盖。
8. 气泡相关字段：POPUP_BG_COLOR、POPUP_OFFSET_VERTICAL、TextStyle_Popup_Code；不能承诺独立百度 .pop 文件。
9. 动画引用/动画配置与“不播放按键动画”的预览边界。
10. 音效选择与试听，默认声与单键声；替换已有音频资源。
11. 图片库、九宫格拉伸参数、透明图标、图片替换与多选共同字段。
12. 明暗/横竖屏逐项复核，保存 SSF，导出百度与降级清单。

### 源代码操作 / 搜狗

1. 包结构、编码兼容、分辨率与资源查找顺序。
2. phoneTheme.ini 信息与 time.ini 外观排程。
3. RootView/WALLPAPER 与 CandidateView 背景。
4. BG_IMAGES → NORMAL/PRESSED 与共享背景回退。
5. FG_IMAGES/FG_RECT/ICON：图形与位置含义。
6. TextStyle 继承、主副文字与候选/输入码/符号列。
7. anim.ini 引用、sound_android.ini 引用，资源缺失排错。
8. 源码更改 → 预览 → 保存 → 重开校验；转换时逐项查警告。

### 界面操作 / 手心

1. 打开 SXI；认识 skin.json 与生成视图；定位“源代码”标题上的 JSON 路径。
2. 切换明暗和横竖屏，选择拼音/英文/数字/符号/手写/表情等面板。
3. 选中按键，修改前景样式编号；正常/按下图片预览与切片；追加图片样式。
4. 图片资源预览/替换；字体和声音资源检查。
5. 候选栏、工具图标、气泡、按键按下状态的预览检查。
6. 只读字段如何切到对应 JSON 片段；代码示例应从真实已有片段改一个字段。
7. 保存 SXI、重开，与百度导出；SXI→BDA 中间转换和复杂动画降级。

### 源代码操作 / 手心

1. skin.json 根结构：info、default、night。
2. default/night 下：port_layout、land_layout；b 键盘、c 候选布局、h 气泡布局。
3. 面板 board、input、cand、hint、emoji、more、list、seg、top_cand。
4. keys 的 id、rect、hit_rect、values、b 样式、fix_a 状态；key_fix、offset、force。
5. s_info/s_port/s_land 样式：ss_1、ss_2、info 切片；共享与方向独立样式。
6. 文字 s_1、图片 s_2、描边 s_3、声音 s_4、动画事件 s_5。
7. 切片 rect1/rect2、拉伸与透明度；资源名/切片编号。
8. 候选：rect、insets、gap、i_cell、i_f_b/i_f_f、icon_list、switch。
9. 气泡：info 平铺映射、icon_info、i_cell；锚点、偏移、大小、内边距。
10. 动画 ss_2：基础补间、序列/组合、粒子等现有模型；按下/释放/出现/消失/长按触发。
11. 声音路径与点击/面板出现/面板隐藏；未知字段保留。
12. JSON 校验、撤销、保存重开、导出适配与真机验收。

## 3. 搜狗真实可读的包结构与字段示例

源文件：src/ssf/ssf-package.ts:1–13、99–166、185–194；测试样例：tests/helpers/ssf-fixture.mjs:62–184。

```text
phoneTheme.ini
time.ini                         # 可选，多状态/明暗排程
1080/
  status1/                       # 或直接 1080/phoneSkin.ini
    phoneSkin.ini
    keys.ini
    anim.ini
    bg.png / 26key.png / …
  status2/
    phoneSkin.ini / keys.ini / …
default/
  sound_android.ini
  s_code.wav / s_del.wav
  res/                           # 也可能存共享资源
```

资源查找：当前外观 INI 同目录 → 当前分辨率目录 → default/ → default/res/ → 包根。先用 time.ini 的 SUPPORT_SCREEN 与实际目录求可用分辨率，取最大；没有有效支持列表则取实际最大。正午覆盖状态识别为浅色，另一状态为深色；多于两套状态会警告只转换两套。缺少深色时不能虚构深色资源。

```ini
; phoneTheme.ini
[General]
skin_name=我的皮肤
skin_author=作者
skin_version=10000
supports-screens=1080,720
```

```ini
; time.ini
[General]
SUPPORT_SCREEN=1080
VERSION=1
[1080]
LOOP_TYPE=1
STATUS_LIST=status1,status2
[status1]
START=7
END=18
[status2]
START=0,19
END=6,23
```

```ini
; phoneSkin.ini，已有资源名示例，使用前应换成当前包真实文件
[RootView]
BG_STYLE=1
BG_IMAGE=bg.png
[CandidateView]
BG_STYLE=1
BG_IMAGE=BgCandidate1
[BgCandidate1]
NORMAL=bar.png
[KeyBg_Default_Latin]
NORMAL=26key.png,1,97,1,141
PRESSED=26key_pressed.png,1,97,1,141
[Key_Q]
BG_IMAGES=SMA_Key26Bg_Q
[SMA_Key26Bg_Q]
NORMAL=26keyq.png,2,96,3,139
PRESSED=26keyq_press.png,2,96,3,139
[TextStyle_Qwerty]
TEXT_COLOR=0xFF112233
TEXT_COLOR_PRESSED=0xFF445566
[TextStyle_Candidate]
TEXT_COLOR=0xFF010203
[TextStyle_Candidate_Highlight]
TEXT_COLOR=0xFFAA0000
```

关键含义：`BG_STYLE=2` 使用 BG_COLOR 纯色；`=1` 才是图片分支。颜色示例为 AARRGGBB，6 位值会补 FF 不透明。图片后四个整数是 **left,right,top,bottom 拉伸带**，不是 x,y,w,h；如 98×142 图的 1,97,1,141 保留周边固定像素。不要把其他 6 参数分支强行讲成此四参数九宫格。

```ini
; keys.ini
[Key_Q]
FG_IMAGES=Foground_key_Q
FG_RECT=0,0.25,1,0.75
ANIM_STYLE=Anim_Style_Key_Qwertys
[Foground_key_Q]
NORMAL=26q_x.png
PRESSED=26q_x_pressed.png
```

`FG_RECT` 是相对按键的 **left,top,right,bottom**。上例前景框宽为整个键，高为键高中间 50%。它和图片拉伸四参数的顺序不同。图片在框内等比摆放，不能讲成 x,y,width,height。源码：src/ssf/ssf-look.ts:161–190；research/sogou-preview-fidelity.md:20–24。

```ini
; default/sound_android.ini
[Key]
sound=s_code
[Key_Backspace_Qwerty]
sound=s_del
```

声效名字一般不含扩展名；资源解析尝试 wav/ogg/mp3 与原始名。UI 选项来自 default/ 或 default/res/ 已有音频。src/app/ssf-inspector.ts:31–38、141–155；src/ssf/ssf-look.ts:307–318。

## 4. 手心包结构、模型与源码片段

原生包可能用 `light/skin/res/…`，导出包可能是 `light/res/…`；编辑器内部统一成规范路径，而保存保留原路径映射。不要要求用户把所有现存包重排目录。见 tests/sxi-native.test.mjs:123–150。

```text
skin.json                         # 唯一配置源
info.json                         # 若包里已有，信息编辑会同步
preview.png
native.layout                     # 可能存在
light/skin/res/…                  # 或 light/res/…
dark/skin/res/…                   # 按包是否有夜间主题
```

内部皮肤数据：

```text
skin.json
├─ info
├─ default                        # 浅色
│  ├─ port_layout
│  │  ├─ b.full26Pinyin            # 投影 py_26.ini
│  │  ├─ c.cand1                  # 投影 cand1.cnd
│  │  └─ h.hint1                  # 投影 hint1.pop
│  ├─ land_layout                 # 横屏
│  ├─ s_info                      # 共享样式
│  │  ├─ ss_1                     # STYLE，文字/图片/声音/事件
│  │  ├─ ss_2                     # ANIM，动画模型
│  │  └─ info                     # 图片切片
│  ├─ s_port                      # 竖屏样式
│  └─ s_land                      # 横屏样式
└─ night                          # 深色，结构同 default
```

src/palm/sxi-projection.ts:70–122 明确创建投影但不写原包。展示生成的 `light/skin/port/py_26.ini` 时，“源代码”实际显示 JSON 片段并标题为 `skin.json · default.port_layout.b.full26Pinyin`。编辑结果合并回 skin.json；错误 JSON 会提示而不当作成功应用。src/app/sxi-documents.ts:28–54。

### 按键片段（合并到现有 keys 数组中，不能覆盖整包）

```json
{
  "id": "1",
  "b": { "base_b": 2, "base_f": [3, 4], "base_s": 5 },
  "rect": [[10, 0], [100, 120]],
  "hit_rect": [[8, 0], [104, 120]],
  "values": [4, "q", 5, "q"],
  "fix_a": [1, 1]
}
```

`rect`/`hit_rect` 是 `[[x,y],[w,h]]`，与搜狗 FG_RECT 不同。b.base_b 背景样式；base_f 前景数组；base_s 声音样式。values 是类型/值交替数组：0 上滑，1 下滑，2 左滑，3 右滑，4 点击 CENTER，5 显示 SHOW，6 长按 HOLD，7 长按符号，8 符号栏，9 选中符号栏。功能动作在 Palm JSON 中可能是 `space` 等语义名，展示投影时转回 Fxx；不要硬套百度动作字符串。`fix_a` 为状态/提示交替数组，对应 STAT_STYLE。

证据：src/palm/palm-models.ts:48–112、322–337；src/palm/sxi-layout.ts:18–51；src/palm/sxi-ini.ts:62–79、127–143。

### 样式片段（default.s_info.ss_1 中的一个条目）

```json
{
  "f": 0,
  "id": "STYLE3",
  "s_1": { "text": "中", "f_s": 40, "c_normal": "FF112233", "c_hl": "FF445566" },
  "s_2": { "normal": "key,0", "hl": "key,1" },
  "s_4": { "path_1": "press.wav", "path_2": "show.wav", "path_3": "hide.wav" },
  "s_5": { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
}
```

这是字段说明示例；不是声称这些资源/动画在任意皮肤存在。s_1.f_n 字体名、file 字体文件；s_3.size/color 描边；s_5 的 1/2/3/4/5 分别为按下/释放/显示/隐藏/长按动画编号。normal/hl 采用资源名,切片号；已存在图片应从资源选择器选，不凭空造文件名。源码：src/palm/sxi-style.ts:18–47；src/palm/palm-models.ts:382–443。

**方向样式注意**：s_info 是共享，s_port/s_land 是方向表。当方向表与共享完全一样时，生成视图会隐藏重复文件，但 JSON 表仍是有效数据；UI 更改方向图片会定位该方向表。源码：src/palm/sxi-projection.ts:95–121、src/palm/sxi-edit.ts:31–36；测试 tests/sxi-edit.test.mjs:41。

### 候选和气泡

候选 c.cand1：b、f_size、rect、insets、gap、f_gap、more_width、i_cell、i_mask、i_f_b、i_f_f、file、i_cand，另外有 switch、icon_list、fix。图标有位置 p、大小 s、动作 k、锚点 anchor、偏移 offset、固定大小 f_size。src/palm/sxi-layout.ts:52–73、230–269。

气泡 h.hint1：info 是 `[类型,图标编号,…]` 平铺数组：0 背景；1 长按栏背景；2/3/4/5 是上/下/左/右图标。icon_info 下每个图标的 b、anchor、i_cell、pos、size、c_size、insets 决定绘制。src/palm/sxi-layout.ts:271–315。初学者应改已有 icon 的图片样式，不从空白编造整套气泡。

动画 ss_2 有 a1/a3/af2/a4/a10/a11/a12/a13/a14 等模型与类型；基础 a1 含 duration、delay、from/to、轴心等；a3 为组合列表与组合方式；a4 为粒子；其他高级类型应逐字段按现有 skin.json 解释，不用“支持所有动画实时预览”的营销措辞。src/palm/sxi-style.ts:70–286、src/palm/palm-animation.ts。

## 5. 导出与校验文案

矩阵来自 src/export.ts:4–9：SSF/MSSF → SSF、BDI、BDS、BDA；SXI → SXI、BDI、BDS、BDA；搜狗和手心没有直接互转入口。百度 BDI/BDS 不直接导出 BDA；BDA 可以转同平台/跨平台 BDA。MSSF 打开后归一为 SSF 格式；加密 SSF 打开后按普通 ZIP 编辑保存，不重建加密。

SXI→BDI/BDS 使用 JSON 投影与原始资源重排；SXI→BDA 经 BDS 形态再走百度→搜狗→BDA 绘制链，有对应降级风险。见 src/palm/sxi-to-baidu.ts:63–119。SSF 动画 anim.ini 和 WebP 动态背景无百度对应时报告忽略，见 src/ssf/ssf-to-baidu.ts:317–318。

教材验收应要求：保存并重开同格式；检查浅/深 × 竖/横 × 九键/全键/数字/符号/候选/气泡；转换后重新导入检查图片、字体、音效与资源引用；最后到目标输入法真机安装。编辑器预览通过和真机验收是两项。README.md:126–128、161 明确不实现候选算法，且未覆盖所有真机平台。README.md:42 明确搜狗转百度工具栏仍有未完适配，不应写“完全无损转换”。

## 6. 配图清单（建议至少 8 张共用图 + 每格式示例）

1. 真实编辑器全景，标示概览/画布/检查器/源代码切换。
2. 选中按键时前景/背景/文字分层，正常与按下比较。
3. 手机预览的横竖屏与明暗四组合。
4. 图片切片与拉伸带图，明确图片参数顺序。
5. 搜狗前景 FG_RECT 的 left/top/right/bottom 图，和像素拉伸参数分开。
6. 搜狗共享样式“单独设置”截图。
7. 手心源代码标题上的 JSON 片段路径与按键对象定位。
8. 手心 skin.json → 生成视图 → 画布的数据流图。
9. 候选、输入码、符号列、气泡的局部截图/标注图。
10. 导出格式矩阵与转换警告截图。

所有截图应由当前编辑器和可授权示例皮肤生成；原有第三方皮肤图片不要当网站自有设计素材再授权。可使用项目测试 fixture 生成无第三方内容的技术插图。图要带 alt 和解释，不以装饰图替代教程步骤。

未检查：没有启动浏览器或真机，没有运行测试；以上为本地源码证据和现有测试用例内容核对，未把旧文档的测试通过结果当作本轮执行结果。
