# BUILD PROMPT — CupidBot (автономный, для Claude Code)

> Открой папку как проект: `cd C:\Users\XE\Desktop\CupidBot` → запусти `claude` → вставь ВЕСЬ блок ниже одним сообщением.

---

Ты — senior fullstack-инженер и работаешь полностью автономно. Твоя задача — построить рабочий проект «CupidBot» целиком, от начала до конца, без остановок и без уточняющих вопросов. Если встречаешь развилку — принимай разумное решение сам, фиксируй его в README и двигайся дальше. НЕ жди моих подтверждений между этапами. Останавливайся только когда весь проект собран, запускается и проходит тесты.

## ИСТОЧНИК ИСТИНЫ
В этой папке (C:\Users\XE\Desktop\CupidBot) лежит спецификация **CupidBot_PRD_v3.html** — прочитай её ЦЕЛИКОМ перед началом и следуй ей буквально: разделы «Схема БД», «Алгоритмы», «Тарифы», «Trust & Safety», «Олигарх», «Комната 18+», «Анти-Олигарх», «Верификация», «God Mode».
Файлы PRD.txt, prompt.md, index.html, CupidBot_PRD_v2.html — только справка. При любом конфликте побеждает CupidBot_PRD_v3.html.

## СТЕК (не меняй)
- Backend: Python 3.11, FastAPI, SQLAlchemy 2.0 async (Mapped/mapped_column), Pydantic v2, PostgreSQL, Redis, Alembic, uvicorn.
- Бот: aiogram 3.x — точка входа (/start, запуск Mini App) + God Mode админка. Свайпы бот НЕ обрабатывает.
- Frontend: React 18 + Vite + TypeScript + Tailwind + Framer Motion + Zustand + @twa-dev/sdk (Telegram WebApp).
- Realtime: WebSocket с Long Polling fallback.
- Инфра: docker-compose (services: api, bot, db=postgres:16, redis:7), Dockerfile на каждый сервис, Alembic-миграции, .env.example, README.md с пошаговым запуском.

## СТРУКТУРА РЕПОЗИТОРИЯ (создай сразу так, без вопросов)
```
CupidBot/
├─ backend/
│  ├─ app/
│  │  ├─ main.py            # FastAPI app, CORS, routers, WS
│  │  ├─ core/              # config(.env через pydantic-settings), security(JWT, initData HMAC), redis, deps
│  │  ├─ db/                # database.py(async engine/session), base.py
│  │  ├─ models/            # SQLAlchemy модели СТРОГО по схеме PRD v3
│  │  ├─ schemas/           # Pydantic DTO
│  │  ├─ api/               # feed.py, swipes.py, sympathies.py, chats.py, profile.py, media.py, verify.py, reports.py, payments.py
│  │  ├─ services/          # matching(scoring), moderation(NSFW-интерфейс), economy, notifications
│  │  └─ ws/                # websocket чата
│  ├─ alembic/ + alembic.ini
│  ├─ tests/                # pytest: авторизация, swipe→match, лимиты, скоринг ленты, 18+ изоляция, олигарх-раскрытие, блок/репорт
│  ├─ Dockerfile  requirements.txt  .env.example
├─ bot/
│  ├─ bot.py                # aiogram entrypoint
│  ├─ handlers/             # user.py(/start), admin.py(God Mode: /user /tags /tags18 /economy /reports /stats /ban)
│  ├─ keyboards/  states/   # inline-клавиатуры, FSM
│  ├─ Dockerfile  requirements.txt
├─ frontend/
│  ├─ src/
│  │  ├─ main.tsx App.tsx
│  │  ├─ theme/             # CSS-переменные: light / 18+ / oligarch, палитра PRD
│  │  ├─ store/             # Zustand
│  │  ├─ api/               # клиент + WS
│  │  ├─ components/        # SwipeCard, MediaUploader, PaywallModal, MatchModal, ConsentBubble, TabBar, VerifyFlow, ReportSheet
│  │  ├─ screens/           # Onboarding, Feed, Sympathies, Chats, ChatDialog, Profile, Settings, Room18, Oligarch
│  │  └─ i18n/              # ru (en/uk-заглушки)
│  ├─ index.html  vite.config.ts  tailwind.config.js  package.json  .env.example
├─ docker-compose.yml
└─ README.md
```

