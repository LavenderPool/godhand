# GodHand

AI-ассистент для Godot: desktop-приложение с Electron + React, встроенным MCP-сервером и генерацией спрайтов.

## Запуск

```bash
pnpm install
pnpm build
pnpm dev    # desktop dev: electron renderer + backend
pnpm start  # desktop preview
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

- `apps/desktop/src/renderer` — React UI
- `apps/server` — Fastify API
- `apps/desktop` — Electron Windows-приложение
- `packages/mcp-godot` — MCP + WebSocket relay
- `packages/db` — SQLite + Drizzle
- `packages/shared` — типы и провайдеры
