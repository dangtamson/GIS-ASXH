import { logger } from "../src/helpers/index.ts";
import pg from "pg";
import { config } from "../src/config.ts";

const pool = new pg.Pool({
    host: config.db_host,
    port: config.db_port,
    user: config.db_user,
    password: config.db_password,
    database: config.db_name,
    connectionTimeoutMillis: 10000
});

async function checkTables() {
    try {
        logger.info("Connecting to database...");

        // Test connection
        const result = await pool.query("SELECT version()");
        logger.info(`Connected to: ${result.rows[0].version.split(",")[0]}`);

        // Check for the 4 tables
        const tableNames = [
            "notifications",
            "task_notifications",
            "user_notifications",
            "notification_jobs"
        ];

        console.log("\n=== TABLE EXISTENCE CHECK ===\n");

        for (const tableName of tableNames) {
            const checkQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        );
      `;
            const exists = await pool.query(checkQuery, [tableName]);
            const status = exists.rows[0].exists ? "✅ EXISTS" : "❌ MISSING";
            console.log(`${tableName.padEnd(25)} ${status}`);
        }

        // Get detailed info for existing tables
        console.log("\n=== DETAILED TABLE INFO ===\n");

        for (const tableName of tableNames) {
            const checkQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        );
      `;
            const exists = await pool.query(checkQuery, [tableName]);

            if (!exists.rows[0].exists) {
                continue;
            }

            console.log(`\n📋 Table: ${tableName}`);
            console.log("---");

            // Get columns
            const colQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `;
            const cols = await pool.query(colQuery, [tableName]);
            console.log("Columns:");
            cols.rows.forEach((col) => {
                const nullable = col.is_nullable === "YES" ? "NULL" : "NOT NULL";
                const def = col.column_default ? ` DEFAULT ${col.column_default}` : "";
                console.log(
                    `  - ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} ${nullable}${def}`
                );
            });

            // Get indexes
            const idxQuery = `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = $1;
      `;
            const indexes = await pool.query(idxQuery, [tableName]);
            if (indexes.rows.length > 0) {
                console.log("Indexes:");
                indexes.rows.forEach((idx) => {
                    console.log(`  - ${idx.indexname}`);
                });
            }

            // Get row count
            const countQuery = `SELECT COUNT(*) as count FROM ${tableName};`;
            const count = await pool.query(countQuery);
            console.log(`Row count: ${count.rows[0].count}`);

            // Get sample rows (first 3)
            const sampleQuery = `SELECT * FROM ${tableName} LIMIT 3;`;
            const sample = await pool.query(sampleQuery);
            if (sample.rows.length > 0) {
                console.log(`Sample rows (${sample.rows.length}):`);
                console.log(JSON.stringify(sample.rows, null, 2));
            }
        }

        console.log("\n✅ Database check completed\n");
        process.exit(0);
    } catch (error) {
        logger.error({ msg: "Database check failed", error });
        console.error("\n❌ Error:", error instanceof Error ? error.message : error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkTables();
