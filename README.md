# Messenger+

Простой веб-мессенджер: текстовые сообщения, фото, голосовые, аудио- и видеозвонки.

Стек: React + Vite, Supabase (база данных, авторизация, realtime, хранилище), WebRTC для звонков.

## Настройка

1. Создай проект на [supabase.com](https://supabase.com)
2. Открой **SQL Editor** и выполни скрипт из `supabase/schema.sql`
3. В **Settings → API** скопируй Project URL и anon key
4. Создай файл `.env`:

```
VITE_SUPABASE_URL=твой_url
VITE_SUPABASE_ANON_KEY=твой_anon_key
```

5. `npm install && npm run dev`

## Деплой на Vercel

Импортируй репозиторий на [vercel.com](https://vercel.com), добавь переменные `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` в Environment Variables и задеплой.
