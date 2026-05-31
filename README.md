# CupidBot — Tinder-killer Telegram Mini App v3.0

Полный стек: FastAPI + aiogram 3 + React 18 + PostgreSQL + Redis.

---

## Быстрый старт (Docker)

```bash
# 1. Скопируй .env
cp .env.example .env
# 2. Заполни: BOT_TOKEN, ADMIN_IDS, WEBAPP_URL, DATABASE_URL, REDIS_URL, JWT_SECRET, S3_*

# 3. Запуск
docker-compose up --build

# 4. Миграции (при первом запуске выполняются автоматически)
docker-compose exec api alembic upgrade head
```

Сервисы:
- API: http://localhost:8000
- Документация: http://localhost:8000/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

---

## Локальная разработка

### Backend
```bash
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt

# .env в корне проекта
alembic upgrade head
uvicorn app.main:app --reload
```

### Bot
```bash
cd bot
pip install -r requirements.txt
python bot.py
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# Впиши VITE_API_URL=http://localhost:8000
npm run dev
```

---

## Тесты
```bash
cd backend
pip install -r requirements.txt
pytest -v
```

Покрытие:
- `test_auth.py` — JWT roundtrip, защита роутов
- `test_swipe_match.py` — swipe→match, лимиты, шадоубан, олигарх-раскрытие только по взаимности, блок/репорт/шадоубан, изоляция 18+, идемпотентность платежей

---

## Сборка фронта
```bash
cd frontend
npm run build
# dist/ — статика для деплоя
```

---

## Регистрация в @BotFather

1. `/newbot` → получи BOT_TOKEN → вставь в `.env`
2. `/newapp` → укажи `WEBAPP_URL` (URL фронта), вставь в `.env`
3. `ADMIN_IDS` — твой Telegram ID (узнай у @userinfobot)
4. Перезапусти сервисы: `docker-compose restart bot api`

---

## Структура проекта

```
CupidBot/
├─ backend/          FastAPI, SQLAlchemy 2.0 async, Pydantic v2
│  ├─ app/
│  │  ├─ main.py     FastAPI app + routers + lifespan
│  │  ├─ core/       config, security (JWT+HMAC), redis, deps
│  │  ├─ db/         async engine/session, Base
│  │  ├─ models/     Users, Swipes, Matches, Messages, Media_Slots,
│  │  │              Admin_Tags, User_Tags, VIP_Notifications,
│  │  │              Profile_Views, Reports, Blocks, Payments, Config
│  │  ├─ schemas/    Pydantic v2 DTOs
│  │  ├─ api/        auth, profile, feed, chats, reports, verify, media, payments, views
│  │  ├─ services/   matching (scoring), moderation (NSFW stub), economy, notifications, cron
│  │  └─ ws/         WebSocket manager + chat endpoint + LP fallback
│  ├─ alembic/       migrations (0001_initial — все таблицы + seed-теги)
│  └─ tests/         pytest async
├─ bot/              aiogram 3.x
│  ├─ bot.py         entrypoint, polling
│  └─ handlers/      user.py (/start + Mini App button), admin.py (God Mode)
├─ frontend/         React 18 + Vite + TypeScript + Tailwind + Framer Motion
│  └─ src/
│     ├─ theme/      CSS-переменные: light / 18+ / oligarch
│     ├─ store/      Zustand
│     ├─ api/        HTTP client + WebSocket factory
│     ├─ components/ SwipeCard, TabBar, MatchModal, PaywallModal, ConsentBubble
│     ├─ screens/    Feed, Sympathies, Chats, ChatDialog, Profile, Onboarding, VerifyFlow
│     └─ i18n/       ru (en/uk — заглушки)
├─ docker-compose.yml
└─ .env.example
```

---

## Что подключить руками (production checklist)

| Компонент | Статус | Что сделать |
|---|---|---|
| NSFW-модерация | 🟡 Stub | Подключить NudeNet / OpenNSFW2 в `backend/app/services/moderation.py` |
| Face verification | 🟡 Stub | Подключить DeepFace / AWS Rekognition в `face_service` |
| S3 медиа | 🟡 Stub URL | Реализовать загрузку через `boto3` в `api/media.py` |
| Telegram Stars оплата | 🟡 Webhook | Настроить `bot.py` → `send_invoice`, прокинуть `successful_payment` → `/api/payments/webhook` |
| Mini App домен | ❌ Не настроен | Деплой фронта → WEBAPP_URL в BotFather |
| PostGIS геолокация | 🟡 Аппрокс. | Установить расширение PostGIS для точного `ST_DWithin` |

---

## Тарифы (из Config — меняются через /economy без деплоя)

| Параметр | Free | Premium | Kupidon |
|---|---|---|---|
| Свайпов/сут | 50 | 200 | 500 |
| Force Chat/сут | — (50⭐) | 3 | 15 |
| Суперлайков/сут | — | 5 | 5 |
| Олигарх режим | — | — | ✓ |
| Анти-Олигарх | ✓ (♀) | ✓ | ✓ |

Цены Stars: Force Chat=50⭐, Буст=100⭐, Суперлайк=150⭐, VIP-сигнал=500⭐
