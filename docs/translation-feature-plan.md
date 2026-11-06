# ChatScale 翻译功能：现有 Demo 对照与优化方案

> 输入基线：`ChatScale_翻译功能_V1.0_PRD_更新版.md`（2026-11-05 需求规则已对齐稿）
> 对照对象：`vben-prototype/apps/web-ele`（Vue3 + Element Plus）
> 本文只做只读分析与方案输出，不含代码改动，也不涉及真实翻译服务/后端/供应商能力。

---

## 0. 结论摘要

| 分级 | 数量 | 含义 |
|---|---|---|
| A | 10 | 与 PRD 直接冲突或能力缺失，评审现场会被追问 |
| B | 6 | 交互细节可优化，不影响主流程成立 |
| C | 5 | 纯视觉、文案、命名打磨 |

最关键的 5 条 A 类问题：

1. **完全没有「翻译后的显示效果」配置项**，消息气泡也没有双语模式（A1）。
2. **接收自动翻译开关不生效**，且进入会话/切换工作语言时会把历史消息批量翻译（A2）。
3. **气泡底部缺「文本已翻译 · 显示原文/隐藏译文」**，现在只能靠悬浮图标切换，不符合 PRD 4.3（A3）。
4. **翻译缓存模型是「消息单槽覆盖」**，种子译文和他人译文默认直接展示，不符合 PRD 4.4（A4）。
5. **发送预览区不受【发送消息自动翻译】开关控制**，且没有 800ms 防抖、加载态和过期结果保护（A5/A6）。

Demo 现状与 PRD 的总体差距：**单向「能翻」已具备**（预置词条 + 语料池 + 悬浮图标 + 预览条骨架），但 **PRD 真正定义的「开关、展示模式、缓存权限、时序状态」四套规则尚未落地**。

---

## 1. 关键需求与现状映射

| PRD 要求 | 现状 | 判定 |
|---|---|---|
| 个人翻译设置 5 项，默认值见 PRD 三 | 4 项，缺「翻译后的显示效果」 | ❌ A1 |
| 接收自动翻译仅当前前台查看会话的新客户文本消息 | 无开关判断、无前台判断、进入会话批量翻历史 | ❌ A2 |
| 接收翻译：加载态、失败重试、底部「文本已翻译」与切换 | 三者均缺失，仅悬浮图标切换 | ❌ A3 |
| 跨成员缓存不等于自动展示 | 译文存于消息单槽，默认直接展示 | ❌ A4 |
| 发送预览区开启后常驻，占位「翻译为...」 | 未读发送开关；语种相同时整条隐藏 | ❌ A5 |
| 800ms 防抖、只认最新结果、【使用】禁用态 | 每次输入同步计算，无防抖/加载/过期保护 | ❌ A6 |
| 【使用】后预览保留占位；草稿返回不保留译文；下一条恢复默认语种 | 使用后整条隐藏；草稿返回立即出译文；临时语种粘到下一句 | ❌ A7 |
| 复制消息按当前可见文本 | 消息气泡无复制能力 | ❌ A8 |
| 入口：个人中心 → 翻译设置 | 在「设置 → 聊天工具」，个人中心无入口 | ❌ A9 |
| 纯表情不翻译、不显示图标 | 种子用 `kind: 'emoji'` 规避，实际访客纯表情消息是 `kind: 'text'` | ❌ A10 |
| 会话摘要、搜索用原文 | 摘要取 `message.content`，搜索扫 `message.content` | ✅ |
| 图片/附件/系统消息不翻译 | `canTranslate` 仅 `kind === 'text'` 且非系统事件 | ✅ |
| 未点【使用】发送原文 | `send()` 发送 `input.value` | ✅ |
| 各会话草稿独立 | `drafts` 按 sessionId 保存 | ✅ |

---

## 2. A 类：直接冲突或能力缺失

### A1 缺「翻译后的显示效果」配置项与双语渲染

**PRD 原句（三、4.3）**
> 「翻译后的显示效果 | 单选 | 仅显示译文 | 可选「仅显示译文」「显示原文和译文」；用于接收消息翻译结果展示」
> 「显示原文和译文 | 气泡同时显示原文、译文；底部「文本已翻译 · 隐藏译文」」

