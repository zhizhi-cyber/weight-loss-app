export default async function handler(req, res) {
  const results = {};

  // Test 1: public API
  try {
    const r = await fetch('https://httpbin.org/get');
    results.public = { ok: r.ok, status: r.status };
  } catch (e) {
    results.public = { error: e.message, cause: e.cause?.message };
  }

  // Test 2: DeepSeek
  try {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
    });
    const d = await r.json();
    results.deepseek = { ok: r.ok, status: r.status, msg: d.choices?.[0]?.message?.content };
  } catch (e) {
    results.deepseek = { error: e.message, cause: e.cause?.message, stack: e.stack?.slice(0, 200) };
  }

  // Test 3: env var check
  results.hasKey = !!process.env.DEEPSEEK_API_KEY;
  results.hasUrl = !!process.env.TURSO_DB_URL;

  res.json(results);
}
