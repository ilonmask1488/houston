"""
Контент фазы 4 — Телеграмма (переписка), Чистый сигнал (произношение), «Ложные друзья»,
эпизоды 4–6 и боссы треков.

  .venv\\Scripts\\python.exe scripts\\author_phase4.py

Всё — собственный текст приложения, reviewed: false. Результат:
  src/content/guides.json          объяснения модулей Телеграммы и Чистого сигнала (формат как у Эфира)
  src/content/mail/*.json          упражнения писем и банк фраз
  src/content/clean/*.json         минимальные пары, фразы, ударение, интонация
  src/content/ff/false-friends.json
  src/content/story/episodes-2.json
  src/content/boss/bosses.json
"""
import json
from pathlib import Path

from author_phase3 import split_sentences

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "content"
STD = ["us-f", "us-m", "gb-f", "gb-m"]
CHARS = {"dana": "us-f", "tom": "au-m", "oliver": "gb-m", "priya": "in-f", "arjun": "in-m", "sophie": "gb-f", "mike": "us-m", "grace": "au-f"}

# ——— Объяснения модулей ———
GUIDES = {
    "mail-structure": {
        "intro": [
            "Деловое письмо по-английски короче русского. Схема: тема → обращение → одна фраза, зачем пишешь → суть → конкретная просьба со сроком → завершение → подпись.",
            "Читающий должен понять, чего от него хотят, по теме и первой строке. Всё остальное — детали.",
        ],
        "rules": [
            ["Subject", "конкретно, 4–8 слов", "Subject: Test report for bracket B-12"],
            ["Greeting", "имя и запятая, без «!»", "Hi Dana, / Dear Ms Clark,"],
            ["Purpose", "первая фраза — зачем", "I'm writing to ask about the delivery date."],
            ["Request", "что и к какому сроку", "Could you confirm by Thursday?"],
            ["Closing", "вместо «С уважением»", "Best regards, / Kind regards,"],
        ],
        "tip": "Одно письмо — одна тема. Если вопросов несколько — пронумеруй их: так на каждый ответят.",
    },
    "mail-register": {
        "intro": [
            "Регистр — насколько официально звучит письмо. Формальный — незнакомым людям, официальным лицам, в первом письме в компанию. Нейтральный — коллегам и партнёрам: это большинство рабочих писем. Дружеский — своей команде и тем, с кем уже на «ты».",
            "Русский деловой стиль, переведённый дословно, по-английски звучит холодно и тяжеловесно. Если сомневаешься — выбирай нейтральный.",
        ],
        "rules": [
            ["formal", "Dear… / I would be grateful if… / Kind regards", "I would be grateful if you could send the specification."],
            ["neutral", "Hi… / Could you…? / Best regards", "Could you send me the specification?"],
            ["friendly", "Hey… / Can you…? / Thanks! / Cheers", "Can you send me the spec when you get a sec?"],
        ],
        "tip": "Вежливость в английском — через вопрос: «Could you…?», «Would you mind…?». Повелительное «Send me…» звучит как приказ, даже с please.",
    },
    "mail-apply": {
        "intro": [
            "Отклик на вакансию: какая позиция, почему именно ты (одно-два конкретных достижения), что приложил. Не пересказывай резюме — оно во вложении.",
            "Благодарность после собеседования — в течение суток, три-четыре предложения: спасибо за время, одна конкретная деталь разговора, интерес к позиции.",
        ],
        "rules": [
            ["позиция", "назови точно", "I'm applying for the Junior Design Engineer position."],
            ["почему ты", "конкретика, цифры", "I designed and tested a composite bracket that was 30% lighter."],
            ["вложения", "что приложено", "I've attached my CV and a short portfolio."],
            ["после встречи", "спасибо + деталь", "I especially enjoyed hearing about your test lab."],
        ],
        "tip": "«I have big experience» — калька. Говори «I have experience with…» и сразу пример.",
    },
    "mail-request": {
        "intro": [
            "Запрос информации: одна фраза контекста (кто ты и откуда вопрос), конкретный вопрос, срок и почему он такой.",
            "Напоминание (follow-up) — без упрёков. Не «I didn't receive any answer», а «Just following up on my email from Monday». Можно коротко повторить вопрос, чтобы не искали старое письмо.",
        ],
        "rules": [
            ["контекст", "одна фраза", "We're preparing the qualification test for the adapter."],
            ["вопрос", "конкретно", "What torque do you recommend for the M8 bolts?"],
            ["срок", "по «by», не «until»", "Could you let me know by Friday?"],
            ["follow-up", "мягко", "Just checking in on my question below."],
        ],
        "tip": "«Until Friday» — «до пятницы, пока длится», «by Friday» — «не позже пятницы». Для сроков нужен by.",
    },
    "mail-decline": {
        "intro": [
            "Уточнить: «Just to clarify…», «Do you mean… or…?» — предложи варианты, так проще ответить.",
            "Отказать: поблагодари, скажи «нет» ясно одним предложением, объясни коротко и предложи альтернативу. Перенести встречу: извинись один раз и сразу предложи два-три слота.",
        ],
        "rules": [
            ["уточнить", "варианты на выбор", "Just to clarify — do you need the report or the raw data?"],
            ["отказ", "ясно + альтернатива", "Unfortunately, we can't test it this week, but we could do it on Tuesday."],
            ["перенос", "одно извинение + слоты", "Could we move our call? I'm free at 10 or 3 on Thursday."],
            ["без драмы", "не «Sorry, sorry»", "Sorry for the short notice."],
        ],
        "tip": "Одна вежливая фраза лучше трёх извинений: много «sorry» звучит неуверенно.",
    },
    "mail-status": {
        "intro": [
            "Отчёт о статусе читают за 30 секунд. Три блока: что сделано, что мешает, что дальше — с цифрами и датами.",
            "Главный вопрос руководителя — «успеваем?». Ответь на него в первой строке: «On track», «At risk», «Delayed by two days».",
        ],
        "rules": [
            ["Done", "что сделано", "Done: 12 of 15 specimens tested."],
            ["Blocked", "что мешает", "Blocked: the load cell is being recalibrated."],
            ["Next", "что дальше и когда", "Next: remaining tests on Wednesday, report on Friday."],
            ["статус", "первой строкой", "Status: on track for the Friday deadline."],
        ],
        "tip": "Плохие новости — рано и с планом: «We're two days behind because…, so we'll…».",
    },
    "clean-th": {
        "intro": [
            "Звуков θ (think) и ð (this) в русском нет. Их заменяют на «с», «ф», «з», «д» — и think превращается в sink «тонуть», three в free.",
            "Кончик языка — между зубами или прижат к ним изнутри. Выдыхай через щель: для θ — без голоса, для ð — с голосом, как «з», но язык у зубов.",
        ],
        "rules": [
            ["θ", "глухой, язык у зубов", "think, three, thick, thermal"],
            ["ð", "звонкий, язык у зубов", "this, they, other, then"],
            ["не с/ф/з", "проверь в зеркале: кончик языка виден", "think ≠ sink, three ≠ free"],
        ],
        "tip": "Сначала медленно и преувеличенно: язык чуть высунут. В быстрой речи он сам спрячется за зубы — но звук останется.",
    },
    "clean-wv": {
        "intro": [
            "В русском есть только «в» (губа касается зубов). В английском ещё w: губы вытянуты трубочкой и не касаются зубов, как короткое «у».",
            "West с «в» звучит как vest (жилет), wine — как vine (лоза). Для w: сначала «у», потом сразу гласная: «у-эст».",
        ],
        "rules": [
            ["w", "губы трубочкой, зубы не участвуют", "we, west, wire, weld"],
            ["v", "верхние зубы на нижней губе", "very, valve, vibration"],
            ["wh", "в современном английском как w", "which, where, while"],
        ],
        "tip": "Тренировка: «вэ-вэ-вэ» ↔ «уэ-уэ-уэ» перед зеркалом. Во фразе «We will verify the valve» оба звука рядом.",
    },
    "clean-h": {
        "intro": [
            "Английский h — лёгкий выдох, как будто дышишь на стекло. Русское «х» — трение в глубине рта, оно звучит грубо: «хаус» вместо house.",
            "Ещё одна ловушка — выбросить h совсем: heat превратится в eat, hold в old.",
        ],
        "rules": [
            ["h", "выдох без трения", "house, high, heat, hole"],
            ["не «х»", "горло расслаблено", "house ≠ «хаус»"],
            ["не пропускай", "h меняет слово", "heat ≠ eat, hold ≠ old"],
        ],
        "tip": "Поднеси ладонь ко рту: на h должна чувствоваться тёплая струя воздуха, а не шум.",
    },
    "clean-vowels": {
        "intro": [
            "В английском длина и качество гласной различают слова: ship (корабль) — sheep (овца), full (полный) — fool (дурак), bed (кровать) — bad (плохой).",
            "Краткие ɪ и ʊ — расслабленные, ближе к «ы» и короткому «у». Долгие iː и uː — напряжённые и длинные. æ в bad — широко открытый рот, между «а» и «э».",
        ],
        "rules": [
            ["ɪ — iː", "ship — sheep", "fill the sheet, leave it"],
            ["ʊ — uː", "full — fool", "a full pool of fuel"],
            ["e — æ", "bed — bad", "men — man, set — sat"],
        ],
        "tip": "Для iː улыбнись, для ɪ расслабь губы. Для æ опусти челюсть, как будто удивился.",
    },
    "clean-final": {
        "intro": [
            "В русском звонкие на конце оглушаются: «код» звучит как «кот». В английском так нельзя: bed (кровать) превращается в bet (ставка), bag (сумка) — в back (спина).",
            "Держи голос на последнем согласном и сделай гласную перед ним чуть длиннее: гласная перед звонким всегда длиннее, чем перед глухим.",
        ],
        "rules": [
            ["d — t", "bed — bet", "wide — white, card — cart"],
            ["g — k", "bag — back", "big — pick"],
            ["z — s", "eyes — ice", "prize — price"],
            ["v — f", "leave — leaf", "save — safe"],
        ],
        "tip": "Слушай гласную: в bed она длиннее, чем в bet. Даже если конечный звук недозвучал, длина гласной спасает слово.",
    },
    "clean-ng": {
        "intro": [
            "ŋ — носовой звук, как «н», но задняя часть языка прижата к нёбу, как для «г». Самого «г» на конце нет: sing — не «синг».",
            "Если заменить ŋ на «н», sing превратится в sin (грех), thing — в thin (тонкий).",
        ],
        "rules": [
            ["ŋ", "задняя часть языка к нёбу, звук через нос", "sing, thing, bearing"],
            ["без «г»", "звук просто затихает", "ring ≠ «ринг»"],
            ["-ing", "то же самое", "testing, making, cooling"],
        ],
        "tip": "Скажи «анга» и остановись перед «а»: это и есть ŋ. Потом убери «а» совсем.",
    },
    "clean-stress": {
        "intro": [
            "Неправильное ударение мешает понять слово сильнее, чем неточный звук. В английском ударение не подвижное по падежам, но в родственных словах переезжает: PHOtograph — phoTOgraphy — photoGRAPHic.",
            "Технические слова русский узнаёт, но ставит ударение по-русски: «технолОгия» → techNOLogy, «материАл» → maTErial, «параметр» → paRAMeter.",
        ],
        "rules": [
            ["-tion, -sion", "ударение перед суффиксом", "simuLAtion, inforMAtion"],
            ["-ity, -ogy, -ical", "ударение перед суффиксом", "caPACity, techNOLogy, meCHANical"],
            ["-eer", "ударение на суффикс", "engiNEER"],
        ],
        "tip": "Ударный слог — дольше, громче и выше. Безударные гласные сжимаются до ə: parameter — pə-RÆ-mə-tə.",
    },
    "clean-intonation": {
        "intro": [
            "Русская интонация ровная и падает на конце. По-английски ровная просьба звучит сухо или раздражённо, даже если слова вежливые.",
            "Вежливый вопрос «да/нет» идёт вверх на конце. Благодарность и приветствие — широкий размах голоса. Смягчить несогласие — «падение-подъём»: голос опускается и поднимается на конце, как недоговорённость.",
        ],
        "rules": [
            ["вопрос да/нет", "вверх на конце", "Could you send me the drawing?"],
            ["благодарность", "широкий размах", "Thanks a lot, that's really helpful!"],
            ["мягкое несогласие", "вниз-вверх на конце", "I'm not sure that's right…"],
        ],
        "tip": "Смотри на график тона: образец — сплошная линия, ты — пунктир. Не нужно совпасть точно, нужна та же форма: где поднимается и где опускается.",
    },
}

