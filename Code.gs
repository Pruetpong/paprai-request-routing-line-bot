// Code.gs - Command-Based Request Routing Bot
// บอทรับคำร้องด้วยคำสั่ง /request และส่งต่อไปยังเจ้าหน้าที่
// Version: 2.0 - Command-Based with Enhanced Access Control

/**
 * Webhook handler สำหรับรับข้อความจาก LINE
 */
function doPost(e) {
  const startTime = new Date();
  console.log(`🌐 Webhook received at ${startTime.toISOString()}`);
  
  try {
    if (!e.postData || !e.postData.contents) {
      console.error('❌ Invalid request format');
      return createResponse('Invalid request', 400);
    }

    const contents = JSON.parse(e.postData.contents);
    
    if (!contents.events || !Array.isArray(contents.events)) {
      console.error('❌ No events found');
      return createResponse('No events', 400);
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
    return createResponse('Internal error', 500);
  }
}

// =================================
// EVENT PROCESSING
// =================================

function processEvent(event) {
  try {
    const { type, replyToken, source } = event;
    const userId = source?.userId;
    const isGroupChat = source?.type === 'group';
    const isRoomChat = source?.type === 'room';
    const isPrivateChat = !isGroupChat && !isRoomChat;
    
    console.log(`🔄 Event: ${type}, Context: ${source?.type || 'unknown'}, User: ${userId || 'unknown'}`);

    if (type === 'message') {
      if (isGroupChat || isRoomChat) {
        // ใน Group/Room: ตอบเฉพาะคำสั่ง /request เท่านั้น
        handleGroupMessage(event);
      } else if (isPrivateChat) {
        // ในแชทส่วนตัว: เฉพาะ Owner และ Staff (with commands)
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
// GROUP CHAT HANDLING
// =================================

/**
 * จัดการข้อความใน Group Chat
 * ตอบเฉพาะคำสั่ง /request เท่านั้น
 */
function handleGroupMessage(event) {
  const { message, replyToken, source } = event;
  
  if (message.type !== 'text') {
    console.log(`⚠️ Non-text message ignored: ${message.type}`);
    return;
  }

  const messageText = message.text.trim();
  const userId = source.userId || 'unknown';
  const groupId = source.groupId || source.roomId || 'unknown';
  
  console.log(`📝 Group message: "${messageText}" from ${userId}`);

  // ตรวจสอบว่าเป็นคำสั่ง /request หรือไม่
  if (messageText.toLowerCase().startsWith('/request ')) {
    // ดึงคำร้องออกมา (ตัดคำสั่ง /request ออก)
    const requestText = messageText.substring(9).trim(); // "/request " = 9 ตัวอักษร
    
    if (requestText.length < 10) {
      replyMessage(replyToken, '⚠️ กรุณาระบุรายละเอียดคำร้องอย่างน้อย 10 ตัวอักษร\n\nตัวอย่าง:\n/request แอร์ห้อง 301 เสีย ช่วยตรวจสอบด้วยค่ะ', message.quoteToken);
      return;
    }
    
    console.log(`📋 Request command detected: "${requestText}"`);
    
    // แสดง loading indicator
    if (userId && userId !== 'unknown') {
      startLoading(userId);
    }
    
    // ประมวลผลคำร้อง
    processRequest(requestText, replyToken, groupId, userId, message.quoteToken);
    
  } else if (messageText.toLowerCase() === '/help') {
    // แสดงคำแนะนำการใช้งาน
    sendGroupHelpMessage(replyToken);
    
  } else if (messageText.toLowerCase() === '/stats') {
    // แสดงสถิติกลุ่ม
    sendGroupStats(replyToken, groupId);
    
  } else {
    // ข้อความสนทนาทั่วไป - IGNORE (ไม่ตอบ)
    console.log('💬 Regular chat message - ignored');
  }
}

/**
 * แสดงคำแนะนำสำหรับกลุ่ม
 */
function sendGroupHelpMessage(replyToken) {
  const helpText = `🤖 ระบบรับคำร้องอัตโนมัติ

📝 วิธีส่งคำร้อง:
/request [รายละเอียดคำร้อง]

💡 ตัวอย่าง:
/request แอร์ห้อง 301 เสีย ช่วยตรวจสอบด้วยค่ะ
/request อินเทอร์เน็ตในห้องประชุมเชื่อมต่อไม่ได้
/request ขอเปลี่ยนกำหนดการสอบวันที่ 15

🔧 คำสั่งอื่นๆ:
/help - แสดงคำแนะนำนี้
/stats - ดูสถิติคำร้องของกลุ่ม

📌 หมายเหตุ:
• บอทจะตอบเฉพาะคำสั่งเท่านั้น
• ข้อความสนทนาทั่วไปจะไม่ถูกประมวลผล
• คำร้องจะถูกส่งต่อไปยังเจ้าหน้าที่อัตโนมัติ`;

  replyMessage(replyToken, helpText);
}

// =================================
// PRIVATE CHAT HANDLING
// =================================
/**
 * จัดการข้อความส่วนตัว
 * ✅ ตรวจสอบ COMMAND TYPE ก่อน แล้วค่อย route ตาม command
 * ✅ รองรับ dual role (Owner + Staff)
 */
function handlePrivateMessage(event) {
  const { message, replyToken, source } = event;
  const userId = source.userId || 'unknown';
  
  if (message.type !== 'text') {
    console.log(`⚠️ Non-text message ignored: ${message.type}`);
    return;
  }

  const messageText = message.text.trim();
  const command = messageText.toLowerCase().trim();
  
  console.log(`💬 Private message from ${userId}: "${messageText}"`);

  // ตรวจสอบ role
  const isOwner = isOwnerUser(userId);
  const staffInfo = isStaffUser(userId);
  
  if (handleStaffRegistration(messageText, replyToken, userId)) {
    return; // ประมวลผลเสร็จแล้ว
  }
  
  // คำสั่งที่ต้องการ staffInfo: /complete, /mystaffid
  const isStaffCommand = command.startsWith('/complete ') || 
                         command === '/mystaffid';
  
  if (isStaffCommand && staffInfo) {
    // ✅ Staff command + มี staffInfo → route ไปที่ handleStaffCommand
    console.log(`🎯 Staff command detected: ${staffInfo.name}`);
    handleStaffCommand(messageText, replyToken, userId, staffInfo);
    return;
  }
  
  if (isStaffCommand && !staffInfo) {
    // ❌ Staff command แต่ไม่มี staffInfo → แจ้งให้ลงทะเบียน
    replyMessage(replyToken, 
      `⚠️ คำสั่งนี้สำหรับ Staff เท่านั้น\n\n` +
      `กรุณาลงทะเบียนก่อนด้วย:\n` +
      `/reg staff [StaffID]\n\n` +
      `หรือติดต่อผู้ดูแลระบบเพื่อขอ Staff ID`
    );
    return;
  }
  
  // คำสั่ง Owner-specific: /pending, /config
  const isOwnerCommand = command === '/pending' || 
                         command === '/config' ||
                         command === '/stats' ||
                         command === '/help' ||
                         command.startsWith('/status ');
  
  if (isOwnerCommand && isOwner) {
    // ✅ Owner command + เป็น Owner → route ไปที่ handleOwnerMessage
    console.log('🔧 Owner command detected');
    handleOwnerMessage(messageText, replyToken, userId);
    return;
  }
  
  if (isOwnerCommand && !isOwner) {
    // ❌ Owner command แต่ไม่ใช่ Owner → ปฏิเสธ
    replyMessage(replyToken, 
      `⚠️ คำสั่งนี้สำหรับเจ้าของระบบเท่านั้น\n\n` +
      `หากคุณเป็น Staff กรุณาใช้:\n` +
      `/mystaffid - ดูข้อมูลตัวเอง\n` +
      `/complete [ID] - อัพเดทสถานะงาน`
    );
    return;
  }
  
  if (isOwner) {
    // Owner พิมพ์ข้อความทั่วไป
    handleOwnerMessage(messageText, replyToken, userId);
  } else if (staffInfo) {
    // Staff พิมพ์ข้อความทั่วไป → แสดงคำสั่งที่ใช้ได้
    replyMessage(replyToken, 
      `👋 สวัสดี ${staffInfo.name}!\n\n` +
      `คำสั่งที่คุณใช้ได้:\n` +
      `/mystaffid - ดูข้อมูลตัวเอง\n` +
      `/complete [request_id] - อัพเดทสถานะงาน\n` +
      `/unreg - ยกเลิกการลงทะเบียน\n\n` +
      `ตัวอย่าง:\n` +
      `/complete 20251104102548`
    );
  } else {
    // ผู้ใช้ทั่วไป
    sendPrivateChatInfo(replyToken);
  }
}

/**
 * จัดการข้อความจาก Owner
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
    // 🆕 คำสั่งใหม่
    showPendingStaffRegistrations(replyToken);
  } else {
    // ข้อความทั่วไป - ตอบกลับ
    replyMessage(replyToken, `สวัสดีครับอาจารย์พรึด! 👋\n\nคุณสามารถใช้คำสั่ง:\n/help - ดูคำแนะนำ\n/stats - ดูสถิติทั้งหมด\n/config - ดูการตั้งค่า\n/pending - ดู Staff ที่ยังไม่ลงทะเบียน (🆕)`);
  }
}

/**
 * แสดงคำแนะนำสำหรับ Owner
 */
function sendOwnerHelpMessage(replyToken) {
  const helpText = `🔧 คำสั่งสำหรับเจ้าของบอท

📊 คำสั่งดูข้อมูล:
/stats - ดูสถิติทั้งหมด
/status [request_id] - ตรวจสอบสถานะคำร้อง
/config - ดูการตั้งค่าระบบ
/pending - ดู Staff ที่ยังไม่ได้ลงทะเบียน (🆕)

💡 Tips:
• คุณสามารถใช้คำสั่งเดียกับใน Group Chat ได้
• ใช้ Apps Script Editor สำหรับจัดการขั้นสูง

📝 สำหรับ Staff:
Staff ใช้คำสั่ง:
• /reg staff [StaffID] - ลงทะเบียน (🆕)
• /mystaffid - ดูข้อมูลตัวเอง (🆕)
• /complete [request_id] - อัพเดทสถานะงาน`;

  replyMessage(replyToken, helpText);
}

/**
 * แสดงข้อมูล Config สำหรับ Owner
 */
function sendConfigInfo(replyToken) {
  try {
    const config = getConfig();
    const stats = getUsageStats();
    
    const configText = `⚙️ การตั้งค่าระบบ

🤖 AI Provider: ${config.AI_MODEL}
📊 Google Sheets: ${config.STAFF_SHEET_ID ? '✅ เชื่อมต่อแล้ว' : '❌ ยังไม่ได้ตั้งค่า'}

📈 สถิติการใช้งาน:
• คำร้องทั้งหมด: ${stats.success ? stats.stats.total : 'N/A'}
• Staff: ${stats.success && config.STAFF_SHEET_ID ? 'ดูได้ใน Google Sheets' : 'N/A'}

⏰ เวลา: ${formatThaiDateTime(new Date())}

💡 ดูรายละเอียดใน Apps Script Editor`;

    replyMessage(replyToken, configText);
    
  } catch (error) {
    console.error('Error getting config info:', error);
    replyMessage(replyToken, '❌ ไม่สามารถดึงข้อมูลการตั้งค่าได้');
  }
}

/**
 * จัดการคำสั่งจาก Staff
 */
function handleStaffCommand(messageText, replyToken, userId, staffInfo) {
  const command = messageText.toLowerCase().trim();
  
  if (command.startsWith('/complete ')) {
    // คำสั่ง /complete [request_id]
    const requestId = command.substring(10).trim();
    
    if (requestId.length !== 14) {
      replyMessage(replyToken, `⚠️ รูปแบบ Request ID ไม่ถูกต้อง\n\nรูปแบบที่ถูกต้อง: YYYYMMDDHHmmss\nตัวอย่าง: 20251104102548\n\nใช้คำสั่ง: /complete 20251104102548`);
      return;
    }
    
    console.log(`✅ Complete command from ${staffInfo.name}: ${requestId}`);
    
    // อัพเดทสถานะคำร้อง
    completeRequest(requestId, userId, staffInfo, replyToken);
    
  } else if (command === '/help') {
    sendStaffHelpMessage(replyToken, staffInfo);
    
  } else if (command === '/myrequests') {
    sendStaffRequests(replyToken, staffInfo);
    
  } else {
    // คำสั่งอื่นๆ - ไม่ตอบ
    console.log('⚠️ Unknown command from staff - no response');
  }
}

/**
 * แสดงคำแนะนำสำหรับ Staff
 */
function sendStaffHelpMessage(replyToken, staffInfo) {
  const helpText = `👋 สวัสดี${staffInfo.name}

📝 คำสั่งสำหรับเจ้าหน้าที่:

✅ /complete [request_id]
   อัพเดทสถานะคำร้องเป็น "เสร็จสิ้น"
   
   ตัวอย่าง:
   /complete 20251104102548

📋 /myrequests
   ดูคำร้องที่มอบหมายให้คุณ

💡 /help
   แสดงคำแนะนำนี้

📌 หมายเหตุ:
Request ID คือเลข 14 หลัก (วันเวลาที่แจ้ง)
ตัวอย่าง: 20251104102548 = 4 พ.ย. 2025 เวลา 10:25:48`;

  replyMessage(replyToken, helpText);
}

/**
 * แสดงคำร้องที่มอบหมายให้ Staff
 */
function sendStaffRequests(replyToken, staffInfo) {
  try {
    const config = getConfig();
    
    if (!config.REQUEST_LOG_SHEET_ID) {
      replyMessage(replyToken, '❌ ระบบยังไม่ได้ตั้งค่า Request Log');
      return;
    }

    const sheet = SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID)
      .getSheetByName('Request Log');
    
    const data = sheet.getDataRange().getValues();
    
    // หาคำร้องที่ assigned ให้ staff คนนี้และยังไม่ COMPLETED
    const myRequests = data.slice(1).filter(row => 
      row[6] === staffInfo.staffId && 
      row[8] !== 'COMPLETED'
    );
    
    if (myRequests.length === 0) {
      replyMessage(replyToken, '✅ คุณไม่มีคำร้องค้างอยู่\nยอดเยี่ยม! 🎉');
      return;
    }
    
    let message = `📋 คำร้องที่มอบหมายให้คุณ (${myRequests.length})\n\n`;
    
    myRequests.forEach((row, index) => {
      const requestId = row[1];
      const issueType = row[4];
      const description = row[5].substring(0, 50) + (row[5].length > 50 ? '...' : '');
      const status = row[8];
      const priority = row[9];
      
      const priorityEmoji = priority === 'URGENT' ? '🚨' : '📋';
      const statusEmoji = getStatusEmoji(status);
      
      message += `${index + 1}. ${priorityEmoji} [${requestId}]\n`;
      message += `   ${statusEmoji} ${issueType}\n`;
      message += `   "${description}"\n\n`;
    });
    
    message += `💡 ใช้คำสั่ง: /complete [request_id] เพื่อปิดคำร้อง`;
    
    replyMessage(replyToken, message);
    
  } catch (error) {
    console.error('Error getting staff requests:', error);
    replyMessage(replyToken, '❌ เกิดข้อผิดพลาดในการดึงข้อมูล');
  }
}

/**
 * อัพเดทสถานะคำร้องเป็น COMPLETED
 */
function completeRequest(requestId, userId, staffInfo, replyToken) {
  try {
    const config = getConfig();
    
    if (!config.REQUEST_LOG_SHEET_ID) {
      replyMessage(replyToken, '❌ ระบบยังไม่ได้ตั้งค่า Request Log');
      return;
    }

    const sheet = SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID)
      .getSheetByName('Request Log');
    
    const data = sheet.getDataRange().getValues();
    
    // ✅ Normalize Request ID - แปลงเป็น string, trim, และลบช่องว่างทั้งหมด
    const normalizedRequestId = String(requestId)
      .trim()
      .replace(/\s+/g, ''); // ลบช่องว่างทั้งหมด
    
    // ✅ Validate Request ID format
    if (!/^\d{14}$/.test(normalizedRequestId)) {
      replyMessage(replyToken, 
        `⚠️ รูปแบบ Request ID ไม่ถูกต้อง\n\n` +
        `Request ID ต้องเป็นตัวเลข 14 หลัก\n` +
        `รูปแบบ: YYYYMMDDHHmmss\n\n` +
        `ตัวอย่าง: 20251104102548\n\n` +
        `คุณพิมพ์: "${requestId}"\n` +
        `(${requestId.length} ตัวอักษร)`
      );
      return;
    }
    
    console.log(`🔍 Searching for Request ID: "${normalizedRequestId}"`);
    
    // หาแถวที่ตรงกับ requestId
    let foundRow = -1;
    let requestData = null;
    let searchedRows = 0;
    
    for (let i = 1; i < data.length; i++) {
      // ข้าม empty rows
      if (!data[i][1]) continue;
      
      searchedRows++;
      
      // ✅ Normalize sheet Request ID
      const sheetRequestId = String(data[i][1])
        .trim()
        .replace(/\s+/g, '');
      
      // ✅ DEBUG: Log first 3 rows and matching rows
      if (searchedRows <= 3 || sheetRequestId === normalizedRequestId) {
        const match = sheetRequestId === normalizedRequestId;
        console.log(`   Row ${i + 1}: "${sheetRequestId}" ${match ? '✅ MATCH!' : ''}`);
      }
      
      if (sheetRequestId === normalizedRequestId) {
        foundRow = i + 1; // Row index (1-based)
        requestData = data[i];
        console.log(`✅ Found request at row ${foundRow}`);
        break;
      }
    }
    
    // ถ้าไม่เจอ - ให้ข้อมูลที่เป็นประโยชน์
    if (foundRow === -1) {
      console.error(`❌ Request ID not found: "${normalizedRequestId}"`);
      console.error(`   Total rows checked: ${searchedRows}`);
      
      // ✅ ตรวจสอบว่ามี Request ID ที่คล้ายกันหรือไม่
      const similarRequests = [];
      const searchPrefix = normalizedRequestId.substring(0, 8); // วันที่
      
      for (let i = 1; i < data.length; i++) {
        if (!data[i][1]) continue;
        
        const sheetRequestId = String(data[i][1]).trim().replace(/\s+/g, '');
        if (sheetRequestId.startsWith(searchPrefix)) {
          similarRequests.push(sheetRequestId);
        }
      }
      
      let errorMessage = `❌ ไม่พบคำร้องหมายเลข:\n${normalizedRequestId}\n\n`;
      
      if (similarRequests.length > 0) {
        errorMessage += `📋 คำร้องที่มีวันที่ใกล้เคียง:\n`;
        similarRequests.slice(0, 5).forEach(id => {
          errorMessage += `• ${id}\n`;
        });
        errorMessage += `\n`;
      }
      
      errorMessage += `💡 วิธีแก้:\n`;
      errorMessage += `• ตรวจสอบหมายเลขให้ถูกต้อง\n`;
      errorMessage += `• คัดลอกจากการแจ้งเตือน\n`;
      errorMessage += `• ใช้ /myrequests ดูคำร้องของคุณ`;
      
      replyMessage(replyToken, errorMessage);
      return;
    }
    
    // ✅ ตรวจสอบว่าคำร้องนี้ assigned ให้ staff คนนี้หรือไม่
    const assignedStaffId = String(requestData[6]).trim();
    const currentStaffId = String(staffInfo.staffId).trim();
    
    if (assignedStaffId !== currentStaffId) {
      const assignedStaffName = String(requestData[7] || 'ไม่ทราบ');
      
      replyMessage(replyToken, 
        `⚠️ คำร้องนี้ไม่ได้ assigned ให้คุณ\n\n` +
        `📋 Request ID: ${normalizedRequestId}\n` +
        `👤 Assigned to: ${assignedStaffName}\n` +
        `🔖 Your Staff ID: ${currentStaffId}\n\n` +
        `💡 ใช้ /myrequests เพื่อดูคำร้องของคุณ`
      );
      return;
    }
    
    // ✅ ตรวจสอบว่าเสร็จแล้วหรือยัง
    const currentStatus = String(requestData[8]).trim();
    
    if (currentStatus === 'COMPLETED') {
      const completedTime = requestData[0] ? formatThaiDateTime(requestData[0]) : 'ไม่ทราบ';
      
      replyMessage(replyToken, 
        `✅ คำร้องนี้เสร็จสิ้นแล้ว\n\n` +
        `📋 Request ID: ${normalizedRequestId}\n` +
        `⏰ เสร็จเมื่อ: ${completedTime}\n\n` +
        `ใช้ /myrequests ดูคำร้องที่ยังค้างอยู่`
      );
      return;
    }
    
    // ✅ อัพเดทสถานะพร้อม LockService เพื่อป้องกัน race condition
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); // Wait up to 10 seconds
      
      // อัพเดทสถานะ
      sheet.getRange(foundRow, 9).setValue('COMPLETED'); // Column I = Status
      
      // คำนวณ Response Time
      const requestTime = new Date(requestData[0]);
      const completedTime = new Date();
      const responseHours = Math.round((completedTime - requestTime) / (1000 * 60 * 60) * 10) / 10;
      
      sheet.getRange(foundRow, 11).setValue(responseHours + ' hours'); // Response Time
      sheet.getRange(foundRow, 12).setValue(`Completed by ${staffInfo.name} at ${formatThaiDateTime(completedTime)}`); // Notes
      
      console.log(`✅ Request ${normalizedRequestId} completed by ${staffInfo.name}`);
      
    } finally {
      lock.releaseLock();
    }
    
    // คำนวณ Response Time สำหรับแสดงผล
    const requestTime = new Date(requestData[0]);
    const completedTime = new Date();
    const responseHours = Math.round((completedTime - requestTime) / (1000 * 60 * 60) * 10) / 10;
    
    // ส่งการแจ้งเตือนกลับไปยัง Staff
    replyMessage(replyToken, 
      `✅ อัพเดทสถานะสำเร็จ!\n\n` +
      `🔖 Request ID: ${normalizedRequestId}\n` +
      `📋 ${requestData[4]}\n` +
      `⏱️ ใช้เวลา: ${responseHours} ชั่วโมง\n\n` +
      `ขอบคุณที่ดำเนินการครับ! 🙏`
    );
    
    // ส่งการแจ้งเตือนไปยังกลุ่ม (ถ้ามี groupId)
    const groupId = requestData[3];
    const requesterId = requestData[2];  // Column C = Requester ID
    if (groupId && groupId !== 'unknown') {
      notifyGroupRequestCompleted(groupId, normalizedRequestId, requestData[4], staffInfo.name, responseHours, requesterId);
    }
    
  } catch (error) {
    console.error('❌ Error completing request:', error);
    console.error('   Stack:', error.stack);
    
    let errorMsg = `❌ เกิดข้อผิดพลาดในการอัพเดทสถานะ\n\n`;
    
    if (error.message.includes('Lock')) {
      errorMsg += `⚠️ ระบบกำลังประมวลผลคำร้องอื่น\nกรุณารอสักครู่แล้วลองใหม่`;
    } else if (error.message.includes('Sheet')) {
      errorMsg += `⚠️ ไม่สามารถเข้าถึง Google Sheets\nกรุณาลองใหม่ในอีกสักครู่`;
    } else {
      errorMsg += `กรุณาลองใหม่อีกครั้ง\n\nหากปัญหายังคงอยู่ กรุณาติดต่อผู้ดูแลระบบ`;
    }
    
    replyMessage(replyToken, errorMsg);
  }
}

/**
 * แจ้งเตือนในกลุ่มว่าคำร้องเสร็จแล้ว (พร้อม Mention ผู้แจ้ง)
 */
function notifyGroupRequestCompleted(groupId, requestId, issueType, staffName, responseHours, requesterId) {
  try {
    const config = getConfig();
    
    if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
      console.error('❌ LINE token not configured');
      return;
    }

    // ดึงข้อมูลผู้แจ้งจาก LINE Profile
    const requesterProfile = getLineProfile(requesterId);
    
    if (!requesterProfile) {
      console.warn('⚠️ Cannot get requester profile, sending message without mention');
      // ส่งแบบไม่มี mention
      sendSimpleCompletionMessage(groupId, requestId, issueType, staffName, responseHours);
      return;
    }

    const displayName = requesterProfile.displayName;
    
    // สร้างข้อความพร้อม mention
    const mentionText = `@${displayName}`;
    const messageText = `${mentionText} ✅ คำร้องของคุณเสร็จสิ้นแล้ว

🔖 หมายเลข: ${requestId}
📋 ประเภท: ${issueType}
👤 ดำเนินการโดย: ${staffName}
⏱️ ใช้เวลา: ${responseHours} ชั่วโมง

ขอบคุณที่รอคอยครับ 🙏`;

    const payload = {
      to: groupId,
      messages: [
        {
          type: 'text',
          text: messageText,
          mentions: [
            {
              index: 0,  // เริ่มต้นที่ตำแหน่ง 0
              length: mentionText.length,  // ความยาวของ @DisplayName
              userId: requesterId
            }
          ]
        }
      ]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    console.log(`📤 Sending completion notification with mention to group ${groupId}`);
    
    const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    const statusCode = response.getResponseCode();
    
    if (statusCode !== 200) {
      console.error(`❌ LINE Push API Error (${statusCode}):`, response.getContentText());
    } else {
      console.log('✅ Completion notification with mention sent to group');
    }
    
  } catch (error) {
    console.error('❌ Error sending completion notification:', error);
  }
}

/**
 * ส่งข้อความแบบธรรมดา (กรณีดึง profile ไม่ได้)
 */
function sendSimpleCompletionMessage(groupId, requestId, issueType, staffName, responseHours) {
  try {
    const config = getConfig();
    
    const message = `✅ คำร้องเสร็จสิ้น

🔖 หมายเลข: ${requestId}
📋 ประเภท: ${issueType}
👤 ดำเนินการโดย: ${staffName}
⏱️ ใช้เวลา: ${responseHours} ชั่วโมง

ขอบคุณที่รอคอยครับ 🙏`;

    const payload = {
      to: groupId,
      messages: [{ type: 'text', text: message }]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    console.log('✅ Simple completion notification sent');
    
  } catch (error) {
    console.error('❌ Error sending simple message:', error);
  }
}

/**
 * แสดงข้อมูลสำหรับผู้ใช้ทั่วไปและเจ้าหน้าที่
 */
function sendPrivateChatInfo(replyToken) {
  const infoText = `👋 สวัสดีครับ!

🤖 ผมคือ Request Routing Bot

📝 สำหรับผู้ใช้ทั่วไป:
• บอทนี้ทำงานในกลุ่ม LINE เท่านั้น
• ใช้คำสั่ง: /request [รายละเอียดคำร้อง]
• บอทจะส่งต่อไปยังเจ้าหน้าที่อัตโนมัติ

ตัวอย่าง:
/request แอร์ห้อง 301 เสีย ช่วยตรวจสอบด้วยค่ะ

👤 สำหรับเจ้าหน้าที่ (Staff):
หากคุณเป็นเจ้าหน้าที่ กรุณาลงทะเบียนด้วย:
/reg staff [Staff ID]

ตัวอย่าง:
/reg staff STF001

💡 หลังลงทะเบียนแล้ว:
• คุณจะได้รับการแจ้งเตือนคำร้องอัตโนมัติ
• ใช้คำสั่ง /complete [ID] เพื่ออัพเดทสถานะ
• ใช้คำสั่ง /mystaffid เพื่อดูข้อมูลตัวเอง

ยินดีให้บริการครับ! 😊`;

  replyMessage(replyToken, infoText);
}

/**
 * จัดการเมื่อมีคนเพิ่มบอทเป็นเพื่อน
 */
function handleFollow(replyToken, userId) {
  console.log(`👋 New follower: ${userId}`);
  
  const isOwner = isOwnerUser(userId);
  const staffInfo = isStaffUser(userId);
  
  let welcomeMessage;
  
  if (isOwner) {
    welcomeMessage = `สวัสดีครับ! 👋

ยินดีต้อนรับอาจารย์พรึด! 🎉

✅ คุณสามารถ:
• ใช้งานบอทในแชทส่วนตัวได้เต็มรูปแบบ
• ดูสถิติและการตั้งค่าระบบ
• จัดการคำร้องทั้งหมด

พิมพ์ /help เพื่อดูคำแนะนำ`;
  } else if (staffInfo) {
    welcomeMessage = `สวัสดีครับ ${staffInfo.name}! 👋

ยินดีต้อนรับเจ้าหน้าที่ ${staffInfo.department} 🎉

✅ คำสั่งสำหรับคุณ:
• /complete [request_id] - ปิดคำร้อง
• /myrequests - ดูคำร้องของคุณ
• /help - ดูคำแนะนำ

เมื่อได้รับคำร้อง บอทจะส่งการแจ้งเตือนมาให้คุณครับ`;
  } else {
    welcomeMessage = `สวัสดีครับ! 👋

ยินดีต้อนรับสู่ระบบรับคำร้องอัตโนมัติ 🤖

📝 วิธีใช้งาน:
1️⃣ สำหรับผู้ใช้ทั่วไป:
• เชิญบอทเข้า Group Chat
• ส่งคำร้องด้วย: /request [รายละเอียด]

2️⃣ สำหรับเจ้าหน้าที่:
• รับ Staff ID จากผู้ดูแลระบบ
• ส่งคำสั่ง: /reg staff [Staff ID]
• ระบบจะแจ้งเตือนคำร้องอัตโนมัติ

💡 ตัวอย่างการใช้งาน:

ผู้ใช้ทั่วไป:
/request แอร์ห้อง 301 เสีย

เจ้าหน้าที่:
/reg staff STF001
/mystaffid
/complete 20251104102548

ยินดีให้บริการครับ! 😊`;
  }
  
  replyMessage(replyToken, welcomeMessage);

  // Log new follower
  console.log(`✅ Welcome message sent to ${userId}`);
}

/**
 * จัดการเมื่อบอทถูกเชิญเข้ากลุ่ม
 */
function handleJoin(replyToken) {
  console.log('🏠 Bot joined a group');
  
  const welcomeMessage = `สวัสดีทุกคนครับ! 👋

ผมคือบอทรับคำร้องอัตโนมัติ 🤖
ยินดีให้บริการกลุ่มนี้!

📝 วิธีส่งคำร้อง:
/request [รายละเอียดคำร้อง]

💡 ตัวอย่าง:
/request แอร์ห้อง 301 เสีย ช่วยตรวจสอบด้วยค่ะ
/request อินเทอร์เน็ตในห้องประชุมเชื่อมต่อไม่ได้

📌 หมายเหตุ:
• บอทตอบเฉพาะคำสั่งเท่านั้น
• ข้อความสนทนาทั่วไปจะไม่ถูกรบกวน
• คำร้องจะส่งต่อไปยังเจ้าหน้าที่อัตโนมัติ

ยินดีให้บริการครับ! 😊`;

  replyMessage(replyToken, welcomeMessage);
}

// =================================
// ACCESS CONTROL
// =================================

/**
 * ตรวจสอบว่าเป็นเจ้าของบอทหรือไม่
 */
function isOwnerUser(userId) {
  if (!userId) return false;
  
  try {
    const config = getConfig();
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

/**
 * ตรวจสอบว่าเป็น Staff หรือไม่ และคืนข้อมูล Staff
 */
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
    
    // หา staff ที่มี LINE User ID ตรงกัน
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[2] === userId) { // Column C = LINE User ID
        const staffInfo = {
          staffId: row[0],
          name: row[1],
          lineUserId: row[2],
          department: row[3],
          responsibilities: row[4] ? row[4].toString().split(',').map(r => r.trim()) : []
        };
        
        console.log(`👤 User ${userId}: ✅ STAFF - ${staffInfo.name} (${staffInfo.department})`);
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
// REQUEST PROCESSING
// =================================

/**
 * ประมวลผลคำร้องด้วย AI และส่งต่อเจ้าหน้าที่
 */
function processRequest(requestText, replyToken, groupId, userId, quoteToken) {
  try {
    console.log('🤖 Analyzing request with AI...');
    
    // วิเคราะห์คำร้องด้วย AI
    const analysis = analyzeRequestWithAI(requestText);
    
    if (!analysis || !analysis.category) {
      replyMessage(replyToken, '❌ ขออภัย ไม่สามารถวิเคราะห์คำร้องได้\nกรุณาระบุรายละเอียดให้ชัดเจนมากขึ้น\n\nตัวอย่าง:\n/request แอร์ห้อง 301 เสีย ช่วยตรวจสอบด้วยค่ะ', quoteToken);
      return;
    }

    console.log(`📊 Analysis result: ${analysis.category} (${analysis.priority})`);
    
    // หาเจ้าหน้าที่ที่เหมาะสม
    const assignedStaff = findResponsibleStaff(analysis.category);
    
    if (!assignedStaff) {
      replyMessage(
        replyToken, 
        `⚠️ ไม่พบเจ้าหน้าที่ที่รับผิดชอบเรื่อง: ${analysis.category}\n\nกรุณาติดต่อฝ่ายธุรการโดยตรง หรือลองใหม่อีกครั้ง`,
        quoteToken
      );
      return;
    }

    // สร้าง Request ID (รูปแบบ YYYYMMDDHHmmss)
    const requestId = generateRequestId();
    
    // บันทึกคำร้องลง Sheets
    const logResult = logRequest({
      requestId: requestId,
      timestamp: new Date(),
      requesterId: userId,
      groupId: groupId,
      issueType: analysis.category,
      description: requestText,
      assignedTo: assignedStaff.staffId,
      assignedName: assignedStaff.name,
      status: 'SENT',
      priority: analysis.priority || 'NORMAL'
    });

    if (!logResult.success) {
      console.error('❌ Failed to log request');
    }

    // ส่งคำร้องไปยังเจ้าหน้าที่
    const notificationSent = sendRequestToStaff(assignedStaff, {
      requestId: requestId,
      requester: userId,
      groupId: groupId,
      issueType: analysis.category,
      description: requestText,
      priority: analysis.priority || 'NORMAL',
      timestamp: new Date()
    });

    // ตอบกลับในกลุ่ม
    if (notificationSent) {
      const priorityText = analysis.priority === 'URGENT' ? '\n🚨 ระดับความเร่งด่วน: สูง' : '';
      
      const responseMessage = `✅ ได้รับคำร้องของคุณแล้ว

🔖 หมายเลขคำร้อง: ${requestId}
📋 ประเภท: ${analysis.category}
👤 ส่งต่อไปยัง: ${assignedStaff.name} (${assignedStaff.department})${priorityText}
⏰ ระยะเวลาโดยประมาณ: ${analysis.priority === 'URGENT' ? '4-8 ชั่วโมง' : '1-2 วันทำการ'}

เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด 🙏

💡 เก็บหมายเลขคำร้องไว้สำหรับการติดตาม`;

      replyMessage(replyToken, responseMessage, quoteToken);
      
      console.log(`✅ Request ${requestId} routed to ${assignedStaff.name}`);
    } else {
      replyMessage(
        replyToken,
        '⚠️ บันทึกคำร้องแล้ว แต่ไม่สามารถส่งการแจ้งเตือนไปยังเจ้าหน้าที่ได้\nเจ้าหน้าที่จะตรวจสอบคำร้องในระบบ',
        quoteToken
      );
    }
    
  } catch (error) {
    console.error('❌ Error processing request:', error);
    
    try {
      replyMessage(
        replyToken,
        '❌ ขออภัย ระบบขัดข้องชั่วคราว\nกรุณาลองใหม่อีกครั้งใน 1-2 นาที หรือติดต่อฝ่ายธุรการโดยตรง'
      );
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
}

// =================================
// AI ANALYSIS
// =================================

/**
 * วิเคราะห์คำร้องด้วย AI
 */
function analyzeRequestWithAI(requestText) {
  try {
    const config = getConfig();
    
    if (!config.API_KEY) {
      throw new Error('API key not configured');
    }

    const prompt = constructRequestAnalysisPrompt(requestText);
    
    console.log('🤖 Calling AI for request analysis...');
    
    const payload = {
      model: config.AI_MODEL,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ],
      temperature: 0.3,
      max_tokens: 500
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${config.API_KEY}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(config.AI_ENDPOINT, options);
    const statusCode = response.getResponseCode();
    
    if (statusCode !== 200) {
      throw new Error(`AI API error: ${statusCode}`);
    }

    const result = JSON.parse(response.getContentText());
    
    if (!result.choices || result.choices.length === 0) {
      throw new Error('No response from AI');
    }

    const aiResponse = result.choices[0].message.content.trim();
    console.log('🤖 AI Response:', aiResponse);
    
    // แปลง JSON response
    let analysisResult;
    try {
      const cleanedResponse = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      analysisResult = JSON.parse(cleanedResponse);
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

/**
 * สร้าง Prompt สำหรับวิเคราะห์คำร้องด้วย AI
 */
function constructRequestAnalysisPrompt(requestText) {
  const categories = getRequestCategories();
  
  const systemPrompt = `You are an AI assistant specialized in analyzing school facility and service requests for educational institutions. Your role is to accurately classify requests and assess their urgency to ensure proper routing to responsible staff.

**Available Categories and Their Responsibilities:**
${categories.map(cat => `• ${cat.category}: ${cat.responsibilities.join(', ')}`).join('\n')}

**Analysis Guidelines:**
1. **Read Carefully**: Understand the main issue and context of the request
2. **Keyword Matching**: Match keywords from the request with category responsibilities
3. **Context Analysis**: Consider location, time sensitivity, and impact on school operations
4. **Primary Category**: If multiple categories match, choose the MOST relevant one
5. **Location Extraction**: Identify specific locations (room numbers, buildings, areas)
6. **Impact Assessment**: Evaluate how the issue affects students, teachers, and operations

**Priority Classification Rules:**

**URGENT - ต้องดำเนินการทันที (2-8 ชั่วโมง):**
- Safety & Security Issues:
  - อันตราย, ไฟไหม้, ไฟฟ้าลัดวงจร, ก๊าซรั่ว
  - dangerous, fire, electrical hazard, gas leak
  
- Major System Failures:
  - ไฟฟ้าดับทั้งอาคาร, ประปาแตก, แอร์เสียทั้งชั้น
  - complete power outage, major water leak, building-wide AC failure
  
- Critical Equipment Breakdown:
  - เสียทั้งหมด, ไม่ทำงานเลย, พังหมด, ใช้งานไม่ได้
  - completely broken, non-functional, total failure
  
- High-Impact Events:
  - มีการสอบ, การประชุมสำคัญ, กิจกรรมโรงเรียน, ผู้ปกครองมาเยือน
  - exam in progress, important meeting, school event, parent visit
  
- Time-Sensitive Keywords:
  - ด่วน, ด่วนมาก, ฉุกเฉิน, ทันที, วันนี้, ตอนนี้
  - urgent, emergency, immediate, now, today, ASAP

**NORMAL - ดำเนินการตามปกติ (1-3 วันทำการ):**
- Routine Maintenance:
  - ซ่อมบำรุงตามปกติ, ตรวจเช็ค, เปลี่ยนอะไหล่
  - regular maintenance, inspection, part replacement
  
- Minor Issues:
  - ปัญหาเล็กน้อย, ไม่กระทบการใช้งาน, ค่อนข้างเสีย
  - minor problem, doesn't affect usage, partially working
  
- Administrative Requests:
  - ขอเปลี่ยนตาราง, ขอย้ายห้อง, ขอเอกสาร
  - schedule change, room relocation, document request
  
- General Inquiries:
  - สอบถาม, สอบถามข้อมูล, ขอคำแนะนำ
  - inquiry, information request, advice needed

**Response Format (MUST be valid JSON only):**
{
  "category": "exact category name from the list above",
  "priority": "URGENT or NORMAL",
  "keywords": ["key", "words", "extracted", "from", "request"],
  "summary": "brief summary in Thai (1-2 sentences, clear and concise)",
  "location": "specific location if mentioned (e.g., 'ห้อง 301', 'อาคาร 3', 'ห้องประชุม') or 'not specified'",
  "reasoning": "brief explanation in Thai why this category and priority were chosen (optional, for system logging)"
}

**Important Instructions:**
- Respond with ONLY valid JSON, no additional text before or after
- Use exact category names from the Available Categories list
- If the request is vague or doesn't match any category clearly, use "GENERAL_AFFAIRS"
- Always provide summary in Thai language regardless of request language
- Extract location information carefully (room numbers, building names, area names)
- Keywords should be the most important 3-5 words from the request
- Be conservative with URGENT classification - only for truly urgent matters

**Example Analysis (for reference only, do NOT include in response):**

Request: "แอร์ห้อง 301 เสีย เปิดแล้วไม่เย็น มีกลิ่นแปลกๆ ช่วยด่วน"
Response:
{
  "category": "FACILITIES",
  "priority": "URGENT",
  "keywords": ["แอร์", "เสีย", "ไม่เย็น", "กลิ่นแปลก", "ด่วน"],
  "summary": "เครื่องปรับอากาศห้อง 301 ชำรุดไม่ทำงาน มีกลิ่นผิดปกติ ต้องการความช่วยเหลือเร่งด่วน",
  "location": "ห้อง 301",
  "reasoning": "จัดเป็น FACILITIES เนื่องจากเป็นปัญหาเครื่องปรับอากาศ จัดเป็น URGENT เพราะมีคำว่า 'ด่วน' และ 'กลิ่นแปลก' ซึ่งอาจเป็นอันตราย"
}

Request: "อินเทอร์เน็ตในห้องคอมพิวเตอร์ช้ามาก"
Response:
{
  "category": "IT_SUPPORT",
  "priority": "NORMAL",
  "keywords": ["อินเทอร์เน็ต", "ช้า", "ห้องคอมพิวเตอร์"],
  "summary": "อินเทอร์เน็ตในห้องคอมพิวเตอร์มีความเร็วต่ำ",
  "location": "ห้องคอมพิวเตอร์",
  "reasoning": "จัดเป็น IT_SUPPORT เนื่องจากเป็นปัญหาเครือข่าย จัดเป็น NORMAL เพราะยังใช้งานได้แต่ช้า ไม่มีผลกระทบร้ายแรง"
}

Now analyze the following request and respond with ONLY the JSON format specified above.`;

  const userPrompt = `Request to analyze:

"${requestText}"

Provide your analysis in valid JSON format only.`;

  return {
    system: systemPrompt,
    user: userPrompt
  };
}

/**
 * Fallback: ดึงข้อมูลจาก text
 */
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
                   text.includes('เร่งด่วน') || 
                   text.includes('ด่วน') ||
                   text.includes('เสีย') ||
                   text.includes('พัง');
  
  return {
    category: foundCategory,
    priority: isUrgent ? 'URGENT' : 'NORMAL',
    keywords: [],
    summary: 'ไม่สามารถสร้างสรุปได้'
  };
}

// =================================
// STAFF MANAGEMENT
// =================================

/**
 * หาเจ้าหน้าที่ที่รับผิดชอบ
 */
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
      console.error('❌ No staff data available');
      return null;
    }

    // หา staff ที่ responsibilities ตรงกับ category
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const responsibilities = row[4] ? row[4].toString().split(',').map(r => r.trim()) : [];
      
      const categoryMatch = responsibilities.some(resp => 
        category.toLowerCase().includes(resp.toLowerCase()) ||
        resp.toLowerCase().includes(category.toLowerCase())
      );
      
      if (categoryMatch || category === row[3]) {
        return {
          staffId: row[0],
          name: row[1],
          lineUserId: row[2],
          department: row[3],
          responsibilities: responsibilities
        };
      }
    }

    // Fallback: ส่งไปหาเจ้าหน้าที่คนแรก
    if (data.length > 1) {
      const row = data[1];
      return {
        staffId: row[0],
        name: row[1],
        lineUserId: row[2],
        department: row[3],
        responsibilities: row[4] ? row[4].toString().split(',').map(r => r.trim()) : []
      };
    }

    return null;
    
  } catch (error) {
    console.error('❌ Error finding staff:', error);
    return null;
  }
}

/**
 * ดึงรายการ categories
 */
function getRequestCategories() {
  try {
    const config = getConfig();
    
    if (!config.STAFF_SHEET_ID) {
      return getDefaultCategories();
    }

    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');
    
    if (!sheet) {
      return getDefaultCategories();
    }

    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return getDefaultCategories();
    }

    const categories = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const responsibilities = row[4] ? row[4].toString().split(',').map(r => r.trim()) : [];
      
      categories.push({
        category: row[3],
        staffName: row[1],
        staffId: row[0],
        responsibilities: responsibilities
      });
    }

    return categories;
    
  } catch (error) {
    console.error('❌ Error getting categories:', error);
    return getDefaultCategories();
  }
}

/**
 * Categories เริ่มต้น
 */
function getDefaultCategories() {
  return [
    {
      category: 'IT_SUPPORT',
      staffName: 'IT Support',
      staffId: 'STF001',
      responsibilities: ['คอมพิวเตอร์', 'เครือข่าย', 'โปรแกรม', 'internet', 'wifi', 'computer']
    },
    {
      category: 'FACILITIES',
      staffName: 'Facilities',
      staffId: 'STF002',
      responsibilities: ['ห้องเรียน', 'แอร์', 'ไฟฟ้า', 'ประปา', 'ซ่อม', 'aircon', 'electricity']
    },
    {
      category: 'ACADEMIC',
      staffName: 'Academic Affairs',
      staffId: 'STF003',
      responsibilities: ['หลักสูตร', 'สอบ', 'เกรด', 'curriculum', 'exam', 'grade']
    },
    {
      category: 'GENERAL_AFFAIRS',
      staffName: 'General Affairs',
      staffId: 'STF004',
      responsibilities: ['ทั่วไป', 'อื่นๆ', 'general', 'other']
    }
  ];
}

// =================================
// NOTIFICATION
// =================================

/**
 * ส่งการแจ้งเตือนไปยังเจ้าหน้าที่
 */
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

    // ดึงข้อมูลผู้แจ้งจาก LINE Profile
    const requesterProfile = getLineProfile(requestData.requester);
    const requesterName = requesterProfile ? requesterProfile.displayName : 'ไม่ทราบชื่อ';
    
    // ดึงข้อมูลกลุ่ม (ถ้าเป็นกลุ่ม)
    const groupInfo = getGroupSummary(requestData.groupId);
    const groupName = groupInfo ? groupInfo.groupName : 'กลุ่ม LINE';

    const priorityEmoji = requestData.priority === 'URGENT' ? '🚨' : '📋';
    const priorityText = requestData.priority === 'URGENT' ? 'ด่วน!' : 'ปกติ';
    
    const message = `${priorityEmoji} คำร้องใหม่ - ${priorityText}

🔖 หมายเลข: ${requestData.requestId}
📋 ประเภท: ${requestData.issueType}
⏰ เวลา: ${formatThaiDateTime(requestData.timestamp)}

📝 รายละเอียด:
${requestData.description}

👤 ผู้แจ้ง: ${requesterName}
📍 จากกลุ่ม: ${groupName}

💡 ดำเนินการเสร็จแล้ว?
ส่งข้อความหาบอทใน Private Chat:
/complete ${requestData.requestId}

ขอบคุณครับ 🙏`;

    const payload = {
      to: staff.lineUserId,
      messages: [
        {
          type: 'text',
          text: message
        }
      ]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    console.log(`📤 Sending notification to ${staff.name} (${staff.lineUserId})`);
    
    const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    const statusCode = response.getResponseCode();
    
    if (statusCode !== 200) {
      const errorText = response.getContentText();
      console.error(`❌ LINE Push API Error (${statusCode}):`, errorText);
      return false;
    }
    
    console.log(`✅ Notification sent to ${staff.name}`);
    return true;

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return false;
  }
}

// =================================
// REQUEST LOGGING
// =================================

/**
 * บันทึกคำร้องลง Google Sheets
 */
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
    
    console.log(`💾 Request ${requestData.requestId} logged successfully`);
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error logging request:', error);
    return { success: false, error: error.message };
  }
}

