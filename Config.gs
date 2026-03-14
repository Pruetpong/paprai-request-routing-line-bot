// Config.gs - Configuration Management
// การตั้งค่าสำหรับ Command-Based Request Routing Bot
// Version: 2.0 - With Owner User ID Support

// =================================
// BOT CONFIGURATION
// =================================

const BOT_CONFIG = {
  // ชื่อบอท
  BOT_NAME: 'Command-Based Request Bot',
  BOT_VERSION: '2.0',
  
  // AI Parameters
  AI_TEMPERATURE: 0.3,
  AI_MAX_TOKENS: 500,

  // Default AI Model
  DEFAULT_AI_MODEL: 'gpt-4o-mini',
  DEFAULT_AI_ENDPOINT: 'https://api.openai.com/v1/chat/completions',

  // Request Settings
  MIN_REQUEST_LENGTH: 10,
  
  // Feature Flags
  COMMAND_BASED: true,          // ใช้คำสั่ง /request เท่านั้น
  OWNER_ONLY_PRIVATE: true,     // แชทส่วนตัวเฉพาะ Owner
  STAFF_COMMAND_ONLY: true,     // Staff ใช้เฉพาะคำสั่ง /complete
  ENABLE_LOGGING: true,
  SEND_CONFIRMATION: true,
  NOTIFY_STAFF: true
};

// =================================
// CREDENTIALS MANAGEMENT
// =================================

/**
 * ตั้งค่าแต่ละ key
 */
