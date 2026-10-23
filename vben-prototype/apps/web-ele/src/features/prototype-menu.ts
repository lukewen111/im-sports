import type { MenuRecordRaw } from '@vben/types';

export const prototypeMenus: MenuRecordRaw[] = [
  { disabled: true, icon: 'lucide:bot', name: 'AI客服', path: '/prototype/ai' },
  { disabled: true, icon: 'lucide:gauge', name: '数据总览', path: '/prototype/dashboard' },
  { disabled: true, icon: 'lucide:message-circle', name: '客户咨询', path: '/prototype/inbox' },
  { disabled: true, icon: 'lucide:clock-3', name: '客户列表', path: '/prototype/customers' },
  { disabled: true, icon: 'lucide:eye', name: '客服监控', path: '/prototype/monitor' },
  { disabled: true, icon: 'lucide:square-pen', name: '工单列表', path: '/prototype/tickets' },
  { disabled: true, icon: 'lucide:user-round', name: '用户管理', path: '/prototype/users' },
  { disabled: true, icon: 'lucide:users-round', name: '团队管理', path: '/prototype/teams' },
  { disabled: true, icon: 'lucide:headphones', name: '客服信息管理', path: '/prototype/service' },
  { icon: 'lucide:panels-top-left', name: '渠道管理', path: '/channels' },
];