// =================================
// STATUS & STATS
// =================================

/**
 * แสดงสถานะคำร้อง
 */
function sendRequestStatus(replyToken, requestId) {
  try {
    const config = getConfig();
    
    if (!config.REQUEST_LOG_SHEET_ID) {
      replyMessage(replyToken, '❌ ไม่สามารถเชื่อมต่อระบบได้');
      return;
    }

    const sheet = SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID)
      .getSheetByName('Request Log');
    
    const data = sheet.getDataRange().getValues();
    
    // ✅ Normalize Request ID - แปลงเป็น string, trim, และลบช่องว่างทั้งหมด
    const normalizedRequestId = String(requestId)
      .trim()
      .replace(/\s+/g, '');
    
    // ✅ Validate Request ID format
    if (!/^\d{14}$/.test(normalizedRequestId)) {
      replyMessage(replyToken, 
        `⚠️ รูปแบบ Request ID ไม่ถูกต้อง\n\n` +
        `Request ID ต้องเป็นตัวเลข 14 หลัก\n` +
        `รูปแบบ: YYYYMMDDHHmmss\n\n` +
        `ตัวอย่าง: 20251104102548\n\n` +
        `คุณพิมพ์: "${requestId}"\n` +
        `(${requestId.length} ตัวอักษร)`
      );
      return;
    }
    
    console.log(`🔍 Checking status for Request ID: "${normalizedRequestId}"`);
    
    // หาแถวที่ตรงกับ requestId
    let foundRow = -1;
    let requestData = null;
    let searchedRows = 0;
    
    for (let i = 1; i < data.length; i++) {
      // ข้าม empty rows
      if (!data[i][1]) continue;
      
      searchedRows++;
      
      // ✅ Normalize sheet Request ID
      const sheetRequestId = String(data[i][1])
        .trim()
        .replace(/\s+/g, '');
      
      // ✅ DEBUG: Log first 3 rows and matching rows
      if (searchedRows <= 3 || sheetRequestId === normalizedRequestId) {
        const match = sheetRequestId === normalizedRequestId;
        console.log(`   Row ${i + 1}: "${sheetRequestId}" ${match ? '✅ MATCH!' : ''}`);
      }
      
      if (sheetRequestId === normalizedRequestId) {
        foundRow = i + 1;
        requestData = data[i];
        console.log(`✅ Found request at row ${foundRow}`);
        break;
      }
    }
    
    // ถ้าไม่เจอ - ให้ข้อมูลที่เป็นประโยชน์
    if (foundRow === -1) {
      console.error(`❌ Request ID not found: "${normalizedRequestId}"`);
      console.error(`   Total rows checked: ${searchedRows}`);
      
      // ✅ ตรวจสอบว่ามี Request ID ที่คล้ายกันหรือไม่
      const similarRequests = [];
      const searchPrefix = normalizedRequestId.substring(0, 8); // วันที่
      
      for (let i = 1; i < data.length; i++) {
        if (!data[i][1]) continue;
        
        const sheetRequestId = String(data[i][1]).trim().replace(/\s+/g, '');
        if (sheetRequestId.startsWith(searchPrefix)) {
          similarRequests.push({
            id: sheetRequestId,
            status: data[i][8],
            type: data[i][4]
          });
        }
      }
      
      let errorMessage = `❌ ไม่พบคำร้องหมายเลข:\n${normalizedRequestId}\n\n`;
      
      if (similarRequests.length > 0) {
        errorMessage += `📋 คำร้องที่มีวันที่ใกล้เคียง:\n`;
        similarRequests.slice(0, 5).forEach(req => {
          const statusEmoji = getStatusEmoji(req.status);
          errorMessage += `${statusEmoji} ${req.id}\n   ${req.type}\n`;
        });
        errorMessage += `\n`;
      }
      
      errorMessage += `💡 วิธีตรวจสอบ:\n`;
      errorMessage += `• ตรวจสอบหมายเลขให้ถูกต้อง\n`;
      errorMessage += `• คัดลอกจากการแจ้งเตือน\n`;
      errorMessage += `• ติดต่อผู้ดูแลระบบหากมีปัญหา`;
      
      replyMessage(replyToken, errorMessage);
      return;
    }
    
    // ✅ พบแล้ว - แสดงสถานะ
    const statusEmoji = getStatusEmoji(requestData[8]);
    const priorityEmoji = requestData[9] === 'URGENT' ? '🚨' : '📋';
    
    // ✅ Format Response Time (if available)
    let responseTimeText = '';
    if (requestData[10] && requestData[10] !== '') {
      responseTimeText = `⏱️ เวลาตอบสนอง: ${requestData[10]}\n`;
    }
    
    // ✅ Format Notes (if available)
    let notesText = '';
    if (requestData[11] && requestData[11] !== '') {
      notesText = `\n📌 หมายเหตุ:\n${requestData[11]}`;
    }
    
    const statusText = `📊 สถานะคำร้อง

🔖 หมายเลข: ${normalizedRequestId}
📋 ประเภท: ${requestData[4]}
👤 เจ้าหน้าที่: ${requestData[7] || 'ยังไม่ได้มอบหมาย'}
${statusEmoji} สถานะ: ${requestData[8]}
${priorityEmoji} ความเร่งด่วน: ${requestData[9]}
⏰ วันที่แจ้ง: ${formatThaiDateTime(requestData[0])}
${responseTimeText}
📝 รายละเอียด:
${requestData[5]}${notesText}`;

    replyMessage(replyToken, statusText);
    console.log(`✅ Status sent for request ${normalizedRequestId}`);
    
  } catch (error) {
    console.error('❌ Error getting request status:', error);
    console.error('   Stack:', error.stack);
    
    let errorMsg = `❌ เกิดข้อผิดพลาดในการดึงข้อมูล\n\n`;
    
    if (error.message.includes('Sheet')) {
      errorMsg += `⚠️ ไม่สามารถเข้าถึง Google Sheets\nกรุณาลองใหม่ในอีกสักครู่`;
    } else {
      errorMsg += `กรุณาลองใหม่อีกครั้ง\n\nหากปัญหายังคงอยู่ กรุณาติดต่อผู้ดูแลระบบ`;
    }
    
    replyMessage(replyToken, errorMsg);
  }
}

