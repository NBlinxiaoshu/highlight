# 小黄笔 Highlight

[简体中文](README.md) | [English](README.en.md)

> **把长视频与播客，变成可高亮、可回听、可做笔记的深度阅读稿。** 一张 Chrome 侧边栏，覆盖小宇宙、YouTube、B 站。

## 它解决什么

长内容最贵的不是存储，是**注意力时间**：一期 3 小时的播客，真正有价值的信息可能只有半小时。

小黄笔把「听完」重构成「读 + 索引」——AI 先把整期音频 / 字幕整理成忠实、可连续阅读的逐字稿，再提炼摘要、标注重点；你点哪段，播放器就跳到哪段。**AI 帮你锁信息结构，跳转、标注、笔记的决定权始终在你手里。**

## 设计取舍

- **一套产品能力，三类信息源**：小宇宙、YouTube、B 站共用「摘要大脑 + 渲染 + 后端」，只把取稿方式做成可替换的来源层。
- **忠实的第一手精读稿**：AI 只做断句、错字、专名和标点修正，绝不动时间轴、不删口述信息。
- **可配置的阅读口味**：摘要长度、语言风格、重点偏好可设；智能分析能针对你设定的方向定向标注。

## 界面走查

### 原文 —— 说话人、标注、回听

<table>
  <tr>
    <td width="55%" valign="top">
      <ul>
        <li>带说话人与时间戳的正式段落，点击即在播放器跳转。</li>
        <li><b>四类标注</b>：金句 / 数据 → 黄色荧光；方法论 / 案例 → 加粗；案例另有带标题整段卡片。</li>
        <li>章节山谷目录跟随浏览，当前播放段落自动高亮。</li>
      </ul>
    </td>
    <td align="center" width="45%" valign="top"><img src="assets/shot-02-transcript.png" alt="原文视图" width="100%" /></td>
  </tr>
</table>

### 智能分析 —— 让标注跟着你的主题走

<table>
  <tr>
    <td width="55%" valign="top">
      <ul>
        <li>设定方向（AI 知识 / 产品设计 / 商业化思维…或自定义目标），AI 只标相关内容。</li>
        <li>每个方向可用不同颜色区分；一键「重新生成（当前方向）」。</li>
      </ul>
    </td>
    <td align="center" width="45%" valign="top"><img src="assets/shot-05-smart.png" alt="智能分析" width="100%" /></td>
  </tr>
</table>

### 摘要 —— 章节化速读

<table>
  <tr>
    <td width="55%" valign="top">
      <ul>
        <li>简短 / 中等 / 详细三档；章节化要点，先结论后论据，关键事实高亮。</li>
        <li>一键复制，或写入笔记。</li>
      </ul>
    </td>
    <td align="center" width="45%" valign="top"><img src="assets/shot-03-summary.png" alt="摘要视图" width="100%" /></td>
  </tr>
</table>

### 时间轴 —— 全期章节地图

<table>
  <tr>
    <td width="55%" valign="top">
      <ul>
        <li>每章一段摘要，可展开 / 收起；点击跳到原文对应位置。</li>
      </ul>
    </td>
    <td align="center" width="45%" valign="top"><img src="assets/shot-04-timeline.png" alt="时间轴视图" width="100%" /></td>
  </tr>
</table>

### 笔记 —— 读过的留下来

<table>
  <tr>
    <td width="55%" valign="top">
      <ul>
        <li>写想法、粘贴原文；从原文摘录一键入笔记，带时间戳。</li>
        <li>摘录卡片可看原文 / 复制 / 删除。</li>
      </ul>
    </td>
    <td align="center" width="45%" valign="top"><img src="assets/shot-06-notes.png" alt="笔记视图" width="100%" /></td>
  </tr>
</table>

### 导出 —— 把精读稿带走

<table>
  <tr>
    <td width="55%" valign="top">
      <ul>
        <li>导出 <b>TXT / Markdown</b>（纯文本）、<b>Word / 网页</b>（保留高亮与来源）、<b>PDF</b>（打印窗口「另存为 PDF」）；内容按当前视图（原文 / 摘要 / 时间轴 / 笔记）生成，文件名带视图后缀。</li>
      </ul>
    </td>
    <td align="center" width="45%" valign="top"><img src="assets/shot-07-export-pdf.png" alt="导出 PDF" width="100%" /></td>
  </tr>