**现状**
- `MemberTranslationSettings` 只有 `receiveTranslation / sendTranslation / visitorLanguage / workLanguage` 四个字段（`src/features/service/demo-store.ts` L138-L143）。
- 设置页只有 4 行，无显示效果项（`src/views/settings/tools/app.vue` L44-L102）。
- 消息气泡只有 `displayText()` 单文本输出，模式为 `'source' | 'translation'`，不存在双语态（`src/views/inbox/app.vue` L450-L465、L885-L927）。

**建议改法**
1. `MemberTranslationSettings` 新增 `displayMode: 'translation-only' | 'bilingual'`，默认 `'translation-only'`。
2. 设置页新增「翻译后的显示效果」单选卡，位置见第 4 节。
3. 气泡渲染拆成三种状态：未翻译（原文）、仅译文、双语；底部增加状态文案与切换按钮。
4. 切换设置后，清空消息级临时切换覆盖（`translationMode`），让所有已有译文立即按新模式渲染，不重新调用翻译。

**改动位置**
- `src/features/service/demo-store.ts`：`MemberTranslationSettings`、`defaultTranslation()`（L274）、`setMemberTranslation()`（L453）。
- `src/views/settings/tools/app.vue`：在发送开关与成员工作语言之间插入新行。
- `src/views/inbox/app.vue`：`messageMode / displayText / toggleTranslation`（L450-L465）、气泡模板（L885-L927）、气泡样式（L1270-L1300）。

---

### A2 接收自动翻译的触发模型与 PRD 不符

**PRD 原句（4.2、三）**
> 「当前成员已开启【接收消息自动翻译】」
> 「该成员正在打开查看消息所属会话」
> 「ChatScale 所在浏览器窗口处于前台、有焦点，且对应浏览器标签页可见」
> 「下列场景不自动翻译：进入会话前已存在的历史消息」
> 「修改【成员工作语言】后……没有缓存则展示原文，不批量重新翻译」
> 「语言无法可靠判断时仍尝试翻译」

**现状**
- `autoTranslate()` 只按「客户 + 文本 + 非系统 + 有原文语言 + 语言不同于工作语言 + 尚无译文」过滤，**完全没有读 `receiveTranslation`**（`src/views/inbox/app.vue` L404-L410）。
- 该函数被 `watch(active, immediate: true)`（L411-L422）、`watch(messages.length)`（L423-L426）、`watch(workLanguage)`（L427）直接调用：
  - 进入任意会话即把全部历史客户消息一次性翻译（含已结束会话）；
  - 切换工作语言即对全部历史消息重新翻译并覆盖旧译文；
  - 不判断 `document.visibilityState`、窗口焦点，也不区分「会话打开之后新收到」。
- `canTranslate()` 要求 `message.originalLanguage` 为真值（L635-L639），语言未知时连手动翻译入口都没有。

**建议改法（Demo 模拟口径）**
1. `autoTranslate()` 首行加 `if (!translation.value.receiveTranslation) return;`。
2. 打开会话时记录 `messageCursor = session.messages.length`，只处理游标之后新追加的客户文本消息；不再扫描历史。
3. 增加前台门禁：`document.visibilityState === 'visible' && document.hasFocus()`；监听 `visibilitychange / focus / blur`，失焦期间只记游标不翻译，回前台不补翻。
4. 删除 `watch(workLanguage)` 的批量重翻，改为：仅按新目标语言查找缓存（A4 的缓存模型），无缓存保持原文。
5. `canTranslate()` 去掉「必须有 `originalLanguage`」的硬条件；无语言时仍展示图标并尝试翻译（Demo 可按内容语料兜底）。
6. 不设置 5 分钟时限（PRD 明确禁止），Demo 也不引入。

**改动位置**
- `src/views/inbox/app.vue`：`autoTranslate / watch(active) / watch(messages.length) / watch(workLanguage) / canTranslate`（L403-L427、L635-L639）。
- `src/features/service/demo-store.ts`：如增加「会话打开游标」「翻译缓存」，在 store 内建模（L416-L439）。

---

### A3 接收翻译的状态与气泡底部切换缺失

