const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取用户档案
router.get('/', async (req, res) => {
  try {
    const profile = await db.getProfile();
    if (!profile) return res.json({ exists: false });
    res.json({ exists: true, ...profile });
  } catch (err) {
    console.error('获取档案失败:', err.message);
    res.status(500).json({ error: '获取档案失败' });
  }
});

// 创建或更新用户档案
router.post('/', async (req, res) => {
  try {
    const { age, height, starting_weight, goal_weight, deadline, body_fat, health_notes, life_context, ideal_note } = req.body;

    // 必填字段校验
    if (!age || !height || !starting_weight || !goal_weight || !deadline) {
      return res.status(400).json({ error: '请填写完整的档案信息（年龄、身高、起始体重、目标体重、截止日期）' });
    }

    const ageNum = parseInt(age);
    const heightNum = parseFloat(height);
    const startNum = parseFloat(starting_weight);
    const goalNum = parseFloat(goal_weight);

    if (isNaN(ageNum) || ageNum < 10 || ageNum > 120) {
      return res.status(400).json({ error: '年龄需在 10-120 之间' });
    }
    if (isNaN(heightNum) || heightNum < 100 || heightNum > 250) {
      return res.status(400).json({ error: '身高需在 100-250 cm 之间' });
    }
    if (isNaN(startNum) || startNum < 30 || startNum > 500) {
      return res.status(400).json({ error: '起始体重需在 30-500 kg 之间' });
    }
    if (isNaN(goalNum) || goalNum < 30 || goalNum > 500) {
      return res.status(400).json({ error: '目标体重需在 30-500 kg 之间' });
    }
    if (goalNum >= startNum) {
      return res.status(400).json({ error: '目标体重必须小于起始体重' });
    }

    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(deadlineDate.getTime()) || deadlineDate <= today) {
      return res.status(400).json({ error: '截止日期必须是未来的日期' });
    }

    // 自动计算第一阶段
    const now = new Date();
    const phaseEnd = new Date(now.getFullYear(), now.getMonth() + 1, 30);
    if (phaseEnd <= now) phaseEnd.setMonth(phaseEnd.getMonth() + 1, 30);
    const phaseEndStr = phaseEnd.toISOString().split('T')[0];

    const phaseWeeks = Math.ceil((phaseEnd - now) / (1000 * 60 * 60 * 24 * 7));
    const phaseGoal = Math.max(goalNum, startNum - (0.45 * phaseWeeks));

    const profile = {
      age: ageNum,
      height: heightNum,
      starting_weight: startNum,
      goal_weight: goalNum,
      deadline,
      current_phase: 1,
      phase_start_date: now.toISOString().split('T')[0],
      phase_end_date: phaseEndStr,
      phase_start_weight: startNum,
      phase_goal_weight: Math.round(phaseGoal * 10) / 10,
      body_fat: body_fat ? parseFloat(body_fat) : null,
      health_notes: health_notes || null,
      life_context: life_context || null,
      ideal_note: ideal_note || null,
    };

    await db.upsertProfile(profile);
    const saved = await db.getProfile();
    res.json({ success: true, profile: saved });
  } catch (err) {
    console.error('保存档案失败:', err.message);
    res.status(500).json({ error: '保存失败，请重试' });
  }
});

module.exports = router;
