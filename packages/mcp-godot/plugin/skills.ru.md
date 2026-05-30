> **Language:** [English](skills.md) | [日本語](skills.ja.md) | [Português (BR)](skills.pt-br.md) | [Español](skills.es.md) | Русский | [简体中文](skills.zh.md) | [हिन्दी](skills.hi.md)

# Godot MCP Pro — Навыки для ИИ-ассистентов

> Скопируйте этот файл в `.claude/skills.md` в корне вашего проекта Godot, чтобы дать Claude Code полный контекст по эффективному использованию Godot MCP Pro.

## Что такое Godot MCP Pro?

Вам доступны ~190 MCP-инструментов, которые напрямую подключаются к редактору Godot 4. Вы можете создавать сцены, писать скрипты, симулировать ввод игрока, инспектировать запущенные игры, экспортировать на телефоны и многое другое — всё это без выхода пользователя из данного разговора. Все изменения проходят через систему UndoRedo Godot, поэтому пользователь всегда может нажать Ctrl+Z.

### Начните отсюда: get_godot_guide

Перед сборкой вызовите **`get_godot_guide`**, чтобы загрузить актуальные рецепты воркфлоу:

```
get_godot_guide topic: "overview"        → золотые правила + рекомендуемый порядок
get_godot_guide topic: "quickstart-2d"   → рецепт 2D-игры с одного промпта
get_godot_guide topic: "quickstart-3d"   → рецепт 3D-игры с одного промпта
get_godot_guide topic: "mobile"          → iOS/Android + сенсорное управление
get_godot_guide topic: "optimization"    → плавность на телефонах
```

То же содержимое доступно как MCP-**ресурсы** (`godot-guide://<topic>`, `godot-skills://skills.md`) и готовые **промпты** (`build-2d-mobile-game`, `build-3d-mobile-game`).

### High-level билдеры (самый быстрый путь к играбельной игре)

Предпочитайте эти одношаговые сборщики, затем дорабатывайте точечными инструментами:

```
setup_2d_platformer_player  → CharacterBody2D + Sprite2D + CollisionShape2D + скрипт движения + Camera2D-следование
setup_3d_character          → CharacterBody3D + меш + CollisionShape3D + камера SpringArm3D + скрипт движения
apply_mobile_preset         → мобильный рендерер + stretch + сжатие текстур + кап FPS одним вызовом
setup_touch_controls        → экранный виртуальный джойстик + кнопки действий, привязанные к input-действиям
```

## Основные рабочие процессы

### 1. Изучение проекта

Всегда начинайте с понимания проекта перед внесением изменений:

```
get_project_info          → название проекта, версия Godot, рендерер, размер viewport
get_filesystem_tree       → структура директорий (используйте filter: "*.tscn" или "*.gd")
get_scene_tree            → иерархия нод текущей открытой сцены
read_script               → прочитать любой файл GDScript
get_project_settings      → проверить конфигурацию проекта
```

### 2. Создание 2D-сцены

```
create_scene   → создать файл .tscn с указанием типа корневой ноды
add_node       → добавить дочерние ноды со свойствами
create_script  → написать GDScript для игровой логики
attach_script  → прикрепить скрипт к ноде
update_property → установить position, scale, modulate и т.д.
save_scene     → сохранить на диск
```

**Быстрый путь:** вызовите `setup_2d_platformer_player`, чтобы за один шаг собрать всего игрока (ноды + скрипт движения + камера), затем дорабатывайте.

**Ручной путь — создание игрока:**
1. `create_scene` с root_type `CharacterBody2D`, path `res://scenes/player.tscn`
2. `add_node` типа `Sprite2D` со свойством texture
3. `add_node` типа `CollisionShape2D`
4. `add_resource` для назначения формы (например, `RectangleShape2D`) на CollisionShape2D
5. `create_script` с логикой движения
6. `attach_script` на корневую ноду
7. `save_scene`

**Инструменты 2D-мира и полировки:**
```
setup_camera_2d      → zoom, лимиты, сглаживание, drag-поля (привяжите к игроку для следования)
setup_parallax       → ParallaxBackground + слои для прокручиваемых фонов
add_animated_sprite  → AnimatedSprite2D + SpriteFrames из спрайт-листа (hframes x vframes)
setup_light_2d       → PointLight2D / DirectionalLight2D (+ CanvasModulate для дня/ночи)
create_tileset       → собрать TileSet-атлас из текстуры, затем tilemap_fill_rect / tilemap_set_cell
```

### 3. Создание 3D-сцены

**Быстрый путь:** вызовите `setup_3d_character`, чтобы за один шаг собрать персонажа от третьего лица (меш + коллизия + камера SpringArm3D + скрипт движения).