**PRD 原句（4.1、4.3、七）**
> 「点击图标后开始翻译，消息展示加载状态；翻译未完成前不允许重复触发。」
> 「成功后按个人设置展示译文，并在消息气泡下方展示「文本已翻译」及对应切换文案。」
> 「翻译失败时，保留原文，使用 Toast 提示「翻译失败，请重试」。不展示永久失败标识；再次悬浮并点击翻译图标可以重试。」

**现状**
- 悬浮图标点击即同步出译文，无 loading、无防重复触发（L429-L433、L915-L924）。
- 气泡下方没有任何「文本已翻译」文案，切换完全依赖图标（`is-active` 常显）。
- 失败分支只有 `ElMessage.warning(result.error)`，文案是「该语言暂不可用」等，不是「翻译失败，请重试」；且 Demo 翻译永远成功，无法演示失败与重试。

**建议改法**
1. 增加消息级状态 `translating`（Set<messageId>），翻译期间图标替换为 14px 旋转 loading，点击忽略。
2. 成功后在气泡下方渲染状态行：`文本已翻译 · <按钮>`，按钮文案按 PRD 4.3 两行表切换。
3. 失败时保留原文，Toast 固定文案「翻译失败，请重试」，图标恢复可点击；不落永久失败标记。
4. Demo 用 `setTimeout 650ms` 模拟翻译耗时；用 `forceFailNextTranslation`（默认 false、不暴露 UI）演示失败路径。

**改动位置**
- `src/views/inbox/app.vue`：`translateMessage()`、气泡模板与 `msg-translate` 样式（L1292-L1297）。
- `src/features/service/demo-store.ts`：`translateMessage()` 增加延迟/失败模拟（L426-L439）。

---

### A4 翻译缓存与展示权限模型不符

**PRD 原句（4.4、三、验收 7）**
> 「翻译结果可按照原消息及目标语言复用……共享缓存不等于自动展示：成员 B 首次查看由成员 A 翻译过的历史消息时，仍显示原文；成员 B 手动点击翻译后，直接读取可用缓存。」
> 「不同成员可复用同语言翻译缓存，但新成员首次看到他人翻译过的历史消息仍是原文。」

**现状**
- `DemoMessage.translation` 只有一个对象，切换目标语言直接覆盖（`demo-store.ts` L426-L439），无法按「原消息 + 目标语言」复用。
- 种子数据在构建时就直接写入 `translation`（`demo-seed.ts` L249-L251），且 `messageMode()` 默认在有 `translation` 时返回 `'translation'`（`inbox/app.vue` L450-L452），导致：
  - 新成员一进历史会话就看到译文；
  - 关闭接收自动翻译后，历史译文仍默认展示；
  - 无法演示「他人已翻译、我仍看原文，点击后命中缓存」。
- 没有记录「由谁触发」，也没有「本人是否已查看/已触发」的区别。

**建议改法（Demo 口径）**
1. `DemoMessage` 改为 `translations?: Record<targetLanguage, DemoTranslation>` + `translatedBy?: string[]`，保留按目标语言的多份缓存。
2. 种子消息只保留原文（或标为 `cacheOnly: true`），不直接展示译文。
3. 渲染层区分「缓存存在」与「我是否已触发/已展示」：`translationVisible[messageId]` 只在本人手动翻译或本人自动翻译后置真；进入会话先显示原文。
4. 手动翻译命中缓存时不增加 loading 时长（直接取缓存），用于演示「复用共享缓存」。
5. 切换工作语言时按新语言查 `translations[newLang]`：有则复用，无则原文，不批量重翻。

**改动位置**
- `src/features/service/demo-store.ts`：`DemoMessage`（L42-L57）、`translateMessage`、`send`。
- `src/features/service/demo-seed.ts`：`buildMessage` 的 `translation` 写入（L240-L265）。
- `src/views/inbox/app.vue`：`messageMode / displayText / autoTranslate / translateMessage`。

---

### A5 发送预览区未受开关控制、语种相同时整条消失

**PRD 原句（5.1、5.2.6）**
> 「开启【发送消息自动翻译】后，预览区始终显示；初始状态下，即使输入框未输入消息，预览区也展示占位符「翻译为...」」
> 「输入内容和目标语言相同时跳过翻译，避免无意义的翻译消耗。」
> 「关闭【发送消息自动翻译】后，隐藏实时译文预览。」

