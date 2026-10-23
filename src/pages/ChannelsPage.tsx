import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Dropdown, Empty, Input, InputNumber, Menu, Message, Modal, Switch, Table } from '@arco-design/web-react';
import { IconArrowLeft, IconCopy, IconLaunch, IconMore, IconPlus, IconSearch, IconSend, IconUpload } from '@arco-design/web-react/icon';
import { AgentAvatar } from '../components/AgentAvatar';
import { ChannelTypeIcon } from '../components/ChannelTypeIcon';
import { WidgetGlyph } from '../components/WidgetGlyph';
import { useChannelStore } from '../store';
import type { Channel, ChannelAgent, ChannelType } from '../types';

const channelTypes: ChannelType[] = ['web-widget', 'telegram', 'chat-page'];
const modernTypes: ChannelType[] = ['web-widget', 'chat-page'];
const languageOptions = ['自动', '简体中文', '繁体中文', '英语', '越南语', '泰语'];
const meta: Record<ChannelType, { name: string; description: string; add: string }> = {
  'web-widget': { name: '网站小部件', description: '在客户浏览网站时，通过悬浮窗口与 AI 客服实时聊天。', add: '添加网站' },
  telegram: { name: 'Telegram', description: '连接 Telegram Bot，为客户提供自动化咨询服务。', add: '添加新连接' },
  'chat-page': { name: '聊天页面', description: '分享独立聊天链接，让客户随时发起咨询。', add: '添加新连接' },
};

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const pathFor = (type?: ChannelType, suffix = '') => type ? `/channels/${type}${suffix}` : '/channels';
const formatDate = (value: string) => value.replace('T', ' ').slice(0, 16);

function parseDomain(raw: string): { error?: string; domain?: string } {
  const value = raw.trim();
  if (!value) return { error: '请输入网站域名' };
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (url.pathname !== '/' || url.search || url.hash || !url.hostname.includes('.')) return { error: '请输入有效域名，不包含路径、参数或通配符' };
    return { domain: url.hostname.toLowerCase() };
  } catch {
    return { error: '请输入有效域名' };
  }
}

function useChannelRoute() {
  const location = useLocation();
  const [, section, rawType, rawId] = location.pathname.split('/');
  const type = channelTypes.includes(rawType as ChannelType) ? rawType as ChannelType : undefined;
  return { type, channelId: section === 'channels' && rawId && rawId !== 'new' ? rawId : undefined, create: rawId === 'new' };
}

function AgentCell({ agent }: { agent?: ChannelAgent }) {
  return <span className={agent ? 'agent-cell' : 'agent-cell is-empty'}><AgentAvatar agent={agent} />{agent?.name ?? '未配置'}</span>;
}

function SideNav({ active }: { active?: ChannelType }) {
  const navigate = useNavigate();
  return <aside className="channels-subnav"><h2>渠道</h2><button className={!active ? 'active' : ''} onClick={() => navigate('/channels')}>全部</button>{channelTypes.map((type) => <button key={type} className={active === type ? 'active' : ''} onClick={() => navigate(pathFor(type))}><ChannelTypeIcon type={type} />{meta[type].name}</button>)}</aside>;
}

export function ChannelsPage() {
  const route = useChannelRoute();
  return <div className={`channels-layout${route.channelId && route.type && modernTypes.includes(route.type) ? ' is-detail' : ''}`}>{!(route.channelId && route.type && modernTypes.includes(route.type)) && <SideNav active={route.type} />}<main className="channels-main">{!route.type ? <Overview /> : route.channelId && modernTypes.includes(route.type) ? <ChannelDetail type={route.type} channelId={route.channelId} /> : <ChannelList type={route.type} openCreate={route.create} editId={route.channelId} />}</main></div>;
}

