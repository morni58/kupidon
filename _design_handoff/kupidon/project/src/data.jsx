/* ============================================================
   CupidBot — data, helpers, gradient photo placeholders
   ============================================================ */

// ---- Interest catalog (emoji + tag color per design system) ----
const INTERESTS = [
  { id: 'sport', label: 'Спорт', emoji: '🏋️', color: '#EF4444' },
  { id: 'music', label: 'Музыка', emoji: '🎵', color: '#8B5CF6' },
  { id: 'travel', label: 'Путешествия', emoji: '✈️', color: '#3B82F6' },
  { id: 'cinema', label: 'Кино', emoji: '🎬', color: '#F59E0B' },
  { id: 'informal', label: 'Неформалка', emoji: '💀', color: '#0F0F13' },
  { id: 'cats', label: 'Кошки', emoji: '🐱', color: '#FF66CC' },
  { id: 'dogs', label: 'Собаки', emoji: '🐶', color: '#F97316' },
  { id: 'skate', label: 'Скейт', emoji: '🛹', color: '#10B981' },
  { id: 'code', label: 'Программирование', emoji: '💻', color: '#06B6D4' },
  { id: 'cooking', label: 'Готовка', emoji: '🍳', color: '#EAB308' },
];
const interestById = (id) => INTERESTS.find((i) => i.id === id);

// ---- Curated gradient palettes for photo placeholders ----
// each = warm/vibrant pair, feels like a stylised portrait backdrop
const GRADS = [
  ['#FF9A9E', '#FAD0C4'], ['#A18CD1', '#FBC2EB'], ['#FFA751', '#FFE259'],
  ['#84FAB0', '#8FD3F4'], ['#FF6CAB', '#7366FF'], ['#F093FB', '#F5576C'],
  ['#4FACFE', '#00F2FE'], ['#FA709A', '#FEE140'], ['#30CFD0', '#330867'],
  ['#FF867A', '#FF8C7F'], ['#5EE7DF', '#B490CA'], ['#D9AFD9', '#97D9E1'],
  ['#FBAB7E', '#F7CE68'], ['#FF5ACD', '#FBDA61'], ['#6A11CB', '#2575FC'],
  ['#F857A6', '#FF5858'],
];

// build a "photo" descriptor: gradient + a vibe emoji shown big
function photo(gradIdx, emoji) {
  const g = GRADS[gradIdx % GRADS.length];
  return { from: g[0], to: g[1], emoji };
}

// ---- People (other users in the feed / likes / chats) ----
const PEOPLE = [
  {
    id: 'alisa', name: 'Алиса', age: 24, city: 'Москва', dist: '2 км',
    verified: true, gender: 'f',
    tags: ['music', 'travel', 'cats'],
    bio: 'Дизайню днём, ищу с кем смотреть закаты вечером. Кофе без сахара, музыка громко.',
    photos: [photo(13, '💃'), photo(1, '🌸'), photo(7, '🎧')],
    intent: null,
  },
  {
    id: 'kira', name: 'Кира', age: 22, city: 'Москва', dist: '4 км',
    verified: true, gender: 'f',
    tags: ['cinema', 'cats', 'cooking'],
    bio: 'Кошатница со стажем. Готовлю пасту лучше, чем в Италии (нет).',
    photos: [photo(5, '🐱'), photo(11, '🍝'), photo(3, '🎬')],
    intent: null,
  },
  {
    id: 'sonya', name: 'Соня', age: 26, city: 'Москва', dist: '1 км',
    verified: false, gender: 'f',
    tags: ['sport', 'travel', 'dogs'],
    bio: 'Бегаю по утрам, путешествую по выходным. Собака — Бакс, лучший в мире.',
    photos: [photo(3, '🏃‍♀️'), photo(6, '🌊'), photo(0, '🐶')],
    intent: null,
  },
  {
    id: 'masha', name: 'Маша', age: 23, city: 'Москва', dist: '6 км',
    verified: true, gender: 'f',
    tags: ['informal', 'music', 'skate'],
    bio: 'Скейт, винил и старое кино. Не пишите «привет как дела».',
    photos: [photo(4, '🛹'), photo(14, '🎸'), photo(8, '💀')],
    intent: null,
  },
  {
    id: 'lera', name: 'Лера', age: 28, city: 'Москва', dist: '3 км',
    verified: true, gender: 'f',
    tags: ['cooking', 'cinema', 'cats'],
    bio: 'Воскресенье = блинчики и сериалы. Ищу партнёра по преступлению (готовка).',
    photos: [photo(12, '🍳'), photo(1, '☕'), photo(5, '🐈')],
    intent: null,
  },
  {
    id: 'nastya', name: 'Настя', age: 21, city: 'Москва', dist: '8 км',
    verified: false, gender: 'f',
    tags: ['travel', 'music', 'sport'],
    bio: 'Уже собрала чемодан. Куда летим?',
    photos: [photo(7, '✈️'), photo(10, '🏔️'), photo(6, '🎵')],
    intent: null,
  },
];

