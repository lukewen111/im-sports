<script setup lang="ts">
import type { CampaignRepeat, CampaignType } from '#/features/campaigns/campaign-data';
import type { CampaignInput } from '#/features/campaigns/campaign-store';

import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElButton, ElDatePicker, ElForm, ElFormItem, ElInput, ElMessage, ElOption, ElSelect, ElSwitch, ElTimePicker } from 'element-plus';
import QIcon from '#/components/q-icon/QIcon.vue';
import { CAMPAIGN_TEXT_MAX_LENGTH, CAMPAIGN_TIMEZONES, DEFAULT_CAMPAIGN_TIMEZONE, repeatMeta, weekdayLabels } from '#/features/campaigns/campaign-data';
import { countVisibleCharacters, truncateVisibleCharacters } from '#/features/channels/channel-data';
import { defaultOnceDate, zonedNow } from '#/features/campaigns/campaign-rules';
import { useCampaignStore } from '#/features/campaigns/campaign-store';
import { usePrototypeAccess } from '#/features/team/access-store';
import ChannelGlyph from '#/views/channels/ChannelGlyph.vue';

const props = defineProps<{ type: CampaignType; campaignId?: string }>();
const emit = defineEmits<{ cancel: []; saved: [] }>();

const store = useCampaignStore();
const access = usePrototypeAccess();
const router = useRouter();

const editing = computed(() => Boolean(props.campaignId));
const source = computed(() => {
  if (!props.campaignId) return undefined;
  return store.campaigns.find((item) => item.id === props.campaignId && item.type === props.type);
});
const missing = ref(false);

interface Draft {
  name: string;
  text: string;
  imageUrl?: string;
  imageName?: string;
  channelIds: string[];
  senderId: string;
  repeat: CampaignRepeat;
  date: string;
  weekdays: number[];
  monthDays: number[];
  time: string;
  timezone: string;
  enabled: boolean;
}

const draft = reactive<Draft>({
  name: '',
  text: '',
  imageUrl: undefined,
  imageName: undefined,
  channelIds: [],
  senderId: '',
  repeat: 'once',
  date: defaultOnceDate(),
  weekdays: [],
  monthDays: [],
  time: '10:00',
  timezone: access.current?.timezone && CAMPAIGN_TIMEZONES.includes(access.current.timezone) ? access.current.timezone : DEFAULT_CAMPAIGN_TIMEZONE,
  enabled: false,
});

const errors = reactive({ name: '', message: '', channel: '', sender: '', date: '', days: '', time: '', timezone: '' });
const fileInput = ref<HTMLInputElement>();
const saving = ref(false);
/** 与聊天侧一致的可见字符计数（emoji、组合字符按 1 个计） */
const textLength = computed(() => countVisibleCharacters(draft.text));

const isSdk = computed(() => props.type === 'sdk');
const channelOptions = computed(() => store.channelOptions(props.type));
const selectedChannels = computed(() => draft.channelIds.map((id) => store.channelOf(id)));
/** 已选但当前不可用的渠道（停用或删除），仅用于展示禁用标签 */
const invalidChannels = computed(() =>
  draft.channelIds
    .map((id, index) => ({ channel: selectedChannels.value[index], id }))
    .filter((item) => !item.channel || !item.channel.enabled),
);
/** 已选渠道的失效数量，提示只报个数不点名 */
const channelProblem = computed(() => {
  const disabled = selectedChannels.value.filter((channel) => channel && !channel.enabled).length;
  const missing = selectedChannels.value.filter((channel) => !channel).length;
  if (!disabled && !missing) return '';
  const parts: string[] = [];
  if (disabled) parts.push(`${disabled} 个已停用`);
  if (missing) parts.push(`${missing} 个已删除`);
  return `所选渠道中有 ${parts.join('、')}`;
});
const senderOptions = computed(() => store.senderOptions());
const senderUnavailable = computed(() => Boolean(draft.senderId) && !senderOptions.value.some((member) => member.id === draft.senderId));
const channelFieldError = computed(() => (channelProblem.value ? `${channelProblem.value}，请重新选择` : errors.channel));
const senderFieldError = computed(() => (senderUnavailable.value ? '当前发送者已失效，请重新选择' : errors.sender));
const sdkLimitReached = computed(() => props.type === 'sdk' && !props.campaignId && store.sdkCampaignCount >= 1);

function resetErrors() {
  Object.assign(errors, { name: '', message: '', channel: '', sender: '', date: '', days: '', time: '', timezone: '' });
}