/**
 * ส่งสถิติกลุ่ม
 */
function sendGroupStats(replyToken, groupId) {
  try {
    const config = getConfig();
    
    if (!config.REQUEST_LOG_SHEET_ID) {
      replyMessage(replyToken, '❌ ไม่สามารถเชื่อมต่อระบบได้');
      return;
    }

    const sheet = SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID)
      .getSheetByName('Request Log');
    
    const data = sheet.getDataRange().getValues();
    const groupRequests = data.slice(1).filter(row => row[3] === groupId);
    
    if (groupRequests.length === 0) {
      replyMessage(replyToken, '📊 ยังไม่มีคำร้องในกลุ่มนี้');
      return;
    }
    
    const stats = {
      total: groupRequests.length,
      sent: groupRequests.filter(r => r[8] === 'SENT').length,
      inProgress: groupRequests.filter(r => r[8] === 'IN_PROGRESS').length,
      completed: groupRequests.filter(r => r[8] === 'COMPLETED').length,
      urgent: groupRequests.filter(r => r[9] === 'URGENT').length
    };
    
    const statsText = `📊 สถิติคำร้องกลุ่มนี้

📋 คำร้องทั้งหมด: ${stats.total}
📤 รอดำเนินการ: ${stats.sent}
⚙️ กำลังดำเนินการ: ${stats.inProgress}
✅ เสร็จสิ้น: ${stats.completed}
🚨 ด่วน: ${stats.urgent}

⏰ เวลา: ${formatThaiDateTime(new Date())}`;

    replyMessage(replyToken, statsText);
    
  } catch (error) {
    console.error('Error getting stats:', error);
    replyMessage(replyToken, '❌ เกิดข้อผิดพลาดในการดึงข้อมูล');
  }
}

