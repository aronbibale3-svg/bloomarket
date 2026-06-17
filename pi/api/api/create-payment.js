// ═══════════════════════════════════════════════════════════════
// BLOOMARKET — Fonction de paiement (Vercel)
// EMPLACEMENT OBLIGATOIRE :  api/create-payment.js   (à la RACINE)
// → doit être joignable sur  https://TON-SITE/api/create-payment
//
// Active : Carte (Visa/MC/Amex), Apple Pay, Google Pay, PayPal*
// (*PayPal doit être activé dans Stripe → Settings → Payment methods)
//
// VARIABLE À AJOUTER sur Vercel (Settings → Environment Variables) :
//   STRIPE_SECRET_KEY = sk_live_xxx   (ou sk_test_xxx pour tester)
// Aucune autre dépendance n'est requise.
// ═══════════════════════════════════════════════════════════════

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return res.status(500).json({ error: 'STRIPE_SECRET_KEY manquante sur Vercel' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    const cents = Math.round(parseFloat(body.amount) * 100);
    if (!cents || cents < 50) return res.status(400).json({ error: 'Montant invalide (min 0,50 €)' });

    const p = new URLSearchParams();
    p.append('amount', String(cents));
    p.append('currency', 'eur');
    // active automatiquement Carte + Apple Pay + Google Pay + PayPal (si activés dans Stripe)
    p.append('automatic_payment_methods[enabled]', 'true');
    p.append('metadata[kind]', body.kind || 'order');
    if (body.buyerId)    p.append('metadata[buyerId]', String(body.buyerId));
    if (body.userId)     p.append('metadata[userId]', String(body.userId));
    if (body.listingIds) p.append('metadata[listingIds]', String(body.listingIds));

    const r = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: p.toString()
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: (data.error && data.error.message) || 'Erreur Stripe' });

    return res.status(200).json({ clientSecret: data.client_secret });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
};