function loadSource() {
  if (!props.campaignId) {
    missing.value = false;
    return;
  }
  const campaign = source.value;
  if (!campaign) {
    missing.value = true;
    return;
  }
  missing.value = false;
  Object.assign(draft, {
    name: campaign.name,
    text: campaign.text,
    imageUrl: campaign.imageUrl,
    imageName: campaign.imageName,
    channelIds: [...campaign.channelIds],
    senderId: campaign.senderId,
    repeat: campaign.repeat,
    date: campaign.date || defaultOnceDate(),
    weekdays: [...campaign.weekdays],
    monthDays: [...campaign.monthDays],
    time: campaign.time,
    timezone: campaign.timezone,
    enabled: campaign.enabled,
  });
}

loadSource();
watch(() => [props.campaignId, props.type], loadSource);

function toggleNumber(list: number[], value: number) {
  const index = list.indexOf(value);
  if (index === -1) list.push(value);
  else list.splice(index, 1);
}

function toggleWeekday(day: number) {
  toggleNumber(draft.weekdays, day);
}

function toggleMonthDay(day: number) {
  toggleNumber(draft.monthDays, day);
}

function pickImage() {
  fileInput.value?.click();
}

function clearImage() {
  draft.imageUrl = undefined;
  draft.imageName = undefined;
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    ElMessage.warning('仅支持 jpg、png、webp 格式的图片');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 2MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    draft.imageUrl = String(reader.result || '');
    draft.imageName = file.name;
  };
  reader.readAsDataURL(file);
}

function limitVisibleText(value: string) {
  return countVisibleCharacters(value) > CAMPAIGN_TEXT_MAX_LENGTH ? truncateVisibleCharacters(value, CAMPAIGN_TEXT_MAX_LENGTH) : value;
}

// 输入阶段按可见字符截断（不再用原生 maxlength，避免 emoji 被算成多个字符）
function onTextInput(value: string) {
  const limited = limitVisibleText(value);
  if (limited !== value) draft.text = limited;
}

function onTextPaste(event: Event) {
  const pasteEvent = event as ClipboardEvent;
  const pasted = pasteEvent.clipboardData?.getData('text') ?? '';
  const target = pasteEvent.target as HTMLTextAreaElement | null;
  if (!target) return;
  const start = target.selectionStart ?? draft.text.length;
  const end = target.selectionEnd ?? draft.text.length;
  const next = `${draft.text.slice(0, start)}${pasted}${draft.text.slice(end)}`;
  if (countVisibleCharacters(next) <= CAMPAIGN_TEXT_MAX_LENGTH) return;
  pasteEvent.preventDefault();
  draft.text = truncateVisibleCharacters(next, CAMPAIGN_TEXT_MAX_LENGTH);
  ElMessage.warning(`消息最多 ${CAMPAIGN_TEXT_MAX_LENGTH} 字，超出部分已截断`);
}

