// Code.gs - PAPRAI แจ้งซ่อม
// ป้าไพรผู้ช่วยรับแจ้งซ่อมอัจฉริยะ
// โรงเรียนสาธิต มหาวิทยาลัยศิลปากร (มัธยมศึกษา)
// PAPRAI = Professional Academic Assistant for Pedagogy, Research And Innovation
// Version: 3.0 - PAPRAI Persona Edition

// =================================
// SECTION 1: WEBHOOK & EVENT ROUTING
// =================================

/**
 * Webhook handler สำหรับรับข้อความจาก LINE
 */
function doPost(e) {
  const startTime = new Date();
  console.log(`🌐 Webhook received at ${startTime.toISOString()}`);

  try {
    if (!e.postData || !e.postData.contents) {
      console.error('❌ Invalid request format');
      return createResponse('Invalid request');
    }

    const contents = JSON.parse(e.postData.contents);

    if (!contents.events || !Array.isArray(contents.events)) {
      console.error('❌ No events found');
      return createResponse('No events');
    }

    console.log(`📨 Processing ${contents.events.length} event(s)`);

    for (const event of contents.events) {
      processEvent(event);
    }

    const processingTime = new Date() - startTime;
    console.log(`✅ Completed in ${processingTime}ms`);

    return createResponse({ status: 'success', processed: contents.events.length });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return createResponse('Internal error');
  }
}

/**
 * จัดการแต่ละ event ที่รับมาจาก LINE
 */
function processEvent(event) {
  try {
    const { type, replyToken, source } = event;
    const userId      = source?.userId;
    const isGroupChat = source?.type === 'group';
    const isRoomChat  = source?.type === 'room';
    const isPrivateChat = !isGroupChat && !isRoomChat;

    console.log(`🔄 Event: ${type}, Context: ${source?.type || 'unknown'}, User: ${userId || 'unknown'}`);

    if (type === 'message') {
      if (isGroupChat || isRoomChat) {
        handleGroupMessage(event);
      } else if (isPrivateChat) {
        handlePrivateMessage(event);
      }
    } else if (type === 'follow') {
      handleFollow(replyToken, userId);
    } else if (type === 'join') {
      handleJoin(replyToken);
    } else {
      console.log(`⚠️ Unhandled event: ${type}`);
    }

  } catch (error) {
    console.error(`❌ Error processing event:`, error);
  }
}

// =================================
// SECTION 2: GROUP CHAT HANDLING
// =================================

/**
 * จัดการข้อความใน Group Chat
 * ป้าไพรตอบเฉพาะคำสั่ง /request, /help, /stats เท่านั้น
 */
function handleGroupMessage(event) {
  const { message, replyToken, source } = event;

  if (message.type !== 'text') {
    console.log(`⚠️ Non-text message ignored: ${message.type}`);
    return;
  }

  const messageText = message.text.trim();
  const userId  = source.userId || 'unknown';
  const groupId = source.groupId || source.roomId || 'unknown';

  console.log(`📝 Group message: "${messageText}" from ${userId}`);

  if (messageText.toLowerCase().startsWith('/request ')) {
    const requestText = messageText.substring(9).trim();

    if (requestText.length < 10) {
      replyMessage(
        replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
        `รบกวนระบุรายละเอียดคำร้องให้ครบถ้วนกว่านี้หน่อยได้ไหมคะ\n` +
        `(อย่างน้อย 10 ตัวอักษรนะคะ)\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 ตัวอย่างที่ถูกต้อง:\n` +
        `/request แอร์ห้อง 301 เสีย ช่วยตรวจสอบด้วยค่ะ\n` +
        `/request โปรเจคเตอร์ห้องประชุมใช้ไม่ได้`,
        message.quoteToken
      );
      return;
    }

    console.log(`📋 Request command detected: "${requestText}"`);

    if (userId && userId !== 'unknown') {
      startLoading(userId);
    }

    processRequest(requestText, replyToken, groupId, userId, message.quoteToken);

  } else if (messageText.toLowerCase() === '/help') {
    sendGroupHelpMessage(replyToken);

  } else if (messageText.toLowerCase() === '/stats') {
    sendGroupStats(replyToken, groupId);

  } else {
    // ข้อความสนทนาทั่วไป — ป้าไพรไม่ตอบ เพื่อไม่รบกวนการสนทนา
    console.log('💬 Regular chat message - ignored by ป้าไพร');
  }
}

/**
 * ป้าไพรแนะนำวิธีใช้งานในกลุ่ม
 */
function sendGroupHelpMessage(replyToken) {
  const helpText =
    `สวัสดีค่ะ ป้าไพรยินดีช่วยเหลือนะคะ 😊\n\n` +
    `🔧 ป้าไพรคือระบบรับแจ้งซ่อมอัจฉริยะ\n` +
    `ของโรงเรียนสาธิต ม.ศิลปากร (มัธยมศึกษา)\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📝 วิธีแจ้งซ่อม / ส่งคำร้อง\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `/request [รายละเอียดคำร้อง]\n\n` +
    `💡 ตัวอย่าง:\n` +
    `• /request แอร์ห้อง 301 เสีย ช่วยตรวจสอบด้วยค่ะ\n` +
    `• /request อินเทอร์เน็ตในห้องประชุมเชื่อมต่อไม่ได้\n` +
    `• /request โปรเจคเตอร์ชั้น 3 ไม่ติด\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔧 คำสั่งอื่นๆ\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• /help  — แสดงคู่มือนี้\n` +
    `• /stats — ดูสถิติคำร้องของกลุ่ม\n\n` +
    `📌 หมายเหตุ:\n` +
    `ป้าไพรตอบเฉพาะคำสั่งเท่านั้นนะคะ\n` +
    `ข้อความสนทนาทั่วไปป้าไพรจะไม่รบกวนค่ะ\n\n` +
    `มีอะไรให้ป้าไพรช่วยแจ้งซ่อมไหมคะ? 🛠️`;

  replyMessage(replyToken, helpText);
}

// =================================
// SECTION 3: PRIVATE CHAT HANDLING
// =================================

/**
 * จัดการข้อความส่วนตัว
 * ตรวจสอบ COMMAND TYPE ก่อน แล้วค่อย route ตาม role
 */
function handlePrivateMessage(event) {
  const { message, replyToken, source } = event;
  const userId = source.userId || 'unknown';

  if (message.type !== 'text') {
    console.log(`⚠️ Non-text message ignored: ${message.type}`);
    return;
  }

  const messageText = message.text.trim();
  const command     = messageText.toLowerCase().trim();

  console.log(`💬 Private message from ${userId}: "${messageText}"`);

  const isOwner  = isOwnerUser(userId);
  const staffInfo = isStaffUser(userId);

  // --- คำสั่ง Registration ก่อนเสมอ ---
  if (handleStaffRegistration(messageText, replyToken, userId)) {
    return;
  }

  // --- คำสั่ง Staff: /complete, /mystaffid ---
  const isStaffCommand = command.startsWith('/complete ') ||
                         command === '/mystaffid';

  if (isStaffCommand && staffInfo) {
    console.log(`🎯 Staff command: ${staffInfo.name}`);
    handleStaffCommand(messageText, replyToken, userId, staffInfo);
    return;
  }

  if (isStaffCommand && !staffInfo) {
    replyMessage(replyToken,
      `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
      `คำสั่งนี้สำหรับเจ้าหน้าที่ที่ลงทะเบียนแล้วเท่านั้นค่ะ\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 หากคุณเป็นเจ้าหน้าที่ กรุณาลงทะเบียนก่อนนะคะ\n\n` +
      `/reg staff [StaffID]\n\n` +
      `ตัวอย่าง: /reg staff STF001\n\n` +
      `หากยังไม่มี Staff ID กรุณาติดต่อผู้ดูแลระบบด้วยนะคะ 🙏`
    );
    return;
  }

  // --- คำสั่ง Owner-specific ---
  const isOwnerCommand = command === '/pending'  ||
                         command === '/config'   ||
                         command === '/stats'    ||
                         command === '/help'     ||
                         command.startsWith('/status ');

  if (isOwnerCommand && isOwner) {
    console.log('🔧 Owner command');
    handleOwnerMessage(messageText, replyToken, userId);
    return;
  }

  if (isOwnerCommand && !isOwner) {
    replyMessage(replyToken,
      `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
      `คำสั่งนี้สำหรับผู้ดูแลระบบเท่านั้นค่ะ\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 หากคุณเป็นเจ้าหน้าที่ ใช้คำสั่งเหล่านี้ได้ค่ะ:\n\n` +
      `• /mystaffid        — ดูข้อมูลของคุณ\n` +
      `• /complete [ID]    — อัพเดทสถานะงาน`
    );
    return;
  }

  // --- ข้อความทั่วไปตาม role ---
  if (isOwner) {
    handleOwnerMessage(messageText, replyToken, userId);
  } else if (staffInfo) {
    replyMessage(replyToken,
      `สวัสดีค่ะ คุณ${staffInfo.name} 👋\n\n` +
      `ป้าไพรยินดีช่วยเหลือนะคะ 😊\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 คำสั่งที่ใช้ได้\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `• /mystaffid        — ดูข้อมูลของคุณ\n` +
      `• /complete [ID]    — อัพเดทสถานะงาน\n` +
      `• /unreg            — ยกเลิกการลงทะเบียน\n\n` +
      `💡 ตัวอย่าง:\n` +
      `/complete 20251104102548\n\n` +
      `มีอะไรให้ป้าไพรช่วยไหมคะ? 🙏`
    );
  } else {
    sendPrivateChatInfo(replyToken);
  }
}

/**
 * จัดการข้อความจากผู้ดูแลระบบ
 */
