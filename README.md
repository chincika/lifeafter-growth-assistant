# 明日之后养成助手

面向 Windows 的开源、本地优先游戏养成与数据工具。

旧版网页工具已重构为不依赖原网站运行的 Windows 桌面程序，并配套独立资料维护器。

## 项目目标

- 保留并校验旧版核心计算与资料功能。
- 用户价格、关注、采购方式、方案和设置仅保存在本地。
- 公共基础资料、幸存者快报和活动信息通过 GitHub 独立更新。
- 提供 Windows 安装版与真正便携版。
- 业务核心与 UI 为未来 Android 版本保留复用能力。
- 不采集遥测数据，不在后台上传用户信息。

## 已实现模块

- 地摊递归成本、税后收益、采集券收益和自定义产品；
- 纳米 I/II/III、专研点击与旧版特殊成本分支；
- 566 条食谱、组合效果筛选和本地解锁进度；
- 专研/升星、专精、配件、腰带芯片、图谱、两类基因和装备改造；
- 八类活动历史和 197 期幸存者快报索引；
- 本地设置、自动/手动备份、校验恢复、旧版 ZIP/xy.dat 迁移；
- 客户端更新提示、公共资料独立更新和 required 更新策略接口；
- Windows 资料维护器，可用表单维护资料、生成校验清单并直接发布 GitHub。

项目范围和规则依据见：

- [产品决策](docs/product-decisions.md)
- [架构方案](docs/architecture.md)
- [旧版功能清单](docs/legacy-inventory.md)
- [地摊与纳米计算审计](docs/audits/market-and-nano.md)
- [Windows 桌面运行时基线](docs/desktop-runtime.md)
- [资料维护与发布](docs/content-maintenance.md)

## 开发与打包

```powershell
pnpm install
pnpm check
pnpm test:run
pnpm build
pnpm --filter @lifeafter-assistant/desktop dist:portable
pnpm --filter @lifeafter-assistant/desktop dist:installer
pnpm --filter @lifeafter-assistant/maintainer dist:portable
```

## 开源协议

程序代码使用 [GPL-3.0](LICENSE) 发布。游戏素材、第三方图标、字体和数据各自遵循其权利人的授权条款，不因存放在本仓库而自动适用 GPL-3.0。

本项目是非官方、非商业的玩家学习交流工具，与游戏开发商及发行商无关联。
