<script setup lang="ts">
// 顶栏浮层接入点：layouts/basic.vue 的 #user-dropdown 插槽渲染本组件，并监听 @logout。
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { loadLocaleMessages } from '@vben/locales';
import { updatePreferences } from '@vben/preferences';

import { ElMessage } from 'element-plus';

import QIcon from '#/components/q-icon/QIcon.vue';
import { useDemoServiceStore } from '#/features/service/demo-store';
import { interfaceMessageLocale, INTERFACE_LANGUAGES as LANGUAGE_LABELS, type InterfaceLocale as SupportedLocale } from '#/features/service/interface-locale';

import { useProfileIdentity } from './profile-identity';

const emit = defineEmits<{ logout: [] }>();

const COPY = {
  'zh-CN': {
    acceptChat: '接受聊天',
    online: '在线',
    offline: '离线',
    language: '界面语言',
    timezone: '时区',
    profile: '个人资料',
    logout: '退出登录',
    onlineOn: '已上线，将参与新会话分配',
    onlineOff: '已离线，停止接收新会话',
    localeSaved: '界面语言已切换',
    localeFailed: '界面语言保存失败，请重试',
    timezoneSaved: '时区已保存',
  },
  'en-US': {
    acceptChat: 'Accept chats',
    online: 'Online',
    offline: 'Offline',
    language: 'Interface language',
    timezone: 'Time zone',
    profile: 'Personal profile',
    logout: 'Log out',
    onlineOn: 'You are online and can receive new sessions',
    onlineOff: 'You are offline and will not receive new sessions',
    localeSaved: 'Interface language updated',
    localeFailed: 'Failed to save the interface language. Please retry.',
    timezoneSaved: 'Time zone saved',
  },
} as const;


const store = useDemoServiceStore();
const identity = useProfileIdentity();
const router = useRouter();

const TIMEZONE_LABELS = {
  'UTC-12:00': 'UTC-12:00 贝克岛',
  'UTC-11:00': 'UTC-11:00 美属萨摩亚',
  'UTC-10:00': 'UTC-10:00 夏威夷',
  'UTC-09:00': 'UTC-09:00 阿拉斯加',
  'UTC-08:00': 'UTC-08:00 太平洋时间（美国和加拿大）',
  'UTC-07:00': 'UTC-07:00 山地时间（美国和加拿大）',
  'UTC-06:00': 'UTC-06:00 中部时间（美国和加拿大）',
  'UTC-05:00': 'UTC-05:00 东部时间（美国和加拿大）',
  'UTC-04:00': 'UTC-04:00 大西洋时间（加拿大）',
  'UTC-03:00': 'UTC-03:00 巴西利亚',
  'UTC-02:00': 'UTC-02:00 中大西洋',
  'UTC-01:00': 'UTC-01:00 亚速尔群岛',
  'UTC+00:00': 'UTC+00:00 格林尼治标准时间',
  'UTC+01:00': 'UTC+01:00 中欧时间',
  'UTC+02:00': 'UTC+02:00 东欧时间',
  'UTC+03:00': 'UTC+03:00 莫斯科时间',
  'UTC+04:00': 'UTC+04:00 海湾标准时间',
  'UTC+05:00': 'UTC+05:00 巴基斯坦标准时间',
  'UTC+05:30': 'UTC+05:30 印度标准时间',
  'UTC+06:00': 'UTC+06:00 孟加拉国标准时间',
  'UTC+07:00': 'UTC+07:00 中南半岛时间',
  'UTC+08:00': 'UTC+08:00 北京时间',
  'UTC+09:00': 'UTC+09:00 日本标准时间',
  'UTC+10:00': 'UTC+10:00 澳大利亚东部时间',
  'UTC+11:00': 'UTC+11:00 所罗门群岛时间',
  'UTC+12:00': 'UTC+12:00 新西兰标准时间',
  'UTC+13:00': 'UTC+13:00 萨摩亚时间',
  'UTC+14:00': 'UTC+14:00 莱恩群岛时间',
} as const;
type SupportedTimezone = keyof typeof TIMEZONE_LABELS;

const open = ref(false);
const languageOpen = ref(false);
const timezoneOpen = ref(false);
const savingLocale = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const timezoneTriggerRef = ref<HTMLElement | null>(null);
const timezonePanelRef = ref<HTMLElement | null>(null);
const position = reactive({ right: 8, top: 56 });
const timezonePosition = reactive({ left: 8, top: 56 });