# ——— Телеграмма ———
# Регистр: (модуль, ситуация, нужный регистр, [верный, …], почему)
REGISTER = [
    ("mail-structure", "Пишешь первое письмо профессору из другого университета. Обращение?", "formal",
     ["Dear Professor Miller,", "Hey Prof!", "Hi,"], "Первое письмо незнакомому человеку — формально, с фамилией и званием."),
    ("mail-structure", "Письмо коллеге Дане, с которой каждый день на планёрке. Завершение?", "neutral",
     ["Best,", "Yours faithfully,", "With respect,"], "«Yours faithfully» — для писем «Dear Sir or Madam», «With respect» — калька «С уважением»."),
    ("mail-structure", "Письмо в незнакомую компанию, имя адресата неизвестно. Обращение?", "formal",
     ["Dear Sir or Madam,", "Hi guys,", "Dear friend,"], "Если имени нет — «Dear Sir or Madam» или «Dear Hiring Team»."),
    ("mail-register", "Коллега из соседнего отдела, вы общались пару раз. Нужна его модель в CAD.", "neutral",
     ["Could you send me the CAD model of the bracket, please?", "Send me the CAD model.", "I would be most grateful if you could kindly provide the CAD model at your earliest convenience."],
     "Нейтральная просьба — вопрос с could. Приказ звучит грубо, а слишком формально — странно для коллеги."),
    ("mail-register", "Своей команде в чат после сданного отчёта.", "friendly",
     ["Great job, everyone — thanks for the late nights!", "I would like to express my gratitude to all team members.", "The report is submitted."],
     "Своей команде — тепло и коротко. Официальная благодарность звучит холодно."),
    ("mail-register", "Официальный запрос в испытательный центр о стоимости испытаний.", "formal",
     ["I would be grateful if you could provide a quotation for the tests described below.", "Hey, how much for the tests?", "Tell me the price."],
     "Официальный запрос незнакомой организации — формально."),
    ("mail-apply", "Отклик на вакансию, первая фраза письма.", "formal",
     ["I am writing to apply for the Junior Design Engineer position advertised on your website.", "Hi! I want this job.", "Hello, I saw your vacancy and I want to try."],
     "В отклике — формально и конкретно: какая позиция и где увидел."),
    ("mail-apply", "Благодарность после собеседования, завершающая фраза.", "neutral",
     ["I look forward to hearing from you.", "Waiting for your answer.", "Call me."],
     "«Waiting for your answer» — калька, звучит как нетерпение."),
    ("mail-apply", "Тимлид Дана после собеседования написала: «Hi! Great to meet you today». Ответ?", "neutral",
     ["Hi Dana, great to meet you too, and thanks again for your time!", "Dear Madam, I acknowledge receipt of your message.", "ok thx"],
     "Отвечай в том же регистре, что и собеседник: дружелюбно, но аккуратно."),
    ("mail-request", "Поставщик, с которым уже переписывались. Спросить про срок поставки.", "neutral",
     ["Could you let me know when the valves will be shipped?", "When will you ship the valves?!", "We hereby request information regarding the shipment date."],
     "Нейтральный вопрос с could. Восклицательный знак звучит как претензия."),
    ("mail-request", "Напоминание коллеге, который неделю не отвечает.", "neutral",
     ["Just following up on my email from last week — any update on the drawings?", "I didn't receive any answer from you.", "As I already wrote you, I need the drawings."],
     "Follow-up — мягко и без упрёка. «As I already wrote» звучит как обвинение."),
    ("mail-request", "Коллега Прия, с которой вы дружите. Попросить фото стенда.", "friendly",
     ["Hey Priya, can you snap a photo of the rig when you get a chance? Thanks!", "Dear Ms Patel, I would be grateful for a photograph of the test rig.", "Photo of the rig. Now."],
     "С близким коллегой — по-дружески. Формальный тон удивит."),
    ("mail-decline", "Отказать поставщику, который предлагает свои датчики.", "neutral",
     ["Thank you for the offer. Unfortunately, it doesn't fit our needs at the moment.", "No.", "Your sensors are bad."],
     "Поблагодари, откажи ясно и без оценки."),
    ("mail-decline", "Перенести созвон с руководителем проекта из другой компании.", "neutral",
     ["Would it be possible to move our call to Thursday? I'm free at 10:00 or 15:00.", "I can't today. Sorry sorry sorry.", "We will talk on Thursday."],
     "Одно извинение и конкретные варианты времени."),
    ("mail-decline", "Уточнить у руководителя, что именно нужно в отчёте.", "neutral",
     ["Just to clarify — should the report include the raw data or only the summary?", "What do you want?", "I don't understand your task."],
     "Уточнение с вариантами: на него легко ответить одним словом."),
    ("mail-status", "Еженедельный статус своей команде в чате.", "friendly",
     ["Quick update: 12 of 15 specimens done, the rest on Wednesday 👍", "Dear colleagues, I hereby inform you about the status of the tests.", "tests going"],
     "В своей команде — коротко и по-дружески, но с цифрами."),
    ("mail-status", "Статус заказчику: испытания задерживаются.", "neutral",
     ["We're two days behind schedule because the load cell is being recalibrated. We expect to finish on Friday.", "Tests are late. Sorry.", "Due to unforeseen circumstances beyond our control, the schedule has been subject to modification."],
     "Честно, с причиной и новым сроком. Канцелярит скрывает суть."),
    ("mail-status", "Первая строка статуса руководителю.", "neutral",
     ["Status: on track for the Friday deadline.", "Hello! How are you? I hope you are fine. Now I will tell you about the tests.", "Everything is ok probably."],
     "Главное — первой строкой: успеваем или нет."),
]

