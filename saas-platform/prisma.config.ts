import "dotenv/config";
import { defineConfig } from "prisma/config";
import path from "path";

const DEFAULT_SQLITE = `file:${path.join(process.cwd(), "prisma", "dev.db")}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // For Turso: embed authToken in URL so prisma migrate deploy can authenticate
    url: (() => {
      const base = process.env["DATABASE_URL"] ?? DEFAULT_SQLITE;
      const token = process.env["TURSO_AUTH_TOKEN"];
      return (base.startsWith("libsql://") && token)
        ? `${base}?authToken=${token}`
        : base;
    })(),
  },
});
