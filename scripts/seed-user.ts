import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db/client";
import { users } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: npm run seed:user -- <email> <password>");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    await db.update(users).set({ passwordHash }).where(eq(users.email, email));
    console.log(`Updated password for ${email}`);
  } else {
    await db.insert(users).values({ email, passwordHash });
    console.log(`Created user ${email}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
