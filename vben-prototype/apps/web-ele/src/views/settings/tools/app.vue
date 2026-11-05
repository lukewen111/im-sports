<script setup lang="ts">
import { computed } from 'vue';
import { ElOption, ElSelect, ElSwitch } from 'element-plus';

import { useDemoServiceStore } from '#/features/service/demo-store';
import { usePrototypeAccess } from '#/features/team/access-store';

import PageShell from '../page-shell.vue';

const LANGUAGES = ['简体中文', '繁体中文', '英语', '越南语', '泰语', '高棉语', '缅甸语', '老挝语', '西班牙语'];

const access = usePrototypeAccess();
const store = useDemoServiceStore();
const member = computed(() => access.current);
const canAccess = computed(() => Boolean(access.permissions.settings));
const memberId = computed(() => access.current?.id || access.currentId);

const settings = computed(() => store.memberTranslationFor(memberId.value));

function setReceiveTranslation(value: string | number | boolean) {
  store.setMemberTranslation(memberId.value, { receiveTranslation: Boolean(value) });
}

function setSendTranslation(value: string | number | boolean) {
  store.setMemberTranslation(memberId.value, { sendTranslation: Boolean(value) });
}

function setWorkLanguage(value: string) {
  store.setMemberTranslation(memberId.value, { workLanguage: value });
}

function setVisitorLanguage(value: string) {
  store.setMemberTranslation(memberId.value, { visitorLanguage: value });
}
</script>

<template>
  <PageShell
    :can-access="canAccess"
    :member-name="member?.name"
    title="翻译设置"
  >
    <section class="settings-card">
      <div class="setting-list">
        <div class="setting-row">
          <div class="row-line">
            <span class="row-title">接收消息自动翻译</span>
            <ElSwitch
              :model-value="settings.receiveTranslation"
              aria-label="接收消息自动翻译"
              @change="setReceiveTranslation"
            />
          </div>
          <p class="row-desc">
            开启后，自动把访客消息翻成成员工作语言；关闭时显示原文，可手动触发翻译。
          </p>
        </div>

        <div class="setting-row">
          <div class="row-line">
            <span class="row-title">发送消息自动翻译</span>
            <ElSwitch
              :model-value="settings.sendTranslation"
              aria-label="发送消息自动翻译"
              @change="setSendTranslation"
            />
          </div>
          <p class="row-desc">
            开启后，输入框上方出现边写边译预览，成员可把译文回填到输入框，核对修改后再发送。
          </p>
        </div>

        <div class="setting-row">
          <div class="row-line">
            <span class="row-title">成员工作语言</span>
          </div>
          <p class="row-desc">接收翻译的目标语言，把访客消息翻成这个语言给成员看。</p>
          <ElSelect
            class="language-select"
            :model-value="settings.workLanguage"
            aria-label="成员工作语言"
            @change="setWorkLanguage"
          >
            <ElOption v-for="language in LANGUAGES" :key="language" :label="language" :value="language" />
          </ElSelect>
        </div>

        <div class="setting-row">
          <div class="row-line">
            <span class="row-title">访客默认语言</span>
          </div>
          <p class="row-desc">发送翻译的默认目标语言，把成员消息翻成这个语言发给访客。</p>
          <ElSelect
            class="language-select"
            :model-value="settings.visitorLanguage"
            aria-label="访客默认语言"
            @change="setVisitorLanguage"
          >
            <ElOption v-for="language in LANGUAGES" :key="language" :label="language" :value="language" />
          </ElSelect>
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

.setting-row {
  padding: 16px 20px;
}

.setting-row + .setting-row {
  border-top: 1px solid #ececed;
}

.row-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.row-title {
  color: var(--ui-ink);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}

.row-desc {
  max-width: 780px;
  margin: 5px 0 0;
  color: var(--ui-ink-muted);
  font-size: 12px;
  line-height: 1.6;
}

.language-select {
  width: 100%;
  max-width: 360px;
  margin-top: 12px;
}

.language-select :deep(.el-select__wrapper) {
  min-height: var(--ui-control-height);
  border-radius: var(--ui-radius-control);
  box-shadow: 0 0 0 1px var(--ui-control-line) inset;
}
</style>
