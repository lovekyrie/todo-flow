# 移动端 UI 验证

本次按参考图重排登录、注册和待办页，最大内容宽度 480px。参考图为三页面展示图，因此采用独立页面自然布局；750px 坐标仅用于素材来源记录，不将展示图整体缩小为手机页面。

- [三个页面的 375px 预览](mobile-preview.png)
- [素材框选](bbox-preview.jpg)与[黑底、白底、棋盘格透明预览](assets-preview.png)
- [浏览器布局结果](browser-results.json)，详细截图位于 `screenshots/`
- 素材及来源坐标：`../src/assets/ui/layers.manifest.json`

已验证 320、375、390、430px 和 1280px 下的三个页面，无横向溢出或任务文字与操作按钮重叠；电脑端内容宽度为 480px。另保存了长标题、空数据、筛选无结果、加载和加载失败截图。

交互使用浏览器拦截的模拟 API 验证，不写入实际数据库。覆盖登录、注册、密码显隐、密码不一致、用户名重复、增删改、完成与撤销、状态筛选、统计更新、失败时保留输入、加载重试、401 跳转及退出。浏览器运行中无页面脚本异常。

## 复现

启动 `bun run dev --host 127.0.0.1`，使用独立的空白浏览器配置启动本地 Chromium，并开启调试端口 9222。然后运行：

```bash
node qa/mobile-smoke.mjs /path/to/existing/playwright-core/index.mjs
python3 qa/make-preview.py
```

脚本复用环境中已有的 Playwright，不需要修改应用依赖。截图使用系统中文字体，可能与参考图字体略有差异。首次素材提取使用原始 1672 × 941px 图片，运行 `python3 qa/extract-assets.py /path/to/reference.png` 检查框选，确认后加 `--extract`；此脚本使用环境中已有的 Pillow 和 numpy。

## 检查结果

- `bun run build`：通过。
- 改动的 React 组件、QA 脚本和 JSON：定向 ESLint 通过。
- 15 个透明 PNG：尺寸、alpha 通道、透明四角和四边未裁切检查全部通过；波纹为完整矩形背景素材。
- `git diff --check`：通过。
- 全量 lint 在改动前已有 22 条格式错误，位于模板 README、入口导入顺序、TypeScript 配置和 Vite 配置，未扩大修复范围。
- 未运行 Go 测试或真实数据库联调：本次未修改后端；前端交互以模拟现有接口协议验证。
