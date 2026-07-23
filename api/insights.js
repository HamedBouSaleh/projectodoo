async function odooAuth() {
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
  if (!sessionId) throw new Error('Odoo login failed: ' + JSON.stringify(loginData));
  return { ODOO_URL, sessionId };
}

async function odooCall(ODOO_URL, sessionId, model, method, args, kwargs = {}) {
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.body || {};

  try {
    if (body.action === 'company') return await companyTopItems(body, res);
    return await customerTopItems(body, res);
  } catch (error) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}

async function customerTopItems(body, res) {
  const { customerName, limit } = body;
  if (!customerName) return res.status(400).json({ error: 'customerName is required' });

  const { ODOO_URL, sessionId } = await odooAuth();

  const groupData = await odooCall(ODOO_URL, sessionId, 'sale.order.line', 'read_group', [
    [
      ['order_id.partner_id.name', 'ilike', customerName],
      ['order_id.state', '!=', 'cancel'],
      ['product_id', '!=', false]
    ],
    ['product_uom_qty:sum'],
    ['product_id']
  ], { orderby: 'product_uom_qty desc', limit: limit || 5 });

  const groups = groupData.result;
  if (!groups) return res.status(200).json({ found: false, debug: groupData });
  if (groups.length === 0) return res.status(200).json({ found: false, debug: { note: 'zero matching rows' } });

  return res.status(200).json({
    found: true,
    items: groups.map(g => ({ productName: g.product_id ? g.product_id[1] : 'Unknown item', quantity: g.product_uom_qty }))
  });
}

async function companyTopItems(body, res) {
  const { ODOO_URL, sessionId } = await odooAuth();

  const groupData = await odooCall(ODOO_URL, sessionId, 'sale.order.line', 'read_group', [
    [
      ['order_id.state', '!=', 'cancel'],
      ['product_id', '!=', false]
    ],
    ['product_uom_qty:sum'],
    ['product_id']
  ], { orderby: 'product_uom_qty desc', limit: 5 });

  const groups = groupData.result;
  if (!groups) return res.status(200).json({ found: false, debug: groupData });
  if (groups.length === 0) return res.status(200).json({ found: false, debug: { note: 'zero matching rows' } });

  return res.status(200).json({
    found: true,
    items: groups.map(g => ({ productName: g.product_id ? g.product_id[1] : 'Unknown item', quantity: g.product_uom_qty }))
  });
}
  return res.status(200).json({
    found: true,
    items: groups.map(g => ({ productName: g.product_id ? g.product_id[1] : 'Unknown item', quantity: g.product_uom_qty }))
  });
}