/**
 * ส่งสถิติทั้งหมด (สำหรับ Owner)
 */
function sendOverallStats(replyToken) {
  try {
    const stats = getUsageStats();
    
    if (!stats.success) {
      replyMessage(replyToken, '❌ ไม่สามารถดึงข้อมูลสถิติได้');
      return;
    }
    
    const s = stats.stats;
    
    const statsText = `📊 สถิติทั้งหมด

📋 คำร้องทั้งหมด: ${s.total}

สถานะ:
├─ 📤 รอดำเนินการ: ${s.byStatus.SENT}
├─ ⚙️ กำลังดำเนินการ: ${s.byStatus.IN_PROGRESS}
├─ ✅ เสร็จสิ้น: ${s.byStatus.COMPLETED}
└─ ❌ ยกเลิก: ${s.byStatus.CANCELLED}

ความเร่งด่วน:
├─ 🚨 ด่วน: ${s.byPriority.URGENT}
└─ 📋 ปกติ: ${s.byPriority.NORMAL}

แยกตามแผนก:
${Object.entries(s.byDepartment).map(([dept, count]) => `├─ ${dept}: ${count}`).join('\n')}

⏰ เวลา: ${formatThaiDateTime(new Date())}
📊 ดูรายละเอียด: ${stats.url}`;

    replyMessage(replyToken, statsText);
    
  } catch (error) {
    console.error('Error sending overall stats:', error);
    replyMessage(replyToken, '❌ เกิดข้อผิดพลาดในการดึงข้อมูล');
  }
}

