/*
  Сырые данные курса. Модуль подключается динамически (loadContent в index.ts),
  поэтому JSON уходит в отдельный кусок, а не в основной бандл.
*/
import connected from './air/connected.json'
import passages from './air/passages.json'
import phrases from './air/phrases.json'
import bosses from './boss/bosses.json'
import chunks from './call/chunks.json'
import questions from './call/questions.json'
import substitution from './call/substitution.json'
import translate from './call/translate.json'
import characters from './characters.json'
import cleanPhrases from './clean/phrases.json'
import pairs from './clean/pairs.json'
import stress from './clean/stress.json'
import strategies from './doc/strategies.json'
import texts from './doc/texts.json'
import falseFriends from './ff/false-friends.json'
import guides from './guides.json'
import intakeJson from './intake.json'
import mailBank from './mail/bank.json'
import mailFix from './mail/fix.json'
import mailOrder from './mail/order.json'
import mailRegister from './mail/register.json'
import mailWrite from './mail/write.json'
import modulesJson from './modules.json'
import episodes2 from './story/episodes-2.json'
import episodes from './story/episodes.json'
import storyQuestions from './story/questions.json'
import type {
  Bosses,
  Character,
  Chunk,
  CleanPhrase,
  Connected,
  Content,
  DocText,
  Episode,
  FalseFriend,
  IntakeContent,
  MailBankGroup,
  MailFix,
  MailOrder,
  MailRegister,
  MailWrite,
  MinimalPair,
  Module,
  Passage,
  Phrase,
  QuickQuestion,
  StoryQuestion,
  StressWord,
  Substitution,
  TranslateItem,
} from './types'

const boss = bosses as unknown as Bosses

export const raw: Content = {
  modules: modulesJson as Module[],
  intake: intakeJson as IntakeContent,
  // Объяснения модулей: связная речь (Эфир), стратегии чтения (Техдок), письма и произношение — одного формата.
  connected: [...connected, ...strategies, ...guides] as Connected[],
  // Боссы лежат среди обычных отрывков и текстов (модули boss-*), но в модули треков не попадают.
  phrases: phrases as Phrase[],
  passages: [...passages, boss.air] as Passage[],
  characters: characters as Character[],
  chunks: chunks as Chunk[],
  questions: questions as QuickQuestion[],
  translate: translate as TranslateItem[],
  substitution: substitution as Substitution[],
  storyQuestions: storyQuestions as StoryQuestion[],
  episodes: [...episodes, ...episodes2] as Episode[],
  texts: [...texts, boss.doc] as unknown as DocText[],
  mailRegister: [...mailRegister, ...boss.mail.register] as MailRegister[],
  mailFix: mailFix as MailFix[],
  mailOrder: mailOrder as MailOrder[],
  mailWrite: [...mailWrite, boss.mail.write] as MailWrite[],
  mailBank: mailBank as MailBankGroup[],
  pairs: pairs as MinimalPair[],
  cleanPhrases: cleanPhrases as CleanPhrase[],
  stress: stress as StressWord[],
  falseFriends: falseFriends as FalseFriend[],
  bosses: boss,
}
