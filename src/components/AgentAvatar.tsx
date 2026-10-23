import { IconRobot } from '@arco-design/web-react/icon';
import type { ChannelAgent } from '../types';

export function AgentAvatar({ agent, src, size = 32 }: { agent?: ChannelAgent; src?: string; size?: number }) {
  const avatar = src || agent?.avatar;
  return <span className="agent-avatar" style={{ width: size, height: size, flexBasis: size }}>{avatar ? <img src={avatar} alt="" /> : <IconRobot />}</span>;
}

