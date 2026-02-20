import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 8080),
  sqlitePath: process.env.SQLITE_PATH ?? "./backend/data/app.db",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173"
};
