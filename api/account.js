import { odooAuth, odooCall } from '../lib/odoo.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.body.action === 'update') return await updateAccount(req, res);
    return await fetchAccount(req, res); 
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function fetchAccount(req, res) {
  const { customerName } = req.body;
  if (!customerName) return res.status(400).json({ error: 'customerName is required' });

  const { ODOO_URL, sessionId } = await odooAuth();

  const partnerRes = await odooCall(ODOO_URL, sessionId, 'res.partner', 'search_read',
    [[['name', 'ilike', customerName]]],
    { fields: ['id', 'name', 'email', 'phone', 'mobile', 'street', 'street2', 'city', 'country_id', 'vat'], limit: 1 });

  const partner = partnerRes.result?.[0];
  if (!partner) return res.status(200).json({ found: false });

  return res.status(200).json({
    found: true,
    account: {
      id: partner.id,
      name: partner.name,
      email: partner.email || '',
      phone: partner.phone || '',
      mobile: partner.mobile || '',
      street: partner.street || '',
      street2: partner.street2 || '',
      city: partner.city || '',
      country: partner.country_id ? partner.country_id[1] : '',
      vat: partner.vat || ''
    }
  });
}

async function updateAccount(req, res) {
  const { partnerId, phone, mobile, street, street2, city } = req.body;
  if (!partnerId) return res.status(400).json({ error: 'partnerId is required' });

  const { ODOO_URL, sessionId } = await odooAuth();

  const writeData = await odooCall(ODOO_URL, sessionId, 'res.partner', 'write',
    [[partnerId], { phone, mobile, street, street2, city }]);

  if (!writeData.result) return res.status(500).json({ error: 'Update failed', details: writeData });

  return res.status(200).json({ success: true, message: 'Account details updated.' });
}
