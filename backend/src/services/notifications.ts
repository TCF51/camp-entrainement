import cron from "node-cron";
import webpush from "web-push";
import { prisma } from "../lib/prisma";
import { isDueOnDate, toDayStart } from "../utils/recurrence";

// Configure web-push avec les cles VAPID (a generer avec `npm run vapid:generate`)
export function initPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contact@example.com";

  if (!publicKey || !privateKey) {
    console.warn(
      "[push] Cles VAPID manquantes : les notifications push sont desactivees. " +
        "Genere-les avec `npm run vapid:generate` et renseigne .env"
    );
    return;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  console.log("[push] Notifications push configurees.");
}

// Verifie, pour chaque utilisateur, les exercices dus aujourd'hui et pas encore faits,
// puis envoie une notification de rappel groupee.
export async function sendDailyReminders() {
  const today = toDayStart(new Date());

  const programs = await prisma.userProgram.findMany({
    where: { active: true },
    include: { exercise: true, camp: true, user: { include: { subscriptions: true } } },
  });

  const dueByUser = new Map<string, { name: string }[]>();

  for (const program of programs) {
    if (!isDueOnDate(program, today)) continue;

    const alreadyLogged = await prisma.exerciseLog.findUnique({
      where: {
        userId_campId_exerciseId_date: {
          userId: program.userId,
          campId: program.campId,
          exerciseId: program.exerciseId,
          date: today,
        },
      },
    });
    if (alreadyLogged) continue;

    const list = dueByUser.get(program.userId) || [];
    list.push({ name: program.exercise.name });
    dueByUser.set(program.userId, list);
  }

  for (const program of programs) {
    const pending = dueByUser.get(program.userId);
    if (!pending || pending.length === 0) continue;
    const subscriptions = program.user.subscriptions;
    if (subscriptions.length === 0) continue;

    const names = [...new Set(pending.map((p) => p.name))];
    const payload = JSON.stringify({
      title: "N'oublie pas ta seance ! 💪",
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
        // Abonnement expire ou invalide : on le retire
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("[push] Erreur d'envoi :", err.message);
        }
      }
    }
    // On ne renvoie qu'une fois par utilisateur (evite les doublons sur plusieurs programmes)
    dueByUser.delete(program.userId);
  }
}

// Planifie l'envoi quotidien a l'heure configuree (REMINDER_HOUR, defaut 18h, heure serveur)
export function scheduleReminders() {
  const hour = Number(process.env.REMINDER_HOUR ?? 18);
  const cronExpr = `0 ${hour} * * *`;
  cron.schedule(cronExpr, () => {
    sendDailyReminders().catch((err) => console.error("[push] Erreur lors de l'envoi des rappels :", err));
  });
  console.log(`[push] Rappels quotidiens planifies a ${hour}h (heure serveur).`);
}
