<script setup lang="ts">
import { computed } from 'vue';

import { ElOption, ElSelect, ElSwitch } from 'element-plus';

import { useDemoServiceStore } from '#/features/service/demo-store';
import { usePrototypeAccess } from '#/features/team/access-store';

const LANGUAGES = ['简体中文', '繁体中文', '英语', '越南语', '泰语', '高棉语', '缅甸语', '老挝语', '西班牙语'];

const access = usePrototypeAccess();
const store = useDemoServiceStore();
const memberId = computed(() => access.current?.id || access.currentId);

const settings = computed(() => store.memberTranslationFor(memberId.value));

function setReceiveTranslation(value: boolean | number | string) {
  store.setMemberTranslation(memberId.value, { receiveTranslation: Boolean(value) });
}

function setSendTranslation(value: boolean | number | string) {
  store.setMemberTranslation(memberId.value, { sendTranslation: Boolean(value) });
}

function setDisplayMode(value: 'bilingual' | 'translation-only') {
  store.setMemberTranslation(memberId.value, { displayMode: value });
}

function setWorkLanguage(value: string) {
  store.setMemberTranslation(memberId.value, { workLanguage: value });
}

function setVisitorLanguage(value: string) {
  store.setMemberTranslation(memberId.value, { visitorLanguage: value });
}
</script>

<template>
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
            <span class="row-title">翻译后的显示效果</span>
          </div>
          <div class="display-options" role="radiogroup" aria-label="翻译后的显示效果">
            <button
              type="button"
              role="radio"
              class="display-card"
              :class="{ 'is-selected': settings.displayMode === 'bilingual' }"
              :aria-checked="settings.displayMode === 'bilingual'"
              @click="setDisplayMode('bilingual')"
            >
              <div class="display-preview">
                <span class="display-avatar">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M3.4 10.6a6.6 6.6 0 0 1 13.2 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    <rect x="2.8" y="10" width="3.4" height="5.8" rx="1.5" stroke="currentColor" stroke-width="1.5" />
                    <rect x="13.8" y="10" width="3.4" height="5.8" rx="1.5" stroke="currentColor" stroke-width="1.5" />
                    <path d="M15.5 15.8v.5a2 2 0 0 1-2 2h-2.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  </svg>
                </span>
                <div class="display-bubble">
                  <span class="display-line">Hello, my friend</span>
                  <span class="display-line is-translation">你好，朋友</span>
                </div>
              </div>
              <div class="display-option">
                <span class="display-radio"></span>
                <span>显示原文和译文</span>
              </div>
            </button>

            <button
              type="button"
              role="radio"
              class="display-card"
              :class="{ 'is-selected': settings.displayMode === 'translation-only' }"
              :aria-checked="settings.displayMode === 'translation-only'"
              @click="setDisplayMode('translation-only')"
            >
              <div class="display-preview">
                <span class="display-avatar">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M3.4 10.6a6.6 6.6 0 0 1 13.2 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    <rect x="2.8" y="10" width="3.4" height="5.8" rx="1.5" stroke="currentColor" stroke-width="1.5" />
                    <rect x="13.8" y="10" width="3.4" height="5.8" rx="1.5" stroke="currentColor" stroke-width="1.5" />
                    <path d="M15.5 15.8v.5a2 2 0 0 1-2 2h-2.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  </svg>
                </span>
                <div class="display-bubble">
                  <span class="display-line">你好，朋友</span>
                </div>
              </div>
              <div class="display-option">
                <span class="display-radio"></span>
                <span>仅显示译文</span>
              </div>
            </button>
          </div>
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

/* ---------- 翻译后的显示效果：两张并排单选卡 ---------- */
.display-options {
  display: flex;
  gap: 24px;
  margin-top: 12px;
}

.display-card {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-width: 300px;
  max-width: 456px;
  padding: 0;
  overflow: hidden;
  font: inherit;
  text-align: left;
  cursor: pointer;
  background: #ffffff;
  border: 1px solid #e3e3e5;
  border-radius: 12px;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.display-card:hover {
  background: #fafafb;
}

.display-card.is-selected {
  background: #edf3ff;
  border-color: #d5e3fb;
}

.display-card.is-selected:hover {
  background: #edf3ff;
}

/* 选中卡：预览气泡与头像圆底改白，用 1px 内描边与蓝底区分；图标保持品牌蓝 */
.display-card.is-selected .display-bubble {
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e3e3e5;
}

.display-card.is-selected .display-avatar {
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e3e3e5;
}

.display-card:focus-visible {
  outline: 2px solid #003fa4;
  outline-offset: 2px;
}

.display-preview {
  display: flex;
  flex: 1 1 auto;
  gap: 12px;
  align-items: flex-start;
  min-height: 112px;
  padding: 16px 20px;
}

.display-avatar {
  display: grid;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  place-items: center;
  color: #003fa4;
  background: #f5f5f6;
  border-radius: 50%;
}

.display-bubble {
  max-width: 224px;
  padding: 10px 14px;
  color: #131317;
  font-size: 14px;
  line-height: 20px;
  background: #f2f2f3;
  border-radius: 10px;
}

.display-line {
  display: block;
}

.display-line.is-translation {
  padding-top: 8px;
  margin-top: 8px;
  border-top: 1px solid #e3e3e5;
}

.display-option {
  display: flex;
  gap: 10px;
  align-items: center;
  height: 52px;
  padding: 0 16px;
  color: #131317;
  font-size: 14px;
  font-weight: 400;
  border-top: 1px solid #ececed;
}

.display-card.is-selected .display-option {
  font-weight: 500;
  border-top-color: #dde6fa;
}

.display-radio {
  position: relative;
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  background: #ffffff;
  border: 1px solid #d0d0d5;
  border-radius: 50%;
}

.display-card.is-selected .display-radio {
  background: #003fa4;
  border-color: #003fa4;
}

.display-card.is-selected .display-radio::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  content: '';
  background: #ffffff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

@media (max-width: 720px) {
  .display-options {
    flex-direction: column;
    gap: 12px;
  }

  .display-card {
    max-width: none;
  }
}
</style>
