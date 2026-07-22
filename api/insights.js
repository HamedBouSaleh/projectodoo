import { odooAuth, odooCall } from '../odoo.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.body.action === 'company') return await companyTopItems(req, res);
    return await customerTopItems(req, res); // default
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function customerTopItems(req, res) {
  const { customerName } = req.body;
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
  ], { orderby: 'product_uom_qty desc', limit: 5 });

  const groups = groupData.result;
  if (!groups || groups.length === 0) return res.status(200).json({ found: false });

  return res.status(200).json({
    found: true,
    items: groups.map(g => ({ productName: g.product_id ? g.product_id[1] : 'Unknown item', quantity: g.product_uom_qty }))
  });
}

async function companyTopItems(req, res) {
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
  if (!groups || groups.length === 0) return res.status(200).json({ found: false });

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
