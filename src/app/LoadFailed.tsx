import ui from '../components/ui.module.css'
import { ru } from '../i18n/ru'
import s from './Shell.module.css'

/** Контент не загрузился (нет сети при первом запуске, битый кэш) — без него приложение пустое. */
export function LoadFailed() {
  return (
    <div className={s.fatal} role="alert">
      <p>{ru.errors.content}</p>
      <button type="button" className={ui.primary} onClick={() => location.reload()}>
        {ru.errors.retry}
      </button>
    </div>
  )
}
