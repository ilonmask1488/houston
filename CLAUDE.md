# Houston — PWA для английского (младший брат «Сяо Хо»)

- ТЗ: `docs/SPEC.md`, технические требования разделов 3, 10, 11, 13, 14 — из `docs/SPEC_XIAOHUO.md`. План и решения — `docs/PLAN.md`.
- Фаза готова, когда зелёные `npm test`, `npm run check:content`, `npm run e2e`, `npm run build`, обновлён README и сняты скриншоты `docs/screens/phaseN/` (`$env:SCREENS='phaseN'; npx playwright test screens`).
- Стек: Vite 8 + React 19 + TypeScript 6 (strict), CSS-модули + токены `src/styles/tokens.css`, Dexie 4, vite-plugin-pwa, HashRouter, ts-fsrs.
- Все тексты интерфейса — `src/i18n/ru.ts`. Английский текст в разметке — с `lang="en"`.
- База `houston` (не `xiaohuo`): только JSON-совместимые значения. Схема `src/lib/db/schema.ts`: старые версии не правим, добавляем новую + фикстуру в `migrations.test.ts` + `migrateBackup`.
- Звук: `scripts/generate_audio.py` собирает пары (текст, голос) из всех JSON в `src/content` по правилам `collect_needs` (поле `voice` + `say`/`text`/`q`; `voices`; `speak`). Те же правила — в `scripts/content_lib.ts`. Меняешь одно — меняй второе.
- Сгенерированный контент — `reviewed: false`. Слова вводного теста проверяются по спискам NGSL/NAWL/BSL из `data/sources` (скачаны с newgeneralservicelist.com; домен `.org` захвачен спамом — не использовать).
- `useEffect(() => expr)` без фигурных скобок не писать: свежий Chrome возвращает промис из `window.scrollTo`, React принимает его за функцию очистки и падает.
- Python для скриптов — `.venv\Scripts\python.exe`.
- Контент пишется авторскими скриптами `scripts/author_phase1..4.py` (JSON руками не правим), затем `generate_audio.py` и `npm run check:content`.
- Маршруты упражнений с `:id` (модуль, текст, босс, эпизод) обёрнуты в `Remount` в `App.tsx`: без него переход из одного модуля прямо в другой оставлял раннер на шаге прошлого. Новый маршрут с `:id` — тоже в `Remount`.
- Боссы — обычные отрывок/текст/письма с модулями `boss-*`: в модули треков они не попадают, в библиотеку и «Скорочтение» — тоже (фильтр по `module.startsWith('boss')`).
