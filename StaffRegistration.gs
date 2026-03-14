// StaffRegistration.gs - Auto Staff Registration System
// ระบบลงทะเบียน Staff อัตโนมัติด้วยคำสั่ง /reg staff
// Version: 1.0 - Easy Staff Registration

// =================================
// STAFF REGISTRATION COMMANDS
// =================================

/**
 * จัดการคำสั่งลงทะเบียน Staff
 * เพิ่มใน handlePrivateMessage() function ของ Code.gs
 */
function handleStaffRegistration(messageText, replyToken, userId) {
  const command = messageText.toLowerCase().trim();
  
  // คำสั่งลงทะเบียน: /reg staff [staffId]
  if (command.startsWith('/reg staff ')) {
    const staffId = command.substring(11).trim().toUpperCase();
    registerStaff(staffId, userId, replyToken);
    return true;
  }
  
  // คำสั่งยกเลิกการลงทะเบียน: /unreg
  if (command === '/unreg') {
    unregisterStaff(userId, replyToken);
    return true;
  }
  
  // คำสั่งตรวจสอบข้อมูลตัวเอง: /mystaffid
  if (command === '/mystaffid') {
    showMyStaffInfo(userId, replyToken);
    return true;
  }
  
  // คำสั่งแสดงรายการ Staff ID ที่ยังไม่ได้ลงทะเบียน (เฉพาะ Owner)
  if (command === '/pending') {
    if (isOwnerUser(userId)) {
      showPendingStaffRegistrations(replyToken);
      return true;
    }
  }
  
  return false;
}

// =================================
// STAFF REGISTRATION FUNCTIONS
// =================================

/**
 * ลงทะเบียน Staff ด้วย Staff ID
 */