**现状**
- `transPreviewVisible = previewAvailable && previewDismissed !== previewKey`（`inbox/app.vue` L381-L385），`previewAvailable` 只比较「预览语种 ≠ 工作语言」，**未读取 `sendTranslation`**。
- 因此：未开启发送自动翻译也会出现预览条；开启后只要访客默认语言等于工作语言，整条预览区直接消失，而不是「保留预览区、只跳过翻译」。

**建议改法**
1. 可见性改为 `translation.value.sendTranslation && previewDismissed !== previewKey`，与语种是否相同无关。
2. 语种相同或内容为空时保留预览区，显示「翻译为...」，【使用】禁用；不做翻译请求。
3. 语种一致属于合法可选项，不应从语种菜单中消失（见 B4）。

**改动位置**
- `src/views/inbox/app.vue`：L380-L385、L936-L970。

---

### A6 发送预览缺 800ms 防抖、加载态、过期结果处理与【使用】禁用态

**PRD 原句（5.2.2-5.2.4、验收 9、12）**
> 「停止输入约 800ms 后触发翻译；继续输入则重新计时。」
> 「只接收与最新输入内容、最新目标语种对应的译文结果；旧请求可取消或忽略，不得用过期结果覆盖新译文。」
> 「当最新译文未完成或失败时，【使用】按钮不可点击，不能使用旧译文。」

**现状**
- `autoPreview` 是纯 computed，每次输入立刻调用 `store.previewTranslation()`（L374-L379），无 800ms 防抖、无请求序号、无 loading。
- 【使用】用 `v-if="autoPreview"` 条件渲染，未生成时右端是「×」；不存在「按钮存在但禁用」的形态（L966-L969）。
- 旧结果覆盖问题在 Demo 中因同步计算而不暴露，但一旦加延迟就会出现，需要在方案层提前定义。

**建议改法**
1. 用 `watch(input)` + `setTimeout 800ms` 管理预览请求；每次输入/换语言自增 `requestSeq`，回调里比对序号与当前 `input + language`，不匹配丢弃。
2. 增加 `previewLoading` 状态：预览区显示骨架/「翻译中...」；【使用】始终存在但 `disabled`。
3. 失败时保留输入原文，Toast「翻译失败，请重试」，【使用】禁用，继续输入可重试；不阻止直接发送。
4. Demo 延迟用 400ms，与防抖组合后体感接近真实。

**改动位置**
- `src/views/inbox/app.vue`：L374-L379、L434-L445、L964-L969、预览条样式 L1349-L1367。
- `src/features/service/demo-store.ts`：`previewTranslation`（L441-L447）。

---

### A7 【使用】后的生命周期、草稿返回、临时语种复位不符

**PRD 原句（5.3、5.4、5.1 末段）**
> 「替换成功后，上方实时译文内容清空，预览区继续保留并显示占位提示「翻译为...」」
> 「切换会话再返回时恢复草稿，但不保留上次生成的译文；预览区显示「翻译为...」，继续编辑后重新翻译。」
> 「手动切换预览语种仅影响当前消息；发送下一条消息时恢复个人默认目标语言。」

**现状**
- `usePreview()` 在回填译文后立即把 `previewDismissed` 设为当前 key（L438-L445），`transPreviewVisible` 变 false，**整条预览区消失**，而不是清空译文、显示「翻译为...」。
- 切换会话恢复草稿时，`autoPreview` 是 computed，立刻对草稿重新算出译文（L411-L417、L374-L379），返回会话即看到译文，而非占位。
- `previewTarget` 只在切换会话时重置（L414），`send()` 后不重置；下一条消息仍沿用上一次临时选择的语种。

**建议改法**
1. 使用译文后不要收起整条：清空内部译文态、保留预览区、显示「翻译为...」，【使用】禁用；输入框保留译文。
2. 每个会话记录「预览是否需要重新触发」：恢复草稿后先显示占位，用户再次输入（input 变更）才进入 800ms 防抖翻译。
3. `send()` 成功后重置 `previewTarget = ''` 与预览结果，下一条消息回到个人「访客默认语言」。
4. 去掉「× 关闭预览」交互（PRD 未定义关闭；预览区应始终显示），或降级为「清空译文」而不是隐藏整条（见 B3）。