// =================================
// LINE MESSAGING
// =================================

/**
 * ส่งข้อความตอบกลับ
 */
function replyMessage(replyToken, text, quoteToken = null) {
  const config = getConfig();
  
  if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('LINE token not configured');
  }

  const message = { type: 'text', text: text };
  if (quoteToken) message.quoteToken = quoteToken;

  const payload = {
    replyToken: replyToken,
    messages: [message]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', options);
    const statusCode = response.getResponseCode();
    
    if (statusCode !== 200) {
      const errorText = response.getContentText();
      console.error(`LINE API Error (${statusCode}):`, errorText);
      throw new Error(`LINE API error: ${statusCode}`);
    }
    
    console.log('✅ Message sent successfully');
    
  } catch (error) {
    console.error('❌ Failed to send message:', error);
    throw error;
  }
}

/**
 * แสดง loading indicator
 */
function startLoading(userId) {
  const config = getConfig();
  if (!config.LINE_CHANNEL_ACCESS_TOKEN) return;

  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
      payload: JSON.stringify({ chatId: userId }),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch('https://api.line.me/v2/bot/chat/loading/start', options);
    console.log('⏳ Loading indicator started');
    
  } catch (error) {
    console.error('⚠️ Loading indicator failed:', error);
  }
}

// =================================
// UTILITIES
// =================================

