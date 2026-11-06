/**
 * 游戏客服译文语料池（按长度选整段）。
 *
 * 演示时不会调用真实翻译服务：词条命中时返回预置译文，未命中时按输入长度
 * 选一档语义连贯的客服回复。每一档都是同一条回复的前缀，因此同一输出里
 * 不会出现重复句子，也不会前后不搭。长度档位全部由输入长度决定，不含随机数，
 * 同一段输入每次结果一致。
 */

const CJK = /\p{Script=Han}/u;
const LETTER = /[\p{L}\p{N}]/u;
const PUNCTUATION = /[\p{P}\p{S}]/u;

/** 输入里的汉字数量：中文按字数判断长度。 */
const countHan = (content: string) => [...content].filter(char => CJK.test(char)).length;

/** 输入里的词/音节数量：英文、越南语、泰语按空白分词。 */
const countTokens = (content: string) => content.trim().split(/\s+/).filter(token => LETTER.test(token)).length;

/** 单句占多少目标计量单位：中文按字符，其它语种按词。 */
const unitCount = (text: string, language: string) => (language === '简体中文'
  ? [...text].filter(char => !/\s/.test(char) && !PUNCTUATION.test(char)).length
  : countTokens(text));

/**
 * 每个语种的主干回复：句子由短到长按顺序递进，任意前缀都是一段通顺的客服话术，
 * 覆盖约 1 句短句 → 2 句 → 3–5 句的组合。中文按字数、其它语种按词数累加。
 */
const sequences: Record<string, string[]> = {
  简体中文: [
    '您好。',
    '好的。',
    '已收到您的消息。',
    '我们正在核实。',
    '有进展会立刻同步给您。',
    '感谢您的耐心等待。',
    '我们会持续跟进这个问题。',
    '处理完成后会第一时间通知您。',
    '如有其他问题，请随时联系我们。',
    '感谢您对我们的理解与支持。',
    '我们会尽快为您安排处理。',
    '您的订单已在处理流程中。',
    '后续进展会及时同步给您。',
    '再次感谢您的信任与配合。',
    '祝您一切顺利。',
  ],
  英语: [
    'Hello.',
    'Glad to help.',
    'We are checking this now.',
    'I will update you here shortly.',
    'Thanks for waiting.',
    'Our team is still working on it and will keep you posted.',
    'We are sorry for the delay and appreciate your understanding.',
    'If you need anything else, please let me know.',
    'Thank you for your patience and support.',
  ],
  越南语: [
    'Chào bạn.',
    'Cảm ơn bạn đã liên hệ.',
    'Mình đang kiểm tra vấn đề này.',
    'Bạn chờ mình một chút nhé.',
    'Mình sẽ cập nhật kết quả ngay khi có.',
    'Cảm ơn bạn đã kiên nhẫn chờ.',
    'Đội ngũ của mình vẫn đang xử lý.',
    'Chúng tôi sẽ theo dõi đến khi xong.',
    'Nếu cần thêm thông tin, bạn cứ nhắn nhé.',
    'Cảm ơn bạn đã thông cảm và hỗ trợ.',
  ],
  泰语: [
    'สวัสดี ค่ะ',
    'ขอบคุณ ที่ ติดต่อ ค่ะ',
    'กำลัง ตรวจสอบ เรื่อง นี้ อยู่ ค่ะ',
    'รบกวน รอ สักครู่ นะ ค่ะ',
    'จะ แจ้ง ผล ให้ ทราบ ทันที ค่ะ',
    'ทีม งาน ยัง กำลัง ดำเนินการ อยู่ ค่ะ',
    'ต้อง ใช้ เวลา อีก สักหน่อย ค่ะ',
    'ขอบคุณ ที่ รอ นะ ค่ะ',
    'หาก ต้องการ ข้อมูล เพิ่มเติม แจ้ง ได้ เลย ค่ะ',
    'ขอบคุณ สำหรับ ความ เข้าใจ ค่ะ',
  ],
};

/** 超短输入只出一条完整短句，不为凑长度额外加句。 */
const shortReplies: Record<string, string[]> = {
  简体中文: ['您好。', '已收到。'],
  英语: ['Hello.', 'Thank you.', 'Glad to help.'],
  越南语: ['Chào bạn.', 'Mình giúp nhé.'],
  泰语: ['สวัสดี ค่ะ', 'ช่วย ดูแล ค่ะ'],
};

/** 把主干回复切成 1 句、2 句、3 句……的整段，并记录每段长度。 */
const tiersFor = (language: string) => {
  const sentences = sequences[language] || sequences['英语']!;
  const tiers: { text: string; units: number }[] = [];
  let text = '';
  let units = 0;
  sentences.forEach((sentence, index) => {
    text = index === 0 ? sentence : `${text}${language === '简体中文' ? '' : ' '}${sentence}`;
    units += unitCount(sentence, language);
    tiers.push({ text, units });
  });
  return tiers;
};

const tiersCache = new Map<string, { text: string; units: number }[]>();
const tiers = (language: string) => {
  const cached = tiersCache.get(language);
  if (cached) return cached;
  const built = tiersFor(language);
  tiersCache.set(language, built);
  return built;
};

/** 按输入长度换算目标长度：中→英 0.7 词/字，英→中 2.2 字/词，越/泰按词数等比。 */
const targetUnits = (content: string, language: string) => {
  const tokens = countTokens(content);
  const han = countHan(content);
  if (language === '简体中文') {
    const raw = tokens * 2.2;
    return { target: Math.max(2, Math.min(120, Math.round(raw))), cap: 120, truncated: raw > 120 };
  }
  if (language === '英语') {
    const raw = (han || tokens) * 0.7;
    return { target: Math.max(1, Math.min(60, Math.round(raw))), cap: 60, truncated: raw > 60 };
  }
  const raw = (han || tokens) * 1;
  return { target: Math.max(2, Math.min(60, Math.round(raw))), cap: 60, truncated: raw > 60 };
};

const errorOf = (units: number, target: number) => Math.abs(units - target) / target;

/**
 * 选最接近目标长度的整段：优先选误差最小的一档；误差超过 25% 时，
 * 再在相邻档里加减一句收尾，取误差更小且不超上限的一档。
 */
export const corpusTranslation = (content: string, language: string) => {
  const lang = sequences[language] ? language : '英语';
  const { target, cap, truncated } = targetUnits(content, lang);
  let text: string;

  if (target <= 3) {
    const replies = shortReplies[lang] || shortReplies['英语']!;
    const closest = replies
      .map(reply => ({ reply, diff: Math.abs(unitCount(reply, lang) - target) }))
      .sort((left, right) => left.diff - right.diff)[0]!;
    text = closest.reply;
  }
  else {
    const list = tiers(lang);
    let index = list.reduce((best, tier, current) => (
      Math.abs(tier.units - target) < Math.abs(list[best]!.units - target) ? current : best
    ), 0);

    if (errorOf(list[index]!.units, target) > 0.25) {
      [index - 1, index + 1].forEach((candidate) => {
        const current = list[index]!;
        const next = list[candidate];
        if (!next || next.units > cap) return;
        if (errorOf(next.units, target) < errorOf(current.units, target)) index = candidate;
      });
    }
    while (list[index]!.units > cap && index > 0) index -= 1;
    text = list[index]!.text;
  }

  if (!truncated) return text;
  return text.replace(/[。.!?？]$/, '…');
};
