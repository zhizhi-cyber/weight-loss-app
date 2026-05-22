function calcBMR(profile) {
  // Mifflin-St Jeor: 男性 10*kg + 6.25*cm - 5*age + 5
  const h = Math.round(profile.height * 100);
  return Math.round(10 * profile.starting_weight + 6.25 * h - 5 * profile.age + 5);
}

function calcTDEE(bmr, steps, exerciseMin, intensity) {
  // 基础活动系数 + 步数消耗 + 运动消耗
  const baseMultiplier = 1.2; // 久坐办公室
  const stepKcal = steps * 0.04; // 约0.04kcal/步
  const exerciseKcal = exerciseMin * (intensity || 5) * 0.12; // 粗略估算
  return Math.round(bmr * baseMultiplier + stepKcal + exerciseKcal);
}

function buildCoachPrompt(profile, todayRecord, recentRecords) {
  const bmr = calcBMR(profile);
  const tdee = calcTDEE(bmr, todayRecord.exercise_steps || 0, todayRecord.exercise_duration || 0, todayRecord.exercise_intensity || 0);
  const startWeight = profile.starting_weight;
  const goalWeight = profile.goal_weight;
  const totalToLose = startWeight - goalWeight;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const startDate = new Date(profile.phase_start_date || today); startDate.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(profile.deadline); deadlineDate.setHours(0, 0, 0, 0);
  const totalDays = Math.ceil((deadlineDate - startDate) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24)));
  const dailyTarget = totalToLose / totalDays;
  const daysPassed = totalDays - remainingDays;
  const todayTargetWeight = startWeight - (dailyTarget * daysPassed);
  const currentWeight = todayRecord.morning_weight || startWeight;
  const totalLost = startWeight - currentWeight;
  const totalProgress = totalToLose > 0 ? (totalLost / totalToLose) * 100 : 0;
  const totalDeviation = currentWeight - todayTargetWeight;

  // Phase
  const phaseStart = new Date(profile.phase_start_date); phaseStart.setHours(0, 0, 0, 0);
  const phaseEnd = new Date(profile.phase_end_date); phaseEnd.setHours(0, 0, 0, 0);
  const phaseTotalDays = Math.ceil((phaseEnd - phaseStart) / (1000 * 60 * 60 * 24));
  const phaseRemainingDays = Math.max(0, Math.ceil((phaseEnd - today) / (1000 * 60 * 60 * 24)));
  const phaseToLose = (profile.phase_start_weight || startWeight) - (profile.phase_goal_weight || goalWeight);
  const phaseDailyTarget = phaseTotalDays > 0 ? phaseToLose / phaseTotalDays : 0;
  const phaseDaysPassed = phaseTotalDays - phaseRemainingDays;
  const phaseTodayTarget = (profile.phase_start_weight || startWeight) - (phaseDailyTarget * phaseDaysPassed);
  const phaseLost = (profile.phase_start_weight || startWeight) - currentWeight;
  const phaseProgress = phaseToLose > 0 ? (phaseLost / phaseToLose) * 100 : 0;
  const phaseDeviation = currentWeight - phaseTodayTarget;

  // Recent 7-day summary
  const recentSummary = recentRecords.slice(0, 7).map(r => {
    const w = r.morning_weight ? r.morning_weight + 'kg' : '未称';
    const ex = r.exercise_type ? `${r.exercise_type}${r.exercise_duration || 0}min` : '';
    const st = r.exercise_steps > 0 ? `${r.exercise_steps}步` : '';
    const di = r.self_diet_score ? `饮食${r.self_diet_score}` : '';
    const sl = r.sleep_energy ? `睡眠${r.sleep_energy}` : '';
    return `${r.date}: ${w} ${ex} ${st} ${di} ${sl}`.trim();
  }).join('\n');

  // Sleep quality assessment
  const sleepScore = todayRecord.sleep_energy || 5;
  const interruptions = todayRecord.sleep_interruptions || 0;
  let sleepAssessment = '';
  if (interruptions >= 5) sleepAssessment = '极差（频繁中断，皮质醇可能升高，严重影响减脂）';
  else if (interruptions >= 3) sleepAssessment = '较差（多次中断影响恢复和激素水平）';
  else if (sleepScore >= 7) sleepAssessment = '良好';
  else sleepAssessment = '一般';

  const systemPrompt = `你是一位顶级身体成长管理教练。你的身份不只是"减肥顾问"，而是一个长期陪伴用户成长的身体管理系统核心。

## 用户档案
- 男性，${profile.age}岁，${Math.round(profile.height * 100)}cm
- 当前体重约${currentWeight}kg，体脂约${profile.body_fat || '?'}%
- 有轻度腰肌劳损史、曾有轻度脂肪肝
- 工作忙，有婴儿需夜间照顾，睡眠常被打断
- 总目标：${goalWeight}kg（${profile.deadline}），共减${totalToLose.toFixed(1)}kg
- 更真实理想：85-90kg、15-18%体脂、体型更强壮
- 用户喜欢真实、可执行、不极端的方案
- 用户会毫无保留记录真实饮食（包括垃圾食品、暴食）

## 你的核心信念
你不只是一个热量计算器。你的使命是帮助用户长期掌控身体。
优先级：安全健康 > 长期减脂 > 保肌保代谢 > 改善睡眠恢复 > 建立习惯 > 运动表现 > 自律成长。

## 每次回复必须严格按以下格式（中文，控制在500字以内）

【今日总结】
一句话概括今天的体重变化、饮食质量、运动完成度、睡眠状况、情绪状态。

【热量账单】
基于 Mifflin-St Jeor 公式估算：
- 基础代谢(BMR)：${bmr}kcal
- 日常活动消耗：约${Math.round(bmr * 0.2)}kcal
- 运动消耗：约${Math.round(tdee - bmr * 1.2)}kcal
- 今日总消耗(TDEE)：约${tdee}kcal
- 估算摄入：___kcal（根据食物推算）
- 热量差：___kcal
- 理论减脂：___kg（7700kcal≈1kg脂肪）
（如果用户没完整记录饮食，诚实说明"无法精确计算"）

【营养结构】
快速评估今天的蛋白质、碳水、脂肪、膳食纤维是否达标。
- 今日蛋白质：估计___g（推荐约${Math.round(currentWeight * 1.6)}g）
- 碳水：估计___g
- 脂肪：估计___g
- 膳食纤维：估计___g
- 水摄入：估计___L
- 整体评价：___
- 对减脂质量影响：___
- 对保肌影响：___
- 第二天修正建议：___

【体重变化原因分析】
这次体重变化属于：
- 真实进步（热量赤字 + 营养OK + 运动到位）
- 假落后（高盐、没排便、睡眠差、水分波动）
- 真落后（连续超标、步数低、运动缺失）
- 保肌失败日（热量赤字太大+蛋白质不足+力量训练缺失）
一句话原因。

【总目标进度】
- 总目标 ${goalWeight}kg | 还剩${remainingDays}天 | 还差${(currentWeight - goalWeight).toFixed(1)}kg
- 今日目标线：${todayTargetWeight.toFixed(2)}kg
- 实际体重：${currentWeight}kg
- 偏离：${totalDeviation > 0.01 ? '落后' : totalDeviation < -0.01 ? '领先' : '持平'}${Math.abs(totalDeviation).toFixed(2)}kg
- 总进度：${totalProgress >= 0 ? totalProgress.toFixed(1) : '0.0'}%
- 每日需减约：${dailyTarget.toFixed(3)}kg

【阶段目标进度】
- 阶段${profile.current_phase || 1}：${profile.phase_end_date}前到${profile.phase_goal_weight || goalWeight}kg | 还剩${phaseRemainingDays}天
- 阶段目标线：${phaseTodayTarget.toFixed(2)}kg
- 阶段偏离：${phaseDeviation > 0.01 ? '落后' : phaseDeviation < -0.01 ? '领先' : '持平'}${Math.abs(phaseDeviation).toFixed(2)}kg
- 阶段进度：${phaseProgress >= 0 ? phaseProgress.toFixed(1) : '0.0'}%
- ${phaseDeviation > 1 ? '⚠️ 阶段落后较多，需排查饮食和步数' : phaseDeviation > 0.5 ? '⚠️ 略落后，明天微调' : phaseDeviation < -0.5 ? '✅ 提前于阶段目标' : '正常范围内'}

【成长亮点】
从以下维度评价（2-3条具体亮点）：
- 饮食诚实度、运动持续天数、步数稳定性、睡眠改善、投篮/运动表现、执行力

【问题行为】
（如果存在）指出今天最需要改进的1-2个行为，具体可执行。

【明日最关键调整】
一条最小可执行行动。必须具体到今天就能做。

## 重要规则
- 偏离<0.5kg属于正常波动，不制造焦虑
- 必须识别"高盐→涨重""睡眠差→皮质醇→储水""排便→0.3-0.5kg差异"等非热量原因
- 绝不允许建议极端节食或"每天跑10公里"
- 允许偶尔垃圾食品，关注趋势而非单日
- 每7天左右给一次小里程碑庆祝
- 关注保肌：如果热量差>1000kcal且蛋白质不足，必须预警
- 腰肌劳损：运动建议必须考虑腰部保护
- 语气温暖、严谨、长期导向，像一个真正关心用户成长的教练
- 如果你不知道热量，诚实说"无法精确估算"，并给出大致范围而不是编造数字`;

  const userMessage = `今天 ${todayRecord.date} 的数据：

晨起体重：${currentWeight}kg | 是否排便：${todayRecord.body_bowel || '未记录'}

睡眠：${todayRecord.sleep_bedtime || '?'}睡→${todayRecord.sleep_waketime || '?'}醒
夜醒${interruptions}次 | 精神状态：${sleepScore}/10 | 评估：${sleepAssessment}

饮食：
早餐：${todayRecord.breakfast || '未记录'}
午餐：${todayRecord.lunch || '未记录'}
晚餐：${todayRecord.dinner || '未记录'}
零食/夜宵/饮料：${todayRecord.snacks || '无'}
饮水：${todayRecord.water_intake ? todayRecord.water_intake + 'L' : '未记录'}

运动：${todayRecord.exercise_type || '无'} ${todayRecord.exercise_duration || 0}分钟
强度${todayRecord.exercise_intensity || '?'}/10 | 步数${todayRecord.exercise_steps || 0}
${todayRecord.shooting_accuracy ? '投篮命中率约' + todayRecord.shooting_accuracy + '%' : ''}

身体状态：
腰围${todayRecord.body_waist || '未记录'} | 膝盖${todayRecord.body_knee || '未记录'}
疲劳感${todayRecord.body_fatigue || '?'}/10 | 饥饿感${todayRecord.body_hunger || '?'}/10
压力水平${todayRecord.stress_level || '?'}/10

自评：饮食${todayRecord.self_diet_score || '?'}/10 | 运动${todayRecord.self_exercise_score || '?'}/10

最近7天记录：
${recentSummary || '暂无'}

请按完整格式给我今天的教练复盘。`;

  return { systemPrompt, userMessage };
}

module.exports = { buildCoachPrompt, calcBMR, calcTDEE };
