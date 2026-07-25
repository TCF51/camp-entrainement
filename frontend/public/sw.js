// Service worker minimal : recoit les notifications push envoyees par le serveur
// et les affiche, meme quand l'onglet de l'application est ferme.

self.addEventListener("push", (event) => {
  let data = { title: "Camp d'Entrainement", body: "N'oublie pas ta seance !" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    // si le payload n'est pas du JSON, on garde le message par defaut
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.png",
      badge: "/icon.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