function Overview() {
  const { state } = useChannelStore();
  const navigate = useNavigate();
  return <section className="channels-panel"><header className="panel-header"><h1>全部渠道</h1></header><div className="channel-type-grid">{channelTypes.map((type) => {
    const count = state.channels.filter((item) => item.type === type).length;
    return <article className="channel-type-card" key={type}><div className="type-card-title"><ChannelTypeIcon type={type} /><h2>{meta[type].name}</h2>{count > 0 && <span>已连接 {count}</span>}</div><p>{meta[type].description}</p><button type="button" className="type-card-action" onClick={() => navigate(count ? pathFor(type) : pathFor(type, '/new'))}>{count ? '管理' : meta[type].add}</button></article>;
  })}</div></section>;
}

function ChannelList({ type, openCreate, editId }: { type: ChannelType; openCreate: boolean; editId?: string }) {
  const { state, dispatch } = useChannelStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<{ mode: 'create' | 'edit'; channel?: Channel } | null>(null);
  const [deleting, setDeleting] = useState<Channel>();
  const [deleteName, setDeleteName] = useState('');
  const [created, setCreated] = useState<Channel>();
  const channels = useMemo(() => state.channels.filter((item) => item.type === type).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.channels, type]);
  const filtered = channels.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (openCreate) setForm({ mode: 'create' });
    else if (editId) {
      const channel = channels.find((item) => item.id === editId);
      if (channel) setForm({ mode: 'edit', channel });
    }
  }, [channels, editId, openCreate]);

  const closeForm = () => { setForm(null); if (openCreate || editId) navigate(pathFor(type), { replace: true }); };
  const toggle = (channel: Channel, enabled: boolean) => {
    const agent = state.agents.find((item) => item.id === channel.agentId);
    if (enabled && (!agent || agent.status !== 'published' || !agent.acceptingChats)) return void Message.warning('请先配置已发布且正在接待的 AI Agent');
    const commit = () => { dispatch({ type: 'channel.toggle', id: channel.id, enabled }); Message.success(enabled ? '渠道已启用' : '渠道已停用'); };
    if (!enabled) Modal.confirm({ title: `停用渠道「${channel.name}」？`, content: '停用后将停止接收新的客户消息，历史消息仍保留。', okText: '确认停用', onOk: commit });
    else commit();
  };
  const menu = (channel: Channel) => <Menu><Menu.Item key="edit" onClick={() => modernTypes.includes(type) ? navigate(pathFor(type, `/${channel.id}`)) : setForm({ mode: 'edit', channel })}>编辑</Menu.Item><Menu.Item key="delete" className="danger" disabled={channel.enabled} onClick={() => { setDeleting(channel); setDeleteName(''); }}>删除</Menu.Item></Menu>;
  const remove = () => { if (!deleting || deleteName !== deleting.name) return; dispatch({ type: 'channel.delete', id: deleting.id }); setDeleting(undefined); Message.success('渠道已删除'); };

  return <section className="channels-panel"><header className="panel-header"><h1>{meta[type].name}</h1><Button type="primary" icon={<IconPlus />} onClick={() => setForm({ mode: 'create' })}>{meta[type].add}</Button></header><div className="list-content">{channels.length > 0 && <Input className="channel-search" prefix={<IconSearch />} allowClear value={query} onChange={setQuery} placeholder="搜索渠道名称" />}{filtered.length ? <Table rowKey="id" data={filtered} pagination={{ pageSize: 20, showTotal: true }} columns={[
    { title: '渠道名称', render: (_: unknown, item: Channel) => <button className={`channel-name${modernTypes.includes(type) ? ' is-link' : ''}`} onClick={() => modernTypes.includes(type) && navigate(pathFor(type, `/${item.id}`))}><ChannelTypeIcon type={type} /><span><strong>{item.name}</strong>{type === 'web-widget' && item.websiteDomain && <small>{item.websiteDomain}<IconLaunch /></small>}</span></button> },
    { title: '接待 AI Agent', render: (_: unknown, item: Channel) => <AgentCell agent={state.agents.find((agent) => agent.id === item.agentId)} /> },
    { title: '创建时间', dataIndex: 'createdAt', render: formatDate },
    ...(type === 'web-widget' ? [{ title: '状态', render: (_: unknown, item: Channel) => <span className={`connect-status ${item.installStatus === 'success' ? 'is-connected' : ''}`}>{item.installStatus === 'success' ? '已连接' : '未连接'}</span> }] : []),
    { title: '启用状态', render: (_: unknown, item: Channel) => <Switch checked={item.enabled} onChange={(value) => toggle(item, value)} /> },
    { title: '操作', width: 72, render: (_: unknown, item: Channel) => <Dropdown trigger="click" droplist={menu(item)}><Button type="text" icon={<IconMore />} /></Dropdown> },
  ]} /> : <Empty description={channels.length ? '没有找到匹配的渠道' : `暂无${meta[type].name}`} />}</div><ChannelForm type={type} value={form} onClose={closeForm} onSaved={(channel) => setCreated(channel)} /><Modal visible={Boolean(deleting)} title={deleting ? `删除渠道「${deleting.name}」？` : '删除渠道'} okText="确认删除" okButtonProps={{ status: 'danger', disabled: !deleting || deleteName !== deleting.name }} onCancel={() => setDeleting(undefined)} onOk={remove}><p>请输入渠道名称以确认删除。</p><Input value={deleteName} onChange={setDeleteName} placeholder={deleting?.name} /></Modal><SetupModal channel={created} onClose={() => setCreated(undefined)} /></section>;
}

