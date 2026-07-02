// ═══════════════════════════════════════════════════════════════
// BLOOMARKET — Création du PaymentIntent (Vercel)
// EMPLACEMENT :  api/create-payment.js
//
// Variables d'environnement Vercel requises :
//   STRIPE_SECRET_KEY = sk_live_xxx  (ou sk_test_xxx)
//   SITE_ORIGIN       = https://bloomarket.fr   ← ton domaine exact
//
// ⚠️ Ce fichier ne fait QUE créer l'intention de paiement.
//    Le crédit du solde / la création des commandes se fait dans
//    api/stripe-webhook.js après confirmation réelle du paiement.
// ═══════════════════════════════════════════════════════════════

const MAX_EUR = 2000; // plafond par transaction — ajuste si besoin

module.exports = async (req, res) => {
  const origin = process.env.SITE_ORIGIN || '*';
  res.setHeader('Content-Type', 'application/json');
  // CORS restreint à ton domaine (plus de '*' : évite que d'autres
  // sites créent des paiements via ton endpoint)
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
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

    // ── Validation stricte du montant ──────────────────────────
    const amount = Number(body.amount);
    if (!Number.isFinite(amount)) return res.status(400).json({ error: 'Montant invalide' });
    const cents = Math.round(amount * 100);
    if (cents < 50)               return res.status(400).json({ error: 'Montant minimum : 0,50 €' });
    if (cents > MAX_EUR * 100)    return res.status(400).json({ error: 'Montant maximum : ' + MAX_EUR + ' €' });

    // ── Validation du type d'opération ─────────────────────────
    const kind = body.kind === 'topup' ? 'topup' : 'order';
    if (kind === 'topup' && !body.userId)  return res.status(400).json({ error: 'userId requis pour une recharge' });
    if (kind === 'order' && !body.buyerId) return res.status(400).json({ error: 'buyerId requis pour une commande' });

    const p = new URLSearchParams();
    p.append('amount', String(cents));
    p.append('currency', 'eur');
    p.append('automatic_payment_methods[enabled]', 'true');
    p.append('metadata[kind]', kind);
    // ⚠️ Ces metadata sont la SOURCE DE VÉRITÉ pour le webhook.
    if (body.userId)     p.append('metadata[userId]', String(body.userId).slice(0, 64));
    if (body.buyerId)    p.append('metadata[buyerId]', String(body.buyerId).slice(0, 64));
    if (body.listingIds) p.append('metadata[listingIds]', String(body.listingIds).slice(0, 480)); // limite Stripe : 500 chars/valeur

    const r = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Idempotence : évite les doubles PaymentIntents si le client re-tente
        'Idempotency-Key': (body.idempotencyKey ? String(body.idempotencyKey).slice(0, 255) : ('bm_' + Date.now() + '_' + Math.random().toString(36).slice(2)))
      },
      body: p.toString()
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: (data.error && data.error.message) || 'Erreur Stripe' });

    return res.status(200).json({ clientSecret: data.client_secret });
  } catch (err) {
    console.error('create-payment error:', err);
    return res.status(500).json({ error: 'Erreur serveur' }); // ne pas exposer err.message au client
  }
};
