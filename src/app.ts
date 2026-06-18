import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import ridesRoutes from "./routes/rides";
import poisRoutes from "./routes/pois";
import achievementsRoutes from "./routes/achievements";
import socialRoutes from "./routes/social";

dotenv.config();

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "RoadQuest API",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/rides", ridesRoutes);
app.use("/api/pois", poisRoutes);
app.use("/api/achievements", achievementsRoutes);
app.use("/api/social", socialRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

export default app;
