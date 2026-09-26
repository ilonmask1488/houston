import { db } from '../lib/db/db'

/**
  Первый запуск: запоминаем дату (от неё считается напоминание о бэкапе)
  и просим браузер не удалять данные при нехватке места.
*/
export async function initApp(): Promise<void> {
  try {
    if ((await db.getMeta('firstLaunchAt')) === undefined) await db.setMeta('firstLaunchAt', Date.now())
    if (navigator.storage?.persist) {
      const persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist())
      await db.setMeta('storagePersisted', persisted)
    }
  } catch (e) {
    console.error('initApp', e)
  }
}