const member = computed(() => identity.value.member);
const locale = computed<SupportedLocale>(() => (member.value ? store.settingsFor(member.value.id).locale : 'zh-CN'));
const timezone = computed<SupportedTimezone>(() => {
  const value = member.value ? store.settingsFor(member.value.id).timezone : 'UTC+08:00';
  return value in TIMEZONE_LABELS ? value as SupportedTimezone : 'UTC+08:00';
});
const t = computed(() => COPY[interfaceMessageLocale(locale.value)]);
const online = computed(() => Boolean(member.value?.online));
const username = computed(() => {
  const account = member.value?.account || '';
  if (!account) return '—';
  return `@${account.split('@')[0] || account}`;
});

function updatePosition() {
  const rect = triggerRef.value?.getBoundingClientRect();
  if (!rect) return;
  position.top = rect.bottom + 8;
  position.right = Math.max(8, window.innerWidth - rect.right);
}

function updateTimezonePosition() {
  const rect = timezoneTriggerRef.value?.getBoundingClientRect();
  if (!rect) return;
  const menuRect = panelRef.value?.getBoundingClientRect();
  const panelWidth = Math.min(360, window.innerWidth - 16);
  const panelHeight = timezonePanelRef.value?.offsetHeight || 480;
  const gap = 8;
  const preferredLeft = (menuRect?.left ?? rect.left) - panelWidth - gap;
  timezonePosition.left = preferredLeft >= 8
    ? preferredLeft
    : Math.min(window.innerWidth - panelWidth - 8, (menuRect?.right ?? rect.right) + gap);
  timezonePosition.top = Math.min(
    Math.max(8, rect.top - 6),
    Math.max(8, window.innerHeight - panelHeight - 8),
  );
}

function toggleMenu() {
  open.value = !open.value;
  if (open.value) {
    languageOpen.value = false;
    timezoneOpen.value = false;
    updatePosition();
  }
}

function closeMenu() {
  open.value = false;
  languageOpen.value = false;
  timezoneOpen.value = false;
}

function onDocumentPointer(event: MouseEvent) {
  if (!open.value) return;
  const target = event.target as Node;
  if (
    triggerRef.value?.contains(target)
    || panelRef.value?.contains(target)
    || timezonePanelRef.value?.contains(target)
  ) return;
  closeMenu();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return;
  if (timezoneOpen.value) {
    timezoneOpen.value = false;
    timezoneTriggerRef.value?.focus();
    return;
  }
  closeMenu();
}

function onViewportChange() {
  if (!open.value) return;
  updatePosition();
  if (timezoneOpen.value) updateTimezonePosition();
}

function toggleAccepting() {
  if (!member.value) return;
  const next = !online.value;
  store.savePersonal(member.value.id, { accepting: next });
  if (Boolean(member.value.online) !== next) {
    ElMessage.error(interfaceMessageLocale(locale.value) === 'zh-CN' ? '状态切换失败，请重试' : 'Failed to switch status. Please retry.');
    return;
  }
  ElMessage.success(next ? t.value.onlineOn : t.value.onlineOff);
}

function toggleLanguage() {
  languageOpen.value = !languageOpen.value;
  timezoneOpen.value = false;
}

function toggleTimezone() {
  timezoneOpen.value = !timezoneOpen.value;
  languageOpen.value = false;
  if (timezoneOpen.value) void nextTick(updateTimezonePosition);
}

function selectTimezone(value: string) {
  if (!member.value) return;
  if (!(value in TIMEZONE_LABELS)) return;
  store.savePersonal(member.value.id, { timezone: value as SupportedTimezone });
  timezoneOpen.value = false;
  ElMessage.success(t.value.timezoneSaved);
}

function openProfile() {
  closeMenu();
  void router.push('/personal');
}

async function selectLocale(value: SupportedLocale) {
  if (savingLocale.value) return;
  if (!member.value || value === locale.value) {
    languageOpen.value = false;
    return;
  }
  const previous = store.settingsFor(member.value.id).locale;
  const memberId = member.value.id;
  savingLocale.value = true;
  try {
    await loadLocaleMessages(interfaceMessageLocale(value));
    updatePreferences({ app: { locale: interfaceMessageLocale(value) } });
    store.savePersonal(memberId, { locale: value });
    ElMessage.success(COPY[interfaceMessageLocale(value)].localeSaved);
  } catch {
    store.savePersonal(memberId, { locale: previous });
    updatePreferences({ app: { locale: interfaceMessageLocale(previous) } });
    await loadLocaleMessages(interfaceMessageLocale(previous)).catch(() => {});
    ElMessage.error(COPY[interfaceMessageLocale(previous)].localeFailed);
  } finally {
    savingLocale.value = false;
  }
  languageOpen.value = false;
}

