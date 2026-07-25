import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import exerciseRoutes from "./routes/exercises";
import campRoutes from "./routes/camps";
import programRoutes from "./routes/programs";
import todayRoutes from "./routes/today";
import logRoutes from "./routes/logs";
import progressRoutes from "./routes/progress";
import pushRoutes from "./routes/push";
import badgeRoutes from "./routes/badges";
import { initPush, scheduleReminders } from "./services/notifications";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/camps", campRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/today", todayRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/badges", badgeRoutes);

// Gestion d'erreur generique (evite qu'une exception fasse planter le process)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

const port = Number(process.env.PORT || 4000);

initPush();
scheduleReminders();

app.listen(port, () => {
  console.log(`API demarree sur http://localhost:${port}`);
});
