"""
Пул игры «Помехи» → src/content/games/static.json.

  .venv\\Scripts\\python.exe scripts\\author_games.py

Фраза звучит сквозь радиошум, ученик выбирает, какое из трёх предложений сказали.
Ловушки отличаются от текста одной мелочью, которую можно различить только на слух:
them/him, can/can't, fifteen/fifty, a/the, need/needed, единственное/множественное число,
Tuesday/Thursday, he's/he was, launch/lunch и т. п.

Две части:
  REUSED  (id g-st-r-NNN) — реплики курса, у которых уже есть mp3 (public/audio/manifest.json):
          примеры чанков, перевод, подстановки, отрывки Эфира, эпизоды, вопросы, фразы Чистого сигнала.
          Голос — тот, что есть в манифесте для этого текста (предпочтительно us-*/gb-*, по кругу).
          Перевод берётся из исходного файла, если не задан явно.
  NEW     (id g-st-n-NNN) — новые короткие фразы из жизни КБ и быта. Пока mp3 нет, их читает голос
          телефона; generate_audio.py озвучит их по полю voice (us-f, us-m, gb-f, gb-m по кругу).
  MECH    (id g-st-m-NNN, field: "mech") — новые фразы из цеха для специальности «машиностроение»:
          станки, допуски и замеры, сборка, сварка, гидравлика, ремонт, план и ОТК. Правила те же, что у NEW.

Специальности (scripts/fields.py): фраза про ракеты и космос получает field: "space" — автоматически по
тексту и переводу (space_field) или по списку SPACE_EXTRA, где ключевых слов нет, но смысл космический.

Формат строки: (текст, ловушка 1, ловушка 2, фокус[, перевод]). options[0] всегда верный — приложение
перемешивает. Новые строки добавлять только в конец списков: id — порядковые, так они не сдвинутся.
Фразы из air/phrases.json и вводного теста сюда не берём — они уже есть в «Помехах».
Всё помечено reviewed: false.
"""
import json
from pathlib import Path

from fields import space_field, with_field

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "content"
STD = ["us-f", "us-m", "gb-f", "gb-m"]