# «Слишком по-русски»: (модуль, контекст, неудачная фраза, [лучше, …], почему)
FIX = [
    ("mail-structure", "Начало письма всей группе", "Dear colleagues!",
     ["Hi all,", "Dear colleagues!!!", "Hello, dear colleagues!"], "В английском обращение заканчивается запятой, восклицательный знак — русская привычка. Для команды — «Hi all,» или «Hi everyone,»."),
    ("mail-structure", "Подпись в конце письма", "With respect, Ivan",
     ["Best regards, Ivan", "Respectfully yours, Ivan", "With big respect, Ivan"], "«With respect» — калька «С уважением». Стандарт — «Best regards» или «Kind regards»."),
    ("mail-structure", "Первая фраза письма", "I am writing to you with the purpose to ask about the delivery.",
     ["I'm writing to ask about the delivery.", "I write you for asking about the delivery.", "The purpose of my letter is asking about the delivery."], "Коротко: «I'm writing to ask about…»."),
    ("mail-register", "Просьба коллеге", "Give me please the drawings of the bracket.",
     ["Could you send me the drawings of the bracket, please?", "Give me the drawings of the bracket, please!", "You must give me the drawings of the bracket."], "Повелительное наклонение звучит как приказ даже с please. Просьба — это вопрос."),
    ("mail-register", "Просьба руководителю", "It is necessary to send the report.",
     ["Could you send the report by Friday?", "It is needed to send the report.", "The report must be sent."], "Безличное «необходимо» — русский канцелярит. Скажи прямо, кто и что должен сделать."),
    ("mail-register", "Начало письма незнакомому инженеру", "Sorry for disturbing you.",
     ["I hope you don't mind me reaching out.", "Sorry for disturbing you very much.", "Excuse me for my disturbing."], "Извиняться за само письмо не нужно. Если хочется смягчить — «I hope you don't mind me reaching out»."),
    ("mail-apply", "Отклик на вакансию", "I am interested in the vacancy of engineer.",
     ["I'm interested in the Design Engineer position.", "I am interested in the vacancy of the engineer.", "I have interest to the engineer vacancy."], "«Vacancy of engineer» — калька. Позиция называется «the … position» с точным названием."),
    ("mail-apply", "Отклик на вакансию", "I have big experience in CAD.",
     ["I have solid experience with CAD, mainly SolidWorks.", "I have a big experience in CAD.", "My experience in CAD is big."], "Experience не бывает big. Говори «solid / hands-on experience with…» и уточняй."),
    ("mail-apply", "После собеседования", "Thank you for the interview, it was very pleasant for me.",
     ["Thank you for taking the time to speak with me today — I really enjoyed our conversation.", "Thank you for the interview, it was very pleasant to me.", "The interview was pleasant for me, thank you."], "«Pleasant for me» — калька. «I really enjoyed…» звучит естественно."),
    ("mail-request", "Срок в запросе", "Can you send me the report until Friday?",
     ["Could you send me the report by Friday?", "Can you send me the report till Friday?", "Can you send me the report before Friday until?"], "Срок — by («не позже»). Until — «пока длится»: «I'll be in the lab until Friday»."),
    ("mail-request", "Напоминание", "I didn't receive any answer from you.",
     ["Just checking in — have you had a chance to look at my question?", "I didn't get any answer from you yet!", "Why didn't you answer?"], "Звучит как обвинение. Follow-up — мягкий: «Just checking in…»."),
    ("mail-request", "Вопрос коллеге", "I have a question to you.",
     ["I have a question for you.", "I have a question at you.", "I have to you a question."], "Вопрос — for someone, не to."),
    ("mail-decline", "Предложить время встречи", "I propose you to meet on Monday.",
     ["How about meeting on Monday?", "I propose you meeting on Monday.", "I offer you to meet on Monday."], "После propose/suggest не бывает «you to». Проще: «How about…?» или «I suggest meeting…»."),
    ("mail-decline", "Отказ на просьбу срочно провести испытание", "It is impossible.",
     ["Unfortunately, that won't be possible this week, but we could run it on Tuesday.", "It is absolutely impossible.", "Impossible, sorry."], "Голое «impossible» звучит резко. Смягчи «unfortunately» и предложи альтернативу."),
    ("mail-decline", "Перенос встречи", "Sorry, sorry, I can't come, I'm so sorry.",
     ["Sorry for the short notice — could we move our meeting to Thursday?", "Sorry, sorry, I can't come.", "I am very very sorry that I can't come."], "Одно извинение и сразу предложение. Много «sorry» звучит неуверенно."),
    ("mail-status", "Отчёт о статусе", "We made the test yesterday.",
     ["We ran the test yesterday.", "We did make the test yesterday.", "We have made the test yesterday."], "Испытания проводят (run / carry out / do), а не make. И с yesterday — Past Simple."),
    ("mail-status", "Отчёт о статусе", "The deadline is burning.",
     ["The deadline is very close.", "The deadline is on fire.", "The deadline burns."], "«Горит» — русская метафора. По-английски: «very close», «tight», «we're running out of time»."),
    ("mail-status", "Отчёт о статусе", "The results will be sent to you additionally.",
     ["I'll send you the results separately.", "The results will be additionally sent.", "Additionally I will send you results additionally."], "«Дополнительно» здесь — «отдельно» или «позже»: separately / later."),
]

# Собрать письмо из блоков: (модуль, что за письмо, [блоки в верном порядке])
ORDER = [
    ("mail-structure", "Запрос протокола испытаний", [
        "Subject: Test report for bracket B-12",
        "Hi Tom,",
        "I'm writing to ask about the vibration test of bracket B-12.",
        "Could you send me the test report and the raw data?",
        "I need them by Thursday to finish the analysis.",
        "Thanks in advance,",
        "Ivan",
    ]),
    ("mail-register", "Официальный запрос в испытательный центр", [
        "Subject: Request for quotation – static tests of composite panels",
        "Dear Sir or Madam,",
        "I am a design engineer at Orbita Lab, and we are planning static tests of six composite panels.",
        "I would be grateful if you could provide a quotation and your earliest available dates.",
        "The test specification is attached.",
        "Kind regards,",
        "Ivan Petrov",
    ]),
    ("mail-apply", "Отклик на вакансию", [
        "Subject: Application – Junior Design Engineer",
        "Dear Ms Clark,",
        "I am writing to apply for the Junior Design Engineer position advertised on your website.",
        "I am a fourth-year student in rocket and space engineering, and in my current project I designed and tested a composite bracket that was 30% lighter than the aluminium one.",
        "I have attached my CV and a short portfolio.",
        "I look forward to hearing from you.",
        "Kind regards,",
        "Ivan Petrov",
    ]),
    ("mail-request", "Напоминание о чертежах", [
        "Subject: Re: Drawings for the adapter ring",
        "Hi Oliver,",
        "Just following up on my email from Monday.",
        "Could you send the updated drawings of the adapter ring?",
        "We need them by Wednesday to order the material.",
        "Thanks,",
        "Ivan",
    ]),
    ("mail-decline", "Перенос созвона", [
        "Subject: Moving our Tuesday call",
        "Hi Grace,",
        "Sorry for the short notice, but I need to move our call on Tuesday — the test rig is only available that morning.",
        "Would Wednesday at 10:00 or Thursday at 15:00 work for you?",
        "Best regards,",
        "Ivan",
    ]),
    ("mail-status", "Еженедельный статус", [
        "Subject: Weekly status – panel tests",
        "Hi Dana,",
        "Status: on track for the Friday deadline.",
        "Done: 12 of 15 panels tested, no unexpected failures.",
        "Blocked: the load cell is being recalibrated until Tuesday.",
        "Next: the last three panels on Wednesday, draft report on Friday.",
        "Best,",
        "Ivan",
    ]),
]

# Напиши сам: (модуль, задание, входящее письмо или None, образец, что проверить)
WRITE = [
    ("mail-structure", "Напиши Тому (Австралия, лаборатория), что тебе нужны фотографии разрушенных образцов к среде для отчёта.", None,
     "Subject: Photos of the failed specimens\n\nHi Tom,\n\nI'm writing to ask for photos of the failed specimens from last week's tensile tests. Could you send them by Wednesday? I need them for the test report.\n\nThanks,\nIvan",
     ["тема конкретная", "первая фраза — зачем пишешь", "просьба вопросом с could", "срок — by Wednesday", "подпись без «With respect»"]),
    ("mail-register", "Коллега из британского офиса спросил, можно ли взять вашу термокамеру на следующей неделе. Ответь нейтрально: можно в понедельник и вторник, в среду она занята.",
     "Hi Ivan,\n\nWould it be possible to borrow your thermal chamber next week? We need it for about two days.\n\nThanks,\nSophie",
     "Hi Sophie,\n\nSure, you can use the chamber on Monday and Tuesday. On Wednesday it's booked for our own tests, so it would need to be back by Tuesday evening.\n\nBest regards,\nIvan",
     ["ответ в том же регистре", "ясно: какие дни можно", "причина, почему в среду нельзя", "без лишних извинений"]),
    ("mail-apply", "Напиши благодарность после собеседования Дане (тимлид). Упомяни одну деталь разговора — например, их вибростенд.", None,
     "Subject: Thank you\n\nHi Dana,\n\nThank you for taking the time to speak with me today. I especially enjoyed hearing about your vibration test lab — it's exactly the kind of work I'd like to do.\n\nI look forward to hearing from you.\n\nBest regards,\nIvan",
     ["в течение суток", "спасибо за время", "одна конкретная деталь", "интерес к работе", "3–5 предложений"]),
    ("mail-request", "Поставщик клапанов обещал ответить про сроки неделю назад и молчит. Напиши вежливое напоминание и повтори вопрос.",
     "Hi Ivan,\n\nThanks for your order. I'll check the lead time with our factory and get back to you by Monday.\n\nBest,\nArjun",
     "Hi Arjun,\n\nJust following up on the lead time for the solenoid valves. Could you let me know when you expect to ship them? We need to plan the test campaign.\n\nThanks,\nIvan",
     ["без упрёка", "вопрос повторён", "объяснено, зачем нужен ответ", "коротко"]),
    ("mail-decline", "Руководитель проекта из другой компании просит провести дополнительное испытание до пятницы. Стенд занят до среды следующей недели. Откажи и предложи альтернативу.",
     "Hi Ivan,\n\nCould your team run one more fatigue test before Friday? It would really help us with the design review.\n\nBest regards,\nGrace",
     "Hi Grace,\n\nThanks for asking. Unfortunately, our rig is fully booked until next Wednesday, so we can't run the test before Friday. We could start it on Wednesday and share first results on Thursday. Would that work for your review?\n\nBest regards,\nIvan",
     ["поблагодарил", "«нет» сказано ясно", "короткая причина", "альтернатива с датой", "вопрос в конце"]),
    ("mail-status", "Напиши Дане статус испытаний: 9 из 12 образцов испытаны, датчик силы на поверке до вторника, отчёт будет в пятницу вместо четверга.", None,
     "Subject: Status – fatigue tests\n\nHi Dana,\n\nStatus: one day behind.\nDone: 9 of 12 specimens tested.\nBlocked: the load cell is being calibrated until Tuesday.\nNext: the last three specimens on Wednesday, report on Friday instead of Thursday.\n\nBest,\nIvan",
     ["статус первой строкой", "что сделано — цифрами", "что мешает", "что дальше — с датами", "новый срок назван честно"]),
]

