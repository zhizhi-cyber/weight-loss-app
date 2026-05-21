/**
 * 构建发给 DeepSeek 的教练 Prompt
 */

function buildCoachPrompt(profile, todayRecord, recentRecords) {
  const startWeight = profile.starting_weight;
  const goalWeight = profile.goal_weight;
  const deadline = profile.deadline;
  const totalToLose = startWeight - goalWeight;

  // 计算剩余天数和目标线
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const totalDays = Math.ceil((deadlineDate - new Date(profile.created_at || profile.phase_start_date)) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
  const dailyTarget = totalToLose / totalDays;

  // 今日理论目标体重
  const daysPassed = totalDays - remainingDays;
  const todayTargetWeight = startWeight - (dailyTarget * daysPassed);

  // 阶段计算
  const phaseStart = profile.phase_start_date ? new Date(profile.phase_start_date) : today;
  const phaseEnd = profile.phase_end_date ? new Date(profile.phase_end_date) : today;
  const phaseTotalDays = Math.ceil((phaseEnd - phaseStart) / (1000 * 60 * 60 * 24));
  const phaseRemainingDays = Math.max(0, Math.ceil((phaseEnd - today) / (1000 * 60 * 60 * 24)));
  const phaseToLose = (profile.phase_start_weight || startWeight) - (profile.phase_goal_weight || goalWeight);
  const phaseDailyTarget = phaseTotalDays > 0 ? phaseToLose / phaseTotalDays : 0;
  const phaseDaysPassed = phaseTotalDays - phaseRemainingDays;
  const phaseTodayTarget = (profile.phase_start_weight || startWeight) - (phaseDailyTarget * phaseDaysPassed);

  const currentWeight = todayRecord.morning_weight || startWeight;
  const totalLost = startWeight - currentWeight;
  const totalProgress = (totalLost / totalToLose) * 100;
  const totalDeviation = currentWeight - todayTargetWeight;
  const totalDeviationPercent = totalToLose > 0 ? (totalDeviation / totalToLose) * 100 : 0;

  const phaseLost = (profile.phase_start_weight || startWeight) - currentWeight;
  const phaseProgress = phaseToLose > 0 ? (phaseLost / phaseToLose) * 100 : 0;
  const phaseDeviation = currentWeight - phaseTodayTarget;
  const phaseDeviationPercent = phaseToLose > 0 ? (phaseDeviation / phaseToLose) * 100 : 0;

  // 最近7天数据摘要
  const recentSummary = recentRecords.slice(0, 7).map(r => {
    return `${r.date}: 体重${r.morning_weight || '未填'}kg, 运动${r.exercise_type || '无'}${r.exercise_duration || 0}分钟, 步数${r.exercise_steps || 0}, 睡眠${r.sleep_energy || '?'}分, 饮食自评${r.self_diet_score || '?'}分`;
  }).join('\n');

  const systemPrompt = `你是我的私人健身教练，也是我的成长陪伴顾问。你需要严格、有温度、具体地分析我的每日数据。

我的基本信息：
- 年龄：${profile.age}岁
- 身高：${profile.height}cm
- 起始体重：${startWeight}kg
- 目标体重：${goalWeight}kg
- 截止日期：${deadline}
- 总共要减：${totalToLose.toFixed(1)}kg

当前处于第${profile.current_phase || 1}阶段：${profile.phase_start_date || '开始'} 至 ${profile.phase_end_date || '待定'}
阶段目标：从 ${profile.phase_start_weight || startWeight}kg 减到 ${profile.phase_goal_weight || goalWeight}kg

你每次回复必须严格按以下5个模块输出，用中文，控制在200字以内：

【数据总结】
一句话概括今天的体重、饮食、运动、睡眠情况。

【总目标偏离度】
- 总目标：${goalWeight}kg | 还剩${remainingDays}天
- 今日理论目标线：${todayTargetWeight.toFixed(2)}kg
- 实际体重：${currentWeight}kg
- 偏离：${totalDeviation > 0 ? '落后' : '领先'}${Math.abs(totalDeviation).toFixed(2)}kg
- 总进度：${totalProgress.toFixed(1)}%
- 还差：${(currentWeight - goalWeight).toFixed(1)}kg

【阶段目标偏离度】
- 阶段目标：${profile.phase_end_date || '待定'}前到${profile.phase_goal_weight || goalWeight}kg | 还剩${phaseRemainingDays}天
- 今日阶段目标线：${phaseTodayTarget.toFixed(2)}kg
- 阶段偏离：${phaseDeviation > 0 ? '落后' : '领先'}${Math.abs(phaseDeviation).toFixed(2)}kg
- 阶段进度：${phaseProgress.toFixed(1)}%

【问题判断】
判断今日体重变化属于：真实进步 / 假落后（水分、盐分、睡眠差导致）/ 真落后（热量超标）。
一句话说明原因。

【明日建议】
1.（一条具体可执行的最小行动）
2.（可选第二条）
3.（可选第三条）

重要规则：
- 如果落后<0.5kg，属于正常波动，不要吓唬我
- 建议必须是"今天就能做到的小事"，不要说"每天跑5公里"这种
- 如果连续多天没打卡，轻松提醒，不批评
- 每7天左右给我一次小里程碑庆祝
- 语气温暖但有原则，不像机器人`;

  const userMessage = `今天的数据：

日期：${todayRecord.date}
晨起体重：${currentWeight}kg
睡眠：${todayRecord.sleep_bedtime || '未填'} 睡 - ${todayRecord.sleep_waketime || '未填'} 醒，中途醒${todayRecord.sleep_interruptions || 0}次，精神${todayRecord.sleep_energy || '?'}分
早餐：${todayRecord.breakfast || '未填'}
午餐：${todayRecord.lunch || '未填'}
晚餐：${todayRecord.dinner || '未填'}
加餐/零食：${todayRecord.snacks || '无'}
运动：${todayRecord.exercise_type || '无'}，${todayRecord.exercise_duration || 0}分钟，强度${todayRecord.exercise_intensity || '?'}分，步数${todayRecord.exercise_steps || 0}
身体状态：腰-${todayRecord.body_waist || '未填'}，膝盖-${todayRecord.body_knee || '未填'}，疲劳感${todayRecord.body_fatigue || '?'}分，饥饿感${todayRecord.body_hunger || '?'}分
排便：${todayRecord.body_bowel || '未填'}
自评：饮食${todayRecord.self_diet_score || '?'}分，运动${todayRecord.self_exercise_score || '?'}分

最近7天记录：
${recentSummary || '暂无历史数据'}

请按固定格式给我今天的教练反馈。`;

  return { systemPrompt, userMessage };
}

module.exports = { buildCoachPrompt };
