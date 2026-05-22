require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const profileRoutes = require('./routes/profile');
const recordsRoutes = require('./routes/records');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3001;

// 确保数据目录存在
const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'uploads');
require('fs').mkdirSync(dataDir, { recursive: true });
require('fs').mkdirSync(uploadsDir, { recursive: true });

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件：照片访问
app.use('/photos', express.static(path.join(__dirname, '..', 'uploads')));

// API 路由
app.use('/api/profile', profileRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/ai', aiRoutes);

const db = require('./db');

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toLocaleString('zh-CN') });
});

// 导出全部数据
app.get('/api/export', async (req, res) => {
  try {
    const profile = await db.getProfile();
    const records = await db.getRecentRecords(9999);
    const profileObj = profile ? { ...profile } : null;
    const data = {
      exported_at: new Date().toISOString(),
      profile: profileObj,
      records,
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=body-management-backup.json');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 导入数据
app.post('/api/import', async (req, res) => {
  try {
    const { profile, records } = req.body;
    if (!profile || !records) return res.status(400).json({ error: '数据格式无效' });

    // 先清空旧数据
    const existingRecords = await db.getRecentRecords(9999);
    for (const r of existingRecords) {
      await db.deleteAnalysis(r.date);
      await db.deleteRecord(r.date);
    }
    await db.upsertProfile(profile);

    let imported = 0;
    for (const r of records) {
      await db.upsertRecord(r);
      imported++;
    }

    res.json({ success: true, imported, recordCount: records.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 生产环境：托管前端静态文件
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const fs = require('fs');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback — 所有非 API 路由返回 index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`减肥陪伴 App 服务已启动: http://localhost:${PORT}`);
});
