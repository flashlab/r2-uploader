<span style="font-size: .8rem">Last updated: 2026-04-27</span>

# R2 Uploader 使用指南

本页面介绍前端的实际操作流程。Worker 与 R2 Bucket 的部署请参考主仓库 [flashlab/r2-uploader](https://github.com/flashlab/r2-uploader) 与 [flashlab/r2-uploader-worker](https://github.com/flashlab/r2-uploader-worker) 的 README。

## 首次配置 Endpoint

页面顶部有一个 **Endpoints** 折叠面板。首次访问时该面板会显示「You need Cloudflare Workers to upload files...」提示。

填写并保存：

| 字段 | 含义 | 示例 |
|---|---|---|
| **Workers Endpoint** | 自部署 Worker 的 URL，结尾的 `/` 会自动补齐 | `https://r2-uploader.<account>.workers.dev/` |
| **Workers Endpoint API Key** | 与 Worker 的 `AUTH_KEY_SECRET` 一致 | 随机字符串 |
| **Custom Domain**（可选） | 仅用于改写预览/拷贝链接的展示域名，不影响读写 | `https://cdn.example.com/` |

点 **Save To LocalStorage** 后，凭证写入浏览器 LocalStorage。仓库不会上传这些值到任何服务器。

### 多 Endpoint 切换

保存第二组凭证后，面板顶部会列出所有 endpoint。每行包含：

- **单选按钮**：切换当前生效的 endpoint，整个页面（上传、列表）随之刷新。
- **Edit**：把当前行内容载入下方表单进行修改，再次点击或保存后退出编辑态。
- **Delete**：删除该 endpoint。如果删的是最后一个，列表清空；否则自动切到剩余的第一项。

## 上传文件

### 选择文件的方式

1. **Choose Files** 按钮 — 标准文件选择对话框。
2. **Choose Folder** 📂 — 调用浏览器 [`showDirectoryPicker`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker)；不支持的浏览器（如 Firefox、Safari）会自动隐藏该按钮。
3. **拖拽** — 直接把文件或文件夹拖到上传区域。
4. **粘贴** — 在系统中复制文件后聚焦页面 `Ctrl/Cmd + V`，文件会进入待上传队列。

加入队列后会显示文件大小汇总与「Files Queued」列表。点 🔥 **Upload** 开始上传。

### 重名冲突策略

队列中存在文件时会出现 *If file with same name pre-exists on server, do* 选项：

- **Skip**（默认）— 远端已存在则跳过。队列条目会被标黄并计入「Will skip N file(s)」。
- **Auto suffix with `_`** — 自动在文件名（扩展名前）追加 `_`，例如 `a.png` → `a_.png`。
- **Overwrite** — 强制覆盖。

### 其他上传选项

- **Rename each file with a random ID**：上传时将 key 替换为 16 位 nanoid + 原扩展名，原始文件名仅用于本地显示。
- **Compress images before uploading**：仅对 `image/*` MIME 生效，使用客户端压缩。子选项：
  - *Remove EXIF*
  - *Convert to* — `jpeg` / `png` / `webp`
  - *Max Width / Max Height* — 留空表示不限
  - *Image Quality* — 0–1 之间小数（与 compressorjs 一致）
- **Upload to folder**：勾选并填入路径（如 `photos/2026/`），队列中的所有文件会被前缀到该目录。失焦时自动规范化（去掉前导 `/`、补齐尾部 `/`）。

### 队列项操作

每条队列条目支持：

- **点击文件名** — 重命名。把名字改成 `subdir/file.txt` 即可上传到子目录。上传中无法重命名。
- **✕** — 从队列移除；如果该文件正在上传，会同时中止 HTTP 请求。MPU 的话会向 Worker 发送 `DELETE` 通知 R2 释放 multipart session。
- **↻** — 单独重传该文件。已上传完成的文件再点会先从「Uploaded List」移除再重新入队。

### 上传过程中

- 顶部出现 *Uploading at <speed>* 实时统计全局速率。
- 文件状态色块：🟢 完成、🟠 跳过/重名、🔴 失败、灰底进度条 = 进行中。
- 大文件（> 95 MB）会显示 *Splitting Chunks...*，分片完成后切换到 *uploading* 状态。
- 关闭/刷新页面前若仍在上传，浏览器会弹出离开确认。

## 大文件断点续传

> 仅在 Worker 实现是 [flashlab/r2-uploader-worker](https://github.com/flashlab/r2-uploader-worker)（带 `support_mpu` 端点）时可用。simple worker 单文件上限 ≈ 95 MB。

文件 > 95 MB 时自动切换到 R2 Multipart Upload：10 MB 一片，5 路并发，每片最多重试 5 次。每个分片成功后会立刻把 `{uploadId, key, completedParts, ...}` 写到 `localStorage.mpuPending`。

### 恢复未完成的上传

刷新页面后，如果当前 Endpoint 下存在未完成的 MPU 会话，上传区上方会出现一个琥珀色提示条：

```
↻ N unfinished upload(s) — re-pick the same file(s) to resume
```

展开可看到每个待恢复任务的文件名、大小、已完成分片数 / 总分片数。

恢复方式：**重新选择同一文件**（拖拽 / Choose Files 等任意方式都行）。匹配规则是 `name|size|lastModified` 三元组——浏览器无法跨会话保留 `File` 对象，所以必须再选一次本地文件。匹配命中后队列里该条目会显示 `↻ Resuming` 蓝色标签，已完成的分片会被跳过，进度直接从已上传字节数开始。

### 放弃所有未完成的上传

提示条底部的 **Discard all** 会向 Worker 逐个发 `DELETE mpu/{key}?uploadId=`，让 R2 中止 multipart session（网络失败也会强制清掉本地条目）。需要在弹窗中确认。

> 提示：未完成条目超过 7 天会在页面挂载时自动清理。

## 文件列表（File List）

- **Refresh** — 调用 `PATCH {endPoint}` 拉取首页对象列表。
- **Load next page** — 当 R2 返回 `truncated=true` 时出现，使用 cursor 加载下一页。
- **Sort by** — 按时间或大小排序，*Default* 为 R2 返回顺序。
- **Folder Structure** — 把扁平的 key 列表按 `/` 重构成目录树展示，处理过程会显示 *aria-busy* 动画。

### Selection Mode

点 **Selection Mode** 进入多选态，每个文件前出现复选框：

- **Delete Selected** — 批量逐个发 `DELETE {endPoint}{key}`，需在弹窗中确认。
- **Copy URLs** — 把选中文件的访问 URL（前缀使用 Custom Domain，否则使用 Endpoint）拼成换行分隔字符串拷到剪贴板。

退出多选态用同一按钮（文案变为 *Quit Selection Mode*）。

## 私有桶（Private Bucket）

如果在 Worker 上设置了 `PRIVATE_BUCKET=true`，所有 GET 请求都会要求 `Authorization`。这意味着列表里的「preview」链接在浏览器直接打开会失败（浏览器不会自动带 API Key）。需要私有访问时建议：

- 仅做后端集成，不依赖列表页预览；或
- 关闭 `PRIVATE_BUCKET`，改用其他鉴权层（Cloudflare Access、签名 URL 等）。

## 隐藏技巧

1. 从系统复制文件后直接 `Ctrl/Cmd + V` 粘贴到页面，可批量入队。
2. 重命名时输入 `folder/file.txt` 会在 R2 桶内创建对应目录结构（R2 把 `/` 视为前缀）。
3. 取消勾选 **Upload to folder** 会自动剥掉队列中所有文件已加上的目录前缀；再次勾选会重新加上。

## 反馈

前端问题：[flashlab/r2-uploader/issues](https://github.com/flashlab/r2-uploader/issues)
Worker 问题：[flashlab/r2-uploader-worker/issues](https://github.com/flashlab/r2-uploader-worker/issues)
