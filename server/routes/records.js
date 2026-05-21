const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');

// 照片上传配置
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|heic/i;
    const ok = allowed.test(path.extname(file.originalname));
    cb(ok ? null : new Error('仅支持图片格式'), ok);
  },
});

// 获取今日记录
router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const record = db.getRecordByDate(today);
  const analysis = db.getAnalysisByDate(today);
  res.json({ date: today, record: record || null, analysis: analysis || null });
});

// 获取指定日期记录
router.get('/:date', (req, res) => {
  const record = db.getRecordByDate(req.params.date);
  const analysis = db.getAnalysisByDate(req.params.date);
  res.json({ record: record || null, analysis: analysis || null });
});

// 获取历史记录列表
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 90;
  const records = db.getRecentRecords(limit);
  const streak = db.getStreak();
  res.json({ records, streak });
});

// 提交每日打卡（支持照片上传）
router.post(
  '/',
  upload.fields([
    { name: 'breakfast_photo', maxCount: 1 },
    { name: 'lunch_photo', maxCount: 1 },
    { name: 'dinner_photo', maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const body = req.body;
      const date = body.date || new Date().toISOString().split('T')[0];

      const record = {
        date,
        morning_weight: body.morning_weight ? parseFloat(body.morning_weight) : null,
        sleep_bedtime: body.sleep_bedtime || null,
        sleep_waketime: body.sleep_waketime || null,
        sleep_interruptions: body.sleep_interruptions ? parseInt(body.sleep_interruptions) : 0,
        sleep_energy: body.sleep_energy ? parseInt(body.sleep_energy) : null,
        breakfast: body.breakfast || null,
        lunch: body.lunch || null,
        dinner: body.dinner || null,
        snacks: body.snacks || null,
        breakfast_photo: req.files?.breakfast_photo?.[0]?.filename || body.breakfast_photo || null,
        lunch_photo: req.files?.lunch_photo?.[0]?.filename || body.lunch_photo || null,
        dinner_photo: req.files?.dinner_photo?.[0]?.filename || body.dinner_photo || null,
        exercise_type: body.exercise_type || null,
        exercise_duration: body.exercise_duration ? parseInt(body.exercise_duration) : 0,
        exercise_intensity: body.exercise_intensity ? parseInt(body.exercise_intensity) : null,
        exercise_steps: body.exercise_steps ? parseInt(body.exercise_steps) : 0,
        body_waist: body.body_waist || null,
        body_knee: body.body_knee || null,
        body_fatigue: body.body_fatigue ? parseInt(body.body_fatigue) : null,
        body_hunger: body.body_hunger ? parseInt(body.body_hunger) : null,
        body_bowel: body.body_bowel || null,
        self_diet_score: body.self_diet_score ? parseInt(body.self_diet_score) : null,
        self_exercise_score: body.self_exercise_score ? parseInt(body.self_exercise_score) : null,
      };

      db.upsertRecord(record);
      res.json({ success: true, record: db.getRecordByDate(date) });
    } catch (err) {
      console.error('保存打卡记录失败:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// 体脂秤数据
router.post('/bodycomp', (req, res) => {
  try {
    const body = req.body;
    const date = body.date || new Date().toISOString().split('T')[0];

    const data = {
      date,
      weight: body.weight ? parseFloat(body.weight) : null,
      body_fat: body.body_fat ? parseFloat(body.body_fat) : null,
      muscle_mass: body.muscle_mass ? parseFloat(body.muscle_mass) : null,
      water: body.water ? parseFloat(body.water) : null,
      bone_mass: body.bone_mass ? parseFloat(body.bone_mass) : null,
      bmi: body.bmi ? parseFloat(body.bmi) : null,
      bmr: body.bmr ? parseFloat(body.bmr) : null,
      visceral_fat: body.visceral_fat ? parseInt(body.visceral_fat) : null,
    };

    db.upsertBodyComp(data);
    res.json({ success: true });
  } catch (err) {
    console.error('保存体脂数据失败:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