function handleOwnerMessage(messageText, replyToken, userId) {
  const command = messageText.toLowerCase().trim();

  if (command === '/help') {
    sendOwnerHelpMessage(replyToken);
  } else if (command === '/stats') {
    sendOverallStats(replyToken);
  } else if (command.startsWith('/status ')) {
    const requestId = command.substring(8).trim();
    sendRequestStatus(replyToken, requestId);
  } else if (command === '/config') {
    sendConfigInfo(replyToken);
  } else if (command === '/pending') {
    showPendingStaffRegistrations(replyToken);
  } else {
    replyMessage(replyToken,
      `สวัสดีค่ะ ยินดีต้อนรับผู้ดูแลระบบนะคะ 👋\n\n` +
      `ป้าไพรพร้อมช่วยเหลือเสมอค่ะ 😊\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔧 คำสั่งที่ใช้ได้\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `• /help             — คู่มือคำสั่งทั้งหมด\n` +
      `• /stats            — สถิติรวม\n` +
      `• /config           — การตั้งค่าระบบ\n` +
      `• /pending          — เจ้าหน้าที่ที่ยังไม่ลงทะเบียน\n` +
      `• /status [ID]      — ตรวจสอบสถานะคำร้อง`
    );
  }
}

/**
 * คู่มือคำสั่งสำหรับผู้ดูแลระบบ
 */
function sendOwnerHelpMessage(replyToken) {
  const helpText =
    `🔧 คู่มือผู้ดูแลระบบ PAPRAI แจ้งซ่อม\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 ดูข้อมูลและสถิติ\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• /stats             — สถิติคำร้องทั้งหมด\n` +
    `• /status [ID]       — ตรวจสอบสถานะคำร้อง\n` +
    `• /config            — การตั้งค่าระบบ\n` +
    `• /pending           — เจ้าหน้าที่ที่ยังไม่ลงทะเบียน\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 คำสั่งสำหรับเจ้าหน้าที่\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• /reg staff [ID]    — ลงทะเบียน\n` +
    `• /mystaffid         — ดูข้อมูลตัวเอง\n` +
    `• /complete [ID]     — อัพเดทสถานะงาน\n\n` +
    `💡 หากต้องการจัดการขั้นสูง\n` +
    `ใช้ Apps Script Editor ได้เลยนะคะ 😊`;

  replyMessage(replyToken, helpText);
}

/**
 * แสดงข้อมูล Config สำหรับผู้ดูแลระบบ
 */
function sendConfigInfo(replyToken) {
  try {
    const config = getConfig();
    const stats  = getUsageStats();

    replyMessage(replyToken,
      `⚙️ การตั้งค่าระบบ PAPRAI แจ้งซ่อม\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 AI Model: ${config.AI_MODEL}\n` +
      `📊 Google Sheets: ${config.STAFF_SHEET_ID ? '✅ เชื่อมต่อแล้ว' : '❌ ยังไม่ได้ตั้งค่า'}\n\n` +
      `📈 สถิติการใช้งาน:\n` +
      `• คำร้องทั้งหมด: ${stats.success ? stats.stats.total : 'N/A'}\n\n` +
      `⏰ เวลาปัจจุบัน: ${formatThaiDateTime(new Date())}\n\n` +
      `💡 ดูรายละเอียดเพิ่มเติมได้ที่\n` +
      `Apps Script Editor นะคะ 😊`
    );

  } catch (error) {
    console.error('Error getting config info:', error);
    replyMessage(replyToken,
      `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
      `ไม่สามารถดึงข้อมูลการตั้งค่าได้ในขณะนี้ค่ะ\n` +
      `กรุณาลองใหม่อีกครั้งนะคะ`
    );
  }
}

/**
 * แสดงข้อมูลสำหรับผู้ใช้ทั่วไปในแชทส่วนตัว
 */
function sendPrivateChatInfo(replyToken) {
  replyMessage(replyToken,
    `สวัสดีค่ะ ยินดีต้อนรับสู่ PAPRAI แจ้งซ่อมนะคะ 😊\n\n` +
    `ป้าไพรคือผู้ช่วยรับแจ้งซ่อมอัจฉริยะ\n` +
    `ของโรงเรียนสาธิต ม.ศิลปากร (มัธยมศึกษา) ค่ะ\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📝 สำหรับครูและบุคลากร\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `ป้าไพรทำงานในกลุ่ม LINE ค่ะ\n` +
    `เชิญป้าไพรเข้ากลุ่มแล้วส่งคำร้องได้เลยนะคะ\n\n` +
    `💡 วิธีแจ้งซ่อม:\n` +
    `/request [รายละเอียดที่ต้องการซ่อม]\n\n` +
    `ตัวอย่าง:\n` +
    `/request แอร์ห้อง 301 เสีย ช่วยตรวจสอบด้วยค่ะ\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔧 สำหรับเจ้าหน้าที่ฝ่ายซ่อมบำรุง\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `หากคุณเป็นเจ้าหน้าที่ กรุณาลงทะเบียนด้วยนะคะ\n\n` +
    `/reg staff [Staff ID]\n\n` +
    `ตัวอย่าง: /reg staff STF001\n\n` +
    `หลังลงทะเบียนแล้วป้าไพรจะส่งคำร้องมาให้\n` +
    `พร้อมให้อัพเดทสถานะได้ด้วยคำสั่ง\n` +
    `/complete [request_id]\n\n` +
    `มีอะไรให้ป้าไพรช่วยเพิ่มเติมไหมคะ? 🙏`
  );
}

/**
 * ต้อนรับเมื่อมีคนเพิ่มป้าไพรเป็นเพื่อน
 */
function handleFollow(replyToken, userId) {
  console.log(`👋 New follower: ${userId}`);

  const isOwner  = isOwnerUser(userId);
  const staffInfo = isStaffUser(userId);

  let welcomeMessage;

  if (isOwner) {
    welcomeMessage =
      `สวัสดีค่ะ ยินดีต้อนรับผู้ดูแลระบบนะคะ! 🎉\n\n` +
      `ป้าไพร PAPRAI แจ้งซ่อม พร้อมช่วยงานคุณแล้วค่ะ 😊\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ สิ่งที่คุณทำได้\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `• ดูสถิติและรายงานคำร้องทั้งหมด\n` +
      `• ตรวจสอบสถานะคำร้องแต่ละรายการ\n` +
      `• จัดการเจ้าหน้าที่ในระบบ\n\n` +
      `พิมพ์ /help เพื่อดูคำสั่งทั้งหมดได้เลยนะคะ 🔧`;

  } else if (staffInfo) {
    welcomeMessage =
      `สวัสดีค่ะ คุณ${staffInfo.name}! 👋\n\n` +
      `ป้าไพรยินดีต้อนรับเจ้าหน้าที่ฝ่าย ${staffInfo.department} นะคะ 🎉\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 คำสั่งสำหรับคุณ\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `• /complete [ID]    — ปิดคำร้องที่เสร็จแล้ว\n` +
      `• /myrequests       — ดูคำร้องที่ได้รับมอบหมาย\n` +
      `• /mystaffid        — ดูข้อมูลของคุณ\n\n` +
      `เมื่อมีคำร้องใหม่ ป้าไพรจะแจ้งเตือนมาให้ทันทีนะคะ 🔔`;

  } else {
    welcomeMessage =
      `สวัสดีค่ะ ยินดีต้อนรับสู่ PAPRAI แจ้งซ่อม! 🎉\n\n` +
      `ป้าไพรคือผู้ช่วยรับแจ้งซ่อมอัจฉริยะ\n` +
      `ของโรงเรียนสาธิต มหาวิทยาลัยศิลปากร (มัธยมศึกษา) ค่ะ\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 สำหรับครูและบุคลากร\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `1️⃣ เชิญป้าไพรเข้ากลุ่ม LINE\n` +
      `2️⃣ ส่งคำร้องด้วย:\n` +
      `   /request [รายละเอียด]\n\n` +
      `💡 ตัวอย่าง:\n` +
      `/request แอร์ห้อง 301 เสีย\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔧 สำหรับเจ้าหน้าที่\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `รับ Staff ID จากผู้ดูแลระบบ แล้วลงทะเบียนด้วย:\n` +
      `/reg staff [StaffID]\n\n` +
      `ป้าไพรพร้อมช่วยเหลือทุกเวลาค่ะ 🙏`;
  }

  replyMessage(replyToken, welcomeMessage);
  console.log(`✅ Welcome message sent to ${userId}`);
}

/**
 * ต้อนรับเมื่อป้าไพรถูกเชิญเข้ากลุ่ม
 */
function handleJoin(replyToken) {
  console.log('🏠 ป้าไพรเข้าร่วมกลุ่มแล้ว');

  replyMessage(replyToken,
    `สวัสดีทุกท่านค่ะ! 👋\n\n` +
    `ป้าไพร ผู้ช่วยรับแจ้งซ่อมอัจฉริยะขอเข้าร่วมด้วยนะคะ 🤖✨\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛠️ วิธีแจ้งซ่อม / ส่งคำร้อง\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `/request [รายละเอียดคำร้อง]\n\n` +
    `💡 ตัวอย่าง:\n` +
    `• /request แอร์ห้อง 301 เสีย ช่วยตรวจสอบด้วยค่ะ\n` +
    `• /request อินเทอร์เน็ตในห้องประชุมเชื่อมต่อไม่ได้\n` +
    `• /request โปรเจคเตอร์ชั้น 3 ไฟไม่ติด\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 หมายเหตุ\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• ป้าไพรตอบเฉพาะคำสั่งเท่านั้นค่ะ\n` +
    `• การสนทนาในกลุ่มป้าไพรจะไม่รบกวนนะคะ\n` +
    `• คำร้องจะส่งถึงเจ้าหน้าที่โดยอัตโนมัติค่ะ\n\n` +
    `ป้าไพรพร้อมช่วยเหลือทุกท่านแล้วนะคะ 🙏`
  );
}

// =================================
// SECTION 4: STAFF REGISTRATION
// =================================

/**
 * จัดการคำสั่ง Registration ทั้งหมด
 * คืนค่า true ถ้าประมวลผลคำสั่งเสร็จแล้ว
 */
function handleStaffRegistration(messageText, replyToken, userId) {
  const command = messageText.toLowerCase().trim();

  if (command.startsWith('/reg staff ')) {
    const staffId = command.substring(11).trim().toUpperCase();
    registerStaff(staffId, userId, replyToken);
    return true;
  }

  if (command === '/unreg') {
    unregisterStaff(userId, replyToken);
    return true;
  }

  if (command === '/mystaffid') {
    showMyStaffInfo(userId, replyToken);
    return true;
  }

  if (command === '/pending' && !isOwnerUser(userId)) {
    replyMessage(replyToken,
      `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
      `คำสั่ง /pending ใช้ได้เฉพาะผู้ดูแลระบบค่ะ\n\n` +
      `💡 หากต้องการดูข้อมูลของคุณ ใช้คำสั่งนี้ได้เลยค่ะ:\n` +
      `/mystaffid`
    );
    return true;
  }

  return false;
}

