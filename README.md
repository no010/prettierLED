[简体中文](./README.md) | [English](./README.en.md)

# LED 符号生成器

彩色LED 符号生成器 — 为 LCEDA Pro（原 EasyEDA Pro）设计的原理图符号扩展。
根据输入的 LED 主波长自动生成对应颜色与布局的原理图符号，支持单芯片与多芯片（如 RGB / 双色）封装，并支持公共阳极 / 公共阴极配置。

## 主要特性
- 根据波长计算 LED 可视颜色并用于符号着色
- 支持多芯片堆叠（按垂直方向布局）和公共端（Common Anode / Common Cathode）
- 自动创建多芯片的引脚（支持自定义引脚号）并对齐到 50 mil 网格
- 默认物理单位与几何规则：1 单位 = 10 mil，PIN 长度默认 150 mil（15 单位）
- 使用 LCEDA Pro 的消息总线与宿主通信（IFrame → Host publish/subscribe）
- 在重新生成前会清理旧的图元，避免重复残留

## 安装（推荐）

1. 打开 LCEDA Pro
2. 扩展 -> 管理扩展 → 搜索 “LED符号生成器” 并安装

## 从源码构建（开发者）

需要 Node.js >= 20.17.0

```bash
git clone https://github.com/no010/prettierLED.git
cd prettierLED
npm install
npm run build
# 打包产物位于 build/dist/led-symbol-generator_v0.1.1.eext
```

## 使用说明

![demo](./images/demo.gif)

1. 在原理图符号编辑器中，点击顶部菜单：`LED符号生成器 → 创建LED符号...`。
2. 在弹出的对话（IFrame）中：添加 1 个或多个 LED 芯片，填写波长（nm）、A/K 引脚号，选择公共端类型（如适用）。
3. 点击“创建符号”将通过消息总线向宿主发送创建请求；宿主接收后在当前符号文档中绘制填充多边形与引脚。

## 常见问题与故障排查

- IFrame 显示 “undefined” 或内容缺失：确认打包时 `iframe/led-symbol.html` 已包含在 `.eext` 包内，并且 `openIFrame()` 调用使用了不带查询字符串的相对路径（扩展打包器会把路径字面化）。
- 没有弹窗/无法打开：检查 `extension.json` 的 `headerMenus` 是否包含 `symbol` -> `createLEDSymbol`，并确认 `src/index.ts` 导出了 `createLEDSymbol`。
- 收到重复/双重创建：这通常由宿主上残留的旧订阅或热重载引起；建议重启 LCEDA 以清除宿主 runtime，或确保宿主端实现了幂等检查（代码中已加入 `isHandlingCreate` 保护）。
- 消息丢失或未处理：LCEDA 的消息总线提供两套模式（queue 模式 push/pull 和 broadcast publish/subscribe），插件默认使用 `publishPublic/subscribePublic`；如果目标环境只支持 push/pull，请改为对应方法并实现请求-响应匹配。

## 开发者指南（快速）

构建与打包：

```bash
npm install
npm run compile   # 使用 esbuild 打包到 dist/
npm run build     # 组合打包并产出 .eext 到 build/dist/
```

调试建议：
- 本地快速调试 IFrame 时，可在浏览器中打开 `iframe/led-symbol.html`，但注意 iframe 在扩展环境内通过 `window.parent.eda` 来访问宿主 API，直接在浏览器运行部分功能（如 sys_MessageBus）会不可用。
- 若出现订阅重复问题，重启 LCEDA 可以清除已有 runtime 订阅。

## 贡献与许可

欢迎提交 Issue 与 Pull Request。项目采用 Apache-2.0 许可，详见 [LICENSE](LICENSE)。