```
create_scene         → root_type: Node3D
add_mesh_instance    → добавить примитивы (box, sphere, cylinder, plane) или импортировать .glb/.gltf
setup_csg            → CSG-примитивы для быстрого блокаута уровней
add_multimesh        → MultiMeshInstance3D для производительного инстансинга (дружелюбно к мобилкам)
setup_lighting       → добавить DirectionalLight3D, OmniLight3D или SpotLight3D (preset: sun/indoor/dramatic)
setup_environment    → небо, окружающий свет, туман, tonemap
setup_camera_3d      → камера с опциональным SpringArm3D для вида от третьего лица
set_material_3d      → PBR-материалы (albedo, metallic, roughness, emission)
add_reflection_probe → локальные отражения; add_decal → проецируемые текстуры
setup_collision      → добавить формы столкновений к физическим телам (dimension: "3d")
setup_physics_body   → настроить массу, трение, гравитацию
```

### 4. Написание и редактирование скриптов

```
create_script  → создать новый файл .gd (укажите полное содержимое)
edit_script    → изменить существующие скрипты
  - Используйте `replacements: [{search: "old code", replace: "new code"}]` для точечных правок
  - Используйте `content` для полной замены файла
  - Используйте `insert_at_line` + `text` для вставки кода
validate_script → проверить синтаксические ошибки без запуска
read_script    → прочитать текущее содержимое перед редактированием
```

### 5. Тестирование и отладка

```
play_scene             → запустить игру (mode: "current", "main" или путь к файлу)
get_game_screenshot    → увидеть, как игра выглядит прямо сейчас
capture_frames         → захватить несколько кадров для наблюдения за движением/анимацией
get_game_scene_tree    → инспектировать дерево сцены в runtime
get_game_node_properties → прочитать значения в runtime (position, health, state и т.д.)
set_game_node_property → изменить значения в запущенной игре
simulate_key           → нажать клавиши (WASD, SPACE и т.д.) с указанием длительности
simulate_mouse_click   → кликнуть по координатам viewport
simulate_action        → вызвать действия InputMap (move_left, jump и т.д.)
get_editor_errors      → проверить ошибки выполнения
stop_scene             → остановить игру
```

**Цикл плейтестинга:**
1. `play_scene` → запустить игру
2. `get_game_screenshot` → увидеть текущее состояние
3. `simulate_key` / `simulate_action` → взаимодействовать с игрой
4. `capture_frames` → наблюдать поведение во времени
5. `get_game_node_properties` → проверить конкретные значения
6. `stop_scene` → остановить по завершении
7. Исправить проблемы в скриптах → повторить

### 6. Анимации

```
# Убедитесь, что в сцене есть нода AnimationPlayer
create_animation       → новая анимация с длительностью и режимом зацикливания
add_animation_track    → добавить треки property/transform/method
set_animation_keyframe → вставить ключевые кадры в определённые моменты
get_animation_info     → просмотреть существующие анимации
```

**Пример — прыгающий спрайт:**
1. `create_animation` name `bounce`, length `1.0`, loop_mode `1` (линейный цикл)
2. `add_animation_track` track_path `Sprite2D:position`, track_type `value`
3. `set_animation_keyframe` time `0.0`, value `Vector2(0, 0)`
4. `set_animation_keyframe` time `0.5`, value `Vector2(0, -50)`
5. `set_animation_keyframe` time `1.0`, value `Vector2(0, 0)`

### 7. UI / HUD

```
add_node          → Control, Label, Button, TextureRect и т.д.
set_anchor_preset → позиционирование Controls (full_rect, center, bottom_wide и т.д.)
set_theme_color   → изменить font_color и т.д.
set_theme_font_size → настроить размер текста
set_theme_stylebox  → фоны, рамки, скруглённые углы
connect_signal    → подключить pressed кнопки, value_changed и т.д.
```

### 8. TileMap

```
tilemap_get_info      → проверить источники набора тайлов и раскладку атласа
tilemap_set_cell      → разместить отдельные тайлы
tilemap_fill_rect     → заполнить прямоугольные области
tilemap_get_used_cells → посмотреть, что уже размещено
tilemap_clear         → очистить все ячейки
```

### 9. Аудио

```
add_audio_bus        → создать аудио-шины (SFX, Music, UI)
set_audio_bus        → настроить громкость, соло, заглушение
add_audio_bus_effect → добавить реверберацию, задержку, компрессор и т.д.
add_audio_player     → добавить ноды AudioStreamPlayer(2D/3D)
```

### 10. Конфигурация проекта

```
set_project_setting  → изменить размер viewport, настройки физики и т.д.
set_input_action     → определить маппинг ввода (move_left → KEY_A и т.д.)
add_autoload         → зарегистрировать синглтоны autoload
set_physics_layers   → именовать слои столкновений (player, enemy, world и т.д.)
```

