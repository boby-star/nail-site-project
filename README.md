# Nailory

Production-ready SEO-first медіаплатформа українською: Next.js App Router виконує SSR, Server Actions і доступ до PostgreSQL через Drizzle; Redis є лише допоміжним шаром rate limiting. PostgreSQL залишається єдиним джерелом істини.

## Вимоги й локальний запуск

- Node.js 20 LTS або новіший LTS, pnpm 10;
- PostgreSQL 15+ і Redis 7+, доступні лише у приватній мережі/localhost;
- `libvips` для обробки зображень через Sharp.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm admin:create
pnpm dev
```

CLI ніколи не приймає пароль аргументом. Приклад діалогу:

```text
$ pnpm admin:create --username admin
Відображуване ім’я: Адміністратор
Пароль:
Повторіть пароль:
Адміністратора створено.
```

Доступні `pnpm admin:passwd --username admin`, `pnpm admin:disable`, `pnpm admin:enable` і `pnpm admin:list`. Відновлення доступу виконується через SSH, email/SMTP не використовуються.

## Змінні середовища

| Змінна | Призначення |
|---|---|
| `NODE_ENV` | режим процесу |
| `APP_URL` | публічна HTTPS-адреса без кінцевого `/` |
| `DATABASE_URL` | приватне PostgreSQL-підключення |
| `REDIS_URL` | приватне Redis-підключення |
| `JWT_SECRET` | випадковий секрет щонайменше 32 байти |
| `JWT_ISSUER`, `JWT_AUDIENCE` | обмеження JWT |
| `AUTH_ACCESS_TTL`, `AUTH_REFRESH_TTL` | TTL у секундах |
| `MEDIA_DIR` | каталог завантажень |
| `TELEGRAM_BOT_URL` | Telegram deep link |
| `SERVER_ACTION_ALLOWED_ORIGINS` | дозволені host-и через кому |

## База даних

Схема містить users/sessions, posts/SEO/revisions, ієрархічні categories, cities, media, redirects, crawler policies та audit log з FK, UUID, унікальними обмеженнями й індексами.

```bash
pnpm db:generate
pnpm db:migrate
```

Міграції запускають перед перемиканням релізу. Резервуйте PostgreSQL через зашифрований `pg_dump`; окремо резервуйте медіакаталог. Redis резервувати для відновлення контенту не потрібно.

## Перевірки й production build

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
NODE_ENV=production pnpm start
```

Standalone-розгортання потребує копіювання `.next/standalone`, `.next/static` та `public`. Процес пише логи у stdout/stderr, доступні через `journalctl`.

## systemd і Nginx

```bash
sudo useradd --system --home /var/www/nails-site --shell /usr/sbin/nologin nails
sudo install -d -o nails -g nails /var/www/nails-site/public/uploads /etc/nails-site
sudo install -m 600 -o root -g root .env.production /etc/nails-site/site.env
sudo install -m 644 deploy/nails-site.service /etc/systemd/system/nails-site.service
sudo systemctl daemon-reload
sudo systemctl enable --now nails-site
sudo journalctl -u nails-site -f
sudo install -m 644 deploy/nginx.conf /etc/nginx/sites-available/nails-site
sudo ln -s /etc/nginx/sites-available/nails-site /etc/nginx/sites-enabled/nails-site
sudo nginx -t && sudo systemctl reload nginx
```

TLS сертифікати та Cloudflare real-IP policy налаштовуються на сервері. PostgreSQL/Redis не публікуються. Nginx проксіює HTTPS на `127.0.0.1:3000`.

## Безпека й SEO

- немає реєстрації, default credentials або email-залежностей;
- Argon2id, HttpOnly/Secure/SameSite=Strict cookies, короткий HS256 JWT та hash opaque refresh token;
- кожна мутація має повторно викликати `requireAdmin`, Zod і Origin/Server Action захист;
- Drizzle параметризує запити; structured JSON renderer не приймає HTML чи небезпечні URL;
- Redis rate limit деградує без падіння публічного сайту;
- CSP, HSTS на HTTPS-рівні, noindex admin, `lang=uk`, SSR, canonical, OpenGraph, JSON-LD, sitemap та crawler-driven robots;
- медіа приймаються лише після MIME/decode/re-encode перевірки; SVG вимкнено.

## Межі першого релізу

Схема й безпекові межі готові для TipTap, media pipeline, revision diff/restore та повних CMS-форм. Візуальний TipTap editor, фонові черги, AI provider і bulk operations свідомо не є core dependency та підключаються окремими інкрементами. Немає crawler-only контенту або cloaking.
