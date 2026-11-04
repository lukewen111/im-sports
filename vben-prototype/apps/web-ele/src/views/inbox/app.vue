<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElButton, ElInput, ElMessage, ElMessageBox, ElOption, ElSelect } from 'element-plus';
import { QiSendRight } from 'qingicon-vue';
import { usePrototypeAccess } from '#/features/team/access-store';
import { useTeamStore } from '#/features/team/team-store';
import { useDemoServiceStore } from '#/features/service/demo-store';

const access = usePrototypeAccess(); const team = useTeamStore(); const store = useDemoServiceStore(); const route = useRoute();
const group = ref<'all' | 'ended' | 'mine' | 'pending'>('mine'); const activeId = ref(''); const input = ref(''); const endedKeyword = ref(''); const endedTeam = ref('');
const requestedSession = String(route.query.session || '');
if (requestedSession) {
  activeId.value = requestedSession;
  group.value = store.sessionById(requestedSession)?.status === 'ended' ? 'ended' : 'all';
}
const visible = computed(() => store.sessions.filter((s) => {
  if (group.value === 'mine') return s.status !== 'ended' && s.assigneeId === access.currentId;
  if (group.value === 'pending') return s.status === 'pending' && access.permissions.pending;
  if (group.value === 'ended') return s.status === 'ended' && (!endedKeyword.value || `${s.id}${store.customerById(s.customerId)?.name}`.toLowerCase().includes(endedKeyword.value.toLowerCase())) && (!endedTeam.value || s.teamId === endedTeam.value);
  return s.status !== 'ended';
}).sort((a, b) => group.value === 'pending' ? +new Date(a.createdAt) - +new Date(b.createdAt) : +new Date(store.lastMessage(b)?.sentAt || b.createdAt) - +new Date(store.lastMessage(a)?.sentAt || a.createdAt)));
const active = computed(() => store.sessionById(activeId.value) || visible.value[0]);
const customer = computed(() => store.customerById(active.value?.customerId));
const channel = computed(() => active.value ? store.sessionChannel(active.value) : undefined);
watch(visible, (rows) => { if (!rows.some((s) => s.id === activeId.value)) activeId.value = rows[0]?.id || ''; }, { immediate: true });
watch(active, (session) => { if (session?.assigneeId === access.currentId) session.unread = 0; });
function send() { if (!active.value) return; const error = store.send(active.value.id, access.currentId, input.value); if (error) return ElMessage.error(error); input.value = ''; }
function takeover() { if (!active.value) return; const error = store.takeover(active.value.id, access.currentId); if (error) ElMessage.error(error); else ElMessage.success('已接管会话'); }
function transfer(memberId: string) { if (!active.value) return; const error = store.assign(active.value.id, memberId); if (error) ElMessage.error(error); else ElMessage.success('会话已转接'); }
async function end() { if (!active.value) return; try { await ElMessageBox.confirm('结束后会话进入只读历史，客户再次发消息会创建新会话。', '结束会话', { confirmButtonText: '结束', cancelButtonText: '取消', type: 'warning' }); } catch { return; } const error = store.end(active.value.id); if (error) ElMessage.error(error); }
const eligible = computed(() => {
  const session = active.value;
  return session ? team.humans.filter((m) => m.online && m.id !== session.assigneeId && m.teamIds.includes(session.teamId)) : [];
});
const canSend = computed(() => {
  const currentChannel = channel.value;
  return Boolean(currentChannel && 'enabled' in currentChannel && currentChannel.enabled);
});
</script>
<template>
  <div class="inbox-page">
    <aside class="inbox-groups"><h2>聊天</h2><button :class="{ active: group === 'mine' }" @click="group='mine'">我的会话 <b>{{ store.sessions.filter(s=>s.status!=='ended'&&s.assigneeId===access.currentId&&s.unread).length }}</b></button><button v-if="access.permissions.pending" :class="{ active: group === 'pending' }" @click="group='pending'">待分配 <b>{{ store.sessions.filter(s=>s.status==='pending').length }}</b></button><button :class="{ active: group === 'all' }" @click="group='all'">全部会话</button><button :class="{ active: group === 'ended' }" @click="group='ended'">已结束</button></aside>
    <aside class="conversation-list"><header><h2>{{ group==='mine'?'我的会话':group==='pending'?'待分配':group==='ended'?'已结束':'全部会话' }}</h2><div v-if="group==='ended'" class="ended-filter"><ElInput v-model="endedKeyword" clearable placeholder="搜索会话或客户" /><ElSelect v-model="endedTeam" clearable placeholder="团队"><ElOption v-for="t in access.visibleTeams" :key="t.id" :label="t.name" :value="t.id" /></ElSelect></div></header><button v-for="s in visible" :key="s.id" :class="['conversation-card',{active:active?.id===s.id}]" @click="activeId=s.id"><i>{{ store.customerById(s.customerId)?.name.slice(0,1) }}</i><span><b>{{ store.customerById(s.customerId)?.name }}</b><small>{{ store.lastMessage(s)?.content || '暂无消息' }}</small></span><time>{{ new Date(store.lastMessage(s)?.sentAt||s.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) }}</time><em v-if="s.unread">{{ s.unread }}</em></button><div v-if="!visible.length" class="empty">暂无会话</div></aside>
    <main v-if="active" class="conversation-main"><header><div><h2>{{ customer?.name }}</h2><small>{{ channel?.name }} · {{ team.teamById(active.teamId)?.name }}</small></div><div><ElButton v-if="active.status==='pending'&&access.permissions.takeover" type="primary" @click="takeover">接管</ElButton><ElSelect v-if="active.status==='active'&&access.permissions.transfer&&eligible.length" placeholder="转接" @change="transfer"><ElOption v-for="m in eligible" :key="m.id" :label="m.name" :value="m.id" /></ElSelect><ElButton v-if="active.status!=='ended'&&access.permissions.end" @click="end">结束会话</ElButton></div></header><section class="messages"><div v-for="m in active.messages" :key="m.id" :class="['message',m.role]"><span>{{ m.content }}</span><time>{{ new Date(m.sentAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) }}</time></div></section><footer v-if="active.status==='active'"><ElInput v-model="input" type="textarea" :rows="3" placeholder="输入消息，Enter 发送" :disabled="active.assigneeId!==access.currentId||!canSend" @keyup.enter.exact.prevent="send"/><ElButton type="primary" circle :disabled="!input.trim()" @click="send"><QiSendRight :size="20" /></ElButton></footer><footer v-else class="readonly">{{ active.status==='ended'?'会话已结束，仅可查看历史消息':'会话正在等待分配' }}</footer></main>
    <aside v-if="active" class="conversation-info"><h2>客户信息</h2><dl><dt>客户 ID</dt><dd>{{ customer?.id }}</dd><dt>备注</dt><dd>{{ customer?.remark||'—' }}</dd><dt>邮箱</dt><dd>{{ customer?.email||'—' }}</dd><dt>电话</dt><dd>{{ customer?.phone||'—' }}</dd></dl><h3>会话信息</h3><dl><dt>会话 ID</dt><dd>{{ active.id }}</dd><dt>接待团队</dt><dd>{{ team.teamById(active.teamId)?.name }}</dd><dt>接待人</dt><dd>{{ team.memberById(active.assigneeId)?.name||'待分配' }}</dd><dt>开始时间</dt><dd>{{ new Date(active.createdAt).toLocaleString('zh-CN',{hour12:false}) }}</dd></dl></aside>
  </div>
