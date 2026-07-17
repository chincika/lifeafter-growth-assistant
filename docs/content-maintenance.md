# 资料维护与发布

资料维护器位于 `apps/maintainer`，是独立的 Windows Electron 程序。它直接使用与客户端相同的 schema 校验，不需要手写 JSON，也不要求维护者执行 Git 命令。

## 日常维护

1. 打开资料维护器，默认会读取仓库的 `content/base`；也可以选择另一份资料目录。
2. 在“物品与配方、纳米、食谱、活动、幸存者快报”之间切换。
3. 搜索并点击记录后用表单修改，或点击“新增”。
4. 将资料版本改为 `年.月.日.当日序号`，例如 `2026.07.17.2`。
5. 点击“校验并保存”。保存前执行完整 schema 校验，原文件旁同时保留 `.bak` 副本。

配方使用每行 `材料名称 | 数量 | 制作或购买` 的格式录入。维护器会检查材料存在性并自动转换为稳定 ID。删除仍被配方或纳米资料引用的物品会被拒绝。

## 生成更新包

展开“生成 / 发布 GitHub 资料更新”，填写资料版本、客户端版本和更新级别：

- `optional`：可选更新；
- `recommended`：建议更新；
- `required`：必须更新，客户端仍保证本地数据查看、备份和导出可用；
- 宽限天数默认 7 天。

“生成到本地”会创建经过校验的 `base-data.json`、`activities.json`、可选的 `news.json` 和 `content-manifest.json`。清单包含每个包的大小与 SHA-256。

## 发布到 GitHub

填写 `所有者/仓库`、分支和 GitHub Token 后，点击“直接发布到 GitHub”。程序会在二次确认后通过 GitHub Contents API 写入 `releases/`。Token 仅保存在当前输入框和内存中，不写入设置、日志或资料文件；发布结束会立即清空输入框。

客户端默认从以下地址检查清单：

`https://raw.githubusercontent.com/chincika/lifeafter-growth-assistant/main/releases/content-manifest.json`

客户端只接受 HTTPS、已知资料包类型、匹配的大小和 SHA-256，以及能通过当前 schema 的 JSON；不会下载或执行远程脚本。公共资料应用前会创建升级备份，数据库更新在事务内完成，个人售价、关注、采购方式、食谱解锁和保存方案不会被覆盖。

快报发布通道默认关闭。需要发布时，在“幸存者快报”中新建记录并直接选择电脑上的 PNG、JPG 或 WebP 长图；维护器会把图片复制进资料目录。发布时勾选“发布快报”，维护器会检查图片格式、尺寸和 64 MiB 上限，自动把长图上传到仓库 `releases/news/`，并在 `news.json` 中写入 GitHub 原始文件地址、尺寸与 SHA-256。无需自行寻找图床或填写外链，客户端会按需预览并缓存图片。
