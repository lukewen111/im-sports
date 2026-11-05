import { computed } from 'vue';

import { usePrototypeAccess } from '#/features/team/access-store';
import { avatarColor, avatarText } from '#/features/team/team-constants';

export interface ProfileIdentity {
  /** 资料显示名，空资料时回退为「—」 */
  displayName: string;
  /** 头像图片地址；为空表示使用「取色 + 首字」态 */
  avatarUrl: string;
  /** 头像为空时展示的首字 */
  initial: string;
  /** 头像为空时的背景色，按成员 id 从统一调色板取色 */
  avatarColor: string;
}

/**
 * 由成员资料解析出统一的显示名与头像样式。
 * 唯一数据源是 teamStore.members（由 demo-store.savePersonal 写入），
 * 顶栏、个人资料页及其它模块都应通过本函数取值，避免各自维护副本。
 */
export function resolveProfileIdentity(input: {
  avatar?: string;
  id?: string;
  name?: string;
}): ProfileIdentity {
  const displayName = input.name?.trim() || '—';
  const safeName = displayName === '—' ? '' : displayName;
  return {
    displayName,
    avatarUrl: input.avatar?.trim() || '',
    initial: avatarText(safeName),
    avatarColor: avatarColor(input.id || 'empty'),
  };
}

/** 读取当前登录成员的统一资料（昵称、头像、首字、取色） */
export function useProfileIdentity() {
  const access = usePrototypeAccess();
  return computed(() => {
    const member = access.current;
    return {
      member,
      ...resolveProfileIdentity({
        avatar: member?.avatar,
        id: member?.id,
        name: member?.name,
      }),
    };
  });
}
