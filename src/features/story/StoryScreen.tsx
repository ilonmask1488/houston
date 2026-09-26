import { Placeholder, Screen } from '../../components/ui'
import { ru } from '../../i18n/ru'

export function StoryScreen() {
  return (
    <Screen title={ru.story.title} subtitle={ru.story.subtitle}>
      <Placeholder mood="thinking" text={ru.story.empty} />
    </Screen>
  )
}
