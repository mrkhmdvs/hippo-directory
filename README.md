# hippo.uz · справочник команды

Внутренний справочник: отделы, обязанности, сотрудники, контакты (email / телефон / Telegram).
Публичная страница для всех + закрытая админка только для тебя.

## Что есть

- `GET /` — публичная страница со всей структурой команды
- `GET /admin/login` — вход в админку по паролю
- `GET /admin` — редактирование (отделы, обязанности, руководители, сотрудники)
- API: `GET /api/data`, `PUT /api/data` (требует авторизации)

## Локальный запуск

```bash
npm install
cp .env.example .env
# открой .env и поменяй ADMIN_PASSWORD и SESSION_SECRET
node --env-file=.env server.js
```

Открой http://localhost:3000

Заходи в админку: http://localhost:3000/admin/login

## Деплой на Render

1. Залить репозиторий на GitHub (под `mrkhmdvs`):
   ```bash
   cd hippo-directory
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/mrkhmdvs/hippo-directory.git
   git push -u origin main
   ```

2. На render.com → **New +** → **Web Service** → подключить репо.

3. Render сам подхватит `render.yaml`. В разделе **Environment** задать:
   - `ADMIN_PASSWORD` — твой пароль для входа в админку (сильный, никому не показывать)
   - `SESSION_SECRET` — Render сгенерит автоматически (если не задал)

4. После деплоя получишь ссылку вида `https://hippo-directory.onrender.com`.
   - Команде раздаёшь корневую: `https://hippo-directory.onrender.com/`
   - Себе сохрани: `https://hippo-directory.onrender.com/admin/login`

## Где хранится база

Простой JSON-файл `data.json` рядом с сервером. На Render free tier диск **эфемерный** — при перезапуске сервиса данные пропадают. Варианты:

- **Просто** (для начала): подключить Render Persistent Disk ($1/мес), смонтировать в `/data`, в env задать `DATA_FILE=/data/data.json`.
- **Бесплатно**: периодически делать `GET /api/data` и сохранять копию (или раз в неделю руками).
- **Надёжно**: переезд на Postgres / Supabase / Firebase — но это уже другая история, не делай пока не нужно.

## Безопасность

- Пароль и `SESSION_SECRET` — только в env, **не коммитить**.
- Сессионная кука httpOnly + signed HMAC, действует 30 дней.
- В production (`NODE_ENV=production`) кука помечается как `secure` — работает только по HTTPS, что у Render по умолчанию.

## Что делает админка

- Добавлять/удалять отделы
- Для каждого отдела:
  - Название и описание
  - Обязанности (через Enter)
  - Один **руководитель** (имя, должность, email, телефон, Telegram)
  - Любое количество **сотрудников**
- Кнопка «Сохранить» отправляет всё одним запросом — изменения сразу видны на публичной странице.

## Структура файлов

```
hippo-directory/
├── server.js              # Express: API + auth + serving HTML
├── package.json
├── render.yaml            # конфиг Render
├── .env.example
├── .gitignore
├── README.md
├── data.json              # создастся автоматически при первом запуске
├── public/
│   └── styles.css         # дизайн-токены и общие стили
└── views/
    ├── public.html        # публичная страница
    ├── login.html         # форма входа
    └── admin.html         # админка с редактированием
```

## Что менять, если нужно

- **Цвета** — `public/styles.css`, секция `:root`. Сейчас зелёный hippo-brand (`#1E7A4A`).
- **Поля сотрудника** — функция `sanitizePerson` в `server.js` + поля в `views/admin.html` + рендер в `views/public.html`.
- **Доменное имя** — Render → Settings → Custom Domain.
