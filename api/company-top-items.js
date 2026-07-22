export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ODOO_URL = process.env.ODOO_URL;
  const DB = process.env.DB;
  const LOGIN = process.env.LOGIN;
  const PASSWORD = process.env.PASSWORD;

  try {
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
    if (!sessionId) return res.status(401).json({ error: 'Login failed' });

    // Same aggregation as customer-top-items.js but with no partner
    // filter — company-wide best sellers across confirmed orders.
    const groupRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'sale.order.line',
          method: 'read_group',
          args: [
            [
              ['order_id.state', 'in', ['sale', 'done']],
              ['product_id', '!=', false]
            ],
            ['product_uom_qty:sum'],
            ['product_id']
          ],
          kwargs: { orderby: 'product_uom_qty desc', limit: 5 }
        },
        id: 1
      })
    });
    const groupData = await groupRes.json();
    const groups = groupData.result;

    if (!groups || groups.length === 0) {
      return res.status(200).json({ found: false });
    }

    return res.status(200).json({
      found: true,
      items: groups.map(g => ({
        productName: g.product_id ? g.product_id[1] : 'Unknown item',
        quantity: g.product_uom_qty
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
