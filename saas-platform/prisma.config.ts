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
    url: process.env["DATABASE_URL"] ?? DEFAULT_SQLITE,
  },
});
