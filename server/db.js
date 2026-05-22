const { createClient } = require('@libsql/client');
const path = require('path');

const dbUrl = process.env.TURSO_DB_URL || 'http://127.0.0.1:8080';
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url: dbUrl,
  authToken,
});

// 创建表（每个函数独立执行 DDL，Turso 不支持同步 exec）
let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      age INTEGER NOT NULL,
      height REAL NOT NULL,
      starting_weight REAL NOT NULL,
      goal_weight REAL NOT NULL,
      deadline TEXT NOT NULL,
      current_phase INTEGER DEFAULT 1,
      phase_start_date TEXT,
      phase_end_date TEXT,
      phase_start_weight REAL,
      phase_goal_weight REAL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS daily_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      morning_weight REAL,
      sleep_bedtime TEXT,
      sleep_waketime TEXT,
      sleep_interruptions INTEGER DEFAULT 0,
      sleep_energy INTEGER CHECK(sleep_energy BETWEEN 1 AND 10),
      breakfast TEXT,
      lunch TEXT,
      dinner TEXT,
      snacks TEXT,
      breakfast_photo TEXT,
      lunch_photo TEXT,
      dinner_photo TEXT,
      exercise_type TEXT,
      exercise_duration INTEGER DEFAULT 0,
      exercise_intensity INTEGER CHECK(exercise_intensity BETWEEN 1 AND 10),
      exercise_steps INTEGER DEFAULT 0,
      body_waist TEXT,
      body_knee TEXT,
      body_fatigue INTEGER CHECK(body_fatigue BETWEEN 1 AND 10),
      body_hunger INTEGER CHECK(body_hunger BETWEEN 1 AND 10),
      body_bowel TEXT,
      self_diet_score INTEGER CHECK(self_diet_score BETWEEN 1 AND 10),
      self_exercise_score INTEGER CHECK(self_exercise_score BETWEEN 1 AND 10),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS body_composition (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      weight REAL,
      body_fat REAL,
      muscle_mass REAL,
      water REAL,
      bone_mass REAL,
      bmi REAL,
      bmr REAL,
      visceral_fat INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS ai_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      raw_response TEXT,
      data_summary TEXT,
      total_goal_json TEXT,
      phase_goal_json TEXT,
      judgment TEXT,
      suggestions TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
  ];
  for (const sql of statements) {
    await client.execute(sql);
  }

  // 增量迁移：添加体脂率等新字段
  const migrations = [
    'ALTER TABLE profile ADD COLUMN body_fat REAL',
    'ALTER TABLE profile ADD COLUMN gender TEXT DEFAULT "male"',
    'ALTER TABLE daily_records ADD COLUMN shooting_accuracy INTEGER',
    'ALTER TABLE daily_records ADD COLUMN stress_level INTEGER CHECK(stress_level BETWEEN 1 AND 10)',
    'ALTER TABLE daily_records ADD COLUMN water_intake REAL',
    'ALTER TABLE ai_analysis ADD COLUMN calorie_bill TEXT',
    'ALTER TABLE ai_analysis ADD COLUMN nutrition TEXT',
    'ALTER TABLE ai_analysis ADD COLUMN weight_cause TEXT',
    'ALTER TABLE ai_analysis ADD COLUMN highlights TEXT',
    'ALTER TABLE ai_analysis ADD COLUMN problems TEXT',
  ];
  for (const sql of migrations) {
    try { await client.execute(sql); } catch (e) { /* 字段已存在则跳过 */ }
  }

  tablesReady = true;
}

function rowToObj(row) {
  if (!row) return null;
  const obj = {};
  for (const key of Object.keys(row)) {
    obj[key] = row[key];
  }
  return obj;
}

// ========== Profile ==========

async function getProfile() {
  await ensureTables();
  const rs = await client.execute('SELECT * FROM profile WHERE id = 1');
  return rs.rows.length > 0 ? rowToObj(rs.rows[0]) : null;
}

async function upsertProfile(profile) {
  await ensureTables();
  const existing = await getProfile();
  if (existing) {
    await client.execute({
      sql: `UPDATE profile SET
        age = @age, height = @height, starting_weight = @starting_weight,
        goal_weight = @goal_weight, deadline = @deadline,
        current_phase = @current_phase, phase_start_date = @phase_start_date,
        phase_end_date = @phase_end_date, phase_start_weight = @phase_start_weight,
        phase_goal_weight = @phase_goal_weight,
        updated_at = datetime('now', 'localtime')
      WHERE id = 1`,
      args: profile,
    });
  } else {
    await client.execute({
      sql: `INSERT INTO profile (id, age, height, starting_weight, goal_weight, deadline,
        current_phase, phase_start_date, phase_end_date, phase_start_weight, phase_goal_weight)
      VALUES (1, @age, @height, @starting_weight, @goal_weight, @deadline,
        @current_phase, @phase_start_date, @phase_end_date, @phase_start_weight, @phase_goal_weight)`,
      args: profile,
    });
  }
}

// ========== Daily Records ==========

async function getRecordByDate(date) {
  await ensureTables();
  const rs = await client.execute({ sql: 'SELECT * FROM daily_records WHERE date = ?', args: [date] });
  return rs.rows.length > 0 ? rowToObj(rs.rows[0]) : null;
}

async function getRecentRecords(limit = 30) {
  await ensureTables();
  const rs = await client.execute({ sql: 'SELECT * FROM daily_records ORDER BY date DESC LIMIT ?', args: [limit] });
  return rs.rows.map(rowToObj);
}

