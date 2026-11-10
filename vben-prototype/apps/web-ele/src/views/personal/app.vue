<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { ElInput, ElMessage, ElSwitch } from 'element-plus';

import QIcon from '#/components/q-icon/QIcon.vue';
import { useDemoServiceStore } from '#/features/service/demo-store';
import { interfaceMessageLocale } from '#/features/service/interface-locale';
import { usePrototypeAccess } from '#/features/team/access-store';

type SupportedLocale = 'en-US' | 'zh-CN';

const COPY = {
  'zh-CN': {
    title: '个人中心',
    subtitle: '维护本人在线接待状态与账号安全，所有修改仅作用于当前账号。',
    navOnline: '在线状态',
    navSecurity: '账号安全',
    online: '在线接待中',
    offline: '当前离线',
    onlineTitle: '在线状态',
    onlineMeta: '账号级统一状态，同一账号的所有已登录设备共享。',
    acceptChat: '接受聊天',
    onlineRule: '开启后参与新会话自动分配；关闭后立即停止接收新会话，当前接待中的未结束会话按原团队规则重新分配。',
    accountEnabled: '账号状态',
    enabled: '已启用',
    activeSessions: '我接待中的会话',
    sessionsUnit: '个',
    onlineOn: '已上线，将参与新会话分配',
    onlineOff: '已离线，停止接收新会话',
    securityTitle: '账号安全',
    securityMeta: '安全操作仅作用于当前登录账号。',
    changePassword: '修改密码',
    passwordDesc: '修改成功后，当前账号所有已登录设备的登录会话全部失效，账号统一变为离线，未结束会话按原团队规则重新分配。',
    passwordHint: '演示环境不连接真实登录服务，确认修改后仅将账号置为离线。',
    pwdDialogTitle: '修改密码',
    pwdCurrent: '原密码',
    pwdNext: '新密码',
    pwdConfirm: '确认新密码',
    pwdNextHint: '8–32 位，且同时包含字母和数字',
    cancel: '取消',
    submit: '确认修改',
    errCurrent: '请输入原密码',
    errFormat: '新密码需 8–32 位，且同时包含字母和数字',
    errMismatch: '两次输入的新密码不一致',
    pwdChanged: '密码已修改，账号已置为离线',
    disabledTitle: '账号不可用',
    disabledDesc: '当前账号已被停用或失效，无法查看或修改在线状态。',
  },
  'en-US': {
    title: 'Personal center',
    subtitle: 'Manage your online reception state and account security. Changes apply only to your own account.',
    navOnline: 'Online status',
    navSecurity: 'Account security',
    online: 'Online',
    offline: 'Offline',
    onlineTitle: 'Online status',
    onlineMeta: 'Account-level state shared by every signed-in device of this account.',
    acceptChat: 'Accept chats',
    onlineRule: 'When enabled you can receive new sessions. Turning it off stops new sessions immediately and reassigns unfinished sessions within their original team.',
    accountEnabled: 'Account state',
    enabled: 'Enabled',
    activeSessions: 'Sessions you are handling',
    sessionsUnit: 'sessions',
    onlineOn: 'You are online and can receive new sessions',
    onlineOff: 'You are offline and will not receive new sessions',
    securityTitle: 'Account security',
    securityMeta: 'Security actions apply only to the currently signed-in account.',
    changePassword: 'Change password',
    passwordDesc: 'After a successful change every signed-in device is signed out, the account goes offline, and unfinished sessions are reassigned within their original team.',
    passwordHint: 'This demo is not connected to a real authentication service; confirming only sets the account offline.',
    pwdDialogTitle: 'Change password',
    pwdCurrent: 'Current password',
    pwdNext: 'New password',
    pwdConfirm: 'Confirm new password',
    pwdNextHint: '8–32 characters containing both letters and digits',
    cancel: 'Cancel',
    submit: 'Confirm',
    errCurrent: 'Please enter the current password',
    errFormat: 'New password must be 8–32 characters and contain both letters and digits',
    errMismatch: 'The two new passwords do not match',
    pwdChanged: 'Password changed. The account is now offline.',
    disabledTitle: 'Account unavailable',
    disabledDesc: 'This account is disabled or invalid, so the online status cannot be viewed or edited.',
  },
} as const;

const SECTIONS = [
  { id: 'personal-online', index: '01', key: 'navOnline' },
  { id: 'personal-security', index: '02', key: 'navSecurity' },
] as const;

const access = usePrototypeAccess();
const store = useDemoServiceStore();

const member = computed(() => access.current);
const passwordOpen = ref(false);
const password = reactive({ confirm: '', current: '', next: '' });
const activeSection = ref<string>(SECTIONS[0].id);

const currentLocale = computed<SupportedLocale>(() => interfaceMessageLocale(member.value ? store.settingsFor(member.value.id).locale : 'zh-CN'));
const t = computed(() => COPY[currentLocale.value] || COPY['zh-CN']);
const sections = computed(() => SECTIONS.map((item) => ({ id: item.id, index: item.index, label: t.value[item.key] })));
const online = computed(() => Boolean(member.value?.online));
const activeSessions = computed(() => store.sessions.filter((item) => item.status === 'active' && item.assigneeId === member.value?.id).length);

