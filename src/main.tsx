import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { loadContent } from './content'
import { initApp } from './app/init'
import { LoadFailed } from './app/LoadFailed'
import { loadManifest } from './lib/audio/manifest'
import { installAudioUnlock } from './lib/audio/player'
import { storedField } from './lib/settings/settings'
import { applySkin } from './i18n/skins'
import './styles/base.css'

installAudioUnlock()

// Контент и манифест звука нужны экранам синхронно — рендерим, когда они загружены (из кэша это мгновенно).
// initApp — после контента: он заводит карточки по списку уроков.
const root = createRoot(document.getElementById('root')!)
// Специальность — до контента и отрисовки: по ней фильтруются тексты и термины и выбирается стиль.
// Ещё не выбрана — показываем как раньше (космос), а выбор спросит FieldPicker.
void storedField()
  .catch(() => undefined)
  .then((field) => {
    applySkin(field ?? 'space')
    return Promise.all([loadContent(field ?? 'space'), loadManifest()])
  })
  .then(() => initApp())
  .then(
    () => true,
    (e: unknown) => {
      console.error('loadContent', e)
      return false
    },
  )
  .then((ok) =>
    root.render(
      <StrictMode>
        {ok ? <App /> : <LoadFailed />}
      </StrictMode>,
    ),
  )