/**
 * ลงทะเบียน Staff ด้วย Staff ID
 */
function registerStaff(staffId, userId, replyToken) {
  console.log(`🔐 Staff registration: ${staffId} by ${userId}`);

  try {
    if (!staffId || staffId.length < 3) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `รูปแบบ Staff ID ไม่ถูกต้องค่ะ\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 รูปแบบที่ถูกต้อง:\n` +
        `/reg staff STF001\n` +
        `/reg staff STF002\n\n` +
        `กรุณาระบุ Staff ID ตามที่ได้รับแจ้งนะคะ`
      );
      return;
    }

    const config = getConfig();

    if (!config.STAFF_SHEET_ID) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
        `ระบบยังไม่พร้อมใช้งานในขณะนี้ค่ะ\n` +
        `กรุณาติดต่อผู้ดูแลระบบด้วยนะคะ`
      );
      return;
    }

    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');

    const data = sheet.getDataRange().getValues();

    let staffRow  = -1;
    let staffData = null;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === staffId) {
        staffRow  = i + 1;
        staffData = data[i];
        break;
      }
    }

    if (staffRow === -1) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `ไม่พบ Staff ID: ${staffId} ในระบบค่ะ\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 กรุณาตรวจสอบ Staff ID ของคุณอีกครั้ง\n` +
        `หรือติดต่อผู้ดูแลระบบเพื่อขอเพิ่มข้อมูลนะคะ 🙏`
      );
      return;
    }

    const existingLineUserId = staffData[2];

    if (existingLineUserId &&
        existingLineUserId.startsWith('U') &&
        existingLineUserId !== 'Uxxxxxxxxxxxxxxxx') {

      if (existingLineUserId === userId) {
        replyMessage(replyToken,
          `✅ คุณลงทะเบียนกับป้าไพรแล้วนะคะ!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📋 ข้อมูลของคุณ\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `• Staff ID: ${staffData[0]}\n` +
          `• ชื่อ: ${staffData[1]}\n` +
          `• แผนก: ${staffData[3]}\n\n` +
          `💡 พิมพ์ /mystaffid เพื่อดูข้อมูลทั้งหมดได้เลยนะคะ 😊`
        );
      } else {
        replyMessage(replyToken,
          `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
          `Staff ID นี้ถูกลงทะเบียนไปแล้วค่ะ\n\n` +
          `หาก Staff ID นี้เป็นของคุณจริง\n` +
          `กรุณาติดต่อผู้ดูแลระบบด้วยนะคะ 🙏`
        );
      }
      return;
    }

    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === userId && data[i][0] !== staffId) {
        replyMessage(replyToken,
          `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
          `คุณลงทะเบียนกับ Staff ID อื่นอยู่แล้วค่ะ\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Staff ID ปัจจุบัน: ${data[i][0]}\n` +
          `ชื่อ: ${data[i][1]}\n\n` +
          `💡 หากต้องการเปลี่ยน\n` +
          `พิมพ์ /unreg เพื่อยกเลิกก่อนนะคะ`
        );
        return;
      }
    }

    const profile     = getLineProfile(userId);
    const displayName = profile ? profile.displayName : 'ไม่สามารถดึงชื่อได้';

    sheet.getRange(staffRow, 3).setValue(userId);

    const registrationNote = `ลงทะเบียนโดย: ${displayName} | ${formatThaiDateTime(new Date())}`;
    if (sheet.getLastColumn() >= 6) {
      const currentNote = sheet.getRange(staffRow, 6).getValue();
      const newNote = currentNote ? `${currentNote}\n${registrationNote}` : registrationNote;
      sheet.getRange(staffRow, 6).setValue(newNote);
    }

    console.log(`✅ Staff registered: ${staffId} -> ${userId}`);

    replyMessage(replyToken,
      `✅ ลงทะเบียนกับป้าไพรสำเร็จแล้วค่ะ!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 ข้อมูลของคุณ\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `• Staff ID: ${staffData[0]}\n` +
      `• ชื่อในระบบ: ${staffData[1]}\n` +
      `• LINE Name: ${displayName}\n` +
      `• แผนก: ${staffData[3]}\n` +
      `• ความรับผิดชอบ: ${staffData[4]}\n\n` +
      `🔔 ตั้งแต่นี้ป้าไพรจะส่งคำร้องที่เกี่ยวข้อง\n` +
      `มาให้คุณโดยตรงนะคะ\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 คำสั่งที่ใช้ได้\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `• /mystaffid        — ดูข้อมูลของคุณ\n` +
      `• /complete [ID]    — อัพเดทสถานะงาน\n` +
      `• /unreg            — ยกเลิกการลงทะเบียน\n\n` +
      `ขอบคุณที่ร่วมทีมกับป้าไพรนะคะ 🙏😊`
    );

    notifyOwnerNewStaffRegistration(staffData, displayName, userId);

  } catch (error) {
    console.error('❌ Staff registration error:', error);
    replyMessage(replyToken,
      `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
      `เกิดข้อผิดพลาดในการลงทะเบียนค่ะ\n` +
      `กรุณาลองใหม่อีกครั้ง\n` +
      `หรือติดต่อผู้ดูแลระบบด้วยนะคะ`
    );
  }
}

/**
 * ยกเลิกการลงทะเบียน Staff
 */
function unregisterStaff(userId, replyToken) {
  console.log(`🔓 Staff unregistration by ${userId}`);

  try {
    const config = getConfig();

    if (!config.STAFF_SHEET_ID) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
        `ระบบยังไม่พร้อมใช้งานในขณะนี้ค่ะ`
      );
      return;
    }

    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');

    const data = sheet.getDataRange().getValues();

    let staffRow  = -1;
    let staffData = null;

    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === userId) {
        staffRow  = i + 1;
        staffData = data[i];
        break;
      }
    }

    if (staffRow === -1) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `คุณยังไม่ได้ลงทะเบียนในระบบค่ะ\n\n` +
        `💡 หากต้องการลงทะเบียน ใช้คำสั่งนี้นะคะ:\n` +
        `/reg staff [StaffID]`
      );
      return;
    }

    sheet.getRange(staffRow, 3).setValue('');

    const profile     = getLineProfile(userId);
    const displayName = profile ? profile.displayName : 'Unknown';
    const unregNote   = `ยกเลิกการลงทะเบียนโดย: ${displayName} | ${formatThaiDateTime(new Date())}`;

    if (sheet.getLastColumn() >= 6) {
      const currentNote = sheet.getRange(staffRow, 6).getValue();
      const newNote = currentNote ? `${currentNote}\n${unregNote}` : unregNote;
      sheet.getRange(staffRow, 6).setValue(newNote);
    }

    console.log(`✅ Staff unregistered: ${staffData[0]} (${userId})`);

    replyMessage(replyToken,
      `✅ ยกเลิกการลงทะเบียนเรียบร้อยแล้วค่ะ\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Staff ID: ${staffData[0]}\n` +
      `ชื่อ: ${staffData[1]}\n\n` +
      `ตั้งแต่นี้ป้าไพรจะไม่ส่งการแจ้งเตือนมาให้แล้วนะคะ\n\n` +
      `💡 หากต้องการลงทะเบียนใหม่\n` +
      `ใช้คำสั่ง: /reg staff ${staffData[0]}\n\n` +
      `ขอบคุณที่ร่วมงานกับป้าไพรนะคะ 🙏`
    );

    notifyOwnerStaffUnregistration(staffData, displayName);

  } catch (error) {
    console.error('❌ Staff unregistration error:', error);
    replyMessage(replyToken,
      `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
      `เกิดข้อผิดพลาดค่ะ กรุณาลองใหม่อีกครั้งนะคะ`
    );
  }
}

/**
 * แสดงข้อมูล Staff ของตัวเอง
 */
function showMyStaffInfo(userId, replyToken) {
  try {
    const config = getConfig();

    if (!config.STAFF_SHEET_ID) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
        `ระบบยังไม่พร้อมใช้งานในขณะนี้ค่ะ`
      );
      return;
    }

    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');

    const data = sheet.getDataRange().getValues();

    let staffData = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === userId) {
        staffData = data[i];
        break;
      }
    }

    if (!staffData) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `คุณยังไม่ได้ลงทะเบียนในระบบค่ะ\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 วิธีลงทะเบียน\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `1. รับ Staff ID จากผู้ดูแลระบบ\n` +
        `2. ส่งคำสั่ง: /reg staff [StaffID]\n\n` +
        `ตัวอย่าง: /reg staff STF001\n\n` +
        `มีอะไรให้ป้าไพรช่วยเพิ่มเติมไหมคะ? 🙏`
      );
      return;
    }

    const profile     = getLineProfile(userId);
    const displayName = profile ? profile.displayName : 'ไม่สามารถดึงข้อมูลได้';

    replyMessage(replyToken,
      `📋 ข้อมูล Staff ของคุณค่ะ\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• Staff ID: ${staffData[0]}\n` +
      `• ชื่อในระบบ: ${staffData[1]}\n` +
      `• LINE Name: ${displayName}\n` +
      `• แผนก: ${staffData[3]}\n` +
      `• ความรับผิดชอบ:\n` +
      `  ${staffData[4].split(',').join('\n  ')}\n\n` +
      `• LINE User ID:\n  ${userId}\n\n` +
      `🔔 สถานะ: ✅ ลงทะเบียนแล้ว\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 คำสั่งที่ใช้ได้\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `• /complete [ID]    — อัพเดทสถานะงาน\n` +
      `• /unreg            — ยกเลิกการลงทะเบียน`
    );

  } catch (error) {
    console.error('❌ Error showing staff info:', error);
    replyMessage(replyToken,
      `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
      `เกิดข้อผิดพลาดค่ะ กรุณาลองใหม่อีกครั้งนะคะ`
    );
  }
}

