import { logger } from "@/helpers/index.ts";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../../config.ts";
import * as schema from "../../schema.ts";

const pool = new pg.Pool({
  host: config.db_host,
  port: config.db_port,
  user: config.db_user,
  password: config.db_password,
  database: config.db_name,
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS) || 30000,
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS) || 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: Number(process.env.PG_KEEPALIVE_INITIAL_DELAY_MS) || 10000
});

pool.on("error", (err) => {
  // Prevent process crash on idle client socket errors by handling pool-level events.
  logger.error({ msg: "database pool idle client error", error: err });
});

pool
  .query("SELECT 1")
  .then(() => {
    logger.info("database pool initialized");
  })
  .catch((err) => {
    logger.error({ msg: "database initial connection error", error: err });
    process.exit(1);
  });

export const db = drizzle(pool, { schema });
export const dbPool = pool;

export async function closeDbPool(): Promise<void> {
  await pool.end();
}