# Банк фраз: (группа, [(англ, рус, регистр)])
BANK = [
    ("Начать письмо", [
        ("I'm writing to ask about…", "Пишу, чтобы спросить о…", "neutral"),
        ("I'm writing regarding…", "Пишу по поводу…", "formal"),
        ("Following our call on Monday, …", "По итогам нашего созвона в понедельник…", "neutral"),
        ("Thanks for your email.", "Спасибо за письмо.", "neutral"),
        ("I hope you're doing well.", "Надеюсь, у вас всё хорошо.", "neutral"),
        ("Quick question: …", "Короткий вопрос: …", "friendly"),
    ]),
    ("Попросить", [
        ("Could you send me…?", "Не могли бы вы прислать…?", "neutral"),
        ("Would you mind checking…?", "Вы не против проверить…?", "neutral"),
        ("I would be grateful if you could…", "Буду признателен, если вы…", "formal"),
        ("Could you let me know by Friday?", "Сообщите, пожалуйста, до пятницы.", "neutral"),
        ("Can you take a look when you get a chance?", "Глянь, когда будет минутка.", "friendly"),
    ]),
    ("Напомнить", [
        ("Just following up on my email from Monday.", "Возвращаюсь к моему письму от понедельника.", "neutral"),
        ("Just checking in on…", "Хотел уточнить, как там…", "friendly"),
        ("I wanted to follow up on…", "Хотел вернуться к…", "neutral"),
        ("Any update on…?", "Есть новости по…?", "friendly"),
    ]),
    ("Уточнить", [
        ("Just to clarify, …", "Чтобы уточнить: …", "neutral"),
        ("Do you mean… or…?", "Вы имеете в виду… или…?", "neutral"),
        ("Could you confirm that…?", "Подтвердите, пожалуйста, что…", "neutral"),
        ("If I understand correctly, …", "Если я правильно понимаю, …", "neutral"),
    ]),
    ("Отказать и перенести", [
        ("Unfortunately, that won't be possible this week.", "К сожалению, на этой неделе не получится.", "neutral"),
        ("I'm afraid we can't…", "Боюсь, мы не сможем…", "neutral"),
        ("However, we could…", "Однако мы могли бы…", "neutral"),
        ("Could we move our meeting to…?", "Можем перенести встречу на…?", "neutral"),
        ("Sorry for the short notice.", "Извините, что так поздно предупреждаю.", "neutral"),
    ]),
    ("Вложения", [
        ("Please find attached…", "Во вложении…", "formal"),
        ("I've attached…", "Прикладываю…", "neutral"),
        ("Here's the file.", "Вот файл.", "friendly"),
        ("The link is below.", "Ссылка ниже.", "neutral"),
    ]),
    ("Статус", [
        ("Status: on track.", "Статус: успеваем.", "neutral"),
        ("We're two days behind because…", "Отстаём на два дня, потому что…", "neutral"),
        ("Blocked by…", "Задерживается из-за…", "neutral"),
        ("Next steps: …", "Дальнейшие шаги: …", "neutral"),
    ]),
    ("Завершить", [
        ("Let me know if you have any questions.", "Если есть вопросы — пишите.", "neutral"),
        ("I look forward to hearing from you.", "Жду вашего ответа.", "formal"),
        ("Thanks in advance.", "Заранее спасибо.", "neutral"),
        ("Best regards, / Kind regards,", "С уважением,", "neutral"),
        ("Thanks! / Cheers,", "Спасибо! / Пока,", "friendly"),
    ]),
]

# ——— Чистый сигнал ———
# Минимальные пары: (модуль, a, b, МФА a, МФА b, перевод a, перевод b)
PAIRS = [
    ("clean-th", "think", "sink", "θɪŋk", "sɪŋk", "думать", "тонуть; раковина"),
    ("clean-th", "thick", "sick", "θɪk", "sɪk", "толстый", "больной"),
    ("clean-th", "three", "free", "θriː", "friː", "три", "свободный"),
    ("clean-th", "thumb", "sum", "θʌm", "sʌm", "большой палец", "сумма"),
    ("clean-th", "path", "pass", "pæθ", "pæs", "путь", "проход; пропуск"),
    ("clean-th", "mouth", "mouse", "maʊθ", "maʊs", "рот", "мышь"),
    ("clean-th", "they", "day", "ðeɪ", "deɪ", "они", "день"),
    ("clean-th", "then", "zen", "ðen", "zen", "тогда", "дзен"),
    ("clean-wv", "west", "vest", "west", "vest", "запад", "жилет"),
    ("clean-wv", "wine", "vine", "waɪn", "vaɪn", "вино", "лоза"),
    ("clean-wv", "wet", "vet", "wet", "vet", "мокрый", "ветеринар"),
    ("clean-wv", "worse", "verse", "wɜːs", "vɜːs", "хуже", "стих"),
    ("clean-wv", "wheel", "veal", "wiːl", "viːl", "колесо", "телятина"),
    ("clean-wv", "while", "vile", "waɪl", "vaɪl", "пока", "мерзкий"),
    ("clean-h", "heat", "eat", "hiːt", "iːt", "тепло; нагрев", "есть"),
    ("clean-h", "hold", "old", "həʊld", "əʊld", "держать", "старый"),
    ("clean-h", "hear", "ear", "hɪə", "ɪə", "слышать", "ухо"),
    ("clean-h", "hair", "air", "heə", "eə", "волосы", "воздух"),
    ("clean-h", "hill", "ill", "hɪl", "ɪl", "холм", "больной"),
    ("clean-h", "heart", "art", "hɑːt", "ɑːt", "сердце", "искусство"),
    ("clean-vowels", "ship", "sheep", "ʃɪp", "ʃiːp", "корабль", "овца"),
    ("clean-vowels", "live", "leave", "lɪv", "liːv", "жить", "уходить"),
    ("clean-vowels", "fill", "feel", "fɪl", "fiːl", "заполнять", "чувствовать"),
    ("clean-vowels", "full", "fool", "fʊl", "fuːl", "полный", "дурак"),
    ("clean-vowels", "pull", "pool", "pʊl", "puːl", "тянуть", "бассейн"),
    ("clean-vowels", "bed", "bad", "bed", "bæd", "кровать", "плохой"),
    ("clean-vowels", "men", "man", "men", "mæn", "мужчины", "мужчина"),
    ("clean-vowels", "sit", "seat", "sɪt", "siːt", "сидеть", "сиденье"),
    ("clean-final", "bed", "bet", "bed", "bet", "кровать", "ставка"),
    ("clean-final", "bag", "back", "bæɡ", "bæk", "сумка", "спина; назад"),
    ("clean-final", "prize", "price", "praɪz", "praɪs", "приз", "цена"),
    ("clean-final", "eyes", "ice", "aɪz", "aɪs", "глаза", "лёд"),
    ("clean-final", "card", "cart", "kɑːd", "kɑːt", "карта", "тележка"),
    ("clean-final", "wide", "white", "waɪd", "waɪt", "широкий", "белый"),
    ("clean-final", "leave", "leaf", "liːv", "liːf", "уходить", "лист"),
    ("clean-final", "save", "safe", "seɪv", "seɪf", "сохранять", "безопасный"),
    ("clean-ng", "sing", "sin", "sɪŋ", "sɪn", "петь", "грех"),
    ("clean-ng", "thing", "thin", "θɪŋ", "θɪn", "вещь", "тонкий"),
    ("clean-ng", "wing", "win", "wɪŋ", "wɪn", "крыло", "побеждать"),
    ("clean-ng", "rang", "ran", "ræŋ", "ræn", "звонил", "бежал"),
    ("clean-ng", "sung", "sun", "sʌŋ", "sʌn", "спетый", "солнце"),
    ("clean-ng", "king", "kin", "kɪŋ", "kɪn", "король", "родня"),
]

# Фразы для постановки звука: (модуль, фраза, на что обратить внимание, перевод)
PHRASES = [
    ("clean-th", "I think the thread is three millimetres thick.", "θ в think, thread, three, thick — язык у зубов", "Думаю, нить толщиной три миллиметра."),
    ("clean-th", "The thermal model is worth the effort.", "θ в thermal и worth, ð в the", "Тепловая модель стоит затраченных усилий."),
    ("clean-th", "They say the other method is better than this one.", "ð — звонкий: they, the, other, than, this", "Говорят, другой метод лучше этого."),
    ("clean-th", "Both of them thought it through.", "θ в both, thought, through; ð в them", "Они оба всё продумали."),
    ("clean-wv", "We will verify the valve on Wednesday.", "w в we, will, Wednesday; v в verify, valve", "Мы проверим клапан в среду."),
    ("clean-wv", "The vibration was very weak.", "v в vibration, very; w в was, weak", "Вибрация была очень слабой."),
    ("clean-wv", "Which version of the drawing do we use?", "w в which, we; v в version", "Какую версию чертежа мы используем?"),
    ("clean-wv", "Every wire was well insulated.", "v в every; w в wire, was, well", "Каждый провод был хорошо изолирован."),
    ("clean-h", "How high is the heat load?", "h — выдох: how, high, heat", "Насколько велика тепловая нагрузка?"),
    ("clean-h", "He has half an hour.", "h в he, has, half; hour — без h!", "У него есть полчаса."),
    ("clean-h", "The housing holds the heater.", "h в housing, holds, heater", "Нагреватель закреплён в корпусе."),
    ("clean-h", "Hold the handle with both hands.", "h в hold, handle, hands", "Держи ручку обеими руками."),
    ("clean-vowels", "Please fill in this sheet before you leave.", "ɪ в fill, this; iː в please, sheet, leave", "Пожалуйста, заполни этот лист перед уходом."),
    ("clean-vowels", "The fuel line is full of air.", "uː в fuel, ʊ в full", "В топливной магистрали полно воздуха."),
    ("clean-vowels", "The bad batch was sent back.", "æ в bad, batch, back; e в sent", "Бракованную партию отправили обратно."),
    ("clean-vowels", "We need a bigger seal for this bit.", "iː в need, seal; ɪ в bigger, this, bit", "Для этой детали нужно уплотнение побольше."),
    ("clean-final", "The load is too big for this bracket.", "звонкие d в load и g в big", "Нагрузка слишком велика для этого кронштейна."),
    ("clean-final", "We had to change the grade of the bolt.", "звонкие d в had, grade", "Пришлось сменить класс прочности болта."),
    ("clean-final", "The weld was good, but the plate was bad.", "d в weld, good, bad — не оглушай", "Сварной шов был хороший, а вот пластина — плохая."),
    ("clean-final", "Please save the file and close the tab.", "v в save, z в close, b в tab", "Пожалуйста, сохрани файл и закрой вкладку."),
    ("clean-ng", "The bearing is making a strange ringing sound.", "ŋ в bearing, making, ringing — без «г»", "Подшипник издаёт странный звенящий звук."),
    ("clean-ng", "We are testing the wing today.", "ŋ в testing, wing", "Сегодня мы испытываем крыло."),
    ("clean-ng", "Something is wrong with the spring.", "ŋ в something, wrong, spring", "С пружиной что-то не так."),
    ("clean-ng", "Bring the long fitting, please.", "ŋ в bring, long, fitting", "Принеси, пожалуйста, длинный фитинг."),
]

