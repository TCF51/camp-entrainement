import { api } from "../api/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Demande la permission de notification et enregistre l'abonnement push aupres du serveur.
// Renvoie un message de statut a afficher a l'utilisateur.
export async function enablePushNotifications(): Promise<string> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "Les notifications push ne sont pas supportees par ce navigateur.";
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return "Permission refusee : tu peux l'activer plus tard dans les reglages du navigateur.";
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  const { publicKey } = await api.get<{ publicKey: string }>("/push/vapid-public-key");
  if (!publicKey) {
    return "Le serveur n'a pas encore configure les cles de notification (VAPID).";
  }

  const applicationServerKey = urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  const json = subscription.toJSON();
  await api.post("/push/subscribe", {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
  });

  return "Notifications activees ! Tu recevras un rappel les jours ou une seance est prevue.";
}
