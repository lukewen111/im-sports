# 客户模块：列表视觉对齐 + 筛选项收进浮层

## 目标
仅修改 `vben-prototype/apps/web-ele/src/views/customers/app.vue`，优先使用 Element Plus 现成组件。

1. 列表视觉对齐参考图 1：收紧列间距，行高 56–60px，表头 12px `#62626D` 无底色，行间 1px `#ECECED` 横线，无竖网格，头像 32px、与文字间距 10px。**客户名称与客户 ID 同一行显示**（用户修正：不拆两行），用字号/颜色区分主次。
2. 团队 / 渠道类型 / 最近活跃三组筛选收进「筛选」浮层（`ElPopover`），已选条件不摊回工具栏，只在按钮上显示数量角标。

## 约束
- 只改 `views/customers/app.vue`；不动 `views/settings/**`、`views/channels/**`、`views/inbox/**`、`components/q-icon/**`、`features/customer-detail/**`。
- 保留分页、排序、整行点击进详情、表内滚动、操作列 `fixed="right"`、行内「去聊天 / 回聊」按钮。
- 筛选逻辑不变：团队多选命中任一、渠道按关联会话聚合、时间按最近活跃；`resetFilters()` 重置三组。
- 不跑 `build:ele`；复用 5174；不提交 git。

## 实现要点
- `script`：新增 `activeFilterCount`（团队非全选计 1、渠道非空计 1、日期有值计 1），导入 `ElPopover`。
- 工具栏：搜索框（占位 `搜索客户名称、客户 ID、邮箱或手机号`）+ 筛选按钮（漏斗图标 + 文案 + 角标）+ 清除筛选。
- 浮层：`trigger="click"`、`placement="bottom-end"`、`:width="340"`、`:show-arrow="false"`；面板内三组按「团队 → 渠道类型 → 最近活跃」，左标题右控件；团队 `multiple collapse-tags collapse-tags-tooltip`，渠道首项「全部渠道」`value=""`，日期 `daterange`；内部控件 `:teleported="false"` 避免被判定为面板外点击；改动即时生效，点面板外关闭。
- 列表：客户列头头像 + 同行「名称 14px/500/`#131317` + ID 12px/`#8C8C8E`」；列宽 176 / 150 / 120 / 116 / 76 / 88（操作 `fixed="right"`）；`table-area` 左右 4px + `.cell` 左右 12px；行高 58px；表头 42px、12px/500/`#62626D`、底边 1px `#E3E3E5`；行分隔 1px `#ECECED`，hover `#F5F5F5`，选中 `#EEEEEF`。

## 验证
1. `pnpm -F @vben/web-ele run typecheck` exit 0。
2. 复用 5174（不新开、不关闭）。
3. 1280×900 / 1440×900 / 1920×1080：`scrollWidth === innerWidth`、`scrollHeight === innerHeight`，控制台 0 error。
4. 截图存 `vben-prototype/output/ui-revamp/`：`cust6-list-1440.png`、`cust6-list-1280.png`、`cust6-filter-open.png`、`cust6-filter-applied.png`、`cust6-filter-team.png`、`cust6-filter-date.png`。
5. 回报列宽 / 内距 / 行高实测值、面板结构与交互要点、三档滚动结果。