# Ударение: (слово, слоги, индекс ударного, МФА, перевод)
STRESS = [
    ("develop", ["de", "vel", "op"], 1, "dɪˈveləp", "разрабатывать"),
    ("technology", ["tech", "nol", "o", "gy"], 1, "tekˈnɒlədʒi", "технология"),
    ("analysis", ["a", "nal", "y", "sis"], 1, "əˈnæləsɪs", "анализ"),
    ("component", ["com", "po", "nent"], 1, "kəmˈpəʊnənt", "компонент, деталь"),
    ("hypothesis", ["hy", "poth", "e", "sis"], 1, "haɪˈpɒθəsɪs", "гипотеза"),
    ("mechanical", ["me", "chan", "i", "cal"], 1, "məˈkænɪkəl", "механический"),
    ("parameter", ["pa", "ram", "e", "ter"], 1, "pəˈræmɪtə", "параметр"),
    ("photograph", ["pho", "to", "graph"], 0, "ˈfəʊtəɡrɑːf", "фотография (снимок)"),
    ("photography", ["pho", "tog", "ra", "phy"], 1, "fəˈtɒɡrəfi", "фотография (занятие)"),
    ("determine", ["de", "ter", "mine"], 1, "dɪˈtɜːmɪn", "определять"),
    ("engineer", ["en", "gi", "neer"], 2, "ˌendʒɪˈnɪə", "инженер"),
    ("material", ["ma", "te", "ri", "al"], 1, "məˈtɪəriəl", "материал"),
    ("prototype", ["pro", "to", "type"], 0, "ˈprəʊtətaɪp", "прототип"),
    ("simulation", ["sim", "u", "la", "tion"], 2, "ˌsɪmjuˈleɪʃən", "моделирование"),
    ("capacity", ["ca", "pac", "i", "ty"], 1, "kəˈpæsəti", "ёмкость, мощность"),
    ("accuracy", ["ac", "cu", "ra", "cy"], 0, "ˈækjərəsi", "точность"),
    ("algorithm", ["al", "go", "rithm"], 0, "ˈælɡərɪðəm", "алгоритм"),
    ("specimen", ["spec", "i", "men"], 0, "ˈspesɪmɪn", "образец"),
    ("diameter", ["di", "am", "e", "ter"], 1, "daɪˈæmɪtə", "диаметр"),
    ("geometry", ["ge", "om", "e", "try"], 1, "dʒiˈɒmətri", "геометрия"),
    ("procedure", ["pro", "ce", "dure"], 1, "prəˈsiːdʒə", "процедура, методика"),
    ("manufacture", ["man", "u", "fac", "ture"], 2, "ˌmænjuˈfæktʃə", "изготавливать"),
    ("category", ["cat", "e", "go", "ry"], 0, "ˈkætəɡəri", "категория"),
    ("economy", ["e", "con", "o", "my"], 1, "ɪˈkɒnəmi", "экономика"),
]

# Интонация: (фраза, перевод, что делает голос)
INTONATION = [
    ("Could you send me the drawing, please?", "Не могли бы вы прислать чертёж?", "вопрос да/нет — голос поднимается на конце"),
    ("Would you mind checking the numbers again?", "Вы не против ещё раз проверить цифры?", "мягкий подъём на again"),
    ("Sorry, could you repeat that?", "Извините, можно повторить?", "подъём на конце — это просьба, а не требование"),
    ("Thanks a lot, that's really helpful!", "Большое спасибо, это очень помогло!", "широкий размах: высоко на thanks и really"),
    ("I'm not sure that's right.", "Не уверен, что это так.", "вниз-вверх на right: мягкое несогласие"),
    ("That's a good point, but I see it differently.", "Хорошее замечание, но я вижу это иначе.", "подъём на point, спокойное падение в конце"),
    ("Do you have a minute?", "Есть минутка?", "подъём на конце"),
    ("Good morning, everyone!", "Доброе утро всем!", "приветствие — с размахом, не ровно"),
]

# ——— Ложные друзья: (id, русское, контекст, [верно, ловушка, ещё вариант], почему) ———
FALSE_FRIENDS = [
    ("design", "конструкция", "Конструкция кронштейна слишком тяжёлая.", ["design", "construction", "constructive"],
     "Construction — строительство, стройка. Конструкция изделия — design (как устроено) или structure (несущая часть)."),
    ("part", "деталь", "Эта деталь изготовлена из титана.", ["part", "detail", "item"],
     "Detail — подробность, мелкая особенность. Деталь изделия — part (или component)."),
    ("design-project", "проект (конструкторский)", "Проект узла готов на 80 %.", ["design", "project", "draft"],
     "Project — работа, затея целиком («наш проект по композитам»). Сам проект изделия, чертежи и модель — design."),
    ("design-engineer", "конструктор", "Я работаю конструктором.", ["design engineer", "constructor", "builder"],
     "Constructor — конструктор в программировании или строитель. Инженер-конструктор — design engineer."),
    ("test", "испытание", "Испытание на растяжение прошло успешно.", ["test", "experience", "examination"],
     "Experience — опыт, examination — осмотр или экзамен. Испытание — test (или trial для натурных)."),
    ("strength", "прочность", "Нужно проверить прочность соединения.", ["strength", "durability", "firmness"],
     "Durability — долговечность, способность долго служить. Прочность — strength."),
    ("neat", "аккуратный", "У него очень аккуратные чертежи.", ["neat", "accurate", "exact"],
     "Accurate — точный (accurate measurements). Аккуратный — neat (о работе, почерке) или careful (о человеке)."),
    ("surname", "фамилия", "Напишите фамилию латиницей.", ["surname", "family", "nickname"],
     "Family — семья, nickname — прозвище. Фамилия — surname, last name или family name."),
    ("shop", "магазин", "Купил болты в магазине рядом.", ["shop", "magazine", "market"],
     "Magazine — журнал (или магазин оружия). Магазин — shop (BrE) или store (AmE)."),
    ("relevant", "актуальный", "Эта тема очень актуальна.", ["relevant", "actual", "actually"],
     "Actual — фактический, настоящий (the actual load — фактическая нагрузка). Актуальный — relevant, current или up-to-date."),
    ("rubber", "резина", "Уплотнение из резины.", ["rubber", "resin", "gum"],
     "Resin — смола (эпоксидная смола — epoxy resin). Резина — rubber."),
    ("cylinder", "баллон (газовый)", "Баллон с азотом стоит у стенда.", ["cylinder", "balloon", "bulb"],
     "Balloon — воздушный шар. Газовый баллон — gas cylinder или bottle."),
    ("service-life", "ресурс (двигателя)", "Ресурс двигателя — 500 часов.", ["service life", "resource", "reserve"],
     "Resource — запас, ресурс в смысле средств. Ресурс изделия — service life (или life)."),
    ("unit", "агрегат", "Агрегат подачи топлива заменили.", ["unit", "aggregate", "aggregator"],
     "Aggregate — заполнитель бетона или совокупность. Агрегат в технике — unit или assembly."),
    ("installation", "монтаж", "Монтаж датчиков займёт два дня.", ["installation", "montage", "editing"],
     "Montage — монтаж фильма или коллаж. Монтаж оборудования — installation или assembly."),
    ("review", "экспертиза", "Проект прошёл экспертизу.", ["expert review", "expertise", "expert"],
     "Expertise — компетентность, знания. Экспертиза — expert review, examination или assessment."),
    ("office", "кабинет", "Зайди ко мне в кабинет.", ["office", "cabinet", "cab"],
     "Cabinet — шкаф (или кабинет министров). Кабинет — office."),
    ("ten-days", "декада", "Отчёт сдаём в первой декаде месяца.", ["the first ten days", "the first decade", "the first dozen"],
     "Decade — десятилетие. Декада месяца — ten days."),
    ("chuck", "патрон (станка)", "Зажми заготовку в патроне.", ["chuck", "patron", "cartridge"],
     "Patron — покровитель или клиент. Патрон токарного станка — chuck; патрон с порохом — cartridge."),
    ("schedule", "график (работ)", "По графику испытания в мае.", ["schedule", "graphic", "graph"],
     "Graphic — изображение, графика; graph — график функции. График работ — schedule."),
    ("diagram", "схема", "Посмотри электрическую схему.", ["diagram", "scheme", "schema"],
     "Scheme — план или махинация. Схема (рисунок) — diagram; электрическая — circuit diagram, wiring diagram."),
    ("reasonable", "адекватный", "Это адекватное решение.", ["reasonable", "adequate", "adequately"],
     "Adequate — достаточный, «сойдёт». Адекватный (разумный) — reasonable или sensible."),
    ("efficient", "эффективный (двигатель)", "Новый двигатель эффективнее.", ["more efficient", "more effective", "more active"],
     "Effective — дающий нужный результат; efficient — с меньшими затратами, с высоким КПД. Двигатель — efficient."),
    ("educated", "интеллигентный", "Он очень интеллигентный человек.", ["well-educated and cultured", "intelligent", "intellectual"],
     "Intelligent — умный, сообразительный. Интеллигентный — well-educated, cultured, well-mannered."),
    ("performer", "артист", "На корпоративе выступал артист.", ["performer", "artist", "artiste"],
     "Artist — прежде всего художник. Артист на сцене — performer, actor, singer."),
    ("thesis", "дипломная работа", "Тема моего диплома — композитные панели.", ["graduation thesis", "diploma", "diploma work"],
     "Diploma — сам документ об окончании. Дипломная работа — graduation thesis или final-year project."),
]

