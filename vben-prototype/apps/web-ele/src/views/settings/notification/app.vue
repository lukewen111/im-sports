<script setup lang="ts">
import { computed } from 'vue';
import { ElCheckbox, ElTooltip } from 'element-plus';

import { useDemoServiceStore } from '#/features/service/demo-store';
import type { MemberNotificationSettings } from '#/features/service/demo-store';
import { usePrototypeAccess } from '#/features/team/access-store';

import PageShell from '../page-shell.vue';

type NotificationKey = keyof MemberNotificationSettings;

const access = usePrototypeAccess();
const store = useDemoServiceStore();
const member = computed(() => access.current);
const canAccess = computed(() => Boolean(access.permissions.settings));
const memberId = computed(() => access.current?.id || access.currentId);

const settings = computed(() => store.memberNotificationFor(memberId.value));

const options: Array<{ description: string; key: NotificationKey; label: string }> = [
  {
    key: 'titleBlink',
    label: '浏览器页头闪烁',
    description: '有符合提醒条件的新消息时，使客服后台浏览器标签页的标题或标识闪烁提醒。',
  },
  {
    key: 'browserNotification',
    label: '浏览器通知',
    description: '按现有 IM 通知机制显示浏览器系统通知，需要浏览器和系统已授权通知权限。',
  },
  {
    key: 'sound',
    label: '浏览器提示音',
    description: '按现有 IM 消息提示机制播放声音，复用既有声音资源与播放条件。',
  },
];

function toggle(key: NotificationKey, value: string | number | boolean) {
  store.setMemberNotification(memberId.value, { [key]: Boolean(value) });
}
</script>

<template>
  <PageShell
    :can-access="canAccess"
    :member-name="member?.name"
    title="消息通知"
  >
    <section class="settings-card">
      <header class="card-head">
        <h2>通知方式</h2>
      </header>

      <div class="option-list">
        <div v-for="option in options" :key="option.key" class="option-row">
          <ElCheckbox
            :model-value="settings[option.key]"
            @change="(value) => toggle(option.key, value)"
          >
            {{ option.label }}
          </ElCheckbox>
          <ElTooltip :content="option.description" placement="top" :show-after="150">
            <button class="help-dot" type="button" :aria-label="`${option.label}说明`">?</button>
          </ElTooltip>
        </div>
      </div>
    </section>
  </PageShell>
</template>

<style scoped>
.settings-card {
  background: #ffffff;
  border: 1px solid #ececed;
  border-radius: 12px;
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
}

.card-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.option-list {
  border-top: 1px solid #ececed;
}

.option-row :deep(.el-checkbox) {
  --el-checkbox-checked-bg-color: #131317;
  --el-checkbox-checked-input-border-color: #131317;
  --el-checkbox-checked-icon-color: #ffffff;
  --el-checkbox-input-border-color-hover: #131317;
  height: auto;
  margin-right: 0;
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
}

.option-row + .option-row {
  border-top: 1px solid #ececed;
}

.option-row :deep(.el-checkbox__label) {
  color: var(--ui-ink);
  font-size: 14px;
  line-height: 22px;
}

.option-row :deep(.el-checkbox__inner) {
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.option-row :deep(.el-checkbox:not(.is-checked) .el-checkbox__inner) {
  border-color: #c9c9cd;
}

.option-row :deep(.el-checkbox__inner::after) {
  top: 3px;
  left: 5px;
  width: 4px;
  height: 8px;
}

.help-dot {
  display: inline-flex;
  width: 18px;
  height: 18px;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--ui-ink-muted);
  font-size: 12px;
  line-height: 1;
  cursor: help;
  background: transparent;
  border: 1px solid var(--ui-control-line);
  border-radius: 50%;
}

.help-dot:hover {
  color: var(--ui-ink);
  border-color: var(--ui-ink-muted);
}
</style>
