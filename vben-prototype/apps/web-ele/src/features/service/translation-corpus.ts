/**
 * 游戏客服译文语料池。
 *
 * 演示时不会调用真实翻译服务：词条命中时返回预置译文，未命中时从对应语言的
 * 客服话术池里取一条语气、长度接近的句子，避免出现 `[English] 原文` 这类占位。
 * 选句使用内容 hash，不依赖随机数，因此同一段输入每次都会得到同一条译文。
 */

export type CorpusCategory = 'closing' | 'progress' | 'question' | 'request' | 'thanks' | 'wait';

const pools: Record<string, Record<CorpusCategory, string[]>> = {
  简体中文: {
    question: [
      '您好，请问是充值问题还是登录问题？',
      '麻烦问一下，您是在哪个区服遇到的？',
      '请问这个问题是今天才出现的吗？',
      '您方便说一下使用的机型和网络吗？',
      '请问您之前有没有换绑过手机号？',
      '能具体描述一下提示的错误内容吗？',
      '这个问题是每次都会出现，还是偶发？',
      '请问您使用的是哪个渠道下载的客户端？',
    ],
    wait: [
      '稍等，我帮您查一下记录。',
      '请稍等一下，这边正在核对订单。',
      '我这边需要一点时间确认，马上回复您。',
      '给您添麻烦了，麻烦稍等片刻。',
      '正在为您加急核实，请稍候。',
      '不好意思让您久等了，我尽快处理。',
      '我先帮您登记，处理需要一点时间。',
      '这边正在同步数据，请您稍等。',
      '请您保持在线，我马上回来。',
    ],
    progress: [
      '已经提交工单，预计 24 小时内给您回复。',
      '工单已转给充值组，有结果会第一时间通知您。',
      '目前正在核查中，进度有更新我在这里同步。',
      '技术那边已经受理，正在排队处理。',
      '补发申请已经通过，请留意游戏内邮件。',
      '您的申诉已进入复核流程，请耐心等待。',
      '这边已经记录，稍后由专员跟进。',
      '已为您加急，正常一个工作日内出结果。',
    ],
    request: [
      '麻烦提供一下订单号和支付截图，我帮您核对。',
      '请把报错提示截图发过来，方便定位问题。',
      '方便发一下游戏 ID 和区服吗？',
      '麻烦提供充值时间，我查一下流水。',
      '请发送封禁提示的完整截图。',
      '可以发一下机型和系统版本吗？',
      '麻烦把礼包码和提示内容一起发我。',
      '请提供最近一次登录的时间和设备。',
    ],
    closing: [
      '还有其他可以帮到您的吗？',
      '如果问题还在，随时在这里联系我们。',
      '后续有进展我会继续在这里回复。',
      '祝您游戏愉快，有问题随时找我们。',
      '这边就先帮您记录到这里。',
      '感谢您的理解与配合。',
      '有问题随时发消息，我们看到会尽快回复。',
      '希望以上信息对您有帮助。',
    ],
    thanks: [
      '不客气，很高兴能帮到您。',
      '感谢您的耐心等待。',
      '谢谢您的理解，祝您玩得开心。',
      '应该的，后续有问题随时联系。',
      '感谢反馈，这对我们很重要。',
      '不客气，有需要再找我们。',
      '谢谢您的配合，问题已记录。',
      '感谢您对游戏的支持。',
    ],
  },
  英语: {
    question: [
      'Hi, is this about a recharge or a login issue?',
      'Could you tell me which server you are on?',
      'Did this start happening today?',
      'What device and network are you using?',
      'Have you changed your bound phone number before?',
      'Could you describe the error message you saw?',
      'Does this happen every time or only sometimes?',
      'Which store did you download the game from?',
    ],
    wait: [
      'One moment, let me check your order.',
      'Please hold on while I verify the payment record.',
      'It will take a moment to confirm, I will be right back.',
      'Sorry for the trouble, please give me a moment.',
      'I am escalating this now, please wait a moment.',
      'Sorry to keep you waiting, I am working on it.',
      'I will log this first, it may take a little time.',
      'The data is syncing now, please hold on.',
      'Please stay online, I will be back shortly.',
    ],
    progress: [
      'I have submitted a ticket, you should hear back within 24 hours.',
      'The ticket is with the recharge team, I will let you know once it is resolved.',
      'We are checking it now and I will update you here.',
      'The technical team has received it and is working on it.',
      'The replacement request is approved, please check your in-game mail.',
      'Your appeal is under review, thank you for your patience.',
      'This has been recorded and a specialist will follow up.',
      'I have marked it urgent, it usually takes one working day.',
    ],
    request: [
      'Please send the order number and payment screenshot so I can check.',
      'Could you share a screenshot of the error message?',
      'Please provide your game ID and server.',
      'What time did the recharge happen? I will check the transaction.',
      'Please send the full screenshot of the ban notice.',
      'Could you tell me your device model and system version?',
      'Please send the gift code and the exact error message.',
      'When and on which device did you last log in?',
    ],
    closing: [
      'Is there anything else I can help you with?',
      'If the issue persists, feel free to message us here.',
      'I will keep you posted here once there is progress.',
      'Enjoy your game, and reach out anytime you need help.',
      'I will leave a note here for now.',
      'Thank you for your understanding and cooperation.',
      'Message us anytime, we will reply as soon as we see it.',
      'Hope this information helps.',
    ],
    thanks: [
      'You are welcome, glad I could help.',
      'Thank you for your patience.',
      'Thanks for understanding, enjoy the game.',
      'Happy to help, feel free to reach out again.',
      'Thank you for the feedback, it matters to us.',
      'No problem, come back anytime.',
      'Thanks for your cooperation, the issue is recorded.',
      'Thank you for supporting the game.',
    ],
  },
  越南语: {
    question: [
      'Chào bạn, bạn đang gặp vấn đề nạp tiền hay đăng nhập?',
      'Bạn cho mình biết đang chơi ở server nào nhé?',
      'Vấn đề này mới xuất hiện hôm nay phải không?',
      'Bạn dùng máy gì và mạng nào vậy?',
      'Trước đây bạn đã đổi số điện thoại liên kết chưa?',
      'Bạn mô tả giúp mình nội dung thông báo lỗi nhé.',
      'Lỗi này xảy ra mỗi lần hay chỉ thỉnh thoảng?',
      'Bạn tải game từ kênh nào vậy?',
    ],
    wait: [
      'Chờ mình một chút, mình kiểm tra đơn hàng nhé.',
      'Bạn đợi mình xác minh giao dịch một lát nhé.',
      'Cần một chút thời gian xác nhận, mình sẽ phản hồi ngay.',
      'Xin lỗi vì bất tiện, bạn chờ mình một lát nhé.',
      'Mình đang chuyển gấp lên bộ phận liên quan, bạn chờ chút.',
      'Xin lỗi đã để bạn chờ lâu, mình đang xử lý.',
      'Mình ghi nhận trước, xử lý sẽ mất một chút thời gian.',
      'Dữ liệu đang đồng bộ, bạn đợi mình nhé.',
      'Bạn ở lại kênh này nhé, mình quay lại ngay.',
    ],
    progress: [
      'Mình đã gửi ticket, dự kiến trong 24 giờ sẽ có phản hồi.',
      'Ticket đã chuyển sang bộ phận nạp tiền, có kết quả mình báo ngay.',
      'Đang kiểm tra, có tiến độ mình cập nhật tại đây.',
      'Bộ phận kỹ thuật đã tiếp nhận và đang xử lý.',
      'Yêu cầu bổ sung đã được duyệt, bạn kiểm tra thư trong game nhé.',
      'Đơn kháng nghị đang được xem xét, mong bạn chờ thêm.',
      'Đã ghi nhận, chuyên viên sẽ theo dõi tiếp.',
      'Mình đã đánh dấu khẩn, thường trong một ngày làm việc có kết quả.',
    ],
    request: [
      'Bạn gửi mã đơn và ảnh chụp thanh toán giúp mình nhé.',
      'Bạn chụp lại thông báo lỗi gửi mình nhé.',
      'Bạn cho mình ID game và server nhé.',
      'Bạn nạp lúc mấy giờ? Mình tra giao dịch nhé.',
      'Bạn gửi ảnh chụp đầy đủ thông báo khóa tài khoản nhé.',
      'Bạn cho mình biết mẫu máy và phiên bản hệ điều hành nhé.',
      'Bạn gửi mã quà tặng và nội dung lỗi giúp mình nhé.',
      'Lần đăng nhập gần nhất là khi nào và trên máy nào?',
    ],
    closing: [
      'Bạn còn cần mình hỗ trợ gì nữa không?',
      'Nếu vấn đề vẫn còn, bạn nhắn lại tại đây nhé.',
      'Có tiến độ mình sẽ tiếp tục phản hồi tại đây.',
      'Chúc bạn chơi game vui vẻ, cần gì cứ nhắn mình.',
      'Mình xin ghi nhận đến đây trước nhé.',
      'Cảm ơn bạn đã thông cảm và hợp tác.',
      'Bạn nhắn tin bất cứ lúc nào, mình thấy sẽ trả lời ngay.',
      'Hy vọng thông tin trên hữu ích cho bạn.',
    ],
    thanks: [
      'Không có gì, mình rất vui được giúp bạn.',
      'Cảm ơn bạn đã chờ đợi.',
      'Cảm ơn bạn đã thông cảm, chúc bạn chơi vui.',
      'Đó là việc của mình, có vấn đề cứ liên hệ lại.',
      'Cảm ơn phản hồi của bạn, điều này rất quan trọng với mình.',
      'Không có gì, cần thì bạn quay lại nhé.',
      'Cảm ơn bạn đã hợp tác, vấn đề đã được ghi nhận.',
      'Cảm ơn bạn đã ủng hộ game.',
    ],
  },
  泰语: {
    question: [
      'สวัสดีค่ะ ปัญหาเรื่องเติมเงินหรือเข้าสู่ระบบคะ?',
      'ช่วยบอกหน่อยว่าเล่นอยู่เซิร์ฟเวอร์ไหนคะ?',
      'ปัญหาเพิ่งเกิดวันนี้ใช่ไหมคะ?',
      'ใช้มือถือรุ่นอะไรและเน็ตอะไรอยู่คะ?',
      'เคยเปลี่ยนเบอร์โทรที่ผูกไว้หรือยังคะ?',
      'ช่วยอธิบายข้อความแจ้งเตือนที่เห็นหน่อยค่ะ',
      'เป็นทุกครั้งหรือเป็นบางครั้งคะ?',
      'ดาวน์โหลดเกมจากช่องทางไหนคะ?',
    ],
    wait: [
      'รอสักครู่นะคะ กำลังตรวจสอบออเดอร์ให้ค่ะ',
      'ขอเวลาเช็กธุรกรรมสักนิดนะคะ',
      'ขอเวลายืนยันสักครู่ เดี๋ยวตอบกลับทันทีค่ะ',
      'ขออภัยที่ทำให้ไม่สะดวก รอสักครู่นะคะ',
      'กำลังส่งเรื่องแบบเร่งด่วน รอสักครู่ค่ะ',
      'ขออภัยที่ให้รอนาน กำลังดำเนินการอยู่ค่ะ',
      'บันทึกเรื่องไว้ก่อน ใช้เวลาสักครู่ค่ะ',
      'ข้อมูลกำลังซิงก์ รอสักครู่นะคะ',
      'อยู่ช่องนี้ไว้ก่อน เดี๋ยวกลับมาค่ะ',
    ],
    progress: [
      'ส่ง ticket แล้ว คาดว่าจะตอบกลับภายใน 24 ชั่วโมงค่ะ',
      'ส่งเรื่องให้ทีมเติมเงินแล้ว มีผลเมื่อไหร่จะแจ้งทันทีค่ะ',
      'กำลังตรวจสอบอยู่ มีความคืบหน้าจะอัปเดตที่นี่ค่ะ',
      'ทีมเทคนิครับเรื่องแล้วและกำลังดำเนินการค่ะ',
      'คำขอเติมของรางวัลได้รับการอนุมัติแล้ว ตรวจสอบจดหมายในเกมด้วยค่ะ',
      'คำอุทธรณ์อยู่ระหว่างตรวจสอบ ขอเวลาสักหน่อยนะคะ',
      'บันทึกไว้แล้ว ผู้เชี่ยวชาญจะติดตามต่อค่ะ',
      'ทำเรื่องเร่งด่วนแล้ว ปกติภายในหนึ่งวันทำการค่ะ',
    ],
    request: [
      'ส่งเลขคำสั่งซื้อและภาพสลิปโอนเงินมาด้วยนะคะ',
      'ส่งภาพแจ้งเตือน error มาให้หน่อยค่ะ',
      'ขอ ID เกมและเซิร์ฟเวอร์ด้วยค่ะ',
      'เติมเงินตอนกี่โมงคะ จะเช็กธุรกรรมให้ค่ะ',
      'ส่งภาพแจ้งเตือนแบนบัญชีแบบเต็มมาด้วยค่ะ',
      'บอกรุ่นมือถือและเวอร์ชันระบบด้วยค่ะ',
      'ส่งโค้ดของขวัญและข้อความแจ้งเตือนมาด้วยนะคะ',
      'เข้าสู่ระบบล่าสุดเมื่อไหร่และใช้เครื่องไหนคะ?',
    ],
    closing: [
      'มีอะไรให้ช่วยเพิ่มเติมไหมคะ?',
      'ถ้ายังมีปัญหา ทักมาที่นี่ได้เลยค่ะ',
      'มีความคืบหน้าจะตอบกลับที่นี่ต่อค่ะ',
      'ขอให้สนุกกับเกมนะคะ มีอะไรทักได้เลย',
      'บันทึกเรื่องไว้ถึงตรงนี้ก่อนนะคะ',
      'ขอบคุณที่เข้าใจและให้ความร่วมมือค่ะ',
      'ทักมาได้ทุกเวลา เห็นแล้วจะรีบตอบค่ะ',
      'หวังว่าข้อมูลนี้จะเป็นประโยชน์นะคะ',
    ],
    thanks: [
      'ยินดีค่ะ ดีใจที่ได้ช่วย',
      'ขอบคุณที่รอนะคะ',
      'ขอบคุณที่เข้าใจ ขอให้สนุกกับเกมนะคะ',
      'ยินดีค่ะ มีปัญหาทักกลับมาได้',
      'ขอบคุณสำหรับความคิดเห็น สำคัญกับเรามากค่ะ',
      'ไม่เป็นไรค่ะ กลับมาได้ทุกเมื่อ',
      'ขอบคุณที่ให้ความร่วมมือ บันทึกปัญหาแล้วค่ะ',
      'ขอบคุณที่สนับสนุนเกมของเราค่ะ',
    ],
  },
};

