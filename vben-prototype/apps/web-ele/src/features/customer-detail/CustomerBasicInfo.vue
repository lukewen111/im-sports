<script setup lang="ts">
import type { DemoCustomer } from '#/features/service/demo-store';

import { computed, nextTick, ref } from 'vue';
import { ElButton, ElInput, ElMessage } from 'element-plus';

import { resolveProfileIdentity } from '#/views/personal/profile-identity';

import IconSlot from './IconSlot.vue';
import { detailIcons as icons } from './icons';
import type { EditableField } from './useCustomerDetail';
import { useCustomerDetail } from './useCustomerDetail';

const props = defineProps<{
  customer: DemoCustomer;
  editable: boolean;
}>();

const hook = useCustomerDetail();

const identity = computed(() => resolveProfileIdentity({
  avatar: props.customer.avatar,
  id: props.customer.id,
  name: props.customer.name,
}));
const avatarStyle = computed(() => ({ backgroundColor: identity.value.avatarColor, color: '#fff' }));

const fields = computed(() => [
  { icon: icons.note, key: 'remark' as EditableField, label: '备注名', placeholder: '—', value: props.customer.remark },
  { icon: icons.email, key: 'email' as EditableField, label: '邮箱', placeholder: '—', value: props.customer.email },
  { icon: icons.phone, key: 'phone' as EditableField, label: '手机号', placeholder: '—', value: props.customer.phone },
]);

const editing = ref<EditableField>();
const draft = ref('');
const error = ref('');
const root = ref<HTMLElement>();

function focusInput() {
  nextTick(() => root.value?.querySelector<HTMLInputElement>('.field-input input')?.focus());
}

function displayValue(field: { value: string }) {
  return field.value || '—';
}

function activate(key: EditableField) {
  if (!props.editable) return;
  if (editing.value === key) {
    focusInput();
    return;
  }
  if (editing.value) {
    commit();
    // 上一个字段校验未通过时保持原位编辑，不切换
    if (editing.value) return;
  }
  editing.value = key;
  error.value = '';
  draft.value = props.customer[key] || '';
  focusInput();
}

function commit() {
  const key = editing.value;
  if (!key) return;
  const original = (props.customer[key] || '').trim();
  const value = draft.value.trim();
  if (value === original) {
    editing.value = undefined;
    error.value = '';
    return;
  }
  const message = hook.validateField(key, value);
  if (message) {
    error.value = message;
    return;
  }
  const failed = hook.saveField(props.customer, key, value);
  if (failed) {
    error.value = failed;
    return;
  }
  editing.value = undefined;
  error.value = '';
  ElMessage.success('客户资料已保存');
}

function cancel() {
  draft.value = '';
  editing.value = undefined;
  error.value = '';
}

function copyId() {
  void hook.copyText(props.customer.id, '客户 ID');
}
</script>

<template>
  <div ref="root" class="basic-info">
    <div class="identity">
      <i class="avatar" :style="avatarStyle">
        <img v-if="identity.avatarUrl" :src="identity.avatarUrl" alt="" />
        <template v-else>{{ identity.initial }}</template>
      </i>
      <div class="identity-main">
        <div class="name-row">
          <span class="field-label">客户名称</span>
          <b class="name">{{ customer.name || '—' }}</b>
        </div>
        <div class="id-line">
          <span class="field-label">客户 ID</span>
          <span class="id">{{ customer.id }}</span>
          <ElButton link class="copy-button" aria-label="复制客户 ID" @click="copyId">
            <component :is="icons.copy" :size="13" />
          </ElButton>
        </div>
      </div>
    </div>

    <div class="fields">
      <div v-for="field in fields" :key="field.key" class="field-item">
        <div
          class="field-row"
          :class="{ 'is-editable': editable, 'is-editing': editing === field.key }"
          @click="activate(field.key)"
        >
          <IconSlot>
            <component :is="field.icon" :size="14" class="field-icon" />
          </IconSlot>
          <span class="field-label">{{ field.label }}</span>
          <div class="field-value-wrap">
            <ElInput
              v-if="editing === field.key"
              v-model="draft"
              class="field-input"
              :placeholder="field.placeholder"
              @blur="commit"
              @keydown.enter.prevent="commit"
              @keydown.esc.prevent="cancel"
            >
              <template #prefix>
                <component :is="field.icon" :size="13" />
              </template>
            </ElInput>
            <template v-else>
              <span class="field-value" :class="{ 'is-empty': !field.value }">{{ displayValue(field) }}</span>
              <component :is="icons.pencil" v-if="editable" :size="13" class="edit-icon" />
            </template>
          </div>
        </div>
        <p v-if="editing === field.key && error" class="field-error">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.basic-info {
  display: grid;
  gap: 12px;
}
.identity {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}
.avatar {
  display: grid;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  place-items: center;
  overflow: hidden;
  font-size: 15px;
  font-style: normal;
  font-weight: 600;
  border-radius: 50%;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.identity-main {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  min-width: 0;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  color: #131317;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* 字段文字标签：与各区块字段名同档（12px / #8C8C8E），值固定落在右列 */
.field-label {
  flex: 0 0 84px;
  overflow: hidden;
  font-size: 12px;
  color: #8c8c8e;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.name-row .field-label {
  flex: 0 0 auto;
  overflow: visible;
}
.id-line {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-width: 0;
  margin-top: 3px;
}
.id {
  overflow: hidden;
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 11px;
  color: #8c8c8e;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.copy-button {
  flex: 0 0 auto;
  height: 18px;
  padding: 0 2px;
  color: #8c8c8e;
}
.copy-button:hover {
  color: #131317;
  background: transparent;
}

.fields {
  display: grid;
  gap: 2px;
}
.field-item {
  min-width: 0;
}
.field-row {
  display: grid;
  grid-template-columns: 20px 84px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 34px;
  padding: 3px 8px;
  margin: 0 -8px;
  border-radius: 8px;
}
.field-row.is-editable {
  cursor: pointer;
}
.field-row.is-editable:hover {
  background: #f5f5f5;
}
.field-row.is-editing {
  background: transparent;
}
.field-row.is-editing .field-icon {
  display: none;
}
.field-icon {
  color: #8c8c8e;
}
.field-value-wrap {
  display: flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
}
.field-value {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  color: #131317;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.field-value.is-empty {
  color: #8c8c8e;
}
.edit-icon {
  flex: 0 0 auto;
  color: #8c8c8e;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.field-row.is-editable:hover .edit-icon {
  opacity: 1;
}
.field-input {
  width: 100%;
  min-width: 0;
}
.field-input :deep(.el-input__wrapper) {
  min-height: 32px;
  padding: 0 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #c9c9cd inset;
}
.field-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #131317 inset;
}
.field-input :deep(.el-input__inner) {
  font-size: 13px;
  color: #131317;
}
.field-error {
  margin: 2px 0 4px;
  padding-left: 120px;
  color: #ca0005;
  font-size: 11px;
  line-height: 1.4;
}
</style>