</table>

### 历史记录 —— 读过的都在这

<table>
  <tr>
    <td width="55%" valign="top">
      <ul>
        <li>自动留存精读过的节目；可搜索、按平台筛选、收藏；本地优先，云端同步可选。</li>
      </ul>
    </td>
    <td align="center" width="45%" valign="top"><img src="assets/shot-08-history.png" alt="历史记录" width="100%" /></td>
  </tr>
</table>

## 适合的场景

| 平台 | 信息源 | 典型用法 |
|---|---|---|
| **小宇宙** | 中文商业 / 创投 / 产品播客 | **抓最新商业化动态**：快速模式先判断值不值得听，完整模式拿结构化笔记。 |
| **YouTube** | 英文原声，尤其 AI 大神长视频演讲 | **追原声 + 对照学**：官方字幕取稿，双语逐段对照。 |
| **B 站** | 中文知识区 / 课程 / 教程 | **系统学课程**：字幕顺句成讲义，章节时间轴把「看视频」变成「读讲义」。 |

## 安装

本地加载、自带密钥（bring-your-own-key）的扩展，未上架应用商店，无中心服务器。

### 方式一 · 让 AI 帮你装

把这整段发给你的 coding agent：

> 把这个项目克隆或下载到我指定的永久文件夹，告诉我完整路径，并在 Chrome「加载已解压的扩展程序」里用同一个文件夹。可建议 `~/Documents/highlight`（macOS/Linux）或 `%USERPROFILE%\Documents\highlight`（Windows），但不要替我做主。用简单语言带我完成安装与配置。https://github.com/<你的账号>/highlight

你的 agent 应：选好文件夹并克隆 → 打开 DeepSeek / 阿里云百炼 / Supadata 官方页建账号 → 带我在 Chrome 用「加载已解压的扩展程序」选该文件夹 → 告诉我每个 API Key 填在哪 → 打开一段内容，确认原文、摘要、跳转可用。

> ⚠️ 不要把 API Key 贴进聊天、源码或截图；Key 由你在「配置」页自行填写。

### 方式二 · 自己装

1. 仓库 **Code → Download ZIP**，解压到一个永久文件夹（建议 `~/Documents/highlight` 或 `%USERPROFILE%\Documents\highlight`，可自选）。
2. Chrome `chrome://extensions` → 开启「开发者模式」→ 「加载已解压的扩展程序」→ 选项目文件夹（需含 `manifest.json`）。
3. 在「配置」页填各 API Key。

本地加载不会自动更新：换版本或改文件后，需在 `chrome://extensions` 点「重新加载」，再刷新页面。

### API Key

