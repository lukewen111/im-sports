# IM Support Vue Vben 原型

新版高保真产品原型位于 Vue Vben Admin 官方 `web-ele` 应用中，根目录 React 项目仅作为迁移参考。

## 开发环境

- Node.js：官方支持 `22.18+` 或 `24.x`
- pnpm：官方要求 `11+`

## 启动

```bash
pnpm install
pnpm -F @vben/web-ele run dev
```

默认地址：`http://127.0.0.1:5777/channels`

## 验证

```bash
pnpm exec eslint apps/web-ele/src/features apps/web-ele/src/views/channels apps/web-ele/src/bootstrap.ts apps/web-ele/src/preferences.ts
pnpm -F @vben/web-ele run typecheck
pnpm -F @vben/web-ele run build
```

渠道数据使用本地 Mock 初始化，并保存到浏览器 localStorage，不连接生产接口。