# ——— Часть 1: реплики курса с готовым звуком ———
REUSED = [
    # call/chunks.json — примеры и сами чанки
    ("Let me briefly introduce myself.", "Let me briefly introduce them.", "Let me briefly introduce my team.", "introduce myself"),
    ("I'm a fourth-year student in aerospace engineering.", "I was a fourth-year student in aerospace engineering.", "I'm a fourth-year student of aerospace engineering.", "I'm a fourth-year student in"),
    ("I'm currently working on a project about composite testing.", "I'm currently working on the project about composite testing.", "I'm currently working on a project about composite tests.", "a project about composite testing"),
    ("My background is in rocket and space engineering.", "My background was in rocket and space engineering.", "My background is in rockets and space engineering.", "is in rocket and"),
    ("I'm particularly interested in structural analysis.", "I was particularly interested in structural analysis.", "I'm particularly interested in structural analyses.", "I'm particularly interested in structural analysis"),
    ("I've had some hands-on experience with CAD and FEA.", "I had some hands-on experience with CAD and FEA.", "I've had some hands-on experience with CAD and CFD.", "I've had some hands-on experience with CAD and FEA"),
    ("What I enjoy most is solving practical problems.", "What I enjoyed most was solving practical problems.", "What I enjoy most is solving a practical problem.", "I enjoy most is solving practical problems"),
    ("In my free time, I like to read about space missions.", "In my free time, I used to read about space missions.", "In my free time, I like to read about a space mission.", "I like to read about space missions"),
    ("I'm looking for a position where I can grow as an engineer.", "I was looking for a position where I can grow as an engineer.", "I'm looking for a position where I could grow as an engineer.", "I'm looking for a position where I can"),
    ("That's a good question, let me think.", "That was a good question, let me think.", "That's a good question, let's think.", "That's a good question, let me think"),
    ("Let me think about that for a second.", "Let me think about it for a second.", "Let me think about that for a sec.", "think about that for a second"),
    ("How can I put it... it's more of a process than a tool.", "How can I put it... it's more of a process than the tool.", "How can I put it... it's more a process than a tool.", "more of a process than a tool"),
    ("Well, it depends on the requirements.", "Well, it depended on the requirements.", "Well, it depends on the requirement.", "it depends on the requirements"),
    ("Off the top of my head, I'd say about two weeks.", "Off the top of my head, I'd say about ten weeks.", "Off the top of my head, I'd say about three weeks.", "about two weeks"),
    ("Give me a moment to gather my thoughts.", "Give me a minute to gather my thoughts.", "Give me a moment to gather our thoughts.", "a moment to gather my thoughts"),
    ("Let me put it another way.", "Let me put it the other way.", "Let me say it another way.", "put it another way"),
    ("If I understand the question correctly, you're asking about the timeline.", "If I understood the question correctly, you're asking about the timeline.", "If I understand the question correctly, you're asking about the timelines.", "If I understand the question correctly"),
    ("The short answer is yes, but there's a catch.", "The short answer is no, but there's a catch.", "The short answer is yes, but there was a catch.", "yes, but there's a catch"),
    ("I haven't thought about it that way before.", "I hadn't thought about it that way before.", "I haven't thought about it this way before.", "I haven't thought about it that way"),
    ("Could you say that again, please?", "Would you say that again, please?", "Could you say it again, please?", "Could you say that"),
    ("Sorry, I didn't catch that.", "Sorry, I didn't catch it.", "Sorry, I can't catch that.", "I didn't catch that"),
    ("Could you speak a bit more slowly?", "Can you speak a bit more slowly?", "Could you speak a bit slower?", "Could you speak a bit more slowly"),
    ("Do you mean the first version or the second one?", "Did you mean the first version or the second one?", "Do you mean the first versions or the second one?", "Do you mean the first version"),
    ("Just to make sure I understand, you need the report by Friday?", "Just to make sure I understand, you needed the report by Friday?", "Just to make sure I understand, you need the reports by Friday?", "you need the report by Friday"),
    ("Could you walk me through it?", "Could you walk me through them?", "Would you walk me through it?", "Could you walk me through it"),
    ("What exactly do you mean by critical?", "What exactly did you mean by critical?", "What exactly do they mean by critical?", "do you mean by critical"),
    ("Could you give me an example?", "Could you give me some examples?", "Could you give them an example?", "give me an example"),
    ("So, if I understand correctly, the test is on Thursday.", "So, if I understand correctly, the test is on Tuesday.", "So, if I understand correctly, the test was on Thursday.", "the test is on Thursday"),
    ("Could you spell that, please?", "Could you spell it, please?", "Can you spell that, please?", "Could you spell that"),
    ("The goal of the project was to reduce the weight of the bracket.", "The goal of the project is to reduce the weight of the bracket.", "The goal of the project was to reduce the weight of the brackets.", "was to reduce the weight of the bracket"),
    ("I was responsible for the stress analysis.", "I'm responsible for the stress analysis.", "I was responsible for a stress analysis.", "I was responsible for the"),
    ("We had a tight deadline, so we split the work into two teams.", "We have a tight deadline, so we split the work into two teams.", "We had a tight deadline, so we split the work into three teams.", "We had a tight deadline"),
    ("The main challenge was the vibration at launch.", "The main challenge was the vibration at lunch.", "The main challenge is the vibration at launch.", "was the vibration at launch"),
    ("We solved it by changing the material.", "We solved it by changing the materials.", "We solved them by changing the material.", "solved it by changing the material"),
    ("As a result, the mass dropped by fifteen percent.", "As a result, the mass dropped by fifty percent.", "As a result, the mass dropped by sixteen percent.", "fifteen percent"),
    ("I worked closely with the test engineers.", "I work closely with the test engineers.", "I worked closely with the test engineer.", "worked closely with the test engineers"),
    ("My role was to prepare the test plan.", "My role is to prepare the test plan.", "My role was to prepare the test plans.", "was to prepare the test plan", "Моей задачей было подготовить программу испытаний."),
    ("In the end, we managed to meet the deadline.", "In the end, we managed to meet the deadlines.", "In the end, we didn't manage to meet the deadline.", "we managed to meet the deadline"),
    ("Looking back, I would start testing earlier.", "Looking back, I would start testing later.", "Looking back, I could start testing earlier.", "I would start testing earlier"),
    ("In simple terms, it's a very stiff spring.", "In simple terms, it's a very stiff string.", "In simple terms, it was a very stiff spring.", "it's a very stiff spring"),
    ("Think of it as a thermos for electronics.", "Think of it as a thermos for the electronics.", "Think of them as a thermos for electronics.", "Think of it as a thermos for electronics"),
    ("Basically, it's a way to find weak spots before we build anything.", "Basically, it's a way to find weak spots after we build anything.", "Basically, it's a way to find weak spots before we test anything.", "before we build anything", "По сути, это способ найти слабые места ещё до того, как мы что-то построим."),
    ("The idea is pretty simple: we split the part into small pieces.", "The idea is pretty simple: we split the part into smaller pieces.", "The idea is pretty simple: we split the parts into small pieces.", "split the part into small pieces"),
    ("Let me give you an example.", "Let me give you some examples.", "Let me give them an example.", "give you an example"),
    ("Imagine you have a long beam fixed at one end.", "Imagine you have a long beam fixed at both ends.", "Imagine you have a long beam fixed at the end.", "fixed at one end"),
    ("It's similar to a spring, but it works both ways.", "It's similar to a string, but it works both ways.", "It was similar to a spring, but it works both ways.", "It's similar to a spring"),
    ("The key point is that the part must not deform.", "The key point is that the parts must not deform.", "The key point is that the part might not deform.", "the part must not deform"),
    ("In other words, we're checking the strength.", "In other words, we were checking the strength.", "In other words, we're checking the length.", "we're checking the strength"),
    ("Does that make sense?", "Did that make sense?", "Does it make sense?", "Does that make sense"),
    ("I see your point, but we're short on time.", "I see your point, but we were short on time.", "I see your point, but we're short of time.", "we're short on time"),
    ("I'm not sure I agree with that.", "I'm not sure I agreed with that.", "I'm not sure they agree with that.", "I agree with that"),
    ("That's true, but have we considered the cost?", "That's true, but have we considered the costs?", "That's true, but had we considered the cost?", "have we considered the cost"),
    ("I'd look at it a bit differently.", "I'll look at it a bit differently.", "I'd look at them a bit differently.", "I'd look at it"),
    ("I don't know, but I'll find out.", "I didn't know, but I'll find out.", "I don't know, but I'd find out.", "I don't know, but I'll find out"),
    ("I'm not sure off the top of my head. Can I get back to you?", "I'm not sure off the top of my head. Can I get back to them?", "I'm not sure off the top of my head. Could I get back to you?", "Can I get back to you"),
    ("That's outside my area, to be honest.", "That was outside my area, to be honest.", "That's outside our area, to be honest.", "That's outside my area"),
    ("I might be wrong, but I think it's the sensor.", "I might be wrong, but I think it's the sensors.", "I might be wrong, but I think it was the sensor.", "I think it's the sensor"),
    ("With respect, I think we need more data first.", "With respect, I think we needed more data first.", "With respect, I think we need more data fast.", "we need more data first"),
    ("What does a typical day look like in this role?", "What does a typical day look like in your role?", "What does a typical day look like in this room?", "in this role"),
    ("What would you expect from me in the first three months?", "What would you expect from me in the first three weeks?", "What do you expect from me in the first three months?", "the first three months"),
    ("How is the team structured?", "How was the team structured?", "How are the teams structured?", "How is the team"),
    ("What are the biggest challenges the team is facing right now?", "What's the biggest challenge the team is facing right now?", "What are the biggest challenges the teams are facing right now?", "What are the biggest challenges the team is"),
    ("How do you measure success in this position?", "How did you measure success in this position?", "How do they measure success in this position?", "How do you measure"),
    ("What opportunities are there for learning and growth?", "What opportunities were there for learning and growth?", "What opportunity is there for learning and growth?", "What opportunities are there"),
    ("What software does the team use?", "What software do the teams use?", "What software did the team use?", "does the team use"),
    ("What are the next steps in the process?", "What are the next steps of the process?", "What were the next steps in the process?", "What are the next steps in"),
    # call/translate.json
    ("I'm a fourth-year student studying rocket engineering.", "I was a fourth-year student studying rocket engineering.", "I'm the fourth-year student studying rocket engineering.", "I'm a fourth-year student"),
    ("I'm currently working on my thesis.", "I'm currently working on the thesis.", "I'm currently working on his thesis.", "working on my thesis"),
    ("I'm particularly interested in composites.", "I was particularly interested in composites.", "I'm particularly interested in components.", "I'm particularly interested in composites"),
    ("I have experience with SolidWorks.", "I had experience with SolidWorks.", "I have some experience with SolidWorks.", "I have experience with"),
    ("I'm looking for a summer internship.", "I was looking for a summer internship.", "I'm looking for the summer internship.", "I'm looking for a summer"),
    ("What I enjoy most is hands-on work.", "What I enjoyed most was hands-on work.", "What I enjoy more is hands-on work.", "What I enjoy most is"),
    ("It depends on the load.", "It depended on the load.", "It depends on the loads.", "It depends on the load"),
    ("Do you mean the first version?", "Did you mean the first version?", "Do you mean the first versions?", "Do you mean the first version"),
    ("So you need the report by Friday?", "So you needed the report by Friday?", "So you need the report on Friday?", "need the report by Friday"),
    ("I was responsible for the thermal analysis.", "I'm responsible for the thermal analysis.", "I was responsible for a thermal analysis.", "I was responsible for the"),
    ("The main challenge was the weight.", "The main challenge is the weight.", "The main challenge was its weight.", "was the weight"),
    ("In the end, we met the deadline.", "In the end, we missed the deadline.", "In the end, we met the deadlines.", "we met the deadline"),
    ("Imagine you have a long beam.", "Imagine you had a long beam.", "Imagine we have a long beam.", "Imagine you have a long beam"),
    ("I'm not sure I agree.", "I'm not sure I agreed.", "I'm not sure they agree.", "I'm not sure I agree"),
    ("To be honest, that's outside my area.", "To be honest, that was outside my area.", "To be honest, that's outside our area.", "that's outside my area"),
    ("What are the next steps?", "What were the next steps?", "What's the next step?", "What are the next steps"),
    # call/substitution.json — база и замены (у замен в источнике вместо перевода подсказка — переводим сами)
    ("I'm particularly interested in propulsion.", "I was particularly interested in propulsion.", "I'm particularly interested in production.", "interested in propulsion", "Меня особенно интересуют двигательные установки."),
    ("I'm particularly interested in materials.", "I was particularly interested in materials.", "I'm particularly interested in material.", "I'm particularly interested in materials", "Меня особенно интересуют материалы."),
    ("I'm particularly interested in control systems.", "I was particularly interested in control systems.", "I'm particularly interested in the control systems.", "interested in control systems", "Меня особенно интересуют системы управления."),
    ("My background is in mechanical engineering.", "My background was in mechanical engineering.", "My background is mechanical engineering.", "My background is in mechanical", "По образованию я инженер-механик."),
    ("My background is in materials science.", "My background was in materials science.", "My background is in materials engineering.", "is in materials science", "По образованию я материаловед."),
    ("My background is in applied mathematics.", "My background was in applied mathematics.", "My background is in applied mechanics.", "is in applied mathematics", "По образованию я специалист по прикладной математике."),
    ("Off the top of my head, I'd say about a hundred kilograms.", "Off the top of my head, I'd say about two hundred kilograms.", "Off the top of my head, I'd say about a hundred kilometres.", "about a hundred kilograms", "Навскидку — около ста килограммов."),
    ("Off the top of my head, I'd say about five percent.", "Off the top of my head, I'd say about fifty percent.", "Off the top of my head, I'd say about nine percent.", "about five percent", "Навскидку — примерно пять процентов."),
    ("Off the top of my head, I'd say three or four people.", "Off the top of my head, I'd say two or three people.", "Off the top of my head, I'd say three or four weeks.", "three or four people", "Навскидку — три-четыре человека."),
    ("Could you send me the drawings by Friday?", "Could you send me the drawing by Friday?", "Could you send them the drawings by Friday?", "send me the drawings"),
    ("Could you send me the report by Wednesday?", "Could you send me the reports by Wednesday?", "Could you send me the report on Wednesday?", "the report by Wednesday", "Можешь прислать отчёт до среды?"),
    ("Could you send me the test data by tomorrow?", "Could you send me the test data by today?", "Could you send him the test data by tomorrow?", "send me the test data by tomorrow", "Можешь прислать данные испытаний до завтра?"),
    ("Could you send me the updated schedule by the end of the week?", "Could you send me the updated schedule by the end of the day?", "Could you send me the updated schedules by the end of the week?", "updated schedule by the end of the week", "Можешь прислать обновлённый график до конца недели?"),
    ("Do you mean the old drawing or the new one?", "Do you mean the whole drawing or the new one?", "Do you mean the old drawings or the new ones?", "the old drawing", "Ты имеешь в виду старый чертёж или новый?"),
    ("Do you mean this sensor or that one?", "Do you mean these sensors or that one?", "Did you mean this sensor or that one?", "Do you mean this sensor", "Ты имеешь в виду этот датчик или тот?"),
    ("Do you mean Monday or Tuesday?", "Do you mean Monday or Thursday?", "Do you mean Sunday or Tuesday?", "Monday or Tuesday", "Ты имеешь в виду понедельник или вторник?"),
    ("I've been working on composite testing for two months.", "I've been working on composite testing for ten months.", "I've been working on composite testing for two weeks.", "for two months"),
    ("I've been working on the CAD model for three weeks.", "I've been working on the CAD model for two weeks.", "I've been working on the CAD models for three weeks.", "the CAD model for three weeks", "Я уже три недели работаю над CAD-моделью."),
    ("I've been working on the thermal analysis for six months.", "I've been working on the thermal analysis for six weeks.", "I worked on the thermal analysis for six months.", "for six months", "Я уже полгода занимаюсь тепловым расчётом."),
    ("I've been working on the test rig for a year.", "I've been working on the test rigs for a year.", "I've been working on the test rig for years.", "the test rig for a year", "Я уже год работаю над испытательным стендом."),
    ("I'm responsible for the stress analysis.", "He's responsible for the stress analysis.", "I'm responsible for the test analysis.", "I'm responsible for the stress", "Я отвечаю за расчёт на прочность."),
    ("I'm responsible for procurement.", "I was responsible for procurement.", "I'm not responsible for procurement.", "I'm responsible for", "Я отвечаю за закупки."),
    ("I'm responsible for the documentation.", "I was responsible for the documentation.", "They're responsible for the documentation.", "I'm responsible", "Я отвечаю за документацию."),
    ("The main challenge was the deadline.", "The main challenge was the deadlines.", "The main challenge is the deadline.", "was the deadline", "Главной трудностью были сроки."),
    ("The main challenge was vibration.", "The main challenge was the vibration.", "The main challenge is vibration.", "was vibration", "Главной трудностью была вибрация."),
    ("The main challenge was the budget.", "The main challenge was a budget.", "The main challenge is the budget.", "was the budget", "Главной трудностью был бюджет."),
    ("Think of it as a very stiff spring.", "Think of it as a very stiff string.", "Think of them as very stiff springs.", "a very stiff spring"),
    ("Think of it as a very thin membrane.", "Think of it as a very thick membrane.", "Think of them as very thin membranes.", "a very thin membrane", "Представь это как очень тонкую мембрану."),
    ("Think of it as a big thermos.", "Think of it as the big thermos.", "Think of them as a big thermos.", "Think of it as a big", "Представь это как большой термос."),
    ("Think of it as a lever.", "Think of it as a level.", "Think of them as a lever.", "it as a lever", "Представь это как рычаг."),
    ("I see your point, but we don't have the data.", "I see your point, but we didn't have the data.", "I see your point, but they don't have the data.", "we don't have the data", "Понимаю, но у нас нет данных."),
    ("I see your point, but it's more expensive.", "I see your point, but it's much more expensive.", "I see your point, but it was more expensive.", "it's more expensive", "Понимаю, но это дороже."),
    ("I see your point, but it's risky.", "I see your point, but it was risky.", "I see your point, but it's a risk.", "but it's risky", "Понимаю, но это рискованно."),
    ("I don't know, but I'll find out by tomorrow.", "I don't know, but I'd find out by tomorrow.", "I didn't know, but I'll find out by tomorrow.", "I'll find out by tomorrow", "Не знаю, но выясню к завтрашнему дню."),
    ("I don't know, but I'll find out by lunch.", "I don't know, but I'll find out by launch.", "I don't know, but I'll find out after lunch.", "by lunch", "Не знаю, но выясню к обеду."),
    ("I don't know, but I'll find out this week.", "I don't know, but I'll find out next week.", "I don't know, but I'll find out this weekend.", "this week", "Не знаю, но выясню на этой неделе."),
    ("I don't know, but I'll find out after the call.", "I don't know, but I'll find out before the call.", "I don't know, but I'll find out after the calls.", "after the call", "Не знаю, но выясню после созвона."),
    ("What does a typical day look like in your team?", "What does a typical day look like in our team?", "What does a typical day look like in your teams?", "in your team", "Как выглядит обычный день в вашей команде?"),
    ("What does a typical day look like for an intern?", "What does a typical day look like for the intern?", "What does a typical day look like for interns?", "for an intern", "Как выглядит обычный день стажёра?"),
    ("What does a typical day look like at the test site?", "What does a typical day look like at the test sites?", "What did a typical day look like at the test site?", "at the test site", "Как выглядит обычный день на испытательной площадке?"),
    # air/passages.json — реплики отрывков (голоса персонажей)
    ("Morning, everyone. Let's keep this short. Tom, you first.", "Morning, everyone. Let's keep it short. Tom, you first.", "Morning, everyone. Let's keep this short. Tom, you're next.", "Let's keep this short"),
    ("Just one. I still don't have the updated material data from the supplier.", "Just one. I still didn't have the updated material data from the supplier.", "Just one. I still don't have the updated material data from the suppliers.", "I still don't have"),
    ("I'll chase them after this call. Thanks, everyone.", "I'll chase him after this call. Thanks, everyone.", "I'll chase them after the call. Thanks, everyone.", "chase them after this call"),
    ("Hi Dana, thanks for making time. I've got some good news and some not-so-good news.", "Hi Dana, thanks for making time. I've got some good news and some bad news.", "Hi Dana, thanks for making time. I got some good news and some not-so-good news.", "I've got some good news"),
    ("Let's start with the good news.", "Let's start with the bad news.", "Let's start with some good news.", "with the good news", "Давай начнём с хороших новостей."),
    ("The carbon fiber panels passed inspection, so they'll ship on Monday.", "The carbon fiber panels passed inspection, so they'd ship on Monday.", "The carbon fiber panels passed inspection, so they'll ship on Sunday.", "they'll ship on Monday"),
    ("Great. And the bad news?", "Great. Now the bad news?", "Great. And the good news?", "And the bad news"),
    ("I can check. If they have fifty in stock, I could send those by express.", "I can check. If they have fifteen in stock, I could send those by express.", "I can check. If they have fifty in stock, I would send those by express.", "fifty in stock, I could send"),
    ("That would help a lot. Please let me know by Wednesday.", "That will help a lot. Please let me know by Wednesday.", "That would help a lot. Please let me know on Wednesday.", "That would help"),
    ("So, tell me about a project you're proud of.", "So, tell me about a project you were proud of.", "So, tell me about the project you're proud of.", "a project you're proud of"),
    ("What was the main challenge?", "What's the main challenge?", "What were the main challenges?", "What was the main challenge"),
    ("And did it work?", "And does it work?", "And did they work?", "did it work"),
    ("Nice. What would you do differently next time?", "Nice. What could you do differently next time?", "Nice. What would you do differently this time?", "What would you do differently next time"),
    ("Right, so here's what happened on Friday. We ran the random vibration test at full level.", "Right, so here's what happened on Friday. We ran the random vibration tests at full level.", "Right, so here's what happened on Friday. We ran the random vibration test at half level.", "the random vibration test at full level"),
    ("If it happens again, we'll need to look at the bracket design itself.", "If it happened again, we'd need to look at the bracket design itself.", "If it happens again, we'll need to look at the bracket designs.", "If it happens again, we'll need"),
    ("Hey Priya, have you got a sec? It's about tomorrow's design review.", "Hey Priya, have you got a sec? It's about today's design review.", "Hey Priya, have you got a sec? It's about tomorrow's design reviews.", "tomorrow's design review"),
    ("The client wants to move it to Thursday afternoon. Does that work for you?", "The client wants to move it to Tuesday afternoon. Does that work for you?", "The clients want to move it to Thursday afternoon. Does that work for you?", "move it to Thursday afternoon"),
    ("Thursday afternoon. I have the lab until three. Could we do four o'clock?", "Thursday afternoon. I have the lab until three. Could we do five o'clock?", "Thursday afternoon. I had the lab until three. Could we do four o'clock?", "until three. Could we do four"),
    ("Four should be fine. I'll send an updated invite.", "Four should be fine. I'll send the updated invite.", "Four would be fine. I'll send an updated invite.", "I'll send an updated invite"),
    ("Will do. Oh, and they'd like a short demo of the test rig, if possible.", "Will do. Oh, and he'd like a short demo of the test rig, if possible.", "Will do. Oh, and they'd like a short demo of the test rigs, if possible.", "they'd like a short demo of the test rig"),
    ("No problem. I'll prepare something, ten minutes max.", "No problem. I'll prepare something, two minutes max.", "No problem. I'd prepare something, ten minutes max.", "I'll prepare something, ten minutes"),
    ("It can apply up to fifty kilonewtons, which is enough for most of our composite specimens.", "It can apply up to fifteen kilonewtons, which is enough for most of our composite specimens.", "It can apply up to fifty kilonewtons, which isn't enough for most of our composite specimens.", "up to fifty kilonewtons, which is enough"),
    ("The specimen sits in these wedge grips, and the load cell above it measures the force.", "The specimen sits in these wedge grips, and the load cell below it measures the force.", "The specimen sits in these wedge grips, and a load cell above it measures the force.", "the load cell above it"),
    # story/episodes.json, episodes-2.json — реплики персонажей и верные ответы героя
    ("Hi, thanks for coming in. Did you find us okay?", "Hi, thanks for coming in. Did you find it okay?", "Hi, thanks for coming in. Do you find us okay?", "Did you find us okay"),
    ("Yes, thanks. The directions were really clear.", "Yes, thanks. The direction was really clear.", "Yes, thanks. The directions are really clear.", "The directions were"),
    ("Great. I'm Mike, I handle recruitment, and this is Dana. She leads the structures team.", "Great. I'm Mike, I handle recruitment, and this is Dana. She led the structures team.", "Great. I'm Mike, I handle recruitment, and this is Dana. She leads the structure team.", "She leads the structures team"),
    ("Nice to meet you. So, let's start easy. Tell me a little about yourself.", "Nice to meet you. So, let's start early. Tell me a little about yourself.", "Nice to meet you. So, let's start easy. Tell me a lot about yourself.", "let's start easy. Tell me a little"),
    ("Composite testing, interesting. What exactly are you testing?", "Composite testing, interesting. What exactly were you testing?", "Composite testing, interesting. What exactly are they testing?", "What exactly are you testing"),
    ("Mostly tensile and bending tests of carbon fiber specimens, and I compare the results with FEA.", "Mostly tensile and bending tests of carbon fiber specimens, and I compared the results with FEA.", "Mostly tensile and bending tests of carbon fiber specimens, and I compare the result with FEA.", "I compare the results"),
    ("And what was the most difficult part?", "And what's the most difficult part?", "And what were the most difficult parts?", "what was the most difficult part"),
    ("Do you have any questions for us?", "Do you have any questions for them?", "Did you have any questions for us?", "Do you have any questions for us"),
    ("Yes, what does a typical day look like for an intern in your team?", "Yes, what does a typical day look like for the intern in your team?", "Yes, what does a typical day look like for an intern in our team?", "for an intern in your team"),
    ("Thanks for your time. We'll be in touch by the end of next week.", "Thanks for your time. We'll be in touch by the end of this week.", "Thanks for your time. We'd be in touch by the end of next week.", "We'll be in touch by the end of next week"),
    ("Thank you, I really enjoyed the conversation.", "Thank you, I really enjoy the conversation.", "Thank you, I really enjoyed the conversations.", "I really enjoyed the conversation"),
    ("Welcome aboard! Let me introduce you to the team. This is Priya, she'll be your mentor.", "Welcome aboard! Let me introduce you to the team. This is Priya, she'd be your mentor.", "Welcome aboard! Let me introduce you to the team. This is Priya, she'll be our mentor.", "she'll be your mentor"),
    ("Hi, great to have you here. How are you settling in?", "Hi, great to have you there. How are you settling in?", "Hi, great to have them here. How are you settling in?", "great to have you here"),
    ("So far so good, thanks. Everyone's been really helpful.", "So far so good, thanks. Everyone was really helpful.", "So far so good, thanks. Everyone's been really hopeful.", "Everyone's been really helpful"),
    ("Sure, that sounds great.", "Sure, that sounded great.", "Sure, that sounds good.", "that sounds great"),
    ("Brilliant. So, where are you from originally?", "Brilliant. So, where are they from originally?", "Brilliant. So, where is she from originally?", "where are you from"),
    ("I'm from Russia, from Moscow. I moved here for the internship.", "I'm from Russia, from Moscow. I moved here for an internship.", "I'm from Russia, from Moscow. I moved here after the internship.", "I moved here for the internship"),
    ("Only the critical ones for now. They're marked in red. No rush, take your time.", "Only the critical one for now. They're marked in red. No rush, take your time.", "Only the critical ones for now. They were marked in red. No rush, take your time.", "the critical ones for now. They're marked in red"),
    ("Okay, everyone's here. Oliver, can you give us a quick update on the vibration test?", "Okay, everyone's here. Oliver, can you give them a quick update on the vibration test?", "Okay, everyone's here. Oliver, can you give us a quick update on the vibration tests?", "can you give us a quick update"),
    ("Did you get all that?", "Did they get all that?", "Do you get all that?", "Did you get all that"),
    ("Mostly. Sorry, could you repeat the part about the first run?", "Mostly. Sorry, could you repeat the part about the first one?", "Mostly. Sorry, could you repeat the parts about the first run?", "the part about the first run"),
    ("Sorry, I'll slow down. The first test this morning went well. No problems.", "Sorry, I'll slow down. The first tests this morning went well. No problems.", "Sorry, I'll slow down. The first test this evening went well. No problems.", "The first test this morning", "Извини, буду говорить медленнее. Первый тест утром прошёл хорошо. Проблем нет."),
    ("I can collect the certificates from the supplier and send them to you by Tuesday.", "I can collect the certificates from the supplier and send them to you by Thursday.", "I can collect the certificates from the supplier and send it to you by Tuesday.", "send them to you by Tuesday"),
    ("That'd be brilliant, thanks.", "That'll be brilliant, thanks.", "That was brilliant, thanks.", "That'd be brilliant"),
    ("Great. Anything else? No? Okay, thanks, everyone. Talk tomorrow.", "Great. Anything new? No? Okay, thanks, everyone. Talk tomorrow.", "Great. Anything else? No? Okay, thanks, everyone. Talk soon.", "Anything else"),
    ("Sure. All channels read close to zero, except channel four — it's drifting a bit.", "Sure. All channels read close to zero, except channel five — it's drifting a bit.", "Sure. All channels read close to zero, except channel four — it was drifting a bit.", "except channel four"),
    ("Drifting? Let me re-seat the connector. Right, try now.", "Drifting? Let me re-seat the connectors. Right, try now.", "Drifting? Let me reset the connector. Right, try now.", "re-seat the connector"),
    ("That fixed it. Channel four is stable now.", "That fixed it. Channel five is stable now.", "That fixed it. Channel fourteen is stable now.", "Channel four is stable"),
    ("Great. We'll load in steps of two kilonewtons and hold each step for thirty seconds.", "Great. We'll load in steps of two kilonewtons and hold each step for thirteen seconds.", "Great. We'll load in steps of ten kilonewtons and hold each step for thirty seconds.", "for thirty seconds"),
    ("Limit load today. Failure test is next week.", "Limit load today. Failure test was last week.", "Limit load today. Fatigue test is next week.", "Failure test is next week"),
    ("So, how did it go? Anything I should worry about?", "So, how did it go? Anything you should worry about?", "So, how does it go? Anything I should worry about?", "Anything I should worry about"),
    ("Nice. Can you put that in a short report by Friday?", "Nice. Could you put that in a short report by Friday?", "Nice. Can you put that in the short report by Friday?", "Can you put that in a short report"),
    ("Sure. I'll include the load–strain curves and a comparison with the FEA.", "Sure. I'll include the load–strain curve and a comparison with the FEA.", "Sure. I'll include the load–strain curves and the comparison with the FEA.", "the load–strain curves and a comparison"),
    ("Just a new date for now. We still need them.", "Just a new date for now. We still need him.", "Just a new date for now. We still needed them.", "We still need them"),
    ("Thanks for calling. When do you expect to ship them?", "Thanks for calling. When did you expect to ship them?", "Thanks for calling. When do you expect to ship it?", "When do you expect to ship them"),
    ("We can ship on Thursday, so you should have them by Monday.", "We can ship on Tuesday, so you should have them by Monday.", "We could ship on Thursday, so you should have them by Monday.", "We can ship on Thursday"),
    ("Great, Monday works. Could you send me the tracking number once they ship?", "Great, Monday works. Could you send me the tracking numbers once they ship?", "Great, Monday works. Could you send me the tracking number once it ships?", "the tracking number once they ship"),
    ("Of course. I'll email it to you on Thursday. Thanks for your patience.", "Of course. I'll email them to you on Thursday. Thanks for your patience.", "Of course. I'll email it to you on Tuesday. Thanks for your patience.", "I'll email it to you on Thursday"),
    ("Over to you. Can you walk us through the results?", "Over to you. Can you walk us through the result?", "Over to you. Can you walk them through the results?", "walk us through the results"),
    ("Sorry to interrupt. Panel three failed at a lower load than the others. Why is that?", "Sorry to interrupt. Panel three failed at a lower load than the other. Why is that?", "Sorry to interrupt. Panel three failed at a lower load than the others. Why was that?", "than the others. Why is that"),
    ("Okay, that makes sense. Can you send us the CT images?", "Okay, that made sense. Can you send us the CT images?", "Okay, that makes sense. Can you send us the CT image?", "that makes sense. Can you send us the CT images"),
    ("Of course. I'll send them today together with the updated report.", "Of course. I'll send it today together with the updated report.", "Of course. I'll send them today together with the updated reports.", "I'll send them today"),
    # clean/phrases.json — фразы Чистого сигнала
    ("Bring the long fitting, please.", "Bring the long fittings, please.", "Bring the wrong fitting, please.", "the long fitting"),
    ("Could you send me the drawing, please?", "Could you send me the drawings, please?", "Could you send them the drawing, please?", "send me the drawing"),
    ("Do you have a minute?", "Did you have a minute?", "Do they have a minute?", "Do you have a minute"),
    ("Every wire was well insulated.", "Every wire is well insulated.", "Every wire was well isolated.", "was well insulated"),
    ("He has half an hour.", "He had half an hour.", "She has half an hour.", "He has half an hour"),
    ("Hold the handle with both hands.", "Hold the handles with both hands.", "Hold the handle with one hand.", "Hold the handle with both hands"),
    ("How high is the heat load?", "How high was the heat load?", "How high are the heat loads?", "How high is the heat load"),
    ("I think the thread is three millimetres thick.", "I think the thread is thirteen millimetres thick.", "I think the threads are three millimetres thick.", "the thread is three millimetres"),
    ("I'm not sure that's right.", "I'm not sure that was right.", "I'm not sure it's right.", "I'm not sure that's right"),
    ("Please fill in this sheet before you leave.", "Please fill in these sheets before you leave.", "Please fill in this sheet before we leave.", "this sheet before you leave"),
    ("Please save the file and close the tab.", "Please save the files and close the tab.", "Please save the file and close the tap.", "save the file and close the tab"),
    ("Something is wrong with the spring.", "Something was wrong with the spring.", "Something is wrong with the string.", "is wrong with the spring"),
    ("Sorry, could you repeat that?", "Sorry, would you repeat that?", "Sorry, could you repeat it?", "could you repeat that"),
    ("That's a good point, but I see it differently.", "That's a good point, but I saw it differently.", "That's a good point, but they see it differently.", "but I see it differently"),
    ("The bad batch was sent back.", "The bad batches were sent back.", "The bad batch was sent out.", "The bad batch was sent back"),
    ("The bearing is making a strange ringing sound.", "The bearing was making a strange ringing sound.", "The bearings are making a strange ringing sound.", "The bearing is making"),
    ("The fuel line is full of air.", "The fuel lines are full of air.", "The fuel line was full of air.", "The fuel line is full of air"),
    ("The housing holds the heater.", "The housing held the heater.", "The housing holds the heaters.", "holds the heater"),
    ("The load is too big for this bracket.", "The load is too big for these brackets.", "The load was too big for this bracket.", "The load is too big for this bracket"),
    ("The thermal model is worth the effort.", "The thermal model was worth the effort.", "The thermal model isn't worth the effort.", "The thermal model is worth"),
    ("The vibration was very weak.", "The vibrations were very weak.", "The vibration is very weak.", "The vibration was very weak"),
    ("The weld was good, but the plate was bad.", "The weld was bad, but the plate was good.", "The welds were good, but the plate was bad.", "The weld was good, but the plate was bad"),
    ("They say the other method is better than this one.", "They said the other method is better than this one.", "They say the other method is better than that one.", "They say the other method"),
    ("We are testing the wing today.", "We were testing the wing today.", "We are testing the wings today.", "We are testing the wing"),
    ("We had to change the grade of the bolt.", "We have to change the grade of the bolt.", "We had to change the grade of the bolts.", "We had to change the grade of the bolt"),
    ("We need a bigger seal for this bit.", "We needed a bigger seal for this bit.", "We need bigger seals for this bit.", "We need a bigger seal"),
    ("We will verify the valve on Wednesday.", "We will verify the valves on Wednesday.", "We verified the valve on Wednesday.", "We will verify the valve"),
    ("Which version of the drawing do we use?", "Which version of the drawing did we use?", "Which versions of the drawing do we use?", "Which version of the drawing do we use"),
    ("Would you mind checking the numbers again?", "Would you mind checking the number again?", "Would you mind checking these numbers again?", "checking the numbers again"),
    # doc/texts.json — пересказы текстов (у предложений нет своего перевода — переводим)
    ("In a tensile test, a machine pulls a specimen until it breaks.", "In a tensile test, a machine pulls the specimen until it breaks.", "In a tensile test, a machine pulls a specimen until it bends.", "pulls a specimen until it breaks", "При испытании на растяжение машина тянет образец, пока он не разорвётся."),
    ("The engine pumps fuel and oxidizer into a chamber, where they burn.", "The engine pumps fuel and oxidizer into a chamber, where it burns.", "The engine pumped fuel and oxidizer into a chamber, where they burn.", "where they burn", "Двигатель подаёт горючее и окислитель в камеру, где они сгорают."),
    ("The hot gas speeds up in the nozzle, and the fast jet creates thrust.", "The hot gas speeds up in the nozzles, and the fast jet creates thrust.", "The hot gas speeds up in the nozzle, and the fast jet created thrust.", "speeds up in the nozzle", "Горячий газ разгоняется в сопле, и быстрая струя создаёт тягу."),
    ("A satellite has a payload that does the job and a bus that supports it.", "A satellite has a payload that does the job and a bus that supports them.", "A satellite has a payload that did the job and a bus that supports it.", "a bus that supports it", "У спутника есть полезная нагрузка, которая выполняет задачу, и платформа, которая её обслуживает."),
    ("A CAD model starts with a 2D sketch with dimensions and constraints.", "A CAD model starts with a 3D sketch with dimensions and constraints.", "A CAD model starts with a 2D sketch with dimensions and no constraints.", "a 2D sketch", "CAD-модель начинается с 2D-эскиза с размерами и связями."),
    ("Its first frequencies must be above 15 hertz laterally and 35 hertz axially.", "Its first frequencies must be above 50 hertz laterally and 35 hertz axially.", "Its first frequencies must be above 15 hertz laterally and 25 hertz axially.", "above 15 hertz laterally and 35 hertz", "Его первые собственные частоты должны быть выше 15 герц в поперечном направлении и 35 герц в продольном."),
    ("Shallow scratches are fine, but any crack must be reported and approved before flight.", "Shallow scratches are fine, but any cracks must be reported and approved before flight.", "Shallow scratches are fine, but any crack must be reported and approved after flight.", "any crack must be reported", "Неглубокие царапины допустимы, но о любой трещине нужно сообщить и получить согласование до полёта."),
    ("Accelerometers were placed on the bracket, on the box and on the shaker table.", "Accelerometers were placed on the brackets, on the box and on the shaker table.", "Accelerometers were placed on the bracket, in the box and on the shaker table.", "on the bracket, on the box", "Акселерометры установили на кронштейн, на блок и на стол вибростенда."),
    ("The bracket was vibrated in three axes, 3 dB above the expected flight levels.", "The bracket was vibrated in three axes, 6 dB above the expected flight levels.", "The bracket was vibrated in three axes, 3 dB above the expected flight level.", "3 dB above the expected flight levels", "Кронштейн испытали на вибрацию по трём осям, на 3 дБ выше ожидаемых полётных уровней."),
    ("The authors printed a one-piece injector for a small methane-oxygen engine.", "The authors printed a two-piece injector for a small methane-oxygen engine.", "The authors printed one-piece injectors for a small methane-oxygen engine.", "a one-piece injector", "Авторы напечатали цельную форсуночную головку для небольшого метан-кислородного двигателя."),
    ("After CT inspection and water tests, twelve hot fires showed 96 percent efficiency and no damage.", "After CT inspection and water tests, twenty hot fires showed 96 percent efficiency and no damage.", "After CT inspection and water tests, twelve hot fires showed 86 percent efficiency and no damage.", "twelve hot fires showed 96 percent", "После КТ-контроля и проливок водой двенадцать огневых испытаний показали эффективность 96 процентов и никаких повреждений."),
    ("A composite combines materials: the fibers carry the load and the matrix holds them.", "A composite combines materials: the fibers carry the load and the matrix holds it.", "A composite combines materials: the fiber carries the load and the matrix holds them.", "the matrix holds them", "Композит объединяет материалы: волокна несут нагрузку, а матрица их удерживает."),
    ("We measure force and stretch and get a curve that shows the strength and the stiffness.", "We measured force and stretch and got a curve that shows the strength and the stiffness.", "We measure force and stretch and get a curve that shows the strength and the thickness.", "shows the strength and the stiffness", "Мы измеряем силу и удлинение и получаем кривую, которая показывает прочность и жёсткость."),
    ("So straps like this can replace heaters and fans in small, low-power satellites.", "So straps like this can't replace heaters and fans in small, low-power satellites.", "So straps like this can replace heaters and fans in small, high-power satellites.", "can replace heaters and fans", "Поэтому такие ленты могут заменить нагреватели и вентиляторы в небольших маломощных спутниках."),
    # call/questions.json — вопросы «Быстрого ответа» (голоса разных акцентов)
    ("What are you studying at the moment?", "What were you studying at the moment?", "What are they studying at the moment?", "What are you studying"),
    ("Why did you choose engineering?", "Why do you choose engineering?", "Why did they choose engineering?", "Why did you choose"),
    ("What do you do in your free time?", "What did you do in your free time?", "What do they do in their free time?", "What do you do in your free time"),
    ("What's your biggest weakness?", "What was your biggest weakness?", "What's their biggest weakness?", "What's your biggest"),
    ("What's the most interesting thing you've learned this year?", "What's the most interesting thing you learned last year?", "What's the most interesting thing you've learned this week?", "you've learned this year"),
    ("What was the hardest technical problem you've solved?", "What's the hardest technical problem you've solved?", "What was the hardest technical problem you saw?", "What was the hardest technical problem"),
    ("Tell me about a time you worked under pressure.", "Tell me about the time you worked under pressure.", "Tell me about a time you were under pressure.", "a time you worked under pressure", "Расскажи о случае, когда тебе пришлось работать под давлением (в стрессе, в сжатые сроки)."),
    ("What was your role in your last team project?", "What's your role in your last team project?", "What was your role in the last team project?", "What was your role in your last"),
    ("What's the difference between strength and stiffness?", "What's the difference between strength and thickness?", "What was the difference between strength and stiffness?", "between strength and stiffness"),
    ("Why are composites used in aircraft?", "Why were composites used in aircraft?", "Why are composites used in spacecraft?", "Why are composites used in aircraft"),
    ("What would you do if you disagreed with your manager?", "What would you do if you disagreed with your managers?", "What could you do if you disagreed with your manager?", "What would you do if you disagreed"),
    ("Do you know how our production line is organized?", "Do you know how our production line was organized?", "Do you know how their production line is organized?", "how our production line is", "Знаешь, как устроена наша производственная линия?"),
    ("Is there anything else you'd like to know about the role?", "Was there anything else you'd like to know about the role?", "Is there anything else you'd like to know about the team?", "Is there anything else you'd like to know"),
    ("If you could work on any space mission, which one would it be?", "If you could work on any space mission, which one could it be?", "If you could work on one space mission, which one would it be?", "work on any space mission"),
    ("Our team thinks deadlines matter more than documentation. Do you agree?", "Our team thinks deadlines matter less than documentation. Do you agree?", "Our team thought deadlines mattered more than documentation. Do you agree?", "deadlines matter more than documentation"),
    ("Some people say simulation will replace testing. What do you think?", "Some people say simulation won't replace testing. What do you think?", "Some people said simulation would replace testing. What do you think?", "simulation will replace testing"),
    ("Describe a time you made a mistake. What did you learn?", "Describe a time you made a mistake. What do you learn?", "Describe a time you made mistakes. What did you learn?", "a time you made a mistake. What did you learn"),
    ("How would you explain your thesis to a ten-year-old?", "How would you explain your thesis to ten-year-olds?", "How would you explain your thesis to a seven-year-old?", "to a ten-year-old"),
    ("How does a rocket engine work, in simple terms?", "How did a rocket engine work, in simple terms?", "How do rocket engines work, in simple terms?", "How does a rocket engine work"),
    ("What is a strain gauge, and why do we need it?", "What is a strain gauge, and why do we need them?", "What is a strain gauge, and why did we need it?", "why do we need it"),
    # story/questions.json — вопросы тренажёра собеседования
    ("Tell me about a difficult problem you solved.", "Tell me about the difficult problem you solved.", "Tell me about difficult problems you solved.", "a difficult problem you solved"),
    ("Tell me about a project you worked on.", "Tell me about the project you worked on.", "Tell me about a project you work on.", "a project you worked on"),
    ("Tell me about a time you failed.", "Tell me about the time you failed.", "Tell me about a time you fell.", "a time you failed"),
    ("Tell me about a time you worked in a team.", "Tell me about a time you worked in the team.", "Tell me about a time you worked in teams.", "worked in a team"),
    ("What are your strengths?", "What were your strengths?", "What is your strength?", "What are your strengths"),
    ("What is your greatest weakness?", "What was your greatest weakness?", "What is their greatest weakness?", "What is your greatest weakness"),
    ("Where do you see yourself in five years?", "Where do you see yourself in fifty years?", "Where did you see yourself in five years?", "in five years"),
    ("Why do you want to work for us?", "Why do you want to work with us?", "Why did you want to work for us?", "want to work for us"),
    # прочее: проверка звука, объяснения, боссы
    ("Houston, can you hear me?", "Houston, can you hear us?", "Houston, can't you hear me?", "can you hear me", "Хьюстон, слышите меня?"),
    ("Thanks a lot, that's really helpful!", "Thanks a lot, that was really helpful!", "Thanks a lot, that's very helpful!", "that's really helpful", "Большое спасибо, это очень помогло!"),
    ("Yep, I'll chase the supplier and let you know if Wednesday slips.", "Yep, I'll chase the suppliers and let you know if Wednesday slips.", "Yep, I'll chase the supplier and let you know when Wednesday slips.", "chase the supplier and let you know if"),
    ("Wednesday. And how long do the vibration tests take once it's back?", "Wednesday. And how long did the vibration tests take once it's back?", "Wednesday. And how long does the vibration test take once it's back?", "how long do the vibration tests take"),
    ("Three days if nothing goes wrong, so realistically we're looking at the end of next week.", "Three days if nothing goes wrong, so realistically we're looking at the end of this week.", "Two days if nothing goes wrong, so realistically we're looking at the end of next week.", "the end of next week"),
]

