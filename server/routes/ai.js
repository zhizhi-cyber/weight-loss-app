const express = require('express');
const router = express.Router();
const db = require('../db');
const { buildCoachPrompt } = require('../prompts/coach');

// DeepSeek API 调用
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
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API 调用失败: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// 解析 AI 回复为结构化数据
function parseAIResponse(rawText) {
  const extractSection = (label) => {
    const regex = new RegExp(`【${label}】([\\s\\S]*?)(?=【|$)`, 'i');
    const match = rawText.match(regex);
    return match ? match[1].trim() : '';
  };

  return {
    data_summary: extractSection('数据总结'),
    total_goal_json: extractSection('总目标偏离度'),
    phase_goal_json: extractSection('阶段目标偏离度'),
    judgment: extractSection('问题判断'),
    suggestions: extractSection('明日建议'),
  };
}

// 生成 AI 分析
router.post('/analyze/:date', async (req, res) => {
  try {
    const date = req.params.date;
    const profile = db.getProfile();

    if (!profile) {
      return res.status(400).json({ error: '请先设置个人档案' });
    }

    const record = db.getRecordByDate(date);
    if (!record) {
      return res.status(400).json({ error: `没有找到 ${date} 的记录` });
    }

    const recentRecords = db.getRecentRecords(14);

    const { systemPrompt, userMessage } = buildCoachPrompt(profile, record, recentRecords);

    console.log('正在调用 DeepSeek API...');
    const rawResponse = await callDeepSeek(systemPrompt, userMessage);
    console.log('AI 回复:', rawResponse);

    const parsed = parseAIResponse(rawResponse);

    db.upsertAnalysis({
      date,
      raw_response: rawResponse,
      data_summary: parsed.data_summary,
      total_goal_json: parsed.total_goal_json,
      phase_goal_json: parsed.phase_goal_json,
      judgment: parsed.judgment,
      suggestions: parsed.suggestions,
    });

    const saved = db.getAnalysisByDate(date);
    res.json({ success: true, analysis: saved });
  } catch (err) {
    console.error('AI 分析失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// 获取某天的分析
router.get('/:date', (req, res) => {
  const analysis = db.getAnalysisByDate(req.params.date);
  res.json({ analysis: analysis || null });
});

module.exports = router;
