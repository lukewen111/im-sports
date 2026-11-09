<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElButton, ElInput, ElMessage, ElMessageBox, ElOption, ElSelect } from 'element-plus';

import QIcon from '#/components/q-icon/QIcon.vue';
import type { AutoMessageKey, AutoMessageSettings } from '#/features/service/demo-store';
import { useDemoServiceStore } from '#/features/service/demo-store';
import { usePrototypeAccess } from '#/features/team/access-store';

import PageShell from '../page-shell.vue';

const LANGUAGES = ['简体中文', '繁体中文', '英语', '越南语', '泰语', '高棉语', '缅甸语', '老挝语', '西班牙语'];

const columns: Array<Array<{ key: AutoMessageKey; title: string }>> = [
  [
    { key: 'welcome', title: '欢迎语' },
    { key: 'closing', title: '结束语' },
  ],
  [
    { key: 'assign', title: '会话分配提示消息' },
    { key: 'close', title: '会话关闭提示消息' },
    { key: 'timeout', title: '会话超时关闭提示消息' },
  ],
];

const access = usePrototypeAccess();
const store = useDemoServiceStore();
const member = computed(() => access.current);
const canAccess = computed(() => Boolean(access.permissions.settings));

const draft = ref<AutoMessageSettings>(cloneMessages(store.autoMessages));
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(store.autoMessages));

function cloneMessages(value: AutoMessageSettings): AutoMessageSettings {
  return JSON.parse(JSON.stringify(value)) as AutoMessageSettings;
}

function isLanguageUsed(key: AutoMessageKey, language: string, lineId: string) {
  return draft.value[key].some((line) => line.language === language && line.id !== lineId);
}

function addLanguage(key: AutoMessageKey) {
  const language = LANGUAGES.find((item) => !draft.value[key].some((line) => line.language === item));
  if (!language) return ElMessage.warning('9 种语言均已添加。');
  draft.value[key].push({ content: '', id: `auto-${key}-${crypto.randomUUID?.() ?? Date.now()}`, language });
}

async function removeLanguage(key: AutoMessageKey, lineId: string) {
  const line = draft.value[key].find((item) => item.id === lineId);
  if (!line) return;
  const confirmed = await ElMessageBox.confirm(
    `删除「${line.language}」后，该语种将不再发送这条话术。`,
    '删除语种',
    { cancelButtonText: '取消', confirmButtonText: '删除', type: 'warning' },
  ).then(() => true).catch(() => false);
  if (!confirmed) return;
  draft.value[key] = draft.value[key].filter((item) => item.id !== lineId);
}

function resetDraft() {
  draft.value = cloneMessages(store.autoMessages);
}

function saveSettings() {
  store.setAutoMessages(draft.value);
  draft.value = cloneMessages(store.autoMessages);
  ElMessage.success('已保存');
}
</script>

<template>
  <PageShell :can-access="canAccess" :member-name="member?.name">
    <div class="message-grid">
      <div v-for="(column, columnIndex) in columns" :key="columnIndex" class="message-column">
        <section v-for="block in column" :key="block.key" class="message-card">
          <h2 class="block-title">{{ block.title }}</h2>

          <div v-if="draft[block.key].length > 0" class="language-list">
            <div v-for="line in draft[block.key]" :key="line.id" class="language-row">
              <ElSelect
                v-model="line.language"
                class="language-select"
                :aria-label="`${block.title}语种`"
              >
                <ElOption
                  v-for="language in LANGUAGES"
                  :key="language"
                  :disabled="isLanguageUsed(block.key, language, line.id)"
                  :label="language"
                  :value="language"
                />
              </ElSelect>
              <ElInput
                v-model="line.content"
                :aria-label="`${block.title}（${line.language}）话术内容`"
                :autosize="{ minRows: 1, maxRows: 6 }"
                placeholder="请输入话术内容"
                resize="none"
                type="textarea"
              />
              <button
                class="delete-line"
                type="button"
                :aria-label="`删除${line.language}语种`"
                @click="removeLanguage(block.key, line.id)"
              >
                <QIcon name="trash" :size="14" />
              </button>
            </div>
          </div>

          <p v-else class="block-empty">暂无语种话术</p>

          <div class="block-actions">
            <ElButton class="add-language" link @click="addLanguage(block.key)">
              <QIcon name="plus" :size="14" />
              <span>添加语言</span>
            </ElButton>
          </div>
        </section>
      </div>
    </div>

    <footer v-if="dirty" class="card-actions">
      <div class="btn-group">
        <ElButton class="ui-btn-outline" @click="resetDraft">取消</ElButton>
        <ElButton type="primary" @click="saveSettings">保存</ElButton>
      </div>
    </footer>
  </PageShell>
</template>

<style scoped>
.message-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.message-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.message-card {
  padding: 12px 16px 4px;
  background: #ffffff;
  border: 1px solid #ececed;
  border-radius: 12px;
}

.block-title {
  margin: 0;
  color: var(--ui-ink);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}

.language-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.language-row {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr) 28px;
  gap: 8px;
  align-items: start;
}

.language-select {
  width: 100%;
}

.language-select :deep(.el-select__wrapper) {
  min-height: 32px;
  padding: 0 8px;
  border-radius: var(--ui-radius-control);
  box-shadow: 0 0 0 1px var(--ui-control-line) inset;
}

.language-select :deep(.el-select__selected-item) {
  font-size: 13px;
}

.language-row :deep(.el-textarea__inner) {
  padding: 5px 10px;
  font-size: 13px;
  line-height: 20px;
  border-radius: var(--ui-radius-control);
  box-shadow: 0 0 0 1px var(--ui-control-line) inset;
  resize: none;
}

.language-row :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px var(--ui-accent) inset;
}

.delete-line {
  display: inline-flex;
  width: 28px;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--ui-ink-muted);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
}

.delete-line:hover {
  color: var(--ui-ink);
  background: #f5f5f6;
}

.block-empty {
  margin: 6px 0 0;
  color: var(--ui-ink-muted);
  font-size: 12px;
  line-height: 20px;
}

.block-actions {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.add-language {
  padding: 4px 0;
  color: var(--ui-accent);
  font-size: 13px;
}

.add-language :deep(span) {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 12px;
  padding: 12px 4px 0;
  border-top: 1px solid #ececed;
}

.btn-group {
  display: flex;
  gap: 8px;
}

@media (max-width: 960px) {
  .message-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
