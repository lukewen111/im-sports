<script setup lang="ts">
import { computed, reactive } from 'vue';
import { ElButton, ElInputNumber, ElMessage } from 'element-plus';

import { useDemoServiceStore } from '#/features/service/demo-store';
import { usePrototypeAccess } from '#/features/team/access-store';

import PageShell from '../page-shell.vue';

const MIN_MINUTES = 1;
const MAX_MINUTES = 1440;

type AlertKey = 'alertBlueMinutes' | 'alertOrangeMinutes' | 'alertRedMinutes' | 'alertYellowMinutes';

const rows: Array<{ key: AlertKey; label: string; tone: string }> = [
  { key: 'alertRedMinutes', label: '红色', tone: 'red' },
  { key: 'alertOrangeMinutes', label: '橙色', tone: 'orange' },
  { key: 'alertYellowMinutes', label: '黄色', tone: 'yellow' },
  { key: 'alertBlueMinutes', label: '蓝色', tone: 'blue' },
];

const access = usePrototypeAccess();
const store = useDemoServiceStore();

const member = computed(() => access.current);
const canAccess = computed(() => Boolean(access.permissions.settings));

const draft = reactive<Record<AlertKey, number | undefined>>({
  alertBlueMinutes: store.reception.alertBlueMinutes,
  alertOrangeMinutes: store.reception.alertOrangeMinutes,
  alertRedMinutes: store.reception.alertRedMinutes,
  alertYellowMinutes: store.reception.alertYellowMinutes,
});

const dirty = computed(() => rows.some((row) => draft[row.key] !== store.reception[row.key]));

function resetDraft() {
  rows.forEach((row) => {
    draft[row.key] = store.reception[row.key];
  });
}

function saveSettings() {
  rows.forEach((row) => {
    const value = draft[row.key];
    if (typeof value === 'number' && Number.isFinite(value)) store.reception[row.key] = value;
  });
  resetDraft();
  ElMessage.success('已保存');
}
</script>

<template>
  <PageShell :can-access="canAccess" :member-name="member?.name">
    <section class="settings-card">
      <div class="alert-list">
        <div v-for="row in rows" :key="row.key" class="alert-row">
          <span class="alert-text">客户等待客服回复达到</span>
          <ElInputNumber
            :id="row.key"
            v-model="draft[row.key]"
            :aria-label="`${row.label}预警阈值`"
            :max="MAX_MINUTES"
            :min="MIN_MINUTES"
            :precision="0"
            controls-position="right"
          />
          <span class="alert-text">
            分钟时，显示<span class="alert-level" :class="`is-${row.tone}`">{{ row.label }}预警</span>
          </span>
        </div>
      </div>

      <footer class="card-actions">
        <div class="btn-group">
          <ElButton class="ui-btn-outline" :disabled="!dirty" @click="resetDraft">取消</ElButton>
          <ElButton type="primary" @click="saveSettings">保存</ElButton>
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

.alert-list {
  padding: 0;
}

.alert-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  color: var(--ui-ink);
  font-size: 14px;
  line-height: 22px;
}

.alert-row + .alert-row {
  border-top: 1px solid #ececed;
}

.alert-text {
  white-space: nowrap;
}

.alert-row :deep(.el-input-number) {
  width: 128px;
  height: var(--ui-control-height);
}

.alert-row :deep(.el-input-number .el-input__wrapper) {
  min-height: var(--ui-control-height);
  border-radius: var(--ui-radius-control);
  box-shadow: 0 0 0 1px var(--ui-control-line) inset;
}

.alert-row :deep(.el-input__inner) {
  font-size: 13px;
}

.alert-level.is-red {
  color: var(--ui-danger);
}

.alert-level.is-orange {
  color: var(--ui-amber);
}

.alert-level.is-yellow {
  /* 主题里只有黄色面（--ui-warn-surface），没有可读的黄色文字色，这里取同一色相压暗一档 */
  color: #b58a00;
}

.alert-level.is-blue {
  color: var(--ui-accent);
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #ececed;
}

.btn-group {
  display: flex;
  flex: none;
  gap: 8px;
}
</style>