function logout() {
  if (member.value) store.savePersonal(member.value.id, { accepting: false });
  closeMenu();
  emit('logout');
}

watch(() => member.value?.id, async () => {
  const restored = interfaceMessageLocale(locale.value);
  try {
    await loadLocaleMessages(restored);
    updatePreferences({ app: { locale: restored } });
  } catch {
    ElMessage.error(t.value.localeFailed);
  }
}, { immediate: true });

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointer);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('scroll', onViewportChange, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointer);
  document.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('scroll', onViewportChange, true);
});
</script>

<template>
  <div class="user-menu">
    <button
      ref="triggerRef"
      type="button"
      class="menu-trigger"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="identity.displayName"
      @click="toggleMenu"
    >
      <span class="trigger-avatar" :style="{ backgroundColor: identity.avatarColor }">
        <img v-if="identity.avatarUrl" :src="identity.avatarUrl" alt="" />
        <span v-else>{{ identity.initial }}</span>
      </span>
      <i class="trigger-dot" :class="{ 'is-off': !online }"></i>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="menu-panel"
        role="menu"
        :style="{ top: `${position.top}px`, right: `${position.right}px`, maxHeight: `calc(100dvh - ${position.top + 8}px)`, overflowY: 'auto' }"
      >
        <header class="panel-head">
          <span class="head-avatar" :style="{ backgroundColor: identity.avatarColor }">
            <img v-if="identity.avatarUrl" :src="identity.avatarUrl" alt="" />
            <span v-else>{{ identity.initial }}</span>
          </span>
          <div class="head-copy">
            <strong>{{ identity.displayName }}</strong>
            <small>{{ username }}</small>
          </div>
        </header>

        <div class="panel-group">
          <div class="menu-row">
            <span class="row-label">{{ t.acceptChat }}</span>
            <div class="row-tail">
              <button
                type="button"
                class="toggle"
                :class="{ 'is-on': online }"
                role="switch"
                :aria-checked="online"
                :aria-label="t.acceptChat"
                :disabled="!member"
                @click="toggleAccepting"
              >
                <i></i>
              </button>
            </div>
          </div>
        </div>

        <div class="panel-group">
          <button
            type="button"
            class="menu-row is-clickable"
            :aria-expanded="languageOpen"
            @click="toggleLanguage"
          >
            <span class="row-label">{{ t.language }}</span>
            <span class="row-tail">
              <span class="row-value">{{ LANGUAGE_LABELS[locale] }}</span>
              <QIcon class="row-icon" :class="{ 'is-open': languageOpen }" name="chevron-right" :size="16" />
            </span>
          </button>
          <template v-if="languageOpen">
            <button
              v-for="item in (Object.keys(LANGUAGE_LABELS) as SupportedLocale[])"
              :key="item"
              type="button"
              class="menu-row language-option"
              :disabled="savingLocale"
              role="menuitemradio"
              :aria-checked="locale === item"
              @click="selectLocale(item)"
            >
              <span class="row-label">{{ LANGUAGE_LABELS[item] }}</span>
              <QIcon v-if="locale === item" class="check-icon" name="check" :size="16" />
            </button>
          </template>

          <button
            ref="timezoneTriggerRef"
            type="button"
            class="menu-row is-clickable"
            :aria-expanded="timezoneOpen"
            aria-haspopup="menu"
            @click="toggleTimezone"
          >
            <span class="row-label">{{ t.timezone }}</span>
            <span class="row-tail">
              <span class="row-value">{{ TIMEZONE_LABELS[timezone] }}</span>
              <QIcon class="row-icon" :class="{ 'is-open': timezoneOpen }" name="chevron-right" :size="16" />
            </span>
          </button>
          <button type="button" class="menu-row is-clickable" role="menuitem" @click="openProfile">
            <span class="row-label">{{ t.profile }}</span>
            <QIcon class="row-icon" name="chevron-right" :size="16" />
          </button>
        </div>

        <button type="button" class="logout-row" role="menuitem" @click="logout">
          <span class="row-label">{{ t.logout }}</span>
          <QIcon class="power-icon" name="power" :size="18" />
        </button>
      </div>

      <div
        v-if="open && timezoneOpen"
        ref="timezonePanelRef"
        class="timezone-popover"
        role="menu"
        :aria-label="t.timezone"
        :style="{ top: `${timezonePosition.top}px`, left: `${timezonePosition.left}px` }"
      >
        <button
          v-for="(label, value) in TIMEZONE_LABELS"
          :key="value"
          type="button"
          class="timezone-option"
          role="menuitemradio"
          :aria-checked="timezone === value"
          @click="selectTimezone(value)"
        >
          <span>{{ label }}</span>
          <QIcon v-if="timezone === value" class="check-icon" name="check" :size="16" />
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.user-menu {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.menu-trigger {
  position: relative;
  display: grid;
  width: 36px;
  height: 36px;
  padding: 0;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 999px;
  place-items: center;
}

.menu-trigger:hover {
  background: #f0f0f1;
}

.trigger-avatar,
.head-avatar {
  display: grid;
  overflow: hidden;
  font-weight: 600;
  color: #fff;
  background: #131317;
  border-radius: 50%;
  place-items: center;
}

.trigger-avatar {
  width: 32px;
  height: 32px;
  font-size: 13px;
}

.head-avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  font-size: 15px;
}