## Важные правила и подводные камни

### Значения свойств
Свойства автоматически парсятся из строк. Используйте следующие форматы:
- Vector2: `"Vector2(100, 200)"`
- Vector3: `"Vector3(1, 2, 3)"`
- Color: `"Color(1, 0, 0, 1)"` или `"#ff0000"`
- Bool: `"true"` / `"false"`
- Числа: `"42"`, `"3.14"`
- Enum: Используйте целочисленные значения (например, `0` для первого значения enum)

### Никогда не редактируйте project.godot напрямую
Редактор Godot постоянно перезаписывает `project.godot`. Всегда используйте `set_project_setting` для изменения настроек проекта.

### Аннотации типов в GDScript
При написании GDScript с циклами `for` по нетипизированным массивам используйте явные аннотации типов:
```gdscript
# ПЛОХО — приведёт к ошибкам
for item in some_untyped_array:
    var x := item.value  # вывод типов не работает

# ХОРОШО
for i in range(some_untyped_array.size()):
    var item: Dictionary = some_untyped_array[i]
    var x: int = item.value
```

### Изменения скриптов требуют перезагрузки
После создания или значительного изменения скриптов используйте `reload_project`, чтобы Godot подхватил изменения. Особенно важно после `create_script`.

### Советы по simulate_key
- Используйте **короткие длительности** (0.3–0.5 секунд) для точного перемещения
- Длинные длительности (1+ секунда) приводят к промахам
- Для тестирования геймплея предпочитайте `simulate_action` вместо `simulate_key`, когда определены действия InputMap

### simulate_mouse_click
- По умолчанию `auto_release: true` отправляет press и release — необходимо для UI-кнопок
- UI-кнопки срабатывают на release, поэтому нужны оба события

### Ограничения execute_game_script
- Нельзя использовать вложенные функции (`func` внутри `func`) — вызывает ошибку компиляции
- Используйте `.get("property")` вместо `.property` для динамического доступа
- Ошибки выполнения приостанавливают отладчик (автоматически продолжается, но лучше избегать)

### Коллизии и области подбора
- Для собираемых предметов используйте Area3D/Area2D с радиусом >= 1.5
- Меньшие радиусы почти невозможно активировать симулированным вводом

### Сохраняйте часто
Вызывайте `save_scene` после значительных изменений. Несохранённые изменения могут быть потеряны при перезагрузке редактора.

## Инструменты анализа и отладки

Когда что-то пошло не так, используйте эти инструменты для расследования:

```
get_editor_errors          → проверить ошибки скриптов и исключения runtime
get_output_log             → прочитать вывод print() и предупреждения
analyze_scene_complexity   → найти узкие места производительности
analyze_signal_flow        → визуализировать соединения сигналов
detect_circular_dependencies → найти циклические ссылки скриптов/сцен
find_unused_resources      → очистить неиспользуемые файлы
get_performance_monitors   → FPS, память, draw calls, статистика физики
```

## Тестирование и QA

```
run_test_scenario   → определить и запустить автоматизированные тестовые сценарии
assert_node_state   → проверить, что свойства нод соответствуют ожидаемым значениям
assert_screen_text  → проверить, что текст отображается на экране
compare_screenshots → визуальное регрессионное тестирование (используйте пути к файлам, не base64)
run_stress_test     → создать множество нод для тестирования производительности
```

## Продвинутые паттерны

### Операции между сценами
```
cross_scene_set_property → изменить ноды в сценах, которые сейчас не открыты
find_node_references     → найти все файлы, ссылающиеся на паттерн
batch_set_property       → установить свойство для всех нод определённого типа
```

### Работа с шейдерами
```
create_shader        → написать шейдерный код в стиле GLSL
assign_shader_material → применить к ноде
set_shader_param     → настроить uniform-параметры в runtime
get_shader_params    → просмотреть текущие значения
```

### Навигация (3D)
```
setup_navigation_region → определить проходимую область
bake_navigation_mesh   → сгенерировать навигационную сетку
setup_navigation_agent → добавить поиск пути для персонажей
```

### AnimationTree и конечные автоматы
```
create_animation_tree           → настроить AnimationTree с конечным автоматом или деревом смешивания
add_state_machine_state         → добавить состояния (idle, walk, run, jump)
add_state_machine_transition    → определить переходы между состояниями
set_tree_parameter              → управлять параметрами смешивания
```

## Мобильная разработка (iOS и Android)

Сделать так, чтобы игра не просто работала на телефонах, а ощущалась отлично.

