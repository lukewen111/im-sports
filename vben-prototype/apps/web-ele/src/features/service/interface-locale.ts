export const INTERFACE_LANGUAGES = {
  'zh-CN': '简体中文',
  'en-US': 'English',
  'zh-TW': '繁體中文',
  'vi-VN': 'Tiếng Việt',
  'th-TH': 'ไทย',
  'km-KH': 'ភាសាខ្មែរ',
  'lo-LA': 'ລາວ',
  'my-MM': 'မြန်မာ',
} as const;

export type InterfaceLocale = keyof typeof INTERFACE_LANGUAGES;

export function normalizeInterfaceLocale(value: unknown): InterfaceLocale {
  return typeof value === 'string' && Object.hasOwn(INTERFACE_LANGUAGES, value)
    ? value as InterfaceLocale
    : 'zh-CN';
}

// 本轮扩充语言偏好选项，页面继续使用已有中英文资源。
export function interfaceMessageLocale(value: InterfaceLocale): 'en-US' | 'zh-CN' {
  return value === 'en-US' ? 'en-US' : 'zh-CN';
}
