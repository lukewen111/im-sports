<script setup lang="ts">
import { computed, reactive } from 'vue';
import { ElButton, ElInputNumber, ElMessage } from 'element-plus';

import QIcon from '#/components/q-icon/QIcon.vue';
import { useDemoServiceStore } from '#/features/service/demo-store';
import { usePrototypeAccess } from '#/features/team/access-store';

import PageShell from '../page-shell.vue';

const MIN_MINUTES = 1;
const MAX_MINUTES = 1440;

const access = usePrototypeAccess();
const store = useDemoServiceStore();

const draft = reactive<{ first: number | undefined; inactive: number | undefined }>({
  first: store.reception.firstResponseMinutes,
  inactive: store.reception.inactiveCloseMinutes,
});

const member = computed(() => access.current);
const canAccess = computed(() => Boolean(access.permissions.settings));

function minuteError(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '请输入有效的分钟数';
  if (!Number.isInteger(value) || value < MIN_MINUTES || value > MAX_MINUTES) return '请输入有效的分钟数';
  return '';
}

const errors = computed(() => ({
  first: minuteError(draft.first),
  inactive: minuteError(draft.inactive),
}));
const hasError = computed(() => Boolean(errors.value.first || errors.value.inactive));
const dirty = computed(() => draft.first !== store.reception.firstResponseMinutes
  || draft.inactive !== store.reception.inactiveCloseMinutes);

function saveSettings() {
  if (hasError.value) {
    ElMessage.warning('请输入有效的分钟数');
    return;
  }
  store.reception.firstResponseMinutes = draft.first as number;
  store.reception.inactiveCloseMinutes = draft.inactive as number;
  ElMessage.success('会话设置已保存');
}

function resetDraft() {
  draft.first = store.reception.firstResponseMinutes;
  draft.inactive = store.reception.inactiveCloseMinutes;
}
</script>

<template>
  <PageShell
    :can-access="canAccess"
    :member-name="member?.name"
    title="会话设置"
  >
    <section class="settings-card">
      <div class="rule-list">
        <div class="rule-row">
          <span class="rule-check" role="checkbox" aria-checked="true" aria-disabled="true" title="按 PRD 固定生效">
            <QIcon color="#ffffff" name="check" :size="12" />
          </span>
          <div class="rule-body">
            <span class="rule-title">首次接待未响应转单时间</span>
            <p class="rule-desc">
              新会话在该时间内无人回复时，自动转给其他成员。
            </p>
            <small v-if="errors.first" class="rule-error">{{ errors.first }}</small>
          </div>
          <div class="minutes">
            <ElInputNumber
              id="first-response-minutes"
              v-model="draft.first"
              aria-label="首次接待未响应转单时间"
              :min="MIN_MINUTES"
              :max="MAX_MINUTES"
              :precision="0"
              controls-position="right"
            />
            <span>分钟</span>
          </div>
        </div>

        <div class="rule-row">
          <span class="rule-check" role="checkbox" aria-checked="true" aria-disabled="true" title="按 PRD 固定生效">
            <QIcon color="#ffffff" name="check" :size="12" />
          </span>
          <div class="rule-body">
            <span class="rule-title">会话无消息自动结束时间</span>
            <p class="rule-desc">
              聊天中超过该时间没有新的成功业务消息，会话自动结束；待分配会话不受此规则影响。
            </p>
            <small v-if="errors.inactive" class="rule-error">{{ errors.inactive }}</small>
          </div>
          <div class="minutes">
            <ElInputNumber
              id="inactive-close-minutes"
              v-model="draft.inactive"
              aria-label="会话无消息自动结束时间"
              :min="MIN_MINUTES"
              :max="MAX_MINUTES"
              :precision="0"
              controls-position="right"
            />
            <span>分钟</span>
          </div>
        </div>
      </div>

      <footer class="card-actions">
        <div class="btn-group">
          <ElButton class="ui-btn-outline" :disabled="!dirty" @click="resetDraft">取消</ElButton>
          <ElButton type="primary" :disabled="hasError" @click="saveSettings">保存</ElButton>
        </div>
      </footer>
    </section>
  </PageShell>
</template>

<style scoped>
.settings-card {
  background: #ffffff;
  border: 1px solid #ececed;
  border-radius: 12px;
}

.rule-list {
  padding: 0;
}

.rule-row {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
  padding: 16px 20px;
}

.rule-row + .rule-row {
  border-top: 1px solid #ececed;
}

.rule-check {
  display: inline-flex;
  width: 16px;
  height: 16px;
  margin-top: 3px;
  align-items: center;
  justify-content: center;
  background: #131317;
  border: 1px solid #131317;
  border-radius: 3px;
  cursor: default;
}

.rule-check :deep(.q-icon) {
  color: #ffffff;
}

.rule-title {
  color: var(--ui-ink);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}

.rule-desc {
  max-width: 780px;
  margin: 4px 0 0;
  color: var(--ui-ink-muted);
  font-size: 12px;
  line-height: 1.6;
}

.minutes {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ui-ink-muted);
  font-size: 12px;
}

.minutes :deep(.el-input-number) {
  width: 128px;
  height: var(--ui-control-height);
}

.minutes :deep(.el-input-number .el-input__wrapper) {
  min-height: var(--ui-control-height);
  border-radius: var(--ui-radius-control);
  box-shadow: 0 0 0 1px var(--ui-control-line) inset;
}

.minutes :deep(.el-input__inner) {
  font-size: 13px;
}

.rule-error {
  display: block;
  margin-top: 6px;
  color: var(--ui-danger);
  font-size: 12px;
  line-height: 18px;
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 20px;
  padding: 16px 20px;
  border-top: 1px solid #ececed;
}

.btn-group {
  display: flex;
  flex: none;
  gap: 8px;
}

@media (max-width: 900px) {
  .rule-row {
    grid-template-columns: 16px minmax(0, 1fr);
    row-gap: 10px;
  }

  .minutes {
    grid-column: 2;
  }

  .card-actions {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
