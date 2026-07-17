export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { customerName } = req.body;
  if (!customerName) return res.status(400).json({ error: 'customerName is required' });

  const ODOO_URL = 'https://transmed-cx-staging-h-34608506.dev.odoo.com';
  const DB = 'transmed-cx-staging-h-34608506';
  const LOGIN = 'hamed.bousaleh@transmed.com';
  const PASSWORD = 'Hamed@2026';

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

    const ordersRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'sale.order',
          method: 'search_read',
          args: [[['partner_id.name', 'ilike', customerName]]],
          kwargs: {
            fields: ['name', 'state', 'amount_total', 'date_order'],
            order: 'date_order desc',
            limit: 1000
          }
        },
        id: 1
      })
    });

    const ordersData = await ordersRes.json();
    const orders = ordersData.result;

    if (!orders || orders.length === 0) {
      return res.status(200).json({
        found: false,
        message: `No orders found for customer ${customerName}`
      });
    }

    const statusMap = {
      'draft': 'Quotation',
      'sent': 'Quotation Sent',
      'sale': 'Order Confirmed',
      'done': 'Delivered',
      'cancel': 'Cancelled'
    };

    const totalSpend = orders.reduce((sum, o) => sum + o.amount_total, 0);

    return res.status(200).json({
      found: true,
      customerName: customerName,
      totalOrders: orders.length,
      totalSpend: totalSpend.toFixed(2),
      currency: 'AED',
      orders: orders.map(o => ({
        orderNumber: o.name,
        status: statusMap[o.state] || o.state,
        amount: o.amount_total,
        date: o.date_order
      }))
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