function registerStaff(staffId, userId, replyToken) {
  console.log(`🔐 Staff registration attempt: ${staffId} by ${userId}`);
  
  try {
    // ตรวจสอบรูปแบบ Staff ID
    if (!staffId || staffId.length < 3) {
      replyMessage(replyToken, 
        `⚠️ รูปแบบ Staff ID ไม่ถูกต้อง\n\n` +
        `รูปแบบที่ถูกต้อง:\n` +
        `/reg staff STF001\n` +
        `/reg staff STF002\n\n` +
        `💡 กรุณาระบุ Staff ID ของคุณตามที่ได้รับแจ้ง`
      );
      return;
    }
    
    const config = getConfig();
    
    if (!config.STAFF_SHEET_ID) {
      replyMessage(replyToken, '❌ ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
      return;
    }
    
    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');
    
    const data = sheet.getDataRange().getValues();
    
    // ตรวจสอบว่ามี Staff ID นี้ในระบบหรือไม่
    let staffRow = -1;
    let staffData = null;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === staffId) {
        staffRow = i + 1; // Google Sheets rows start at 1, +1 for header
        staffData = data[i];
        break;
      }
    }
    
    if (staffRow === -1) {
      replyMessage(replyToken, 
        `❌ ไม่พบ Staff ID: ${staffId}\n\n` +
        `กรุณาตรวจสอบ Staff ID ของคุณอีกครั้ง\n` +
        `หรือติดต่อผู้ดูแลระบบเพื่อขอเพิ่ม Staff ID`
      );
      return;
    }
    
    // ตรวจสอบว่า Staff ID นี้มีคนลงทะเบียนแล้วหรือไม่
    const existingLineUserId = staffData[2]; // Column C (LINE User ID)
    
    if (existingLineUserId && 
        existingLineUserId.startsWith('U') && 
        existingLineUserId !== 'Uxxxxxxxxxxxxxxxx') {
      
      if (existingLineUserId === userId) {
        // ลงทะเบียนซ้ำด้วย User ID เดิม
        replyMessage(replyToken, 
          `✅ คุณลงทะเบียนแล้ว\n\n` +
          `📋 ข้อมูลของคุณ:\n` +
          `• Staff ID: ${staffData[0]}\n` +
          `• ชื่อ: ${staffData[1]}\n` +
          `• แผนก: ${staffData[3]}\n\n` +
          `💡 ใช้คำสั่ง /mystaffid เพื่อดูข้อมูล`
        );
      } else {
        // มีคนอื่นลงทะเบียน Staff ID นี้แล้ว
        replyMessage(replyToken, 
          `❌ Staff ID นี้ถูกลงทะเบียนแล้ว\n\n` +
          `หาก Staff ID นี้เป็นของคุณจริง กรุณาติดต่อผู้ดูแลระบบ`
        );
      }
      return;
    }
    
    // ตรวจสอบว่า User ID นี้ลงทะเบียนกับ Staff ID อื่นแล้วหรือไม่
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === userId && data[i][0] !== staffId) {
        replyMessage(replyToken, 
          `⚠️ คุณลงทะเบียนกับ Staff ID อื่นแล้ว\n\n` +
          `Staff ID ปัจจุบัน: ${data[i][0]}\n` +
          `ชื่อ: ${data[i][1]}\n\n` +
          `หากต้องการเปลี่ยน กรุณาใช้คำสั่ง /unreg ก่อน`
        );
        return;
      }
    }
    
    // ดึงข้อมูลโปรไฟล์จาก LINE
    const profile = getLineProfile(userId);
    const displayName = profile ? profile.displayName : 'ไม่สามารถดึงชื่อได้';
    
    // อัพเดท LINE User ID ในระบบ
    sheet.getRange(staffRow, 3).setValue(userId); // Column C
    
    // เพิ่มหมายเหตุการลงทะเบียน (ถ้ามี Column F สำหรับ Notes)
    const registrationNote = `ลงทะเบียนโดย: ${displayName} | ${formatThaiDateTime(new Date())}`;
    if (sheet.getLastColumn() >= 6) {
      const currentNote = sheet.getRange(staffRow, 6).getValue();
      const newNote = currentNote ? `${currentNote}\n${registrationNote}` : registrationNote;
      sheet.getRange(staffRow, 6).setValue(newNote);
    }
    
    console.log(`✅ Staff registered: ${staffId} -> ${userId}`);
    
    // ส่งข้อความยืนยันให้ Staff
    const confirmationMessage = 
      `✅ ลงทะเบียนสำเร็จ!\n\n` +
      `📋 ข้อมูลของคุณ:\n` +
      `• Staff ID: ${staffData[0]}\n` +
      `• ชื่อ: ${staffData[1]}\n` +
      `• LINE Name: ${displayName}\n` +
      `• แผนก: ${staffData[3]}\n` +
      `• ความรับผิดชอบ: ${staffData[4]}\n\n` +
      `🔔 ตั้งแต่นี้คุณจะได้รับการแจ้งเตือนเมื่อมีคำร้องเกี่ยวกับงานของคุณ\n\n` +
      `💡 คำสั่งที่ใช้ได้:\n` +
      `/mystaffid - ดูข้อมูลตัวเอง\n` +
      `/complete [ID] - อัพเดทสถานะงาน\n` +
      `/unreg - ยกเลิกการลงทะเบียน`;
    
    replyMessage(replyToken, confirmationMessage);
    
    // แจ้งเตือน Owner
    notifyOwnerNewStaffRegistration(staffData, displayName, userId);
    
  } catch (error) {
    console.error('❌ Staff registration error:', error);
    replyMessage(replyToken, 
      `❌ เกิดข้อผิดพลาดในการลงทะเบียน\n\n` +
      `กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ`
    );
  }
}

/**
 * ยกเลิกการลงทะเบียน Staff
 */