# ——— Эпизоды 4–6 (формат как в author_phase2) ———
EPISODES = [
    {
        "id": "ep-4", "n": 4, "title": "Испытания и отчёт", "place": "Лаборатория, стенд статических испытаний",
        "after": "doc-structure",
        "intro": "Первые испытания композитной панели. Прия ведёт испытание, Том отвечает за стенд, а потом Дана спрашивает про результаты.",
        "lines": [
            ("priya", "Okay, the panel is mounted and the strain gauges are connected. Can you check the readings before we start loading?", "Так, панель закреплена, тензодатчики подключены. Проверишь показания, прежде чем начнём нагружать?"),
            ("me", [
                ("Sure. All channels read close to zero, except channel four — it's drifting a bit.", "Конечно. Все каналы около нуля, кроме четвёртого — он немного плывёт.", None),
                ("Everything is normal, I think, maybe.", "Всё нормально, думаю, может быть.", "Слишком расплывчато. Назови, что именно проверил."),
                ("Channel four is broken, the test is cancelled.", "Четвёртый канал сломан, испытание отменяется.", "Слишком резко: сначала опиши, что видишь, решение принимает руководитель испытания."),
            ]),
            ("tom", "Drifting? Let me re-seat the connector. Right, try now.", "Плывёт? Сейчас переткну разъём. Так, попробуй теперь."),
            ("me", [
                ("That fixed it. Channel four is stable now.", "Помогло. Четвёртый канал теперь стабилен.", None),
                ("Now is good.", "Сейчас хорошо.", "Понятно, но неуклюже. «That fixed it» — естественнее."),
                ("I don't know.", "Не знаю.", "Проверь и скажи результат — от тебя этого ждут."),
            ]),
            ("priya", "Great. We'll load in steps of two kilonewtons and hold each step for thirty seconds.", "Отлично. Нагружаем ступенями по два килоньютона, каждую держим тридцать секунд."),
            ("me", [
                ("Got it. Should I stop at the design limit load or go all the way to failure?", "Понял. Останавливаемся на расчётной эксплуатационной нагрузке или идём до разрушения?", None),
                ("Okay, go.", "Ладно, поехали.", "Уточни, до какой нагрузки идём: это важно для безопасности и для отчёта."),
                ("Why thirty seconds?", "Почему тридцать секунд?", "Вопрос допустим, но важнее уточнить, где останавливаемся."),
            ]),
            ("priya", "Limit load today. Failure test is next week.", "Сегодня — до эксплуатационной. Испытание до разрушения — на следующей неделе."),
            ("dana", "So, how did it go? Anything I should worry about?", "Ну как прошло? Есть о чём беспокоиться?"),
            ("me", [
                ("It went well. The panel reached limit load with no damage, and the strains were about eight percent below the prediction.", "Всё прошло хорошо. Панель дошла до эксплуатационной нагрузки без повреждений, деформации примерно на восемь процентов ниже расчётных.", None),
                ("It was good test. Very good.", "Было хорошее испытание. Очень хорошее.", "Без цифр руководителю не на что опереться. И нужен артикль: «a good test»."),
                ("Tom broke the connector.", "Том сломал разъём.", "Не так было, и не с этого начинают. Сначала главное: результат."),
            ]),
            ("dana", "Nice. Can you put that in a short report by Friday?", "Отлично. Сможешь оформить короткий отчёт к пятнице?"),
            ("me", [
                ("Sure. I'll include the load–strain curves and a comparison with the FEA.", "Конечно. Добавлю графики нагрузка–деформация и сравнение с расчётом МКЭ.", None),
                ("Friday is impossible.", "Пятница — невозможно.", "Если срок нереален — объясни почему и предложи другой, а не просто «невозможно»."),
                ("Yes, I will make a report.", "Да, я сделаю отчёт.", "Можно, но лучше сразу сказать, что будет в отчёте. И «write a report», не «make»."),
            ]),
        ],
        "culture": ("Плохие новости и цифры",
                    "В англоязычных командах ценят, когда о проблеме говорят сразу и спокойно: «Channel four is drifting a bit» лучше, чем молчать или драматизировать. А результат руководителю — с главным и цифрой в первом предложении: «It went well. The strains were 8% below the prediction»."),
    },
    {
        "id": "ep-5", "n": 5, "title": "Письмо поставщику", "place": "Офис, потом звонок в Индию",
        "after": "mail-request",
        "intro": "Датчики давления от поставщика опаздывают. Дана просит тебя написать поставщику, а потом перезванивает Арджун из отдела продаж.",
        "lines": [
            ("dana", "The pressure sensors were supposed to arrive last week. Could you write to the supplier and find out what's going on?", "Датчики давления должны были прийти на прошлой неделе. Напишешь поставщику, узнаешь, что происходит?"),
            ("me", [
                ("Sure. Do you want me to ask for a new delivery date or to cancel the order?", "Конечно. Спросить новую дату поставки или отменить заказ?", None),
                ("Okay.", "Ладно.", "Лучше сразу уточнить цель письма: от этого зависит тон."),
                ("Why me?", "Почему я?", "Звучит как нежелание. Уточни задачу, а не спорь."),
            ]),
            ("dana", "Just a new date for now. We still need them.", "Пока только новую дату. Они нам всё ещё нужны."),
            ("me", [
                ("Subject: Order 4471 – delivery date. Hi Arjun, I'm writing about our order 4471 for twelve pressure sensors.", "Тема: Заказ 4471 — дата поставки. Здравствуйте, Арджун, пишу по поводу нашего заказа 4471 на двенадцать датчиков давления.", None),
                ("Subject: URGENT!!! Where are our sensors?", "Тема: СРОЧНО!!! Где наши датчики?", "Капс и восклицательные знаки звучат как крик. Тема — конкретная и спокойная."),
                ("Subject: Question. Dear Sir, I am writing to you with the purpose to know about sensors.", "Тема: Вопрос. Уважаемый господин, пишу вам с целью узнать о датчиках.", "Тема ничего не говорит, а фраза — калька. Номер заказа в теме экономит время обеим сторонам."),
            ]),
            ("me", [
                ("They were due last week and we haven't received them yet. Could you let me know the new delivery date?", "Они должны были прийти на прошлой неделе, но мы их пока не получили. Сообщите, пожалуйста, новую дату поставки.", None),
                ("You didn't send them and we are very angry.", "Вы их не отправили, и мы очень злы.", "Эмоции не помогут получить дату. Факт + вопрос."),
                ("Please send them immediately until tomorrow.", "Пожалуйста, немедленно отправьте их до завтра.", "Приказ и ошибка: срок — by, не until. И просьба должна быть реальной."),
            ]),
            ("arjun", "Hello, this is Arjun from Sensotech. I got your email. I'm so sorry about the delay — there was a problem with the calibration certificates.", "Здравствуйте, это Арджун из Sensotech. Получил ваше письмо. Приношу извинения за задержку — была проблема с сертификатами калибровки."),
            ("me", [
                ("Thanks for calling. When do you expect to ship them?", "Спасибо, что позвонили. Когда вы рассчитываете их отправить?", None),
                ("It's okay, no problem, take your time.", "Ничего, без проблем, не торопитесь.", "Слишком мягко: сроки вам важны. Поблагодари и спроси дату."),
                ("Your company always makes problems.", "Ваша компания всегда создаёт проблемы.", "Обобщение и обвинение испортят отношения с поставщиком."),
            ]),
            ("arjun", "We can ship on Thursday, so you should have them by Monday.", "Можем отправить в четверг, так что к понедельнику они у вас будут."),
            ("me", [
                ("Great, Monday works. Could you send me the tracking number once they ship?", "Отлично, понедельник подходит. Пришлёте номер отслеживания, когда отправите?", None),
                ("Monday. Okay. Bye.", "Понедельник. Ладно. Пока.", "Слишком сухо. И стоит попросить номер отслеживания."),
                ("Monday is too late, we need them yesterday.", "Понедельник — поздно, нам нужно было вчера.", "Если действительно поздно — объясни почему и спроси, можно ли ускорить."),
            ]),
            ("arjun", "Of course. I'll email it to you on Thursday. Thanks for your patience.", "Конечно. Пришлю письмом в четверг. Спасибо за терпение."),
        ],
        "culture": ("Номер заказа в теме",
                    "В деловой переписке тема — это поиск: по ней письмо найдут через месяц. «Order 4471 – delivery date» лучше, чем «Question» или «URGENT». А звонок индийского коллеги с извинений — вежливость, а не признание вины: поблагодари и переходи к делу."),
    },
    {
        "id": "ep-6", "n": 6, "title": "Презентация результатов", "place": "Переговорная, созвон с заказчиком",
        "after": "call-explain",
        "intro": "Ты показываешь заказчику результаты испытаний панелей. Грейс из отдела качества заказчика задаёт неудобные вопросы, Оливер помогает.",
        "lines": [
            ("dana", "Over to you. Can you walk us through the results?", "Передаю тебе слово. Расскажешь о результатах?"),
            ("me", [
                ("Sure. I'll start with the main result, then show the details. In short: all six panels passed limit load with margin.", "Конечно. Начну с главного, потом детали. Коротко: все шесть панелей прошли эксплуатационную нагрузку с запасом.", None),
                ("So... first slide... here we have... many graphs.", "Так... первый слайд... тут у нас... много графиков.", "Начни с главного вывода, а не с графиков: слушателю нужен ориентир."),
                ("I will read the report now.", "Сейчас я прочитаю отчёт.", "Читать отчёт вслух — худший вариант. Расскажи главное своими словами."),
            ]),
            ("grace", "Sorry to interrupt. Panel three failed at a lower load than the others. Why is that?", "Простите, что перебиваю. Панель три разрушилась при меньшей нагрузке, чем остальные. Почему?"),
            ("me", [
                ("Good question. Panel three had a small void near the insert, which we found in the CT scan before the test.", "Хороший вопрос. У панели три была небольшая пора возле закладной — мы нашли её на КТ ещё до испытания.", None),
                ("I don't know. It just failed.", "Не знаю. Просто разрушилась.", "Даже если причина неясна, скажи, что известно и как будете выяснять."),
                ("It is not our fault.", "Это не наша вина.", "Оборонительный ответ вызывает недоверие. Объясни факты."),
            ]),
            ("grace", "And is that acceptable?", "И это допустимо?"),
            ("me", [
                ("It still exceeded ultimate load by six percent, so it meets the requirement. But we've added a CT check for every insert.", "Она всё равно превысила разрушающую нагрузку на шесть процентов, так что требование выполнено. Но мы добавили КТ-контроль каждой закладной.", None),
                ("Yes. Next slide.", "Да. Следующий слайд.", "Звучит так, будто уходишь от вопроса. Обоснуй цифрой."),
                ("Maybe yes, maybe no.", "Может да, может нет.", "Неуверенность без фактов тревожит заказчика."),
            ]),
            ("oliver", "If I can add something — the void was within the size allowed by the process spec.", "Если позволите добавить — пора была в пределах размера, допустимого техпроцессом."),
            ("me", [
                ("Thanks, Oliver. That's right — it was within the allowed size, but we want to reduce the scatter.", "Спасибо, Оливер. Верно — в пределах допуска, но мы хотим уменьшить разброс.", None),
                ("Oliver, please don't interrupt.", "Оливер, пожалуйста, не перебивай.", "Коллега помогает — поблагодари и используй его слова."),
                ("Yes yes yes.", "Да-да-да.", "Звучит нетерпеливо. Поблагодари и продолжи мысль."),
            ]),
            ("grace", "Okay, that makes sense. Can you send us the CT images?", "Хорошо, это логично. Пришлёте нам снимки КТ?"),
            ("me", [
                ("Of course. I'll send them today together with the updated report.", "Конечно. Пришлю сегодня вместе с обновлённым отчётом.", None),
                ("They are secret.", "Они секретные.", "Если есть ограничения — объясни и предложи, что можно показать."),
                ("Maybe later.", "Может, позже.", "Неопределённо. Назови конкретный срок."),
            ]),
        ],
        "culture": ("Вопросы — это не нападение",
                    "На англоязычных презентациях перебивать вопросом нормально, и «Sorry to interrupt» — вежливая формула. «Good question» даёт секунду подумать. Отвечай фактом и цифрой, а если чего-то не знаешь — «I'll check and get back to you» лучше, чем догадки."),
    },
]

