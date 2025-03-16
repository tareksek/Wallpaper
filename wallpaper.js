const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const cron = require('node-cron');
require('dotenv').config();

// التهيئة
const TEMP_DIR = path.join(__dirname, 'temp');
const CONFIG = {
  query: 'nature',
  perPage: 30,
  interval: 5 * 60 * 1000, // 5 دقائق
  cleanupDays: 30
};

// إنشاء مجلد التخزين المؤقت
mkdirp.sync(TEMP_DIR);

// دالة لتحميل الصور من Pexels
async function fetchImages() {
  try {
    const response = await axios.get('https://api.pexels.com/v1/search', {
      params: {
        query: CONFIG.query,
        per_page: CONFIG.perPage,
        page: Math.floor(Math.random() * 10) + 1
      },
      headers: {
        Authorization: process.env.PEXELS_API_KEY
      }
    });

    for (const photo of response.data.photos) {
      const imagePath = path.join(TEMP_DIR, `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`);
      const writer = fs.createWriteStream(imagePath);
      const imageResponse = await axios.get(photo.src.original, { responseType: 'stream' });
      imageResponse.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    }
    console.log('تم تحديث مكتبة الصور');
  } catch (error) {
    console.error('خطأ في جلب الصور:', error.message);
  }
}

// دالة لتغيير الخلفية
function setRandomWallpaper() {
  const files = fs.readdirSync(TEMP_DIR).filter(f => f.endsWith('.jpg'));
  if (files.length === 0) return;

  const randomFile = path.join(TEMP_DIR, files[Math.floor(Math.random() * files.length)]);
  exec(`reg add "HKEY_CURRENT_USER\\Control Panel\\Desktop" /v Wallpaper /t REG_SZ /d "${randomFile}" /f`, () => {
    exec('RUNDLL32.EXE user32.dll,UpdatePerUserSystemParameters');
  });
}

// تنظيف الملفات القديمة
function cleanupOldFiles() {
  const now = Date.now();
  fs.readdirSync(TEMP_DIR).forEach(file => {
    const filePath = path.join(TEMP_DIR, file);
    const stat = fs.statSync(filePath);
    if (now - stat.birthtimeMs > CONFIG.cleanupDays * 24 * 60 * 60 * 1000) {
      fs.unlinkSync(filePath);
    }
  });
}

// الجدولة
cron.schedule('*/5 * * * *', setRandomWallpaper); // كل 5 دقائق
cron.schedule('0 0 * * *', cleanupOldFiles); // تنظيف يومي
cron.schedule('0 */6 * * *', fetchImages); // تحديث الصور كل 6 ساعات

// التشغيل الأولي
(async () => {
  await fetchImages();
  setRandomWallpaper();
})();