// VIP / Oligarch anonymous signal (shown as gold card)
const OLIGARCH_SIGNAL = {
  id: 'vip1', note: 'Хочу познакомиться', when: 'только что',
};

// people who viewed you
const VIEWERS = [
  { id: 'v1', name: 'Игорь', age: 27, ph: photo(8, '🧔') },
  { id: 'v2', name: 'Дима', age: 25, ph: photo(14, '😎') },
  { id: 'v3', name: 'Артём', age: 30, ph: photo(2, '🚀') },
  { id: 'v4', name: 'Костя', age: 24, ph: photo(9, '🏀') },
];

// chats / matches
const CHATS = [
  {
    id: 'c_alisa', name: 'Алиса', verified: true, ph: photo(13, '💃'),
    last: 'Хаха, ну ок, кофе так кофе ☕', time: '14:32', unread: 2, online: true,
    msgsToTg: 4,
    messages: [
      { id: 1, me: false, text: 'Привет! Увидела, что ты тоже любишь джаз 🎷' },
      { id: 2, me: true, text: 'Привет :) Да, без джаза по вечерам никак' },
      { id: 3, me: false, text: 'Тогда у меня есть плейлист, который тебя уничтожит' },
      { id: 4, me: true, text: 'Звучит как вызов. Кидай' },
      { id: 5, me: false, text: 'Хаха, ну ок, кофе так кофе ☕' },
    ],
  },
  {
    id: 'c_kira', name: 'Кира', verified: true, ph: photo(5, '🐱'),
    last: 'Кот одобрил твоё фото 🐾', time: '12:10', unread: 0, online: false,
    msgsToTg: 0,
    messages: [
      { id: 1, me: false, text: 'Твой кот или мой кот — кто главнее?' },
      { id: 2, me: true, text: 'Очевидно твой, я видел фото' },
      { id: 3, me: false, text: 'Кот одобрил твоё фото 🐾' },
    ],
  },
  {
    id: 'c_masha', name: 'Маша', verified: false, ph: photo(4, '🛹'),
    last: 'скинь трек что слушаешь', time: 'Вчера', unread: 0, online: false,
    msgsToTg: 11,
    messages: [
      { id: 1, me: false, text: 'скинь трек что слушаешь' },
    ],
  },
  {
    id: 'c_hot', name: 'Ева', verified: true, ph: photo(15, '🔥'),
    last: '🔥 Фото исчезло', time: '23:48', unread: 1, online: true, adult: true,
    msgsToTg: 0,
    messages: [
      { id: 1, me: false, text: 'Привет 🌙' },
      { id: 2, me: false, kind: 'burn', text: '🔥 Фото' },
    ],
  },
];

// likes (people who liked you, no match yet)
const LIKES = [
  { id: 'l1', name: 'Алиса', age: 24, verified: true, ph: photo(13, '💃'), when: 'недавно' },
  { id: 'l2', name: 'Соня', age: 26, verified: false, ph: photo(3, '🏃‍♀️'), when: '2 ч назад' },
  { id: 'l3', name: 'Лера', age: 28, verified: true, ph: photo(12, '🍳'), when: 'сегодня' },
  { id: 'l4', name: 'Настя', age: 21, verified: false, ph: photo(7, '✈️'), when: 'вчера' },
];

// cities for geo step
const CITIES = [
  { name: 'Москва', region: 'Москва и область' },
  { name: 'Санкт-Петербург', region: 'Ленинградская область' },
  { name: 'Новосибирск', region: 'Новосибирская область' },
  { name: 'Екатеринбург', region: 'Свердловская область' },
  { name: 'Казань', region: 'Республика Татарстан' },
  { name: 'Нижний Новгород', region: 'Нижегородская область' },
  { name: 'Краснодар', region: 'Краснодарский край' },
];

// icebreakers
const ICEBREAKERS = [
  '🐾 Собаки или кошки?',
  '🎵 Какой плейлист?',
  '✈️ Последняя поездка?',
];

// plan config — drives what the user sees
const PLANS = {
  free:    { id: 'free',    label: 'Free',         badge: 'Free',        swipes: 50,  superlikes: 0, barge: 0,  tgMsgs: 15, rewind: false, viewers: false, oligarch: false },
  premium: { id: 'premium', label: 'Premium 💎',   badge: 'Premium 💎',  swipes: 200, superlikes: 5, barge: 3,  tgMsgs: 5,  rewind: true,  viewers: true,  oligarch: false },
  kupidon: { id: 'kupidon', label: 'Kupidon 👑',   badge: 'Kupidon 👑',  swipes: 500, superlikes: 6, barge: 15, tgMsgs: 0,  rewind: true,  viewers: true,  oligarch: true  },
};

Object.assign(window, {
  INTERESTS, interestById, GRADS, photo,
  PEOPLE, OLIGARCH_SIGNAL, VIEWERS, CHATS, LIKES, CITIES, ICEBREAKERS, PLANS,
});