# ——— Боссы ———
BOSS_AIR = {
    "id": "boss-air", "module": "boss-air", "title": "Созвон по срыву сроков", "kind": "созвон",
    "situation": "Пятничный созвон: четверо из разных стран обсуждают, почему испытания сдвигаются. Говорят быстро и перебивают друг друга.",
    "lines": [
        ("dana", "Okay, let's get started. We've got a problem with the schedule, so I want to hear from everyone. Oliver, you first.",
         "Так, давайте начнём. У нас проблема с графиком, поэтому хочу выслушать всех. Оливер, ты первый."),
        ("oliver", "Right, so the long and short of it is the shaker table's gone down again — it's the amplifier, not the table itself — and the earliest they can get a replacement out to us is Wednesday.",
         "Короче говоря, вибростенд опять встал — дело в усилителе, а не в самом столе, — и раньше среды замену нам не привезут."),
        ("dana", "Wednesday. And how long do the vibration tests take once it's back?",
         "В среду. А сколько займут вибрационные испытания, когда стенд заработает?"),
        ("oliver", "Three days if nothing goes wrong, so realistically we're looking at the end of next week.",
         "Три дня, если всё пойдёт гладко, так что реально — конец следующей недели."),
        ("priya", "Sorry, can I jump in? If vibration slips, can't we just swap the order and do the thermal cycling first? The chamber's free from Monday.",
         "Извините, можно вклиниться? Если вибрация сдвигается, может, просто поменяем порядок и сначала сделаем термоциклирование? Камера свободна с понедельника."),
        ("tom", "We could, but mate, the thermal procedure assumes the panel's already been through vibration. We'd have to get that signed off by quality.",
         "Можно, но, дружище, методика термоциклирования предполагает, что панель уже прошла вибрацию. Это придётся согласовать с отделом качества."),
        ("grace", "That's me. I'm not against it in principle, but I'd need a short note explaining why the order doesn't affect the results. If I get it by Monday morning, I can approve it the same day.",
         "Это ко мне. В принципе я не против, но мне нужна короткая записка с обоснованием, почему порядок не влияет на результаты. Если получу её к утру понедельника, согласую в тот же день."),
        ("dana", "Okay, so here's the plan. Priya writes the note over the weekend, Grace reviews it Monday morning, thermal cycling starts Monday afternoon, and vibration picks up when the amplifier's fixed. Does that work for everyone?",
         "Хорошо, тогда план такой. Прия пишет записку на выходных, Грейс проверяет её в понедельник утром, термоциклирование начинается в понедельник после обеда, а к вибрации возвращаемся, когда починят усилитель. Всех устраивает?"),
        ("priya", "Works for me.",
         "Меня устраивает."),
        ("oliver", "Yep, I'll chase the supplier and let you know if Wednesday slips.",
         "Да, я потороплю поставщика и дам знать, если среда сдвинется."),
    ],
    "questions": [
        ("What exactly is broken?", ["The amplifier", "The shaker table itself", "The thermal chamber"]),
        ("When can the replacement arrive at the earliest?", ["On Wednesday", "On Monday", "At the end of next week"]),
        ("What does Priya suggest?", ["Doing thermal cycling before vibration", "Cancelling the vibration tests", "Buying a new shaker table"]),
        ("What does Grace need before she approves the change?", ["A short note explaining why the order doesn't matter", "New test results", "A call with the supplier"]),
        ("Who will write the note?", ["Priya", "Grace", "Oliver"]),
    ],
}

BOSS_DOC = {
    "id": "boss-doc", "module": "boss-doc", "level": 3, "topic": "test", "kind": "статья на время",
    "title": "Effect of manufacturing defects on the compressive strength of sandwich panels",
    "paragraphs": [
        "Honeycomb sandwich panels are widely used in spacecraft structures because they combine high bending stiffness with low mass. However, their compressive strength is sensitive to manufacturing defects such as core crushing, skin wrinkles and disbonds between the skin and the core. This study quantifies the effect of these defects on the edgewise compressive strength of aluminium honeycomb panels with carbon fibre skins.",
        "Forty-eight panels measuring 300 by 200 millimetres were manufactured in four groups: pristine panels and panels with artificial core crushing, skin wrinkles or disbonds. Disbonds were introduced by placing a 25-millimetre PTFE film between the skin and the core before curing. All panels were inspected by ultrasonic C-scan and then loaded to failure in edgewise compression at a rate of 0.5 millimetres per minute.",
        "Pristine panels failed at a mean load of 86 kilonewtons with a coefficient of variation of 4 percent. Core crushing reduced the strength by only 3 percent, which is within the scatter of the pristine group. Skin wrinkles reduced the strength by 11 percent, while disbonds caused the largest reduction of 27 percent. In all disbonded panels, failure started with local skin buckling over the disbond.",
        "The results suggest that disbonds are the most critical defect for compressive loading and should be given priority in inspection. Because a 25-millimetre disbond is reliably detected by C-scan, the authors recommend C-scan inspection of every flight panel, whereas visual inspection is considered sufficient for core crushing.",
    ],
    "paragraphsRu": [
        "Трёхслойные панели с сотовым заполнителем широко применяются в конструкциях космических аппаратов, потому что сочетают высокую изгибную жёсткость с малой массой. Однако их прочность при сжатии чувствительна к производственным дефектам — смятию сот, складкам обшивки и отслоениям обшивки от заполнителя. В этом исследовании количественно оценивается влияние этих дефектов на прочность при торцевом сжатии панелей с алюминиевыми сотами и обшивками из углепластика.",
        "Сорок восемь панелей размером 300 на 200 миллиметров изготовили четырьмя группами: бездефектные панели и панели с искусственным смятием сот, складками обшивки или отслоениями. Отслоения создавали, помещая перед отверждением между обшивкой и заполнителем плёнку из ПТФЭ размером 25 миллиметров. Все панели проконтролировали ультразвуковым C-сканированием, а затем нагружали торцевым сжатием до разрушения со скоростью 0,5 миллиметра в минуту.",
        "Бездефектные панели разрушились при средней нагрузке 86 килоньютонов с коэффициентом вариации 4 процента. Смятие сот снизило прочность всего на 3 процента, что лежит в пределах разброса бездефектной группы. Складки обшивки снизили прочность на 11 процентов, а наибольшее снижение — на 27 процентов — вызвали отслоения. Во всех панелях с отслоениями разрушение начиналось с местной потери устойчивости обшивки над отслоением.",
        "Результаты позволяют предположить, что при сжатии самый критичный дефект — отслоение и при контроле ему следует уделять первоочередное внимание. Поскольку отслоение размером 25 миллиметров надёжно выявляется C-сканированием, авторы рекомендуют C-скан каждой лётной панели, тогда как для смятия сот достаточным считается визуальный осмотр.",
    ],
    "summaries": [
        ["Sandwich panels are light and stiff, but defects may reduce their compressive strength, which this study measures.", "Sandwich panels are always made without defects.", "Honeycomb panels are heavier than solid aluminium plates."],
        ["Four groups of panels, with and without artificial defects, were inspected and compressed to failure.", "The panels were tested in bending at high temperature.", "Only pristine panels were tested."],
        ["Disbonds reduced strength the most, wrinkles moderately, and core crushing hardly at all.", "All defects reduced strength by about the same amount.", "Core crushing was the most dangerous defect."],
        ["Disbonds are the most critical defect, so every flight panel should be checked by C-scan.", "Visual inspection is enough for all defects.", "C-scan cannot detect disbonds."],
    ],
    "retell": [
        "Sandwich panels are light and stiff, but manufacturing defects can reduce their compressive strength, and this study measures how much.",
        "They made panels with and without artificial defects, checked them by C-scan and compressed them to failure.",
        "Disbonds reduced the strength by 27 percent, wrinkles by 11 percent, and core crushing only by 3 percent.",
        "Disbonds are the most critical, so the authors recommend C-scan inspection of every flight panel.",
    ],
    "find": [
        ("What was the mean failure load of the pristine panels?", "mean load of 86 kilonewtons"),
        ("How were disbonds introduced?", "PTFE film"),
        ("By how much did skin wrinkles reduce the strength?", "reduced the strength by 11 percent"),
        ("How do the authors suggest checking for core crushing?", "visual inspection is considered sufficient"),
    ],
    "parse": {
        "sentence": "Because a 25-millimetre disbond is reliably detected by C-scan, the authors recommend C-scan inspection of every flight panel, whereas visual inspection is considered sufficient for core crushing.",
        "parts": [
            ["Because a 25-millimetre disbond is reliably detected by C-scan,", "причина: отслоение 25 мм надёжно видно на C-скане (пассив: is detected)"],
            ["the authors recommend C-scan inspection of every flight panel,", "главное: авторы рекомендуют C-скан каждой лётной панели"],
            ["whereas visual inspection is considered sufficient for core crushing.", "противопоставление (whereas — тогда как): для смятия сот достаточно осмотра"],
        ],
        "q": "What do the authors recommend for core crushing?",
        "options": ["Visual inspection", "C-scan of every panel", "No inspection at all"],
        "answer": 0,
    },
}