function jumpTo(id: string) {
  activeSection.value = id;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleOnline(value: boolean | number | string) {
  if (!member.value) return;
  const next = Boolean(value);
  store.savePersonal(member.value.id, { accepting: next });
  ElMessage.success(next ? t.value.onlineOn : t.value.onlineOff);
}

function openPassword() {
  password.current = '';
  password.next = '';
  password.confirm = '';
  passwordOpen.value = true;
}

function closePassword() {
  passwordOpen.value = false;
}

function submitPassword() {
  if (!member.value) return;
  if (!password.current.trim()) return ElMessage.error(t.value.errCurrent);
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,32}$/.test(password.next)) return ElMessage.error(t.value.errFormat);
  if (password.next !== password.confirm) return ElMessage.error(t.value.errMismatch);
  store.savePersonal(member.value.id, { accepting: false });
  closePassword();
  ElMessage.success(t.value.pwdChanged);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && passwordOpen.value) closePassword();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <main class="personal-page">
    <header class="page-head">
      <div class="head-copy">
        <h1 class="head-title"><QIcon name="user" :size="20" />{{ t.title }}</h1>
        <p>{{ t.subtitle }}</p>
      </div>
      <span class="ui-tag head-status" :class="online ? 'is-soft is-success' : 'is-neutral'">
        <i class="ui-tag__dot" :class="online ? 'is-success' : 'is-muted'"></i>
        {{ online ? t.online : t.offline }}
      </span>
    </header>

    <section v-if="!member" class="card empty-card">
      <h2>{{ t.disabledTitle }}</h2>
      <p>{{ t.disabledDesc }}</p>
    </section>

    <div v-else class="page-body">
      <aside class="section-nav" aria-label="页面分区">
        <button
          v-for="item in sections"
          :key="item.id"
          type="button"
          class="nav-item"
          :class="{ active: activeSection === item.id }"
          @click="jumpTo(item.id)"
        >
          <span class="nav-index">{{ item.index }}</span>
          <span>{{ item.label }}</span>
        </button>
      </aside>

      <div class="content">
        <section id="personal-online" class="card">
          <header class="card-head">
            <div>
              <h2>{{ t.onlineTitle }}</h2>
              <p>{{ t.onlineMeta }}</p>
            </div>
          </header>

          <div class="status-hero" :class="online ? 'is-online' : 'is-offline'">
            <i class="status-orb"></i>
            <div class="status-copy">
              <h3>{{ online ? t.online : t.offline }}</h3>
              <p>{{ t.onlineRule }}</p>
            </div>
            <div class="status-switch">
              <span>{{ t.acceptChat }}</span>
              <ElSwitch :model-value="online" @change="toggleOnline" />
            </div>
          </div>

          <div class="stat-grid">
            <div class="stat">
              <small>{{ t.accountEnabled }}</small>
              <span class="ui-tag is-soft is-success">{{ t.enabled }}</span>
            </div>
            <div class="stat">
              <small>{{ t.activeSessions }}</small>
              <strong>{{ activeSessions }} {{ t.sessionsUnit }}</strong>
            </div>
          </div>
        </section>

        <section id="personal-security" class="card">
          <header class="card-head">
            <div>
              <h2>{{ t.securityTitle }}</h2>
              <p>{{ t.securityMeta }}</p>
            </div>
          </header>

          <div class="action-row">
            <div class="action-copy">
              <strong>{{ t.changePassword }}</strong>
              <p>{{ t.passwordDesc }}</p>
              <small>{{ t.passwordHint }}</small>
            </div>
            <button class="ui-btn-outline" type="button" @click="openPassword">{{ t.changePassword }}</button>
          </div>
        </section>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="passwordOpen" class="pwd-mask" @click.self="closePassword">
        <div class="pwd-card" role="dialog" aria-modal="true">
          <header>
            <h3>{{ t.pwdDialogTitle }}</h3>
            <button class="icon-close" type="button" aria-label="关闭" @click="closePassword"><QIcon name="close" :size="16" /></button>
          </header>
          <div class="pwd-body">
            <label class="pwd-field">
              <span>{{ t.pwdCurrent }}</span>
              <ElInput v-model="password.current" type="password" show-password autocomplete="current-password" />
            </label>
            <label class="pwd-field">
              <span>{{ t.pwdNext }}</span>
              <ElInput v-model="password.next" type="password" show-password autocomplete="new-password" />
            </label>
            <p class="pwd-hint">{{ t.pwdNextHint }}</p>
            <label class="pwd-field">
              <span>{{ t.pwdConfirm }}</span>
              <ElInput v-model="password.confirm" type="password" show-password autocomplete="new-password" />
            </label>
          </div>
          <footer>
            <button class="ui-btn-outline" type="button" @click="closePassword">{{ t.cancel }}</button>
            <button class="btn-primary" type="button" @click="submitPassword">{{ t.submit }}</button>
          </footer>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.personal-page {
  display: flex;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 16px 20px;
  color: #131317;
  background: #f5f5f5;
}