**改动位置**
- `src/views/inbox/app.vue`：`usePreview / dismissPreview / previewTarget / watch(active) / send`（L411-L449、L484-L491）。

---

### A8 缺消息复制能力

**PRD 原句（六）**
> 「复制消息 | 复制当前消息气泡可见的文本；双语模式下，以实际显示的原文及译文为准」

**现状**
- 工作台消息气泡没有任何复制入口；现有复制只分布在客户详情 ID、会话 ID、渠道链接等处（`CustomerBasicInfo.vue`、`CustomerChatInfo.vue`、`views/channels/app.vue`）。

**建议改法**
- 气泡悬浮操作区增加「复制」图标（与翻译图标同一组，28px 热区）。
- 复制内容直接取当前渲染态：原文模式取 `content`；仅译文取译文；双语按「原文 + 换行 + 译文」；隐藏译文后只复制原文。
- 成功后 `ElMessage.success('已复制')`，失败 `ElMessage.error('复制失败，请手动复制')`。

**改动位置**
- `src/views/inbox/app.vue`：气泡操作区（L889-L925 的 `bubble-shell`）与样式 L1292-L1300。

---

### A9 翻译设置入口位置不符

**PRD 原句（三）**
> 「入口：个人中心 → 翻译设置。」

**现状**
- 实际入口是「设置 → 聊天工具」：导航项 `聊天工具` 指向 `/settings/reception/tools`（`src/views/settings/page-shell.vue` L35-L39），路由 meta 标题也是「聊天工具」（`src/router/routes/core.ts` L142-L147），页面内标题才是「翻译设置」。
- 个人中心（`src/views/personal/app.vue`）只有「在线状态」「账号安全」两个分区，无翻译入口；顶栏用户菜单也只有接受聊天、界面语言、退出（`src/views/personal/user-menu.vue`）。

**建议改法**
- 优先方案：按 PRD 在个人中心新增「翻译设置」分区，复用现有 5 项配置组件；设置模块保留为管理端视角或移除重复入口。
- 若本期不动路由结构，至少把导航标签与 meta 标题统一为「翻译设置」，并在个人中心增加跳转入口，保证「个人中心 → 翻译设置」路径可达。

**改动位置**
- `src/views/personal/app.vue`（新增分区 / 跳转）。
- `src/views/settings/page-shell.vue` L35-L39、`src/router/routes/core.ts` L142-L147（命名统一）。

---

### A10 纯表情文本消息仍会出现翻译图标

**PRD 原句（六）**
> 「图片、附件、系统消息、纯表情 | 不翻译；不显示翻译图标」

**现状**
- 种子里的表情消息用 `kind: 'emoji'`（`demo-seed.ts` L397、L482 等），因此被 `kind === 'text'` 条件排除；
- 但访客端输入纯 emoji 时走 `ingestCustomerMessage`，固定写入 `kind: 'text'`（`demo-store.ts` L596-L597），工作台会显示翻译图标并允许翻译，与 PRD 冲突。

**建议改法**
- `canTranslate()` 增加内容级判断：`/^\p{Extended_Pictographic}\s*$/u` 或「去除 emoji/空白后为空」不展示图标。
- 可选：`ingestCustomerMessage` 对纯表情内容写入 `kind: 'emoji'`，与种子口径一致；两者都做更稳。

**改动位置**
- `src/views/inbox/app.vue`：`canTranslate()`（L635-L639）。
- `src/features/service/demo-store.ts`：`ingestCustomerMessage` 的 `kind`（L596-L597）。

---

## 3. B 类：交互细节可优化

### B1 翻译图标的职责与提示

- **现状**：图标同时承担「触发翻译」和「原文/译文切换」；`aria-label` 直接写「切换为原文/译文」，无 tooltip 说明；已翻译态图标底色 `#f7f4ff` 偏紫，与全站中性灰不一致。
- **建议**：未翻译时图标=「翻译」，已翻译后图标隐藏或仅作辅助，切换交给气泡底部状态行；补充 `title`/tooltip「翻译」；底色改为 `var(--ui-accent-soft)`。
- **位置**：`inbox/app.vue` L915-L924、L1292-L1297。

### B2 长译文单行截断不可读