.trigger-avatar img,
.head-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.trigger-dot {
  position: absolute;
  right: 1px;
  bottom: 2px;
  width: 10px;
  height: 10px;
  background: #2da44e;
  border: 2px solid #fff;
  border-radius: 50%;
}

.trigger-dot.is-off {
  background: #b9b9bd;
}

.menu-panel {
  position: fixed;
  z-index: 2200;
  box-sizing: border-box;
  width: 340px;
  padding: 8px;
  background: #fff;
  border: 1px solid #ececed;
  border-radius: 16px;
}

.timezone-popover {
  position: fixed;
  z-index: 2210;
  box-sizing: border-box;
  width: min(360px, calc(100vw - 16px));
  max-height: min(480px, calc(100dvh - 16px));
  padding: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: #fff;
  border: 1px solid #e4e4e7;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgb(19 19 23 / 12%);
}

.timezone-option {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  color: #62626d;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
}

.timezone-option:hover,
.timezone-option:focus-visible {
  color: #131317;
  background: #f5f5f5;
  outline: none;
}

.timezone-option[aria-checked='true'] {
  color: #131317;
  font-weight: 500;
}

.timezone-option span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-head {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 8px 10px;
}

.head-copy {
  min-width: 0;
}

.head-copy strong {
  display: block;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: #131317;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head-copy small {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.35;
  color: #8c8c8e;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-group {
  margin-top: 8px;
  overflow: hidden;
  background: #f5f5f5;
  border-radius: 12px;
}

.menu-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 56px;
  padding: 0 14px;
  font-size: 13px;
  color: #131317;
  text-align: left;
  background: transparent;
  border: 0;
}

.menu-row + .menu-row {
  border-top: 1px solid #ececed;
}

.menu-row.is-clickable {
  cursor: pointer;
}

.menu-row.is-clickable:hover {
  background: #eeeeef;
}

.row-label {
  font-weight: 500;
}

.row-tail {
  display: inline-flex;
  gap: 10px;
  align-items: center;
}

.row-value {
  font-size: 12px;
  color: #62626d;
}

.row-icon {
  color: #707072;
  transition: transform 0.15s ease;
}

.row-icon.is-open {
  transform: rotate(90deg);
}

.toggle {
  position: relative;
  flex-shrink: 0;
  width: 44px;
  height: 24px;
  padding: 0;
  cursor: pointer;
  background: #d9d9da;
  border: 0;
  border-radius: 999px;
  transition: background-color 0.18s ease;
}

.toggle.is-on {
  background: #2da44e;
}

.toggle:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.toggle i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.18s ease;
}

.toggle.is-on i {
  transform: translateX(20px);
}

.language-option {
  min-height: 44px;
  font-size: 12px;
  color: #62626d;
}

.language-option:hover {
  background: #eeeeef;
}

.language-option[aria-checked='true'] {
  font-weight: 500;
  color: #131317;
}

.check-icon {
  color: #2da44e;
}

.logout-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 52px;
  margin-top: 8px;
  padding: 0 14px;
  font-size: 13px;
  color: #131317;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 12px;
}

.logout-row:hover {
  background: #f5f5f5;
}

.power-icon {
  color: #707072;
}
</style>