.page-head {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  max-width: 1080px;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin: 0 0 16px;
}

.head-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.head-title :deep(.q-icon) {
  color: var(--ui-ink);
}

.head-copy h1 {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
}

.head-copy p {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: #8c8c8e;
}

.head-status {
  flex: none;
}

.page-body {
  display: grid;
  box-sizing: border-box;
  width: 100%;
  max-width: 1080px;
  min-height: 0;
  flex: 1;
  grid-template-columns: 188px minmax(0, 880px);
  gap: 12px;
  align-items: stretch;
}

.section-nav {
  position: sticky;
  top: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  background: #fff;
  border: 1px solid #ececed;
  border-radius: 16px;
}

.nav-item {
  display: flex;
  gap: 10px;
  align-items: center;
  height: 36px;
  padding: 0 10px;
  font-size: 13px;
  color: #62626d;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
}

.nav-item:hover {
  color: #131317;
  background: #f5f5f5;
}

.nav-item.active {
  font-weight: 500;
  color: #131317;
  background: #eeeeef;
}

.nav-index {
  font-size: 11px;
  color: #8c8c8e;
  font-variant-numeric: tabular-nums;
}

.nav-item.active .nav-index {
  color: #62626d;
}

.content {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding-right: 2px;
  overflow-y: auto;
}

.card {
  padding: 20px;
  background: #fff;
  border: 1px solid #ececed;
  border-radius: 16px;
  scroll-margin-top: 16px;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ececed;
}

.card-head h2 {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.card-head p {
  max-width: 620px;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: #8c8c8e;
}

.status-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 16px 0 18px;
}

.status-orb {
  width: 10px;
  height: 10px;
  background: #8c8c8e;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgb(140 140 142 / 12%);
}

.status-hero.is-online .status-orb {
  background: #2da44e;
  box-shadow: 0 0 0 4px rgb(30 158 91 / 12%);
}

.status-copy h3 {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.status-copy p {
  max-width: 620px;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: #62626d;
}

.status-switch {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 10px;
}

.status-switch span {
  font-size: 12px;
  color: #62626d;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #ececed;
}

.stat {
  padding: 12px 14px;
  background: #f5f5f5;
  border-radius: 12px;
}

.stat small {
  display: block;
  font-size: 12px;
  color: #8c8c8e;
}

.stat strong {
  display: block;
  margin-top: 6px;
  font-size: 14px;
  font-weight: 600;
}

.action-row {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
  padding-top: 16px;
}

.action-copy strong {
  font-size: 14px;
  font-weight: 500;
}

.action-copy p {
  max-width: 600px;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: #62626d;
}

.action-copy small {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: #8c8c8e;
}

.empty-card h2 {
  font-size: 15px;
  font-weight: 600;
}

.empty-card p {
  margin-top: 6px;
  font-size: 12px;
  color: #8c8c8e;
}

.btn-primary {
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 500;
  line-height: 34px;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.btn-primary {
  color: #fff;
  background: #131317;
}

.btn-primary:hover {
  background: #2a2a30;
}

.pwd-card :deep(.el-input__wrapper) {
  height: 36px;
  padding: 0 12px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #c9c9cd inset;
}

.pwd-card :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #003fa4 inset, 0 0 0 3px rgb(0 63 164 / 24%);
}

.pwd-card :deep(.el-input__inner) {
  font-size: 13px;
  color: #131317;
}

.pwd-card :deep(.el-input__inner::placeholder) {
  color: #9a9aa0;
}

.content :deep(.el-switch) {
  --el-switch-on-color: #2da44e;
  --el-switch-off-color: #d1d1d2;
}

.pwd-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  padding: 24px;
  background: rgb(19 19 23 / 32%);
  place-items: center;
}

.pwd-card {
  width: 420px;
  max-width: calc(100vw - 48px);
  overflow: hidden;
  background: #fff;
  border: 1px solid #ececed;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgb(19 19 23 / 18%);
}

.pwd-card > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid #ececed;
}

.pwd-card h3 {
  font-size: 15px;
  font-weight: 600;
}

.icon-close {
  width: 28px;
  height: 28px;
  font-size: 18px;
  line-height: 1;
  color: #707072;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
}

.icon-close:hover {
  color: #131317;
  background: #f5f5f5;
}

.pwd-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 20px;
}

.pwd-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pwd-field > span {
  font-size: 12px;
  color: #707072;
}

.pwd-hint {
  margin: -6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #8c8c8e;
}

.pwd-card > footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 14px 20px;
  border-top: 1px solid #ececed;
}

@media (max-width: 980px) {
  .page-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .section-nav {
    position: static;
    flex-direction: row;
    overflow-x: auto;
  }

  .nav-item {
    flex-shrink: 0;
  }

  .status-hero {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .status-switch {
    grid-column: 1 / -1;
    justify-content: space-between;
  }
}
</style>
