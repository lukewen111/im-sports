import type { Channel } from '../types';

export function WidgetGlyph({ type, customIcon }: { type: Channel['widgetIcon']; customIcon?: string }) {
  if (type === 'custom' && customIcon) return <img src={customIcon} alt="自定义图标" />;
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 3H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3v3l4-3h9a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" fill={type === 'message-dark' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" /><path d="M7 9h10M7 13h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

