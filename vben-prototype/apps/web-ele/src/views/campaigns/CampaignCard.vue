<script setup lang="ts">
import type { Campaign } from '#/features/campaigns/campaign-data';

import { computed } from 'vue';
import { ElDropdown, ElDropdownItem, ElDropdownMenu, ElSwitch, ElTooltip } from 'element-plus';
import QIcon from '#/components/q-icon/QIcon.vue';
import { useCampaignStore } from '#/features/campaigns/campaign-store';
import { campaignStatus, scheduleSummary } from '#/features/campaigns/campaign-rules';

const props = defineProps<{ campaign: Campaign }>();
const emit = defineEmits<{
  edit: [];
  remove: [];
  run: [];
  'toggle': [value: boolean];
}>();

const store = useCampaignStore();

const status = computed(() => campaignStatus(props.campaign));
const invalidReason = computed(() => store.invalidReasonFor(props.campaign));
const running = computed(() => store.isRunning(props.campaign.id));
const statusLabel = computed(() => (status.value === 'active' ? '进行中' : status.value === 'paused' ? '已暂停' : '已过期，不再执行'));
const summary = computed(() => scheduleSummary(props.campaign));

const runDisabled = computed(() => status.value === 'expired' || Boolean(invalidReason.value) || running.value);

function onCommand(command: string) {
  if (command === 'run') {
    if (runDisabled.value) return;
    emit('run');
    return;
  }
  if (command === 'edit') emit('edit');
  if (command === 'remove' && !running.value) emit('remove');
}
</script>

<template>
  <article class="campaign-card">
    <div class="campaign-card-head">
      <h3 class="campaign-card-name">{{ campaign.name }}</h3>
      <div class="campaign-card-actions">
        <ElDropdown trigger="click" placement="bottom-end" @command="onCommand">
          <button class="campaign-icon-button" type="button" aria-label="更多操作">
            <QIcon name="more" :size="18" />
          </button>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem command="run" :disabled="runDisabled">
                {{ running ? '运行中' : '立即运行' }}
              </ElDropdownItem>
              <ElDropdownItem command="edit">编辑</ElDropdownItem>
              <ElDropdownItem command="remove" :disabled="running" divided>删除</ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </div>
      <ElSwitch
        :model-value="status === 'active'"
        :disabled="status === 'expired' || Boolean(invalidReason)"
        size="small"
        @change="(value: string | number | boolean) => emit('toggle', Boolean(value))"
      />
    </div>

    <p v-if="campaign.text" class="campaign-card-text" :title="campaign.text">{{ campaign.text }}</p>
    <p v-else-if="campaign.imageUrl" class="campaign-card-image-note">【图片】</p>

    <div class="campaign-card-info">
      <span class="campaign-card-meta" :title="summary">{{ summary }}</span>
      <ElTooltip v-if="invalidReason" :content="invalidReason" placement="top">
        <span class="campaign-card-warning" aria-label="配置已失效">!</span>
      </ElTooltip>
      <span class="campaign-status" :class="`is-${status}`">{{ statusLabel }}</span>
    </div>

  </article>
</template>
