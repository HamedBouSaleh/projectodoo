export default async function handler(req, res) { 
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
if (req.method === 'OPTIONS') { 
return res.status(200).end(); }
const { orderNumber } = req.body;
if (!orderNumber) {
return res.status(400).json({ error: 'orderNumber is required' });
} 
const odooUrl = 'https://transmed-cx-staging-h-34608506.dev.odoo.com/web/dataset/call_kw'; const credentials = 'aGFtZWQuYm91c2FsZWhAdHJhbnNtZWQuY29tOjg0YWJkZWZlYjg2NTFiYmUxNDU0MzUwYjNhMDk5NmQyNWQ3M2JiYzA=';
try {
const response = await fetch(odooUrl, {
method: 'POST', headers: { 
'Content-Type': 'application/json', 'Authorization': `Basic ${credentials}` 
},
body: JSON.stringify({ jsonrpc: '2.0', 
method: 'call',
params: {
model: 'sale.order',
method: 'search_read', 
args: [[['name', '=', orderNumber]]],
kwargs: {
fields: ['name', 'state', 'amount_total', 'date_order', 'partner_id'], 
limit: 1 
} 
},
id: 1 
}) 
});
const data = await response.json(); 
const orders = data.result; 
if (!orders || orders.length === 0){ 
return res.status(200).json({
found: false,
message: `No order found with number ${orderNumber}`
});
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
} catch (error) { 
return res.status(500).json({ error: 'Failed to fetch order data' });
} 
} 
