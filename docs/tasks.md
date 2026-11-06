# PRD 差异修复任务书

依据：`docs/prd-gap-audit.md`（2026-11-05 全模块只读排查）
范围：仅 A 档 7 条；B/C 不动。

## 第 1 批（低风险，纯显示/文案）

- [ ] T1 聊天左栏分组顺序改为 全部 → 我的 → AI 成员 → 待分配 → 同事 → 已结束
  - 文件：`vben-prototype/apps/web-ele/src/views/inbox/app.vue`
  - 位置：L714-731（rail 模板）
  - 验收：顺序与 PRD L97-102 一致，其余逻辑不变
- [ ] T2 移除「全部」「AI 成员」「同事」角标，保留「我的」「待分配」
  - 文件：`views/inbox/app.vue`
  - 位置：L246-256（groupCounts）、L715-727（rail 渲染）
  - 验收：PRD L114-116 四组无数字
- [ ] T3 团队详情成员表表头改为「成员」「类型」「在线状态」「移除」
  - 文件：`views/team/app.vue` L519-527
  - 验收：PRD L1212 四列逐字一致
- [ ] T4 Telegram 详情去掉「已连接」标签
  - 文件：`views/channels/app.vue` L411
  - 验收：PRD L2225
- [ ] T5 小部件位置改「左下角/右下角」，字段改「侧边距 / 底部间距」
  - 文件：`views/channels/app.vue` L400-408
  - 验收：PRD L1995-1996
- [ ] T6 隐藏「模拟安装回执」入口
  - 文件：`views/channels/app.vue` L467（按钮）、L346（toast）
  - 验收：PRD L2029「不提供手动安装检测」

## 第 2 批（需确认口径）

- [ ] T8 「我的」角标改为未读会话数
  - 文件：`views/inbox/app.vue` L246-256；必要时 `features/service/demo-store.ts`
  - 风险：需按成员维度统计未读，先确认数据源
- [ ] T9 删除渠道时批量结束关联未结束会话，并修正弹窗文案
  - 文件：`views/channels/app.vue` L203-214、L469；`features/channels/channel-store.ts` L30-61
  - 验收：PRD L1913/L2281/L2295「所有关联未结束会话自动结束归档」

## 不做

- 全部 B 档（用户拍板保留）
- 全部 C 档（无出处 / 后端能力 / demo 不实现）

## 验证

- 只改上述文件；完成后跑 `typecheck`（不跑 `build:ele`）
- 手工核对：聊天分组顺序与角标、团队详情表头、TG 详情、渠道删除弹窗、小部件位置字段