/**
 * สร้าง response
 */
function createResponse(data, statusCode = 200) {
  const response = typeof data === 'string' ? { message: data } : data;
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setStatusCode(200);
}

/**
 * สร้าง Request ID (รูปแบบ YYYYMMDDHHmmss)
 */
function generateRequestId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Format วันที่เวลาเป็นภาษาไทย
 */
function formatThaiDateTime(date) {
  return Utilities.formatDate(
    new Date(date),
    'Asia/Bangkok',
    'dd/MM/yyyy HH:mm'
  );
}

/**
 * ดึง emoji ตามสถานะ
 */
function getStatusEmoji(status) {
  const emojiMap = {
    'SENT': '📤',
    'IN_PROGRESS': '⚙️',
    'COMPLETED': '✅',
    'CANCELLED': '❌'
  };
  return emojiMap[status] || '📋';
}

/**
 * ดึง Display Name และ Status Message จาก LINE Profile
 */
function getLineProfile(userId) {
  try {
    const config = getConfig();
    
    if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
      console.error('❌ LINE token not configured');
      return null;
    }

    if (!userId || userId === 'unknown') {
      console.warn('⚠️ Invalid user ID');
      return null;
    }

    const options = {
      method: 'get',
      headers: { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
      muteHttpExceptions: true
    };

    console.log(`👤 Fetching profile for user: ${userId}`);
    
    const response = UrlFetchApp.fetch(
      `https://api.line.me/v2/bot/profile/${userId}`,
      options
    );
    
    const statusCode = response.getResponseCode();
    
    if (statusCode !== 200) {
      console.error(`❌ LINE Profile API Error (${statusCode}):`, response.getContentText());
      return null;
    }

    const profile = JSON.parse(response.getContentText());
    
    console.log(`✅ Profile fetched: ${profile.displayName}`);
    
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl || null,
      statusMessage: profile.statusMessage || null
    };
    
  } catch (error) {
    console.error('❌ Error fetching LINE profile:', error);
    return null;
  }
}

