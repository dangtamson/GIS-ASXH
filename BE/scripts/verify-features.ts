import { db } from "../src/services/db/drizzle.ts";
import { features } from "../src/schema.ts";
import { count } from "drizzle-orm";

async function verifyFeatures() {
    try {
        const result = await db.select({ total: count() }).from(features);
        console.log("✅ Total features:", result[0]?.total);

        const byGroup = await db
            .select({
                groupName: features.groupName,
                count: count(),
            })
            .from(features)
            .groupBy(features.groupName);

        console.log("\n📊 Features by group:");
        byGroup.forEach((g) => {
            const bar = "█".repeat(g.count || 0);
            console.log(
                `  ${String(g.groupName).padEnd(12)} : ${bar} (${g.count})`
            );
        });

        // Show sample icons
        const sampleFeatures = await db
            .select({
                name: features.name,
                icon: features.icon,
                path: features.path,
            })
            .from(features)
            .limit(5);

        console.log("\n🎨 Sample features with icons:");
        sampleFeatures.forEach((f) => {
            console.log(`  - ${f.name} → ${f.icon} (${f.path})`);
        });

        process.exit(0);
    } catch (error) {
        console.error("❌ Verification failed:", error);
        process.exit(1);
    }
}

void verifyFeatures();