- **现状**：`.trans-text` 为 `white-space: nowrap + ellipsis`，长句只能看到一行，无法核对译文（L1361）。
- **建议**：预览条最多两行（`-webkit-line-clamp: 2`），超出可 hover 展开或点击查看全文；预览条高度随内容 42→56px 自适应，不影响输入框。
- **位置**：`inbox/app.vue` L1350、L1361-L1362。

### B3 占位态右侧是「×」而非禁用【使用】

- **现状**：无译文时显示关闭按钮，点击后整条预览消失直到输入变化（L966-L969）。
- **建议**：统一为「【使用】常驻 + 禁用态」，移除关闭按钮；如必须保留关闭，改为「收起本次译文，保留占位」。
- **位置**：`inbox/app.vue` L966-L969、L1364-L1367。

### B4 语种菜单排除工作语言、胶囊热区偏小

- **现状**：`previewLanguages` 过滤掉工作语言（L367），菜单里无法选择「与工作语言相同」；胶囊 34×22px（L1352）。
- **建议**：菜单展示全部可用语种并标记当前项；胶囊热区高度至少 28px，点击区域含 4px 外扩；选择后立即按 800ms 规则重算（不沿用旧译文）。
- **位置**：`inbox/app.vue` L367-L373、L938-L963、L1351-L1360。

### B5 设置项无即时反馈与生效说明

- **现状**：设置切换直接写 store，但无任何提示；页面也没有说明「保存即生效」「不影响原文」。
- **建议**：切换后轻提示「已保存，立即生效」；每个开关描述补一句边界（如「关闭后仅停止后续自动翻译，已翻译消息仍可切换」）。
- **位置**：`settings/tools/app.vue` L44-L101。

### B6 译文切换时气泡高度跳变

- **现状**：`messageMode` 在原文/译文间互换，文本长度差异导致气泡高度突变，无过渡。
- **建议**：切换时给气泡 `transition: min-height 0.12s ease` 或保持上次最小高度；双语/单语切换避免整行跳动。
- **位置**：`inbox/app.vue` 气泡样式 L1270-L1300。

---

## 4. C 类：纯视觉与文案打磨

### C1 语种简称大小写

- **现状**：`LANG_CODES` 输出 `zh / en / vi` 等小写（L26），PRD 示例为 `EN`。
- **建议**：统一大写，`EN / ZH / VI / TH / KM / MY / LO / ES`。
- **位置**：`inbox/app.vue` L26。

### C2 预览条视觉层次

- **现状**：背景 `#f6f6f7`、圆角 12px，与输入框容器的描边/圆角未形成清晰分组（L1350）。
- **建议**：背景改为 `#f5f5f6`，圆角对齐 `--ui-radius-control`（8px）或 12px 统一；`gap` 10→8px；右端按钮与文案基线对齐。
- **位置**：`inbox/app.vue` L1349-L1367。

### C3 翻译图标尺寸与间距

- **现状**：15px 图标、28px 热区，与气泡外侧距离偏松；已翻译态底色偏紫。
- **建议**：图标 16px、热区 28px、与气泡间距 6px；已翻译态用 `--ui-accent-soft`；hover 用 `#ececee`。
- **位置**：`inbox/app.vue` L1292-L1297。

### C4 「已使用译文」Toast

- **现状**：`ElMessage.success('已使用译文')`（L444），PRD 未定义该提示，且与「预览清空、显示翻译为...」的反馈重复。
- **建议**：改为「译文已填入输入框」，或直接去掉 Toast，用预览区占位变化作为反馈。
- **位置**：`inbox/app.vue` L438-L445。

### C5 设置页命名与说明文案

- **现状**：导航「聊天工具」/页面「翻译设置」不一致；副描述偏功能罗列。
- **建议**：统一为「翻译设置」；描述补「翻译不会修改原始聊天记录」「未点击【使用】时发送的是输入框原文」两句原则。
- **位置**：`settings/page-shell.vue` L35-L39、`router/routes/core.ts` L142-L147、`settings/tools/app.vue` L54-L70。

---

## 5. 新增配置项「翻译后的显示效果」交互规格

### 5.1 位置与结构