/**
 * แสดงรายการ Staff ที่ยังไม่ได้ลงทะเบียน (เฉพาะผู้ดูแลระบบ)
 */
function showPendingStaffRegistrations(replyToken) {
  try {
    const config = getConfig();

    if (!config.STAFF_SHEET_ID) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
        `ระบบยังไม่พร้อมใช้งานในขณะนี้ค่ะ`
      );
      return;
    }

    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');

    const data = sheet.getDataRange().getValues();

    const pending    = [];
    const registered = [];

    for (let i = 1; i < data.length; i++) {
      const staffId    = data[i][0];
      const name       = data[i][1];
      const lineUserId = data[i][2];
      const dept       = data[i][3];
      const hasRegistered = lineUserId &&
                            lineUserId.startsWith('U') &&
                            lineUserId !== 'Uxxxxxxxxxxxxxxxx';

      if (hasRegistered) {
        registered.push({ staffId, name, dept });
      } else {
        pending.push({ staffId, name, dept });
      }
    }

    let message =
      `📊 สถานะการลงทะเบียน Staff\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ ลงทะเบียนแล้ว: ${registered.length} คน\n` +
      `⏳ รอลงทะเบียน: ${pending.length} คน\n\n`;

    if (pending.length > 0) {
      message +=
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 เจ้าหน้าที่ที่ยังไม่ได้ลงทะเบียน\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      pending.forEach((staff, index) => {
        message += `${index + 1}. ${staff.staffId}\n`;
        message += `   ชื่อ: ${staff.name}\n`;
        message += `   แผนก: ${staff.dept}\n\n`;
      });

      message +=
        `💡 แนะนำให้เจ้าหน้าที่ส่งคำสั่งนี้\n` +
        `หาป้าไพรใน Private Chat ค่ะ:\n` +
        `/reg staff [StaffID]`;
    } else {
      message += `🎉 เจ้าหน้าที่ทุกท่านลงทะเบียนครบแล้วค่ะ!\nป้าไพรขอบคุณทุกท่านมากนะคะ 🙏`;
    }

    replyMessage(replyToken, message);

  } catch (error) {
    console.error('❌ Error showing pending registrations:', error);
    replyMessage(replyToken,
      `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
      `เกิดข้อผิดพลาดค่ะ กรุณาลองใหม่อีกครั้งนะคะ`
    );
  }
}

// =================================
// SECTION 5: STAFF COMMANDS
// =================================

/**
 * จัดการคำสั่งจาก Staff
 */
function handleStaffCommand(messageText, replyToken, userId, staffInfo) {
  const command = messageText.toLowerCase().trim();

  if (command.startsWith('/complete ')) {
    const requestId = command.substring(10).trim();

    if (requestId.length !== 14) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `รูปแบบ Request ID ไม่ถูกต้องค่ะ\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 รูปแบบที่ถูกต้อง\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `YYYYMMDDHHmmss (14 หลัก)\n` +
        `ตัวอย่าง: 20251104102548\n\n` +
        `/complete 20251104102548`
      );
      return;
    }

    console.log(`✅ Complete command from ${staffInfo.name}: ${requestId}`);
    completeRequest(requestId, userId, staffInfo, replyToken);

  } else if (command === '/help') {
    sendStaffHelpMessage(replyToken, staffInfo);

  } else if (command === '/myrequests') {
    sendStaffRequests(replyToken, staffInfo);

  } else {
    console.log('⚠️ Unknown staff command - no response');
  }
}

/**
 * คู่มือคำสั่งสำหรับ Staff
 */
function sendStaffHelpMessage(replyToken, staffInfo) {
  replyMessage(replyToken,
    `สวัสดีค่ะ คุณ${staffInfo.name} 😊\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 คำสั่งสำหรับเจ้าหน้าที่\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `✅ /complete [request_id]\n` +
    `   อัพเดทสถานะคำร้องเป็น "เสร็จสิ้น"\n\n` +
    `   ตัวอย่าง:\n` +
    `   /complete 20251104102548\n\n` +
    `📋 /myrequests\n` +
    `   ดูคำร้องที่ป้าไพรส่งมาให้คุณ\n\n` +
    `👤 /mystaffid\n` +
    `   ดูข้อมูลของคุณ\n\n` +
    `💡 /help\n` +
    `   แสดงคู่มือนี้\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 หมายเหตุ\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Request ID คือเลข 14 หลัก\n` +
    `(วันเวลาที่แจ้งคำร้อง)\n\n` +
    `ตัวอย่าง: 20251104102548\n` +
    `= 4 พ.ย. 2025 เวลา 10:25:48\n\n` +
    `มีอะไรให้ป้าไพรช่วยเพิ่มเติมไหมคะ? 🙏`
  );
}

/**
 * แสดงคำร้องที่มอบหมายให้ Staff
 */
function sendStaffRequests(replyToken, staffInfo) {
  try {
    const config = getConfig();

    if (!config.REQUEST_LOG_SHEET_ID) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
        `ระบบ Request Log ยังไม่ได้ตั้งค่าค่ะ`
      );
      return;
    }

    const sheet = SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID)
      .getSheetByName('Request Log');

    const data = sheet.getDataRange().getValues();

    const myRequests = data.slice(1).filter(row =>
      row[6] === staffInfo.staffId &&
      row[8] !== 'COMPLETED'
    );

    if (myRequests.length === 0) {
      replyMessage(replyToken,
        `✅ ยอดเยี่ยมมากค่ะ!\n\n` +
        `ตอนนี้คุณไม่มีคำร้องค้างอยู่เลยนะคะ 🎉\n\n` +
        `ป้าไพรจะแจ้งเตือนทันทีเมื่อมีคำร้องใหม่ค่ะ 🔔`
      );
      return;
    }

    let message =
      `📋 คำร้องที่ป้าไพรส่งมาให้คุณ\n` +
      `(${myRequests.length} รายการที่ยังค้างอยู่)\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    myRequests.forEach((row, index) => {
      const requestId   = row[1];
      const issueType   = row[4];
      const description = row[5].substring(0, 50) + (row[5].length > 50 ? '...' : '');
      const status      = row[8];
      const priority    = row[9];

      const priorityEmoji = priority === 'URGENT' ? '🚨' : '📋';
      const statusEmoji   = getStatusEmoji(status);

      message += `${index + 1}. ${priorityEmoji} [${requestId}]\n`;
      message += `   ${statusEmoji} ${issueType}\n`;
      message += `   "${description}"\n\n`;
    });

    message +=
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 ดำเนินการเสร็จแล้ว ใช้คำสั่ง:\n` +
      `/complete [request_id]\n\n` +
      `ขอบคุณที่ช่วยดูแลโรงเรียนนะคะ 🙏😊`;

    replyMessage(replyToken, message);

  } catch (error) {
    console.error('Error getting staff requests:', error);
    replyMessage(replyToken,
      `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
      `เกิดข้อผิดพลาดในการดึงข้อมูลค่ะ\n` +
      `กรุณาลองใหม่อีกครั้งนะคะ`
    );
  }
}

/**
 * อัพเดทสถานะคำร้องเป็น COMPLETED
 */
