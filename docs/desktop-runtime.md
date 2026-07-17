# Windows 桌面运行时基线

状态：完整客户端已验证

## 组成

- Electron 43
- electron-vite 5
- Vite 7
- Vue 3 + TypeScript
- electron-builder 26
- NSIS 安装版与单文件便携版

Vite 固定在 electron-vite 声明支持的主版本范围内，不使用未声明兼容的 Vite 8。

## 安全设置

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- CommonJS preload，与沙箱加载模型兼容
- Renderer 中不存在 `window.require` 或 `window.process`
- 最小 `contextBridge` API
- 本地页面带 Content Security Policy
- 页面导航默认拒绝
- 外链仅允许经过验证的 HTTPS GitHub 地址并交给系统浏览器
- 不加载或执行远程 JavaScript

## 数据目录

- 安装版：Electron 标准用户数据目录。
- 便携版：读取 electron-builder 的 `PORTABLE_EXECUTABLE_DIR`，固定使用 EXE 旁的 `Data`。
- 数据目录启动时进行真实写入探测；不可写时停止启动并显示明确错误。
- 自动化验证可通过专用环境变量使用隔离测试目录，不接触正式用户数据。

## 已完成验证

- TypeScript 类型检查。
- Renderer、main、preload 生产构建。
- electron-builder unpacked 目录打包。
- 单文件 portable EXE 打包。
- 打包产物真实启动。
- 页面标题和关键文字渲染。
- CSP 存在。
- preload bridge 可用。
- Node 全局未暴露。
- Renderer 无运行时异常。
- portable 模式创建 EXE 同目录 `Data`。
- 566 条食谱、111 条活动与 197 期快报历史离线加载。
- 纳米旧版公式、食谱状态、全部养成模块与设置持久化。
- 每日/每周/升级/手动备份、校验恢复与旧版 ZIP/xy.dat 迁移。
- GitHub 客户端/公共资料检查与公共资料事务更新。
- 独立资料维护器表单编辑、校验、生成清单和 GitHub 发布。
- 验证结束后测试进程与测试数据清理。

当前仍使用 Electron 默认图标；正式图标属于后续美术审核项。