type FormDraft = { name: string; agentId?: string; language: string; websiteDomain: string; botToken: string };

function ChannelForm({ type, value, onClose, onSaved }: { type: ChannelType; value: { mode: 'create' | 'edit'; channel?: Channel } | null; onClose: () => void; onSaved: (channel: Channel) => void }) {
  const { state, dispatch } = useChannelStore();
  const [draft, setDraft] = useState<FormDraft>({ name: '', language: '自动', websiteDomain: '', botToken: '' });
  const [error, setError] = useState('');
  const current = value?.channel;
  useEffect(() => setDraft({ name: current?.name ?? '', agentId: current?.agentId, language: current?.language ?? '自动', websiteDomain: current?.websiteDomain ?? '', botToken: current?.botToken ?? '' }), [current, value]);
  const publishedAgents = state.agents.filter((agent) => agent.status === 'published');
  const submit = () => {
    const name = draft.name.trim();
    if (!name) return setError('请输入渠道名称');
    if (name.length > 50) return setError('渠道名称最多 50 个字符');
    if (state.channels.some((item) => item.id !== current?.id && item.name.trim().toLowerCase() === name.toLowerCase())) return setError('渠道名称已存在');
    if (!draft.agentId) return setError('请选择接待 AI Agent');
    const domain = type === 'web-widget' ? parseDomain(draft.websiteDomain) : {};
    if (domain.error) return setError(domain.error);
    if (type === 'telegram' && !/^\d+:\S+$/.test(draft.botToken.trim())) return setError('Bot Token 格式不正确');
    const timestamp = new Date().toISOString();
    const channelId = current?.id ?? id(`channel-${type}`);
    const channel: Channel = {
      ...current, id: channelId, type, name, agentId: draft.agentId, enabled: current?.enabled ?? true,
      language: modernTypes.includes(type) ? draft.language : undefined,
      websiteDomain: type === 'web-widget' ? domain.domain : undefined,
      allowedDomains: type === 'web-widget' ? current?.allowedDomains ?? [] : undefined,
      installCode: type === 'web-widget' ? current?.installCode ?? `<script src="https://cdn.example.com/widget.js" data-channel="${channelId}" async></script>` : undefined,
      installStatus: type === 'web-widget' ? current?.installStatus ?? 'unchecked' : undefined,
      botToken: type === 'telegram' ? draft.botToken.trim() : undefined,
      brandName: modernTypes.includes(type) ? current?.brandName ?? '' : undefined,
      brandSignature: modernTypes.includes(type) ? current?.brandSignature ?? '有问题？我们随时为您提供帮助。' : undefined,
      themeColor: modernTypes.includes(type) ? current?.themeColor ?? '#1c1f26' : undefined,
      widgetIcon: type === 'web-widget' ? current?.widgetIcon ?? 'message' : undefined,
      widgetPosition: type === 'web-widget' ? current?.widgetPosition ?? 'bottom-right' : undefined,
      widgetOffsetX: type === 'web-widget' ? current?.widgetOffsetX ?? 24 : undefined,
      widgetOffsetY: type === 'web-widget' ? current?.widgetOffsetY ?? 24 : undefined,
      widgetDesktopVisible: type === 'web-widget' ? current?.widgetDesktopVisible ?? true : undefined,
      widgetMobileVisible: type === 'web-widget' ? current?.widgetMobileVisible ?? true : undefined,
      createdAt: current?.createdAt ?? timestamp, updatedAt: timestamp,
    };
    dispatch({ type: 'channel.save', channel });
    Message.success(value?.mode === 'create' ? '渠道已创建' : '渠道已保存');
    if (value?.mode === 'create' && modernTypes.includes(type)) onSaved(channel);
    onClose();
  };
  return <Modal visible={Boolean(value)} title={`${value?.mode === 'create' ? '新增' : '编辑'}${meta[type].name}`} okText={value?.mode === 'create' ? '创建' : '保存'} onCancel={onClose} onOk={submit} unmountOnExit><div className="channel-form"><label>渠道名称<Input maxLength={50} showWordLimit value={draft.name} onChange={(name) => { setDraft({ ...draft, name }); setError(''); }} /></label>{type === 'web-widget' && <label>网站域名<Input value={draft.websiteDomain} onChange={(websiteDomain) => setDraft({ ...draft, websiteDomain })} placeholder="example.com" /></label>}{modernTypes.includes(type) && <label>界面语言<select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })}>{languageOptions.map((item) => <option key={item}>{item}</option>)}</select></label>}{type === 'telegram' && <label>Bot Token<Input.Password value={draft.botToken} onChange={(botToken) => setDraft({ ...draft, botToken })} placeholder="123456789:token" /></label>}<label>接待 AI Agent<select value={draft.agentId ?? ''} onChange={(event) => setDraft({ ...draft, agentId: event.target.value || undefined })}><option value="">请选择已发布的 AI Agent</option>{publishedAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>{error && <div className="form-error">{error}</div>}</div></Modal>;
}

