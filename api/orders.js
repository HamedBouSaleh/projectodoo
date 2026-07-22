import { odooAuth, odooCall } from '../odoo.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.body.action === 'detail') return await orderDetail(req, res);
    if (req.body.action === 'lines') return await orderLines(req, res);
    return await listOrders(req, res); // default — matches existing customer-orders callers
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function listOrders(req, res) {
  const { customerName } = req.body;
  if (!customerName) return res.status(400).json({ error: 'customerName is required' });

  const { ODOO_URL, sessionId } = await odooAuth();

  const ordersData = await odooCall(ODOO_URL, sessionId, 'sale.order', 'search_read',
    [[['partner_id.name', 'ilike', customerName]]],
    { fields: ['name', 'state', 'amount_total', 'date_order'], order: 'date_order desc', limit: 1000 });

  const orders = ordersData.result;
  if (!orders || orders.length === 0) {
    return res.status(200).json({ found: false, message: `No orders found for customer ${customerName}` });
  }

  const statusMap = {
    draft: 'Quotation', sent: 'Quotation Sent',
    sale: 'Order Confirmed', done: 'Delivered', cancel: 'Cancelled'
  };
  const totalSpend = orders.reduce((sum, o) => sum + o.amount_total, 0);

  return res.status(200).json({
    found: true,
    customerName,
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
}

async function orderDetail(req, res) {
  const { orderNumber } = req.body;
  if (!orderNumber) return res.status(400).json({ error: 'orderNumber is required' });

  const { ODOO_URL, sessionId } = await odooAuth();

  const orderData = await odooCall(ODOO_URL, sessionId, 'sale.order', 'search_read',
    [[['name', '=', orderNumber]]],
    { fields: ['name', 'state', 'amount_total', 'date_order', 'partner_id'], limit: 1 });

  const orders = orderData.result;
  if (!orders || orders.length === 0) {
    return res.status(200).json({ found: false, message: `No order found with number ${orderNumber}` });
  }

  const order = orders[0];
  return res.status(200).json({
    found: true,
    orderName: order.name,
    status: order.state,
    totalAmount: order.amount_total,
    orderDate: order.date_order,
    customerName: order.partner_id[1]
  });
}

async function orderLines(req, res) {
  const { orderNumber } = req.body;
  if (!orderNumber) return res.status(400).json({ error: 'orderNumber is required' });

  const { ODOO_URL, sessionId } = await odooAuth();

  const orderData = await odooCall(ODOO_URL, sessionId, 'sale.order', 'search_read',
    [[['name', '=', orderNumber]]],
    { fields: ['id', 'name', 'partner_id', 'amount_total', 'state'], limit: 1 });

  const orders = orderData.result;
  if (!orders || orders.length === 0) {
    return res.status(200).json({ found: false, message: `No order found with number ${orderNumber}` });
  }
  const order = orders[0];

  const linesData = await odooCall(ODOO_URL, sessionId, 'sale.order.line', 'search_read',
    [[['order_id', '=', order.id]]],
    { fields: ['product_id', 'product_uom_qty', 'price_unit', 'price_subtotal'] });

  return res.status(200).json({
    found: true,
    orderName: order.name,
    lines: (linesData.result || []).map(l => ({
      productName: l.product_id ? l.product_id[1] : 'Unknown item',
      quantity: l.product_uom_qty,
      unitPrice: l.price_unit,
      subtotal: l.price_subtotal
    }))
  });
}
