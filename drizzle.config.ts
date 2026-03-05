import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./src/db/migrations",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // we are using direnv in local enviroment
    url: process.env.DATABASE_URL!,
  },
});
