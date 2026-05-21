function buildCoachPrompt(profile, todayRecord, recentRecords) {
  const startWeight = profile.starting_weight;
  const goalWeight = profile.goal_weight;
  const deadline = profile.deadline;
  const totalToLose = startWeight - goalWeight;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(profile.phase_start_date || today);
  startDate.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const totalDays = Math.ceil((deadlineDate - startDate) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24)));
  const dailyTarget = totalToLose / totalDays;
  const daysPassed = totalDays - remainingDays;
  const todayTargetWeight = startWeight - (dailyTarget * daysPassed);

  // Phase calculations
  const phaseStart = new Date(profile.phase_start_date);
  phaseStart.setHours(0, 0, 0, 0);
  const phaseEnd = new Date(profile.phase_end_date);
  phaseEnd.setHours(0, 0, 0, 0);
  const phaseTotalDays = Math.ceil((phaseEnd - phaseStart) / (1000 * 60 * 60 * 24));
  const phaseRemainingDays = Math.max(0, Math.ceil((phaseEnd - today) / (1000 * 60 * 60 * 24)));
  const phaseToLose = (profile.phase_start_weight || startWeight) - (profile.phase_goal_weight || goalWeight);
  const phaseDailyTarget = phaseTotalDays > 0 ? phaseToLose / phaseTotalDays : 0;
  const phaseDaysPassed = phaseTotalDays - phaseRemainingDays;
  const phaseTodayTarget = (profile.phase_start_weight || startWeight) - (phaseDailyTarget * phaseDaysPassed);

  const currentWeight = todayRecord.morning_weight || startWeight;
  const totalLost = startWeight - currentWeight;
  const totalProgress = totalToLose > 0 ? (totalLost / totalToLose) * 100 : 0;
  const totalDeviation = currentWeight - todayTargetWeight;
  const totalDeviationPercent = totalToLose > 0 ? (totalDeviation / totalToLose) * 100 : 0;

  const phaseLost = (profile.phase_start_weight || startWeight) - currentWeight;
  const phaseProgress = phaseToLose > 0 ? (phaseLost / phaseToLose) * 100 : 0;
  const phaseDeviation = currentWeight - phaseTodayTarget;
  const phaseDeviationPercent = phaseToLose > 0 ? (phaseDeviation / phaseToLose) * 100 : 0;

  // Recent records summary
  const recentSummary = recentRecords.slice(0, 7).map(r => {
    const w = r.morning_weight ? `${r.morning_weight}kg` : '未称';
    const ex = r.exercise_type || r.exercise_duration ? `${r.exercise_type || '运动'}${r.exercise_duration || 0}分钟` : '无运动';
    const d = r.self_diet_score ? `饮食${r.self_diet_score}分` : '';
    const s = r.sleep_energy ? `睡眠${r.sleep_energy}分` : '';
    return `${r.date}: ${w}, ${ex}, 步数${r.exercise_steps || 0}${d ? ', ' + d : ''}${s ? ', ' + s : ''}`;
  }).join('\n');

  const systemPrompt = `你是我最严格的私人健身教练和成长陪伴顾问。你的风格是：温暖但有原则，用数据说话，不糊弄。

我的基本信息：
- 年龄：${profile.age}岁
- 身高：${Math.round(profile.height * 100)}cm
- 起始体重：${startWeight}kg（${profile.phase_start_date || '2026年5月'}）
- 目标体重：${goalWeight}kg
- 截止日期：${deadline}
- 总共要减：${totalToLose.toFixed(1)}kg（约${Math.round(totalToLose / 0.45)}周）

当前第${profile.current_phase || 1}阶段：
- 阶段目标：${profile.phase_end_date || '待定'}前到${profile.phase_goal_weight || goalWeight}kg
- 阶段需减：${phaseToLose.toFixed(1)}kg
- 每日目标约：${phaseDailyTarget.toFixed(3)}kg/天（~${(phaseDailyTarget * 7).toFixed(2)}kg/周）

你每次回复严格按以下模块输出，用中文，控制在300字以内：

【数据总结】
一句话概括今天的体重变化、饮食质量、运动完成度、睡眠情况。

【总目标进度】
- 总目标：${goalWeight}kg | 还剩${remainingDays}天
- 今日目标线：${todayTargetWeight.toFixed(2)}kg
- 实际体重：${currentWeight}kg（偏离：${totalDeviation > 0.01 ? '落后' : totalDeviation < -0.01 ? '领先' : '持平'}${Math.abs(totalDeviation).toFixed(2)}kg）
- 总进度：${totalProgress >= 0 ? totalProgress.toFixed(1) : '0.0'}% | 还差${(currentWeight - goalWeight).toFixed(1)}kg
- 每日需减约：${dailyTarget.toFixed(3)}kg/天

【阶段目标进度】
- 阶段${profile.current_phase || 1}：${profile.phase_end_date || '待定'}前到${profile.phase_goal_weight || goalWeight}kg | 还剩${phaseRemainingDays}天
- 阶段目标线：${phaseTodayTarget.toFixed(2)}kg
- 阶段偏离：${phaseDeviation > 0.01 ? '落后' : phaseDeviation < -0.01 ? '领先' : '持平'}${Math.abs(phaseDeviation).toFixed(2)}kg
- 阶段进度：${phaseProgress >= 0 ? phaseProgress.toFixed(1) : '0.0'}% | 还差${(currentWeight - (profile.phase_goal_weight || goalWeight)).toFixed(1)}kg

【问题判断】
必须选择以下三种之一：
- 真实进步：体重下降且饮食运动配合到位
- 假落后：吃咸、没排便、睡眠差、水分波动导致短期涨重
- 真落后：连续热量超标、步数低、运动缺失
并一句话说明判断理由。

【明日建议】
1. （第一条：今天就能做到的最小行动，具体可执行）
2. （第二条：可选）
3. （第三条：可选）

重要规则：
- 偏离<0.5kg属于正常波动，不要吓我
- 建议必须是具体可执行的，不要喊口号
- 如果多天没打卡，轻松提醒不批评
- 每7天左右给一次小里程碑
- 注意体重、饮食、运动之间的关联性
- 用我的数据说话，不要泛泛而谈

阶段升级规则提醒（你会帮我判断是否需要提前升级）：
- 偏离0.5kg以内：正常波动，不调整
- 连续3天落后0.8kg以上：饮食和步数微调建议
- 连续7天落后1kg以上：阶段计划降级，排查原因
- 提前达到阶段目标：立即进入下一阶段`;

  const userMessage = `今天 ${todayRecord.date} 的数据：

晨起体重：${currentWeight}kg

睡眠：${todayRecord.sleep_bedtime || '未填'}睡 - ${todayRecord.sleep_waketime || '未填'}醒
中途醒${todayRecord.sleep_interruptions || 0}次，精神状态${todayRecord.sleep_energy || '?'}/10

饮食：
早餐：${todayRecord.breakfast || '未填'}
午餐：${todayRecord.lunch || '未填'}
晚餐：${todayRecord.dinner || '未填'}
加餐/零食：${todayRecord.snacks || '无'}

运动：${todayRecord.exercise_type || '无'} ${todayRecord.exercise_duration || 0}分钟
强度${todayRecord.exercise_intensity || '?'}/10，步数${todayRecord.exercise_steps || 0}

身体：
腰围：${todayRecord.body_waist || '未填'}，膝盖：${todayRecord.body_knee || '未填'}
疲劳感${todayRecord.body_fatigue || '?'}/10，饥饿感${todayRecord.body_hunger || '?'}/10
排便：${todayRecord.body_bowel || '未填'}

自评：饮食${todayRecord.self_diet_score || '?'}/10，运动${todayRecord.self_exercise_score || '?'}/10

最近7天记录：
${recentSummary || '暂无'}

请按格式给我今天的教练反馈。`;

  return { systemPrompt, userMessage };
}

module.exports = { buildCoachPrompt };