# ——— Часть 2: новые фразы (КБ и быт), звук пока — голос телефона ———
NEW = [
    # работа в КБ: совещания, стенд, чертежи и допуски, поставщики, сроки, числа
    ("The design review is on Thursday at ten.", "The design review is on Tuesday at ten.", "The design review is on Thursday at two.", "on Thursday at ten", "Рассмотрение проекта (design review) — в четверг в десять."),
    ("We need fifteen more bolts for the bracket.", "We need fifty more bolts for the bracket.", "We needed fifteen more bolts for the bracket.", "need fifteen more bolts", "Нам нужно ещё пятнадцать болтов для кронштейна."),
    ("The wall thickness is three point five millimetres.", "The wall thickness is three point nine millimetres.", "The wall thickness is three point five centimetres.", "three point five millimetres", "Толщина стенки — три и пять десятых миллиметра."),
    ("The tolerance on this hole is plus or minus five microns.", "The tolerance on this hole is plus or minus fifteen microns.", "The tolerance on these holes is plus or minus five microns.", "plus or minus five microns", "Допуск на это отверстие — плюс-минус пять микрон."),
    ("Can you send them the updated drawing today?", "Can you send me the updated drawing today?", "Can't you send them the updated drawing today?", "send them the updated drawing", "Можешь сегодня отправить им обновлённый чертёж?"),
    ("The supplier can't deliver the valves before May.", "The supplier can deliver the valves before May.", "The supplier can't deliver the valve before May.", "can't deliver the valves", "Поставщик не может поставить клапаны раньше мая."),
    ("We tested forty samples last week.", "We tested fourteen samples last week.", "We tested forty samples this week.", "forty samples last week", "На прошлой неделе мы испытали сорок образцов."),
    ("The meeting starts at half past two.", "The meeting starts at half past ten.", "The meeting started at half past two.", "starts at half past two", "Совещание начинается в половине третьего."),
    ("He's checking the drawings for the new housing.", "He was checking the drawings for the new housing.", "He's checking the drawing for the new housing.", "He's checking the drawings", "Он проверяет чертежи нового корпуса."),
    ("The test bench needs thirty minutes to warm up.", "The test bench needs thirteen minutes to warm up.", "The test benches need thirty minutes to warm up.", "needs thirty minutes", "Стенду нужно тридцать минут на прогрев."),
    ("I want to finish the model before lunch.", "I won't finish the model before lunch.", "I want to finish the models before lunch.", "I want to finish the model", "Я хочу закончить модель до обеда."),
    ("Its mass is lower than we expected.", "Its mass isn't lower than we expected.", "Its mass was lower than we expected.", "Its mass is lower", "Её масса меньше, чем мы ожидали."),
    ("It's not the sensor, it's the cable.", "It's the sensor, not the cable.", "It's not the sensors, it's the cable.", "It's not the sensor", "Дело не в датчике, а в кабеле."),
    ("Could you check the torque on these bolts?", "Would you check the torque on these bolts?", "Could you check the torque on this bolt?", "Could you check the torque on these bolts", "Можешь проверить момент затяжки этих болтов?"),
    ("The parts arrived on the thirteenth of March.", "The parts arrived on the thirtieth of March.", "The part arrived on the thirteenth of March.", "parts arrived on the thirteenth", "Детали пришли тринадцатого марта."),
    ("We worked on the drawings all weekend.", "We work on the drawings all weekend.", "We worked on the drawing all weekend.", "We worked on the drawings", "Мы все выходные работали над чертежами."),
    ("The pressure dropped to sixty bar.", "The pressure dropped to sixteen bar.", "The pressure drops to sixty bar.", "dropped to sixty bar", "Давление упало до шестидесяти бар."),
    ("Please add a chamfer to this edge.", "Please add a chamfer to these edges.", "Please add the chamfer to this edge.", "a chamfer to this edge", "Пожалуйста, добавь фаску на эту кромку."),
    ("The deadline has moved to next Friday.", "The deadline was moved to next Friday.", "The deadline has moved to this Friday.", "has moved to next Friday", "Срок перенесли на следующую пятницу."),
    ("We'll need two more days for the report.", "We'd need two more days for the report.", "We'll need two more days for the reports.", "We'll need two more days", "Нам понадобится ещё два дня на отчёт."),
    ("Did they approve the change request?", "Did he approve the change request?", "Do they approve the change request?", "Did they approve", "Они одобрили извещение об изменении?"),
    ("The hole diameter is eighteen millimetres.", "The hole diameter is eighty millimetres.", "The hole diameters are eighteen millimetres.", "eighteen millimetres", "Диаметр отверстия — восемнадцать миллиметров."),
    ("I'll call the supplier after the meeting.", "I'd call the supplier after the meeting.", "I'll call the suppliers after the meeting.", "I'll call the supplier", "Я позвоню поставщику после совещания."),
    ("We could use aluminium instead of steel.", "We would use aluminium instead of steel.", "We could use aluminium instead of the steel.", "We could use aluminium", "Можно было бы взять алюминий вместо стали."),
    ("The panel failed at ninety percent of the load.", "The panel failed at nineteen percent of the load.", "The panels failed at ninety percent of the load.", "failed at ninety percent", "Панель разрушилась при девяноста процентах нагрузки."),
    ("She needs the test report by Monday.", "She needed the test report by Monday.", "She needs the test reports by Monday.", "She needs the test report", "Ей нужен протокол испытаний к понедельнику."),
    ("Let's move the call to four fifteen.", "Let's move the call to four fifty.", "Let's move the call to five fifteen.", "to four fifteen", "Давай перенесём созвон на четыре пятнадцать."),
    ("The new version is on the server.", "The new versions are on the server.", "The new version was on the server.", "The new version is", "Новая версия лежит на сервере."),
    ("There's a crack near the second hole.", "There was a crack near the second hole.", "There are cracks near the second hole.", "There's a crack", "Возле второго отверстия есть трещина."),
    ("We can't start the test without the sensors.", "We can start the test without the sensors.", "We can't start the test without the sensor.", "We can't start", "Без датчиков мы не можем начать испытание."),
    ("The bolts were tightened to twelve newton metres.", "The bolts were tightened to twenty newton metres.", "The bolt was tightened to twelve newton metres.", "tightened to twelve", "Болты затянули моментом двенадцать ньютон-метров."),
    ("He was at the test site all day.", "He's at the test site all day.", "He was at the test sites all day.", "He was at the test site", "Он весь день был на испытательной площадке."),
    ("The shipment will arrive on the fourteenth.", "The shipment will arrive on the fourth.", "The shipments will arrive on the fourteenth.", "on the fourteenth", "Груз прибудет четырнадцатого."),
    ("Can you print the drawing in A3?", "Can you print the drawing in A4?", "Can you print the drawings in A3?", "print the drawing in A3", "Можешь распечатать чертёж в формате А3?"),
    ("We've already ordered the material.", "We'd already ordered the material.", "We've already ordered the materials.", "We've already ordered", "Мы уже заказали материал."),
    ("The engine runs for eighty seconds.", "The engine runs for eighteen seconds.", "The engine ran for eighty seconds.", "runs for eighty seconds", "Двигатель работает восемьдесят секунд."),
    ("Who's responsible for the wiring diagram?", "Who was responsible for the wiring diagram?", "Who's responsible for the wiring diagrams?", "Who's responsible", "Кто отвечает за схему соединений?"),
    ("Use the M8 bolts, not the M6.", "Use the M6 bolts, not the M8.", "Use the M8 bolt, not the M6.", "the M8 bolts, not the M6", "Ставь болты M8, а не M6."),
    ("I think he's sent the wrong file.", "I think he's sent the wrong files.", "I think she's sent the wrong file.", "he's sent the wrong file", "Кажется, он прислал не тот файл."),
    ("Our team is smaller than theirs.", "Our team was smaller than theirs.", "Our teams are smaller than theirs.", "Our team is smaller", "Наша команда меньше, чем у них."),
    ("He's on holiday until the twentieth.", "He was on holiday until the twentieth.", "He's on holiday until the twelfth.", "He's on holiday until the twentieth", "Он в отпуске до двадцатого.", "gb-f"),
    ("Make sure you save it as a PDF.", "Make sure you save them as a PDF.", "Make sure you saved it as a PDF.", "save it as a PDF", "Обязательно сохрани это в PDF."),
    ("The gap should be less than half a millimetre.", "The gap should be more than half a millimetre.", "The gaps should be less than half a millimetre.", "less than half a millimetre", "Зазор должен быть меньше половины миллиметра."),
    ("We'll run the test again tomorrow morning.", "We'll run the tests again tomorrow morning.", "We'd run the test again tomorrow morning.", "We'll run the test again", "Завтра утром повторим испытание."),
    ("I need the latest revision, not the old one.", "I needed the latest revision, not the old one.", "I need the latest revisions, not the old ones.", "I need the latest revision", "Мне нужна последняя ревизия, а не старая."),
    ("The temperature reached two hundred and fifty degrees.", "The temperature reached two hundred and fifteen degrees.", "The temperature reaches two hundred and fifty degrees.", "two hundred and fifty degrees", "Температура дошла до двухсот пятидесяти градусов."),
    ("They want to change the material again.", "They won't change the material again.", "They wanted to change the material again.", "They want to change", "Они хотят снова поменять материал."),
    ("The drawing was signed off on Wednesday.", "The drawings were signed off on Wednesday.", "The drawing was signed off on Monday.", "The drawing was signed off", "Чертёж подписали в среду."),
    ("Can you join the call at eleven?", "Can't you join the call at eleven?", "Can you join the call at seven?", "join the call at eleven", "Можешь подключиться к созвону в одиннадцать?"),
    ("The pipe is fifty centimetres long.", "The pipe is fifteen centimetres long.", "The pipes are fifty centimetres long.", "fifty centimetres long", "Длина трубы — пятьдесят сантиметров."),
    ("We should order more bolts this week.", "We should've ordered more bolts this week.", "We should order more bolts next week.", "We should order more bolts", "На этой неделе нужно заказать ещё болтов."),
    ("The customer asked for a lighter version.", "The customer asks for a lighter version.", "The customers asked for a lighter version.", "The customer asked for", "Заказчик попросил облегчённый вариант."),
    ("Is it ready, or does it need more work?", "Was it ready, or did it need more work?", "Are they ready, or do they need more work?", "Is it ready", "Это готово или ещё нужно доработать?"),
    ("The batch passed inspection this morning.", "The batches passed inspection this morning.", "The batch failed inspection this morning.", "The batch passed inspection", "Партия прошла приёмку сегодня утром."),
    ("I'm afraid we can't meet that deadline.", "I'm afraid we can meet that deadline.", "I'm afraid we couldn't meet that deadline.", "we can't meet that deadline", "Боюсь, мы не уложимся в этот срок."),
    ("The stress is highest near the fillet.", "The stress was highest near the fillet.", "The stress is highest near the fillets.", "The stress is highest near the fillet", "Напряжения максимальны возле галтели."),
    # быт: магазин, транспорт, звонки, small talk
    ("How much are these apples?", "How much is this apple?", "How much were these apples?", "How much are these apples", "Сколько стоят эти яблоки?"),
    ("That one costs fifteen pounds.", "That one costs fifty pounds.", "This one costs fifteen pounds.", "costs fifteen pounds", "Вон тот стоит пятнадцать фунтов.", "gb-m"),
    ("The next bus leaves at seven forty.", "The next bus leaves at seven fourteen.", "The next bus left at seven forty.", "leaves at seven forty", "Следующий автобус отходит в семь сорок."),
    ("Can I pay by card here?", "Can't I pay by card here?", "Could I pay by card here?", "Can I pay by card", "Здесь можно расплатиться картой?"),
    ("I'll be there in ten minutes.", "I'd be there in ten minutes.", "I'll be there in two minutes.", "I'll be there in ten minutes", "Буду через десять минут."),
    ("We met them at the station.", "We met you at the station.", "We meet them at the station.", "We met them", "Мы встретили их на вокзале."),
    ("Do you want to grab lunch today?", "Did you want to grab lunch today?", "Do they want to grab lunch today?", "Do you want to grab lunch", "Хочешь сходить пообедать сегодня?"),
    ("Sorry, I think you have the wrong number.", "Sorry, I thought you had the wrong number.", "Sorry, I think you have the wrong name.", "you have the wrong number", "Извините, кажется, вы ошиблись номером."),
    ("My train was delayed by twenty minutes.", "My train is delayed by twenty minutes.", "My train was delayed by twelve minutes.", "was delayed by twenty minutes", "Мой поезд задержали на двадцать минут."),
    ("Could you call me back after six?", "Would you call me back after six?", "Could you call him back after six?", "Could you call me back", "Можете перезвонить мне после шести?"),
    ("The shop closes at nine on Sundays.", "The shop closed at nine on Sunday.", "The shops close at nine on Sundays.", "The shop closes", "По воскресеньям магазин закрывается в девять."),
    ("He's been to London twice.", "He was in London twice.", "He's been to London once.", "He's been to London twice", "Он был в Лондоне дважды."),
    ("I'd like two coffees to take away.", "I'd like a coffee to take away.", "I'd like ten coffees to take away.", "two coffees", "Мне два кофе с собой.", "gb-f"),
    ("The weather was great last weekend.", "The weather was great last week.", "The weather is great this weekend.", "great last weekend", "В прошлые выходные погода была отличная."),
    ("Excuse me, is this seat taken?", "Excuse me, is the seat taken?", "Excuse me, was this seat taken?", "is this seat taken", "Извините, это место занято?"),
    ("Can you pick me up at eight?", "Can you pick them up at eight?", "Can you pick me up at nine?", "pick me up at eight", "Можешь заехать за мной в восемь?"),
    ("I'm going to the gym after work.", "I was going to the gym after work.", "I'm going to the gym before work.", "I'm going to the gym after work", "После работы я иду в спортзал."),
    ("The doctor can see you on Tuesday.", "The doctor can't see you on Tuesday.", "The doctor can see you on Thursday.", "can see you on Tuesday", "Врач может принять вас во вторник."),
    ("My car needs new tyres.", "My car needed new tyres.", "My car needs a new tyre.", "needs new tyres", "Моей машине нужны новые шины."),
    ("She lives on the thirteenth floor.", "She lives on the thirtieth floor.", "She lived on the thirteenth floor.", "lives on the thirteenth floor", "Она живёт на тринадцатом этаже."),
    ("Could you tell me the way to the station?", "Would you tell me the way to the station?", "Could you tell us the way to the station?", "Could you tell me the way", "Не подскажете, как пройти к вокзалу?"),
    ("I didn't know it was your birthday.", "I don't know if it was your birthday.", "I didn't know it was his birthday.", "I didn't know it was your birthday", "Я не знал, что у тебя день рождения."),
    ("There's a pharmacy on the corner.", "There was a pharmacy on the corner.", "There's a pharmacy round the corner.", "There's a pharmacy on the corner", "На углу есть аптека."),
    ("I'll text you when I get home.", "I'd text you when I get home.", "I'll text you when I get there.", "I'll text you when I get home", "Напишу тебе, когда доберусь домой."),
    ("The tickets are forty pounds each.", "The tickets are fourteen pounds each.", "The tickets were forty pounds each.", "forty pounds each", "Билеты — по сорок фунтов.", "gb-f"),
    ("Would you like tea or coffee?", "Do you like tea or coffee?", "Would you like tea or juice?", "Would you like tea", "Вам чай или кофе?"),
]

