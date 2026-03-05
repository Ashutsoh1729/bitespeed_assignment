import { drizzle } from "drizzle-orm/neon-http";
import { Config } from "../config";

export const db = drizzle(Config.DatabaseUrl!);
