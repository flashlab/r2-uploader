<span style="font-size: .8rem">Last updated: 2026-04-27</span>

# R2 Uploader

Cloudflare R2 的纯前端 Web 管理界面。所有凭证保存在浏览器 LocalStorage，所有流量直连用户自部署的 Cloudflare Worker，仓库本身不持有任何后端密钥或对象数据。

> 本仓库 fork 自 [`jw-12138/r2-uploader`](https://github.com/jw-12138/r2-uploader)，主要变更是引入分片上传（MPU）路径并把 Worker 拆出到独立仓库 [`flashlab/r2-uploader-worker`](https://github.com/flashlab/r2-uploader-worker)。

## 项目摘要

Cloudflare 控制台单文件上传上限 300 MB，对大文件场景不友好。本工具通过自部署的 Cloudflare Worker 代理 R2 读写，提供：

- 浏览器内上传、列举、下载、删除 R2 对象
- 大文件走 R2 Multipart Upload，断点续传跨刷新可恢复
- 多 Endpoint 切换、Bucket 私有 / 公开均支持

## 架构

```
┌────────────────────────┐    HTTPS    ┌──────────────────────┐    Bindings    ┌────────────┐
│ R2 Uploader (Vue 3)    │ ─────────▶  │ User-deployed Worker │ ─────────────▶ │ R2 Bucket  │
│   - 本仓库构建产物      │             │ - flashlab/r2-uploader-worker        │            │
│   - 部署在 CF Pages     │             │   或 README 内嵌 worker             │            │
└────────────────────────┘             └──────────────────────┘                └────────────┘
```

- **前端（本仓库）**：Vue 3 + Vite + Pinia + Tailwind，无路由，单页面挂载 `EndPointManage` / `CustomUploader` / `FileList` 三个组件。无服务端代码。
- **后端（独立仓库）**：用户自部署的 Cloudflare Worker，承载鉴权与 R2 SDK 调用。两种实现兼容同一前端：
  - **简易版**：[setup guide](https://r2.313159.xyz/setup-guide/) 中的内嵌 Worker，仅支持单次 PUT，单文件 ≤ 95 MB。
  - **完整版**：[`flashlab/r2-uploader-worker`](https://github.com/flashlab/r2-uploader-worker)（Hono + TypeScript），额外暴露 `support_mpu` / `mpu/*` 端点，支持分片上传与断点续传。

### 前端状态约定

LocalStorage 是**唯一事实来源**，不是 Pinia。组件直接读写 `endPoint`、`apiKey`、`customDomain`、`endPointList`、`mpuPending` 等键。`src/store/status.js` 仅作为信号总线（`endPointUpdated` 计数器），用于通知兄弟组件重新读取 LocalStorage。修改 endpoint 相关逻辑时必须保留该计数器递增，否则 `CustomUploader` 与 `FileList` 会静默失同步。详见 [CLAUDE.md](CLAUDE.md)。

### Worker 协议契约

| 方法 | 路径 | 鉴权头 | 说明 |
|---|---|---|---|
| `PUT` | `{endPoint}{key}?[force\|rename]` | `Authorization: <apiKey>` | 单次上传；`201` + `Content-Location` 表示成功，`409` 表示重名冲突 |
| `GET` | `{endPoint}{key}` | 公开桶免鉴权；私有桶要求 `Authorization` | 取对象 |
| `DELETE` | `{endPoint}{key}` | `Authorization` | 删除对象 |
| `PATCH` | `{endPoint}?cursor=...` | `Authorization` | 列举，返回 `{objects, truncated, cursor}` |
| `GET` | `{endPoint}support_mpu` | — | MPU 能力探测，任何 200 视为支持 |
| `POST` | `{endPoint}mpu/create/{key}` | `x-api-key` | 创建 MPU，返回 `{uploadId}` |
| `PUT` | `{endPoint}mpu/{key}?uploadId=&partNumber=` | `x-api-key` | 上传分片，返回包含 `etag` 的 `R2UploadedPart` |
| `POST` | `{endPoint}mpu/complete/{key}?uploadId=` | `x-api-key` | 完成 MPU，body 中 `parts` 必须按 `partNumber` 升序 |
| `DELETE` | `{endPoint}mpu/{key}?uploadId=` | `x-api-key` | 中止 MPU |

修改任一请求形态时，**两种 Worker 实现都必须同步更新**，否则使用旧版内嵌 Worker 的用户会静默失败。

## 特性

- **大文件分片上传**：> 95 MB 自动走 MPU，分片 10 MB，5 路并发，每片最多重试 5 次。
- **断点续传**：每片成功后写入 `localStorage.mpuPending`，刷新或关闭页面后**重新选中同一文件**（依据 `name|size|lastModified` 匹配）即可继续。条目保留 7 天，过期自动清理。
- **多 Endpoint 管理**：可保存多组 Worker URL + API Key + 自定义域名，运行时切换。
- **私有桶**：Worker 端设置 `PRIVATE_BUCKET=true` 后，所有 GET 请求强制鉴权。
- **图片预压缩**：基于 [compressorjs](https://github.com/fengyuanchen/compressorjs) 的客户端压缩，可选去 EXIF、转 webp/jpg/png、限制最大宽高与质量。
- **目录上传**：使用浏览器 [`showDirectoryPicker`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker)（不支持的浏览器会隐藏入口）。
- **拖拽与粘贴**：可拖入文件或从系统剪贴板粘贴。
- **重命名以入子目录**：把 key 改成 `folder/file.txt` 即可在桶内形成目录结构。
- **自定义资源域名**：列表中的预览链接会走 `customDomain`，便于绑定 R2 自定义域名加速。

## 部署

### 1. 部署 R2 Bucket

1. 进入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2 → Create Bucket，设置 bucket 名称。

### 2. 部署 Worker（后端）

参见 [`flashlab/r2-uploader-worker`](https://github.com/flashlab/r2-uploader-worker) 仓库 README。基本步骤：

1. `git clone` 该仓库后用 `wrangler deploy`，或在 Cloudflare Workers 控制台粘贴源码部署。
2. 在 Worker 设置中绑定：
   - **环境变量** `AUTH_KEY_SECRET`：随机字符串，作为前端 API Key。
   - **环境变量** `PRIVATE_BUCKET`（可选）：设为 `true` 后桶变为私有，GET 也需鉴权。
   - **R2 Bucket 绑定** `R2_BUCKET`：指向上一步创建的桶。
3. 部署后保存 Worker URL 与 `AUTH_KEY_SECRET`。

如果只需要小文件（≤ 95 MB）单次上传，可使用 setup-guide 中给出的内嵌单文件 Worker，无需克隆仓库。

### 3. 部署前端（本仓库）

#### 3.1 使用现有 Cloudflare Pages 流水线

仓库已包含 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)：推送到 `main` 时自动 `bun run build` 并发布 `./dist` 到 Cloudflare Pages 项目 `r2-zzbd`。fork 后需要在 GitHub Actions Secrets 中配置：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

并把 workflow 中的 `projectName: r2-zzbd` 改成自己的 Pages 项目名。

#### 3.2 本地构建与部署

包管理器使用 **bun**（`bun.lockb`）。

```bash
bun install
bun run dev          # Vite dev server, http://localhost:7896
bun run build        # 先 build:setup（渲染 md + 编译 setup-guide CSS），再 vite build 到 dist/
bun run preview      # 预览构建产物
bun run clean        # rm -rf dist
bun run deploy       # 构建后通过 wrangler 直接发布到 Cloudflare Pages
```

> `vite build` 单独执行**不会**生成 `/setup-guide/` 下的 HTML 与 `main.css`，必须经由 `bun run build`（即先跑 `build:setup`）才能产出可访问的设置指南页面。

`bun run deploy` 等价于 GitHub Actions 流水线，但本地直推。**首次使用先一次性 OAuth 登录**，之后无需任何环境变量：

```bash
bunx wrangler login    # 浏览器 OAuth，凭证缓存在 ~/.wrangler/config/default.toml
bun run deploy         # 之后每次部署直接执行
```

- 命令实质是 `bunx wrangler pages deploy ./dist --project-name=r2-zzbd`，wrangler 通过 `bunx` 临时拉取，无需作为依赖。
- 不想用 OAuth 时也可改走环境变量：`CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... bun run deploy`，所需凭证与 [.github/workflows/deploy.yml](.github/workflows/deploy.yml) 中的 secrets 一致（`CLOUDFLARE_API_TOKEN` 需带 Pages: Edit 权限）。
- 默认目标项目为 `r2-zzbd`，fork 后请把 `package.json` 中 `--project-name` 改为自己的 Pages 项目名，并同步修改 workflow 文件。

#### 3.3 Setup-guide 静态资源管线

[public/setup-guide/](public/setup-guide/) 下的 HTML 由 [gen_markdown.js](public/setup-guide/gen_markdown.js) 把同目录的 `.md` 文件用固定模板渲染而成；样式来自三份本地 CSS：

- [public/setup-guide/css/pico.min.css](public/setup-guide/css/pico.min.css) — 直接 commit 的第三方静态文件。
- [public/setup-guide/css/custom.css](public/setup-guide/css/custom.css) — 直接 commit 的项目级覆盖样式。
- `public/setup-guide/css/main.css` — **构建产物**（已 gitignore），由 [setup-guide-src/main.css](setup-guide-src/main.css) 经 Tailwind 编译而来，配置在 [tailwind.setup-guide.config.cjs](tailwind.setup-guide.config.cjs)。

修改 setup-guide 的 Tailwind 样式请编辑 `setup-guide-src/main.css`，运行 `bun run build:setup` 重新编译。

ESLint 已配置（`eslint.config.js`，flat config，vue/recommended + prettier），但 `package.json` 未挂 `lint` script，需要时执行 `bunx eslint .`。仓库无测试套件。

### 4. 配置前端

部署完成后访问站点，在「Endpoints」面板中：

- **Workers Endpoint**：步骤 2 拿到的 Worker URL（结尾若无 `/` 会自动补全）。
- **Workers Endpoint API Key**：`AUTH_KEY_SECRET` 的值。
- **Custom Domain**（可选）：R2 桶自定义域名，仅影响列表页中文件预览链接。

凭证保存在浏览器 LocalStorage，仓库与 Pages 站点本身不接触这些值。

## 反馈

问题与建议请提到 [flashlab/r2-uploader/issues](https://github.com/flashlab/r2-uploader/issues)。Worker 相关问题请提到 [flashlab/r2-uploader-worker/issues](https://github.com/flashlab/r2-uploader-worker/issues)。
