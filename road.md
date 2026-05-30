Давай сначала посмотрю на загруженный файл по agentmemory и изучу структуру проекта.

Отлично, теперь у меня полная картина. Вот детальный промпт-ТЗ:

---

# ПРОМПТ-ТЗ: GodHand — AI-ассистент для Godot

## Контекст проекта

Есть две существующих MCP-интеграции для Godot:
- `mcp/1` — **Godot MCP Pro**: GDScript-плагин редактора, ~170 инструментов, WebSocket-транспорт (Godot подключается к порту 6505–6514 на Node.js)
- `mcp/2` — **godot-mcp**: Node.js/TypeScript MCP-сервер, 14 инструментов, stdio-транспорт, запускает Godot через CLI

Из них нужно собрать **единый рабочий прототип** с веб-интерфейсом. Далее — полное ТЗ.

---

## АРХИТЕКТУРА

### Монорепозиторий

```
godhand/
├── apps/
│   ├── web/          # React (Vite) фронтенд
│   └── server/       # Node.js (Express/Fastify) бэкенд
├── packages/
│   ├── mcp-godot/    # Объединённый MCP-сервер (merge mcp/1 + mcp/2)
│   ├── db/           # Схема БД + миграции (SQLite через better-sqlite3 или libsql)
│   └── shared/       # Общие типы TypeScript, константы
├── mcp/              # Исходники (оставить как есть, читать)
│   ├── 1/            # mcp pro source
│   └── 2/            # godot-mcp source
└── package.json      # workspace (pnpm workspaces)
```

### Технологический стек

| Слой | Технология | Обоснование |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript | |
| UI Kit | shadcn/ui + Tailwind CSS v4 | shadcn-подобный дизайн |
| i18n | react-i18next | RU / EN |
| Темы | next-themes или CSS variables | light / dark |
| State | Zustand | легковесный, масштабируемый |
| Router | TanStack Router | type-safe |
| Backend | Node.js + Fastify + TypeScript | |
| БД | SQLite (libSQL/better-sqlite3) + Drizzle ORM | локальная, без сервера |
| MCP-сервер | `@modelcontextprotocol/sdk` + WS | объединённый |
| WebSocket | `ws` (Node.js) | для связи с Godot-плагином |
| Memory | agentmemory (Python) через subprocess или REST | |
| Файловая система | `chokidar` (watch), `fs-extra` | |
| Процессы | `execa` | запуск Godot CLI |

---

## ОБЪЕДИНЁННЫЙ MCP-СЕРВЕР (`packages/mcp-godot`)

### Задача

Создать **единый MCP-сервер** на Node.js/TypeScript, который:
1. Запускает **WebSocket-сервер** на порту `6505` — к нему подключается Godot MCP Pro плагин (из `mcp/1`)
2. Экспонирует **все ~170 инструментов** из `mcp/1` (через WS relay → Godot)
3. Добавляет **14 инструментов** из `mcp/2` (прямые CLI-команды, без плагина)
4. Регистрирует все инструменты в MCP протоколе (stdio или HTTP/SSE)

### Архитектура сервера

