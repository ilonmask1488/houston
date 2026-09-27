"""
Контент фазы 1 — Эфир (аудирование) и Позывной (говорение) → src/content/air/*.json, src/content/call/*.json.

  .venv\\Scripts\\python.exe scripts\\author_phase1.py

Всё написано вручную и помечено reviewed: false. После правки — generate_audio.py и npm run check:content.
Формат фраз Эфира: (текст, [варианты-ловушки], перевод, фрагмент-«фокус», голос[, say — как произносит синтез]).
Первый вариант в JSON всегда верный — приложение перемешивает.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "content"
STD = ["us-f", "us-m", "gb-f", "gb-m"]  # голоса образцов: вариант языка × пол из настроек

# ——— Персонажи сюжета «Международный проект» (голоса — у них же в отрывках) ———
CHARACTERS = [
    {"id": "dana", "name": "Dana Walsh", "role": "тимлид, строгая и точная", "voice": "us-f"},
    {"id": "tom", "name": "Tom Baker", "role": "коллега-болтун, вечно шутит", "voice": "au-m"},
    {"id": "oliver", "name": "Oliver Hughes", "role": "британец, говорит очень быстро", "voice": "gb-m"},
    {"id": "priya", "name": "Priya Nair", "role": "инженер-наставница из Бангалора", "voice": "in-f"},
    {"id": "arjun", "name": "Arjun Mehta", "role": "инженер-испытатель", "voice": "in-m"},
    {"id": "sophie", "name": "Sophie Clarke", "role": "менеджер поставщика", "voice": "gb-f"},
    {"id": "mike", "name": "Mike Chen", "role": "интервьюер, HR", "voice": "us-m"},
    {"id": "grace", "name": "Grace Kelly", "role": "специалист по качеству из Сиднея", "voice": "au-f"},
]
VOICE = {c["id"]: c["voice"] for c in CHARACTERS}

# ——— Эфир: объяснения явлений связной речи ———
CONNECTED = {
    "air-weak": {
        "intro": [
            "В беглой речи служебные слова — to, and, can, for, of, you, them, have, was — почти теряют гласную. Громкость и ударение уходят на смысловые слова.",
            "Если ждать чёткого «ту» и «энд», фраза пролетает мимо. Ловить нужно ударные слова, а безударные — узнавать по короткому «э».",
        ],
        "rules": [
            ["to", "/tuː/ → /tə/", "I need to go → ai-NEED-tə-GO"],
            ["and", "/ænd/ → /ən/, /n/", "rock and roll → rock-n-roll"],
            ["can", "/kæn/ → /kən/", "I can do it → ai-kən-DO-it"],
            ["for", "/fɔːr/ → /fə/", "for a week → fə-rə-WEEK"],
            ["of", "/ɒv/ → /əv/, /ə/", "a lot of work → ə-LOT-ə-WORK"],
            ["them", "/ðem/ → /ðəm/, /əm/", "tell them → TELL-əm"],
            ["have", "/hæv/ → /əv/", "should have → SHOULD-əv"],
        ],
        "tip": "can и can't: в утверждении can слабое /kən/, а can't ударное, с полной гласной. Различай по гласной и ударению, а не по звуку t — его часто не слышно.",
    },
    "air-link": {
        "intro": [
            "Конечная согласная «прилипает» к следующей гласной: turn it off звучит как tur-ni-toff, an apple — как a-napple.",
            "Между двумя гласными вставляется лёгкое /j/ или /w/: I agree → I-y-agree, go on → go-w-on. В британском r на конце слова слышно, если дальше гласная: far away → fa-raway.",
        ],
        "rules": [
            ["согласная + гласная", "слово цепляется за следующее", "pick it up → pi-ki-tup"],
            ["гласная + гласная", "вставка /j/ или /w/", "I agree → aj-ə-GREE, do it → doo-w-it"],
            ["британское r", "звучит перед гласной", "far away → faa-rə-WAY"],
            ["одинаковые звуки", "сливаются в один, чуть длиннее", "big game → bi-GAME"],
        ],
        "tip": "Если слышишь незнакомое «длинное слово» — попробуй разрезать его по-другому: tur-ni-toff — это turn it off.",
    },
    "air-elision": {
        "intro": [
            "Звуки t и d между согласными часто пропадают: next day → nex day, last time → las time, must be → mus be.",
            "В середине фразы he, him, her, his теряют h: tell him → TELL-im, asked her → ASK-ter.",
        ],
        "rules": [
            ["t между согласными", "выпадает", "next week → nex week, just thought → jus thought"],
            ["d между согласными", "выпадает", "old man → ol man, handbag → hanbag"],
            ["h в местоимениях", "не слышно без ударения", "did he → DID-ee, tell her → TELL-er"],
            ["and", "превращается в n", "black and white → black-n-white"],
        ],
        "tip": "Отсутствие звука не значит отсутствие слова: пропавший t часто слышен как короткая пауза-«зажим» перед следующим звуком.",
    },
    "air-assim": {
        "intro": [
            "Соседние звуки влияют друг на друга. d + you даёт «джу»: did you → didja, would you → wouldja. t + you — «чу»: don't you → doncha, got you → gotcha.",
            "Частые связки сжимаются: want to → wanna, going to → gonna, have to → hafta, got to → gotta, let me → lemme, give me → gimme. В письме так не пишут, но говорят так почти все.",
        ],
        "rules": [
            ["d + you", "→ «джу»", "did you → DID-jə, would you → WOOD-jə"],
            ["t + you", "→ «чу»", "don't you → DOHN-chə, what you → WHA-chə"],
            ["want to / going to", "→ wanna / gonna", "I'm going to call → aim-gənə-CALL"],
            ["have to / got to", "→ hafta / gotta", "we have to go → wee-HAF-tə-GO"],
            ["let me / give me", "→ lemme / gimme", "let me see → LEM-mee-SEE"],
        ],
        "tip": "Сам так говорить не обязан — но узнавать на слух нужно: в созвонах и на собеседованиях иначе почти не говорят.",
    },
    "air-contract": {
        "intro": [
            "Сокращения на слух — это короткий призвук перед глаголом: I'd go, I'll go и I go различаются одним звуком d или l.",
            "would have, should have, could have сжимаются до would've, should've, could've — «вудэв», «шудэв». Бывает даже shouldn't've.",
        ],
        "rules": [
            ["I'd", "I would / I had", "I'd go → I would go; I'd gone → I had gone"],
            ["I'll", "I will", "I'll send it → ail SEND it"],
            ["he's / she's", "he is / he has", "he's finished → he has finished"],
            ["would've / should've", "would have / should have", "you should've asked → SHOOD-əv"],
            ["-n't", "не: слышно по гласной", "can't /kɑːnt/ vs can /kən/"],
        ],
        "tip": "he's + причастие (he's finished) — это has, he's + прилагательное или -ing (he's busy, he's working) — это is. Смысл подскажет, если звук не разобрал.",
    },
    "air-accents": {
        "intro": [
            "На работе собеседники будут из разных стран. Британцы не произносят r на конце слога (car → kaa), американцы часто превращают t между гласными в быстрое d (water → wa-der).",
            "В индийском английском t и d твёрже, ритм ровнее, гласные чище. Австралийцы тянут гласные и «поднимают» их: day звучит ближе к «дай».",
        ],
        "rules": [
            ["US", "r слышно всегда, t → «d» между гласными", "better → BED-er"],
            ["UK", "r на конце не слышно, t чёткое", "better → BET-ə"],
            ["Индия", "твёрдые t и d, ровный ритм", "data → DAA-ta"],
            ["Австралия", "гласные ползут вверх", "mate → «майт», no → «нау»"],
        ],
        "tip": "Не пытайся понять каждое слово: сначала — кто что делает и когда, детали потом.",
    },
    "air-long": {
        "intro": [
            "Длинный отрывок слушаем в два захода. Первый — только суть: кто говорит, о чём договорились, что дальше.",
            "Второй — с текстом: где именно потерялся и почему. Не останавливай запись на каждом незнакомом слове — в жизни паузы тоже никто не сделает.",
        ],
        "rules": [],
        "tip": "Вопросы по-русски — чтобы проверять понимание, а не английский выбор слов.",
    },
    "air-fast": {
        "intro": [
            "Всё, что уже знакомо, — на скорости 1.25. Это быстрее, чем обычно говорят на работе: если понимаешь здесь, созвоны покажутся медленными.",
        ],
        "rules": [],
        "tip": "Сначала прослушай на 1.0, потом сразу на 1.25 — мозг быстро подстраивается.",
    },
}

# ——— Эфир: фразы ———
PHRASES = {
    "air-weak": [
        ("I need to talk to them about the budget.", ["I need to talk to him about the budget.", "I needed to talk to them about the budget."], "Мне нужно поговорить с ними о бюджете.", "to talk to them", "us-f"),
        ("Can you send me the file by Friday?", ["Can't you send me the file by Friday?", "Could you send me the file by Friday?"], "Можешь прислать мне файл до пятницы?", "Can you", "gb-m"),
        ("I can do it, but I can't do it today.", ["I can't do it, but I can do it today.", "I can do it, but I can do it today."], "Я могу это сделать, но не сегодня.", "can … can't", "us-m"),
        ("We tested the pump and the valve.", ["We tested the pump in the valve.", "We tested the pumps and the valve."], "Мы проверили насос и клапан.", "and the", "gb-f"),
        ("It's a lot of work for a small team.", ["It's a lot of work for the small team.", "It's a lot of work from a small team."], "Это много работы для маленькой команды.", "a lot of … for a", "us-f"),
        ("What do you think of the results?", ["What did you think of the results?", "What do you think about the results?"], "Что думаешь о результатах?", "of the", "gb-m"),
        ("They should have told us earlier.", ["They should tell us earlier.", "They should've told them earlier."], "Им стоило сказать нам раньше.", "should have", "us-m"),
        ("The data was sent to the lab on Monday.", ["The data was sent to a lab on Monday.", "The data was sent to the lab by Monday."], "Данные отправили в лабораторию в понедельник.", "was sent to the", "gb-f"),
        ("Let's grab a coffee and go over the plan.", ["Let's grab a coffee and go over the plans.", "Let's get a coffee and go over the plan."], "Давай возьмём кофе и пройдёмся по плану.", "and go over", "us-f"),
        ("We have to check it for leaks.", ["We had to check it for leaks.", "We have to check it for leaks again."], "Нам нужно проверить его на утечки.", "have to … for", "gb-m"),
        ("Some of them are still in the box.", ["Some of them are still in a box.", "Some of it is still in the box."], "Часть из них всё ещё в коробке.", "Some of them", "us-m"),
        ("How long have you been working on it?", ["How long have you worked on it?", "How long are you working on it?"], "Сколько ты уже над этим работаешь?", "have you been", "gb-f"),
    ],
    "air-link": [
        ("Turn it off and on again.", ["Turn it on and off again.", "Turn them off and on again."], "Выключи и включи снова.", "Turn it off and on", "us-m"),
        ("Pick it up at eight.", ["Pick them up at eight.", "Picked it up at eight."], "Забери его в восемь.", "Pick it up at eight", "gb-f"),
        ("Check it out when you have a minute.", ["Check them out when you have a minute.", "Check it out when you had a minute."], "Глянь, когда будет минутка.", "Check it out", "us-f"),
        ("It's an old issue in our system.", ["It's a whole issue in our system.", "It's an old issue in the system."], "Это старая проблема в нашей системе.", "an old issue in", "gb-m"),
        ("Let me look into it after lunch.", ["Let me look at it after lunch.", "Let me look into it before lunch."], "Дай мне разобраться с этим после обеда.", "look into it after", "us-m"),
        ("I agree with all of it.", ["I agreed with all of it.", "I agree with all of them."], "Я согласен со всем этим.", "I agree … all of it", "gb-f"),
        ("Go on, I'm listening.", ["Go on, I was listening.", "Come on, I'm listening."], "Продолжай, я слушаю.", "Go on", "us-f"),
        ("We need a new idea for the test rig.", ["We need an idea for the test rig.", "We need a new idea for the test room."], "Нам нужна новая идея для стенда.", "a new idea", "gb-m"),
        ("Hold on a second, I'll get it.", ["Hold on a second, I got it.", "Hold on a sec, I'll get them."], "Секунду, сейчас возьму.", "Hold on a", "us-m"),
        ("Is it on or off?", ["Is it on or not?", "Was it on or off?"], "Он включён или выключен?", "Is it on or off", "gb-f"),
        ("Keep the sensor far away from the engine.", ["Keep the sensors far away from the engine.", "Keep the sensor away from the engine."], "Держи датчик подальше от двигателя.", "far away", "gb-m"),
        ("Put it on the table over there.", ["Put it on the table over here.", "Put them on the table over there."], "Положи это на тот стол.", "Put it on", "us-f"),
    ],
    "air-elision": [
        ("See you next week.", ["See you next weekend.", "See you this week."], "До встречи на следующей неделе.", "next week", "gb-f"),
        ("Last time it worked fine.", ["Last time it went fine.", "This time it worked fine."], "В прошлый раз всё работало.", "Last time", "us-m"),
        ("I just thought it might help.", ["I just thought it would help.", "I just taught it might help."], "Я просто подумал, что это может помочь.", "just thought", "gb-m"),
        ("It must be the pressure sensor.", ["It must've been the pressure sensor.", "It might be the pressure sensor."], "Наверное, дело в датчике давления.", "must be", "us-f"),
        ("I didn't know he was on the call.", ["I didn't know you were on the call.", "I don't know if he was on the call."], "Я не знал, что он на созвоне.", "didn't know he", "gb-f"),
        ("Tell him we'll be there at ten.", ["Tell them we'll be there at ten.", "Tell him we were there at ten."], "Скажи ему, что мы будем в десять.", "Tell him", "us-m"),
        ("We asked her to send the drawings.", ["We asked them to send the drawings.", "We ask her to send the drawings."], "Мы попросили её прислать чертежи.", "asked her", "gb-m"),
        ("The first test failed, the second passed.", ["The first test failed, the second one passed.", "The first tests failed, the second passed."], "Первый тест провалился, второй прошёл.", "first test", "us-f"),
        ("I kept the old version just in case.", ["I kept the whole version just in case.", "I keep the old version just in case."], "Я сохранил старую версию на всякий случай.", "kept the old … just in", "gb-f"),
        ("Most people prefer the second option.", ["Most people prefer a second option.", "Some people prefer the second option."], "Большинство предпочитает второй вариант.", "Most people", "us-m"),
        ("We'll start on Monday and finish by Friday.", ["We'll start on Monday and finish on Friday.", "We started on Monday and finished by Friday."], "Начнём в понедельник и закончим к пятнице.", "and finish", "gb-m"),
        ("Did he get the message?", ["Did they get the message?", "Did he get a message?"], "Он получил сообщение?", "Did he", "us-f"),
    ],
    "air-assim": [
        ("Did you see the email?", ["Do you see the email?", "Did you send the email?"], "Ты видел письмо?", "Did you", "us-m"),
        ("Would you like me to check it?", ["Would you like to check it?", "Do you want me to check it?"], "Хочешь, я проверю?", "Would you", "gb-f"),
        ("Don't you think it's too early?", ["Don't you think it's too late?", "Do you think it's too early?"], "Тебе не кажется, что рано?", "Don't you", "us-f"),
        ("I'm going to test it tomorrow.", ["I'm going to test it today.", "I was going to test it tomorrow."], "Я собираюсь проверить это завтра.", "going to → gonna", "us-m", "I'm gonna test it tomorrow."),
        ("Do you want to join the call?", ["Do you want to join the team?", "Did you want to join the call?"], "Хочешь подключиться к созвону?", "want to → wanna", "us-f", "Do you wanna join the call?"),
        ("We have to finish the report.", ["We had to finish the report.", "We have to finish the reports."], "Нам надо закончить отчёт.", "have to → hafta", "gb-m"),
        ("Let me know if you need anything.", ["Let me know if you need something.", "Let me know if you needed anything."], "Дай знать, если что-то понадобится.", "Let me → lemme", "us-m"),
        ("I've got to go, I'm late.", ["I've got to go, it's late.", "I've got a goal, I'm late."], "Мне пора, я опаздываю.", "got to → gotta", "gb-f", "I've gotta go, I'm late."),
        ("What did you do last weekend?", ["What do you do on weekends?", "What did you do last week?"], "Что делал в прошлые выходные?", "did you", "us-f"),
        ("Can I get you anything?", ["Can I get you something?", "Can I give you anything?"], "Тебе что-нибудь принести?", "get you", "gb-m"),
        ("Give me a minute.", ["Give me a moment.", "Give them a minute."], "Дай мне минуту.", "Give me → gimme", "us-m", "Gimme a minute."),
        ("Is that what you meant?", ["Is that what you mean?", "Was that what you meant?"], "Ты это имел в виду?", "what you", "gb-f"),
    ],
    "air-contract": [
        ("I'd go with the lighter design.", ["I'll go with the lighter design.", "I go with the lighter design."], "Я бы выбрал более лёгкую конструкцию.", "I'd", "gb-m"),
        ("We've already sent it.", ["We already sent it.", "We'd already sent it."], "Мы уже отправили.", "We've", "us-f"),
        ("He's finished the model.", ["He finished the model.", "He'd finished the model."], "Он закончил модель.", "He's finished", "gb-f"),
        ("It'll take about two weeks.", ["It'd take about two weeks.", "It took about two weeks."], "Это займёт около двух недель.", "It'll", "us-m"),
        ("You should've asked me first.", ["You should ask me first.", "You shouldn't have asked me first."], "Тебе стоило сначала спросить меня.", "should've", "gb-m"),
        ("I wouldn't have noticed it.", ["I wouldn't notice it.", "I would have noticed it."], "Я бы этого не заметил.", "wouldn't have", "us-f"),
        ("They'd already left when we called.", ["They already left when we called.", "They'd already left when he called."], "Они уже ушли, когда мы позвонили.", "They'd", "gb-f"),
        ("It could've been worse.", ["It couldn't have been worse.", "It could be worse."], "Могло быть и хуже.", "could've", "us-m"),
        ("We'll see what they say.", ["We'd see what they say.", "We see what they say."], "Посмотрим, что скажут.", "We'll", "gb-m"),
        ("She's been here since eight.", ["She was here since eight.", "She's here since eight."], "Она здесь с восьми.", "She's been", "us-f"),
        ("I'd rather not change it now.", ["I'd rather change it now.", "I'd rather not change it yet."], "Я бы не стал это сейчас менять.", "I'd rather not", "gb-f"),
        ("That's what I'd have done too.", ["That's what I've done too.", "That's what I did too."], "Я бы тоже так сделал.", "I'd have", "us-m"),
    ],
}

# Акценты: одна фраза — четыре голоса (чередуем наборы, чтобы слышать и мужские, и женские).
ACCENT_SETS = [["us-m", "gb-f", "in-m", "au-f"], ["us-f", "gb-m", "in-f", "au-m"]]
ACCENT_PHRASES = [
    ("Could you share your screen, please?", ["Could you share your scheme, please?", "Could you show your screen, please?"], "Можешь показать свой экран?", "share your screen"),
    ("I think we're running a bit behind schedule.", ["I think we're running a bit ahead of schedule.", "I think we're running behind the schedule."], "Кажется, мы немного отстаём от графика.", "behind schedule"),
    ("The supplier hasn't confirmed the delivery date yet.", ["The supplier has confirmed the delivery date.", "The supplier hasn't confirmed the delivery yet."], "Поставщик ещё не подтвердил дату поставки.", "hasn't confirmed"),
    ("Let's take this offline and discuss it tomorrow.", ["Let's take it offline and discuss it today.", "Let's take this online and discuss it tomorrow."], "Давай обсудим это отдельно завтра.", "take this offline"),
    ("Sorry, you're on mute.", ["Sorry, you were on mute.", "Sorry, I'm on mute."], "Извини, у тебя выключен микрофон.", "on mute"),
    ("Can everyone see the latest version?", ["Can anyone see the latest version?", "Can everyone see the last version?"], "Всем видна последняя версия?", "latest version"),
    ("We need to double-check the tolerances.", ["We need to check the tolerances.", "We need to double-check the temperatures."], "Надо перепроверить допуски.", "double-check the tolerances"),
    ("I'll get back to you by the end of the week.", ["I'll get back to you at the end of the week.", "I'll get back to you by the end of the day."], "Отвечу тебе до конца недели.", "get back to you"),
    ("What's the status on the thermal test?", ["What's the status on the vibration test?", "What was the status on the thermal test?"], "Что с тепловыми испытаниями?", "status on"),
    ("That makes sense, thanks for explaining.", ["That doesn't make sense, thanks for explaining.", "That makes sense, thanks for explaining it again."], "Понятно, спасибо, что объяснил.", "makes sense"),
]

# ——— Эфир: длинные отрывки (планёрка, созвон, собеседование, разбор) ———
PASSAGES = [
    {
        "id": "p-standup", "title": "Утренняя планёрка", "kind": "планёрка",
        "situation": "Команда Даны коротко отчитывается перед началом дня.",
        "lines": [
            ("dana", "Morning, everyone. Let's keep this short. Tom, you first.",
             "Всем доброе утро. Давайте коротко. Том, ты первый."),
            ("tom", "Sure. So yesterday I finished the bracket redesign, and I'm gonna run the stress analysis today. Should be done by lunch, unless the mesh gives me trouble again.",
             "Конечно. Значит, вчера я закончил переделку кронштейна, а сегодня запущу расчёт на прочность. К обеду должно быть готово, если сетка опять не подведёт."),
            ("oliver", "Right, quick one from me. The vibration table's booked for Thursday, not Wednesday, so we've got an extra day to fix the mounting plate.",
             "Так, коротко от меня. Вибростенд забронирован на четверг, а не на среду, так что у нас есть лишний день, чтобы доделать монтажную плиту."),
            ("priya", "I reviewed the sensor wiring. Two connectors were swapped, so I've corrected the drawing and sent it to the workshop.",
             "Я проверила проводку датчиков. Два разъёма были перепутаны, поэтому я исправила чертёж и отправила его в цех."),
            ("dana", "Good. Any blockers?",
             "Хорошо. Что-нибудь мешает?"),
            ("tom", "Just one. I still don't have the updated material data from the supplier.",
             "Только одно. У меня до сих пор нет обновлённых данных о материале от поставщика."),
            ("dana", "I'll chase them after this call. Thanks, everyone.",
             "Я потороплю их после созвона. Всем спасибо."),
        ],
        "questions": [
            ("Когда вибростенд?", ["В четверг", "В среду", "В пятницу"]),
            ("Что мешает Тому?", ["Нет свежих данных о материале от поставщика", "Сетка расчётной модели не строится", "Вибростенд занят"]),
            ("Что сделала Прия?", ["Исправила чертёж проводки и отправила в цех", "Заказала новые разъёмы", "Провела расчёт на прочность"]),
        ],
    },
    {
        "id": "p-supplier", "title": "Созвон с поставщиком", "kind": "созвон",
        "situation": "Софи из компании-поставщика сообщает новости по заказу.",
        "lines": [
            ("sophie", "Hi Dana, thanks for making time. I've got some good news and some not-so-good news.",
             "Привет, Дана, спасибо, что нашла время. У меня есть хорошие новости и не очень."),
            ("dana", "Let's start with the good news.",
             "Давай начнём с хороших."),
            ("sophie", "The carbon fiber panels passed inspection, so they'll ship on Monday.",
             "Панели из углепластика прошли инспекцию, так что их отгрузят в понедельник."),
            ("dana", "Great. And the bad news?",
             "Отлично. А плохие?"),
            ("sophie", "The titanium fasteners are delayed. Our supplier had a problem with the heat treatment, so we're looking at two weeks, maybe three.",
             "Титановый крепёж задерживается. У нашего поставщика возникла проблема с термообработкой, так что речь о двух неделях, может быть, о трёх."),
            ("dana", "Three weeks is a problem for us. Is there any way to split the order and send part of it earlier?",
             "Три недели — это для нас проблема. Можно как-то разделить заказ и отправить часть раньше?"),
            ("sophie", "I can check. If they have fifty in stock, I could send those by express.",
             "Могу уточнить. Если у них на складе есть пятьдесят штук, я могла бы отправить их экспресс-доставкой."),
            ("dana", "That would help a lot. Please let me know by Wednesday.",
             "Это бы очень помогло. Пожалуйста, дай знать до среды."),
        ],
        "questions": [
            ("Что отправят в понедельник?", ["Панели из углепластика", "Титановый крепёж", "Весь заказ сразу"]),
            ("Почему задерживается крепёж?", ["У их поставщика проблема с термообработкой", "Крепёж не прошёл инспекцию", "Его нет на складе совсем"]),
            ("О чём просит Дана?", ["Разделить заказ и прислать часть раньше", "Отменить заказ", "Заменить титан сталью"]),
        ],
    },
    {
        "id": "p-interview", "title": "Собеседование: вопрос о проекте", "kind": "собеседование",
        "situation": "Майк спрашивает кандидатку Грейс о её проекте. Так звучит хороший ответ по методу STAR.",
        "lines": [
            ("mike", "So, tell me about a project you're proud of.",
             "Итак, расскажите о проекте, которым вы гордитесь."),
            ("grace", "Sure. Last year I worked on a small satellite for a university team. I was responsible for the thermal design.",
             "Конечно. В прошлом году я работала над малым спутником в университетской команде. Я отвечала за тепловое проектирование."),
            ("mike", "What was the main challenge?",
             "В чём была главная трудность?"),
            ("grace", "The electronics kept overheating in our simulations. We couldn't add a radiator because of the mass limit, so I suggested moving the battery closer to the panel and using a thermal strap instead.",
             "В наших расчётах электроника постоянно перегревалась. Добавить радиатор мы не могли из-за ограничения по массе, поэтому я предложила перенести батарею ближе к панели и вместо радиатора поставить тепловой мост."),
            ("mike", "And did it work?",
             "И это сработало?"),
            ("grace", "It did. The peak temperature dropped by about twelve degrees, and we stayed within the mass budget.",
             "Да. Пиковая температура снизилась примерно на двенадцать градусов, и мы уложились в бюджет массы."),
            ("mike", "Nice. What would you do differently next time?",
             "Отлично. Что бы вы сделали иначе в следующий раз?"),
            ("grace", "I'd start the thermal analysis earlier. We found the problem quite late, and it cost us a few weeks.",
             "Я бы начала тепловой расчёт раньше. Мы обнаружили проблему довольно поздно, и это стоило нам нескольких недель."),
        ],
        "questions": [
            ("За что отвечала Грейс?", ["За тепловой расчёт", "За электронику", "За батареи"]),
            ("Как решили проблему?", ["Переставили батарею и поставили тепловой мост", "Добавили радиатор", "Убрали часть электроники"]),
            ("Что она сделала бы иначе?", ["Начала бы тепловой расчёт раньше", "Выбрала бы другой спутник", "Увеличила бы массу"]),
        ],
    },
    {
        "id": "p-debrief", "title": "Разбор испытаний", "kind": "видеоразбор",
        "situation": "Оливер быстро рассказывает, что случилось на вибростенде в пятницу.",
        "lines": [
            ("oliver", "Right, so here's what happened on Friday. We ran the random vibration test at full level.",
             "Итак, вот что случилось в пятницу. Мы проводили испытание на случайную вибрацию на полном уровне."),
            ("oliver", "About forty seconds in, the accelerometer on the bracket started showing a spike at around a hundred and twenty hertz.",
             "Примерно на сороковой секунде акселерометр на кронштейне начал показывать пик в районе ста двадцати герц."),
            ("oliver", "We stopped the test, had a look, and found that two of the four bolts had loosened. Nothing's cracked, which is the good news.",
             "Мы остановили испытание, осмотрели и обнаружили, что два болта из четырёх ослабли. Ничего не треснуло — это хорошая новость."),
            ("oliver", "The torque was probably too low, so we're going to re-torque everything to spec, add thread locker, and repeat the test on Tuesday.",
             "Скорее всего, момент затяжки был слишком мал, так что мы затянем всё заново по спецификации, добавим фиксатор резьбы и повторим испытание во вторник."),
            ("oliver", "If it happens again, we'll need to look at the bracket design itself.",
             "Если это повторится, придётся пересматривать саму конструкцию кронштейна."),
        ],
        "questions": [
            ("Что обнаружили после остановки?", ["Ослабли два болта из четырёх", "Треснул кронштейн", "Сломался акселерометр"]),
            ("Что сделают дальше?", ["Затянут болты по моменту, добавят фиксатор резьбы и повторят тест", "Сразу изменят конструкцию кронштейна", "Отменят испытания"]),
            ("Когда повтор?", ["Во вторник", "В пятницу", "Через месяц"]),
        ],
    },
    {
        "id": "p-reschedule", "title": "Перенос ревью", "kind": "созвон",
        "situation": "Том звонит Прие: клиент просит перенести ревью проекта.",
        "lines": [
            ("tom", "Hey Priya, have you got a sec? It's about tomorrow's design review.",
             "Привет, Прия, есть секунда? Это насчёт завтрашнего ревью проекта."),
            ("priya", "Sure, what's up?",
             "Конечно, что случилось?"),
            ("tom", "The client wants to move it to Thursday afternoon. Does that work for you?",
             "Клиент хочет перенести его на четверг, на вторую половину дня. Тебе подходит?"),
            ("priya", "Thursday afternoon. I have the lab until three. Could we do four o'clock?",
             "Четверг после обеда. У меня лаборатория до трёх. Можем в четыре?"),
            ("tom", "Four should be fine. I'll send an updated invite.",
             "Четыре, думаю, подойдёт. Я разошлю обновлённое приглашение."),
            ("priya", "Thanks. And could you attach the latest drawings? The ones from last week are out of date.",
             "Спасибо. И можешь приложить последние чертежи? Те, что с прошлой недели, уже устарели."),
            ("tom", "Will do. Oh, and they'd like a short demo of the test rig, if possible.",
             "Сделаю. Да, и они хотели бы, если можно, короткую демонстрацию стенда."),
            ("priya", "No problem. I'll prepare something, ten minutes max.",
             "Без проблем. Подготовлю что-нибудь, максимум на десять минут."),
        ],
        "questions": [
            ("На когда переносят ревью?", ["На четверг, 16:00", "На четверг, 15:00", "На пятницу"]),
            ("Что просит приложить Прия?", ["Свежие чертежи", "Отчёт об испытаниях", "Фото стенда"]),
            ("Что ещё хочет клиент?", ["Короткую демонстрацию стенда", "Скидку", "Новый график работ"]),
        ],
    },
    {
        "id": "p-rig", "title": "Экскурсия по стенду", "kind": "видеоразбор",
        "situation": "Дана записала видео о новом испытательном стенде для команды поставщика.",
        "lines": [
            ("dana", "In this video I'll walk you through our new test rig. On the left you can see the hydraulic actuator.",
             "В этом видео я покажу вам наш новый испытательный стенд. Слева вы видите гидравлический привод."),
            ("dana", "It can apply up to fifty kilonewtons, which is enough for most of our composite specimens.",
             "Он развивает усилие до пятидесяти килоньютонов — этого хватает для большинства наших композитных образцов."),
            ("dana", "The specimen sits in these wedge grips, and the load cell above it measures the force.",
             "Образец зажимается в этих клиновых захватах, а датчик силы над ним измеряет усилие."),
            ("dana", "We use two strain gauges on each specimen, one on each side, so we can check for bending.",
             "На каждый образец мы ставим два тензодатчика, по одному с каждой стороны, чтобы проверять изгиб."),
            ("dana", "All the data goes to this computer at a thousand samples per second. The whole setup took us about three months to build, mostly because of the safety enclosure.",
             "Все данные идут на этот компьютер с частотой тысяча отсчётов в секунду. Сборка всей установки заняла у нас около трёх месяцев — в основном из-за защитного кожуха."),
        ],
        "questions": [
            ("Какую нагрузку даёт привод?", ["До 50 кН", "До 5 кН", "До 500 кН"]),
            ("Зачем два тензодатчика на образце?", ["Чтобы проверять изгиб", "Чтобы измерять температуру", "Про запас, если один сломается"]),
            ("Почему сборка заняла три месяца?", ["Из-за защитного кожуха", "Из-за гидравлического привода", "Из-за программы сбора данных"]),
        ],
    },
]

# ——— Позывной: чанки по функциям. (чанк, перевод, пример, перевод примера) ———
CHUNKS = {
    "call-intro": [
        ("Let me briefly introduce myself.", "Позвольте коротко представиться.", None, None),
        ("I'm a fourth-year student", "Я студент четвёртого курса", "I'm a fourth-year student in aerospace engineering.", "Я студент четвёртого курса, аэрокосмическая инженерия."),
        ("I'm currently working on", "Сейчас я работаю над", "I'm currently working on a project about composite testing.", "Сейчас я работаю над проектом по испытаниям композитов."),
        ("My background is in", "Моя специальность — / я по образованию", "My background is in rocket and space engineering.", "По специальности я инженер ракетно-космической техники."),
        ("I'm particularly interested in", "Меня особенно интересует", "I'm particularly interested in structural analysis.", "Меня особенно интересует прочностной анализ."),
        ("I've had some hands-on experience with", "У меня есть практический опыт с", "I've had some hands-on experience with CAD and FEA.", "У меня есть практический опыт с CAD и МКЭ."),
        ("What I enjoy most is", "Больше всего мне нравится", "What I enjoy most is solving practical problems.", "Больше всего мне нравится решать практические задачи."),
        ("In my free time, I", "В свободное время я", "In my free time, I like to read about space missions.", "В свободное время я люблю читать о космических миссиях."),
        ("That's a bit about me.", "Вот немного обо мне.", None, None),
        ("I'm looking for a position where I can", "Я ищу позицию, где смогу", "I'm looking for a position where I can grow as an engineer.", "Я ищу позицию, где смогу расти как инженер."),
    ],
    "call-time": [
        ("That's a good question, let me think.", "Хороший вопрос, дайте подумать.", None, None),
        ("Let me think about that for a second.", "Дайте секунду подумать.", None, None),
        ("How can I put it", "Как бы это сказать", "How can I put it... it's more of a process than a tool.", "Как бы это сказать… это скорее процесс, чем инструмент."),
        ("Well, it depends on", "Ну, это зависит от", "Well, it depends on the requirements.", "Ну, это зависит от требований."),
        ("Off the top of my head, I'd say", "Навскидку я бы сказал", "Off the top of my head, I'd say about two weeks.", "Навскидку — около двух недель."),
        ("Give me a moment to gather my thoughts.", "Дайте мне собраться с мыслями.", None, None),
        ("Let me put it another way.", "Скажу по-другому.", None, None),
        ("If I understand the question correctly", "Если я правильно понял вопрос", "If I understand the question correctly, you're asking about the timeline.", "Если я правильно понял вопрос, вы спрашиваете о сроках."),
        ("The short answer is yes, but", "Если коротко — да, но", "The short answer is yes, but there's a catch.", "Если коротко — да, но есть нюанс."),
        ("I haven't thought about it that way before.", "Я раньше не смотрел на это с такой стороны.", None, None),
    ],
    "call-clarify": [
        ("Could you say that again, please?", "Можете повторить, пожалуйста?", None, None),
        ("Sorry, I didn't catch that.", "Извините, я не расслышал.", None, None),
        ("Could you speak a bit more slowly?", "Можете говорить чуть медленнее?", None, None),
        ("Do you mean", "Вы имеете в виду", "Do you mean the first version or the second one?", "Вы имеете в виду первую версию или вторую?"),
        ("Just to make sure I understand", "Чтобы убедиться, что я правильно понял", "Just to make sure I understand, you need the report by Friday?", "Чтобы убедиться, что я правильно понял: отчёт нужен к пятнице?"),
        ("Could you walk me through it?", "Можете объяснить по шагам?", None, None),
        ("What exactly do you mean by", "Что именно вы имеете в виду под", "What exactly do you mean by critical?", "Что именно вы имеете в виду под «критичным»?"),
        ("Could you give me an example?", "Можете привести пример?", None, None),
        ("So, if I understand correctly", "То есть, если я правильно понял", "So, if I understand correctly, the test is on Thursday.", "То есть, если я правильно понял, испытание в четверг."),
        ("Could you spell that, please?", "Можете продиктовать по буквам?", None, None),
    ],
    "call-project": [
        ("The goal of the project was to", "Цель проекта была", "The goal of the project was to reduce the weight of the bracket.", "Цель проекта — снизить массу кронштейна."),
        ("I was responsible for", "Я отвечал за", "I was responsible for the stress analysis.", "Я отвечал за расчёт на прочность."),
        ("We had a tight deadline, so", "Сроки были жёсткие, поэтому", "We had a tight deadline, so we split the work into two teams.", "Сроки были жёсткие, поэтому мы разделились на две команды."),
        ("The main challenge was", "Главной трудностью было", "The main challenge was the vibration at launch.", "Главной трудностью была вибрация при старте."),
        ("We solved it by", "Мы решили это тем, что", "We solved it by changing the material.", "Мы решили это, поменяв материал."),
        ("As a result", "В результате", "As a result, the mass dropped by fifteen percent.", "В результате масса снизилась на пятнадцать процентов."),
        ("I worked closely with", "Я тесно работал с", "I worked closely with the test engineers.", "Я тесно работал с испытателями."),
        ("My role was to", "Моя роль была", "My role was to prepare the test plan.", "Моя задача была подготовить программу испытаний."),
        ("In the end, we managed to", "В итоге нам удалось", "In the end, we managed to meet the deadline.", "В итоге нам удалось уложиться в срок."),
        ("Looking back, I would", "Сейчас я бы", "Looking back, I would start testing earlier.", "Сейчас я бы начал испытания раньше."),
    ],
    "call-explain": [
        ("In simple terms", "Проще говоря", "In simple terms, it's a very stiff spring.", "Проще говоря, это очень жёсткая пружина."),
        ("Think of it as", "Представь это как", "Think of it as a thermos for electronics.", "Представь это как термос для электроники."),
        ("Basically, it's a way to", "По сути, это способ", "Basically, it's a way to find weak spots before we build anything.", "По сути, это способ найти слабые места до того, как что-то построено."),
        ("The idea is pretty simple", "Идея довольно простая", "The idea is pretty simple: we split the part into small pieces.", "Идея простая: мы делим деталь на маленькие кусочки."),
        ("Let me give you an example.", "Приведу пример.", None, None),
        ("Imagine you have", "Представь, что у тебя есть", "Imagine you have a long beam fixed at one end.", "Представь, что у тебя есть длинная балка, закреплённая с одного конца."),
        ("It's similar to", "Это похоже на", "It's similar to a spring, but it works both ways.", "Это похоже на пружину, но работает в обе стороны."),
        ("The key point is that", "Главное, что", "The key point is that the part must not deform.", "Главное, что деталь не должна деформироваться."),
        ("In other words", "Другими словами", "In other words, we're checking the strength.", "Другими словами, мы проверяем прочность."),
        ("Does that make sense?", "Понятно объясняю?", None, None),
    ],
    "call-disagree": [
        ("I see your point, but", "Я понимаю вашу точку зрения, но", "I see your point, but we're short on time.", "Понимаю, но у нас мало времени."),
        ("I'm not sure I agree with that.", "Не уверен, что с этим согласен.", None, None),
        ("That's true, but have we considered", "Это так, но мы учли", "That's true, but have we considered the cost?", "Это так, но мы учли стоимость?"),
        ("I'd look at it a bit differently.", "Я бы посмотрел на это немного иначе.", None, None),
        ("I don't know, but I'll find out.", "Не знаю, но выясню.", None, None),
        ("I'm not sure off the top of my head. Can I get back to you?", "Навскидку не скажу. Можно я отвечу позже?", None, None),
        ("That's outside my area, to be honest.", "Честно говоря, это не моя область.", None, None),
        ("I might be wrong, but", "Могу ошибаться, но", "I might be wrong, but I think it's the sensor.", "Могу ошибаться, но, кажется, дело в датчике."),
        ("Fair point.", "Справедливо.", None, None),
        ("With respect, I think", "При всём уважении, я думаю", "With respect, I think we need more data first.", "При всём уважении, думаю, сначала нужно больше данных."),
    ],
    "call-questions": [
        ("What does a typical day look like in this role?", "Как выглядит обычный день на этой позиции?", None, None),
        ("What would you expect from me in the first three months?", "Чего вы ждёте от меня в первые три месяца?", None, None),
        ("How is the team structured?", "Как устроена команда?", None, None),
        ("What are the biggest challenges the team is facing right now?", "С какими главными трудностями команда сталкивается сейчас?", None, None),
        ("How do you measure success in this position?", "Как вы оцениваете успех на этой позиции?", None, None),
        ("What opportunities are there for learning and growth?", "Какие есть возможности учиться и расти?", None, None),
        ("What software does the team use?", "Какими программами пользуется команда?", None, None),
        ("What are the next steps in the process?", "Какие дальше шаги?", None, None),
    ],
}

FUNCTIONS = {
    "call-intro": "представиться",
    "call-time": "выиграть время",
    "call-clarify": "переспросить",
    "call-project": "о проекте",
    "call-explain": "объяснить просто",
    "call-disagree": "возразить / не знаю",
    "call-questions": "вопросы работодателю",
}

# ——— Позывной: вопросы для быстрого ответа (голоса — разные акценты) ———
QUESTIONS = {
    "call-intro": [
        ("Tell me about yourself.", "Расскажи о себе."),
        ("What are you studying at the moment?", "Что ты сейчас изучаешь?"),
        ("Why did you choose engineering?", "Почему ты выбрал инженерию?"),
        ("What do you do in your free time?", "Чем занимаешься в свободное время?"),
        ("Where do you see yourself in five years?", "Где ты видишь себя через пять лет?"),
    ],
    "call-time": [
        ("What's your biggest weakness?", "Какая твоя главная слабость?"),
        ("How would you explain your thesis to a ten-year-old?", "Как бы ты объяснил свою дипломную работу десятилетнему ребёнку?"),
        ("If you could work on any space mission, which one would it be?", "Если бы можно было работать над любой космической миссией — какой?"),
        ("What's the most interesting thing you've learned this year?", "Что самое интересное ты узнал в этом году?"),
    ],
    "call-clarify": [
        ("Could you tell me about your experience with the V and V process?", "Расскажи о своём опыте с процессом верификации и валидации. (Если непонятно — переспроси!)"),
        ("How would you handle an NCR on the line?", "Как бы ты поступил с актом о несоответствии на производстве? (Переспроси, что такое NCR.)"),
        ("What's your take on MBSE for small teams?", "Что думаешь о модельно-ориентированном системном проектировании для малых команд? (Можно уточнить.)"),
    ],
    "call-project": [
        ("Tell me about a project you're proud of.", "Расскажи о проекте, которым гордишься."),
        ("What was the hardest technical problem you've solved?", "Какую самую сложную техническую задачу ты решил?"),
        ("Describe a time you made a mistake. What did you learn?", "Расскажи об ошибке, которую ты совершил. Чему научился?"),
        ("What was your role in your last team project?", "Какая была твоя роль в последнем командном проекте?"),
        ("Tell me about a time you worked under pressure.", "Расскажи, как работал в условиях давления и сжатых сроков."),
    ],
    "call-explain": [
        ("Can you explain what finite element analysis is?", "Объясни, что такое метод конечных элементов."),
        ("How does a rocket engine work, in simple terms?", "Как работает ракетный двигатель, если просто?"),
        ("What's the difference between strength and stiffness?", "В чём разница между прочностью и жёсткостью?"),
        ("Why are composites used in aircraft?", "Почему в самолётах используют композиты?"),
        ("What is a strain gauge, and why do we need it?", "Что такое тензодатчик и зачем он нужен?"),
    ],
    "call-disagree": [
        ("Some people say simulation will replace testing. What do you think?", "Некоторые говорят, что моделирование заменит испытания. Что думаешь?"),
        ("Our team thinks deadlines matter more than documentation. Do you agree?", "Наша команда считает, что сроки важнее документации. Согласен?"),
        ("What would you do if you disagreed with your manager?", "Что будешь делать, если не согласен с руководителем?"),
        ("Do you know how our production line is organized?", "Знаешь, как устроена наша производственная линия? (Можно честно сказать, что нет.)"),
    ],
    "call-questions": [
        ("Do you have any questions for us?", "У тебя есть вопросы к нам?"),
        ("Is there anything else you'd like to know about the role?", "Хочешь ещё что-нибудь узнать о позиции?"),
    ],
}
QUESTION_VOICES = ["us-m", "gb-f", "in-m", "au-f", "us-f", "gb-m", "in-f", "au-m"]

# ——— Позывной: перевод на лету. (по-русски, образец) ———
TRANSLATE = {
    "call-intro": [
        ("Я студент четвёртого курса, учусь на ракетостроении.", "I'm a fourth-year student studying rocket engineering."),
        ("Сейчас я работаю над дипломом.", "I'm currently working on my thesis."),
        ("Меня особенно интересуют композиты.", "I'm particularly interested in composites."),
        ("У меня есть опыт работы в SolidWorks.", "I have experience with SolidWorks."),
        ("Я ищу стажировку на лето.", "I'm looking for a summer internship."),
        ("Больше всего мне нравится работать руками.", "What I enjoy most is hands-on work."),
    ],
    "call-time": [
        ("Хороший вопрос, дайте подумать.", "That's a good question, let me think."),
        ("Навскидку я бы сказал — около двух недель.", "Off the top of my head, I'd say about two weeks."),
        ("Это зависит от нагрузки.", "It depends on the load."),
        ("Если я правильно понял вопрос, вы спрашиваете о сроках.", "If I understand the question correctly, you're asking about the timeline."),
        ("Если коротко — да, но есть нюанс.", "The short answer is yes, but there's a catch."),
    ],
    "call-clarify": [
        ("Извините, я не расслышал.", "Sorry, I didn't catch that."),
        ("Можете повторить, пожалуйста?", "Could you say that again, please?"),
        ("Вы имеете в виду первую версию?", "Do you mean the first version?"),
        ("Можете говорить чуть медленнее?", "Could you speak a bit more slowly?"),
        ("Можете привести пример?", "Could you give me an example?"),
        ("То есть отчёт нужен к пятнице?", "So you need the report by Friday?"),
    ],
    "call-project": [
        ("Я отвечал за тепловой расчёт.", "I was responsible for the thermal analysis."),
        ("Главной трудностью был вес.", "The main challenge was the weight."),
        ("Мы решили это, поменяв материал.", "We solved it by changing the material."),
        ("В итоге мы уложились в срок.", "In the end, we met the deadline."),
        ("Я тесно работал с испытателями.", "I worked closely with the test engineers."),
        ("Сейчас я бы начал испытания раньше.", "Looking back, I would start testing earlier."),
    ],
    "call-explain": [
        ("Проще говоря, это очень жёсткая пружина.", "In simple terms, it's a very stiff spring."),
        ("Представь, что у тебя есть длинная балка.", "Imagine you have a long beam."),
        ("Главное, что деталь не должна деформироваться.", "The key point is that the part must not deform."),
        ("Другими словами, мы проверяем прочность.", "In other words, we're checking the strength."),
        ("Понятно объясняю?", "Does that make sense?"),
        ("Это похоже на пружину, но работает в обе стороны.", "It's similar to a spring, but it works both ways."),
    ],
    "call-disagree": [
        ("Понимаю, но у нас мало времени.", "I see your point, but we're short on time."),
        ("Не уверен, что согласен.", "I'm not sure I agree."),
        ("Не знаю, но выясню.", "I don't know, but I'll find out."),
        ("Могу ошибаться, но, кажется, дело в датчике.", "I might be wrong, but I think it's the sensor."),
        ("Справедливо.", "Fair point."),
        ("Честно говоря, это не моя область.", "To be honest, that's outside my area."),
    ],
    "call-questions": [
        ("Как выглядит обычный рабочий день на этой позиции?", "What does a typical day look like in this role?"),
        ("Какими программами пользуется команда?", "What software does the team use?"),
        ("Какие дальше шаги?", "What are the next steps?"),
        ("Чего вы ждёте от меня в первые три месяца?", "What would you expect from me in the first three months?"),
    ],
}

# ——— Позывной: подстановка. (образец, перевод, [(подсказка, результат)]) ———
SUBSTITUTION = {
    "call-intro": [
        ("I'm particularly interested in structural analysis.", "Меня особенно интересует прочностной анализ.",
         [("двигатели", "I'm particularly interested in propulsion."), ("материалы", "I'm particularly interested in materials."), ("системы управления", "I'm particularly interested in control systems.")]),
        ("My background is in rocket and space engineering.", "По специальности я инженер ракетно-космической техники.",
         [("машиностроение", "My background is in mechanical engineering."), ("материаловедение", "My background is in materials science."), ("прикладная математика", "My background is in applied mathematics.")]),
    ],
    "call-time": [
        ("Off the top of my head, I'd say about two weeks.", "Навскидку — около двух недель.",
         [("около ста килограммов", "Off the top of my head, I'd say about a hundred kilograms."), ("примерно пять процентов", "Off the top of my head, I'd say about five percent."), ("три-четыре человека", "Off the top of my head, I'd say three or four people.")]),
    ],
    "call-clarify": [
        ("Could you send me the drawings by Friday?", "Можешь прислать чертежи до пятницы?",
         [("отчёт / к среде", "Could you send me the report by Wednesday?"), ("данные испытаний / к завтрашнему дню", "Could you send me the test data by tomorrow?"), ("обновлённый график / к концу недели", "Could you send me the updated schedule by the end of the week?")]),
        ("Do you mean the first version or the second one?", "Ты про первую версию или вторую?",
         [("старый чертёж / новый", "Do you mean the old drawing or the new one?"), ("этот датчик / тот", "Do you mean this sensor or that one?"), ("понедельник / вторник", "Do you mean Monday or Tuesday?")]),
    ],
    "call-project": [
        ("I've been working on composite testing for two months.", "Я уже два месяца занимаюсь испытаниями композитов.",
         [("CAD-модель / три недели", "I've been working on the CAD model for three weeks."), ("тепловой расчёт / полгода", "I've been working on the thermal analysis for six months."), ("испытательный стенд / год", "I've been working on the test rig for a year.")]),
        ("I'm responsible for the thermal design.", "Я отвечаю за тепловое проектирование.",
         [("расчёт на прочность", "I'm responsible for the stress analysis."), ("закупки", "I'm responsible for procurement."), ("документация", "I'm responsible for the documentation.")]),
        ("The main challenge was the weight.", "Главной трудностью был вес.",
         [("сроки", "The main challenge was the deadline."), ("вибрация", "The main challenge was vibration."), ("бюджет", "The main challenge was the budget.")]),
    ],
    "call-explain": [
        ("Think of it as a very stiff spring.", "Представь это как очень жёсткую пружину.",
         [("очень тонкая мембрана", "Think of it as a very thin membrane."), ("большой термос", "Think of it as a big thermos."), ("рычаг", "Think of it as a lever.")]),
    ],
    "call-disagree": [
        ("I see your point, but we're short on time.", "Понимаю, но у нас мало времени.",
         [("у нас нет данных", "I see your point, but we don't have the data."), ("это дороже", "I see your point, but it's more expensive."), ("это рискованно", "I see your point, but it's risky.")]),
        ("I don't know, but I'll find out by tomorrow.", "Не знаю, но выясню к завтра.",
         [("к обеду", "I don't know, but I'll find out by lunch."), ("на этой неделе", "I don't know, but I'll find out this week."), ("после созвона", "I don't know, but I'll find out after the call.")]),
    ],
    "call-questions": [
        ("What does a typical day look like in this role?", "Как выглядит обычный день на этой позиции?",
         [("в вашей команде", "What does a typical day look like in your team?"), ("для стажёра", "What does a typical day look like for an intern?"), ("на испытательной площадке", "What does a typical day look like at the test site?")]),
    ],
}


def slug(module: str, i: int) -> str:
    return f"{module.split('-', 1)[1]}-{i + 1:02d}"


def std_speak(*texts: str | None) -> list[dict]:
    return [{"text": t, "voice": v} for t in texts if t for v in STD]


def build():
    air_dir = OUT / "air"
    call_dir = OUT / "call"
    air_dir.mkdir(parents=True, exist_ok=True)
    call_dir.mkdir(parents=True, exist_ok=True)

    phrases = []
    for module, items in PHRASES.items():
        for i, row in enumerate(items):
            text, wrong, ru, focus, voice, *rest = row
            p = {"id": f"l-{slug(module, i)}", "module": module, "text": text, "options": [text, *wrong], "ru": ru, "focus": focus, "voice": voice, "reviewed": False}
            if rest:
                p["say"] = rest[0]
            phrases.append(p)
    for i, (text, wrong, ru, focus) in enumerate(ACCENT_PHRASES):
        voices = ACCENT_SETS[i % 2]
        phrases.append({"id": f"l-accents-{i + 1:02d}", "module": "air-accents", "text": text, "options": [text, *wrong], "ru": ru, "focus": focus, "voice": voices[0], "voices": voices, "reviewed": False})

    passages = []
    for p in PASSAGES:
        passages.append({
            "id": p["id"], "module": "air-long", "title": p["title"], "kind": p["kind"], "situation": p["situation"],
            "lines": [{"speaker": s, "voice": VOICE[s], "text": t, "ru": ru} for s, t, ru in p["lines"]],
            "questions": [{"q": q, "options": opts, "answer": 0} for q, opts in p["questions"]],
            "reviewed": False,
        })

    connected = [{"module": m, **v} for m, v in CONNECTED.items()]

    chunks = []
    for module, items in CHUNKS.items():
        for i, (en, ru, ex, ex_ru) in enumerate(items):
            c = {"id": f"c-{slug(module, i)}", "module": module, "fn": FUNCTIONS[module], "en": en, "ru": ru, "reviewed": False}
            if ex:
                c["example"] = ex
                c["exampleRu"] = ex_ru
            c["speak"] = std_speak(en, ex)
            chunks.append(c)

    questions = []
    k = 0
    for module, items in QUESTIONS.items():
        for i, (q, ru) in enumerate(items):
            questions.append({"id": f"q-{slug(module, i)}", "module": module, "q": q, "ru": ru, "voice": QUESTION_VOICES[k % len(QUESTION_VOICES)], "reviewed": False})
            k += 1

    translate = []
    for module, items in TRANSLATE.items():
        for i, (ru, en) in enumerate(items):
            translate.append({"id": f"t-{slug(module, i)}", "module": module, "ru": ru, "en": en, "speak": std_speak(en), "reviewed": False})

    subst = []
    for module, items in SUBSTITUTION.items():
        for i, (base, ru, swaps) in enumerate(items):
            subst.append({
                "id": f"s-{slug(module, i)}", "module": module, "base": base, "ru": ru,
                "swaps": [{"cue": c, "en": e} for c, e in swaps],
                "speak": std_speak(base, *[e for _, e in swaps]),
                "reviewed": False,
            })

    def dump(path: Path, data):
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    dump(OUT / "characters.json", CHARACTERS)
    dump(air_dir / "connected.json", connected)
    dump(air_dir / "phrases.json", phrases)
    dump(air_dir / "passages.json", passages)
    dump(call_dir / "chunks.json", chunks)
    dump(call_dir / "questions.json", questions)
    dump(call_dir / "translate.json", translate)
    dump(call_dir / "substitution.json", subst)
    print(f"Эфир: {len(phrases)} фраз, {len(passages)} отрывков; Позывной: {len(chunks)} чанков, {len(questions)} вопросов, "
          f"{len(translate)} на перевод, {len(subst)} подстановок")


if __name__ == "__main__":
    build()
