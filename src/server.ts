import app from "./app";
import { testConnection } from "./config/database";

const PORT = Number(process.env.PORT) || 3000; // ← Conversion en number
const HOST = "0.0.0.0";

const startServer = async () => {
  const dbConnected = await testConnection();

  if (!dbConnected) {
    console.error("❌ Failed to connect to database. Exiting...");
    process.exit(1);
  }

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    console.log(`📱 Mobile access: http://192.168.1.36:${PORT}`);
  });
};

startServer();