function completeRequest(requestId, userId, staffInfo, replyToken) {
  try {
    const config = getConfig();

    if (!config.REQUEST_LOG_SHEET_ID) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
        `ระบบ Request Log ยังไม่ได้ตั้งค่าค่ะ`
      );
      return;
    }

    const sheet = SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID)
      .getSheetByName('Request Log');

    const data = sheet.getDataRange().getValues();

    const normalizedRequestId = String(requestId).trim().replace(/\s+/g, '');

    if (!/^\d{14}$/.test(normalizedRequestId)) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `Request ID ไม่ถูกต้องค่ะ\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Request ID ต้องเป็นตัวเลข 14 หลัก\n` +
        `รูปแบบ: YYYYMMDDHHmmss\n\n` +
        `ตัวอย่าง: 20251104102548\n\n` +
        `คุณพิมพ์: "${requestId}" (${requestId.length} ตัวอักษร)`
      );
      return;
    }

    console.log(`🔍 Searching for Request ID: "${normalizedRequestId}"`);

    let foundRow    = -1;
    let requestData = null;
    let searchedRows = 0;

    for (let i = 1; i < data.length; i++) {
      if (!data[i][1]) continue;
      searchedRows++;

      const sheetRequestId = String(data[i][1]).trim().replace(/\s+/g, '');

      if (searchedRows <= 3 || sheetRequestId === normalizedRequestId) {
        console.log(`   Row ${i + 1}: "${sheetRequestId}" ${sheetRequestId === normalizedRequestId ? '✅ MATCH!' : ''}`);
      }

      if (sheetRequestId === normalizedRequestId) {
        foundRow    = i + 1;
        requestData = data[i];
        console.log(`✅ Found at row ${foundRow}`);
        break;
      }
    }

    if (foundRow === -1) {
      console.error(`❌ Not found: "${normalizedRequestId}" (${searchedRows} rows checked)`);

      const similarRequests = [];
      const searchPrefix    = normalizedRequestId.substring(0, 8);

      for (let i = 1; i < data.length; i++) {
        if (!data[i][1]) continue;
        const sheetId = String(data[i][1]).trim().replace(/\s+/g, '');
        if (sheetId.startsWith(searchPrefix)) {
          similarRequests.push(sheetId);
        }
      }

      let errorMessage =
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `ไม่พบคำร้องหมายเลข:\n${normalizedRequestId}\n\n`;

      if (similarRequests.length > 0) {
        errorMessage +=
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📋 คำร้องที่มีวันที่ใกล้เคียง\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        similarRequests.slice(0, 5).forEach(id => { errorMessage += `• ${id}\n`; });
        errorMessage += '\n';
      }

      errorMessage +=
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 วิธีแก้ไข\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `• ตรวจสอบหมายเลขให้ถูกต้อง\n` +
        `• คัดลอกจากการแจ้งเตือนของป้าไพร\n` +
        `• ใช้ /myrequests ดูคำร้องของคุณ`;

      replyMessage(replyToken, errorMessage);
      return;
    }

    const assignedStaffId = String(requestData[6]).trim();
    const currentStaffId  = String(staffInfo.staffId).trim();

    if (assignedStaffId !== currentStaffId) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `คำร้องนี้ไม่ได้มอบหมายให้คุณค่ะ\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 Request ID: ${normalizedRequestId}\n` +
        `👤 มอบหมายให้: ${String(requestData[7] || 'ไม่ทราบ')}\n` +
        `🔖 Staff ID ของคุณ: ${currentStaffId}\n\n` +
        `💡 ใช้ /myrequests เพื่อดูคำร้องของคุณนะคะ`
      );
      return;
    }

    const currentStatus = String(requestData[8]).trim();

    if (currentStatus === 'COMPLETED') {
      replyMessage(replyToken,
        `ป้าไพรตรวจสอบแล้ว คำร้องนี้เสร็จสิ้นไปแล้วค่ะ ✅\n\n` +
        `📋 Request ID: ${normalizedRequestId}\n\n` +
        `💡 ใช้ /myrequests เพื่อดูคำร้องที่ยังค้างอยู่นะคะ 😊`
      );
      return;
    }

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);

      sheet.getRange(foundRow, 9).setValue('COMPLETED');

      const requestTime   = new Date(requestData[0]);
      const completedTime = new Date();
      const responseHours = Math.round((completedTime - requestTime) / (1000 * 60 * 60) * 10) / 10;

      sheet.getRange(foundRow, 11).setValue(responseHours + ' hours');
      sheet.getRange(foundRow, 12).setValue(`Completed by ${staffInfo.name} at ${formatThaiDateTime(completedTime)}`);

      console.log(`✅ Request ${normalizedRequestId} completed by ${staffInfo.name}`);

    } finally {
      lock.releaseLock();
    }

    const requestTime   = new Date(requestData[0]);
    const completedTime = new Date();
    const responseHours = Math.round((completedTime - requestTime) / (1000 * 60 * 60) * 10) / 10;

    replyMessage(replyToken,
      `✅ ป้าไพรอัพเดทสถานะเรียบร้อยแล้วค่ะ!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔖 Request ID: ${normalizedRequestId}\n` +
      `📋 ประเภท: ${requestData[4]}\n` +
      `⏱️ ใช้เวลา: ${responseHours} ชั่วโมง\n\n` +
      `ขอบคุณที่ดูแลโรงเรียนอย่างรวดเร็วนะคะ 🙏😊`
    );

    const groupId     = requestData[3];
    const requesterId = requestData[2];
    if (groupId && groupId !== 'unknown') {
      notifyGroupRequestCompleted(groupId, normalizedRequestId, requestData[4], staffInfo.name, responseHours, requesterId);
    }

  } catch (error) {
    console.error('❌ Error completing request:', error);
    console.error('   Stack:', error.stack);

    let errorMsg = `ป้าไพรขออภัยด้วยนะคะ 🙏\n\nเกิดข้อผิดพลาดในการอัพเดทสถานะค่ะ\n\n`;

    if (error.message.includes('Lock')) {
      errorMsg += `⏳ ระบบกำลังประมวลผลคำร้องอื่นอยู่ค่ะ\nรบกวนรอสักครู่แล้วลองใหม่อีกครั้งนะคะ`;
    } else if (error.message.includes('Sheet')) {
      errorMsg += `⚠️ ไม่สามารถเข้าถึงข้อมูลได้ในขณะนี้ค่ะ\nกรุณาลองใหม่ในอีกสักครู่นะคะ`;
    } else {
      errorMsg += `กรุณาลองใหม่อีกครั้ง\nหากปัญหายังคงอยู่ รบกวนติดต่อผู้ดูแลระบบด้วยนะคะ`;
    }

    replyMessage(replyToken, errorMsg);
  }
}

// =================================
// SECTION 6: ACCESS CONTROL
// =================================

function isOwnerUser(userId) {
  if (!userId) return false;

  try {
    const config      = getConfig();
    const ownerUserId = config.OWNER_USER_ID;

    if (!ownerUserId) {
      console.warn('⚠️ OWNER_USER_ID not configured');
      return false;
    }

    const isOwner = userId === ownerUserId;
    console.log(`👤 User ${userId}: ${isOwner ? '✅ OWNER' : '❌ NOT OWNER'}`);
    return isOwner;

  } catch (error) {
    console.error('❌ Error checking owner:', error);
    return false;
  }
}

function isStaffUser(userId) {
  if (!userId) return null;

  try {
    const config = getConfig();

    if (!config.STAFF_SHEET_ID) {
      console.warn('⚠️ STAFF_SHEET_ID not configured');
      return null;
    }

    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');

    if (!sheet) {
      console.error('❌ Staff Directory sheet not found');
      return null;
    }

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[2] === userId) {
        const staffInfo = {
          staffId:          row[0],
          name:             row[1],
          lineUserId:       row[2],
          department:       row[3],
          responsibilities: row[4] ? row[4].toString().split(',').map(r => r.trim()) : []
        };
        console.log(`👤 User ${userId}: ✅ STAFF - ${staffInfo.name}`);
        return staffInfo;
      }
    }

    console.log(`👤 User ${userId}: ❌ NOT STAFF`);
    return null;

  } catch (error) {
    console.error('❌ Error checking staff:', error);
    return null;
  }
}

// =================================
// SECTION 7: REQUEST PROCESSING & AI
// =================================

