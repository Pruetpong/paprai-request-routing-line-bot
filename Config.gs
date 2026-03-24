// Config.gs - Configuration Management
// PAPRAI แจ้งซ่อม — ป้าไพรผู้ช่วยรับแจ้งซ่อมอัจฉริยะ
// โรงเรียนสาธิต มหาวิทยาลัยศิลปากร (มัธยมศึกษา)
// Version: 3.0 - PAPRAI Persona Edition

// =================================
// SECTION 1: BOT CONSTANTS
// =================================

const BOT_CONFIG = {
  // ข้อมูลบอท
  BOT_NAME:    'PAPRAI แจ้งซ่อม',
  BOT_VERSION: '3.0',

  // ชื่อ Persona
  PERSONA_NAME:   'ป้าไพร',
  PERSONA_FULL:   'PAPRAI (Professional Academic Assistant for Pedagogy, Research And Innovation)',

  // AI Parameters
  AI_TEMPERATURE: 0.3,
  AI_MAX_TOKENS:  500,

  // Default AI Model
  DEFAULT_AI_MODEL:    'gpt-4o-mini',
  DEFAULT_AI_ENDPOINT: 'https://api.openai.com/v1/chat/completions',

  // Request Settings
  MIN_REQUEST_LENGTH: 10,

  // Feature Flags
  COMMAND_BASED:      true,
  OWNER_ONLY_PRIVATE: true,
  STAFF_COMMAND_ONLY: true,
  ENABLE_LOGGING:     true,
  SEND_CONFIRMATION:  true,
  NOTIFY_STAFF:       true
};

// =================================
// SECTION 2: PROPERTIES MANAGEMENT
// =================================

/**
 * ตั้งค่าแต่ละ key ลงใน PropertiesService
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
 * ดึงค่า config ทั้งหมดจาก PropertiesService
 */
function getConfig() {
  try {
    const properties = PropertiesService.getScriptProperties();

    return {
      // API Credentials
      API_KEY:      properties.getProperty('API_KEY'),
      AI_ENDPOINT:  properties.getProperty('AI_ENDPOINT')  || BOT_CONFIG.DEFAULT_AI_ENDPOINT,
      AI_MODEL:     properties.getProperty('AI_MODEL')     || BOT_CONFIG.DEFAULT_AI_MODEL,

      // LINE Configuration
      LINE_CHANNEL_ACCESS_TOKEN: properties.getProperty('LINE_CHANNEL_ACCESS_TOKEN'),

      // Google Sheets
      STAFF_SHEET_ID:       properties.getProperty('STAFF_SHEET_ID'),
      REQUEST_LOG_SHEET_ID: properties.getProperty('REQUEST_LOG_SHEET_ID'),

      // Owner Configuration
      OWNER_USER_ID: properties.getProperty('OWNER_USER_ID'),

      // AI Parameters (จาก BOT_CONFIG)
      AI_TEMPERATURE: BOT_CONFIG.AI_TEMPERATURE,
      AI_MAX_TOKENS:  BOT_CONFIG.AI_MAX_TOKENS,

      // Feature Flags (จาก BOT_CONFIG)
      COMMAND_BASED:      BOT_CONFIG.COMMAND_BASED,
      OWNER_ONLY_PRIVATE: BOT_CONFIG.OWNER_ONLY_PRIVATE,
      STAFF_COMMAND_ONLY: BOT_CONFIG.STAFF_COMMAND_ONLY,
      ENABLE_LOGGING:     BOT_CONFIG.ENABLE_LOGGING,
      NOTIFY_STAFF:       BOT_CONFIG.NOTIFY_STAFF
    };

  } catch (error) {
    console.error('❌ Error getting config:', error);
    throw new Error(`Failed to get configuration: ${error.message}`);
  }
}

/**
 * ตรวจสอบความถูกต้องของ config ทั้งหมด
 */