BOSS_MAIL = {
    "register": [
        ("Заказчик в ярости из-за задержки. Первая фраза ответа?", "neutral",
         ["Thank you for your email, and I understand your frustration about the delay.", "Calm down, please.", "It is not our fault."],
         "Признай чувства и поблагодари — это снижает накал. Оправдания и «успокойтесь» только злят."),
        ("Как сообщить новый срок?", "neutral",
         ["We will deliver the report by 14 March, and I will send you a short progress update every Friday until then.", "The report will be ready when it is ready.", "Maybe in March, we will see."],
         "Конкретная дата и регулярные новости возвращают доверие."),
    ],
    "write": (
        "Ответь заказчику. Отчёт задерживается на неделю из-за повторного испытания (первый образец был повреждён при установке). Новый срок — 14 марта. Предложи еженедельные апдейты.",
        "Dear Ivan,\n\nThis is the second time the report has been delayed. We had a design review planned based on your data, and now we have to postpone it. I need to understand what is going on and when we will actually get the results.\n\nRegards,\nGrace Walker\nQuality Manager",
        "Dear Grace,\n\nThank you for your email, and I understand your frustration — I'm sorry the delay affects your design review.\n\nThe first specimen was damaged during installation, so we had to repeat the test to make sure the results are valid. The repeat test was completed yesterday, and the data look consistent.\n\nWe will deliver the final report by 14 March. Until then, I will send you a short progress update every Friday. If it helps, I can also share the preliminary results this week so that you can prepare for the review.\n\nKind regards,\nIvan Petrov",
        ["признал проблему и извинился один раз", "объяснил причину фактами, без оправданий", "назвал конкретный новый срок", "предложил, как держать в курсе", "формальный, но тёплый тон"],
    ),
}


def ident(s: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-")


def build():
    for d in ["mail", "clean", "ff", "boss", "story"]:
        (OUT / d).mkdir(parents=True, exist_ok=True)

    def dump(path: str, data):
        (OUT / path).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    guides = [{"module": m, **v} for m, v in GUIDES.items()]

    counters: dict[str, int] = {}

    def nid(prefix: str, module: str) -> str:
        key = f"{prefix}-{module}"
        counters[key] = counters.get(key, 0) + 1
        return f"{prefix}-{module.split('-', 1)[1]}-{counters[key]}"

    register = []
    for module, situation, want, options, why in REGISTER:
        assert len(set(options)) == 3
        register.append({"id": nid("mr", module), "module": module, "situation": situation, "want": want, "options": options, "why": why, "reviewed": False})
    fix = []
    for module, context, bad, options, why in FIX:
        assert bad not in options
        fix.append({"id": nid("mf", module), "module": module, "context": context, "bad": bad, "options": options, "why": why, "reviewed": False})
    order = []
    for module, title, blocks in ORDER:
        assert len(set(blocks)) == len(blocks)
        order.append({"id": nid("mo", module), "module": module, "title": title, "blocks": blocks, "reviewed": False})
    write = []
    for module, task, incoming, model, checklist in WRITE:
        write.append({"id": nid("mw", module), "module": module, "task": task, "incoming": incoming, "model": model, "checklist": checklist, "reviewed": False})
    bank = [{"id": f"bank-{i + 1}", "title": title, "phrases": [{"en": en, "ru": ru, "reg": reg} for en, ru, reg in items]} for i, (title, items) in enumerate(BANK)]

    pairs = []
    for module, a, b, ia, ib, ra, rb in PAIRS:
        pairs.append({"id": f"mp-{a}-{b}", "module": module, "a": a, "b": b, "ipaA": ia, "ipaB": ib, "ruA": ra, "ruB": rb,
                      "speak": [{"text": w, "voice": v} for w in (a, b) for v in STD], "reviewed": False})
    assert len({p["id"] for p in pairs}) == len(pairs)
    phrases = [{"id": nid("cp", m), "module": m, "text": t, "ru": ru, "focus": f, "voices": STD, "reviewed": False} for m, t, f, ru in PHRASES]
    phrases += [{"id": f"ci-{i + 1}", "module": "clean-intonation", "text": t, "ru": ru, "focus": f, "voices": STD, "reviewed": False} for i, (t, ru, f) in enumerate(INTONATION)]
    stress = []
    for w, syl, k, ipa, ru in STRESS:
        assert "".join(syl) == w, w
        assert 0 <= k < len(syl)
        stress.append({"id": f"st-{w}", "module": "clean-stress", "text": w, "syllables": syl, "stress": k, "ipa": ipa, "ru": ru, "voices": STD, "reviewed": False})

    ff = []
    for fid, word, context, options, why in FALSE_FRIENDS:
        assert len(set(options)) == 3
        ff.append({"id": f"ff-{fid}", "ru": word, "context": context, "options": options, "trap": options[1], "why": why,
                   "speak": [{"text": options[0], "voice": v} for v in STD], "reviewed": False})

    episodes = []
    for e in EPISODES:
        lines = []
        for i, row in enumerate(e["lines"]):
            if row[0] == "me":
                opts = [{"text": t, "ru": r, "why": w} for t, r, w in row[1]]
                assert opts[0]["why"] is None and all(o["why"] for o in opts[1:]), f"{e['id']}#{i}"
                lines.append({"speaker": "me", "options": opts, "speak": [{"text": opts[0]["text"], "voice": v} for v in STD]})
            else:
                who, text, ru = row
                lines.append({"speaker": who, "voice": CHARS[who], "text": text, "ru": ru})
        episodes.append({"id": e["id"], "n": e["n"], "title": e["title"], "place": e["place"], "after": e["after"], "intro": e["intro"],
                         "lines": lines, "culture": {"title": e["culture"][0], "text": e["culture"][1]}, "reviewed": False})

    air = {**{k: v for k, v in BOSS_AIR.items() if k not in ("lines", "questions")},
           "lines": [{"speaker": s, "voice": CHARS[s], "text": t, "ru": ru} for s, t, ru in BOSS_AIR["lines"]],
           "questions": [{"q": q, "options": o, "answer": 0} for q, o in BOSS_AIR["questions"]], "reviewed": False}
    t = BOSS_DOC
    assert len(t["paragraphsRu"]) == len(t["paragraphs"]), "boss-doc: число абзацев перевода"
    flat = [s for p in t["paragraphs"] for s in split_sentences(p)]
    for q, key in t["find"]:
        hits = [s for s in flat if key.lower() in s.lower()]
        assert len(hits) == 1, f"boss-doc: ключ «{key}» найден {len(hits)} раз"
    assert t["parse"]["sentence"] in flat
    doc = {**{k: v for k, v in t.items() if k != "find"}, "find": [{"q": q, "key": k} for q, k in t["find"]],
           "source": "Houston (собственный текст)", "license": "собственный текст приложения",
           "speak": [{"text": r, "voice": v} for r in t["retell"] for v in STD], "reviewed": False}
    task, incoming, model, checklist = BOSS_MAIL["write"]
    mail = {
        "register": [{"id": f"mr-boss-{i + 1}", "module": "boss-mail", "situation": s, "want": w, "options": o, "why": why, "reviewed": False}
                     for i, (s, w, o, why) in enumerate(BOSS_MAIL["register"])],
        "write": {"id": "mw-boss", "module": "boss-mail", "task": task, "incoming": incoming, "model": model, "checklist": checklist, "reviewed": False},
    }

    dump("guides.json", guides)
    dump("mail/register.json", register)
    dump("mail/fix.json", fix)
    dump("mail/order.json", order)
    dump("mail/write.json", write)
    dump("mail/bank.json", bank)
    dump("clean/pairs.json", pairs)
    dump("clean/phrases.json", phrases)
    dump("clean/stress.json", stress)
    dump("ff/false-friends.json", ff)
    dump("story/episodes-2.json", episodes)
    dump("boss/bosses.json", {"air": air, "doc": doc, "mail": mail})
    print(f"Телеграмма: {len(register)} регистр, {len(fix)} «по-русски», {len(order)} сборка, {len(write)} написать, банк {sum(len(b['phrases']) for b in bank)} фраз")
    print(f"Чистый сигнал: {len(pairs)} пар, {len(phrases)} фраз, {len(stress)} слов на ударение; ложных друзей {len(ff)}; эпизоды 4–6; боссы")


if __name__ == "__main__":
    build()