function processRequest(requestText, replyToken, groupId, userId, quoteToken) {
  try {
    console.log('🤖 ป้าไพรกำลังวิเคราะห์คำร้อง...');

    const analysis = analyzeRequestWithAI(requestText);

    if (!analysis || !analysis.category) {
      replyMessage(
        replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `ไม่สามารถวิเคราะห์คำร้องได้ในขณะนี้ค่ะ\n` +
        `รบกวนระบุรายละเอียดให้ชัดเจนขึ้นอีกนิดได้ไหมคะ\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 ตัวอย่างที่ถูกต้อง:\n` +
        `/request แอร์ห้อง 301 เสีย ช่วยตรวจสอบด้วยค่ะ`,
        quoteToken
      );
      return;
    }

    console.log(`📊 Analysis: ${analysis.category} (${analysis.priority})`);

    const assignedStaff = findResponsibleStaff(analysis.category);

    if (!assignedStaff) {
      replyMessage(
        replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `ยังไม่พบเจ้าหน้าที่ที่รับผิดชอบเรื่อง:\n${analysis.category}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 กรุณาติดต่อฝ่ายธุรการโดยตรง\n` +
        `หรือลองใหม่อีกครั้งนะคะ`,
        quoteToken
      );
      return;
    }

    const requestId = generateRequestId();

    const logResult = logRequest({
      requestId:    requestId,
      timestamp:    new Date(),
      requesterId:  userId,
      groupId:      groupId,
      issueType:    analysis.category,
      description:  requestText,
      assignedTo:   assignedStaff.staffId,
      assignedName: assignedStaff.name,
      status:       'SENT',
      priority:     analysis.priority || 'NORMAL'
    });

    if (!logResult.success) {
      console.error('❌ Failed to log request');
    }

    const notificationSent = sendRequestToStaff(assignedStaff, {
      requestId:   requestId,
      requester:   userId,
      groupId:     groupId,
      issueType:   analysis.category,
      description: requestText,
      priority:    analysis.priority || 'NORMAL',
      timestamp:   new Date()
    });

    if (notificationSent) {
      const urgentNote = analysis.priority === 'URGENT'
        ? '\n🚨 ป้าไพรแจ้งว่าคำร้องนี้มีความเร่งด่วนสูงนะคะ'
        : '';

      replyMessage(replyToken,
        `✅ ป้าไพรรับคำร้องของคุณแล้วค่ะ!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔖 หมายเลขคำร้อง:\n${requestId}\n` +
        `📋 ประเภท: ${analysis.category}\n` +
        `👤 ส่งต่อไปยัง: ${assignedStaff.name}\n` +
        `   (ฝ่าย ${assignedStaff.department})${urgentNote}\n` +
        `⏰ ระยะเวลาประมาณ: ${analysis.priority === 'URGENT' ? '4-8 ชั่วโมง' : '1-2 วันทำการ'}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `เจ้าหน้าที่จะดำเนินการโดยเร็วที่สุดนะคะ 🙏\n\n` +
        `💡 เก็บหมายเลขคำร้องไว้ติดตามสถานะได้เลยค่ะ`,
        quoteToken
      );

      console.log(`✅ Request ${requestId} routed to ${assignedStaff.name}`);
    } else {
      replyMessage(
        replyToken,
        `⚠️ ป้าไพรบันทึกคำร้องไว้แล้วค่ะ\n\n` +
        `แต่ยังไม่สามารถส่งการแจ้งเตือนไปยังเจ้าหน้าที่ได้\n` +
        `เจ้าหน้าที่จะตรวจสอบคำร้องในระบบนะคะ 🙏`,
        quoteToken
      );
    }

  } catch (error) {
    console.error('❌ Error processing request:', error);
    try {
      replyMessage(
        replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `ระบบขัดข้องชั่วคราวค่ะ\n` +
        `รบกวนลองใหม่อีกครั้งใน 1-2 นาที\n` +
        `หรือติดต่อฝ่ายธุรการโดยตรงนะคะ`
      );
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
}

function analyzeRequestWithAI(requestText) {
  try {
    const config = getConfig();

    if (!config.API_KEY) throw new Error('API key not configured');

    const prompt = constructRequestAnalysisPrompt(requestText);

    console.log('🤖 Calling AI...');

    const payload = {
      model: config.AI_MODEL,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user',   content: prompt.user   }
      ],
      temperature: 0.3,
      max_tokens:  500
    };

    const options = {
      method:          'post',
      contentType:     'application/json',
      headers:         { 'Authorization': `Bearer ${config.API_KEY}` },
      payload:         JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response   = UrlFetchApp.fetch(config.AI_ENDPOINT, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) throw new Error(`AI API error: ${statusCode}`);

    const result = JSON.parse(response.getContentText());

    if (!result.choices || result.choices.length === 0) throw new Error('No response from AI');

    const aiResponse = result.choices[0].message.content.trim();
    console.log('🤖 AI Response:', aiResponse);

    let analysisResult;
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      analysisResult = extractAnalysisFromText(aiResponse);
    }

    return analysisResult;

  } catch (error) {
    console.error('❌ AI Analysis Error:', error);
    return null;
  }
}

function constructRequestAnalysisPrompt(requestText) {
  const categories = getRequestCategories();

  const systemPrompt =
    `You are an AI assistant specialized in analyzing school facility and service requests for a Thai educational institution (โรงเรียนสาธิต มหาวิทยาลัยศิลปากร มัธยมศึกษา). Your role is to accurately classify requests and assess their urgency to ensure proper routing to responsible staff.\n\n` +
    `**Available Categories and Their Responsibilities:**\n` +
    `${categories.map(cat => `• ${cat.category}: ${cat.responsibilities.join(', ')}`).join('\n')}\n\n` +
    `**Priority Classification Rules:**\n\n` +
    `**URGENT (2-8 ชั่วโมง):**\n` +
    `- Safety & Security: อันตราย, ไฟไหม้, ไฟฟ้าลัดวงจร, ก๊าซรั่ว\n` +
    `- Major Failures: ไฟฟ้าดับทั้งอาคาร, ประปาแตก, แอร์เสียทั้งชั้น\n` +
    `- Critical Equipment: เสียทั้งหมด, ไม่ทำงานเลย, พังหมด\n` +
    `- High-Impact Events: มีการสอบ, การประชุมสำคัญ, ผู้ปกครองมาเยือน\n` +
    `- Keywords: ด่วน, ด่วนมาก, ฉุกเฉิน, ทันที, วันนี้, ตอนนี้\n\n` +
    `**NORMAL (1-3 วันทำการ):**\n` +
    `- Routine Maintenance, Minor Issues, Administrative Requests\n\n` +
    `**Response Format (valid JSON only):**\n` +
    `{\n` +
    `  "category": "exact category name",\n` +
    `  "priority": "URGENT or NORMAL",\n` +
    `  "keywords": ["key", "words"],\n` +
    `  "summary": "brief summary in Thai",\n` +
    `  "location": "specific location or not specified",\n` +
    `  "reasoning": "brief explanation in Thai"\n` +
    `}\n\n` +
    `Respond with ONLY valid JSON. If unclear, use "GENERAL_AFFAIRS".`;

  const userPrompt = `Request to analyze:\n\n"${requestText}"\n\nProvide your analysis in valid JSON format only.`;

  return { system: systemPrompt, user: userPrompt };
}

function extractAnalysisFromText(text) {
  const categories = getRequestCategories();
  let foundCategory = 'GENERAL_AFFAIRS';

  for (const cat of categories) {
    if (text.includes(cat.category)) {
      foundCategory = cat.category;
      break;
    }
  }

  const isUrgent = text.toLowerCase().includes('urgent') ||
                   text.includes('เร่งด่วน') || text.includes('ด่วน') ||
                   text.includes('เสีย')     || text.includes('พัง');

  return {
    category: foundCategory,
    priority: isUrgent ? 'URGENT' : 'NORMAL',
    keywords: [],
    summary:  'ไม่สามารถสร้างสรุปได้'
  };
}

// =================================
// SECTION 8: STAFF MANAGEMENT
// =================================

function findResponsibleStaff(category) {
  try {
    const config = getConfig();

    if (!config.STAFF_SHEET_ID) {
      console.error('❌ Staff sheet not configured');
      return null;
    }

    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');

    if (!sheet) {
      console.error('❌ Staff Directory sheet not found');
      return null;
    }

    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      console.error('❌ No staff data');
      return null;
    }

    for (let i = 1; i < data.length; i++) {
      const row              = data[i];
      const responsibilities = row[4] ? row[4].toString().split(',').map(r => r.trim()) : [];

      const match = responsibilities.some(resp =>
        category.toLowerCase().includes(resp.toLowerCase()) ||
        resp.toLowerCase().includes(category.toLowerCase())
      );

      if (match || category === row[3]) {
        return {
          staffId:          row[0],
          name:             row[1],
          lineUserId:       row[2],
          department:       row[3],
          responsibilities: responsibilities
        };
      }
    }

    // Fallback: เจ้าหน้าที่คนแรก
    if (data.length > 1) {
      const row = data[1];
      return {
        staffId:          row[0],
        name:             row[1],
        lineUserId:       row[2],
        department:       row[3],
        responsibilities: row[4] ? row[4].toString().split(',').map(r => r.trim()) : []
      };
    }

    return null;

  } catch (error) {
    console.error('❌ Error finding staff:', error);
    return null;
  }
}

function getRequestCategories() {
  try {
    const config = getConfig();
    if (!config.STAFF_SHEET_ID) return getDefaultCategories();

    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');

    if (!sheet) return getDefaultCategories();

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return getDefaultCategories();

    return data.slice(1).map(row => ({
      category:        row[3],
      staffName:       row[1],
      staffId:         row[0],
      responsibilities: row[4] ? row[4].toString().split(',').map(r => r.trim()) : []
    }));

  } catch (error) {
    console.error('❌ Error getting categories:', error);
    return getDefaultCategories();
  }
}

function getDefaultCategories() {
  return [
    {
      category:        'IT_SUPPORT',
      staffName:       'IT Support',
      staffId:         'STF001',
      responsibilities: ['คอมพิวเตอร์', 'เครือข่าย', 'โปรแกรม', 'internet', 'wifi', 'computer']
    },
    {
      category:        'FACILITIES',
      staffName:       'Facilities',
      staffId:         'STF002',
      responsibilities: ['ห้องเรียน', 'แอร์', 'ไฟฟ้า', 'ประปา', 'ซ่อม', 'aircon', 'electricity']
    },
    {
      category:        'ACADEMIC',
      staffName:       'Academic Affairs',
      staffId:         'STF003',
      responsibilities: ['หลักสูตร', 'สอบ', 'เกรด', 'curriculum', 'exam', 'grade']
    },
    {
      category:        'GENERAL_AFFAIRS',
      staffName:       'General Affairs',
      staffId:         'STF004',
      responsibilities: ['ทั่วไป', 'อื่นๆ', 'general', 'other']
    }
  ];
}

// =================================
// SECTION 9: NOTIFICATIONS
// =================================

function sendRequestToStaff(staff, requestData) {
  try {
    const config = getConfig();

    if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
      console.error('❌ LINE token not configured');
      return false;
    }

    if (!staff.lineUserId) {
      console.error('❌ Staff LINE User ID not found');
      return false;
    }

    const requesterProfile = getLineProfile(requestData.requester);
    const requesterName    = requesterProfile ? requesterProfile.displayName : 'ไม่ทราบชื่อ';

    const groupInfo = getGroupSummary(requestData.groupId);
    const groupName = groupInfo ? groupInfo.groupName : 'กลุ่ม LINE';

    const priorityEmoji = requestData.priority === 'URGENT' ? '🚨' : '📋';
    const priorityText  = requestData.priority === 'URGENT' ? 'ด่วน!' : 'ปกติ';

    const message =
      `${priorityEmoji} ป้าไพรส่งคำร้องใหม่มาให้นะคะ — ${priorityText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔖 หมายเลข: ${requestData.requestId}\n` +
      `📋 ประเภท: ${requestData.issueType}\n` +
      `⏰ เวลา: ${formatThaiDateTime(requestData.timestamp)}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 รายละเอียด:\n${requestData.description}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 ผู้แจ้ง: ${requesterName}\n` +
      `📍 จากกลุ่ม: ${groupName}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 ดำเนินการเสร็จแล้ว\n` +
      `ส่งคำสั่งนี้หาป้าไพรใน Private Chat:\n\n` +
      `/complete ${requestData.requestId}\n\n` +
      `ขอบคุณที่ช่วยดูแลโรงเรียนนะคะ 🙏`;

    const payload = {
      to:       staff.lineUserId,
      messages: [{ type: 'text', text: message }]
    };

    const options = {
      method:          'post',
      contentType:     'application/json',
      headers:         { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
      payload:         JSON.stringify(payload),
      muteHttpExceptions: true
    };

    console.log(`📤 Sending to ${staff.name} (${staff.lineUserId})`);

    const response   = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      console.error(`❌ LINE Push API Error (${statusCode}):`, response.getContentText());
      return false;
    }

    console.log(`✅ Notification sent to ${staff.name}`);
    return true;

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return false;
  }
}

function notifyGroupRequestCompleted(groupId, requestId, issueType, staffName, responseHours, requesterId) {
  try {
    const config = getConfig();

    if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
      console.error('❌ LINE token not configured');
      return;
    }

    const requesterProfile = getLineProfile(requesterId);

    if (!requesterProfile) {
      console.warn('⚠️ Cannot get requester profile — sending without mention');
      sendSimpleCompletionMessage(groupId, requestId, issueType, staffName, responseHours);
      return;
    }

    const displayName = requesterProfile.displayName;
    const mentionText = `@${displayName}`;

    const messageText =
      `${mentionText} ✅ ป้าไพรขอแจ้งว่าคำร้องของคุณเสร็จสิ้นแล้วนะคะ!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔖 หมายเลข: ${requestId}\n` +
      `📋 ประเภท: ${issueType}\n` +
      `👤 ดำเนินการโดย: ${staffName}\n` +
      `⏱️ ใช้เวลา: ${responseHours} ชั่วโมง\n\n` +
      `ขอบคุณที่รอคอยด้วยความเข้าใจนะคะ 🙏😊`;

    const payload = {
      to: groupId,
      messages: [
        {
          type: 'text',
          text: messageText,
          mentions: [{ index: 0, length: mentionText.length, userId: requesterId }]
        }
      ]
    };

    const options = {
      method:          'post',
      contentType:     'application/json',
      headers:         { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
      payload:         JSON.stringify(payload),
      muteHttpExceptions: true
    };

    console.log(`📤 Sending completion notification with mention to group ${groupId}`);

    const response   = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      console.error(`❌ LINE Push API Error (${statusCode}):`, response.getContentText());
    } else {
      console.log('✅ Completion notification sent');
    }

  } catch (error) {
    console.error('❌ Error sending completion notification:', error);
  }
}

function sendSimpleCompletionMessage(groupId, requestId, issueType, staffName, responseHours) {
  try {
    const config = getConfig();

    const message =
      `✅ ป้าไพรขอแจ้งว่าคำร้องเสร็จสิ้นแล้วนะคะ!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔖 หมายเลข: ${requestId}\n` +
      `📋 ประเภท: ${issueType}\n` +
      `👤 ดำเนินการโดย: ${staffName}\n` +
      `⏱️ ใช้เวลา: ${responseHours} ชั่วโมง\n\n` +
      `ขอบคุณที่รอคอยด้วยความเข้าใจนะคะ 🙏😊`;

    const payload = {
      to:       groupId,
      messages: [{ type: 'text', text: message }]
    };

    const options = {
      method:          'post',
      contentType:     'application/json',
      headers:         { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
      payload:         JSON.stringify(payload),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    console.log('✅ Simple completion notification sent');

  } catch (error) {
    console.error('❌ Error sending simple message:', error);
  }
}

function notifyOwnerNewStaffRegistration(staffData, displayName, userId) {
  try {
    const config  = getConfig();
    const ownerId = config.OWNER_USER_ID;

    if (!ownerId) {
      console.log('⚠️ Owner User ID not configured — skipping');
      return;
    }

    const message =
      `🔔 ป้าไพรขอแจ้งว่ามีเจ้าหน้าที่ลงทะเบียนใหม่นะคะ!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ ลงทะเบียนสำเร็จ\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `• Staff ID: ${staffData[0]}\n` +
      `• ชื่อในระบบ: ${staffData[1]}\n` +
      `• LINE Name: ${displayName}\n` +
      `• แผนก: ${staffData[3]}\n` +
      `• LINE User ID:\n  ${userId}\n\n` +
      `⏰ ${formatThaiDateTime(new Date())}`;

    pushMessage(ownerId, message);
    console.log('✅ Owner notified of new staff registration');

  } catch (error) {
    console.error('⚠️ Failed to notify owner:', error);
  }
}

function notifyOwnerStaffUnregistration(staffData, displayName) {
  try {
    const config  = getConfig();
    const ownerId = config.OWNER_USER_ID;

    if (!ownerId) {
      console.log('⚠️ Owner User ID not configured — skipping');
      return;
    }

    const message =
      `⚠️ ป้าไพรขอแจ้งว่ามีเจ้าหน้าที่ยกเลิกการลงทะเบียนนะคะ\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• Staff ID: ${staffData[0]}\n` +
      `• ชื่อในระบบ: ${staffData[1]}\n` +
      `• LINE Name: ${displayName}\n` +
      `• แผนก: ${staffData[3]}\n\n` +
      `⏰ ${formatThaiDateTime(new Date())}`;

    pushMessage(ownerId, message);
    console.log('✅ Owner notified of staff unregistration');

  } catch (error) {
    console.error('⚠️ Failed to notify owner:', error);
  }
}

// =================================
// SECTION 10: REQUEST LOGGING & STATS
// =================================

function logRequest(requestData) {
  try {
    const config = getConfig();

    if (!config.REQUEST_LOG_SHEET_ID) {
      console.error('❌ Request log sheet not configured');
      return { success: false, error: 'Sheet not configured' };
    }

    const sheet = SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID)
      .getSheetByName('Request Log');

    if (!sheet) {
      console.error('❌ Request Log sheet not found');
      return { success: false, error: 'Sheet not found' };
    }

    sheet.appendRow([
      requestData.timestamp,
      requestData.requestId,
      requestData.requesterId,
      requestData.groupId,
      requestData.issueType,
      requestData.description,
      requestData.assignedTo,
      requestData.assignedName,
      requestData.status,
      requestData.priority,
      '',
      ''
    ]);

    console.log(`💾 Request ${requestData.requestId} logged`);
    return { success: true };

  } catch (error) {
    console.error('❌ Error logging request:', error);
    return { success: false, error: error.message };
  }
}

function sendRequestStatus(replyToken, requestId) {
  try {
    const config = getConfig();

    if (!config.REQUEST_LOG_SHEET_ID) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
        `ไม่สามารถเชื่อมต่อระบบได้ในขณะนี้ค่ะ`
      );
      return;
    }

    const sheet = SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID)
      .getSheetByName('Request Log');

    const data = sheet.getDataRange().getValues();

    const normalizedRequestId = String(requestId).trim().replace(/\s+/g, '');

    if (!/^\d{14}$/.test(normalizedRequestId)) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `รูปแบบ Request ID ไม่ถูกต้องค่ะ\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Request ID ต้องเป็นตัวเลข 14 หลัก\n` +
        `รูปแบบ: YYYYMMDDHHmmss\n\n` +
        `ตัวอย่าง: 20251104102548\n\n` +
        `คุณพิมพ์: "${requestId}" (${requestId.length} ตัวอักษร)`
      );
      return;
    }

    let foundRow    = -1;
    let requestData = null;
    let searchedRows = 0;

    for (let i = 1; i < data.length; i++) {
      if (!data[i][1]) continue;
      searchedRows++;

      const sheetId = String(data[i][1]).trim().replace(/\s+/g, '');

      if (searchedRows <= 3 || sheetId === normalizedRequestId) {
        console.log(`   Row ${i + 1}: "${sheetId}" ${sheetId === normalizedRequestId ? '✅ MATCH!' : ''}`);
      }

      if (sheetId === normalizedRequestId) {
        foundRow    = i + 1;
        requestData = data[i];
        break;
      }
    }

    if (foundRow === -1) {
      const similarRequests = [];
      const searchPrefix    = normalizedRequestId.substring(0, 8);

      for (let i = 1; i < data.length; i++) {
        if (!data[i][1]) continue;
        const sheetId = String(data[i][1]).trim().replace(/\s+/g, '');
        if (sheetId.startsWith(searchPrefix)) {
          similarRequests.push({ id: sheetId, status: data[i][8], type: data[i][4] });
        }
      }

      let errorMessage =
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n\n` +
        `ไม่พบคำร้องหมายเลข:\n${normalizedRequestId}\n\n`;

      if (similarRequests.length > 0) {
        errorMessage +=
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📋 คำร้องที่มีวันที่ใกล้เคียง\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        similarRequests.slice(0, 5).forEach(req => {
          errorMessage += `${getStatusEmoji(req.status)} ${req.id}\n   ${req.type}\n`;
        });
        errorMessage += '\n';
      }

      errorMessage +=
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 วิธีตรวจสอบ\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `• ตรวจสอบหมายเลขให้ถูกต้อง\n` +
        `• คัดลอกจากข้อความของป้าไพร\n` +
        `• ติดต่อผู้ดูแลระบบหากมีปัญหา`;

      replyMessage(replyToken, errorMessage);
      return;
    }

    const statusEmoji   = getStatusEmoji(requestData[8]);
    const priorityEmoji = requestData[9] === 'URGENT' ? '🚨' : '📋';

    let responseTimeText = '';
    if (requestData[10] && requestData[10] !== '') {
      responseTimeText = `⏱️ เวลาตอบสนอง: ${requestData[10]}\n`;
    }

    let notesText = '';
    if (requestData[11] && requestData[11] !== '') {
      notesText = `\n📌 หมายเหตุ:\n${requestData[11]}`;
    }

    replyMessage(replyToken,
      `📊 ป้าไพรตรวจสอบสถานะคำร้องให้แล้วนะคะ\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔖 หมายเลข: ${normalizedRequestId}\n` +
      `📋 ประเภท: ${requestData[4]}\n` +
      `👤 เจ้าหน้าที่: ${requestData[7] || 'ยังไม่ได้มอบหมาย'}\n` +
      `${statusEmoji} สถานะ: ${requestData[8]}\n` +
      `${priorityEmoji} ความเร่งด่วน: ${requestData[9]}\n` +
      `⏰ วันที่แจ้ง: ${formatThaiDateTime(requestData[0])}\n` +
      `${responseTimeText}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 รายละเอียด:\n${requestData[5]}${notesText}`
    );

  } catch (error) {
    console.error('❌ Error getting status:', error);

    let errorMsg = `ป้าไพรขออภัยด้วยนะคะ 🙏\n\nเกิดข้อผิดพลาดในการดึงข้อมูลค่ะ\n\n`;

    if (error.message.includes('Sheet')) {
      errorMsg += `⚠️ ไม่สามารถเข้าถึง Google Sheets ได้ในขณะนี้ค่ะ\nกรุณาลองใหม่ในอีกสักครู่นะคะ`;
    } else {
      errorMsg += `กรุณาลองใหม่อีกครั้ง\nหากปัญหายังคงอยู่ รบกวนติดต่อผู้ดูแลระบบด้วยนะคะ`;
    }

    replyMessage(replyToken, errorMsg);
  }
}

function sendGroupStats(replyToken, groupId) {
  try {
    const config = getConfig();

    if (!config.REQUEST_LOG_SHEET_ID) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
        `ไม่สามารถเชื่อมต่อระบบได้ในขณะนี้ค่ะ`
      );
      return;
    }

    const sheet = SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID)
      .getSheetByName('Request Log');

    const data          = sheet.getDataRange().getValues();
    const groupRequests = data.slice(1).filter(row => row[3] === groupId);

    if (groupRequests.length === 0) {
      replyMessage(replyToken,
        `📊 ป้าไพรตรวจสอบแล้วค่ะ\n\n` +
        `กลุ่มนี้ยังไม่มีคำร้องที่ผ่านป้าไพรเลยนะคะ\n\n` +
        `💡 หากต้องการแจ้งซ่อม ใช้คำสั่ง:\n` +
        `/request [รายละเอียด]`
      );
      return;
    }

    const stats = {
      total:      groupRequests.length,
      sent:       groupRequests.filter(r => r[8] === 'SENT').length,
      inProgress: groupRequests.filter(r => r[8] === 'IN_PROGRESS').length,
      completed:  groupRequests.filter(r => r[8] === 'COMPLETED').length,
      urgent:     groupRequests.filter(r => r[9] === 'URGENT').length
    };

    replyMessage(replyToken,
      `📊 ป้าไพรสรุปสถิติคำร้องของกลุ่มนี้ค่ะ\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 ทั้งหมด: ${stats.total} รายการ\n\n` +
      `• 📤 รอดำเนินการ: ${stats.sent}\n` +
      `• ⚙️ กำลังดำเนินการ: ${stats.inProgress}\n` +
      `• ✅ เสร็จสิ้น: ${stats.completed}\n` +
      `• 🚨 ด่วน: ${stats.urgent}\n\n` +
      `⏰ ข้อมูล ณ วันที่: ${formatThaiDateTime(new Date())}`
    );

  } catch (error) {
    console.error('Error getting group stats:', error);
    replyMessage(replyToken,
      `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
      `เกิดข้อผิดพลาดในการดึงข้อมูลค่ะ`
    );
  }
}

