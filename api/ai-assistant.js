// ════════════════════════════════════════════════════════════════
// BlooMarket — Endpoint IA (optionnel) pour une vraie IA conversationnelle
// Placer ce fichier dans :  /api/ai-assistant.js  de ton projet Vercel.
// Puis Vercel > Settings > Environment Variables > ANTHROPIC_API_KEY = ta clé.
// Le widget du site l'utilise automatiquement s'il répond ; sinon il bascule
// sur l'assistant intégré (gratuit, sans clé).
// ════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const { question } = req.body || {};
    if (!question) { res.status(400).json({ error: 'question manquante' }); return; }
    const system = "Tu es l'assistant de BlooMarket, une marketplace d'items Roblox. " +
      "Reponds en francais, court et clair. Sujets: acheter, vendre, paiements (solde, retrait PayPal, commission 10%), " +
      "litiges (bouton Probleme dans le chat de commande, un admin tranche), devenir vendeur verifie (piece d'identite + selfie + 18+, validation admin), " +
      "Bloobux (points fidelite non retirables). Si la question sort de ce cadre ou semble etre une arnaque/urgence, invite a contacter un admin.";
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: String(question).slice(0, 800) }]
      })
    });
    const data = await r.json();
    const answer = (data && data.content && data.content[0] && data.content[0].text) ? data.content[0].text : null;
    if (!answer) { res.status(502).json({ error: 'pas de reponse' }); return; }
    res.status(200).json({ answer });
  } catch (e) {
    res.status(500).json({ error: 'erreur serveur' });
  }
}