# Космические по смыслу, хотя ключевых слов space_field в тексте нет (ракетный двигатель, огневые, полёт)
SPACE_EXTRA = {
    "The engine pumps fuel and oxidizer into a chamber, where they burn.",
    "Shallow scratches are fine, but any crack must be reported and approved before flight.",
    "The bracket was vibrated in three axes, 3 dB above the expected flight levels.",
    "The authors printed a one-piece injector for a small methane-oxygen engine.",
    "After CT inspection and water tests, twelve hot fires showed 96 percent efficiency and no damage.",
}

# ——— Часть 3: цех (field: "mech"), звук пока — голос телефона ———
MECH = [
    # станки и цех
    ("The lathe on line two is down again.", "The lathe on line three is down again.", "The lathe on line two was down again.", "line two is down", "Токарный станок на второй линии опять встал."),
    ("Set the spindle speed to fifteen hundred rpm.", "Set the spindle speed to sixteen hundred rpm.", "Set the spindle speed to five hundred rpm.", "fifteen hundred rpm", "Поставь обороты шпинделя тысяча пятьсот в минуту."),
    ("We can't run the CNC machine without the new program.", "We can run the CNC machine without the new program.", "We can't run the CNC machine without the new programs.", "We can't run the CNC machine", "Без новой программы мы не можем запустить станок с ЧПУ."),
    ("The coolant tank needs topping up.", "The coolant tanks need topping up.", "The coolant tank needed topping up.", "The coolant tank needs", "В бак СОЖ нужно долить жидкости.", "gb-f"),
    ("Change the insert after forty parts.", "Change the insert after fourteen parts.", "Change the inserts after forty parts.", "after forty parts", "Меняй пластину после сорока деталей."),
    ("The tool broke in the middle of the cut.", "The tool broke at the end of the cut.", "The tools broke in the middle of the cut.", "in the middle of the cut", "Инструмент сломался в середине прохода."),
    ("The milling machine is free after lunch.", "The milling machine is free before lunch.", "The milling machine was free after lunch.", "is free after lunch", "Фрезерный станок освободится после обеда."),
    ("Clamp the workpiece before you start the machine.", "Clamp the workpiece before we start the machine.", "Clamp the workpieces before you start the machine.", "before you start the machine", "Закрепи заготовку, прежде чем запускать станок."),
    ("Turn off the machine before you clean it.", "Turn off the machine after you clean it.", "Turn on the machine before you clean it.", "Turn off the machine before", "Выключи станок, прежде чем его чистить."),
    ("The drill bit was blunt, so I changed it.", "The drill bit was blunt, so I'll change it.", "The drill bits were blunt, so I changed them.", "was blunt, so I changed it", "Сверло затупилось, и я его поменял."),
    ("Put on your safety glasses before you go in.", "Put on your safety glasses after you go in.", "Put on your safety glasses before we go in.", "before you go in", "Надень защитные очки, прежде чем заходить."),
    # допуски и замеры
    ("The shaft diameter is twenty-five millimetres.", "The shaft diameter is twenty-nine millimetres.", "The shaft diameter was twenty-five millimetres.", "twenty-five millimetres", "Диаметр вала — двадцать пять миллиметров."),
    ("This bore is twelve microns oversize.", "This bore is twenty microns oversize.", "This bore is twelve microns undersize.", "twelve microns oversize", "Это отверстие больше номинала на двенадцать микрон."),
    ("Measure the part with the micrometer, not the calipers.", "Measure the part with the calipers, not the micrometer.", "Measure the parts with the micrometer, not the calipers.", "with the micrometer, not the calipers", "Меряй деталь микрометром, а не штангенциркулем."),
    ("The runout is within tolerance now.", "The runout isn't within tolerance now.", "The runout is within tolerance today.", "is within tolerance now", "Биение теперь в допуске."),
    ("Three of the twenty shafts are out of tolerance.", "Three of the thirty shafts are out of tolerance.", "Two of the twenty shafts are out of tolerance.", "Three of the twenty shafts", "Три вала из двадцати не в допуске."),
    ("Check the flatness on both sides of the plate.", "Check the flatness on one side of the plate.", "Check the flatness on both sides of the plates.", "on both sides of the plate", "Проверь плоскостность с обеих сторон плиты."),
    ("The surface roughness should be Ra one point six.", "The surface roughness should be Ra three point two.", "The surface roughness could be Ra one point six.", "should be Ra one point six", "Шероховатость поверхности должна быть Ra 1,6."),
    ("The thread gauge goes in easily.", "The thread gauge doesn't go in easily.", "The thread gauges go in easily.", "The thread gauge goes in easily", "Резьбовой калибр входит легко."),
    ("Zero the indicator before you measure.", "Zero the indicator after you measure.", "Zero the indicators before you measure.", "before you measure", "Обнули индикатор перед замером."),
    # сборка
    ("Tighten the bolts in a cross pattern.", "Loosen the bolts in a cross pattern.", "Tighten the bolts in a star pattern.", "Tighten the bolts in a cross pattern", "Затягивай болты крест-накрест."),
    ("The bearing should be pressed, not hammered in.", "The bearing should be hammered, not pressed in.", "The bearing must be pressed, not hammered in.", "should be pressed, not hammered", "Подшипник нужно запрессовывать, а не забивать молотком."),
    ("We're missing two washers for this assembly.", "We're missing ten washers for this assembly.", "We were missing two washers for this assembly.", "missing two washers", "Для этого узла нам не хватает двух шайб."),
    ("Put a drop of thread locker on each bolt.", "Put two drops of thread locker on each bolt.", "Put a drop of thread locker on each nut.", "a drop of thread locker on each bolt", "Капни фиксатор резьбы на каждый болт."),
    ("The gearbox goes back together on Thursday.", "The gearbox goes back together on Tuesday.", "The gearbox went back together on Thursday.", "goes back together on Thursday", "Редуктор соберём обратно в четверг."),
    ("Use the torque wrench, not the impact gun.", "Use the impact gun, not the torque wrench.", "Use the torque wrench, not the spanner.", "the torque wrench, not the impact gun", "Бери динамометрический ключ, а не гайковёрт."),
    ("The seal goes on before the cover.", "The seal goes on after the cover.", "The seals go on before the cover.", "goes on before the cover", "Уплотнение ставится до крышки."),
    ("Can you pass me the ten-millimetre spanner?", "Can you pass me the thirteen-millimetre spanner?", "Can you pass him the ten-millimetre spanner?", "pass me the ten-millimetre spanner", "Подай мне ключ на десять.", "gb-m"),
    ("The pin is too tight to go in.", "The pins are too tight to go in.", "The pin was too tight to go in.", "The pin is too tight", "Штифт слишком тугой, не входит."),
    # сварка
    ("The welder needs two more hours on the frame.", "The welder needs ten more hours on the frame.", "The welder needed two more hours on the frame.", "two more hours on the frame", "Сварщику нужно ещё два часа на раму."),
    ("There's porosity in the second weld.", "There was porosity in the second weld.", "There's porosity in the third weld.", "in the second weld", "Во втором шве есть пористость."),
    ("Grind the weld flush before painting.", "Grind the weld flush after painting.", "Grind the welds flush before painting.", "flush before painting", "Зачисти шов заподлицо перед покраской."),
    ("We weld the brackets after the frame is square.", "We weld the brackets before the frame is square.", "We weld the bracket after the frame is square.", "after the frame is square", "Кронштейны привариваем, когда раму уже выставили под прямой угол."),
    ("We've got one cylinder of argon left.", "We've got two cylinders of argon left.", "We've got one cylinder of oxygen left.", "one cylinder of argon", "У нас остался один баллон аргона."),
    ("Don't weld near the hydraulic lines.", "Don't weld near the hydraulic line.", "Don't work near the hydraulic lines.", "Don't weld near", "Не вари рядом с гидролиниями."),
    ("The weld cracked after the heat treatment.", "The weld cracked before the heat treatment.", "The welds cracked after the heat treatment.", "cracked after the heat treatment", "Шов треснул после термообработки."),
    # гидравлика
    ("The hydraulic pressure is down to ninety bar.", "The hydraulic pressure is down to nineteen bar.", "The hydraulic pressure was down to ninety bar.", "down to ninety bar", "Давление в гидросистеме упало до девяноста бар."),
    ("There's an oil leak under the press.", "There was an oil leak under the press.", "There's an oil leak behind the press.", "an oil leak under the press", "Под прессом течёт масло."),
    ("Replace the filter every five hundred hours.", "Replace the filter every five thousand hours.", "Replace the filters every five hundred hours.", "every five hundred hours", "Меняй фильтр каждые пятьсот часов."),
    ("The pump is noisier than it was yesterday.", "The pump is quieter than it was yesterday.", "The pump is noisier than it was on Monday.", "noisier than it was yesterday", "Насос шумит сильнее, чем вчера."),
    ("Bleed the air from the cylinder first.", "Bleed the air from the cylinders first.", "Bleed the oil from the cylinder first.", "the air from the cylinder", "Сначала стравь воздух из цилиндра."),
    ("The hose burst at two hundred bar.", "The hose burst at three hundred bar.", "The hoses burst at two hundred bar.", "burst at two hundred bar", "Шланг лопнул при двухстах барах."),
    # обслуживание и ремонт
    ("The conveyor is stopped for maintenance until noon.", "The conveyor was stopped for maintenance until noon.", "The conveyor is stopped for maintenance until two.", "is stopped for maintenance until noon", "Конвейер остановлен на обслуживание до полудня."),
    ("We change the oil in this gearbox twice a year.", "We change the oil in this gearbox three times a year.", "We change the oil in these gearboxes twice a year.", "in this gearbox twice a year", "Масло в этом редукторе меняем два раза в год."),
    ("The bearing on the motor is running hot.", "The bearing on the motor was running hot.", "The bearings on the motor are running hot.", "is running hot", "Подшипник двигателя греется."),
    ("I'll replace the belt tomorrow morning.", "I'll replace the belts tomorrow morning.", "I'll replace the belt tomorrow evening.", "the belt tomorrow morning", "Ремень заменю завтра утром."),
    ("The machine has run for six thousand hours.", "The machine has run for sixty thousand hours.", "The machines have run for six thousand hours.", "six thousand hours", "Станок наработал шесть тысяч часов."),
    ("Lock out the machine before you open the guard.", "Lock out the machine after you open the guard.", "Lock out the machines before you open the guard.", "before you open the guard", "Прежде чем открывать ограждение, заблокируй станок."),
    ("The fault came back after the restart.", "The fault came back before the restart.", "The faults came back after the restart.", "came back after the restart", "После перезапуска неисправность вернулась."),
    ("The maintenance team can't come until Wednesday.", "The maintenance team can't come until Tuesday.", "The maintenance team couldn't come until Wednesday.", "can't come until Wednesday", "Ремонтники не смогут прийти раньше среды."),
    # план и производство
    ("We need four hundred housings by the end of the month.", "We need four thousand housings by the end of the month.", "We need four hundred housings by the end of the week.", "four hundred housings by the end of the month", "К концу месяца нам нужно четыреста корпусов."),
    ("The night shift made eighty parts.", "The night shift made eighteen parts.", "The day shift made eighty parts.", "The night shift made eighty", "Ночная смена сделала восемьдесят деталей."),
    ("This order has priority over the others.", "This order had priority over the others.", "These orders have priority over the others.", "This order has priority", "Этот заказ приоритетнее остальных."),
    ("The batch of gears is ready for shipping.", "The batch of gears was ready for shipping.", "The batch of gears isn't ready for shipping.", "is ready for shipping", "Партия шестерён готова к отгрузке."),
    ("We're behind schedule by three days.", "We're behind schedule by two days.", "We were behind schedule by three days.", "behind schedule by three days", "Мы отстаём от графика на три дня."),
    ("The cycle time is forty-five seconds per part.", "The cycle time is forty-five minutes per part.", "The cycle time was forty-five seconds per part.", "forty-five seconds per part", "Время цикла — сорок пять секунд на деталь."),
    ("Let's move the job to the second shift.", "Let's move the job to the first shift.", "Let's move the jobs to the second shift.", "to the second shift", "Давай перенесём эту работу на вторую смену."),
    ("The material for this order arrives on Monday.", "The material for this order arrived on Monday.", "The material for this order arrives on Sunday.", "arrives on Monday", "Материал под этот заказ придёт в понедельник."),
    ("Can we finish the batch before the weekend?", "Can't we finish the batch before the weekend?", "Can we finish the batch after the weekend?", "Can we finish the batch before", "Успеем закончить партию до выходных?"),
    ("The new line will start in a fortnight.", "The new line won't start in a fortnight.", "The new lines will start in a fortnight.", "will start in a fortnight", "Новая линия заработает через две недели.", "gb-f"),
    ("We only have steel for two more days.", "We only have steel for ten more days.", "We only had steel for two more days.", "steel for two more days", "Стали нам хватит только на два дня."),
    ("The foreman asked them to stay late.", "The foreman asked me to stay late.", "The foreman asks them to stay late.", "asked them to stay late", "Мастер попросил их задержаться."),
    # ОТК и качество
    ("The inspector rejected six parts from this batch.", "The inspector rejected sixteen parts from this batch.", "The inspector rejected six parts from these batches.", "rejected six parts", "Контролёр забраковал шесть деталей из этой партии."),
    ("Every tenth part goes to the lab.", "Every tenth part went to the lab.", "Every fifth part goes to the lab.", "Every tenth part goes", "Каждая десятая деталь идёт в лабораторию."),
    ("The first article passed inspection on Friday.", "The first article failed inspection on Friday.", "The first article passed inspection on Thursday.", "passed inspection on Friday", "Первая деталь из партии прошла контроль в пятницу."),
    ("Put the bad parts in the red box.", "Put the bad parts in the blue box.", "Put the bad parts in the red bin.", "in the red box", "Бракованные детали клади в красный ящик."),
    ("The hardness is lower than the drawing says.", "The hardness is higher than the drawing says.", "The hardness was lower than the drawing says.", "lower than the drawing says", "Твёрдость ниже, чем указано на чертеже."),
    ("We found burrs on the inside edge.", "We found burrs on the outside edge.", "We find burrs on the inside edge.", "burrs on the inside edge", "Мы нашли заусенцы на внутренней кромке."),
    ("The customer wants a certificate for each batch.", "The customer wanted a certificate for each batch.", "The customers want a certificate for each batch.", "The customer wants a certificate", "Заказчику нужен сертификат на каждую партию."),
    ("Write the measurements on the inspection sheet.", "Write the measurements on the inspection sheets.", "Read the measurements on the inspection sheet.", "Write the measurements", "Запиши замеры в карту контроля."),
    ("Half of the scrap came from one machine.", "Most of the scrap came from one machine.", "Half of the scrap comes from one machine.", "Half of the scrap came", "Половина брака пришлась на один станок."),
    ("Stop the line if you see a crack.", "Stop the line when you see a crack.", "Stop the line if they see a crack.", "Stop the line if you see", "Увидишь трещину — останавливай линию."),
]


