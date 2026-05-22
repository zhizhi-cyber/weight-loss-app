const express = require('express');
const router = express.Router();
const db = require('../db');
const { buildCoachPrompt, calcBMR, calcTDEE } = require('../prompts/coach');

async function callDeepSeek(systemPrompt, userMessage) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

  if (!apiKey || apiKey === 'sk-your-api-key-here') {
    throw new Error('请先在 .env 文件中配置 DEEPSEEK_API_KEY');
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 1400,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API 调用失败: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function parseAIResponse(rawText) {
  const extractSection = (label) => {
    const regex = new RegExp(`【${label}】([\\s\\S]*?)(?=【|$)`, 'i');
    const match = rawText.match(regex);
    return match ? match[1].trim() : '';
  };

  return {
    data_summary: extractSection('今日总结'),
    calorie_bill: extractSection('热量账单'),
    nutrition: extractSection('营养结构'),
    weight_cause: extractSection('体重变化原因分析'),
    total_goal_json: extractSection('总目标进度'),
    phase_goal_json: extractSection('阶段目标进度'),
    highlights: extractSection('成长亮点'),
    problems: extractSection('问题行为'),
    suggestions: extractSection('明日最关键调整'),
    judgment: extractSection('体重变化原因分析'), // 兼容旧字段
  };
}

// 生成 AI 分析
router.post('/analyze/:date', async (req, res) => {
  try {
    const date = req.params.date;
    const profile = await db.getProfile();

    if (!profile) {
      return res.status(400).json({ error: '请先设置个人档案' });
    }

    const record = await db.getRecordByDate(date);
    if (!record) {
      return res.status(400).json({ error: `没有找到 ${date} 的记录` });
    }

    const recentRecords = await db.getRecentRecords(14);

    const { systemPrompt, userMessage } = buildCoachPrompt(profile, record, recentRecords);

    console.log('正在调用 DeepSeek API...');
    const rawResponse = await callDeepSeek(systemPrompt, userMessage);
    console.log('AI 回复:', rawResponse);

    const parsed = parseAIResponse(rawResponse);

    await db.upsertAnalysis({
      date,
      raw_response: rawResponse,
      data_summary: parsed.data_summary,
      total_goal_json: parsed.total_goal_json,
      phase_goal_json: parsed.phase_goal_json,
      judgment: parsed.judgment,
      suggestions: parsed.suggestions,
      calorie_bill: parsed.calorie_bill,
      nutrition: parsed.nutrition,
      weight_cause: parsed.weight_cause,
      highlights: parsed.highlights,
      problems: parsed.problems,
    });

    // 自动检查：连续2天低于阶段目标才推进
    let phaseUpdated = false;
    const phaseGoal = profile.phase_goal_weight || profile.goal_weight;
    const consecutiveUnder = currentWeight <= phaseGoal && recentRecords.length >= 1
      && recentRecords[0].morning_weight && recentRecords[0].morning_weight <= phaseGoal;
    if (consecutiveUnder && currentWeight > profile.goal_weight) {
      const weeklyRate = 0.45;
      const nextPhaseStart = new Date().toISOString().split('T')[0];
      const nextPhaseEndDate = new Date(Date.now() + 30 * 86400000);
      const nextPhaseEnd = nextPhaseEndDate > new Date(profile.deadline) ? profile.deadline : nextPhaseEndDate.toISOString().split('T')[0];
      const nextPhaseGoal = Math.max(profile.goal_weight, currentWeight - weeklyRate * 4);
      await db.upsertProfile({
        age: profile.age,
        height: profile.height,
        starting_weight: profile.starting_weight,
        goal_weight: profile.goal_weight,
        deadline: profile.deadline,
        body_fat: profile.body_fat,
        health_notes: profile.health_notes,
        life_context: profile.life_context,
        ideal_note: profile.ideal_note,
        current_phase: (profile.current_phase || 1) + 1,
        phase_start_date: nextPhaseStart,
        phase_end_date: nextPhaseEnd,
        phase_start_weight: currentWeight,
        phase_goal_weight: Math.round(nextPhaseGoal * 10) / 10,
      });
      phaseUpdated = true;
    }

    const currentWeight = record.morning_weight || profile.starting_weight;
    const bmr = calcBMR(currentWeight, Math.round(profile.height), profile.age);
    const tdee = calcTDEE(bmr, record.exercise_steps || 0, record.exercise_duration || 0, record.exercise_intensity || 0);
    const saved = await db.getAnalysisByDate(date);
    res.json({ success: true, analysis: saved, metabolism: { bmr, tdee }, phaseUpdated });
  } catch (err) {
    console.error('AI 分析失败:', err.message, err.cause || '', err.stack || '');
    res.status(500).json({ error: err.message, detail: err.cause?.message || String(err) });
  }
});

// AI 智能录入：从文字/图片中提取数据 + 教练分析
router.post('/smart-log', async (req, res) => {
  try {
    const { text, image } = req.body; // image is base64 string (optional)

    if (!text && !image) {
      return res.status(400).json({ error: '请提供文字记录或照片' });
    }

    const profile = await db.getProfile();

    const systemPrompt = `你是一个专业的减肥教练兼营养师兼运动康复专家。用户会给你一段日常记录文字（可能来自记事本，格式随意），或一张记事本截图/食物照片。

你的任务：
1. 从记录中提取所有可识别的健康数据
2. 给出饮食分析（估算热量、营养评价、改进建议）
3. 给出运动分析（消耗估算、动作建议、效率优化，如有投篮数据则给出命中率优化建议）
4. 给出减肥教练的综合建议

你必须严格按以下 JSON 格式回复，不要输出任何非 JSON 内容：

{
  "extracted": {
    "morning_weight": 数字或null,
    "sleep_bedtime": "HH:MM"或null,
    "sleep_waketime": "HH:MM"或null,
    "sleep_interruptions": 数字或0,
    "sleep_energy": 1-10或null,
    "breakfast": "文字"或"",
    "breakfast_kcal": 估算数字或null,
    "lunch": "文字"或"",
    "lunch_kcal": 估算数字或null,
    "dinner": "文字"或"",
    "dinner_kcal": 估算数字或null,
    "snacks": "文字"或"",
    "snacks_kcal": 估算数字或null,
    "exercise_type": "文字"或"",
    "exercise_duration": 分钟数或0,
    "exercise_intensity": 1-10或null,
    "exercise_steps": 数字或0,
    "body_waist": "文字"或"",
    "body_knee": "文字"或"",
    "body_fatigue": 1-10或null,
    "body_hunger": 1-10或null,
    "body_bowel": "文字"或"",
    "shooting_accuracy": 数字或null,
    "stress_level": 1-10或null,
    "water_intake": 升数或null,
    "self_diet_score": 1-10或null,
    "self_exercise_score": 1-10或null,
    "total_kcal_estimate": 估算总热量数字或null
  },
  "diet_analysis": {
    "summary": "饮食总结一句话",
    "nutrition_rating": "优秀/良好/一般/较差",
    "protein_estimate": "蛋白质估计（克）",
    "issues": ["问题1", "问题2"],
    "suggestions": ["建议1", "建议2"]
  },
  "exercise_analysis": {
    "summary": "运动总结一句话",
    "effectiveness": "高效/中等/不足",
    "kcal_burned_estimate": 估算消耗数字或null,
    "improvements": ["改进建议1", "改进建议2"],
    "shooting_tips": "如有投篮相关记录，给出命中率优化建议；否则为空字符串"
  },
  "coaching": {
    "key_win": "今天最大的进步或亮点",
    "key_risk": "今天最大的风险或问题",
    "weight_loss_advice": "针对减肥的核心建议",
    "tomorrow_focus": "明天最重要的一个行动"
  }
}

规则：
- 如果能识别出具体食物，估算热量（参考中国食物热量表）
- 如果用户提到了情绪、压力、社交等上下文，也纳入分析
- 语气温暖但有原则，像真正的教练
- 热量估算偏保守（宁可多算不要少算）
- 对于投篮等技能类运动，给出具体可操作的优化建议`;

    // Build user message (text + optional image)
    const userContent = [];
    if (text) {
      userContent.push({ type: 'text', text: `请分析以下记录：\n\n${text}` });
    }
    if (image) {
      userContent.push({
        type: 'image_url',
        image_url: { url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` },
      });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent.length === 1 && userContent[0].type === 'text'
        ? userContent[0].text
        : userContent },
    ];

    console.log('正在调用 DeepSeek 智能录入...');
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

    if (!apiKey || apiKey === 'sk-your-api-key-here') {
      throw new Error('请先在 .env 文件中配置 DEEPSEEK_API_KEY');
    }

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API 调用失败: ${response.status} ${errText}`);
    }

    const data = await response.json();
    let result;
    try {
      result = JSON.parse(data.choices[0].message.content);
    } catch (parseErr) {
      console.error('AI 返回非JSON格式:', data.choices[0].message.content.slice(0, 200));
      return res.status(500).json({ error: 'AI 返回格式异常，请重试或缩短输入内容' });
    }

    console.log('智能录入成功');
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('智能录入失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 获取某天的分析
router.get('/:date', async (req, res) => {
  const analysis = await db.getAnalysisByDate(req.params.date);
  res.json({ analysis: analysis || null });
});

// AI 对话：随时问 AI 教练问题
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: '请输入问题' });

    const profile = await db.getProfile();
    const todayRecord = await db.getRecordByDate(new Date().toISOString().split('T')[0]);
    const recentRecords = await db.getRecentRecords(7);

    let contextPrompt = '你是一位顶级身体成长管理教练，帮助用户长期掌控身体。\n';
    if (profile) {
      contextPrompt += `\n## 用户档案
- 男性，${profile.age}岁，${Math.round(profile.height * 100)}cm
- 起始体重 ${profile.starting_weight}kg，目标 ${profile.goal_weight}kg
- 截止日期 ${profile.deadline}
- 有轻度腰肌劳损史\n`;
    }
    if (todayRecord) {
      contextPrompt += `\n## 今日数据
- 体重：${todayRecord.morning_weight || '未称'}kg
- 饮食：早[${todayRecord.breakfast || '?'}] 午[${todayRecord.lunch || '?'}] 晚[${todayRecord.dinner || '?'}]
- 运动：${todayRecord.exercise_type || '无'} ${todayRecord.exercise_duration || 0}分钟 ${todayRecord.exercise_steps || 0}步
- 睡眠：${todayRecord.sleep_energy || '?'}/10 夜醒${todayRecord.sleep_interruptions || 0}次
- 饮水：${todayRecord.water_intake || '?'}L\n`;
    }
    if (recentRecords.length > 0) {
      contextPrompt += `\n最近几天体重趋势：${recentRecords.filter(r => r.morning_weight).slice(0, 7).map(r => `${r.date.slice(5)}:${r.morning_weight}kg`).join('，')}\n`;
    }
    contextPrompt += '\n规则：回答简洁实用（200字以内），基于用户实际数据。如果用户问"能不能吃"，分析热量和营养并给明确建议。如果用户分享进步，先肯定再给下一步建议。如果用户有疑问，基于科学和数据回答。绝不建议极端节食或每天跑10公里。注意腰部保护。';

    const messages = [
      { role: 'system', content: contextPrompt },
      ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.6,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API 调用失败: ${response.status} ${errText}`);
    }

    const data = await response.json();
    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error('AI 对话失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