const hash = (value: string) => {
  let result = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16_777_619);
  }
  return Math.abs(result);
};

const detectCategory = (content: string): CorpusCategory => {
  const text = content.toLowerCase();
  if (/(截图|订单号|流水号|提供|发我|发一下|附件|screenshot|order|please send|provide|gửi|mã đơn|ảnh|vui lòng|kiểm tra|ส่ง|เลข|ภาพ|กรุณา)/.test(text)) return 'request';
  if (/(谢谢|感谢|辛苦|thank|thanks|cảm ơn|ขอบคุณ)/.test(text)) return 'thanks';
  if (/(稍等|等待|正在处理|请稍候|稍候|moment|hold on|wait|đợi|chờ|xác minh|รอ|สักครู่)/.test(text)) return 'wait';
  if (/(已提交|工单|进度|补发|审核|排查|ticket|progress|submitted|review|đã gửi|xử lý|tiến độ|ส่งเรื่อง|ดำเนินการ)/.test(text)) return 'progress';
  if (/[?？]|怎么|为什么|什么|多少|哪|多久|是否|是不是|能不能|掉线|卡顿|不到账|没到账|闪退|黑屏|封号|can you|could you|why|how|what|không|sao|bao lâu|ไหม|อะไร|ทำไม/.test(text)) return 'question';
  return 'closing';
};

/** 按目标语言和内容语气挑一条语料；结果稳定，不随刷新变化。 */
export const corpusTranslation = (content: string, language: string) => {
  const fallbackLanguage = language.includes('中文') ? '简体中文' : '英语';
  const set = pools[language] || pools[fallbackLanguage] || pools['简体中文']!;
  const category = detectCategory(content);
  const list = set[category];
  return list[hash(`${content}|${language}`) % list.length]!;
};
