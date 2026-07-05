# ppt-like-html

一个用于编辑 HTML 16:9 汇报模板的可视化编辑器。

当前正式方向不是重新生成一套模板，而是把仓库中的 `VIVOID_同风格正式汇报模板套件.html` 作为真实模板源，在不改变其样式和页数的前提下，加载到 `index.html` 中进行原位编辑。

## 当前正式能力

- `index.html` 会读取仓库根目录的 `VIVOID_同风格正式汇报模板套件.html`。
- 保留原模板的 head 样式、字体、section 数量和页面结构。
- 单击模板中的文字、图像、卡片、占位图等元素即可选中。
- 双击文字可直接编辑内容。
- 选中元素后可拖动移动；拖动时会将该元素提升为 slide 内绝对定位元素，并插入隐藏占位，尽量避免影响其他元素排布。
- 支持右下角控制点缩放选中元素。
- 支持 Shift / Cmd / Ctrl 多选。
- 支持 Delete / Backspace 删除元素。
- 支持 Ctrl/Cmd + Z 撤销，Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y 恢复。
- 支持文字角色切换：标题、正文、图注、标签、页眉；角色切换时会同步应用对应样式。
- 支持替换图片或将占位图替换为图片。
- 支持置顶 / 置底。
- 支持导出当前编辑后的自包含 HTML。

## 使用方式

推荐通过本地服务器或 GitHub Pages 打开，因为 `index.html` 需要通过 `fetch()` 读取模板文件。

```bash
python3 -m http.server 8000
# 然后打开 http://localhost:8000
```

直接双击 `index.html` 时，部分浏览器会因为 file:// 安全限制禁止读取本地 HTML 模板。

## 当前文件结构

```text
index.html                                      # 模板原位编辑器入口
VIVOID_同风格正式汇报模板套件.html              # 真实模板源文件，不在编辑器中重写
src/template-editor.css                         # 编辑器 UI 样式，不修改模板 slide 样式
src/template-editor.js                          # 模板加载、选择、移动、缩放、撤销、导出逻辑
src/styles.css / src/app.js / src/fixes.js      # 早期 MVP 原型文件，后续可清理或归档
/docs/EDITOR_REQUIREMENTS.md                    # 编辑需求与验收标准
```

## 关键设计原则

1. 以真实模板为源，不另起一套视觉系统。
2. 初始显示必须保持原模板样式和页数。
3. 编辑器 UI 与模板 slide 样式分离。
4. 元素移动时尽量不触发其他元素重排。
5. 优先保障 HTML 可读、可导出、可继续人工修改。

## 后续优化方向

- 将早期 MVP 文件归档到 `legacy/`。
- 支持更稳定的 JSON 项目保存与恢复。
- 支持参考线、吸附、对齐、分布。
- 支持图片裁剪窗口和对象位置调节。
- 支持复制/粘贴元素。
- 支持直接编辑 SVG text。
- 支持组件库和自定义模板片段保存。
