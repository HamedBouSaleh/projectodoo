
export async function odooAuth() {
  const ODOO_URL = process.env.ODOO_URL;
  const DB = process.env.DB;
  const LOGIN = process.env.LOGIN;
  const PASSWORD = process.env.PASSWORD;

  const loginRes = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: DB, login: LOGIN, password: PASSWORD }
    })
  });
  const loginData = await loginRes.json();
  const sessionId = loginData.result?.session_id;
  if (!sessionId) throw new Error('Odoo login failed');
  return { ODOO_URL, sessionId };
}

export async function odooCall(ODOO_URL, sessionId, model, method, args, kwargs = {}) {
  const res = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: 1
    })
  });
  return res.json();
}