def load(rel: str):
    return json.loads((OUT / rel).read_text(encoding="utf-8"))


def ru_index() -> dict[str, str]:
    """Переводы из файлов курса: текст → ru (у замен в подстановках вместо перевода подсказка — её не берём)."""
    out: dict[str, str] = {}
    pairs = [("text", "ru"), ("en", "ru"), ("example", "exampleRu"), ("base", "ru"), ("q", "ru")]

    def walk(v):
        if isinstance(v, list):
            for x in v:
                walk(x)
        elif isinstance(v, dict):
            for k, r in pairs:
                t, ru = v.get(k), v.get(r)
                if isinstance(t, str) and isinstance(ru, str) and ru.strip() and t not in out:
                    out[t] = ru
            for x in v.values():
                walk(x)

    for rel in ["call/chunks.json", "call/translate.json", "call/substitution.json", "call/questions.json", "air/passages.json",
                "story/episodes.json", "story/episodes-2.json", "story/questions.json", "clean/phrases.json", "boss/bosses.json"]:
        walk(load(rel))
    return out


def pick_voice(have: list[str], k: int) -> str:
    """Голос из тех, что есть в манифесте: стандартные по кругу, иначе — первый стандартный, иначе — любой."""
    std = [v for v in STD if v in have]
    if STD[k % len(STD)] in have:
        return STD[k % len(STD)]
    if std:
        return std[k % len(std)]
    return sorted(have)[0]