### Подготовка к мобилкам
```
apply_mobile_preset   → рендерер (mobile/gl_compatibility), stretch (canvas_items/expand),
                        сжатие текстур VRAM (ETC2/ASTC), MSAA и кап FPS одним вызовом
setup_touch_controls  → виртуальный джойстик + кнопки действий на CanvasLayer, привязанные к input-действиям
apply_safe_area       → держать HUD вне вырезов/скруглений (runtime DisplayServer safe area)
```

### Деплой на Android
```
list_android_devices  → проверить подключённое устройство через adb
deploy_to_android     → экспорт APK + adb install -r + запуск (одним вызовом)
get_android_preset_info → инспектировать настроенный Android-пресет экспорта
```

### Деплой на iOS (для подписанного IPA нужен macOS + Xcode)
```
get_ios_preset_info → инспектировать iOS-пресет (bundle id, путь экспорта)
export_ios          → сгенерировать Xcode-проект / IPA (на не-macOS вернёт понятное примечание)
list_ios_targets    → список устройств/симуляторов (только macOS)
```

### Мобильная оптимизация
```
optimize_for_mobile      → приоритизированные рекомендации (рендерер, сжатие текстур, кап FPS,
                          источники света с тенями, CSG, draw calls); auto_apply: true для безопасных правок
get_performance_monitors → живые FPS, draw calls, VRAM, счётчики объектов
analyze_scene_complexity → статические горячие точки сложности
add_multimesh            → свернуть множество повторяющихся мешей в один draw call
```

Правила для мобилок: используйте **Mobile-рендерер**, включайте сжатие **ETC2/ASTC**, оставляйте **мало реалтайм-теней**, выключайте **glow/SSAO/SSR**, ограничивайте FPS до **60** и предпочитайте **MultiMesh** для толп/пропсов.

## Рецепты «игра с одного промпта»

### 2D-платформер под Android (от и до)
1. `apply_mobile_preset` { renderer: "mobile", base_width: 1080, base_height: 1920 }
2. `set_input_action` для move_left/move_right/jump
3. `setup_2d_platformer_player` { scene_path: "res://scenes/player.tscn", left_action: "move_left", right_action: "move_right", jump_action: "jump" }
4. `create_scene` { root_type: "Node2D", path: "res://scenes/world.tscn" }; `add_scene_instance` игрока
5. `create_tileset` из текстуры; `tilemap_fill_rect` для земли; `setup_collision` для твёрдых тел
6. `setup_parallax` + `setup_light_2d` для атмосферы; `apply_particle_preset` для сочности
7. `setup_touch_controls` { joystick: true, buttons: [{ action: "jump", text: "A" }] }
8. HUD через Control + `apply_safe_area`; `add_audio_player` для музыки
9. `play_scene` + `get_game_screenshot`, итерации; `optimize_for_mobile`
10. `deploy_to_android` { launch: true }

### 3D от третьего лица под iOS (от и до)
1. `apply_mobile_preset` { renderer: "mobile" }
2. `set_input_action` для движения + прыжка
3. `setup_3d_character` { scene_path: "res://scenes/player.tscn", mesh_type: "CapsuleMesh" }
4. `create_scene` { root_type: "Node3D" }; `add_scene_instance` игрока
5. `setup_csg` блокаут (или `add_mesh_instance` + `setup_collision` dimension "3d"); `add_multimesh` для пропсов
6. `setup_lighting` { preset: "sun", shadows: true } + `setup_environment` { background_mode: "sky", tonemap_mode: "ACES" }
7. `setup_touch_controls`; HUD + `apply_safe_area`
8. `play_scene` + `get_game_screenshot`, итерации; `optimize_for_mobile`
9. `export_ios` (для завершения IPA нужны macOS + Xcode)

## Рекомендуемый порядок работы

При создании новой игры с нуля:

1. **Гайд** — `get_godot_guide` (overview, затем quickstart-2d / quickstart-3d / mobile)
2. **Настройка проекта** — `get_project_info`, `set_project_setting`; для телефонов рано вызовите `apply_mobile_preset`
3. **Маппинг ввода** — `set_input_action` для всех управлений игрока
4. **Игрок** — `setup_2d_platformer_player` или `setup_3d_character` (затем доработка)
5. **Главная/мировая сцена** — `create_scene`, разместить игрока, построить окружение (TileMap/parallax или меши/CSG)
6. **Игровая логика** — скрипты для врагов, предметов, UI
7. **Мобильный ввод** — `setup_touch_controls` + `apply_safe_area`
8. **Аудио** — настроить шины, добавить аудиоплееры
9. **Плейтестинг** — `play_scene`, тест с симулированным вводом, исправление багов
10. **Полировка и оптимизация** — анимации, частицы, шейдеры, темы; `optimize_for_mobile`
11. **Экспорт** — `deploy_to_android` / `export_ios` / `export_project`