function sendOverallStats(replyToken) {
  try {
    const stats = getUsageStats();

    if (!stats.success) {
      replyMessage(replyToken,
        `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
        `ไม่สามารถดึงข้อมูลสถิติได้ในขณะนี้ค่ะ`
      );
      return;
    }

    const s = stats.stats;

    replyMessage(replyToken,
      `📊 ป้าไพรสรุปสถิติรวมทั้งหมดค่ะ\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 คำร้องทั้งหมด: ${s.total} รายการ\n\n` +
      `สถานะ:\n` +
      `• 📤 รอดำเนินการ: ${s.byStatus.SENT}\n` +
      `• ⚙️ กำลังดำเนินการ: ${s.byStatus.IN_PROGRESS}\n` +
      `• ✅ เสร็จสิ้น: ${s.byStatus.COMPLETED}\n` +
      `• ❌ ยกเลิก: ${s.byStatus.CANCELLED}\n\n` +
      `ความเร่งด่วน:\n` +
      `• 🚨 ด่วน: ${s.byPriority.URGENT}\n` +
      `• 📋 ปกติ: ${s.byPriority.NORMAL}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `แยกตามประเภท:\n` +
      `${Object.entries(s.byDepartment).map(([dept, count]) => `• ${dept}: ${count}`).join('\n')}\n\n` +
      `⏰ ข้อมูล ณ วันที่: ${formatThaiDateTime(new Date())}`
    );

  } catch (error) {
    console.error('Error sending overall stats:', error);
    replyMessage(replyToken,
      `ป้าไพรขออภัยด้วยนะคะ 🙏\n` +
      `เกิดข้อผิดพลาดในการดึงข้อมูลค่ะ`
    );
  }
}

// =================================
// SECTION 11: LINE MESSAGING UTILITIES
// =================================

function replyMessage(replyToken, text, quoteToken = null) {
  const config = getConfig();

  if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('LINE token not configured');
  }

  const message = { type: 'text', text: text };
  if (quoteToken) message.quoteToken = quoteToken;

  const payload = {
    replyToken: replyToken,
    messages:   [message]
  };

  const options = {
    method:          'post',
    contentType:     'application/json',
    headers:         { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
    payload:         JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response   = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      console.error(`LINE API Error (${statusCode}):`, response.getContentText());
      throw new Error(`LINE API error: ${statusCode}`);
    }

    console.log('✅ Message sent');

  } catch (error) {
    console.error('❌ Failed to send message:', error);
    throw error;
  }
}

