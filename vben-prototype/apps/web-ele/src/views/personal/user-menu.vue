<script setup lang="ts">
// 顶栏浮层接入点：layouts/basic.vue 的 #user-dropdown 插槽渲染本组件，并监听 @logout。
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { loadLocaleMessages } from '@vben/locales';
import { updatePreferences } from '@vben/preferences';

import { ElMessage } from 'element-plus';

import QIcon from '#/components/q-icon/QIcon.vue';
import { useDemoServiceStore } from '#/features/service/demo-store';

import { useProfileIdentity } from './profile-identity';

type SupportedLocale = 'en-US' | 'zh-CN';

const COPY = {
  'zh-CN': {
    profile: '个人资料',
    acceptChat: '接受聊天',
    online: '在线',
    offline: '离线',
    language: '界面语言',
    logout: '退出登录',
    onlineOn: '已上线，将参与新会话分配',
    onlineOff: '已离线，停止接收新会话',
    localeSaved: '界面语言已切换',
    localeFailed: '界面语言保存失败，请重试',
  },
  'en-US': {
    profile: 'Profile',
    acceptChat: 'Accept chats',
    online: 'Online',
    offline: 'Offline',
    language: 'Interface language',
    logout: 'Log out',
    onlineOn: 'You are online and can receive new sessions',
    onlineOff: 'You are offline and will not receive new sessions',
    localeSaved: 'Interface language updated',
    localeFailed: 'Failed to save the interface language. Please retry.',
  },
} as const;

const LANGUAGE_LABELS: Record<SupportedLocale, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English',
};

const emit = defineEmits<{ logout: [] }>();

const router = useRouter();
const store = useDemoServiceStore();
const identity = useProfileIdentity();

const open = ref(false);
const languageOpen = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const position = reactive({ right: 8, top: 56 });

const member = computed(() => identity.value.member);
const locale = computed<SupportedLocale>(() => (member.value ? store.settingsFor(member.value.id).locale : 'zh-CN'));
const t = computed(() => COPY[locale.value] || COPY['zh-CN']);
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

function toggleMenu() {
  open.value = !open.value;
  if (open.value) {
    languageOpen.value = false;
    updatePosition();
  }
}

function closeMenu() {
  open.value = false;
  languageOpen.value = false;
}

function onDocumentPointer(event: MouseEvent) {
  if (!open.value) return;
  const target = event.target as Node;
  if (triggerRef.value?.contains(target) || panelRef.value?.contains(target)) return;
  closeMenu();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) closeMenu();
}

function onViewportChange() {
  if (open.value) updatePosition();
}

function openProfile() {
  closeMenu();
  void router.push('/personal');
}

function toggleAccepting() {
  if (!member.value) return;
  const next = !online.value;
  store.savePersonal(member.value.id, { accepting: next });
  if (Boolean(member.value.online) !== next) {
    ElMessage.error(locale.value === 'zh-CN' ? '状态切换失败，请重试' : 'Failed to switch status. Please retry.');
    return;
  }
  ElMessage.success(next ? t.value.onlineOn : t.value.onlineOff);
}

function toggleLanguage() {
  languageOpen.value = !languageOpen.value;
}

async function selectLocale(value: SupportedLocale) {
  if (!member.value || value === locale.value) {
    languageOpen.value = false;
    return;
  }
  const previous = store.settingsFor(member.value.id).locale;
  store.savePersonal(member.value.id, { locale: value });
  try {
    updatePreferences({ app: { locale: value } });
    await loadLocaleMessages(value);
    ElMessage.success(COPY[value].localeSaved);
  } catch {
    store.savePersonal(member.value.id, { locale: previous });
    updatePreferences({ app: { locale: previous } });
    await loadLocaleMessages(previous).catch(() => {});
    ElMessage.error(COPY[previous].localeFailed);
  }
  languageOpen.value = false;
}

function logout() {
  if (member.value) store.savePersonal(member.value.id, { accepting: false });
  closeMenu();
  emit('logout');
}

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
        :style="{ top: `${position.top}px`, right: `${position.right}px` }"
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
          <button type="button" class="menu-row is-clickable" role="menuitem" @click="openProfile">
            <span class="row-label">{{ t.profile }}</span>
            <QIcon class="row-icon" name="chevron-right" :size="16" />
          </button>
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
              <QIcon class="row-icon" :class="{ 'is-open': languageOpen }" name="chevron-down" :size="16" />
            </span>
          </button>
          <template v-if="languageOpen">
            <button
              v-for="item in (Object.keys(LANGUAGE_LABELS) as SupportedLocale[])"
              :key="item"
              type="button"
              class="menu-row language-option"
              role="menuitemradio"
              :aria-checked="locale === item"
              @click="selectLocale(item)"
            >
              <span class="row-label">{{ LANGUAGE_LABELS[item] }}</span>
              <QIcon v-if="locale === item" class="check-icon" name="check" :size="16" />
            </button>
          </template>
        </div>

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

        <button type="button" class="logout-row" role="menuitem" @click="logout">
          <span class="row-label">{{ t.logout }}</span>
          <QIcon class="power-icon" name="power" :size="18" />
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
  transform: rotate(180deg);
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