- 位于设置页「发送消息自动翻译」之后、「成员工作语言」之前（PRD 三的表格顺序）。
- 区块标题「翻译后的显示效果」，与现有 `row-title` 同规格（14px / 22px / 500 / `--ui-ink`），标题下 12px 放两张并排单选卡。
- 整块作为一个 `setting-row`，沿用现有 `padding: 16px 20px` 与分隔线。

### 5.2 尺寸与样式建议值

| 元素 | 建议值 |
|---|---|
| 卡片容器 | `display: flex; gap: 24px`；卡片 `flex: 1 1 0; min-width: 300px; max-width: 456px; height: 200px` |
| 卡片外观 | 背景 `#FFFFFF`；描边 `1px solid #E3E3E5`；圆角 `12px`；`overflow: hidden` |
| 卡片预览区 | `padding: 20px`；`min-height: 148px`；`display: flex; gap: 12px; align-items: flex-start` |
| 客服头像 | `40 × 40px`；圆角 50%；底色 `#F5F5F6`；图标 20px，颜色 `#003FA4` |
| 气泡 | `max-width: 224px`；`padding: 10px 14px`；背景 `#F2F2F3`；圆角 `10px`；字号 `14px`；行高 `20px`；颜色 `#131317` |
| 双语气泡组 | 上下排列，`gap: 8px`；头像只出现一次，与第一行顶部对齐 |
| 选项行 | `height: 52px`；`padding: 0 16px`；`display: flex; align-items: center; gap: 10px`；`border-top: 1px solid #ECECED` |
| 选项文案 | `14px`；未选 `400 / #131317`；选中 `500 / #131317` |
| 单选控件 | `16 × 16px`；未选中：白底 + `1px solid #D0D0D5`；选中：`#003FA4` 实心圆 + 6px 白色内点 |
| 选中态卡片 | 底色 `#F3F6FE`（等价 `rgb(0 63 164 / 6%)`）；描边 `#D8E2F8`；选项行分割线 `#DDE6FA` |
| 悬停态 | 未选中卡 `background: #FAFAFB`；选中卡不变 |
| 窄屏 | `< 720px` 时纵向堆叠，`gap: 12px`；卡片 `max-width: none; height: auto` |

### 5.3 两张卡的内容

| 卡片 | 卡内文案 | 预览内容 | 选中态 |
|---|---|---|---|
| 左 | 显示原文和译文 | 头像 + 两个气泡：上「Hello, my friend」、下「你好，朋友」 | 默认不选中 |
| 右 | 仅显示译文 | 头像 + 单个气泡：「你好，朋友」 | **默认选中** |

- 头像使用**客服图标**，不是参考图里的翻译机器人。项目现有图标集无耳机图标，建议优先补一个 `headset` 资产；若暂不补，用现有 `message-circle-text`（客服会话语义）替代，避免使用 `translate`/机器人形象。
- 文案、卡片圆角/描边/内边距与参考图一致；参考图用「Hello, my friend」作为原文，Demo 保持一致，便于评审对照。

### 5.4 行为规则

1. 点击卡片任意位置选中该项，立即写入 `displayMode`；不设「保存」按钮，切换即生效。
2. 选中后：
   - 聊天页所有**已存在译文**立即按新模式渲染，不重新请求翻译；
   - 清空消息级临时切换覆盖（`translationMode`），避免旧的「显示原文」状态压过新设置。
3. 「仅显示译文」：气泡只显示译文；底部「文本已翻译 · 显示原文」，点击后气泡换为原文、按钮变「显示译文」，再点恢复。
4. 「显示原文和译文」：同一头像下上下两个气泡（原文在上、译文在下）；底部「文本已翻译 · 隐藏译文」，点击后只留原文、按钮变「显示译文」，再点恢复双语。
5. 切换仅影响展示，不改变 `message.content`，也不重新调用翻译。
6. 离开会话再进入：不保留每条消息的临时切换状态，按当前 `displayMode` 恢复本人已触发过的译文。
7. 未开启接收自动翻译/未手动翻译过的消息，不因该设置而出现译文。

### 5.5 数据与改动位置

- 类型：`MemberTranslationSettings.displayMode: 'translation-only' | 'bilingual'`。
- 默认值：`'translation-only'`；旧本地数据缺字段时由 `defaultTranslation()` 兜底，无需升级存储 key。
- 文件：
  - `src/features/service/demo-store.ts`：类型、默认值、`setMemberTranslation`。
  - `src/views/settings/tools/app.vue`：新增单选卡片区块。
  - `src/views/inbox/app.vue`：`messageMode` 增加 `'bilingual'` 分支、气泡双语模板、底部状态行、样式。
  - `src/features/service/demo-store.test.ts`：补默认值与切换用例。

