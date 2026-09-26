"""
Контент фазы 2 — «Мой рассказ» (вопросы собеседования с образцами) и сюжет «Международный проект», эпизоды 1–3.

  .venv\\Scripts\\python.exe scripts\\author_phase2.py

Всё написано вручную, reviewed: false. Эпизод — сцена: реплики персонажей их голосами и ходы «ты»:
три варианта, верный первый (приложение перемешивает), у неверных — короткое «почему нет».
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "content" / "story"
STD = ["us-f", "us-m", "gb-f", "gb-m"]
CHARS = {c["id"]: c["voice"] for c in json.loads((ROOT / "src/content/characters.json").read_text(encoding="utf-8"))}

# ——— Вопросы «Моего рассказа»: (id, вопрос, перевод, совет, STAR?, образец ответа, id чанков-подсказок) ———
QUESTIONS = [
    ("about", "Tell me about yourself.", "Расскажи о себе.",
     "Настоящее → прошлое → будущее: кто ты сейчас, что уже сделал, почему ты здесь. 60–90 секунд. Не пересказывай резюме по пунктам и не начинай с даты рождения.",
     False,
     "I'm a fourth-year student in rocket and space engineering. At the moment I'm working on a project about composite testing: we run tensile tests on carbon fiber specimens and compare the results with finite element models. Before that, I spent a summer at a test lab, where I got hands-on experience with strain gauges and data acquisition. What I enjoy most is the link between simulation and real hardware. I'm looking for a position where I can work on flight structures and learn from experienced engineers.",
     ["c-intro-02", "c-intro-03", "c-intro-06", "c-intro-10"]),
    ("project", "Tell me about a project you worked on.", "Расскажи о проекте, над которым работал.",
     "Цель → твоя роль → что сделал → результат в цифрах. Говори «I», а не только «we»: интервьюеру важен твой вклад.",
     False,
     "The goal of the project was to reduce the weight of a satellite bracket. I was responsible for the stress analysis. I built the model in SolidWorks, ran a topology study, and proposed a lighter shape with ribs. Then I worked closely with the workshop to make sure it could actually be machined. As a result, the mass dropped by about eighteen percent, and the bracket passed the vibration test on the first try.",
     ["c-project-01", "c-project-02", "c-project-07", "c-project-06"]),
    ("why", "Why do you want to work for us?", "Почему ты хочешь работать у нас?",
     "Две-три конкретные причины про компанию (продукт, команда, технологии) и мостик к твоему опыту. Похвалы вообще («вы лидер рынка») не работают.",
     False,
     "Two reasons. First, your team builds and tests hardware, not only models, and that's exactly the kind of work I enjoy. Second, I read about your work on composite structures for small launchers, which is very close to my current project. I think I could contribute to the testing side from day one and learn a lot about flight qualification.",
     ["c-intro-05", "c-intro-07"]),
    ("strengths", "What are your strengths?", "Какие у тебя сильные стороны?",
     "Одна-две сильные стороны с примером из жизни. Без примера это просто прилагательные.",
     False,
     "I'd say I'm good at finding the root cause of a problem. For example, when our test results didn't match the simulation, I didn't just adjust the model; I checked the specimens and found that the grips were causing early failures. I'm also quite careful with documentation, which helps the whole team.",
     ["c-time-01", "c-explain-05"]),
    ("weakness", "What is your greatest weakness?", "Какая твоя главная слабость?",
     "Реальная, но не критичная для работы слабость + что ты с ней делаешь. «Я перфекционист» звучит как уклонение.",
     False,
     "My spoken English is still slower than my technical reading. I understand documentation well, but in fast meetings I sometimes need a moment. So I practice every day with listening and speaking exercises, and I'm not afraid to ask people to repeat something. It's getting better quickly.",
     ["c-clarify-02", "c-time-02"]),
    ("problem", "Tell me about a difficult problem you solved.", "Расскажи о сложной задаче, которую ты решил.",
     "Метод STAR: Situation — ситуация, Task — задача, Action — что сделал ты, Result — результат. Больше всего времени — на Action.",
     True,
     "In our composite project, the specimens kept breaking at the grips instead of in the middle, so the results were useless. My task was to find out why before the next test campaign. I compared the failure surfaces, checked the clamping pressure, and suggested adding tabs to the ends of the specimens. I also changed the test procedure so the grips were tightened in steps. After that, almost all specimens failed in the gauge section, and our strength values became consistent within five percent.",
     ["c-project-04", "c-project-05", "c-project-06"]),
    ("teamwork", "Tell me about a time you worked in a team.", "Расскажи о работе в команде.",
     "STAR: команда, общая цель, твоя роль, конфликт или сложность, чем закончилось.",
     True,
     "Last year four of us designed a small rocket engine test stand for a student competition. My role was the data acquisition system. Halfway through, we realized that the mechanical and electrical parts didn't fit together, because we had worked separately. I suggested a short daily meeting and a shared list of interfaces. It took ten minutes a day, but after that we didn't have a single integration problem, and we finished two days early.",
     ["c-project-07", "c-project-09"]),
    ("failure", "Tell me about a time you failed.", "Расскажи о своей неудаче.",
     "STAR + чему научился. Честная неудача с выводом ценнее «я никогда не ошибаюсь».",
     True,
     "During my first lab project, I ran a whole series of tests before checking the calibration of the load cell. When I analyzed the data, the numbers looked wrong, and I had to repeat everything. It cost us a week. Since then, I always do a short check with a known weight before any test, and I added this step to our lab procedure.",
     ["c-project-10", "c-disagree-05"]),
    ("future", "Where do you see yourself in five years?", "Где ты видишь себя через пять лет?",
     "Рост внутри профессии, связанный с этой позицией. Не «на вашем месте» и не «в другой стране».",
     False,
     "In five years, I'd like to be a structural engineer who can take a part from design to qualification test on my own. I'd also like to mentor younger engineers, the way my supervisors helped me. And ideally, I'd like to see something I worked on actually fly.",
     ["c-intro-10"]),
    ("ask", "Do you have any questions for us?", "У тебя есть вопросы к нам?",
     "Всегда задавай 1–2 вопроса о работе и команде. «Нет вопросов» звучит как отсутствие интереса. О зарплате — не первым вопросом.",
     False,
     "Yes, a couple. What does a typical day look like for someone in this role? And what would you expect from me in the first three months?",
     ["c-questions-01", "c-questions-02", "c-questions-04"]),
]
QUESTION_VOICE = "us-m"  # интервьюер Майк
EXAMPLE_VOICE = "gb-f"

# ——— Эпизоды 1–3. Реплики: (персонаж, текст, перевод) или ("me", [(вариант, перевод, почему_нет | None), …]) ———
EPISODES = [
    {
        "id": "ep-1", "n": 1, "title": "Собеседование", "place": "Офис компании, переговорная",
        "after": "call-intro",
        "intro": "Ты пришёл на собеседование на стажировку в команду конструкторов. Тебя встречает Майк из HR, потом подключается тимлид Дана.",
        "lines": [
            ("mike", "Hi, thanks for coming in. Did you find us okay?", "Привет, спасибо, что пришёл. Легко нашёл нас?"),
            ("me", [
                ("Yes, thanks. The directions were really clear.", "Да, спасибо. Всё было очень понятно объяснено.", None),
                ("No, I am finding you with difficulty.", "Нет, я находил вас с трудностью.", "Калька с русского — так не говорят. Короткое «Yes, thanks» здесь уместнее."),
                ("Yes. Where is the toilet?", "Да. Где туалет?", "Слишком резко для первой фразы. Сначала поблагодари."),
            ]),
            ("mike", "Great. I'm Mike, I handle recruitment, and this is Dana. She leads the structures team.", "Отлично. Я Майк, занимаюсь наймом, а это Дана — она руководит группой конструкций."),
            ("dana", "Nice to meet you. So, let's start easy. Tell me a little about yourself.", "Приятно познакомиться. Начнём с простого: расскажи немного о себе."),
            ("me", [
                ("I'm a fourth-year student in rocket and space engineering. I'm currently working on a project about composite testing.", "Я студент четвёртого курса, ракетно-космическая техника. Сейчас работаю над проектом по испытаниям композитов.", None),
                ("I was born in a small town, and I have a cat.", "Я родился в маленьком городе, и у меня есть кот.", "Не по делу: на собеседовании начинают с учёбы и работы."),
                ("I am student. I study rockets.", "Я студент. Я учу ракеты.", "Слишком коротко и с ошибкой: «a student». Добавь, чем занимаешься сейчас."),
            ]),
            ("dana", "Composite testing, interesting. What exactly are you testing?", "Испытания композитов — интересно. Что именно вы испытываете?"),
            ("me", [
                ("Mostly tensile and bending tests of carbon fiber specimens, and I compare the results with FEA.", "В основном растяжение и изгиб образцов из углепластика, и я сравниваю результаты с расчётом МКЭ.", None),
                ("It's a secret.", "Это секрет.", "Звучит грубо. Если есть ограничения — скажи «I can't share the details, but in general…»."),
                ("Everything.", "Всё.", "Слишком расплывчато. Назови конкретные испытания."),
            ]),
            ("dana", "And what was the most difficult part?", "А что было самым сложным?"),
            ("me", [
                ("That's a good question, let me think. Probably getting consistent results, because the specimens kept failing at the grips.", "Хороший вопрос, дайте подумать. Пожалуй, получить стабильные результаты: образцы всё время разрушались в захватах.", None),
                ("Nothing was difficult.", "Ничего сложного не было.", "Не верят никогда. Лучше честная трудность и как ты её решал."),
                ("The difficult part was difficult.", "Сложная часть была сложной.", "Пустой ответ. Возьми паузу чанком «Let me think…» и назови конкретику."),
            ]),
            ("mike", "Do you have any questions for us?", "У тебя есть вопросы к нам?"),
            ("me", [
                ("Yes, what does a typical day look like for an intern in your team?", "Да: как выглядит обычный день стажёра в вашей команде?", None),
                ("What is the salary?", "Какая зарплата?", "Не первым вопросом: сначала покажи интерес к работе."),
                ("No.", "Нет.", "«Нет вопросов» звучит как отсутствие интереса."),
            ]),
            ("dana", "It's a mix: some design work in CAD, some time in the lab, and a short stand-up every morning. You'd be working with Priya.", "Всего понемногу: проектирование в CAD, работа в лаборатории и короткая планёрка каждое утро. Работать будешь с Прией."),
            ("mike", "Thanks for your time. We'll be in touch by the end of next week.", "Спасибо за время. Мы свяжемся с тобой до конца следующей недели."),
            ("me", [
                ("Thank you, I really enjoyed the conversation.", "Спасибо, мне очень понравился разговор.", None),
                ("Okay, bye.", "Ладно, пока.", "Слишком коротко для завершения собеседования."),
                ("Please call me tomorrow.", "Позвоните мне завтра, пожалуйста.", "Давит на интервьюера — сроки они уже назвали."),
            ]),
        ],
        "culture": ("Small talk и вопросы в конце",
                    "«Did you find us okay?» в начале собеседования — не проверка, а способ расслабиться: отвечай коротко и дружелюбно. В конце всегда задавай вопрос о работе — «вопросов нет» звучит как отсутствие интереса. О зарплате — не первым вопросом, лучше на следующем этапе."),
    },
    {
        "id": "ep-2", "n": 2, "title": "Первый день", "place": "Опен-спейс команды, кухня",
        "after": "call-clarify",
        "intro": "Тебя взяли! Первый день: Дана знакомит с командой, болтливый Том зовёт на кофе, наставница Прия выдаёт первую задачу.",
        "lines": [
            ("dana", "Welcome aboard! Let me introduce you to the team. This is Priya, she'll be your mentor.", "Добро пожаловать в команду! Давай познакомлю. Это Прия, она будет твоей наставницей."),
            ("priya", "Hi, great to have you here. How are you settling in?", "Привет, рада, что ты с нами. Как осваиваешься?"),
            ("me", [
                ("So far so good, thanks. Everyone's been really helpful.", "Пока всё хорошо, спасибо. Все очень помогают.", None),
                ("I am settling in the chair.", "Я устраиваюсь в кресле.", "Буквальное понимание: settling in — «осваиваться на новом месте»."),
                ("Bad. I didn't sleep at all.", "Плохо. Я совсем не спал.", "На «How are you…» отвечают коротко и позитивно, особенно в первый день."),
            ]),
            ("tom", "G'day! I'm Tom. Don't worry, the coffee machine is the most complicated system in this building. Fancy a coffee?", "Привет! Я Том. Не бойся, кофемашина — самая сложная система в этом здании. Хочешь кофе?"),
            ("me", [
                ("Sure, that sounds great.", "Конечно, с удовольствием.", None),
                ("What is fancy?", "Что такое fancy?", "Можно переспросить, но вежливее: «Sorry, what do you mean?» Fancy a coffee? = «Хочешь кофе?»."),
                ("I don't drink.", "Я не пью.", "Звучит резко. Можно: «No thanks, but I'll join you for a chat.»"),
            ]),
            ("tom", "Brilliant. So, where are you from originally?", "Отлично. А ты откуда родом?"),
            ("me", [
                ("I'm from Russia, from Moscow. I moved here for the internship.", "Я из России, из Москвы. Переехал сюда ради стажировки.", None),
                ("From the university.", "Из университета.", "Originally — про родной город или страну."),
                ("Why do you ask?", "А зачем спрашиваешь?", "Звучит настороженно. Это обычный small talk."),
            ]),
            ("priya", "Okay, let's get you set up. Your first task is to review the bracket drawing and check the tolerances. Any questions?", "Так, давай тебя настроим. Первая задача — просмотреть чертёж кронштейна и проверить допуски. Есть вопросы?"),
            ("me", [
                ("Just to make sure I understand, should I check all the dimensions or only the critical ones?", "Чтобы убедиться, что я правильно понял: проверять все размеры или только критичные?", None),
                ("No questions.", "Вопросов нет.", "Упущенный шанс уточнить объём работы."),
                ("Tolerances of what?", "Допуски чего?", "Слишком резко. Переспроси через «Could you…» или «Just to make sure…»."),
            ]),
            ("priya", "Only the critical ones for now. They're marked in red. No rush, take your time.", "Пока только критичные — они отмечены красным. Не торопись."),
        ],
        "culture": ("«How are you?» и обращение по имени",
                    "«How are you?» и «How are you settling in?» — приветствие, а не вопрос о здоровье: «Good, thanks. You?» Коллег, включая руководителя, зовут по имени — «Dana», а не «Mrs. Walsh». Переспросить «Just to make sure I understand…» — признак профессионализма, а не слабости."),
    },
    {
        "id": "ep-3", "n": 3, "title": "Созвон с разными акцентами", "place": "Видеосозвон команды",
        "after": "air-accents",
        "intro": "Еженедельный созвон: британец Оливер говорит очень быстро, Арджун из Индии докладывает про датчики, Грейс из Сиднея — от отдела качества.",
        "lines": [
            ("dana", "Okay, everyone's here. Oliver, can you give us a quick update on the vibration test?", "Так, все на месте. Оливер, коротко — что с вибрационными испытаниями?"),
            ("oliver", "Sure. Right, so, the table's back up and running, we re-torqued the bolts on Friday, and the first run this morning looked clean, no resonance issues whatsoever.", "Конечно. Значит, стенд снова работает, болты перетянули в пятницу, первый прогон утром прошёл чисто, никаких резонансов."),
            ("dana", "Did you get all that?", "Всё уловил?"),
            ("me", [
                ("Mostly. Sorry, could you repeat the part about the first run?", "В основном. Извините, можно повторить про первый прогон?", None),
                ("Yes.", "Да.", "Если не понял — не делай вид, что понял. Переспросить на созвоне нормально."),
                ("No, he speaks too fast.", "Нет, он говорит слишком быстро.", "Правда, но звучит как упрёк. Лучше попросить повторить конкретную часть."),
            ]),
            ("oliver", "Sorry, I'll slow down. The first test this morning went well. No problems.", "Извини, помедленнее. Первый тест утром прошёл хорошо. Проблем нет."),
            ("arjun", "From my side, the new strain gauges have arrived. I will install them tomorrow, and we can start the static test on Wednesday.", "С моей стороны: новые тензодатчики пришли. Завтра установлю, и в среду можно начинать статические испытания."),
            ("grace", "Quick one from quality: we need the calibration certificates before Wednesday, otherwise we can't sign off on the results.", "Коротко от отдела качества: нужны сертификаты калибровки до среды, иначе мы не сможем утвердить результаты."),
            ("me", [
                ("I can collect the certificates from the supplier and send them to you by Tuesday.", "Я могу забрать сертификаты у поставщика и прислать до вторника.", None),
                ("It's not my job.", "Это не моя работа.", "Звучит как отказ помогать. Если не знаешь, кто отвечает, спроси: «Who's handling that?»"),
                ("Okay.", "Ладно.", "Пассивно: непонятно, кто что делает. Возьми задачу или спроси, кто её возьмёт."),
            ]),
            ("grace", "That'd be brilliant, thanks.", "Было бы отлично, спасибо."),
            ("dana", "Great. Anything else? No? Okay, thanks, everyone. Talk tomorrow.", "Отлично. Что-нибудь ещё? Нет? Всем спасибо, до завтра."),
            ("me", [
                ("Thanks, bye!", "Спасибо, пока!", None),
                ("Goodbye, I wish you all the best in your important work.", "До свидания, желаю вам всего наилучшего в вашей важной работе.", "Слишком торжественно для ежедневного созвона."),
                ("Wait, what about my question?", "Подождите, а мой вопрос?", "Вопрос надо было задать на «Anything else?»."),
            ]),
        ],
        "culture": ("Акценты и «Brilliant!»",
                    "На созвонах с разными акцентами нормально переспрашивать: «Sorry, could you repeat the part about…» лучше, чем делать вид, что понял. Британцы и австралийцы часто говорят «Brilliant!» и «Cheers» вместо «Great» и «Thanks». Sign off (on) — утвердить, подписать результат."),
    },
]


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    questions = [
        {"id": qid, "q": q, "ru": ru, "tip": tip, "star": star, "example": ex, "chunks": ch,
         "voice": QUESTION_VOICE, "speak": [{"text": ex, "voice": EXAMPLE_VOICE}], "reviewed": False}
        for qid, q, ru, tip, star, ex, ch in QUESTIONS
    ]
    episodes = []
    for e in EPISODES:
        lines = []
        for i, row in enumerate(e["lines"]):
            if row[0] == "me":
                opts = [{"text": t, "ru": r, "why": w} for t, r, w in row[1]]
                assert opts[0]["why"] is None and all(o["why"] for o in opts[1:]), f"{e['id']}#{i}: верный вариант — первый"
                lines.append({"speaker": "me", "options": opts, "speak": [{"text": opts[0]["text"], "voice": v} for v in STD]})
            else:
                who, text, ru = row
                lines.append({"speaker": who, "voice": CHARS[who], "text": text, "ru": ru})
        episodes.append({
            "id": e["id"], "n": e["n"], "title": e["title"], "place": e["place"], "after": e["after"], "intro": e["intro"],
            "lines": lines, "culture": {"title": e["culture"][0], "text": e["culture"][1]}, "reviewed": False,
        })

    def dump(name: str, data):
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    dump("questions.json", questions)
    dump("episodes.json", episodes)
    print(f"«Мой рассказ»: {len(questions)} вопросов; сюжет: {len(episodes)} эпизода, {sum(len(e['lines']) for e in episodes)} реплик")


if __name__ == "__main__":
    build()
