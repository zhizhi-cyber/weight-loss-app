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

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toLocaleString('zh-CN') });
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