function setConfig(key, value) {
  try {
    const validKeys = [
      'API_KEY',
      'AI_ENDPOINT',
      'AI_MODEL',
      'LINE_CHANNEL_ACCESS_TOKEN',
      'STAFF_SHEET_ID',
      'REQUEST_LOG_SHEET_ID',
      'OWNER_USER_ID'
    ];

    if (!validKeys.includes(key)) {
      throw new Error(`Invalid config key: ${key}. Valid keys: ${validKeys.join(', ')}`);
    }

    if (!value || value.toString().trim() === '') {
      throw new Error(`Value cannot be empty for ${key}`);
    }

    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(key, value.toString());
    properties.setProperty(`${key}_UPDATED`, new Date().toISOString());
    
    console.log(`✅ Successfully set ${key}`);
    return { success: true, message: `${key} configured successfully` };

  } catch (error) {
    console.error(`❌ Error setting ${key}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * ดึงค่า config ทั้งหมด
 */
function getConfig() {
  try {
    const properties = PropertiesService.getScriptProperties();
    
    return {
      // API Credentials
      API_KEY: properties.getProperty('API_KEY'),
      AI_ENDPOINT: properties.getProperty('AI_ENDPOINT') || BOT_CONFIG.DEFAULT_AI_ENDPOINT,
      AI_MODEL: properties.getProperty('AI_MODEL') || BOT_CONFIG.DEFAULT_AI_MODEL,
      
      // LINE Configuration
      LINE_CHANNEL_ACCESS_TOKEN: properties.getProperty('LINE_CHANNEL_ACCESS_TOKEN'),
      
      // Google Sheets
      STAFF_SHEET_ID: properties.getProperty('STAFF_SHEET_ID'),
      REQUEST_LOG_SHEET_ID: properties.getProperty('REQUEST_LOG_SHEET_ID'),
      
      // Owner Configuration
      OWNER_USER_ID: properties.getProperty('OWNER_USER_ID'),
      
      // AI Parameters
      AI_TEMPERATURE: BOT_CONFIG.AI_TEMPERATURE,
      AI_MAX_TOKENS: BOT_CONFIG.AI_MAX_TOKENS,
      
      // Feature Flags
      COMMAND_BASED: BOT_CONFIG.COMMAND_BASED,
      OWNER_ONLY_PRIVATE: BOT_CONFIG.OWNER_ONLY_PRIVATE,
      STAFF_COMMAND_ONLY: BOT_CONFIG.STAFF_COMMAND_ONLY,
      ENABLE_LOGGING: BOT_CONFIG.ENABLE_LOGGING,
      NOTIFY_STAFF: BOT_CONFIG.NOTIFY_STAFF
    };

  } catch (error) {
    console.error('❌ Error getting config:', error);
    throw new Error(`Failed to get configuration: ${error.message}`);
  }
}

/**
 * ตรวจสอบความถูกต้องของ config
 */
function validateConfig() {
  console.log('🔍 Validating configuration...');
  
  try {
    const config = getConfig();
    
    const results = {
      api_key: !!config.API_KEY && config.API_KEY.length > 20,
      ai_endpoint: !!config.AI_ENDPOINT && config.AI_ENDPOINT.startsWith('http'),
      ai_model: !!config.AI_MODEL && config.AI_MODEL.length > 3,
      line_token: !!config.LINE_CHANNEL_ACCESS_TOKEN && config.LINE_CHANNEL_ACCESS_TOKEN.length > 100,
      staff_sheet: !!config.STAFF_SHEET_ID,
      request_log_sheet: !!config.REQUEST_LOG_SHEET_ID,
      owner_user_id: !!config.OWNER_USER_ID
    };
    
    const allValid = Object.values(results).every(Boolean);
    
    console.log('📊 Validation Results:');
    console.log(results);
    console.log(`Status: ${allValid ? '✅ VALID' : '⚠️ INCOMPLETE'}`);
    
    if (!allValid) {
      const missing = Object.entries(results)
        .filter(([key, value]) => !value)
        .map(([key]) => key);
      console.warn('⚠️ Missing or invalid:', missing);
      return { valid: false, missing: missing };
    }
    
    return { valid: true, message: 'All configurations are valid' };

  } catch (error) {
    console.error('❌ Validation error:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * ลบ config ทั้งหมด
 */
function clearConfig() {
  console.log('⚠️ Clearing all configuration...');
  
  try {
    const properties = PropertiesService.getScriptProperties();
    const keys = [
      'API_KEY',
      'AI_ENDPOINT',
      'AI_MODEL',
      'LINE_CHANNEL_ACCESS_TOKEN',
      'STAFF_SHEET_ID',
      'REQUEST_LOG_SHEET_ID',
      'OWNER_USER_ID'
    ];

    for (const key of keys) {
      properties.deleteProperty(key);
      properties.deleteProperty(`${key}_UPDATED`);
    }
    
    console.log('✅ Configuration cleared');
    return { success: true, message: 'All configuration cleared' };

  } catch (error) {
    console.error('❌ Error clearing config:', error);
    return { success: false, error: error.message };
  }
}

/**
 * แสดง config ปัจจุบัน
 */
function showConfig() {
  try {
    const properties = PropertiesService.getScriptProperties();
    
    const masked = {
      BOT_NAME: BOT_CONFIG.BOT_NAME,
      BOT_VERSION: BOT_CONFIG.BOT_VERSION,
      API_KEY: maskValue(properties.getProperty('API_KEY')),
      AI_ENDPOINT: properties.getProperty('AI_ENDPOINT') || `⚙️ Default: ${BOT_CONFIG.DEFAULT_AI_ENDPOINT}`,
      AI_MODEL: properties.getProperty('AI_MODEL') || `⚙️ Default: ${BOT_CONFIG.DEFAULT_AI_MODEL}`,
      LINE_CHANNEL_ACCESS_TOKEN: maskValue(properties.getProperty('LINE_CHANNEL_ACCESS_TOKEN')),
      STAFF_SHEET_ID: properties.getProperty('STAFF_SHEET_ID') || '❌ Not set',
      REQUEST_LOG_SHEET_ID: properties.getProperty('REQUEST_LOG_SHEET_ID') || '❌ Not set',
      OWNER_USER_ID: maskValue(properties.getProperty('OWNER_USER_ID')),
      AI_TEMPERATURE: BOT_CONFIG.AI_TEMPERATURE,
      AI_MAX_TOKENS: BOT_CONFIG.AI_MAX_TOKENS,
      COMMAND_BASED: BOT_CONFIG.COMMAND_BASED,
      LAST_UPDATED: properties.getProperty('API_KEY_UPDATED') || 'Never'
    };
    
    console.log('📋 Current Configuration:');
    console.log(JSON.stringify(masked, null, 2));
    
    return masked;

  } catch (error) {
    console.error('❌ Error showing config:', error);
    return { error: error.message };
  }
}

// =================================
// GOOGLE SHEETS SETUP
// =================================

/**
 * สร้าง Staff Directory Sheet
 */
function setupStaffSheet() {
  try {
    console.log('📋 Creating Staff Directory...');
    
    const spreadsheet = SpreadsheetApp.create('Request Bot - Staff Directory');
    const sheet = spreadsheet.getActiveSheet();
    sheet.setName('Staff Directory');
    
    // Header
    const headers = ['Staff ID', 'Name', 'LINE User ID', 'Department', 'Responsibilities'];
    sheet.getRange('A1:E1').setValues([headers]);
    
    // Format header
    const headerRange = sheet.getRange('A1:E1');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    
    // Column widths
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 250);
    sheet.setColumnWidth(4, 150);
    sheet.setColumnWidth(5, 400);
    
    sheet.setFrozenRows(1);
    
    // ตัวอย่างข้อมูล
    const sampleData = [
      ['STF001', 'คุณสมชาย ใจดี', 'Uxxxxxxxxxxxxxxxx', 'IT_SUPPORT', 'คอมพิวเตอร์,เครือข่าย,โปรแกรม,internet,wifi,computer'],
      ['STF002', 'คุณสมหญิง รักงาน', 'Uyyyyyyyyyyyyyyyy', 'FACILITIES', 'ห้องเรียน,แอร์,ไฟฟ้า,ประปา,ซ่อมแซม,aircon,electricity,แอร์'],
      ['STF003', 'คุณสมศรี การศึกษา', 'Uzzzzzzzzzzzzzzzzz', 'ACADEMIC', 'หลักสูตร,สอบ,เกรด,ตารางเรียน,curriculum,exam,grade']
    ];
    
    sheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);
    
    // Instructions
    const instructions = `📝 วิธีหา LINE User ID ของเจ้าหน้าที่:

1. ให้เจ้าหน้าที่เพิ่มบอทเป็นเพื่อน
2. ให้เจ้าหน้าที่ส่งข้อความหาบอท (ข้อความอะไรก็ได้)
3. ไปที่ Apps Script → Executions (⏱️)
4. คลิกที่ execution ล่าสุด → ดู log
5. จะเห็น "User ID: Uxxxx..." → คัดลอกมาใส่ที่นี่

⚠️ สำคัญ: ต้องได้ LINE User ID ที่ถูกต้อง เจ้าหน้าที่จึงจะได้รับการแจ้งเตือน`;
    
    sheet.getRange('G1').setValue(instructions);
    sheet.getRange('G1').setWrap(true);
    sheet.setColumnWidth(7, 400);
    
    const spreadsheetId = spreadsheet.getId();
    console.log(`✅ Staff Sheet created: ${spreadsheetId}`);
    console.log(`📊 URL: ${spreadsheet.getUrl()}`);
    
    return {
      success: true,
      spreadsheetId: spreadsheetId,
      url: spreadsheet.getUrl()
    };
    
  } catch (error) {
    console.error('❌ Error creating staff sheet:', error);
    return { success: false, error: error.message };
  }
}

/**
 * สร้าง Request Log Sheet
 */
function setupRequestLogSheet() {
  try {
    console.log('📋 Creating Request Log...');
    
    const spreadsheet = SpreadsheetApp.create('Request Bot - Request Log');
    const sheet = spreadsheet.getActiveSheet();
    sheet.setName('Request Log');
    
    // Header
    const headers = [
      'Timestamp',
      'Request ID',
      'Requester ID',
      'Group ID',
      'Issue Type',
      'Description',
      'Assigned To',
      'Assigned Name',
      'Status',
      'Priority',
      'Response Time',
      'Notes'
    ];
    sheet.getRange('A1:L1').setValues([headers]);
    
    // Format header
    const headerRange = sheet.getRange('A1:L1');
    headerRange.setBackground('#0f9d58');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    
    // Column widths
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 250);
    sheet.setColumnWidth(4, 250);
    sheet.setColumnWidth(5, 120);
    sheet.setColumnWidth(6, 400);
    sheet.setColumnWidth(7, 100);
    sheet.setColumnWidth(8, 150);
    sheet.setColumnWidth(9, 100);
    sheet.setColumnWidth(10, 80);
    sheet.setColumnWidth(11, 120);
    sheet.setColumnWidth(12, 300);
    
    sheet.setFrozenRows(1);
    
    // Format timestamp column
    sheet.getRange('A:A').setNumberFormat('dd/mm/yyyy hh:mm:ss');
    
    // Instructions
    const instructions = `📝 คำอธิบาย:

Request ID: รูปแบบ YYYYMMDDHHmmss (เช่น 20251104102548)
Status: SENT, IN_PROGRESS, COMPLETED, CANCELLED
Priority: URGENT, NORMAL

Staff ใช้คำสั่ง /complete [request_id] เพื่ออัพเดทสถานะ`;
    
    sheet.getRange('N1').setValue(instructions);
    sheet.getRange('N1').setWrap(true);
    sheet.setColumnWidth(14, 300);
    
    const spreadsheetId = spreadsheet.getId();
    console.log(`✅ Request Log created: ${spreadsheetId}`);
    console.log(`📊 URL: ${spreadsheet.getUrl()}`);
    
    return {
      success: true,
      spreadsheetId: spreadsheetId,
      url: spreadsheet.getUrl()
    };
    
  } catch (error) {
    console.error('❌ Error creating request log:', error);
    return { success: false, error: error.message };
  }
}

// =================================
// QUICK SETUP
// =================================

/**
 * ติดตั้งระบบแบบครบ
 */
function quickSetup() {
  console.log('🚀 Starting Quick Setup...');
  console.log('⚠️ กรุณาแก้ไข API Keys และ OWNER_USER_ID ด้านล่างก่อน Run:');
  
  // ===============================================
  // 🔑 ใส่ API Keys และ User ID ของคุณที่นี่
  // ===============================================
  const API_KEY = 'sk-proj-YOUR-API-KEY-HERE';
  const AI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
  const AI_MODEL = 'gpt-4o-mini';
  const LINE_CHANNEL_ACCESS_TOKEN = 'YOUR-LINE-CHANNEL-ACCESS-TOKEN-HERE';
  const OWNER_USER_ID = 'YOUR-LINE-USER-ID-HERE';  // ⬅️ ใส่ LINE User ID ของคุณ
  // ===============================================
  
  // ตรวจสอบว่าแก้ไข keys แล้วหรือยัง
  if (API_KEY.includes('YOUR-') || LINE_CHANNEL_ACCESS_TOKEN.includes('YOUR-') || OWNER_USER_ID.includes('YOUR-')) {
    console.error('❌ กรุณาแก้ไข API Keys และ OWNER_USER_ID ในฟังก์ชัน quickSetup() ก่อน');
    console.log('\n💡 วิธีหา OWNER_USER_ID (LINE User ID ของคุณ):');
    console.log('1. Deploy bot แล้ว');
    console.log('2. เพิ่มบอทเป็นเพื่อน');
    console.log('3. ส่งข้อความหาบอท');
    console.log('4. ดู Execution log → จะเห็น "User ID: Uxxxx..."');
    console.log('5. คัดลอก User ID มาใส่ใน quickSetup()');
    
    return { 
      success: false, 
      error: 'Please configure API Keys and OWNER_USER_ID first',
      instructions: [
        'Edit quickSetup() function',
        'Replace YOUR-API-KEY-HERE with your OpenAI/DeepSeek API key',
        'Replace YOUR-LINE-CHANNEL-ACCESS-TOKEN-HERE with your LINE token',
        'Replace YOUR-LINE-USER-ID-HERE with your LINE User ID (see instructions above)'
      ]
    };
  }
  
  try {
    console.log('📝 Step 1/6: Setting up API credentials...');
    setConfig('API_KEY', API_KEY);
    setConfig('AI_ENDPOINT', AI_ENDPOINT);
    setConfig('AI_MODEL', AI_MODEL);
    setConfig('LINE_CHANNEL_ACCESS_TOKEN', LINE_CHANNEL_ACCESS_TOKEN);
    setConfig('OWNER_USER_ID', OWNER_USER_ID);
    
    console.log('📊 Step 2/6: Creating Staff Directory...');
    const staffSheet = setupStaffSheet();
    if (!staffSheet.success) {
      throw new Error('Failed to create staff sheet');
    }
    setConfig('STAFF_SHEET_ID', staffSheet.spreadsheetId);
    
    console.log('📊 Step 3/6: Creating Request Log...');
    const logSheet = setupRequestLogSheet();
    if (!logSheet.success) {
      throw new Error('Failed to create log sheet');
    }
    setConfig('REQUEST_LOG_SHEET_ID', logSheet.spreadsheetId);
    
    console.log('✅ Step 4/6: Validating configuration...');
    const validation = validateConfig();
    
    if (!validation.valid) {
      throw new Error('Configuration validation failed');
    }
    
    console.log('🎉 Step 5/6: Testing connections...');
    const testResult = testAIConnection();
    if (!testResult.success) {
      console.warn('⚠️ AI connection test failed - please check API key');
    }
    
    console.log('📋 Step 6/6: Finalizing setup...');
    
    console.log('\n🎉 =====================================');
    console.log('✅ SETUP COMPLETED SUCCESSFULLY!');
    console.log('=====================================\n');
    
    console.log('📋 SETUP SUMMARY:');
    console.log('─────────────────────────────────────');
    console.log(`✅ Bot Name: ${BOT_CONFIG.BOT_NAME}`);
    console.log(`✅ AI Provider: ${AI_ENDPOINT}`);
    console.log(`✅ AI Model: ${AI_MODEL}`);
    console.log(`✅ Owner User ID: ${maskValue(OWNER_USER_ID)}`);
    console.log(`✅ Staff Directory: ${staffSheet.url}`);
    console.log(`✅ Request Log: ${logSheet.url}`);
    console.log('─────────────────────────────────────\n');
    
    console.log('📝 NEXT STEPS:');
    console.log('─────────────────────────────────────');
    console.log('1. ✏️  แก้ไข Staff Directory:');
    console.log('   • ลบแถวตัวอย่าง');
    console.log('   • เพิ่มข้อมูลเจ้าหน้าที่จริง');
    console.log('   • ให้เจ้าหน้าที่ส่งข้อความหาบอทเพื่อเอา User ID');
    console.log('');
    console.log('2. 🚀 Deploy Web App:');
    console.log('   • Deploy → New deployment');
    console.log('   • Type: Web app');
    console.log('   • Execute as: Me');
    console.log('   • Who has access: Anyone');
    console.log('');
    console.log('3. 🔗 ตั้งค่า LINE Webhook:');
    console.log('   • คัดลอก Web App URL');
    console.log('   • วางใน LINE Developers Console');
    console.log('   • Verify webhook');
    console.log('');
    console.log('4. 🧪 ทดสอบระบบ:');
    console.log('   • เพิ่มบอทเข้ากลุ่ม LINE');
    console.log('   • ส่งคำสั่ง: /request แอร์ห้อง 301 เสีย');
    console.log('   • ตรวจสอบว่าเจ้าหน้าที่ได้รับการแจ้งเตือน');
    console.log('─────────────────────────────────────\n');
    
    console.log('⚠️  SECURITY REMINDER:');
    console.log('ลบ API Keys ออกจาก quickSetup() หลังติดตั้งเสร็จ!\n');
    
    return {
      success: true,
      staffSheetUrl: staffSheet.url,
      requestLogUrl: logSheet.url,
      staffSheetId: staffSheet.spreadsheetId,
      requestLogSheetId: logSheet.spreadsheetId,
      ownerUserId: maskValue(OWNER_USER_ID),
      aiProvider: AI_ENDPOINT,
      aiModel: AI_MODEL,
      nextSteps: [
        'Edit Staff Directory with real staff data',
        'Deploy as Web App',
        'Set Webhook URL in LINE Developers',
        'Test in LINE group with /request command'
      ]
    };

  } catch (error) {
    console.error('❌ Setup failed:', error);
    return { 
      success: false, 
      error: error.message,
      hint: 'Check the execution log for details'
    };
  }
}

// =================================
// OWNER USER ID SETUP
// =================================

/**
 * ตั้งค่า Owner User ID
 * (ใช้หลังจาก deploy แล้วและได้ User ID แล้ว)
 */
function setOwnerUserId() {
  console.log('📝 Setting Owner User ID...');
  console.log('⚠️ กรุณาแก้ไข userId ด้านล่าง:');
  
  // ===============================================
  // 🔑 ใส่ LINE User ID ของคุณที่นี่
  // ===============================================
  const userId = 'Uxxxxxxxxxxxxxxxx';  // ⬅️ แก้ไขที่นี่
  // ===============================================
  
  if (userId === 'Uxxxxxxxxxxxxxxxx') {
    console.error('❌ กรุณาแก้ไข userId');
    console.log('\n💡 วิธีหา LINE User ID ของคุณ:');
    console.log('1. Deploy bot แล้ว');
    console.log('2. เพิ่มบอทเป็นเพื่อน');
    console.log('3. ส่งข้อความหาบอท');
    console.log('4. ดู Execution log → จะเห็น "User ID: Uxxxx..."');
    console.log('5. คัดลอก User ID มาใส่ในฟังก์ชันนี้');
    return { success: false, error: 'Please set userId first' };
  }
  
  const result = setConfig('OWNER_USER_ID', userId);
  
  if (result.success) {
    console.log('✅ Owner User ID ตั้งค่าเรียบร้อย!');
    console.log(`👤 Owner: ${maskValue(userId)}`);
    console.log('\n💡 ตอนนี้คุณสามารถ:');
    console.log('• ใช้บอทในแชทส่วนตัวได้');
    console.log('• ดูสถิติและการตั้งค่าทั้งหมด');
    console.log('• จัดการคำร้องทั้งหมด');
  }
  
  return result;
}

/**
 * แสดงวิธีหา Owner User ID
 */
function howToGetOwnerUserId() {
  console.log('💡 วิธีหา LINE User ID ของคุณ:');
  console.log('=====================================');
  console.log('');
  console.log('📝 ขั้นตอน:');
  console.log('1. Deploy bot เป็น Web App');
  console.log('2. ตั้งค่า Webhook ใน LINE Developers Console');
  console.log('3. เพิ่มบอทเป็นเพื่อน (สแกน QR Code)');
  console.log('4. ส่งข้อความหาบอท (ข้อความอะไรก็ได้)');
  console.log('5. กลับมาที่ Apps Script Editor');
  console.log('6. คลิกที่ Executions (⏱️ icon ด้านซ้าย)');
  console.log('7. คลิกที่ execution ล่าสุด');
  console.log('8. ดู log → จะเห็น "User ID: Uxxxx..."');
  console.log('9. คัดลอก User ID (ขึ้นต้นด้วย U และยาว 33 ตัวอักษร)');
  console.log('10. นำไปใส่ในฟังก์ชัน quickSetup() หรือ setOwnerUserId()');
  console.log('');
  console.log('✅ เสร็จแล้ว! คุณจะสามารถใช้บอทในแชทส่วนตัวได้');
  console.log('=====================================');
}

// =================================
// TESTING FUNCTIONS
// =================================

/**
 * ทดสอบการเชื่อมต่อ AI
 */
function testAIConnection() {
  console.log('🧪 Testing AI connection...\n');
  
  const config = getConfig();
  
  if (!config.API_KEY) {
    console.error('❌ API Key not configured. Run quickSetup() first.');
    return { success: false, error: 'API Key not configured' };
  }

  console.log(`🤖 Using: ${config.AI_MODEL} at ${config.AI_ENDPOINT}`);

  const testPrompt = {
    system: 'You are a helpful assistant.',
    user: 'Say "Hello from Command-Based Request Bot!" in Thai.'
  };
  
  const payload = {
    model: config.AI_MODEL,
    messages: [
      { role: "system", content: testPrompt.system },
      { role: "user", content: testPrompt.user }
    ],
    temperature: 0.3,
    max_tokens: 100
  };
  
  try {
    const response = UrlFetchApp.fetch(config.AI_ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${config.API_KEY}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const statusCode = response.getResponseCode();
    
    if (statusCode !== 200) {
      throw new Error(`API returned status ${statusCode}: ${response.getContentText()}`);
    }
    
    const result = JSON.parse(response.getContentText());
    console.log('✅ AI connection test passed!');
    console.log('Response:', result.choices[0].message.content);
    
    return {
      success: true,
      response: result.choices[0].message.content
    };
    
  } catch (error) {
    console.error('❌ AI connection test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ทดสอบการเชื่อมต่อ Google Sheets
 */
function testSheetsConnection() {
  console.log('🧪 Testing Google Sheets connection...\n');
  
  const config = getConfig();
  
  try {
    // Test Staff Sheet
    console.log('📋 Testing Staff Directory...');
    if (!config.STAFF_SHEET_ID) {
      throw new Error('STAFF_SHEET_ID not configured');
    }
    
    const staffSheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');
    
    if (!staffSheet) {
      throw new Error('Staff Directory sheet not found');
    }
    
    const staffData = staffSheet.getDataRange().getValues();
    console.log(`✅ Staff Directory: ${staffData.length - 1} staff members`);
    console.log(`📊 URL: ${SpreadsheetApp.openById(config.STAFF_SHEET_ID).getUrl()}`);
    
    // Test Request Log
    console.log('\n📋 Testing Request Log...');
    if (!config.REQUEST_LOG_SHEET_ID) {
      throw new Error('REQUEST_LOG_SHEET_ID not configured');
    }
    
    const logSheet = SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID)
      .getSheetByName('Request Log');
    
    if (!logSheet) {
      throw new Error('Request Log sheet not found');
    }
    
    const logData = logSheet.getDataRange().getValues();
    console.log(`✅ Request Log: ${logData.length - 1} requests logged`);
    console.log(`📊 URL: ${SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID).getUrl()}`);
    
    console.log('\n✅ All sheets connected successfully!');
    
    return {
      success: true,
      staffCount: staffData.length - 1,
      requestCount: logData.length - 1,
      staffUrl: SpreadsheetApp.openById(config.STAFF_SHEET_ID).getUrl(),
      logUrl: SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID).getUrl()
    };
    
  } catch (error) {
    console.error('❌ Sheets connection test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ทดสอบทุกอย่าง
 */
function runAllTests() {
  console.log('🧪 Running all tests...\n');
  console.log('=====================================\n');
  
  console.log('TEST 1: Configuration Validation');
  console.log('---');
  const configTest = validateConfig();
  console.log(configTest);
  console.log('\n');
  
  console.log('TEST 2: AI Connection');
  console.log('---');
  const aiTest = testAIConnection();
  console.log(aiTest);
  console.log('\n');
  
  console.log('TEST 3: Google Sheets Connection');
  console.log('---');
  const sheetsTest = testSheetsConnection();
  console.log(sheetsTest);
  console.log('\n');
  
  console.log('=====================================');
  console.log('🏁 All tests completed!');
  
  const allPassed = configTest.valid && aiTest.success && sheetsTest.success;
  
  if (allPassed) {
    console.log('✅ All tests PASSED! Bot is ready to deploy.');
  } else {
    console.log('⚠️ Some tests FAILED. Please fix issues before deploying.');
  }
  
  return {
    allPassed: allPassed,
    config: configTest,
    ai: aiTest,
    sheets: sheetsTest
  };
}

// =================================
// HELPER FUNCTIONS
// =================================

/**
 * ซ่อนค่าที่เป็นความลับ
 */
function maskValue(value) {
  if (!value || value.length < 8) return value ? '***' : '❌ Not set';
  const first = value.substring(0, 4);
  const last = value.substring(value.length - 4);
  return `${first}${'*'.repeat(8)}${last}`;
}

/**
 * ดึง Webhook URL
 */
function getWebhookUrl() {
  try {
    const url = ScriptApp.getService().getUrl();
    console.log('🔗 Webhook URL:', url);
    console.log('\n📋 Setup Instructions:');
    console.log('1. Copy the URL above');
    console.log('2. Go to LINE Developers Console');
    console.log('3. Select your channel');
    console.log('4. Go to Messaging API tab');
    console.log('5. Set Webhook URL');
    console.log('6. Enable "Use webhook"');
    console.log('7. Click "Verify" (must be Success)');
    console.log('8. Test: Send /request command in LINE group');
    return url;
  } catch (error) {
    console.log('❌ Not deployed yet. Deploy as Web App first.');
    console.log('\n📋 Deployment Steps:');
    console.log('1. Click Deploy > New deployment');
    console.log('2. Select "Web app"');
    console.log('3. Execute as: Me');
    console.log('4. Who has access: Anyone');
    console.log('5. Deploy');
    console.log('6. Copy Web App URL');
    return null;
  }
}

// =================================
// AI PROVIDER SWITCHING
// =================================

/**
 * เปลี่ยนไปใช้ OpenAI
 */
function switchToOpenAI(apiKey) {
  if (!apiKey || apiKey.includes('YOUR-')) {
    console.error('❌ Please provide a valid OpenAI API key');
    return { success: false, error: 'Invalid API key' };
  }
  
  setConfig('API_KEY', apiKey);
  setConfig('AI_ENDPOINT', 'https://api.openai.com/v1/chat/completions');
  setConfig('AI_MODEL', 'gpt-4o-mini');
  
  console.log('✅ Switched to OpenAI (gpt-4o-mini)');
  return { success: true, provider: 'OpenAI', model: 'gpt-4o-mini' };
}

/**
 * เปลี่ยนไปใช้ DeepSeek
 */
function switchToDeepSeek(apiKey) {
  if (!apiKey || apiKey.includes('YOUR-')) {
    console.error('❌ Please provide a valid DeepSeek API key');
    return { success: false, error: 'Invalid API key' };
  }
  
  setConfig('API_KEY', apiKey);
  setConfig('AI_ENDPOINT', 'https://api.deepseek.com/chat/completions');
  setConfig('AI_MODEL', 'deepseek-chat');
  
  console.log('✅ Switched to DeepSeek (deepseek-chat)');
  return { success: true, provider: 'DeepSeek', model: 'deepseek-chat' };
}

/**
 * แสดงข้อมูล AI Provider ปัจจุบัน
 */
function showCurrentAIProvider() {
  const config = getConfig();
  
  console.log('🤖 Current AI Provider:');
  console.log(`   Model: ${config.AI_MODEL}`);
  console.log(`   Endpoint: ${config.AI_ENDPOINT}`);
  console.log(`   API Key: ${maskValue(config.API_KEY)}`);
  
  return {
    model: config.AI_MODEL,
    endpoint: config.AI_ENDPOINT,
    apiKey: maskValue(config.API_KEY)
  };
}
