/*
  Сырые данные курса. Модуль подключается динамически (loadContent в index.ts),
  поэтому JSON уходит в отдельный кусок, а не в основной бандл.
*/
import intakeJson from './intake.json'
import modulesJson from './modules.json'
import type { Content, IntakeContent, Module } from './types'

export const raw: Content = {
  modules: modulesJson as Module[],
  intake: intakeJson as IntakeContent,
}
