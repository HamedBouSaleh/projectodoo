import { odooAuth, odooCall } from '../odoo.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if ((req.body||{}).action === 'change-password') return await changePassword(req, res);
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

async function changePassword(req, res) {
  const { partnerId, currentPassword, newPassword } = req.body;
  if (!partnerId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'partnerId, currentPassword and newPassword are required' });
  }

  const { ODOO_URL, sessionId } = await odooAuth();

  const userLookup = await odooCall(ODOO_URL, sessionId, 'res.users', 'search_read',
    [[['partner_id', '=', partnerId]]], { fields: ['id', 'login'], limit: 1 });
  const odooUser = userLookup.result?.[0];
  if (!odooUser) {
    return res.status(404).json({ error: 'No linked login found for this account' });
  }


  const verifyRes = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: process.env.DB, login: odooUser.login, password: currentPassword }
    })
  });
  const verifyData = await verifyRes.json();
  if (!verifyData.result?.session_id) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const writeData = await odooCall(ODOO_URL, sessionId, 'res.users', 'write',
    [[odooUser.id], { password: newPassword }]);
  if (!writeData.result) {
    return res.status(500).json({ error: 'Password update failed', details: writeData });
  }

  return res.status(200).json({ success: true });
}