function unregisterStaff(userId, replyToken) {
  console.log(`🔓 Staff unregistration attempt by ${userId}`);
  
  try {
    const config = getConfig();
    
    if (!config.STAFF_SHEET_ID) {
      replyMessage(replyToken, '❌ ระบบยังไม่พร้อมใช้งาน');
      return;
    }
    
    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');
    
    const data = sheet.getDataRange().getValues();
    
    // หา Staff ที่มี User ID นี้
    let staffRow = -1;
    let staffData = null;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === userId) {
        staffRow = i + 1;
        staffData = data[i];
        break;
      }
    }
    
    if (staffRow === -1) {
      replyMessage(replyToken, 
        `⚠️ คุณยังไม่ได้ลงทะเบียนในระบบ\n\n` +
        `ใช้คำสั่ง /reg staff [StaffID] เพื่อลงทะเบียน`
      );
      return;
    }
    
    // ลบ LINE User ID
    sheet.getRange(staffRow, 3).setValue(''); // Clear Column C
    
    // เพิ่มหมายเหตุการยกเลิก
    const profile = getLineProfile(userId);
    const displayName = profile ? profile.displayName : 'Unknown';
    const unregNote = `ยกเลิกการลงทะเบียนโดย: ${displayName} | ${formatThaiDateTime(new Date())}`;
    
    if (sheet.getLastColumn() >= 6) {
      const currentNote = sheet.getRange(staffRow, 6).getValue();
      const newNote = currentNote ? `${currentNote}\n${unregNote}` : unregNote;
      sheet.getRange(staffRow, 6).setValue(newNote);
    }
    
    console.log(`✅ Staff unregistered: ${staffData[0]} (${userId})`);
    
    replyMessage(replyToken, 
      `✅ ยกเลิกการลงทะเบียนสำเร็จ\n\n` +
      `Staff ID: ${staffData[0]}\n` +
      `ชื่อ: ${staffData[1]}\n\n` +
      `คุณจะไม่ได้รับการแจ้งเตือนอีกต่อไป\n\n` +
      `💡 หากต้องการลงทะเบียนใหม่ ใช้:\n` +
      `/reg staff ${staffData[0]}`
    );
    
    // แจ้งเตือน Owner
    notifyOwnerStaffUnregistration(staffData, displayName);
    
  } catch (error) {
    console.error('❌ Staff unregistration error:', error);
    replyMessage(replyToken, '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  }
}

/**
 * แสดงข้อมูล Staff ของตัวเอง
 */
function showMyStaffInfo(userId, replyToken) {
  try {
    const config = getConfig();
    
    if (!config.STAFF_SHEET_ID) {
      replyMessage(replyToken, '❌ ระบบยังไม่พร้อมใช้งาน');
      return;
    }
    
    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');
    
    const data = sheet.getDataRange().getValues();
    
    // หา Staff
    let staffData = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === userId) {
        staffData = data[i];
        break;
      }
    }
    
    if (!staffData) {
      replyMessage(replyToken, 
        `⚠️ คุณยังไม่ได้ลงทะเบียนในระบบ\n\n` +
        `วิธีลงทะเบียน:\n` +
        `1. รับ Staff ID จากผู้ดูแลระบบ\n` +
        `2. ส่งคำสั่ง: /reg staff [StaffID]\n\n` +
        `ตัวอย่าง:\n` +
        `/reg staff STF001`
      );
      return;
    }
    
    // ดึงโปรไฟล์ LINE
    const profile = getLineProfile(userId);
    const displayName = profile ? profile.displayName : 'ไม่สามารถดึงข้อมูลได้';
    
    const infoMessage = 
      `📋 ข้อมูล Staff ของคุณ\n\n` +
      `• Staff ID: ${staffData[0]}\n` +
      `• ชื่อในระบบ: ${staffData[1]}\n` +
      `• LINE Name: ${displayName}\n` +
      `• แผนก: ${staffData[3]}\n` +
      `• ความรับผิดชอบ:\n  ${staffData[4].split(',').join('\n  ')}\n\n` +
      `• LINE User ID:\n  ${userId}\n\n` +
      `🔔 สถานะ: ✅ ลงทะเบียนแล้ว\n\n` +
      `💡 คำสั่งที่ใช้ได้:\n` +
      `/complete [ID] - อัพเดทสถานะงาน\n` +
      `/unreg - ยกเลิกการลงทะเบียน`;
    
    replyMessage(replyToken, infoMessage);
    
  } catch (error) {
    console.error('❌ Error showing staff info:', error);
    replyMessage(replyToken, '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  }
}

/**
 * แสดงรายการ Staff ที่ยังไม่ได้ลงทะเบียน (เฉพาะ Owner)
 */
function showPendingStaffRegistrations(replyToken) {
  try {
    const config = getConfig();
    
    if (!config.STAFF_SHEET_ID) {
      replyMessage(replyToken, '❌ ระบบยังไม่พร้อมใช้งาน');
      return;
    }
    
    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');
    
    const data = sheet.getDataRange().getValues();
    
    const pending = [];
    const registered = [];
    
    for (let i = 1; i < data.length; i++) {
      const staffId = data[i][0];
      const name = data[i][1];
      const lineUserId = data[i][2];
      const dept = data[i][3];
      
      if (!lineUserId || !lineUserId.startsWith('U') || lineUserId === 'Uxxxxxxxxxxxxxxxx') {
        pending.push({ staffId, name, dept });
      } else {
        registered.push({ staffId, name, dept });
      }
    }
    
    let message = `📊 สถานะการลงทะเบียน Staff\n\n`;
    message += `✅ ลงทะเบียนแล้ว: ${registered.length} คน\n`;
    message += `⏳ รอลงทะเบียน: ${pending.length} คน\n\n`;
    
    if (pending.length > 0) {
      message += `📋 Staff ที่ยังไม่ได้ลงทะเบียน:\n\n`;
      pending.forEach((staff, index) => {
        message += `${index + 1}. ${staff.staffId}\n`;
        message += `   ชื่อ: ${staff.name}\n`;
        message += `   แผนก: ${staff.dept}\n\n`;
      });
      message += `💡 แนะนำให้ Staff ส่งคำสั่ง:\n/reg staff [StaffID]`;
    } else {
      message += `🎉 Staff ทุกคนลงทะเบียนเรียบร้อยแล้ว!`;
    }
    
    replyMessage(replyToken, message);
    
  } catch (error) {
    console.error('❌ Error showing pending registrations:', error);
    replyMessage(replyToken, '❌ เกิดข้อผิดพลาด');
  }
}

// =================================
// NOTIFICATION FUNCTIONS
// =================================

/**
 * แจ้งเตือน Owner เมื่อมี Staff ลงทะเบียนใหม่
 */
function notifyOwnerNewStaffRegistration(staffData, displayName, userId) {
  try {
    const config = getConfig();
    const ownerId = config.OWNER_USER_ID;
    
    if (!ownerId) {
      console.log('⚠️ Owner User ID not configured - skipping notification');
      return;
    }
    
    const message = 
      `🔔 การลงทะเบียน Staff ใหม่\n\n` +
      `✅ ลงทะเบียนสำเร็จ:\n\n` +
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

/**
 * แจ้งเตือน Owner เมื่อมี Staff ยกเลิกการลงทะเบียน
 */
function notifyOwnerStaffUnregistration(staffData, displayName) {
  try {
    const config = getConfig();
    const ownerId = config.OWNER_USER_ID;
    
    if (!ownerId) {
      console.log('⚠️ Owner User ID not configured - skipping notification');
      return;
    }
    
    const message = 
      `⚠️ การยกเลิกลงทะเบียน Staff\n\n` +
      `❌ Staff ยกเลิกการลงทะเบียน:\n\n` +
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
// HELPER FUNCTIONS
// =================================

/**
 * ส่งข้อความแบบ Push (ไม่ใช้ reply token)
 */
function pushMessage(userId, text) {
  const config = getConfig();
  
  if (!config.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('LINE token not configured');
  }

  const payload = {
    to: userId,
    messages: [{ type: 'text', text: text }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    const statusCode = response.getResponseCode();
    
    if (statusCode !== 200) {
      console.error(`LINE API Error (${statusCode}):`, response.getContentText());
      throw new Error(`LINE API error: ${statusCode}`);
    }
    
    console.log('✅ Push message sent successfully');
    
  } catch (error) {
    console.error('❌ Failed to send push message:', error);
    throw error;
  }
}

// =================================
// TESTING FUNCTIONS
// =================================

/**
 * ทดสอบระบบลงทะเบียน (เรียกใน Apps Script Editor)
 */
function testStaffRegistrationSystem() {
  console.log('🧪 Testing Staff Registration System...\n');
  
  try {
    const config = getConfig();
    
    // Test 1: Check Staff Sheet
    console.log('TEST 1: Checking Staff Directory...');
    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');
    const data = sheet.getDataRange().getValues();
    
    console.log(`✅ Found ${data.length - 1} staff records`);
    
    // Test 2: List available Staff IDs
    console.log('\nTEST 2: Available Staff IDs:');
    for (let i = 1; i < data.length; i++) {
      const staffId = data[i][0];
      const name = data[i][1];
      const lineUserId = data[i][2];
      const hasRegistered = lineUserId && lineUserId.startsWith('U') && lineUserId !== 'Uxxxxxxxxxxxxxxxx';
      
      console.log(`  ${staffId} - ${name} ${hasRegistered ? '✅' : '⏳'}`);
    }
    
    console.log('\n✅ Test completed!');
    console.log('\n📝 Next steps:');
    console.log('1. แจกจ่าย Staff ID ให้กับเจ้าหน้าที่');
    console.log('2. แนะนำให้ส่งคำสั่ง: /reg staff [StaffID]');
    console.log('3. ตรวจสอบการลงทะเบียนด้วยคำสั่ง: /pending');
    
    return {
      success: true,
      totalStaff: data.length - 1,
      sheetUrl: SpreadsheetApp.openById(config.STAFF_SHEET_ID).getUrl()
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
}
