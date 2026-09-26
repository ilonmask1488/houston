import { Placeholder, Screen } from '../../components/ui'
import { ru } from '../../i18n/ru'

export function DictionaryScreen() {
  return (
    <Screen title={ru.dictionary.title}>
      <Placeholder mood="thinking" text={ru.dictionary.empty} />
    </Screen>
  )
}
