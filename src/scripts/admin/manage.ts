import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hash } from "@node-rs/argon2";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { adminSessions, auditLogs, users } from "@/db/schema";
import { loginSchema } from "@/lib/validation/forms";

const args = process.argv.slice(2);
const command = args[0];
const named = (key: string) => {
  const index = args.indexOf(`--${key}`);
  return index >= 0 ? args[index + 1] : undefined;
};

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  async function secret(label: string) {
    if (!stdin.isTTY) {
      throw new Error("Для безпечного введення пароля потрібен інтерактивний термінал.");
    }

    stdout.write(label);
    stdin.setRawMode?.(true);
    let value = "";

    return new Promise<string>((resolve, reject) => {
      const restore = () => {
        stdin.setRawMode?.(false);
        stdin.off("data", listener);
      };
      const listener = (buffer: Buffer) => {
        const character = buffer.toString();
        if (character === "\r" || character === "\n") {
          restore();
          stdout.write("\n");
          resolve(value);
        } else if (character === "\u0003") {
          restore();
          reject(new Error("Операцію скасовано."));
        } else if (character === "\u007f") {
          value = value.slice(0, -1);
        } else if (/^[\x20-\x7E\u00A0-\uFFFF]+$/u.test(character)) {
          value += character;
        }
      };
      stdin.on("data", listener);
    });
  }

  async function readUsername() {
    return (named("username") ?? (await rl.question("Ім’я користувача: ")))
      .trim()
      .toLowerCase();
  }

  async function readPassword() {
    const password = await secret("Пароль: ");
    const repeated = await secret("Повторіть пароль: ");
    if (password !== repeated) throw new Error("Паролі не збігаються.");
    if (!loginSchema.shape.password.safeParse(password).success) {
      throw new Error("Пароль має містити щонайменше 12 символів.");
    }
    return password;
  }

  try {
    if (command === "create") {
      const username = await readUsername();
      const displayName = (await rl.question("Відображуване ім’я: ")).trim();
      const password = await readPassword();
      if (!loginSchema.shape.username.safeParse(username).success || !displayName) {
        throw new Error("Перевірте ім’я користувача.");
      }
      const [created] = await db
        .insert(users)
        .values({ username, displayName, passwordHash: await hash(password, { algorithm: 2 }) })
        .returning();
      await db.insert(auditLogs).values({ adminId: created.id, action: "ADMIN_CREATED" });
      console.log("Адміністратора створено.");
    } else if (command === "passwd") {
      const username = await readUsername();
      const password = await readPassword();
      const [user] = await db
        .update(users)
        .set({
          passwordHash: await hash(password, { algorithm: 2 }),
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.username, username))
        .returning();
      if (!user) throw new Error("Користувача не знайдено.");
      await db
        .update(adminSessions)
        .set({ revokedAt: new Date() })
        .where(eq(adminSessions.userId, user.id));
      console.log("Пароль змінено, активні сеанси завершено.");
    } else if (command === "disable" || command === "enable") {
      const username = await readUsername();
      const [user] = await db
        .update(users)
        .set({
          disabledAt: command === "disable" ? new Date() : null,
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.username, username))
        .returning();
      if (!user) throw new Error("Користувача не знайдено.");
      await db
        .update(adminSessions)
        .set({ revokedAt: new Date() })
        .where(eq(adminSessions.userId, user.id));
      console.log(command === "disable" ? "Користувача вимкнено." : "Користувача увімкнено.");
    } else if (command === "list") {
      console.table(
        await db
          .select({
            username: users.username,
            displayName: users.displayName,
            role: users.role,
            disabledAt: users.disabledAt,
          })
          .from(users),
      );
    } else {
      throw new Error("Команда: create, passwd, disable, enable або list.");
    }
  } finally {
    rl.close();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Команду не виконано.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