function validateConfig() {
  console.log('🔍 Validating configuration...');

  try {
    const config = getConfig();

    const results = {
      api_key:            !!config.API_KEY            && config.API_KEY.length > 20,
      ai_endpoint:        !!config.AI_ENDPOINT        && config.AI_ENDPOINT.startsWith('http'),
      ai_model:           !!config.AI_MODEL           && config.AI_MODEL.length > 3,
      line_token:         !!config.LINE_CHANNEL_ACCESS_TOKEN && config.LINE_CHANNEL_ACCESS_TOKEN.length > 100,
      staff_sheet:        !!config.STAFF_SHEET_ID,
      request_log_sheet:  !!config.REQUEST_LOG_SHEET_ID,
      owner_user_id:      !!config.OWNER_USER_ID
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
 * ลบ config ทั้งหมดออกจาก PropertiesService
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
 * แสดง config ปัจจุบัน (ซ่อนค่า sensitive)
 */
function showConfig() {
  try {
    const properties = PropertiesService.getScriptProperties();

    const masked = {
      BOT_NAME:                   BOT_CONFIG.BOT_NAME,
      BOT_VERSION:                BOT_CONFIG.BOT_VERSION,
      PERSONA_NAME:               BOT_CONFIG.PERSONA_NAME,
      API_KEY:                    maskValue(properties.getProperty('API_KEY')),
      AI_ENDPOINT:                properties.getProperty('AI_ENDPOINT')  || `⚙️ Default: ${BOT_CONFIG.DEFAULT_AI_ENDPOINT}`,
      AI_MODEL:                   properties.getProperty('AI_MODEL')     || `⚙️ Default: ${BOT_CONFIG.DEFAULT_AI_MODEL}`,
      LINE_CHANNEL_ACCESS_TOKEN:  maskValue(properties.getProperty('LINE_CHANNEL_ACCESS_TOKEN')),
      STAFF_SHEET_ID:             properties.getProperty('STAFF_SHEET_ID')       || '❌ Not set',
      REQUEST_LOG_SHEET_ID:       properties.getProperty('REQUEST_LOG_SHEET_ID') || '❌ Not set',
      OWNER_USER_ID:              maskValue(properties.getProperty('OWNER_USER_ID')),
      AI_TEMPERATURE:             BOT_CONFIG.AI_TEMPERATURE,
      AI_MAX_TOKENS:              BOT_CONFIG.AI_MAX_TOKENS,
      COMMAND_BASED:              BOT_CONFIG.COMMAND_BASED,
      LAST_UPDATED:               properties.getProperty('API_KEY_UPDATED') || 'Never'
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
// SECTION 3: GOOGLE SHEETS SETUP
// =================================

/**
 * สร้าง Staff Directory Sheet
 * Column F (Notes) รองรับการบันทึก log การลงทะเบียน/ยกเลิกอัตโนมัติ
 */
function setupStaffSheet() {
  try {
    console.log('📋 Creating Staff Directory...');

    const spreadsheet = SpreadsheetApp.create('PAPRAI แจ้งซ่อม — Staff Directory');
    const sheet = spreadsheet.getActiveSheet();
    sheet.setName('Staff Directory');

    // Header
    const headers = ['Staff ID', 'Name', 'LINE User ID', 'Department', 'Responsibilities', 'Notes'];
    sheet.getRange('A1:F1').setValues([headers]);

    // Format header
    const headerRange = sheet.getRange('A1:F1');
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
    sheet.setColumnWidth(6, 300);

    sheet.setFrozenRows(1);

    // ตัวอย่างข้อมูล
    const sampleData = [
      ['STF001', 'คุณสมชาย ใจดี',    'Uxxxxxxxxxxxxxxxx',  'IT_SUPPORT', 'คอมพิวเตอร์,เครือข่าย,โปรแกรม,internet,wifi,computer', ''],
      ['STF002', 'คุณสมหญิง รักงาน', 'Uyyyyyyyyyyyyyyyy',  'FACILITIES', 'ห้องเรียน,แอร์,ไฟฟ้า,ประปา,ซ่อมแซม,aircon,electricity,แอร์', ''],
      ['STF003', 'คุณสมศรี การศึกษา','Uzzzzzzzzzzzzzzzzz', 'ACADEMIC',   'หลักสูตร,สอบ,เกรด,ตารางเรียน,curriculum,exam,grade', '']
    ];

    sheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);

    // คำแนะนำ
    const instructions =
      `📝 วิธีหา LINE User ID ของเจ้าหน้าที่:\n\n` +
      `วิธีที่ 1 (ให้ Staff ลงทะเบียนเอง):\n` +
      `1. ให้เจ้าหน้าที่เพิ่มป้าไพรเป็นเพื่อน\n` +
      `2. ให้ส่งคำสั่ง /reg staff [StaffID]\n` +
      `3. ระบบจะอัพเดท LINE User ID อัตโนมัติ\n\n` +
      `วิธีที่ 2 (ตรวจสอบด้วยตนเอง):\n` +
      `1. Apps Script → Executions (⏱️)\n` +
      `2. คลิก execution ล่าสุด → ดู log\n` +
      `3. จะเห็น "User ID: Uxxxx..." → คัดลอก\n\n` +
      `Column F (Notes) บันทึกวันที่ลงทะเบียน/ยกเลิกอัตโนมัติ\n\n` +
      `⚠️ ต้องได้ LINE User ID ที่ถูกต้อง\n` +
      `เจ้าหน้าที่จึงจะได้รับการแจ้งเตือนจากป้าไพร`;

    sheet.getRange('H1').setValue(instructions);
    sheet.getRange('H1').setWrap(true);
    sheet.setColumnWidth(8, 400);

    const spreadsheetId = spreadsheet.getId();
    console.log(`✅ Staff Sheet created: ${spreadsheetId}`);
    console.log(`📊 URL: ${spreadsheet.getUrl()}`);

    return { success: true, spreadsheetId: spreadsheetId, url: spreadsheet.getUrl() };

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

    const spreadsheet = SpreadsheetApp.create('PAPRAI แจ้งซ่อม — Request Log');
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
    sheet.setColumnWidth(1,  150);
    sheet.setColumnWidth(2,  150);
    sheet.setColumnWidth(3,  250);
    sheet.setColumnWidth(4,  250);
    sheet.setColumnWidth(5,  120);
    sheet.setColumnWidth(6,  400);
    sheet.setColumnWidth(7,  100);
    sheet.setColumnWidth(8,  150);
    sheet.setColumnWidth(9,  100);
    sheet.setColumnWidth(10, 80);
    sheet.setColumnWidth(11, 120);
    sheet.setColumnWidth(12, 300);

    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('dd/mm/yyyy hh:mm:ss');

    // คำแนะนำ
    const instructions =
      `📝 คำอธิบาย:\n\n` +
      `Request ID: รูปแบบ YYYYMMDDHHmmss\n` +
      `(เช่น 20251104102548)\n\n` +
      `Status:\n` +
      `SENT        → ป้าไพรส่งต่อแล้ว\n` +
      `IN_PROGRESS → เจ้าหน้าที่รับงาน\n` +
      `COMPLETED   → เสร็จสิ้น\n` +
      `CANCELLED   → ยกเลิก\n\n` +
      `Priority:\n` +
      `URGENT → ด่วน\n` +
      `NORMAL → ปกติ\n\n` +
      `เจ้าหน้าที่ใช้คำสั่ง:\n` +
      `/complete [request_id]\n` +
      `เพื่ออัพเดทสถานะผ่านป้าไพร`;

    sheet.getRange('N1').setValue(instructions);
    sheet.getRange('N1').setWrap(true);
    sheet.setColumnWidth(14, 300);

    const spreadsheetId = spreadsheet.getId();
    console.log(`✅ Request Log created: ${spreadsheetId}`);
    console.log(`📊 URL: ${spreadsheet.getUrl()}`);

    return { success: true, spreadsheetId: spreadsheetId, url: spreadsheet.getUrl() };

  } catch (error) {
    console.error('❌ Error creating request log:', error);
    return { success: false, error: error.message };
  }
}

// =================================
// SECTION 4: QUICK SETUP & OWNER SETUP
// =================================

/**
 * ติดตั้งระบบ PAPRAI แจ้งซ่อม แบบครบ
 * วิธีใช้: แก้ไข API Keys ด้านล่าง แล้วกด Run
 */
function quickSetup() {
  console.log('🚀 Starting PAPRAI แจ้งซ่อม Quick Setup...');
  console.log('⚠️ กรุณาแก้ไข API Keys และ OWNER_USER_ID ด้านล่างก่อน Run:');

  // ===============================================
  // 🔑 ใส่ API Keys และ User ID ของคุณที่นี่
  // ===============================================
  const API_KEY                   = 'sk-proj-YOUR-API-KEY-HERE';
  const AI_ENDPOINT               = 'https://api.openai.com/v1/chat/completions';
  const AI_MODEL                  = 'gpt-4o-mini';
  const LINE_CHANNEL_ACCESS_TOKEN = 'YOUR-LINE-CHANNEL-ACCESS-TOKEN-HERE';
  const OWNER_USER_ID             = 'YOUR-LINE-USER-ID-HERE';
  // ===============================================

  if (API_KEY.includes('YOUR-') || LINE_CHANNEL_ACCESS_TOKEN.includes('YOUR-') || OWNER_USER_ID.includes('YOUR-')) {
    console.error('❌ กรุณาแก้ไข API Keys และ OWNER_USER_ID ในฟังก์ชัน quickSetup() ก่อน');
    console.log('\n💡 วิธีหา OWNER_USER_ID (LINE User ID ของคุณ):');
    console.log('1. Deploy bot แล้ว');
    console.log('2. เพิ่มป้าไพรเป็นเพื่อน');
    console.log('3. ส่งข้อความหาป้าไพร');
    console.log('4. ดู Execution log → จะเห็น "User ID: Uxxxx..."');
    console.log('5. คัดลอก User ID มาใส่ใน quickSetup()');

    return {
      success: false,
      error: 'Please configure API Keys and OWNER_USER_ID first',
      instructions: [
        'Edit quickSetup() function',
        'Replace YOUR-API-KEY-HERE with your OpenAI/DeepSeek API key',
        'Replace YOUR-LINE-CHANNEL-ACCESS-TOKEN-HERE with your LINE token',
        'Replace YOUR-LINE-USER-ID-HERE with your LINE User ID'
      ]
    };
  }

  try {
    console.log('📝 Step 1/6: Setting up API credentials...');
    setConfig('API_KEY',                   API_KEY);
    setConfig('AI_ENDPOINT',               AI_ENDPOINT);
    setConfig('AI_MODEL',                  AI_MODEL);
    setConfig('LINE_CHANNEL_ACCESS_TOKEN', LINE_CHANNEL_ACCESS_TOKEN);
    setConfig('OWNER_USER_ID',             OWNER_USER_ID);

    console.log('📊 Step 2/6: Creating Staff Directory...');
    const staffSheet = setupStaffSheet();
    if (!staffSheet.success) throw new Error('Failed to create staff sheet');
    setConfig('STAFF_SHEET_ID', staffSheet.spreadsheetId);

    console.log('📊 Step 3/6: Creating Request Log...');
    const logSheet = setupRequestLogSheet();
    if (!logSheet.success) throw new Error('Failed to create log sheet');
    setConfig('REQUEST_LOG_SHEET_ID', logSheet.spreadsheetId);

    console.log('✅ Step 4/6: Validating configuration...');
    const validation = validateConfig();
    if (!validation.valid) throw new Error('Configuration validation failed');

    console.log('🎉 Step 5/6: Testing AI connection...');
    const testResult = testAIConnection();
    if (!testResult.success) {
      console.warn('⚠️ AI connection test failed - please check API key');
    }

    console.log('📋 Step 6/6: Finalizing setup...');

    console.log('\n🎉 =====================================');
    console.log('✅ PAPRAI แจ้งซ่อม SETUP COMPLETED!');
    console.log('=====================================\n');

    console.log('📋 SETUP SUMMARY:');
    console.log('─────────────────────────────────────');
    console.log(`✅ Bot: ${BOT_CONFIG.BOT_NAME} (${BOT_CONFIG.PERSONA_NAME})`);
    console.log(`✅ AI: ${AI_MODEL} → ${AI_ENDPOINT}`);
    console.log(`✅ Owner: ${maskValue(OWNER_USER_ID)}`);
    console.log(`✅ Staff Directory: ${staffSheet.url}`);
    console.log(`✅ Request Log: ${logSheet.url}`);
    console.log('─────────────────────────────────────\n');

    console.log('📝 NEXT STEPS:');
    console.log('─────────────────────────────────────');
    console.log('1. ✏️  แก้ไข Staff Directory:');
    console.log('   • ลบแถวตัวอย่าง');
    console.log('   • เพิ่มข้อมูลเจ้าหน้าที่จริง');
    console.log('   • ให้เจ้าหน้าที่ลงทะเบียนผ่าน /reg staff [StaffID]');
    console.log('');
    console.log('2. 🚀 Deploy Web App:');
    console.log('   • Deploy → New deployment → Web app');
    console.log('   • Execute as: Me / Who has access: Anyone');
    console.log('');
    console.log('3. 🔗 ตั้งค่า LINE Webhook:');
    console.log('   • วาง Web App URL ใน LINE Developers Console');
    console.log('   • Verify webhook');
    console.log('');
    console.log('4. 🧪 ทดสอบ:');
    console.log('   • เพิ่มป้าไพรเข้ากลุ่ม LINE');
    console.log('   • ส่ง: /request แอร์ห้อง 301 เสีย ช่วยด้วยค่ะ');
    console.log('─────────────────────────────────────\n');
    console.log('⚠️  SECURITY: ลบ API Keys ออกจาก quickSetup() ด้วยนะคะ!\n');

    return {
      success: true,
      staffSheetUrl:        staffSheet.url,
      requestLogUrl:        logSheet.url,
      staffSheetId:         staffSheet.spreadsheetId,
      requestLogSheetId:    logSheet.spreadsheetId,
      ownerUserId:          maskValue(OWNER_USER_ID),
      aiProvider:           AI_ENDPOINT,
      aiModel:              AI_MODEL
    };

  } catch (error) {
    console.error('❌ Setup failed:', error);
    return { success: false, error: error.message, hint: 'Check the execution log for details' };
  }
}

/**
 * ตั้งค่า Owner User ID แยกต่างหาก
 * ใช้หลังจาก deploy แล้วได้ User ID จาก Execution log
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
    console.log('\n💡 วิธีหา LINE User ID:');
    console.log('1. Deploy bot แล้ว');
    console.log('2. เพิ่มป้าไพรเป็นเพื่อน');
    console.log('3. ส่งข้อความหาป้าไพร');
    console.log('4. ดู Execution log → User ID: Uxxxx...');
    return { success: false, error: 'Please set userId first' };
  }

  const result = setConfig('OWNER_USER_ID', userId);

  if (result.success) {
    console.log('✅ Owner User ID ตั้งค่าเรียบร้อย!');
    console.log(`👤 Owner: ${maskValue(userId)}`);
  }

  return result;
}

/**
 * แสดงวิธีหา Owner User ID
 */
function howToGetOwnerUserId() {
  console.log('💡 วิธีหา LINE User ID ของคุณ:');
  console.log('=====================================');
  console.log('1. Deploy bot เป็น Web App');
  console.log('2. ตั้งค่า Webhook ใน LINE Developers Console');
  console.log('3. เพิ่มป้าไพรเป็นเพื่อน (สแกน QR Code)');
  console.log('4. ส่งข้อความหาป้าไพร (อะไรก็ได้)');
  console.log('5. Apps Script Editor → Executions (⏱️)');
  console.log('6. คลิก execution ล่าสุด → ดู log');
  console.log('7. User ID: Uxxxx... (33 ตัวอักษร ขึ้นต้นด้วย U)');
  console.log('8. คัดลอกใส่ใน quickSetup() หรือ setOwnerUserId()');
  console.log('=====================================');
}

// =================================
// SECTION 5: TESTING FUNCTIONS
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

  console.log(`🤖 Model: ${config.AI_MODEL}`);
  console.log(`🔗 Endpoint: ${config.AI_ENDPOINT}`);

  const payload = {
    model: config.AI_MODEL,
    messages: [
      { role: 'system', content: `คุณคือ "${BOT_CONFIG.PERSONA_NAME}" ผู้ช่วยรับแจ้งซ่อมของโรงเรียน` },
      { role: 'user',   content: 'สวัสดีค่ะ ทดสอบระบบ PAPRAI แจ้งซ่อม' }
    ],
    temperature: 0.3,
    max_tokens:  100
  };

  try {
    const response = UrlFetchApp.fetch(config.AI_ENDPOINT, {
      method:      'post',
      contentType: 'application/json',
      headers:     { 'Authorization': `Bearer ${config.API_KEY}` },
      payload:     JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      throw new Error(`API returned status ${statusCode}: ${response.getContentText()}`);
    }

    const result = JSON.parse(response.getContentText());
    console.log('✅ AI connection test passed!');
    console.log('Response:', result.choices[0].message.content);

    return { success: true, response: result.choices[0].message.content };

  } catch (error) {
    console.error('❌ AI connection test failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ทดสอบการเชื่อมต่อ Google Sheets
 */
function testSheetsConnection() {
  console.log('🧪 Testing Google Sheets connection...\n');

  const config = getConfig();

  try {
    console.log('📋 Testing Staff Directory...');
    if (!config.STAFF_SHEET_ID) throw new Error('STAFF_SHEET_ID not configured');

    const staffSheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');
    if (!staffSheet) throw new Error('Staff Directory sheet not found');

    const staffData = staffSheet.getDataRange().getValues();
    console.log(`✅ Staff Directory: ${staffData.length - 1} staff members`);

    console.log('\n📋 Testing Request Log...');
    if (!config.REQUEST_LOG_SHEET_ID) throw new Error('REQUEST_LOG_SHEET_ID not configured');

    const logSheet = SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID)
      .getSheetByName('Request Log');
    if (!logSheet) throw new Error('Request Log sheet not found');

    const logData = logSheet.getDataRange().getValues();
    console.log(`✅ Request Log: ${logData.length - 1} requests logged`);
    console.log('\n✅ All sheets connected successfully!');

    return {
      success:      true,
      staffCount:   staffData.length - 1,
      requestCount: logData.length - 1,
      staffUrl:     SpreadsheetApp.openById(config.STAFF_SHEET_ID).getUrl(),
      logUrl:       SpreadsheetApp.openById(config.REQUEST_LOG_SHEET_ID).getUrl()
    };

  } catch (error) {
    console.error('❌ Sheets connection test failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ทดสอบระบบลงทะเบียน Staff
 */
function testStaffRegistrationSystem() {
  console.log('🧪 Testing Staff Registration System...\n');

  try {
    const config = getConfig();

    console.log('TEST 1: Checking Staff Directory...');
    const sheet = SpreadsheetApp.openById(config.STAFF_SHEET_ID)
      .getSheetByName('Staff Directory');
    const data = sheet.getDataRange().getValues();

    console.log(`✅ Found ${data.length - 1} staff records`);

    console.log('\nTEST 2: Staff Registration Status:');
    let registeredCount = 0;
    let pendingCount    = 0;

    for (let i = 1; i < data.length; i++) {
      const staffId    = data[i][0];
      const name       = data[i][1];
      const lineUserId = data[i][2];
      const dept       = data[i][3];
      const hasRegistered = lineUserId &&
                            lineUserId.startsWith('U') &&
                            lineUserId !== 'Uxxxxxxxxxxxxxxxx';

      if (hasRegistered) { registeredCount++; } else { pendingCount++; }
      console.log(`  ${hasRegistered ? '✅' : '⏳'} ${staffId} - ${name} (${dept})`);
    }

    console.log(`\n📊 Summary: ${registeredCount} registered, ${pendingCount} pending`);
    console.log('\n✅ Test completed!');
    console.log('\n📝 Next steps:');
    console.log('1. แจกจ่าย Staff ID ให้เจ้าหน้าที่');
    console.log('2. ให้ส่ง: /reg staff [StaffID] หาป้าไพร');
    console.log('3. ตรวจสอบด้วย Owner command: /pending');

    return {
      success:    true,
      totalStaff: data.length - 1,
      registered: registeredCount,
      pending:    pendingCount,
      sheetUrl:   SpreadsheetApp.openById(config.STAFF_SHEET_ID).getUrl()
    };

  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * รันการทดสอบทั้งหมด
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

  console.log('TEST 4: Staff Registration System');
  console.log('---');
  const staffRegTest = testStaffRegistrationSystem();
  console.log(staffRegTest);
  console.log('\n');

  console.log('=====================================');
  console.log('🏁 All tests completed!');

  const allPassed = configTest.valid && aiTest.success && sheetsTest.success && staffRegTest.success;

  if (allPassed) {
    console.log('✅ All tests PASSED! PAPRAI แจ้งซ่อม พร้อม Deploy แล้วค่ะ');
  } else {
    console.log('⚠️ Some tests FAILED. Please fix issues before deploying.');
  }

  return {
    allPassed:        allPassed,
    config:           configTest,
    ai:               aiTest,
    sheets:           sheetsTest,
    staffRegistration: staffRegTest
  };
}

// =================================
// SECTION 6: AI PROVIDER SWITCHING
// =================================

/**
 * เปลี่ยนไปใช้ OpenAI
 */
function switchToOpenAI(apiKey) {
  if (!apiKey || apiKey.includes('YOUR-')) {
    console.error('❌ Please provide a valid OpenAI API key');
    return { success: false, error: 'Invalid API key' };
  }

  setConfig('API_KEY',      apiKey);
  setConfig('AI_ENDPOINT', 'https://api.openai.com/v1/chat/completions');
  setConfig('AI_MODEL',    'gpt-4o-mini');

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

  setConfig('API_KEY',      apiKey);
  setConfig('AI_ENDPOINT', 'https://api.deepseek.com/chat/completions');
  setConfig('AI_MODEL',    'deepseek-chat');

  console.log('✅ Switched to DeepSeek (deepseek-chat)');
  return { success: true, provider: 'DeepSeek', model: 'deepseek-chat' };
}

/**
 * แสดงข้อมูล AI Provider ปัจจุบัน
 */
function showCurrentAIProvider() {
  const config = getConfig();

  console.log('🤖 Current AI Provider:');
  console.log(`   Model:    ${config.AI_MODEL}`);
  console.log(`   Endpoint: ${config.AI_ENDPOINT}`);
  console.log(`   API Key:  ${maskValue(config.API_KEY)}`);

  return {
    model:    config.AI_MODEL,
    endpoint: config.AI_ENDPOINT,
    apiKey:   maskValue(config.API_KEY)
  };
}

// =================================
// SECTION 7: HELPER UTILITIES
// =================================

/**
 * ซ่อนค่าที่เป็นความลับ
 */
function maskValue(value) {
  if (!value || value.length < 8) return value ? '***' : '❌ Not set';
  const first = value.substring(0, 4);
  const last  = value.substring(value.length - 4);
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
    console.log('2. LINE Developers Console → Messaging API');
    console.log('3. Set Webhook URL → Enable "Use webhook"');
    console.log('4. Verify (ต้องได้ Success)');
    console.log('5. ทดสอบ: ส่ง /request ในกลุ่ม LINE');
    return url;
  } catch (error) {
    console.log('❌ Not deployed yet. Deploy as Web App first.');
    console.log('\n📋 Deployment Steps:');
    console.log('Deploy > New deployment > Web app');
    console.log('Execute as: Me / Who has access: Anyone');
    return null;
  }
}