</template>
<style scoped>
.inbox-page{display:grid;grid-template-columns:180px 320px minmax(440px,1fr) 280px;height:calc(100vh - 70px);background:#fff}.inbox-groups,.conversation-list,.conversation-info{border-right:1px solid #e5e7eb;padding:22px 16px;overflow:auto}.inbox-groups h2,.conversation-list h2,.conversation-info h2{font-size:20px;font-weight:650;margin:0 0 20px}.inbox-groups button{display:flex;width:100%;justify-content:space-between;padding:12px 14px;border-radius:8px;color:#475569}.inbox-groups button.active{background:#edf4ff;color:#1677ff}.conversation-list{padding:0}.conversation-list header{padding:20px 16px;border-bottom:1px solid #eee}.ended-filter{display:grid;gap:8px}.conversation-card{position:relative;display:flex;width:100%;gap:10px;padding:14px;border-bottom:1px solid #eee;text-align:left}.conversation-card.active{background:#edf4ff}.conversation-card i{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#1677ff;color:#fff}.conversation-card span{min-width:0;flex:1}.conversation-card b,.conversation-card small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.conversation-card small{color:#87909f;margin-top:5px}.conversation-card time{font-size:12px;color:#999}.conversation-card em{position:absolute;right:14px;bottom:12px;background:#1677ff;color:#fff;border-radius:10px;padding:1px 6px}.conversation-main{display:flex;min-width:0;flex-direction:column}.conversation-main>header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #eee}.conversation-main>header h2{font-size:18px;font-weight:650}.conversation-main>header small{color:#87909f}.conversation-main>header>div:last-child{display:flex;gap:8px}.messages{flex:1;overflow:auto;padding:22px;background:#f7f8fa}.message{display:flex;margin:12px 0;align-items:flex-end;gap:8px}.message span{max-width:72%;padding:10px 14px;border-radius:12px;background:#fff}.message.agent{justify-content:flex-end}.message.agent span{background:#1677ff;color:#fff}.message.system{justify-content:center;color:#87909f}.message.system span{background:transparent}.message time{font-size:11px;color:#9ca3af}.conversation-main>footer{display:flex;gap:10px;padding:14px;border-top:1px solid #eee}.conversation-main>footer.readonly{justify-content:center;color:#87909f}.conversation-info{border-right:0;border-left:1px solid #e5e7eb}.conversation-info h3{margin:28px 0 12px;font-weight:650}.conversation-info dl{display:grid;grid-template-columns:72px 1fr;gap:12px;font-size:13px}.conversation-info dt{color:#87909f}.conversation-info dd{min-width:0;overflow-wrap:anywhere}.empty{padding:48px;text-align:center;color:#999}@media(max-width:1200px){.inbox-page{grid-template-columns:160px 280px 1fr}.conversation-info{display:none}}
</style>