## ЖЁСТКИЕ ТРЕБОВАНИЯ
- Модели БД, таблицы, ENUM-ы, UNIQUE и индексы — СТРОГО как в разделе «Схема БД» PRD v3 (Users, Swipes, Matches, Messages, Media_Slots, Admin_Tags, User_Tags, VIP_Notifications, Profile_Views, Reports, Blocks, Payments, Config). Ничего не выдумывай и не переименовывай.
- Логику реализуй точно по разделу «Алгоритмы»: скоринг ленты (tier+теги+свежесть+profile_score+гео+random), POST /api/swipe (лимиты → запись → проверка взаимного лайка → match; Олигарх → vip_notification, раскрытие ТОЛЬКО при взаимном лайке), CRON-сброс (свайпы/врывы/суперлайки/vip_signals, стрики).
- Авторизация: валидация Telegram initData через HMAC-SHA256 от bot_token → выдача JWT. Все защищённые ручки требуют JWT.
- Лимиты тарифов и цены Stars — из раздела «Тарифы», значения читаются из таблицы Config (правятся через /economy без деплоя). Платежи через Telegram sendInvoice + successful_payment, идемпотентность по invoice_payload, баланс не уходит в минус.
- Trust & Safety: репорты, двусторонний блок (фильтр в ленте), шадоубан (лайки не пишутся, в выдаче нет), rate-limit, trust_score. NSFW-модерация и face-эмбеддинги — реализуй как чистый интерфейс/сервис с заглушкой (стаб возвращает score), чтобы потом подключить реальную модель. Биометрию не хранить.
- Комната 18+: отдельный изолированный пул (WHERE is_18_mode_active = me), теги is_18_only, исчезающие медиа (burn), вход только для verified. Эротика блокируется (порог модерации жёстче).
- Олигарх: стелс + анонимный приоритетный сигнал + раскрытие по взаимности + суточный лимит сигналов. Анти-Олигарх: один тумблер, бесплатно для female, делает невидимой для олигархов.
- Фронт: дизайн строго по мокапам PRD v3 — палитра #FF00FF/#FF66CC/#0F0F13/#FFD700/#10B981, шрифт Onest, glassmorphism, rounded-[2rem], Framer Motion для свайпов, Haptic (impactOccurred) на свайпах/лайках/модалках, нижний таб-бар на 4 иконки, темы light/18+/oligarch через CSS-переменные.
- Чистый типизированный код. Никаких секретов в коде — всё через .env (заполни .env.example всеми ключами: BOT_TOKEN, DATABASE_URL, REDIS_URL, JWT_SECRET, ADMIN_IDS, WEBAPP_URL, S3_*). Комментарии по делу.

## ВЫПОЛНИ ВСЁ ПОДРЯД (M1→M4 из раздела Roadmap, без пауз)
- M1 MVP: инфра + БД + миграции + бот /start и God Mode + FastAPI feed/swipe/match + React онбординг/свайпы/чат на WS + Free/Premium + Stars(Force Chat, буст).
- M2 Доверие: верификация (selfie-liveness flow, интерфейс), AI-модерация (стаб), репорты+блок, шадоубан, скоринг ленты, фильтр «только Verified», «кто смотрел».
- M3 Спец-режимы: Комната 18+, тариф Kupidon, Режим Олигарх (стелс+сигналы+раскрытие), Анти-Олигарх щит.
- M4 Рост: дейли-стрик и награды, умные пуши через бота, welcome-буст, i18n (ru готов, en/uk заглушки).

## DEFINITION OF DONE (проверь сам перед завершением)
1. `docker-compose up` поднимает api+bot+db+redis без ошибок.
2. `alembic upgrade head` создаёт все таблицы из схемы PRD v3.
3. `pytest` в backend проходит зелёным (покрой: авторизация initData→JWT, swipe→match, дневные лимиты, скоринг ленты, изоляция 18+, олигарх-раскрытие только по взаимности, блок/репорт/шадоубан, идемпотентность платежей).
4. `npm run build` во frontend проходит без ошибок типов.
5. README.md: как заполнить .env, запустить локально и в docker, прогнать тесты, где зарегистрировать бота и Mini App в @BotFather.
6. В конце выведи краткий отчёт: что сделано по каждому майлстоуну, какие решения принял на развилках, что осталось подключить руками (реальная NSFW-модель, S3-бакет, домен Mini App).

Начинай сейчас. Сначала прочитай CupidBot_PRD_v3.html, затем создавай файлы и пиши код до полного завершения. Не спрашивай разрешений — действуй.
