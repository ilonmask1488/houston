/* Vitest: контент грузится до каждого файла тестов — как в приложении до первого рендера. */
import { loadContent } from './index'

await loadContent()