function disabledDate(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function validate() {
  resetErrors();
  if (!draft.name.trim()) errors.name = '请输入活动名称';
  if (textLength.value > CAMPAIGN_TEXT_MAX_LENGTH) errors.message = `消息不能超过 ${CAMPAIGN_TEXT_MAX_LENGTH} 字`;
  else if (!draft.text.trim() && !draft.imageUrl) errors.message = '消息与图片至少填写一项';
  if (!isSdk.value) {
    if (draft.channelIds.length === 0) errors.channel = '请选择渠道';
    else if (channelProblem.value) errors.channel = `${channelProblem.value}，请重新选择`;
  }
  if (!draft.senderId) errors.sender = '请选择发送者';
  else if (senderUnavailable.value) errors.sender = '当前发送者已失效，请重新选择';
  if (!draft.time) errors.time = '请选择发送时间';
  if (!draft.timezone) errors.timezone = '请选择时区';
  if (draft.repeat === 'once') {
    if (!draft.date) errors.date = '请选择发送日期';
    else {
      const now = zonedNow(draft.timezone);
      if (`${draft.date}T${draft.time || '00:00'}` <= `${now.date}T${now.time}`) errors.date = '单次活动的发送时间需晚于当前时间';
    }
  }
  if (draft.repeat === 'weekly' && draft.weekdays.length === 0) errors.days = '请至少选择一个星期';
  if (draft.repeat === 'monthly' && draft.monthDays.length === 0) errors.days = '请至少选择一个日期';
  return !Object.values(errors).some(Boolean);
}

function save() {
  if (props.campaignId && !source.value) {
    ElMessage.warning('活动不存在或已被删除');
    return;
  }
  if (sdkLimitReached.value) {
    ElMessage.warning('SDK 最多创建 1 个活动');
    return;
  }
  if (!access.canVisit('/campaigns')) {
    ElMessage.warning('活动权限已被收回，无法保存');
    void router.replace(access.home);
    return;
  }
  if (!validate()) return;
  saving.value = true;
  const payload: CampaignInput = {
    type: props.type,
    name: draft.name.trim(),
    text: draft.text.trim(),
    imageUrl: draft.imageUrl,
    imageName: draft.imageName,
    channelIds: isSdk.value ? [] : [...draft.channelIds],
    senderId: draft.senderId,
    repeat: draft.repeat,
    date: draft.repeat === 'once' ? draft.date : undefined,
    weekdays: draft.repeat === 'weekly' ? [...draft.weekdays].sort((a, b) => a - b) : [],
    monthDays: draft.repeat === 'monthly' ? [...draft.monthDays].sort((a, b) => a - b) : [],
    time: draft.time,
    timezone: draft.timezone,
    enabled: draft.enabled,
  };
  const result = editing.value ? store.update(props.campaignId!, payload) : store.create(payload);
  saving.value = false;
  if (result.error) {
    if (result.error.includes('名称')) errors.name = result.error;
    ElMessage.warning(result.error);
    return;
  }
  ElMessage.success(editing.value ? '活动已保存' : '活动已创建');
  emit('saved');
}
</script>

<template>
  <div class="campaigns-pane">
    <div v-if="missing" class="campaigns-scroll">
      <div class="ui-empty">
        <strong>活动不存在或已被删除</strong>
        <span>请返回活动列表后重试。</span>
        <ElButton class="ui-btn-outline" @click="emit('cancel')">返回活动列表</ElButton>
      </div>
    </div>

    <div v-else-if="sdkLimitReached" class="campaigns-scroll">
      <div class="ui-empty">
        <strong>SDK 最多创建 1 个活动</strong>
        <span>请先删除已有的 SDK 活动后再创建。</span>
        <ElButton class="ui-btn-outline" @click="emit('cancel')">返回活动列表</ElButton>
      </div>
    </div>

    <template v-else>
      <div class="campaigns-editor-scroll">
        <ElForm class="campaign-form ui-form" label-position="top" @submit.prevent>
          <section class="campaign-section">
            <h2 class="campaign-section-title">基础信息</h2>
            <ElFormItem label="活动名称" required :error="errors.name">
              <ElInput v-model="draft.name" placeholder="请输入活动名称" />
            </ElFormItem>
          </section>

          <section class="campaign-section">
            <h2 class="campaign-section-title">消息内容</h2>
            <ElFormItem class="campaign-message-item" label="消息" :error="errors.message">
              <ElInput
                v-model="draft.text"
                type="textarea"
                :autosize="{ minRows: 4, maxRows: 8 }"
                placeholder="输入要发送给客户的文本消息"
                @input="onTextInput"
                @paste="onTextPaste"
              />
              <div class="campaign-message-meta">
                <p class="campaign-field-hint">正在聊天中的客户将不会收到此消息。</p>
                <span class="campaign-message-count" :class="{ 'is-over': textLength > CAMPAIGN_TEXT_MAX_LENGTH }">
                  已输入 {{ textLength }} / {{ CAMPAIGN_TEXT_MAX_LENGTH }}
                </span>
              </div>
            </ElFormItem>
            <ElFormItem label="图片">
              <div class="campaign-cover">
                <div v-if="draft.imageUrl" class="campaign-cover-preview">
                  <img :src="draft.imageUrl" :alt="draft.imageName || '活动图片'" />
                  <div class="campaign-cover-actions">
                    <button class="campaign-cover-action" type="button" aria-label="更换图片" title="更换图片" @click="pickImage">
                      <QIcon name="image" :size="16" />
                    </button>
                    <button class="campaign-cover-action" type="button" aria-label="删除图片" title="删除图片" @click="clearImage">
                      <QIcon name="trash" :size="16" />
                    </button>
                  </div>
                </div>
                <button v-else class="campaign-cover-add" type="button" @click="pickImage">
                  <QIcon name="plus" :size="20" />
                  <span>添加图片</span>
                </button>
                <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onFileChange" />
              </div>
              <p class="campaign-field-hint">最多 1 张，支持 jpg、png、webp，单张不超过 2MB</p>
            </ElFormItem>
          </section>

          <section class="campaign-section">
            <h2 class="campaign-section-title">发送设置</h2>
            <div class="campaign-form-row" :class="{ 'is-single': isSdk }">
              <ElFormItem v-if="!isSdk" label="选择渠道" required :error="channelFieldError">
                <ElSelect
                  v-model="draft.channelIds"
                  multiple
                  placeholder="请选择渠道"
                  popper-class="campaign-channel-select-popper"
                >
                  <ElOption v-for="item in invalidChannels" :key="`invalid-${item.id}`" :label="item.channel?.name || '已删除的渠道'" :value="item.id" disabled />
                  <ElOption v-for="channel in channelOptions" :key="channel.id" :label="channel.name" :value="channel.id">
                    <span class="campaign-channel-option">
                      <ChannelGlyph :type="channel.type" :size="18" />
                      <span class="campaign-channel-option-name">{{ channel.name }}</span>
                    </span>
                  </ElOption>
                </ElSelect>
                <p v-if="channelOptions.length === 0" class="campaign-field-hint">当前渠道类型下暂无已启用渠道，请先在渠道管理中启用。</p>
              </ElFormItem>
              <ElFormItem label="发送者" required :error="senderFieldError">
                <ElSelect v-model="draft.senderId" placeholder="请选择发送者">
                  <ElOption v-if="senderUnavailable" label="已失效的发送者" :value="draft.senderId" disabled />
                  <ElOption v-for="member in senderOptions" :key="member.id" :label="member.kind === 'ai' ? `${member.name}（AI 成员）` : member.name" :value="member.id" />
                </ElSelect>
                <p v-if="senderOptions.length === 0" class="campaign-field-hint">暂无已启用的成员。</p>
              </ElFormItem>
            </div>
          </section>

          <section class="campaign-section">
            <h2 class="campaign-section-title">触发时间</h2>
            <ElFormItem label="重复" required>
              <ElSelect v-model="draft.repeat">
                <ElOption v-for="(label, key) in repeatMeta" :key="key" :label="label" :value="key" />
              </ElSelect>
            </ElFormItem>

            <ElFormItem v-if="draft.repeat === 'weekly'" label="选择星期" required :error="errors.days">
              <div class="campaign-chip-group">
                <button
                  v-for="(label, index) in weekdayLabels"
                  :key="label"
                  type="button"
                  class="campaign-chip"
                  :class="{ 'is-active': draft.weekdays.includes(index + 1) }"
                  @click="toggleWeekday(index + 1)"
                >
                  {{ label }}
                </button>
              </div>
            </ElFormItem>

            <ElFormItem v-if="draft.repeat === 'monthly'" label="选择日期" required :error="errors.days">
              <div class="campaign-chip-group">
                <button
                  v-for="day in 31"
                  :key="day"
                  type="button"
                  class="campaign-chip"
                  :class="{ 'is-active': draft.monthDays.includes(day) }"
                  @click="toggleMonthDay(day)"
                >
                  {{ day }}
                </button>
              </div>
              <p class="campaign-field-hint">不存在的日期（如 2 月 30 日）会自动跳过。</p>
            </ElFormItem>

            <ElFormItem :label="draft.repeat === 'once' ? '发送时间' : '发送时分'" required :error="errors.date || errors.time">
              <div class="campaign-time-row">
                <ElDatePicker
                  v-if="draft.repeat === 'once'"
                  v-model="draft.date"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="选择日期"
                  :disabled-date="disabledDate"
                />
                <ElTimePicker v-model="draft.time" type="time" format="HH:mm" value-format="HH:mm" placeholder="选择时间" :clearable="false" />
              </div>
            </ElFormItem>

            <ElFormItem label="时区" required :error="errors.timezone">
              <ElSelect v-model="draft.timezone">
                <ElOption v-for="zone in CAMPAIGN_TIMEZONES" :key="zone" :label="zone" :value="zone" />
              </ElSelect>
            </ElFormItem>
          </section>

          <section class="campaign-section">
            <div class="campaign-enable-row">
              <h2 class="campaign-section-title">启用</h2>
              <ElSwitch v-model="draft.enabled" />
            </div>
          </section>
        </ElForm>
      </div>

      <div class="campaign-form-actions">
        <ElButton class="ui-btn-outline" @click="emit('cancel')">取消</ElButton>
        <ElButton type="primary" class="ui-btn-primary" :loading="saving" @click="save">
          <QIcon name="check" :size="16" />
          保存
        </ElButton>
      </div>
    </template>
  </div>
</template>