---

## 6. Demo 口径（明确不做的部分）

| 项 | Demo 做法 |
|---|---|
| 翻译服务 | 不接真实服务。命中 `demo-seed.ts` 的 `presetTranslations`；未命中按内容 hash 从 `translation-corpus.ts` 语料池取同语气句子 |
| 后端/持久化 | 全部走 `demo-store` + `localStorage`；不建接口、不发请求 |
| 延迟与加载 | 接收翻译 `setTimeout 650ms`；发送预览「800ms 防抖 + 400ms 模拟耗时」 |
| 失败路径 | `forceFailNextTranslation` 内存开关（默认 false、不暴露 UI），命中后返回失败，用于演示 Toast 与重试 |
| 自动翻译前台判定 | `document.visibilityState + document.hasFocus()`；失焦只记游标不翻译，回前台不补翻 |
| 「新收到消息」 | 以会话打开时的消息游标为准，只处理之后追加的客户文本消息；不做真实 WebSocket 推送 |
| 跨成员缓存 | 消息上按目标语言存多份译文 + 触发成员标记；进入会话仍先显示原文，手动点击命中缓存 |
| 语言识别 | 不做真实语言检测，沿用种子的 `originalLanguage`；缺省时按内容语料兜底并允许尝试翻译 |
| 不做 | 限额、限流、供应商、语种清单扩展、OCR、附件翻译、历史批量翻译、5 分钟时限 |

---

## 7. 建议实施顺序与验收

**P0（先补齐可被现场验证的硬规则）**
1. A1 显示效果字段 + 设置卡片 + 双语渲染 + 底部状态行。
2. A5/A6/A7 发送预览状态机（开关、常驻、800ms、加载、过期保护、【使用】禁用、使用后占位、发送/切会话复位）。
3. A2/A4 接收自动翻译开关、前台门禁、游标、按语言缓存与展示权限。

**P1（异常与边界）**
4. A3 加载/失败/重试与文案。
5. A8 复制、A9 入口、A10 纯表情。

**P2（打磨）**
6. B1-B6、C1-C5。

**验收对应 PRD 第八节关键路径**：1（默认值）、2/3（前台自动翻译）、4/7（历史与共享缓存）、5/6（两种显示模式切换）、8-12（发送预览全流程）、13（草稿）、14（摘要/搜索原文）。

**验证方式（后续执行阶段）**
- `pnpm -F @vben/web-ele run typecheck` 退出码 0。
- 手工走查：设置默认值 → 会话 A/B 自动翻译差异 → 切后台再回 → 两种显示模式切换 → 发送预览防抖/换语种/使用/发送 → 草稿切换 → 纯表情/图片无图标 → 摘要与搜索仍为原文。
- 截图存档到 `output/ui-revamp/`，不执行 `build:ele`。

---

## 8. 待确认点

1. 「个人中心 → 翻译设置」是否按 PRD 新建入口，还是保留「设置 → 聊天工具」并在个人中心加跳转（影响 A9 的实现量）。
2. 双语模式在聊天页采用「两个独立气泡」还是「单气泡内两段文本 + 分隔线」——本文按参考图采用前者。
3. 客服头像图标：新增 `headset` 资产，还是复用 `message-circle-text`。
4. 翻译失败演示是否允许保留 `forceFailNextTranslation` 内存开关（不出现在 UI）。

---

## 9. PRD 补充条款（用户确认，需并入最终版 PRD）

> 【翻译】图标仅出现在客户发送的文本消息气泡上；成员己方与 AI 消息不提供手动翻译入口。

- 该条款补充原文 **4.1** 未限定发送方的空白处：4.1 只描述了图标悬浮与手动翻译的交互方式，未明确哪些发送方的消息可以触发翻译。
- 与 **4.2「自动翻译仅客户」** 保持同向：接收侧自动翻译本就只处理客户文本消息，手动入口同样只对客户消息开放，避免成员己方与 AI 消息出现两套口径。