async function upsertRecord(record) {
  await ensureTables();
  const existing = await getRecordByDate(record.date);
  if (existing) {
    await client.execute({
      sql: `UPDATE daily_records SET
        morning_weight = @morning_weight, sleep_bedtime = @sleep_bedtime,
        sleep_waketime = @sleep_waketime, sleep_interruptions = @sleep_interruptions,
        sleep_energy = @sleep_energy, breakfast = @breakfast, lunch = @lunch,
        dinner = @dinner, snacks = @snacks, breakfast_photo = @breakfast_photo,
        lunch_photo = @lunch_photo, dinner_photo = @dinner_photo,
        exercise_type = @exercise_type, exercise_duration = @exercise_duration,
        exercise_intensity = @exercise_intensity, exercise_steps = @exercise_steps,
        shooting_accuracy = @shooting_accuracy, stress_level = @stress_level,
        water_intake = @water_intake, body_waist = @body_waist, body_knee = @body_knee,
        body_fatigue = @body_fatigue, body_hunger = @body_hunger,
        body_bowel = @body_bowel, self_diet_score = @self_diet_score,
        self_exercise_score = @self_exercise_score
      WHERE date = @date`,
      args: record,
    });
  } else {
    await client.execute({
      sql: `INSERT INTO daily_records (date, morning_weight, sleep_bedtime, sleep_waketime,
        sleep_interruptions, sleep_energy, breakfast, lunch, dinner, snacks,
        breakfast_photo, lunch_photo, dinner_photo, exercise_type, exercise_duration,
        exercise_intensity, exercise_steps, shooting_accuracy, stress_level,
        water_intake, body_waist, body_knee, body_fatigue, body_hunger, body_bowel,
        self_diet_score, self_exercise_score)
      VALUES (@date, @morning_weight, @sleep_bedtime, @sleep_waketime,
        @sleep_interruptions, @sleep_energy, @breakfast, @lunch, @dinner, @snacks,
        @breakfast_photo, @lunch_photo, @dinner_photo, @exercise_type, @exercise_duration,
        @exercise_intensity, @exercise_steps, @shooting_accuracy, @stress_level,
        @water_intake, @body_waist, @body_knee, @body_fatigue, @body_hunger, @body_bowel,
        @self_diet_score, @self_exercise_score)`,
      args: record,
    });
  }
}

async function getStreak() {
  await ensureTables();
  const rs = await client.execute('SELECT date FROM daily_records ORDER BY date DESC');
  const rows = rs.rows.map(rowToObj);
  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];

    if (rows[i].date === expectedStr) {
      streak++;
    } else if (i === 0) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (rows[0].date === yesterdayStr) {
        streak = 1;
        for (let j = 1; j < rows.length; j++) {
          const exp = new Date(yesterday);
          exp.setDate(exp.getDate() - j);
          if (rows[j].date === exp.toISOString().split('T')[0]) {
            streak++;
          } else {
            break;
          }
        }
      }
      break;
    } else {
      break;
    }
  }
  return streak;
}

// ========== Body Composition ==========

async function getBodyCompByDate(date) {
  await ensureTables();
  const rs = await client.execute({ sql: 'SELECT * FROM body_composition WHERE date = ?', args: [date] });
  return rs.rows.length > 0 ? rowToObj(rs.rows[0]) : null;
}

async function upsertBodyComp(data) {
  await ensureTables();
  const existing = await getBodyCompByDate(data.date);
  if (existing) {
    await client.execute({
      sql: `UPDATE body_composition SET
        weight = @weight, body_fat = @body_fat, muscle_mass = @muscle_mass,
        water = @water, bone_mass = @bone_mass, bmi = @bmi, bmr = @bmr,
        visceral_fat = @visceral_fat WHERE date = @date`,
      args: data,
    });
  } else {
    await client.execute({
      sql: `INSERT INTO body_composition (date, weight, body_fat, muscle_mass, water, bone_mass, bmi, bmr, visceral_fat)
      VALUES (@date, @weight, @body_fat, @muscle_mass, @water, @bone_mass, @bmi, @bmr, @visceral_fat)`,
      args: data,
    });
  }
}

// ========== AI Analysis ==========

async function getAnalysisByDate(date) {
  await ensureTables();
  const rs = await client.execute({ sql: 'SELECT * FROM ai_analysis WHERE date = ?', args: [date] });
  return rs.rows.length > 0 ? rowToObj(rs.rows[0]) : null;
}

async function upsertAnalysis(data) {
  await ensureTables();
  const existing = await getAnalysisByDate(data.date);
  if (existing) {
    await client.execute({
      sql: `UPDATE ai_analysis SET
        raw_response = @raw_response, data_summary = @data_summary,
        total_goal_json = @total_goal_json, phase_goal_json = @phase_goal_json,
        judgment = @judgment, suggestions = @suggestions,
        calorie_bill = @calorie_bill, nutrition = @nutrition,
        weight_cause = @weight_cause, highlights = @highlights,
        problems = @problems WHERE date = @date`,
      args: data,
    });
  } else {
    await client.execute({
      sql: `INSERT INTO ai_analysis (date, raw_response, data_summary, total_goal_json, phase_goal_json, judgment, suggestions,
        calorie_bill, nutrition, weight_cause, highlights, problems)
      VALUES (@date, @raw_response, @data_summary, @total_goal_json, @phase_goal_json, @judgment, @suggestions,
        @calorie_bill, @nutrition, @weight_cause, @highlights, @problems)`,
      args: data,
    });
  }
}

module.exports = {
  getProfile,
  upsertProfile,
  getRecordByDate,
  getRecentRecords,
  upsertRecord,
  getStreak,
  getBodyCompByDate,
  upsertBodyComp,
  getAnalysisByDate,
  upsertAnalysis,
};
