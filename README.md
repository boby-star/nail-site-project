# Nailory

SEO-first медіаплатформа українською на Next.js App Router. Production-запуск виконується в Docker-контейнерах: застосунок слухає лише `127.0.0.1:3000`, PostgreSQL і Redis доступні тільки у внутрішній Docker network, а зовнішній Nginx завершує TLS і проксіює HTTP до застосунку.

## Склад production-оточення

- `app` — мінімальний standalone Next.js runtime від непривілейованого користувача;
- `migrate` — одноразово застосовує Drizzle migrations перед запуском `app`;
- `postgres` — єдине джерело важливих даних;
- `redis` — допоміжний rate limiting; persistence вимкнено навмисно;
- `admin` — opt-in CLI-контейнер для керування адміністраторами;
- Nginx працює на host і проксіює домен на `127.0.0.1:3000`.

## Вимоги

- Linux VPS з Docker Engine і Docker Compose plugin;
- домен із DNS `A/AAAA` записом на сервер;
- Nginx та TLS certificate на host;
- Git для клонування репозиторію.

Node.js, pnpm, PostgreSQL і Redis на host встановлювати не потрібно.

## Налаштування

```bash
git clone https://github.com/OWNER/REPOSITORY.git /var/www/nails-site
cd /var/www/nails-site/deploy
cp .env.example .env
cp app.env.example app.env
```

У `deploy/.env` задайте build/Compose параметри:

```dotenv
APP_URL=https://example.com
IMAGE_TAG=latest
POSTGRES_DB=nails_site
POSTGRES_USER=nails_app
POSTGRES_PASSWORD=довгий-випадковий-пароль-без-символів-які-потребують-URL-кодування
```

У `deploy/app.env` задайте runtime-конфігурацію:

```dotenv
APP_URL=https://example.com
JWT_SECRET=щонайменше-32-випадкових-байти
JWT_ISSUER=nails-site
JWT_AUDIENCE=nails-admin
AUTH_ACCESS_TTL=900
AUTH_REFRESH_TTL=2592000
SERVER_ACTION_ALLOWED_ORIGINS=example.com,www.example.com
```

Згенерувати secrets можна так:

```bash
openssl rand -hex 48
```

Захистіть файли:

```bash
chmod 600 deploy/.env deploy/app.env
```

`DATABASE_URL`, `REDIS_URL`, `NODE_ENV`, `PORT`, `HOSTNAME` і `MEDIA_DIR` Compose/Dockerfile формують автоматично. Production secrets не комітяться в Git.

## Build і запуск

```bash
cd /var/www/nails-site/deploy
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 migrate app
curl --fail http://127.0.0.1:3000/health
```

`app` не стартує, доки PostgreSQL не стане healthy і `migrate` успішно не застосує versioned migrations. Порт опубліковано виключно на loopback host, тому напряму з інтернету він недоступний.

## Створення першого адміністратора

Публічної реєстрації немає. Запустіть інтерактивний CLI-контейнер після успішної міграції:

```bash
cd /var/www/nails-site/deploy
docker compose --profile tools run --rm admin admin:create --username admin
```

Далі введіть відображуване ім’я та пароль у прихованому prompt. Пароль не передавайте аргументом.

Інші команди:

```bash
docker compose --profile tools run --rm admin admin:list
docker compose --profile tools run --rm admin admin:passwd --username admin
docker compose --profile tools run --rm admin admin:disable --username admin
docker compose --profile tools run --rm admin admin:enable --username admin
```

## Nginx

Замініть домен у `deploy/nginx.conf`, додайте TLS certificate directives через Certbot, після чого:

```bash
sudo install -m 644 deploy/nginx.conf /etc/nginx/sites-available/nails-site
sudo ln -sfn /etc/nginx/sites-available/nails-site /etc/nginx/sites-enabled/nails-site
sudo nginx -t
sudo systemctl reload nginx
```

Nginx проксіює запити на `http://127.0.0.1:3000`. Не публікуйте Docker ports PostgreSQL `5432` або Redis `6379`.

## Оновлення

```bash
cd /var/www/nails-site
git pull --ff-only
cd deploy
docker compose build --pull
docker compose up -d --remove-orphans
docker image prune -f
docker compose ps
docker compose logs --tail=100 migrate app
curl --fail http://127.0.0.1:3000/health
```

Перед значними оновленнями зробіть backup PostgreSQL.

## Backup і restore

```bash
cd /var/www/nails-site/deploy
docker compose exec -T postgres pg_dump -U nails_app -d nails_site -Fc > nails-site.dump
docker compose exec -T postgres pg_restore -U nails_app -d nails_site --clean --if-exists < nails-site.dump
```

Файли медіа зберігаються у named volume `nails-site_uploads`. PostgreSQL — у `nails-site_postgres-data`. Redis не містить єдиної копії важливих даних.

## Діагностика

```bash
docker compose ps
docker compose logs --tail=200 app
docker compose logs --tail=200 migrate
docker compose logs --tail=200 postgres
docker compose exec postgres pg_isready -U nails_app -d nails_site
curl -i http://127.0.0.1:3000/health
curl -I https://example.com
```

Не використовуйте `docker compose down -v` у production: параметр `-v` видалить volumes із БД та медіа.

## Локальна розробка без Docker

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm admin:create
pnpm dev
```

Перевірки:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
