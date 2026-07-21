export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { orderNumber } = req.body;
  if (!orderNumber) return res.status(400).json({ error: 'orderNumber is required' });

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

    // First get the order ID
    const orderRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
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
          args: [[['name', '=', orderNumber]]],
          kwargs: {
            fields: ['id', 'name', 'partner_id', 'amount_total', 'state'],
            limit: 1
          }
        },
        id: 1
      })
    });

    const orderData = await orderRes.json();
    const orders = orderData.result;

    if (!orders || orders.length === 0) {
      return res.status(200).json({
        found: false,
        message: `No order found with number ${orderNumber}`
      });
    }

    const order = orders[0];

    // Now get order lines
    const linesRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'sale.order.line',
          method: 'search_read',
          args: [[['order_id', '=', order.id]]],
          kwargs: {
            fields: ['product_id', 'product_uom_qty', 'price_unit', 'price_subtotal', 'product_uom'],
            limit: 50
          }
        },
        id: 2
      })
    });

    const linesData = await linesRes.json();
    const lines = linesData.result;

    const statusMap = {
      'draft': 'Quotation',
      'sent': 'Quotation Sent',
      'sale': 'Order Confirmed',
      'done': 'Delivered',
      'cancel': 'Cancelled'
    };

    return res.status(200).json({
      found: true,
      orderNumber: order.name,
      customer: order.partner_id[1],
      status: statusMap[order.state] || order.state,
      totalAmount: order.amount_total,
      totalItems: lines.length,
      products: lines.map(l => ({
        product: l.product_id[1],
        quantity: l.product_uom_qty,
        unit: l.product_uom[1],
        unitPrice: l.price_unit,
        subtotal: l.price_subtotal
      }))
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
