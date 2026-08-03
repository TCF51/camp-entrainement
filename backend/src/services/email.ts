// Envoi d'email minimal. Utilisé Resend (https://resend.com, offre gratuite suffisante pour
// un usage personnel) si RESEND_API_KEY est configuree dans les variables d'environnement.
// Sinon, affiche simplement le contenu dans les logs du serveur (pratique en developpement,
// mais insuffisant en production reelle : pense a configurer RESEND_API_KEY sur Railway).
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "GoTeam <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY non configuree : email non envoye, contenu affiche ci-dessous.\n` +
        `[email] A: ${to}\n[email] Sujet: ${subject}\n[email] Corps:\n${text}`
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email] Echec de l'envoi via Resend :", res.status, body);
    }
  } catch (err) {
    console.error("[email] Erreur lors de l'envoi :", err);
  }
}
