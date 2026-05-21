const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取用户档案
router.get('/', (req, res) => {
  const profile = db.getProfile();
  if (!profile) {
    return res.json({ exists: false });
  }
  res.json({ exists: true, ...profile });
});

// 创建或更新用户档案
router.post('/', (req, res) => {
  const { age, height, starting_weight, goal_weight, deadline } = req.body;

  // 自动计算第一阶段：从今天到6月30日（或下个月底）
  const now = new Date();
  const phaseEnd = new Date(now.getFullYear(), now.getMonth() + 1, 30);
  if (phaseEnd <= now) {
    phaseEnd.setMonth(phaseEnd.getMonth() + 1, 30);
  }
  const phaseEndStr = phaseEnd.toISOString().split('T')[0];

  // 第一阶段目标：每周减0.45kg
  const phaseWeeks = Math.ceil((phaseEnd - now) / (1000 * 60 * 60 * 24 * 7));
  const phaseGoal = Math.max(goal_weight, starting_weight - (0.45 * phaseWeeks));

  const profile = {
    age,
    height: height / 100, // 存米制（前端传cm）
    starting_weight,
    goal_weight,
    deadline,
    current_phase: 1,
    phase_start_date: now.toISOString().split('T')[0],
    phase_end_date: phaseEndStr,
    phase_start_weight: starting_weight,
    phase_goal_weight: Math.round(phaseGoal * 10) / 10,
  };

  db.upsertProfile(profile);
  res.json({ success: true, profile: db.getProfile() });
});

module.exports = router;
