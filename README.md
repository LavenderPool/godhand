# GodHand

AI-ассистент для Godot: объединённый MCP-сервер, веб-интерфейс, генерация спрайтов.

## Запуск (веб)

```bash
pnpm install
pnpm build
pnpm dev    # web :3000, server :3001, mcp WS :6505
pnpm start  # production
```

## Windows Desktop (portable + tray)

```bash
pnpm install
pnpm desktop:dev     # dev: окно + backend в трее
pnpm desktop:build   # portable .exe в apps/desktop/release/
```

- Закрытие окна сворачивает приложение в системный трей (MCP продолжает работать)
- «Выход» в меню трея полностью останавливает приложение
- БД хранится в `%APPDATA%/GodHand/data/godhand.db`
- Перед каждым обновлением схемы автоматически создаётся backup в `%APPDATA%/GodHand/data/backups/`
- Если миграция после обновления не удалась, приложение откатывает БД на последний backup и запускается со старой схемой
- Быстрый ручной откат: закройте GodHand, скопируйте нужный файл из `data/backups/` поверх `data/godhand.db`, затем запустите снова

## Переменные окружения

Скопируйте `apps/server/.env.example` в `apps/server/.env`.

## Структура

- `apps/web` — React UI
- `apps/server` — Fastify API
- `apps/desktop` — Electron Windows-приложение
- `packages/mcp-godot` — MCP + WebSocket relay
- `packages/db` — SQLite + Drizzle
- `packages/shared` — типы и провайдеры