def item(id_: str, row: tuple, voice: str, ru: str) -> dict:
    text, d1, d2, focus = row[:4]
    return {"id": id_, "text": text, "options": [text, d1, d2], "ru": ru, "focus": focus, "voice": voice, "reviewed": False}


def build():
    manifest = json.loads((ROOT / "public" / "audio" / "manifest.json").read_text(encoding="utf-8"))["texts"]
    have = {t: sorted({e["voice"] for e in es}) for t, es in manifest.items()}
    ru_of = ru_index()
    taken = {p["text"] for p in load("air/phrases.json")} | {l["text"] for l in load("intake.json")["listening"]}

    items = []
    for k, row in enumerate(REUSED):
        text = row[0]
        assert text in have, f"нет звука для «{text}»"
        ru = row[4] if len(row) > 4 else ru_of.get(text)
        assert ru, f"нет перевода для «{text}»"
        x = item(f"g-st-r-{k + 1:03d}", row, pick_voice(have[text], k), ru)
        items.append(with_field(x, "space" if text in SPACE_EXTRA else space_field(text, ru)))
    for k, row in enumerate(NEW):
        # голос по кругу; шестое поле — свой голос (британское выражение — британским голосом)
        x = item(f"g-st-n-{k + 1:03d}", row, row[5] if len(row) > 5 else STD[k % len(STD)], row[4])
        items.append(with_field(x, "space" if row[0] in SPACE_EXTRA else space_field(row[0], row[4])))
    for k, row in enumerate(MECH):
        assert not space_field(*row[:3], row[4]), f"g-st-m-{k + 1:03d}: космос в цеховой фразе"
        x = item(f"g-st-m-{k + 1:03d}", row, row[5] if len(row) > 5 else STD[k % len(STD)], row[4])
        items.append(with_field(x, "mech"))
    assert SPACE_EXTRA <= {r[0] for r in REUSED + NEW}, SPACE_EXTRA - {r[0] for r in REUSED + NEW}

    # самопроверка
    texts = [x["text"] for x in items]
    assert len(set(texts)) == len(texts), [t for t in texts if texts.count(t) > 1]
    assert len({x["id"] for x in items}) == len(items)
    for x in items:
        t, opts = x["text"], x["options"]
        assert opts[0] == t, x["id"]
        assert len(opts) == 3 and len(set(opts)) == 3, f"{x['id']}: варианты повторяются"
        assert x["focus"].lower() in t.lower(), f"{x['id']}: фокус «{x['focus']}» не найден в тексте"
        assert t not in taken, f"{x['id']}: фраза уже есть в Эфире или вводном тесте"
        assert x["ru"].strip(), x["id"]
        n = len(t.split())
        if x["id"].startswith("g-st-r-"):
            assert x["voice"] in have.get(t, []), f"{x['id']}: нет звука голосом {x['voice']}"
            assert 4 <= n <= 16, f"{x['id']}: {n} слов"
        else:
            assert 5 <= n <= 12, f"{x['id']}: {n} слов"
            assert x["voice"] in STD

    (OUT / "games").mkdir(parents=True, exist_ok=True)
    (OUT / "games" / "static.json").write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    by = {f: sum(1 for x in items if x.get("field") == f) for f in ("space", "mech")}
    print(f"«Помехи»: {len(REUSED)} реплик с готовым звуком, {len(NEW)} новых фраз, {len(MECH)} цеховых, всего {len(items)}"
          f" (space {by['space']}, mech {by['mech']}, общих {len(items) - by['space'] - by['mech']})")


if __name__ == "__main__":
    build()