function pushMessage(userId, text) {
  const config = getConfig();

  if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('LINE token not configured');
  }

  const payload = {
    to:       userId,
    messages: [{ type: 'text', text: text }]
  };

  const options = {
    method:          'post',
    contentType:     'application/json',
    headers:         { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
    payload:         JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response   = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      console.error(`LINE API Error (${statusCode}):`, response.getContentText());
      throw new Error(`LINE API error: ${statusCode}`);
    }

    console.log('✅ Push message sent');

  } catch (error) {
    console.error('❌ Failed to send push message:', error);
    throw error;
  }
}

function startLoading(userId) {
  const config = getConfig();
  if (!config.LINE_CHANNEL_ACCESS_TOKEN) return;

  try {
    const options = {
      method:          'post',
      contentType:     'application/json',
      headers:         { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
      payload:         JSON.stringify({ chatId: userId }),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch('https://api.line.me/v2/bot/chat/loading/start', options);
    console.log('⏳ Loading started');
  } catch (error) {
    console.error('⚠️ Loading indicator failed:', error);
  }
}

// =================================
// SECTION 12: GENERAL UTILITIES
// =================================

function createResponse(data) {
  const output = typeof data === 'string' ? { message: data } : data;
  return ContentService
    .createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateRequestId() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day   = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins  = String(now.getMinutes()).padStart(2, '0');
  const secs  = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${mins}${secs}`;
}

function formatThaiDateTime(date) {
  return Utilities.formatDate(new Date(date), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');
}

function getStatusEmoji(status) {
  const map = {
    'SENT':        '📤',
    'IN_PROGRESS': '⚙️',
    'COMPLETED':   '✅',
    'CANCELLED':   '❌'
  };
  return map[status] || '📋';
}

function getLineProfile(userId) {
  try {
    const config = getConfig();

    if (!config.LINE_CHANNEL_ACCESS_TOKEN) return null;
    if (!userId || userId === 'unknown')    return null;

    const options = {
      method:          'get',
      headers:         { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
      muteHttpExceptions: true
    };

    const response   = UrlFetchApp.fetch(`https://api.line.me/v2/bot/profile/${userId}`, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      console.error(`❌ LINE Profile API Error (${statusCode})`);
      return null;
    }

    const profile = JSON.parse(response.getContentText());
    console.log(`✅ Profile: ${profile.displayName}`);

    return {
      userId:        profile.userId,
      displayName:   profile.displayName,
      pictureUrl:    profile.pictureUrl    || null,
      statusMessage: profile.statusMessage || null
    };

  } catch (error) {
    console.error('❌ Error fetching LINE profile:', error);
    return null;
  }
}

function getGroupSummary(groupId) {
  try {
    const config = getConfig();

    if (!config.LINE_CHANNEL_ACCESS_TOKEN) return null;
    if (!groupId || groupId === 'unknown')  return null;

    const options = {
      method:          'get',
      headers:         { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
      muteHttpExceptions: true
    };

    const response   = UrlFetchApp.fetch(`https://api.line.me/v2/bot/group/${groupId}/summary`, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      console.warn(`⚠️ Cannot get group info (${statusCode})`);
      return null;
    }

    const info = JSON.parse(response.getContentText());
    return {
      groupId:    info.groupId,
      groupName:  info.groupName,
      pictureUrl: info.pictureUrl || null
    };

  } catch (error) {
    console.warn('⚠️ Cannot get group info:', error.message);
    return null;
  }
}

function getUsageStats() {
  try {
    const config = getConfig();

    if (!config.REQUEST_LOG_SHEET_ID) {
      return { success: false, error: 'Request log not configured' };
    }

    const sheet = SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID)
      .getSheetByName('Request Log');

    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return {
        success: true,
        stats: {
          total:        0,
          byStatus:     { SENT: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 },
          byPriority:   { URGENT: 0, NORMAL: 0 },
          byDepartment: {}
        }
      };
    }

    const requests = data.slice(1);

    const stats = {
      total: requests.length,
      byStatus: {
        SENT:        requests.filter(r => r[8] === 'SENT').length,
        IN_PROGRESS: requests.filter(r => r[8] === 'IN_PROGRESS').length,
        COMPLETED:   requests.filter(r => r[8] === 'COMPLETED').length,
        CANCELLED:   requests.filter(r => r[8] === 'CANCELLED').length
      },
      byPriority: {
        URGENT: requests.filter(r => r[9] === 'URGENT').length,
        NORMAL: requests.filter(r => r[9] === 'NORMAL').length
      },
      byDepartment: {}
    };

    requests.forEach(r => {
      const dept = r[4];
      if (dept) stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;
    });

    return { success: true, stats: stats };

  } catch (error) {
    console.error('❌ Error getting stats:', error);
    return { success: false, error: error.message };
  }
}
