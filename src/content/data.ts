/*
  Сырые данные курса. Модуль подключается динамически (loadContent в index.ts),
  поэтому JSON уходит в отдельный кусок, а не в основной бандл.
*/
import connected from './air/connected.json'
import passages from './air/passages.json'
import phrases from './air/phrases.json'
import chunks from './call/chunks.json'
import questions from './call/questions.json'
import substitution from './call/substitution.json'
import translate from './call/translate.json'
import characters from './characters.json'
import strategies from './doc/strategies.json'
import texts from './doc/texts.json'
import intakeJson from './intake.json'
import modulesJson from './modules.json'
import episodes from './story/episodes.json'
import storyQuestions from './story/questions.json'
import type {
  Character,
  Chunk,
  Connected,
  Content,
  DocText,
  Episode,
  IntakeContent,
  Module,
  Passage,
  Phrase,
  QuickQuestion,
  StoryQuestion,
  Substitution,
  TranslateItem,
} from './types'

export const raw: Content = {
  modules: modulesJson as Module[],
  intake: intakeJson as IntakeContent,
  // Объяснения модулей: явления связной речи (Эфир) и стратегии чтения (Техдок) — одного формата.
  connected: [...connected, ...strategies] as Connected[],
  phrases: phrases as Phrase[],
  passages: passages as Passage[],
  characters: characters as Character[],
  chunks: chunks as Chunk[],
  questions: questions as QuickQuestion[],
  translate: translate as TranslateItem[],
  substitution: substitution as Substitution[],
  storyQuestions: storyQuestions as StoryQuestion[],
  episodes: episodes as Episode[],
  texts: texts as unknown as DocText[],
}
