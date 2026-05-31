🚀 GOD-TIER PROMPT CHAIN: Создание CupidBot 

ПОДГОТОВКА В CURSOR / WINDSURF:

Создай папку проекта.

Положи в нее ДВА файла:

PRD.txt (Текстовая бизнес-логика)

index.html (Наш сайт-презентация с Tailwind-дизайном).

Нажми Ctrl + I (Composer). Прикрепи ОБА файла к контексту (через + или @).

Отправляй промпты строго по одному!

🗄 ПРОМПТ 1: Фундамент и База Данных (PostgreSQL)

Ты — Senior Database Architect. Мы создаем Telegram Mini App Dating (CupidBot).
В контексте лежат файлы PRD.txt и index.html. Изучи PRD.txt для понимания бизнес-логики.

ЗАДАЧА №1: Архитектура БД
Напиши database.py (настройка async engine) и models.py (SQLAlchemy 2.0).

ЖЕСТКИЕ ТРЕБОВАНИЯ (Не галлюцинируй, используй строго эти поля):

Users: id, tg_id, name, gender, search_gender, tier (enum: free/premium/kupidon), swipes_left (default 50), force_chats_used (default 0), stars_balance (default 0). Флаги: is_18_mode_active, is_stealth_mode, is_shadowbanned.

Media_Slots: id, user_id, media_url, media_type (photo/video), slot_index (1-5).

Matches: id, user1_id, user2_id, is_force_chat (bool), is_18_room (bool), tg_unlocked_user1 (bool), tg_unlocked_user2 (bool), messages_count (default 0).

Swipes: id, actor_id, target_id, action_type (left/right/superlike). Создай UniqueConstraint на (actor_id, target_id).

Admin_Tags: id, name, color_hex, emoji.

Напиши чистый асинхронный код. Используй Mapped и mapped_column. Дай мне готовые файлы.

🤖 ПРОМПТ 2: Telegram Бот (aiogram 3.x) и God Mode

Отлично. БД готова.
Ты — Senior Python Developer.

ЗАДАЧА №2: Telegram Бот
Напиши bot.py и папку handlers/. Бот — это ТОЛЬКО точка входа и God Mode админка. Он не обрабатывает свайпы.

РЕАЛИЗУЙ СТРОГО ПО PRD.txt:

handlers/user.py: Команда /start. Проверяет, есть ли tg_id в БД. Если нет — делает INSERT (tier=free). Возвращает красивый текст и InlineKeyboardButton (web_app) с запуском Mini App.

handlers/admin.py: ТОЛЬКО для ADMIN_IDS.

Команда /user {id_или_username}: Делает SELECT юзера, выводит стату. Дает Inline-клавиатуру: [💎 Выдать Купидон], [🌟 +Stars], [🔞 18+ Вкл/Выкл], [👻 Теневой Бан].

Callbacks: Нажатие на "Теневой бан" делает UPDATE users SET is_shadowbanned = True.

Команда /tags {Название} | {HEX} | {Эмодзи}: парсит строку и делает INSERT INTO admin_tags.

Используй DI (Dependency Injection) для прокидывания AsyncSession в хэндлеры.

⚙️ ПРОМПТ 3: Backend FastAPI (Алгоритм Свайпов и Лента)

Бот готов. Переходим к FastAPI бэкенду.

ЗАДАЧА №3: Matching Engine API
Напиши main.py и api/feed.py, api/swipes.py.

ЖЕСТКИЕ ТРЕБОВАНИЯ К SQL-ЗАПРОСУ ЛЕНТЫ (GET /api/feed):
Прочитай раздел "МЕХАНИКА СВАЙПОВ" в PRD.txt. Напиши сложный select():

WHERE: пол совпадает с search_gender, юзер НЕ is_stealth_mode, юзер НЕ is_shadowbanned.

NOT EXISTS: исключить target_id из таблицы Swipes, где actor_id = текущий юзер (не показывать тех, кого уже свайпал).

18+ Режим: Если текущий юзер is_18_mode_active == True, добавить WHERE is_18_mode_active = True.

ORDER BY:

tier = 'kupidon' DESC

tier = 'premium' DESC

created_at DESC

Эндпоинты действий:

POST /api/swipe: Списывает swipes_left. Если right — ищет взаимный лайк. Если нашел -> INSERT INTO matches.

POST /api/rewind: Только для premium/kupidon. Удаляет последнюю запись swipe_left, возвращает лимит.

💰 ПРОМПТ 4: Backend FastAPI (Симпатии, Force Chat и Согласие)

Отлично! Лента работает.

ЗАДАЧА №4: Монетизация и Чаты
Напиши api/sympathies.py и api/chats.py. Опирайся на PRD.txt.

РЕАЛИЗУЙ:

GET /api/sympathies: SELECT юзеров, которые лайкнули меня, но с кем нет Matches.

POST /api/force_chat: Врыв в чат без мэтча. Проверить force_chats_used < лимита (Premium=3, Kupidon=15). Если лимита нет -> HTTP 402. Если есть -> force_chats_used + 1 и создать Match с is_force_chat=True.

POST /api/buy_golden_contact: Режим Олигарха. Списать 1000 stars_balance. Создать Match с tg_unlocked_user1=True и tg_unlocked_user2=True.

POST /api/chat/approve_tg: Обновляет Match, ставит tg_unlocked_userX = True.

Напиши WebSocket эндпоинт для чата, который инкрементит messages_count при каждом сообщении.

🎨 ПРОМПТ 5: Frontend React (UI/UX и Свайпы)

Бэкенд завершен. Переходим к React (Vite + Tailwind + Telegram SDK).

КРИТИЧЕСКИ ВАЖНО: Прочитай прикрепленный файл index.html. Вытащи оттуда ВСЮ дизайн-систему: цвета (Фуксия #FF00FF, Розовый #FF66CC, Темный #0F0F13), классы Tailwind (glass, backdrop-blur), скругления rounded-[2rem] и тени.

ЗАДАЧА №5: UI Ленты и Онбординга
Напиши компоненты:

SwipeCard.tsx: Точная копия карточки из index.html. Реализуй Framer Motion для свайпов. На кнопки добавь Telegram.WebApp.HapticFeedback.impactOccurred('medium').

MediaUploader.tsx: Сетка из 5 слотов. Логика: если загружается видео, визуально объедини 3 квадрата в один.

PaywallModal.tsx: Glassmorphism-модалка. Показывается, когда swipes_left == 0. Таймер до 00:00 и кнопка Купидона.

Sympathies.tsx: Вкладка ❤️ Симпатии. Фото открыты. Клик по фото вызывает Alert: "Потратить 1 врыв для начала чата?".

💬 ПРОМПТ 6: Frontend React (Чаты и 18+ Приватность)

Финал!

ЗАДАЧА №6: Механика чатов и согласия
Изучи PRD.txt (раздел ЧАТЫ И ОБОЮДНОЕ СОГЛАСИЕ) и index.html (мокап чата).
Напиши ChatDialog.tsx.

ЖЕСТКИЕ ПРАВИЛА UI:

Кнопка "Telegram" в шапке заблокирована. Рендери счетчик: "Откроется через {15 - messages_count} смс".

Кнопка "Запросить ТГ" в инпуте. Если собеседник нажал ее, рендери посередине чата компонент ConsentBubble: "Собеседник хочет перейти в Telegram. Одобрить?".

Если пропс is_18_room == true, кнопка Скрепки меняется на иконку Огня (исчезающие фото).

Сделай верстку чата в стиле iMessage/Telegram (свои справа, чужие слева), скопируй дизайн бабблов из index.html.