function SetupModal({ channel, onClose }: { channel?: Channel; onClose: () => void }) {
  if (!channel) return null;
  const isWidget = channel.type === 'web-widget';
  const value = isWidget ? channel.installCode ?? '' : `${window.location.origin}${window.location.pathname}#/chat/${channel.id}`;
  return <Modal visible title={isWidget ? '安装网站小部件' : '分享聊天页面'} footer={null} onCancel={onClose}><p>{isWidget ? '将以下代码粘贴到网页 </body> 标签之前。' : '复制此链接并分享给客户。'}</p><div className="copy-row"><Input value={value} readOnly /><Button icon={<IconCopy />} onClick={() => { void navigator.clipboard.writeText(value); Message.success('已复制'); }}>复制</Button></div></Modal>;
}

function ChannelDetail({ type, channelId }: { type: ChannelType; channelId: string }) {
  const { state, dispatch } = useChannelStore();
  const navigate = useNavigate();
  const stored = state.channels.find((item) => item.id === channelId && item.type === type);
  const [draft, setDraft] = useState<Channel | undefined>(stored);
  const [section, setSection] = useState<'basic' | 'appearance' | 'display'>('basic');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [messages, setMessages] = useState(['您好，请问有什么可以帮您？']);
  const [input, setInput] = useState('');
  useEffect(() => setDraft(stored), [stored]);
  if (!stored || !draft) return <div className="empty-state"><Empty description="渠道不存在" /><Button onClick={() => navigate(pathFor(type))}>返回列表</Button></div>;
  const update = (patch: Partial<Channel>) => setDraft({ ...draft, ...patch });
  const save = () => {
    if (!draft.name.trim()) return void Message.warning('请输入渠道名称');
    if ((draft.brandName?.length ?? 0) > 50 || (draft.brandSignature?.length ?? 0) > 50) return void Message.warning('品牌名称和签名最多 50 个字符');
    dispatch({ type: 'channel.save', channel: { ...draft, name: draft.name.trim(), updatedAt: new Date().toISOString() } });
    Message.success('渠道配置已保存');
  };
  const toggle = (enabled: boolean) => {
    const agent = state.agents.find((item) => item.id === draft.agentId);
    if (enabled && (!agent || agent.status !== 'published' || !agent.acceptingChats)) return void Message.warning('当前 AI Agent 不可接待');
    dispatch({ type: 'channel.toggle', id: draft.id, enabled });
  };
  const publicUrl = `${window.location.origin}${window.location.pathname}#/${type === 'web-widget' ? 'widget' : 'chat'}/${draft.id}`;
  return <section className="detail-page"><header className="detail-header"><div><Button type="text" shape="circle" icon={<IconArrowLeft />} onClick={() => navigate(pathFor(type))} /><ChannelTypeIcon type={type} /><h1>{draft.name}</h1></div><span>{draft.enabled ? '已启用' : '已停用'}<Switch checked={draft.enabled} onChange={toggle} /></span></header><div className="detail-workspace"><nav><button className={section === 'basic' ? 'active' : ''} onClick={() => setSection('basic')}>基本设置</button><button className={section === 'appearance' ? 'active' : ''} onClick={() => setSection('appearance')}>品牌外观</button><button className={section === 'display' ? 'active' : ''} onClick={() => setSection('display')}>{type === 'web-widget' ? '可见性与位置' : '聊天链接'}</button></nav><main className="detail-config"><h2>{section === 'basic' ? '基本设置' : section === 'appearance' ? '品牌外观' : type === 'web-widget' ? '可见性与位置' : '聊天链接'}</h2>{section === 'basic' && <div className="detail-fields"><label>渠道名称<Input value={draft.name} onChange={(name) => update({ name })} /></label>{type === 'web-widget' && <label>网站域名<Input value={draft.websiteDomain} onChange={(websiteDomain) => update({ websiteDomain })} /></label>}<label>界面语言<select value={draft.language ?? '自动'} onChange={(event) => update({ language: event.target.value })}>{languageOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>接待 AI Agent<select value={draft.agentId ?? ''} onChange={(event) => update({ agentId: event.target.value })}>{state.agents.filter((agent) => agent.status === 'published').map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label></div>}{section === 'appearance' && <Appearance draft={draft} update={update} />}{section === 'display' && (type === 'web-widget' ? <WidgetSettings draft={draft} update={update} device={device} setDevice={setDevice} /> : <div className="copy-row"><Input value={publicUrl} readOnly /><Button icon={<IconCopy />} onClick={() => void navigator.clipboard.writeText(publicUrl)} /></div>)}<footer><Button onClick={() => setDraft(stored)}>取消</Button><Button type="primary" onClick={save}>保存</Button></footer></main><ChannelPreview type={type} draft={draft} messages={messages} input={input} setInput={setInput} send={() => { if (!input.trim()) return; setMessages([...messages, input.trim(), '已收到您的消息，我正在为您处理。']); setInput(''); }} device={device} /></div></section>;
}

function Appearance({ draft, update }: { draft: Channel; update: (patch: Partial<Channel>) => void }) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const upload = (file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => update({ brandAvatar: String(reader.result) }); reader.readAsDataURL(file); };
  return <div className="detail-fields"><label>品牌名称<Input maxLength={50} showWordLimit value={draft.brandName} onChange={(brandName) => update({ brandName })} /></label><label>签名<Input maxLength={50} showWordLimit value={draft.brandSignature} onChange={(brandSignature) => update({ brandSignature })} /></label><label>品牌 LOGO<div className="logo-upload" onClick={() => uploadRef.current?.click()}>{draft.brandAvatar ? <img src={draft.brandAvatar} alt="" /> : <IconUpload />}<input ref={uploadRef} type="file" accept="image/*" hidden onChange={(event) => upload(event.target.files?.[0])} /></div></label><label>主题色<div className="color-row"><input type="color" value={draft.themeColor} onChange={(event) => update({ themeColor: event.target.value })} /><Input value={draft.themeColor} onChange={(themeColor) => update({ themeColor })} /></div></label></div>;
}

function WidgetSettings({ draft, update, device, setDevice }: { draft: Channel; update: (patch: Partial<Channel>) => void; device: 'desktop' | 'mobile'; setDevice: (device: 'desktop' | 'mobile') => void }) {
  const mobile = device === 'mobile';
  const visible = mobile ? draft.widgetMobileVisible ?? true : draft.widgetDesktopVisible ?? true;
  const position = mobile ? draft.widgetMobilePosition ?? 'bottom-right' : draft.widgetPosition ?? 'bottom-right';
  const x = mobile ? draft.widgetMobileOffsetX ?? 16 : draft.widgetOffsetX ?? 24;
  const y = mobile ? draft.widgetMobileOffsetY ?? 16 : draft.widgetOffsetY ?? 24;
  return <div className="detail-fields"><label>允许域名<Input value={(draft.allowedDomains ?? []).join(', ')} onChange={(value) => update({ allowedDomains: value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="多个域名使用逗号分隔" /></label><div className="segmented"><button className={!mobile ? 'active' : ''} onClick={() => setDevice('desktop')}>桌面端</button><button className={mobile ? 'active' : ''} onClick={() => setDevice('mobile')}>移动端</button></div><label className="switch-row">展示<Switch checked={visible} onChange={(value) => update(mobile ? { widgetMobileVisible: value } : { widgetDesktopVisible: value })} /></label><label>按钮位置<select value={position} onChange={(event) => update(mobile ? { widgetMobilePosition: event.target.value as Channel['widgetMobilePosition'] } : { widgetPosition: event.target.value as Channel['widgetPosition'] })}><option value="bottom-left">左侧</option><option value="bottom-right">右侧</option></select></label><label>侧边距离<InputNumber min={0} max={100} value={x} onChange={(value) => update(mobile ? { widgetMobileOffsetX: value } : { widgetOffsetX: value })} /></label><label>底部距离<InputNumber min={0} max={100} value={y} onChange={(value) => update(mobile ? { widgetMobileOffsetY: value } : { widgetOffsetY: value })} /></label></div>;
}

function ChannelPreview({ type, draft, messages, input, setInput, send, device }: { type: ChannelType; draft: Channel; messages: string[]; input: string; setInput: (value: string) => void; send: () => void; device: 'desktop' | 'mobile' }) {
  return <aside className="preview"><h2>预览</h2><div className={`preview-stage is-${device}`}><div className="preview-chat" style={{ '--theme': draft.themeColor ?? '#1c1f26' } as React.CSSProperties}><header><span>{draft.brandAvatar ? <img src={draft.brandAvatar} alt="" /> : (draft.brandName || draft.name).slice(0, 1)}</span><div><strong>{draft.brandName || draft.name}</strong><small>{draft.brandSignature}</small></div></header><main>{messages.map((message, index) => <p key={`${message}-${index}`} className={index % 2 ? 'is-user' : ''}>{message}</p>)}</main><footer><Input value={input} onChange={setInput} onPressEnter={send} placeholder="输入您的消息..." /><Button type="primary" shape="circle" icon={<IconSend />} onClick={send} /></footer></div>{type === 'web-widget' && <button className="preview-fab" style={{ background: draft.themeColor }}><WidgetGlyph type={draft.widgetIcon} customIcon={draft.widgetCustomIcon} /></button>}</div></aside>;
}
