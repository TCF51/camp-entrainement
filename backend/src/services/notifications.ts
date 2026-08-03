import cron from "node-cron";
import webpush from "web-push";
import { prisma } from "../lib/prisma";
import { isDueOnDate, toDayStart, weekStart } from "../utils/recurrence";

// Configure web-push avec les clés VAPID (à générer avec `npm run vapid:generate`)
export function initPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contact@example.com";

  if (!publicKey || !privateKey) {
    console.warn(
      "[push] Clés VAPID manquantes : les notifications push sont désactivées. " +
        "Génère-les avec `npm run vapid:generate` et renseigne .env"
    );
    return;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  console.log("[push] Notifications push configurées.");
}

// Vérifie, pour chaque utilisateur, les exercices dus aujourd'hui (selon la consigne du camp)
// et pas encore faits, puis envoie une notification de rappel groupée.
export async function sendDailyReminders() {
  const today = toDayStart(new Date());
  const weekStartDate = weekStart(today);

  const memberships = await prisma.campMembership.findMany({
    include: {
      user: { include: { subscriptions: true } },
      camp: { include: { exercises: { include: { exercise: true } } } },
    },
  });

  const dueByUser = new Map<string, { name: string }[]>();

  for (const membership of memberships) {
    const { camp, userId } = membership;
    if (camp.startDate && today.getTime() < toDayStart(camp.startDate).getTime()) continue;
    if (camp.endDate && today.getTime() > toDayStart(camp.endDate).getTime()) continue;

    for (const ce of camp.exercises) {
      if (!isDueOnDate(ce, today)) continue;

      const alreadyLogged = await prisma.exerciseLog.findUnique({
        where: {
          userId_campId_exerciseId_date: {
            userId,
            campId: ce.campId,
            exerciseId: ce.exerciseId,
            date: today,
          },
        },
      });
      if (alreadyLogged) continue;

      // Pour "X fois par semaine, n'importe quel jour" : pas de rappel si le quota
      // hebdomadaire est déjà atteint par un autre jour de la semaine.
      if (ce.recurrenceType === "WEEKLY_COUNT" && ce.timesPerWeek) {
        const weekCount = await prisma.exerciseLog.count({
          where: { userId, campId: ce.campId, exerciseId: ce.exerciseId, date: { gte: weekStartDate, lte: today } },
        });
        if (weekCount >= ce.timesPerWeek) continue;
      }

      const list = dueByUser.get(userId) || [];
      list.push({ name: ce.exercise.name });
      dueByUser.set(userId, list);
    }
  }

  const subscriptionsByUser = new Map(memberships.map((m) => [m.userId, m.user.subscriptions]));

  for (const [userId, pending] of dueByUser) {
    if (pending.length === 0) continue;
    const subscriptions = subscriptionsByUser.get(userId) ?? [];
    if (subscriptions.length === 0) continue;

    const names = [...new Set(pending.map((p) => p.name))];
    const payload = JSON.stringify({
      title: "C'est le moment de faire votre séance ! 💪",
      body:
        names.length === 1
          ? `${names[0]} t'attend aujourd'hui.`
          : `${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""} t'attendent aujourd'hui.`,
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: any) {
        // Abonnement expiré ou invalide : on le retire
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("[push] Erreur d'envoi :", err.message);
        }
      }
    }
  }
}

// Planifie l'envoi quotidien à l'heure configurée (REMINDER_HOUR, défaut 18h, heure serveur)
export function scheduleReminders() {
  const hour = Number(process.env.REMINDER_HOUR ?? 18);
  const cronExpr = `0 ${hour} * * *`;
  cron.schedule(cronExpr, () => {
    sendDailyReminders().catch((err) => console.error("[push] Erreur lors de l'envoi des rappels :", err));
  });
  console.log(`[push] Rappels quotidiens planifiés à ${hour}h (heure serveur).`);
}

// Envoie une notification à UN utilisateur précis (tous ses appareils abonnés), avec un
// titre/corps libres. Utilisé pour prévenir d'un nouveau message (camp ou privé).
export async function sendPushToUser(userId: string, title: string, body: string) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  const payload = JSON.stringify({ title, body });
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error("[push] Erreur d'envoi :", err.message);
      }
    }
  }
}