/**
 * ดึงชื่อกลุ่มจาก LINE
 */
function getGroupSummary(groupId) {
  try {
    const config = getConfig();
    
    if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
      return null;
    }

    if (!groupId || groupId === 'unknown') {
      return null;
    }

    const options = {
      method: 'get',
      headers: { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
      muteHttpExceptions: true
    };

    console.log(`📍 Fetching group info: ${groupId}`);
    
    const response = UrlFetchApp.fetch(
      `https://api.line.me/v2/bot/group/${groupId}/summary`,
      options
    );
    
    const statusCode = response.getResponseCode();
    
    if (statusCode !== 200) {
      console.warn(`⚠️ Cannot get group info (${statusCode})`);
      return null;
    }

    const groupInfo = JSON.parse(response.getContentText());
    
    console.log(`✅ Group name: ${groupInfo.groupName}`);
    
    return {
      groupId: groupInfo.groupId,
      groupName: groupInfo.groupName,
      pictureUrl: groupInfo.pictureUrl || null
    };
    
  } catch (error) {
    console.warn('⚠️ Cannot get group info:', error.message);
    return null;
  }
}

/**
 * ดึงสถิติการใช้งาน
 */
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
          total: 0,
          byStatus: { SENT: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 },
          byPriority: { URGENT: 0, NORMAL: 0 },
          byDepartment: {}
        }
      };
    }
    
    const requests = data.slice(1);
    
    const stats = {
      total: requests.length,
      byStatus: {
        SENT: requests.filter(r => r[8] === 'SENT').length,
        IN_PROGRESS: requests.filter(r => r[8] === 'IN_PROGRESS').length,
        COMPLETED: requests.filter(r => r[8] === 'COMPLETED').length,
        CANCELLED: requests.filter(r => r[8] === 'CANCELLED').length
      },
      byPriority: {
        URGENT: requests.filter(r => r[9] === 'URGENT').length,
        NORMAL: requests.filter(r => r[9] === 'NORMAL').length
      },
      byDepartment: {}
    };
    
    requests.forEach(r => {
      const dept = r[4];
      if (dept) {
        stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;
      }
    });
    
    return {
      success: true,
      stats: stats,
      url: SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID).getUrl()
    };
    
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    return { success: false, error: error.message };
  }
}