| 能力 | Key | 平台 |
|---|---|---|
| 小宇宙取稿 | DashScope API Key | 阿里云百炼 |
| YouTube 取稿 | Supadata API Key | [Supadata](https://dash.supadata.ai/) |
| B 站取稿 | 官方字幕无需 Key；无字幕课程需 DashScope Key | 官方字幕优先，百炼 ASR 兜底 |
| 摘要 / 标注 / 翻译 | DeepSeek API Key | [DeepSeek](https://platform.deepseek.com/api_keys) |

摘要与标注固定用 DeepSeek `deepseek-v4-flash`（非思考模式）。小宇宙用百炼 Qwen Audio；YouTube 只读 Supadata `mode=native` 官方字幕，不自动回退 AI 转写；B 站优先读免费官方字幕，老课程无字幕时回退百炼 ASR，并在进模型前确定性清理滚动重复、音效行与异常时间段。

### 使用

打开 YouTube / B 站 / 公开小宇宙单集 → 点工具栏「小黄笔」或右下角「精读这期」→ 选「只读文案」或「生成完整精读」，完成后在原文 / 摘要 / 时间轴 / 笔记之间切换。

历史记录内置三份可直接查看的效果样例：小宇宙展示商业化动态精读，YouTube 展示英文原声与双语证据，B 站展示课程字幕修复与知识结构化。长节目渐进转写仍需服务端切片（单个异步任务不返回中间结果），见 [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md)。

## 数据与隐私

- **本地优先**：Key 与摘要存 `chrome.storage.local`；完整逐字稿只在侧边栏内存。
- 页面标题、节目文案、逐字稿会发给 DeepSeek；完整模式把公开音频 URL 发给所选转写服务。
- 仓库含可独立部署后端（`server/`，Node + SQLite，无第三方依赖），但**云端同步默认关闭**、不内置 Key；部署到你确认的 HTTPS 后才允许上传。
- 无统计 SDK、无广告、无埋点。详见 [PRIVACY.md](PRIVACY.md)。

## 设计理念 · 哪里用 AI，哪里不用

AI 只做需要语义判断的事；数据传输、播放、排序、去重、持久化都用确定性代码：

| 环节 | 用 AI | 说明 |
|---|:---:|---|
| 标题 / 简介 / 音源提取 | 否 | 规则明确 |
| 转码 / 切片 / 拼接 | 否 | 确定性算法，不动时间轴 |
| 音频转文字 | 是 | ASR 职责 |
| 说话人分离 / 映射真实姓名 | 是 | 声纹分离，LLM 只做候选映射 |
| 错字 / 专名 / 断句修正 | 是 | 只校对，不改写 |
| 标注 / 摘要 / 笔记 | 是 | Map / Reduce，长文本分块再合并 |
| 智能分析（自定义方向） | 是 | 围绕你设定的目标 |
| 跳转 / 显隐 / 上下条 | 否 | 确定性交互 |
| 历史 / 同步冲突 | 否 | 数据产品能力 |

AI 输出另有硬约束：摘要档位端侧 clamp、标注文本必须在原稿原文匹配、章节时间戳吸附到真实段落起点——不把模型的输出当全权委托。

## 技术架构

- **跨平台来源层**：`platform.js` 把平台差异收敛成统一接口（`idFromUrl` / `normalizePageData` / `transcript`），核心能力复用率约 60–70%，新平台只需新建来源层。
- 纯函数、可单测；YouTube 用字符级平衡括号解析 `ytInitialPlayerResponse`；B 站实现 WBI 签名 + 字幕轨选择，无字幕时读当前分 P 课程音频回退百炼 ASR，且各分 P 用独立缓存；安全渲染只走 `textContent`。
- **后端** `server/`：转写、账号、资料库。Node 内置 SQLite + scrypt + 会话令牌，默认 `127.0.0.1:8787`。
- Chrome MV3 + Side Panel API，纯 HTML / CSS / JS，无构建步骤，适合 agent 二次开发。

## 开发与验证

```bash
npm test      # Node 内置测试（platform + core 共 31 项）
npm run check # 全量语法检查
```

改完扩展后在 `chrome://extensions` 重新加载，并用真实节目验证取稿、摘要与跳转——自动化测试无法证明真实的供应方请求与网页交互正常。

## 待开发

按「工具 → 主动 Agent → 自我进化」排：

1. **订阅主动触达**：follow 博客 / 播客 → 自动解析新一期 → 生成精读稿链接 → 早晨 8:00 写进日历。需要把编排搬到 server 侧（Chrome service worker 无常驻定时）。
2. **AI 标注自迭代**：AI 高亮以半透明候选呈现，读者 ✅ / ❌ 或自己标 → 回流真实标注行为 → 用它调标注 prompt / 做个人偏好画像。界面「接受 / 取消高亮」已具备，下一步是反馈建模。
3. **单集 / 跨集 RAG**：单集内问「这期作者对 AGI 的核心观点？」，跨期检索你的资料库。
4. **读完沉淀成能用**：从逐字稿提取书单 / 工具 / 方法清单，一键导出 Notion / Anki / 周报。
5. **英文跟读学习**：逐句双语、生词、跟读，配合英文原声与课程场景。
6. **同主题多期对比**：围绕一个话题聚合多期，输出观点分歧与时间线。

## 相关文档

- [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) — AI 与后端技术设计
- [PLATFORM_ROADMAP.md](PLATFORM_ROADMAP.md) — 跨平台 + Agent / Skill 深化路线图
- [PRIVACY.md](PRIVACY.md) — 隐私说明
- [server/README.md](server/README.md) — 历史记录服务

## License

[MIT](LICENSE)