```
┌─────────────────────────────────────────────────────────┐
│                  mcp-godot server                        │
│                                                          │
│  ┌──────────────┐    ┌───────────────────────────────┐  │
│  │  MCP Protocol│    │     WebSocket Server :6505    │  │
│  │  (stdio/SSE) │    │  ← Godot MCP Pro plugin       │  │
│  │              │    │                               │  │
│  │  ~184 tools  │◄───┤  relay: WS ↔ MCP tools       │  │
│  │              │    └───────────────────────────────┘  │
│  │  +14 CLI     │    ┌───────────────────────────────┐  │
│  │  tools       │◄───┤  Godot CLI executor           │  │
│  └──────────────┘    └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Инструменты из mcp/1 (через WebSocket relay)

Взять список команд из `mcp/1/commands/*.gd` и зарегистрировать каждую как MCP-tool с проксированием через WebSocket. Инструменты из модулей:
`runtime`, `node`, `editor`, `project`, `scene`, `animation_tree`, `batch`, `theme`, `script`, `audio`, `analysis`, `animation`, `physics`, `scene_3d`, `shader`, `tilemap`, `input`, `particle`, `navigation`, `test`, `resource`, `android`, `export`, `input_map`, `profiling`

### Инструменты из mcp/2 (прямые CLI)

Взять из `mcp/2/src/index.ts`:
`launch_editor`, `run_project`, `get_debug_output`, `stop_project`, `get_godot_version`, `list_projects`, `get_project_info`, `create_scene`, `add_node`, `load_sprite`, `export_mesh_library`, `save_scene`, `get_uid`, `update_project_uids`

### HTTP API сервера (`apps/server`)

```
GET  /api/status              # статус WS-соединения с Godot
POST /api/mcp/start           # запустить mcp-godot сервер
POST /api/mcp/stop            # остановить
GET  /api/projects            # список проектов
POST /api/projects            # добавить проект
GET  /api/projects/:id        # данные проекта
DELETE /api/projects/:id
GET  /api/projects/:id/files?path=  # содержимое директории
GET  /api/projects/:id/generations  # история генераций спрайтов
POST /api/projects/:id/generate     # генерация спрайта
GET  /api/skills              # список скиллов
PATCH /api/skills/:id         # включить/выключить скилл
POST /api/cursor/connect-mcp  # записать mcp.json в Cursor config
GET  /api/memory/search       # поиск в agentmemory
POST /api/memory/add          # добавить воспоминание
```

---

## БАЗА ДАННЫХ (SQLite, Drizzle ORM)

### Схема

```typescript
// projects
id: text (uuid), name: text, path: text (absolute),
godotVersion: text, createdAt: integer, updatedAt: integer

// generations
id: text (uuid), projectId: text FK,
prompt: text, imagePath: text (local),
model: text, metadata: text (JSON),
createdAt: integer

// skills
id: text, name: text, description: text,
filePath: text, enabled: integer (0/1),
category: text, projectId: text nullable

// mcp_connections
id: text, projectId: text FK,
wsPort: integer, status: text,
lastConnected: integer
```

---

## ИНТЕГРАЦИЯ AGENTMEMORY

Библиотека: https://github.com/rohitg00/agentmemory

Запускать как Python subprocess или через REST wrapper (FastAPI micro-сервис на порту `8765`). Если Python-сервис недоступен — деградировать gracefully (показывать статус "Memory: offline").

Функции:
- `POST /api/memory/add` — сохранить промпт + результат генерации
- `GET /api/memory/search?q=` — поиск похожих генераций/контекста
- Память привязана к `projectId`

---

## ИНТЕГРАЦИЯ С CURSOR IDE

Кнопка "Подключить к Cursor" на странице проекта:
1. Определить путь к Cursor config: `~/.cursor/mcp.json` (или через env `CURSOR_CONFIG_PATH`)
2. Прочитать существующий файл (если есть)
3. Добавить/обновить запись:

```json
{
  "mcpServers": {
    "godhand-godot": {
      "command": "node",
      "args": ["C:/путь/к/godhand/packages/mcp-godot/build/index.js"],
      "env": {
        "GODOT_PATH": "C:/путь/к/godot.exe",
        "GODOT_PROJECT_PATH": "C:/путь/к/проекту"
      }
    }
  }
}
```
4. Показать уведомление об успехе + инструкцию перезапустить Cursor

---

## ВЕБ-ИНТЕРФЕЙС

### Дизайн-система

- **shadcn/ui** компоненты (Button, Card, Dialog, Sidebar, Badge, Input, Tabs и т.д.)
- **Tailwind CSS v4** + CSS variables для тем
- **Темы**: light / dark, переключатель в header с иконкой солнца/луны
- **Языки**: RU / EN через `react-i18next`, переключатель в header
- Шрифт: Geist или Inter
- Иконки: Lucide React
- Анимации: Framer Motion (только где уместно)

### Страница 1: Главная (`/`)

```
┌─────────────────────────────────────────────────┐
│  GodHand     [🌙 Dark]  [🇷🇺 RU]                │  ← header
├─────────────────────────────────────────────────┤
│                                                  │
│  Мои проекты                    [+ Новый проект] │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 🎮       │ │ 🎮       │ │ + Добавить│          │
│  │ MyGame   │ │ RPG Demo │ │ проект   │          │
│  │          │ │          │ │          │          │
│  │ C:\...   │ │ C:\...   │ │          │          │
│  │ v4.3     │ │ v4.2     │ │          │          │
│  └──────────┘ └──────────┘ └──────────┘          │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Диалог "Новый проект"**: поле имени + выбор папки через `input[type=text]` с кнопкой Browse (через `POST /api/browse-folder` → `showOpenDialog`-подобный механизм через Node.js).

### Страница 2: Проект (`/project/:id`)

```
┌──────┬────────────────────────────────────────────┐
│      │  MyGame                    [Cursor 🔌]      │
│  📁  ├────────────────────────────────────────────┤
│ Про- │  (контент зависит от выбранного пункта)    │
│  ект │                                            │
│      │                                            │
│  🔌  │                                            │
│ MCP  │                                            │
│      │                                            │
│  🖼️  │                                            │
│ Гал. │                                            │
│      │                                            │
│  📚  │                                            │
│ Скил │                                            │
│      │                                            │
│  📂  │                                            │
│ Файл │                                            │
└──────┴────────────────────────────────────────────┘
```

#### Вкладка "Проект" (главная рабочая область)

```
┌─────────────────────────────────────────────────────┐
│  MCP Status: ● Connected (Godot MCP Pro v1.14.1)    │
│  WebSocket: ws://127.0.0.1:6505  [Переподключить]   │
├─────────────────────────────────────────────────────┤
│  Генерация спрайтов                                 │
│  ┌──────────────────────────────────┐ [Создать]     │
│  │ Введите описание спрайта...      │               │
│  └──────────────────────────────────┘               │
│  Стиль: [Pixel Art ▾]  Размер: [64x64 ▾]           │
│                                                     │
│  Недавние генерации                                 │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                │
│  │    │ │    │ │    │ │    │ │    │                │
│  │ 🧙 │ │ 🗡️ │ │ 🛡️ │ │ 🏠 │ │ 🌲 │                │
│  └────┘ └────┘ └────┘ └────┘ └────┘                │
└─────────────────────────────────────────────────────┘
```

#### Вкладка "MCP"

- Статус WebSocket-соединения (индикатор + ping)
- Список всех инструментов (~170 + 14) с возможностью тестового вызова (JSON-форма)
- Кнопка "Подключить к Cursor" → вызывает `POST /api/cursor/connect-mcp`
- Логи соединения (последние 100 строк)

#### Вкладка "Галерея"

- Все сгенерированные изображения проекта (из таблицы `generations`)
- Масонри-сетка с превью
- Фильтрация по дате, поиск по промпту
- Клик → модальное окно с полным изображением + метаданными + промптом

#### Вкладка "Библиотека скиллов"

- Читать `.md` файлы из `packages/mcp-godot/skills/` и `mcp/1/skills*.md`
- Карточки скиллов: имя, описание, категория, переключатель ON/OFF
- Включённые скиллы — инжектируются в system prompt при запросах к LLM
- Фильтрация по категориям

#### Вкладка "Файлы"

- Дерево файлов проекта (как Проводник/Explorer)
- Иконки типов файлов (`.gd`, `.tscn`, `.tres`, изображения и т.д.)
- **Превью изображений** — клик по `.png/.jpg/.svg/.webp` → показать в правой панели
- Кнопка "Открыть в Cursor" → `code --file-uri vscode://file/...` или вызов через `execa`
- Поддержка `.godot`-специфичных иконок

---

## SCALABILITY-ТРЕБОВАНИЯ

### Принципы, которые нужно заложить изначально:

1. **Plugin-система для скиллов** — каждый скилл это `SkillPlugin` с интерфейсом `{ id, name, execute(ctx), systemPrompt }`. Хранить в папке `skills/` как отдельные `.ts` модули.

2. **Event Bus** (на бэкенде) — все события (MCP connect/disconnect, генерация, ошибка) публикуются в EventEmitter, фронтенд слушает через SSE (`/api/events`).

3. **Абстракция LLM провайдера** — интерфейс `LLMProvider` с реализациями для OpenAI, Anthropic, Ollama (локальный). Выбор провайдера в настройках проекта.

4. **Абстракция хранилища** — интерфейс `StorageAdapter` (сейчас SQLite, в будущем PostgreSQL).

5. **Godot-плагин версионирование** — в БД хранить версию плагина, при несовместимости показывать предупреждение.

6. **Multi-project isolation** — каждый проект имеет свой WS-порт (из пула 6505–6514), своя агент-память.

7. **REST API versioning** — `/api/v1/...` с самого начала.

---

## ТРЕБОВАНИЯ К ЗАПУСКУ

```bash
# Dev режим
pnpm install
pnpm dev          # запускает web (порт 3000) + server (порт 3001) + mcp-godot (порт 6505)

# Production
pnpm build
pnpm start        # server раздаёт статику web + API

# Переменные окружения (server/.env)
GODOT_PATH=C:/Godot/Godot_v4.3.exe
PORT=3001
DB_PATH=./data/godhand.db
MEMORY_SERVICE_URL=http://localhost:8765
OPENAI_API_KEY=optional
```

---

## ДОПОЛНИТЕЛЬНО: ВСТРАИВАНИЕ В GODOT

Веб-интерфейс должен быть **embeddable**:
- Без хардкода `localhost` — конфигурируемый `BASE_URL`
- Адаптивная вёрстка: работать в `iframe` размером от 800×600
- `Content-Security-Policy` не должен блокировать iframe
- В Godot: `Control` нода с `WebBrowser` плагином или встроенным `HTTPRequest` + `TextureRect` для превью

---

## ПОРЯДОК РАЗРАБОТКИ (рекомендуемый)

```
Фаза 1 (MVP):
  ✓ Монорепо структура + pnpm workspaces
  ✓ SQLite схема + Drizzle миграции
  ✓ Объединённый mcp-godot сервер (WS relay + CLI tools)
  ✓ Главная страница (список проектов)
  ✓ Страница проекта (вкладка MCP + статус)
  ✓ Подключение к Cursor (запись mcp.json)

Фаза 2:
  ✓ Генерация спрайтов + галерея
  ✓ Библиотека скиллов (чтение .md + включение)
  ✓ Файловый браузер + превью

Фаза 3:
  ✓ agentmemory интеграция
  ✓ Тёмная/светлая тема
  ✓ Полный i18n RU/EN
  ✓ SSE event stream

Фаза 4 (масштабирование):
  ✓ Multi-LLM провайдеры
  ✓ Godot iframe embed
  ✓ Plugin API для скиллов
```
