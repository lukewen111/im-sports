import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Message, Spin } from '@arco-design/web-react';
import { IconClose, IconFile, IconImage, IconMinus, IconSend, IconSound, IconSoundFill } from '@arco-design/web-react/icon';
import { useParams } from 'react-router-dom';
import { useChannelStore } from '../store';
import type { ChannelConversation, ChannelMessage, ChannelType } from '../types';
import { AgentAvatar } from '../components/AgentAvatar';
import { WidgetGlyph } from '../components/WidgetGlyph';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function getVisitorId(channelId: string) {
  const key = `im-sports:visitor:${channelId}`;
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = `visitor-${crypto.randomUUID()}`;
  localStorage.setItem(key, created);
  return created;
}

function fileType(file: File): ChannelMessage['type'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function MessageContent({ message }: { message: ChannelMessage }) {
  if (message.type === 'image' && message.fileUrl) return <img className="client-message-image" src={message.fileUrl} alt={message.fileName || '图片消息'} />;
  if (message.type === 'video' && message.fileUrl) return <video className="client-message-media" src={message.fileUrl} controls />;
  if (message.type === 'audio' && message.fileUrl) return <audio className="client-message-audio" src={message.fileUrl} controls />;
  if (message.type === 'file' && message.fileUrl) return <a className="client-file-link" href={message.fileUrl} download={message.fileName}><IconFile />{message.fileName || '下载文件'}</a>;
  return <span>{message.content}</span>;
}

export function ChannelClientPage({ type }: { type: Extract<ChannelType, 'web-widget' | 'chat-page'> }) {
  const { channelId = '' } = useParams();
  const { state, dispatch } = useChannelStore();
  const [visitorId] = useState(() => getVisitorId(channelId));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(type === 'chat-page');
  const [muted, setMuted] = useState(() => localStorage.getItem(`im-sports:muted:${channelId}`) === 'true');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const channel = state.channels.find((item) => item.id === channelId && item.type === type);
  const agent = state.agents.find((item) => item.id === channel?.agentId);
  const conversation = state.conversations.find((item) => item.channelId === channelId && item.visitorId === visitorId);
  const available = Boolean(channel?.enabled && agent?.status === 'published' && agent.acceptingChats);

  useEffect(() => {
    if (type === 'web-widget' && channel && channel.installStatus !== 'success') {
      dispatch({ type: 'channel.connected', id: channel.id, checkedAt: new Date().toISOString() });
    }
  }, [channel, dispatch, type]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length, open]);

  const title = channel?.brandName || channel?.name || '在线客服';
  const signature = channel?.brandSignature || '有问题？我们随时为您提供帮助。';
  const theme = channel?.themeColor || '#1664ff';

  const ensureConversation = () => {
    if (conversation) return conversation.id;
    const id = `conversation-${crypto.randomUUID()}`;
    const created: ChannelConversation = {
      id,
      visitorId,
      channelId,
      agentId: agent?.id || '',
      state: 'processing',
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    dispatch({ type: 'conversation.upsert', conversation: created });
    return id;
  };

  const appendMessage = (conversationId: string, message: Omit<ChannelMessage, 'id' | 'sentAt'>) => {
    dispatch({
      type: 'conversation.message',
      conversationId,
      message: { ...message, id: `message-${crypto.randomUUID()}`, sentAt: new Date().toISOString() },
    });
  };

  const reply = (conversationId: string) => {
    window.setTimeout(() => {
      appendMessage(conversationId, { role: 'agent', content: '您好，已收到您的消息，我会继续为您处理。', type: 'text' });
      setSending(false);
    }, 600);
  };

  const sendText = () => {
    const content = input.trim();
    if (!content || !available || sending) return;
    const id = ensureConversation();
    appendMessage(id, { role: 'customer', content, type: 'text' });
    setInput('');
    setSending(true);
    reply(id);
  };

  const sendFiles = async (files: FileList | null) => {
    if (!files?.length || !available) return;
    const selected = Array.from(files).slice(0, MAX_FILES);
    if (selected.some((file) => file.size > MAX_FILE_SIZE)) {
      Message.error('单个文件不能超过 20 MB');
      return;
    }
    const id = ensureConversation();
    setSending(true);
    try {
      for (const file of selected) {
        appendMessage(id, {
          role: 'customer', content: file.name, type: fileType(file), fileUrl: await readFile(file), fileName: file.name, fileSize: file.size,
        });
      }
      reply(id);
    } catch {
      setSending(false);
      Message.error('文件读取失败，请重试');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(`im-sports:muted:${channelId}`, String(next));
  };

  const messages = useMemo(() => conversation?.messages || [], [conversation]);
  const panel = (
    <section className={`client-panel ${type === 'chat-page' ? 'client-panel-page' : ''}`} style={{ '--client-theme': theme } as React.CSSProperties}>
      <header className="client-header">
        <div className="client-brand">
          <AgentAvatar agent={agent} src={channel?.brandAvatar} size={40} />
          <div><strong>{title}</strong><span>{signature}</span></div>
        </div>
        <div className="client-header-actions">
          <Button aria-label={muted ? '开启声音' : '关闭声音'} icon={muted ? <IconSound /> : <IconSoundFill />} shape="circle" type="text" onClick={toggleMuted} />
          {type === 'web-widget' && <Button aria-label="收起窗口" icon={<IconMinus />} shape="circle" type="text" onClick={() => setOpen(false)} />}
        </div>
      </header>
      <main className="client-messages">
        {!available ? <Empty description="当前客服暂不可用" /> : messages.length === 0 ? (
          <div className="client-welcome"><AgentAvatar agent={agent} src={channel?.brandAvatar} size={56} /><strong>{title}</strong><span>{signature}</span></div>
        ) : messages.map((message) => (
          <div className={`client-message-row ${message.role}`} key={message.id}>
            {message.role === 'agent' && <AgentAvatar agent={agent} src={channel?.brandAvatar} size={28} />}
            <div className="client-message-bubble"><MessageContent message={message} /><time>{new Date(message.sentAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time></div>
          </div>
        ))}
        {sending && <div className="client-typing"><Spin dot size={4} /> 正在回复</div>}
        <div ref={endRef} />
      </main>
      <footer className="client-composer">
        <input ref={fileRef} hidden multiple type="file" onChange={(event) => void sendFiles(event.target.files)} />
        <Button aria-label="添加附件" icon={<IconImage />} shape="circle" type="text" disabled={!available} onClick={() => fileRef.current?.click()} />
        <textarea value={input} disabled={!available} rows={1} placeholder={available ? '输入您的消息…' : '当前不可发送消息'} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendText(); } }} />
        <Button aria-label="发送消息" icon={<IconSend />} shape="circle" type="primary" disabled={!input.trim() || !available || sending} onClick={sendText} />
      </footer>
    </section>
  );

  if (!channel) return <div className="client-not-found"><Empty description="渠道不存在或已删除" /></div>;
  if (type === 'chat-page') return <div className="chat-page-client">{panel}</div>;
  return <div className={`widget-client ${channel.widgetPosition || 'bottom-right'}`} style={{ '--widget-x': `${channel.widgetOffsetX || 24}px`, '--widget-y': `${channel.widgetOffsetY || 24}px` } as React.CSSProperties}>
    {open ? panel : <button className="widget-launcher" style={{ background: theme }} aria-label="打开客服窗口" onClick={() => setOpen(true)}><WidgetGlyph type={channel.widgetIcon || 'message'} customIcon={channel.widgetCustomIcon} /><span className="widget-unread">1</span></button>}
    {open && <button className="widget-close-mobile" aria-label="关闭客服窗口" onClick={() => setOpen(false)}><IconClose /></button>}
  </div>;
}
