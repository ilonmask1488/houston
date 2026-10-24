"""
Контент фазы 3 — Техдок: стратегии чтения, технические тексты (3 уровня), встроенный словарь.

Специальности (scripts/fields.py): текст про ракеты и космос получает field="space" (space_field по
заголовку и абзацам), машиностроительные тексты (темы mach, join, hyd, maint) — field="mech" явно;
остальные (материалы, испытания, CAD, датчики) — общие. В каждом модуле doc-* космических и
машиностроительных текстов поровну, чтобы у обеих специальностей модуль был одной длины.
Термины словаря: темы space/prop → field="space", mach/join/hyd/maint → field="mech".

  .venv\\Scripts\\python.exe scripts\\author_phase3.py

Тексты — собственные (не копии статей), reviewed: false. Словарь — data/dict/*.txt:
переводы слов NGSL и NAWL (частотные полосы) и технический словарь с МФА; формы слов — из
лемматизированных списков NGSL/NAWL (CC BY-SA 4.0). Результат:
  src/content/doc/strategies.json, src/content/doc/texts.json — в основной кусок контента;
  src/content/dict/words.json — отдельный кусок, грузится при первом обращении к словарю.
"""
import json
import re
from pathlib import Path

from fields import space_field, with_field

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "content"
SRC = ROOT / "data" / "sources"
DICT = ROOT / "data" / "dict"
STD = ["us-f", "us-m", "gb-f", "gb-m"]
SOURCE = "Houston (собственный текст)"
LICENSE = "собственный текст приложения"

# ——— Стратегии чтения: объяснения модулей Техдока (формат как у объяснений Эфира) ———
STRATEGIES = {
    "doc-structure": {
        "intro": [
            "Научная статья почти всегда устроена одинаково: Abstract — аннотация, Introduction — зачем это нужно, Methods — как делали, Results — что получили, Discussion — что это значит, Conclusions — главное в двух-трёх фразах.",
            "Читать подряд не обязательно. Инженеры обычно читают аннотацию, потом выводы, потом смотрят рисунки — и только если нужно, идут в методику.",
        ],
        "rules": [
            ["Abstract", "что сделали и что получили", "\"We tested… The results show…\""],
            ["Introduction", "зачем и что уже известно", "\"However, little is known about…\""],
            ["Methods", "как именно делали", "\"Specimens were loaded at 2 mm/min.\""],
            ["Results", "цифры и графики без оценок", "\"The strength decreased by 12%.\""],
            ["Discussion", "почему так и что это значит", "\"This suggests that…\""],
        ],
        "tip": "Первое предложение абзаца — обычно его суть. Если понял первое и последнее, середину часто можно пробежать.",
    },
    "doc-abstract": {
        "intro": [
            "Аннотация отвечает на четыре вопроса: что изучали, как, что получили и что из этого следует. На это уходит 150–250 слов, и почти каждое предложение несёт один из ответов.",
            "Ищи сигнальные слова: «we propose / present» — что сделали; «was tested / measured» — методика; «results show / indicate» — результаты; «suggest / can be used» — выводы.",
        ],
        "rules": [
            ["We present / propose", "что сделали", "\"We present a passive thermal strap…\""],
            ["was measured / tested", "как проверяли", "\"The strap was tested in vacuum.\""],
            ["results show", "что получили", "\"Results show a 12 °C reduction.\""],
            ["suggest / can be used", "что из этого следует", "\"…can be used on small satellites.\""],
        ],
        "byField": {"mech": {"rules": [
            ["We present / propose", "что сделали", "\"We present a quick-change fixture for thin parts…\""],
            ["was measured / tested", "как проверяли", "\"The fixture was tested on a CNC mill.\""],
            ["results show", "что получили", "\"Results show a 30% shorter setup time.\""],
            ["suggest / can be used", "что из этого следует", "\"…can be used in small-batch production.\""],
        ]}},
        "tip": "Цифры в аннотации — самое ценное. Найди их первыми: проценты, градусы, килограммы.",
    },
    "doc-grammar": {
        "intro": [
            "В технических текстах много пассива: «The specimen was loaded» — важно, что сделали, а не кто. Переводи как «образец нагрузили» или «образец нагружался».",
            "Длинные цепочки существительных читаются справа налево: «carbon fiber reinforced polymer specimen failure mode» — это «характер разрушения образца из полимера, армированного углеродным волокном». Главное слово — последнее.",
        ],
        "rules": [
            ["было сделано", "was / were + V3", "\"The data were recorded at 1 kHz.\""],
            ["будет сделано", "will be / shall be + V3", "\"The panel shall be inspected.\""],
            ["цепочка", "главное слово — последнее", "\"engine test stand\" — стенд (для испытаний двигателей)"],
            ["-ing перед словом", "признак, а не действие", "\"cooling channels\" — каналы охлаждения"],
        ],
        "tip": "Застрял в длинном предложении — найди глагол-сказуемое. Всё, что до него, — подлежащее со всеми уточнениями.",
    },
    "doc-docs": {
        "intro": [
            "Документацию и даташиты не читают — в них ищут. Сначала оглавление или таблица характеристик, потом нужный раздел, и только нужное.",
            "В даташите: Specifications — характеристики, Operating conditions — условия работы, Absolute maximum ratings — что нельзя превышать, Typical — типовое значение, а не гарантированное.",
        ],
        "rules": [
            ["typical", "типовое, не гарантировано", "\"Accuracy: ±0.25% FS (typical)\""],
            ["max / min", "гарантированный предел", "\"Operating temperature: −40 to +85 °C\""],
            ["FS", "full scale — от полной шкалы", "\"±0.5% FS\" при шкале 200 bar = ±1 bar"],
            ["Note", "важное примечание", "\"Note: Do not exceed…\""],
        ],
        "tip": "«Typical» в даташите — ловушка: на него нельзя рассчитывать в запасах.",
    },
    "doc-standard": {
        "intro": [
            "В стандартах и требованиях модальные глаголы строго различаются: shall — обязательно, should — рекомендуется, may — допускается, will — описание факта или намерения.",
            "Отчёт об испытаниях отвечает на вопросы: что испытывали, по какой методике, какие были отклонения, прошло или нет (pass / fail).",
        ],
        "rules": [
            ["shall", "обязательно", "\"The adapter shall withstand 1.25 × limit load.\""],
            ["should", "рекомендуется", "\"Strain gauges should be placed…\""],
            ["may", "допускается", "\"Minor surface marks may be accepted.\""],
            ["deviation", "отклонение от методики", "\"Deviation: the test was paused…\""],
        ],
        "byField": {"mech": {"rules": [
            ["shall", "обязательно", "\"The frame shall withstand 1.25 × rated load.\""],
            ["should", "рекомендуется", "\"Strain gauges should be placed…\""],
            ["may", "допускается", "\"Minor surface marks may be accepted.\""],
            ["deviation", "отклонение от методики", "\"Deviation: the test was paused…\""],
        ]}},
        "tip": "В требованиях ищи shall — это то, за что потом спросят на приёмке.",
    },
    "doc-speed": {
        "intro": [
            "Статья на время: сначала прочитай вопрос, потом ищи в тексте ключевое слово из него — не читай всё подряд.",
            "Цифры, названия и термины из вопроса — якоря. Нашёл якорь — прочитай предложение целиком.",
        ],
        "rules": [],
        "tip": "Если вопрос про «почему», ищи because, due to, as a result, therefore.",
    },
}

# ——— Тексты ———
# find: (вопрос, ключевая фраза из предложения-ответа); summaries: [верное, неверное, неверное] по абзацам;
# retell: образец пересказа абзаца одним-двумя предложениями; parse: разбор трудного предложения.
TEXTS = [
    # ——— Уровень 1 ———
    {
        "id": "t-sat-bus", "module": "doc-structure", "level": 1, "topic": "space", "kind": "статья", "title": "What a satellite bus does",
        "paragraphs": [
            "Every satellite has two main parts: the payload and the bus. The payload is the reason the satellite exists, for example a camera or a radio transmitter. The bus is everything else that keeps the payload working.",
            "The bus provides electrical power from solar arrays and batteries. It controls the attitude, so that the antennas and the camera point in the right direction. It also keeps the temperature inside a safe range, because electronics do not like to be too hot or too cold. Engineers often reuse the same bus design for different missions, which saves time and money.",
        ],
        "paragraphsRu": [
            "У каждого спутника две основные части: полезная нагрузка и служебная платформа. Полезная нагрузка — то, ради чего спутник существует, например камера или радиопередатчик. Платформа — всё остальное, что обеспечивает работу полезной нагрузки.",
            "Платформа обеспечивает электропитание от солнечных батарей и аккумуляторов. Она управляет ориентацией, чтобы антенны и камера были направлены куда нужно. Кроме того, она поддерживает температуру внутри в безопасных пределах, потому что электроника не любит ни перегрева, ни переохлаждения. Инженеры часто используют одну и ту же конструкцию платформы для разных миссий, что экономит время и деньги.",
        ],
        "summaries": [
            ["A satellite consists of a payload, which does the mission, and a bus, which supports it.", "A satellite bus is a vehicle that carries astronauts to orbit.", "The payload provides power and controls the temperature."],
            ["The bus supplies power, controls attitude and temperature, and is often reused.", "Electronics work best at very low temperatures.", "Each mission needs a completely new bus design."],
        ],
        "retell": ["A satellite has a payload that does the job and a bus that supports it.", "The bus gives power, points the satellite and keeps the temperature right, and it can be reused."],
        "find": [("Where does the electrical power come from?", "solar arrays and batteries"), ("Why do engineers reuse the same bus design?", "saves time and money"), ("What are the two main parts of a satellite?", "the payload and the bus"), ("What is an example of a payload?", "a camera or a radio transmitter"), ("Why does the bus control the attitude?", "point in the right direction"), ("Why must the temperature stay in a safe range?", "electronics do not like")],
        "parse": {
            "sentence": "It also keeps the temperature inside a safe range, because electronics do not like to be too hot or too cold.",
            "parts": [["It also keeps the temperature", "главное: «Он (бус) также поддерживает температуру»"], ["inside a safe range", "в безопасных пределах"], ["because electronics do not like…", "причина: электроника не любит перегрева и переохлаждения"]],
            "q": "What keeps the temperature in a safe range?", "options": ["The bus", "The electronics", "The camera"], "answer": 0,
        },
    },
    {
        "id": "t-liquid-engine", "module": "doc-structure", "level": 1, "topic": "prop", "kind": "статья", "title": "How a liquid rocket engine works",
        "paragraphs": [
            "A liquid rocket engine burns a fuel and an oxidizer, for example kerosene and liquid oxygen. Pumps push both liquids into the combustion chamber, where they mix and burn at a very high temperature.",
            "The hot gas then flows through the nozzle. The narrow part of the nozzle is called the throat. After the throat, the nozzle becomes wider, and the gas accelerates to a very high speed. This fast jet of gas pushes the rocket forward. The force it creates is called thrust.",
        ],
        "paragraphsRu": [
            "Жидкостный ракетный двигатель сжигает горючее и окислитель, например керосин и жидкий кислород. Насосы подают обе жидкости в камеру сгорания, где они смешиваются и сгорают при очень высокой температуре.",
            "Затем горячий газ проходит через сопло. Самая узкая часть сопла называется критическим сечением. За критическим сечением сопло расширяется, и газ разгоняется до очень высокой скорости. Эта быстрая струя газа толкает ракету вперёд. Создаваемая ею сила называется тягой.",
        ],
        "summaries": [
            ["Fuel and oxidizer are pumped into a chamber where they burn.", "Liquid oxygen is used as fuel in all rockets.", "The chamber keeps the liquids cold."],
            ["The gas speeds up in the nozzle and creates thrust.", "The throat is the widest part of the nozzle.", "Thrust is the temperature of the gas."],
        ],
        "retell": ["The engine pumps fuel and oxidizer into a chamber, where they burn.", "The hot gas speeds up in the nozzle, and the fast jet creates thrust."],
        "find": [("What is the narrow part of the nozzle called?", "is called the throat"), ("What pushes the liquids into the combustion chamber?", "Pumps push both liquids"), ("What is an example of a fuel and an oxidizer?", "kerosene and liquid oxygen"), ("Where does the hot gas flow after the chamber?", "flows through the nozzle"), ("What happens to the nozzle after the throat?", "the nozzle becomes wider"), ("What is the force of the gas jet called?", "is called thrust")],
        "parse": {
            "sentence": "After the throat, the nozzle becomes wider, and the gas accelerates to a very high speed.",
            "parts": [["After the throat", "обстоятельство: после критического сечения"], ["the nozzle becomes wider", "сопло расширяется"], ["and the gas accelerates", "и газ разгоняется"]],
            "q": "What happens to the gas after the throat?", "options": ["It accelerates", "It burns again", "It cools down and stops"], "answer": 0,
        },
    },
    {
        "id": "t-composites", "module": "doc-structure", "level": 1, "topic": "mat", "kind": "статья", "title": "Why engineers like composites",
        "paragraphs": [
            "A composite material is made of two or more materials that work together. In aerospace, the most common composite is carbon fiber in an epoxy matrix. The fibers carry the load, and the matrix holds the fibers together.",
            "Composites are popular because they are stiff and light. A carbon fiber part can be much lighter than the same part made of aluminum. However, composites are also more expensive, and they can hide damage inside, where it is difficult to see. For this reason, they need careful inspection.",
        ],
        "paragraphsRu": [
            "Композиционный материал состоит из двух или более материалов, работающих совместно. В аэрокосмической технике самый распространённый композит — углеродное волокно в эпоксидной матрице. Волокна воспринимают нагрузку, а матрица удерживает волокна вместе.",
            "Композиты популярны, потому что они жёсткие и лёгкие. Деталь из углепластика может быть намного легче такой же детали из алюминия. Однако композиты к тому же дороже и могут скрывать повреждения внутри, где их трудно увидеть. Поэтому они требуют тщательного контроля.",
        ],
        "summaries": [
            ["In a composite, fibers carry the load and a matrix holds them together.", "Composites are made of a single metal.", "The matrix carries most of the load."],
            ["Composites are light and stiff but expensive and need careful inspection.", "Composites are always cheaper than aluminum.", "Damage in composites is easy to see."],
        ],
        "retell": ["A composite combines materials: the fibers carry the load and the matrix holds them.", "Composites are light and stiff, but they cost more and can hide damage, so they need inspection."],
        "find": [("What holds the fibers together?", "the matrix holds the fibers together"), ("Why do composites need careful inspection?", "hide damage inside"), ("How many materials does a composite have?", "two or more materials"), ("What is the most common composite in aerospace?", "carbon fiber in an epoxy matrix"), ("Why are composites popular?", "stiff and light"), ("A carbon fiber part is lighter than the same part made of what?", "made of aluminum")],
        "parse": {
            "sentence": "However, composites are also more expensive, and they can hide damage inside, where it is difficult to see.",
            "parts": [["However", "однако — противопоставление предыдущему"], ["composites are also more expensive", "композиты к тому же дороже"], ["they can hide damage inside, where it is difficult to see", "могут скрывать повреждения внутри, где их трудно увидеть"]],
            "q": "What is difficult to see?", "options": ["Damage inside the part", "The price", "The fibers on the surface"], "answer": 0,
        },
    },
    {
        "id": "t-tensile", "module": "doc-structure", "level": 1, "topic": "test", "kind": "статья", "title": "A simple tensile test",
        "paragraphs": [
            "A tensile test shows how strong a material is. A flat or round specimen is held in two grips. The machine pulls the grips apart slowly, and the specimen becomes longer until it breaks.",
            "During the test, a load cell measures the force, and an extensometer or a strain gauge measures how much the specimen stretches. From these data, engineers draw a stress-strain curve. The highest point of the curve shows the tensile strength, and the slope at the beginning shows the stiffness of the material.",
        ],
        "paragraphsRu": [
            "Испытание на растяжение показывает, насколько прочен материал. Плоский или круглый образец зажимают в двух захватах. Машина медленно разводит захваты, и образец удлиняется, пока не разрушится.",
            "Во время испытания датчик силы измеряет усилие, а экстензометр или тензорезистор — удлинение образца. По этим данным инженеры строят диаграмму «напряжение — деформация». Наивысшая точка кривой показывает предел прочности, а наклон её начального участка — жёсткость материала.",
        ],
        "summaries": [
            ["In a tensile test, a specimen is pulled until it breaks.", "In a tensile test, a specimen is heated in an oven.", "The grips measure the temperature of the specimen."],
            ["Force and stretch are measured to build a stress-strain curve.", "The load cell measures how much the specimen stretches.", "The curve only shows the color of the material."],
        ],
        "retell": ["In a tensile test, a machine pulls a specimen until it breaks.", "We measure force and stretch and get a curve that shows the strength and the stiffness."],
        "find": [("What measures the force?", "a load cell measures the force"), ("What does the slope at the beginning of the curve show?", "slope at the beginning shows the stiffness"), ("What does a tensile test show?", "how strong a material is"), ("What holds the specimen?", "held in two grips"), ("How long does the machine pull the specimen?", "until it breaks"), ("What curve do engineers draw from the data?", "stress-strain curve")],
        "parse": {
            "sentence": "The highest point of the curve shows the tensile strength, and the slope at the beginning shows the stiffness of the material.",
            "parts": [["The highest point of the curve", "подлежащее 1: наивысшая точка кривой"], ["shows the tensile strength", "показывает предел прочности"], ["the slope at the beginning shows the stiffness", "наклон в начале показывает жёсткость"]],
            "q": "What shows the stiffness?", "options": ["The slope at the beginning", "The highest point", "The load cell"], "answer": 0,
        },
    },
    {
        "id": "t-cad", "module": "doc-structure", "level": 1, "topic": "cad", "kind": "статья", "title": "From sketch to 3D model",
        "paragraphs": [
            "Most CAD models start with a 2D sketch. The designer draws lines and circles on a plane and adds dimensions and constraints, for example that two lines are parallel.",
            "Then the sketch becomes a 3D feature. The most common features are extrude, which pulls the sketch into a solid, and revolve, which turns it around an axis. The designer adds holes, fillets and chamfers, one feature at a time. Because the model is parametric, changing one dimension later updates the whole part.",
        ],
        "paragraphsRu": [
            "Большинство моделей в САПР начинается с двумерного эскиза. Конструктор рисует на плоскости линии и окружности и добавляет размеры и взаимосвязи, например параллельность двух линий.",
            "Затем эскиз превращается в трёхмерный элемент. Самые распространённые элементы — выдавливание, которое вытягивает эскиз в твёрдое тело, и вращение, которое поворачивает его вокруг оси. Конструктор добавляет отверстия, скругления и фаски — по одному элементу за раз. Поскольку модель параметрическая, изменение одного размера впоследствии обновляет всю деталь.",
        ],
        "summaries": [
            ["A CAD model usually starts with a dimensioned 2D sketch.", "CAD models always start as 3D solids.", "Constraints are only used in drawings."],
            ["Features like extrude and revolve turn sketches into a parametric solid.", "A parametric model cannot be changed after it is built.", "Revolve pulls the sketch in a straight line."],
        ],
        "retell": ["A CAD model starts with a 2D sketch with dimensions and constraints.", "Features like extrude and revolve make it 3D, and because it is parametric, one change updates the part."],
        "find": [("Which feature turns a sketch around an axis?", "revolve, which turns it around an axis"), ("What happens when you change one dimension later?", "updates the whole part"), ("What do most CAD models start with?", "start with a 2D sketch"), ("What is an example of a constraint?", "two lines are parallel"), ("What does extrude do?", "pulls the sketch into a solid"), ("How does the designer add holes and fillets?", "one feature at a time")],
        "parse": {
            "sentence": "Because the model is parametric, changing one dimension later updates the whole part.",
            "parts": [["Because the model is parametric", "причина: модель параметрическая"], ["changing one dimension later", "подлежащее: изменение одного размера позже"], ["updates the whole part", "обновляет всю деталь"]],
            "q": "What updates the whole part?", "options": ["Changing one dimension", "Adding a new sketch plane", "Printing the drawing"], "answer": 0,
        },
    },
    {
        "id": "t-strain-gauge", "module": "doc-structure", "level": 1, "topic": "sens", "kind": "статья", "title": "How a strain gauge measures strain",
        "paragraphs": [
            "A strain gauge is a thin metal pattern on a plastic film. It is glued to the surface of a part. When the part stretches, the gauge stretches too, and its electrical resistance changes a little.",
            "The change is very small, so the gauge is usually connected in a Wheatstone bridge. The bridge turns the small change of resistance into a voltage that an amplifier can measure. Temperature can also change the resistance, so good installations compensate for it with a second gauge.",
        ],
        "paragraphsRu": [
            "Тензорезистор — это тонкая металлическая решётка на полимерной плёнке. Его наклеивают на поверхность детали. Когда деталь растягивается, тензорезистор растягивается вместе с ней, и его электрическое сопротивление немного меняется.",
            "Это изменение очень мало, поэтому тензорезистор обычно включают в мост Уитстона. Мост превращает малое изменение сопротивления в напряжение, которое может измерить усилитель. Сопротивление меняется и от температуры, поэтому в хороших схемах её влияние компенсируют вторым тензорезистором.",
        ],
        "summaries": [
            ["A glued strain gauge changes its resistance when the part stretches.", "A strain gauge is a large metal block bolted to the part.", "The gauge changes color under load."],
            ["A bridge converts the tiny change into a voltage, and temperature must be compensated.", "The amplifier heats the gauge to measure strain.", "Temperature has no effect on the gauge."],
        ],
        "retell": ["A strain gauge is glued to a part, and its resistance changes when the part stretches.", "A Wheatstone bridge turns this small change into a voltage, and a second gauge compensates for temperature."],
        "find": [("What is the strain gauge glued to?", "glued to the surface of a part"), ("How do good installations deal with temperature?", "compensate for it with a second gauge"), ("What is a strain gauge?", "thin metal pattern on a plastic film"), ("What changes when the part stretches?", "electrical resistance changes a little"), ("Why is the gauge connected in a Wheatstone bridge?", "The change is very small"), ("What can measure the voltage from the bridge?", "an amplifier can measure")],
        "parse": {
            "sentence": "The bridge turns the small change of resistance into a voltage that an amplifier can measure.",
            "parts": [["The bridge turns", "мост превращает"], ["the small change of resistance", "малое изменение сопротивления"], ["into a voltage that an amplifier can measure", "в напряжение, которое может измерить усилитель"]],
            "q": "What does the bridge produce?", "options": ["A voltage", "A new resistance", "A temperature"], "answer": 0,
        },
    },
    # ——— Уровень 2 ———
    {
        "id": "t-cubesat-strap", "module": "doc-abstract", "level": 2, "topic": "space", "kind": "аннотация", "title": "Passive thermal control of a 3U CubeSat",
        "paragraphs": [
            "Small satellites have very limited power and mass budgets, which makes active thermal control difficult. In this work, we present a passive thermal strap made of pyrolytic graphite sheets that connects the on-board computer to an external radiator panel.",
            "The strap was tested in a thermal vacuum chamber under hot-case conditions, and the results were compared with a finite element model. The measured peak temperature of the computer board decreased by 12 °C, while the added mass was only 38 g. The model predicted the steady-state temperatures within 3 °C.",
            "The results suggest that graphite straps can replace heaters and fans in low-power CubeSat missions, especially when the internal layout does not allow a direct path to the radiator.",
        ],
        "paragraphsRu": [
            "У малых спутников очень ограничены бюджеты мощности и массы, что затрудняет активное терморегулирование. В этой работе мы представляем пассивный тепловой мост из листов пиролитического графита, который соединяет бортовой компьютер с внешней панелью радиатора.",
            "Тепловой мост испытали в термовакуумной камере в условиях «горячего» расчётного случая, а результаты сравнили с конечно-элементной моделью. Измеренная пиковая температура платы компьютера снизилась на 12 °C, а добавленная масса составила всего 38 г. Модель предсказала установившиеся температуры с точностью до 3 °C.",
            "Результаты позволяют предположить, что графитовые тепловые мосты могут заменить нагреватели и вентиляторы в маломощных миссиях CubeSat, особенно когда внутренняя компоновка не позволяет проложить прямой путь к радиатору.",
        ],
        "summaries": [
            ["The authors propose a light passive strap to cool the computer of a small satellite.", "The authors design a new solar panel for large satellites.", "The paper compares fans from different suppliers."],
            ["In vacuum tests, the strap lowered the peak temperature by 12 °C with little added mass.", "The strap increased the temperature of the computer board.", "The model disagreed with the tests by more than 20 °C."],
            ["Graphite straps may replace active systems in low-power CubeSats.", "Graphite straps should never be used in space.", "Heaters are always better than passive straps."],
        ],
        "retell": [
            "The paper presents a passive graphite strap that moves heat from the computer to a radiator.",
            "In vacuum tests, the peak temperature dropped by 12 degrees, and the model agreed within 3 degrees.",
            "So straps like this can replace heaters and fans in small, low-power satellites.",
        ],
        "find": [("How much mass did the strap add?", "added mass was only 38 g"), ("How accurate was the model?", "within 3 °C"), ("What is the strap made of?", "pyrolytic graphite sheets"), ("Why is active thermal control difficult on small satellites?", "limited power and mass budgets"), ("Where was the strap tested?", "thermal vacuum chamber"), ("How much did the peak temperature decrease?", "decreased by 12 °C"), ("What can graphite straps replace?", "replace heaters and fans")],
        "parse": {
            "sentence": "In this work, we present a passive thermal strap made of pyrolytic graphite sheets that connects the on-board computer to an external radiator panel.",
            "parts": [["we present a passive thermal strap", "главное: мы представляем пассивный тепловой мост"], ["made of pyrolytic graphite sheets", "из листов пиролитического графита (причастный оборот)"], ["that connects the on-board computer to an external radiator panel", "который соединяет бортовой компьютер с внешней панелью радиатора"]],
            "q": "What does the strap connect?", "options": ["The computer and the radiator", "The graphite sheets and the fans", "Two solar panels"], "answer": 0,
        },
    },
    {
        "id": "t-am-injector", "module": "doc-abstract", "level": 2, "topic": "prop", "kind": "аннотация", "title": "An additively manufactured injector for a small methane engine",
        "paragraphs": [
            "Injectors for small liquid rocket engines are traditionally assembled from many machined and brazed parts, which increases cost and lead time. This paper describes a one-piece coaxial injector for a 2 kN methane–oxygen engine, produced by laser powder bed fusion from a nickel superalloy.",
            "Before hot fire testing, the internal channels were inspected by computed tomography, and cold flow tests with water were used to check the pressure drop. In twelve hot fire tests with a total duration of 140 seconds, the engine reached a combustion efficiency of 96 percent, and no damage to the injector face was observed.",
            "The one-piece design reduced the number of parts from 34 to 1 and the manufacturing time from eight weeks to ten days. Further work will focus on surface roughness inside the channels, which caused a 7 percent higher pressure drop than predicted.",
        ],
        "paragraphsRu": [
            "Форсуночные головки малых жидкостных ракетных двигателей традиционно собирают из множества механически обработанных и паяных деталей, что увеличивает стоимость и сроки изготовления. В статье описана цельная коаксиальная форсуночная головка для метан-кислородного двигателя тягой 2 кН, изготовленная селективным лазерным сплавлением из никелевого суперсплава.",
            "Перед огневыми испытаниями внутренние каналы проверили методом компьютерной томографии, а перепад давления проверили проливками водой. В двенадцати огневых испытаниях общей продолжительностью 140 секунд двигатель достиг полноты сгорания 96 процентов, повреждений огневого днища форсуночной головки не обнаружено.",
            "Цельная конструкция сократила число деталей с 34 до 1, а срок изготовления — с восьми недель до десяти дней. Дальнейшая работа будет посвящена шероховатости поверхности внутри каналов, из-за которой перепад давления оказался на 7 процентов выше расчётного.",
        ],
        "summaries": [
            ["The paper presents a 3D-printed one-piece injector for a small methane engine.", "The paper compares kerosene and methane for large engines.", "The paper describes how to braze 34 injector parts."],
            ["After inspection and cold flow tests, hot fire tests showed high efficiency and no damage.", "The injector was destroyed during the first hot fire test.", "Only computer simulations were performed."],
            ["Printing cut parts and time sharply, but rough channels raised the pressure drop.", "The printed injector took longer to make than the old one.", "Surface roughness reduced the pressure drop."],
        ],
        "retell": [
            "The authors printed a one-piece injector for a small methane-oxygen engine.",
            "After CT inspection and water tests, twelve hot fires showed 96 percent efficiency and no damage.",
            "Printing cut 34 parts to one and eight weeks to ten days, but rough channels increased the pressure drop.",
        ],
        "find": [("How many hot fire tests were performed?", "In twelve hot fire tests"), ("How long did manufacturing take with the new design?", "ten days"), ("What caused the higher pressure drop?", "surface roughness inside the channels"), ("What is the thrust of the engine?", "2 kN"), ("How were the internal channels inspected?", "computed tomography"), ("What combustion efficiency did the engine reach?", "combustion efficiency of 96 percent"), ("How many parts did the old injector have?", "from 34 to 1")],
        "parse": {
            "sentence": "Before hot fire testing, the internal channels were inspected by computed tomography, and cold flow tests with water were used to check the pressure drop.",
            "parts": [["Before hot fire testing", "перед огневыми испытаниями"], ["the internal channels were inspected by computed tomography", "пассив: внутренние каналы проверили с помощью КТ"], ["cold flow tests with water were used to check the pressure drop", "пассив: для проверки перепада давления использовали проливки водой"]],
            "q": "How was the pressure drop checked?", "options": ["With cold flow tests using water", "With computed tomography", "During the hot fire tests only"], "answer": 0,
        },
    },
    {
        "id": "t-moisture-cfrp", "module": "doc-abstract", "level": 2, "topic": "mat", "kind": "аннотация", "title": "Effect of moisture on the interlaminar strength of CFRP",
        "paragraphs": [
            "Carbon fiber reinforced polymers absorb moisture from the air, which can reduce the strength of the matrix and of the fiber–matrix interface. This study investigates how moisture affects the interlaminar shear strength of a unidirectional carbon/epoxy laminate.",
            "Short beam specimens were conditioned at 70 °C and 85 percent relative humidity for up to 60 days and then tested at room temperature and at 90 °C. The weight gain of the specimens was measured every five days.",
            "After saturation, the interlaminar shear strength decreased by 9 percent at room temperature and by 27 percent at 90 °C. Microscopy showed that wet specimens failed mainly at the interface, whereas dry specimens failed within the matrix. These results indicate that hot and wet conditions should be considered in the design of composite structures.",
        ],
        "paragraphsRu": [
            "Углепластики поглощают влагу из воздуха, что может снижать прочность матрицы и границы раздела «волокно — матрица». В этом исследовании изучается, как влага влияет на межслойную прочность при сдвиге однонаправленного углеэпоксидного ламината.",
            "Образцы для испытаний методом короткой балки выдерживали при 70 °C и относительной влажности 85 процентов до 60 суток, а затем испытывали при комнатной температуре и при 90 °C. Привес образцов измеряли каждые пять суток.",
            "После насыщения межслойная прочность при сдвиге снизилась на 9 процентов при комнатной температуре и на 27 процентов при 90 °C. Микроскопия показала, что влажные образцы разрушались в основном по границе раздела, тогда как сухие — внутри матрицы. Эти результаты указывают на то, что при проектировании композитных конструкций нужно учитывать сочетание повышенной температуры и влажности.",
        ],
        "summaries": [
            ["The study checks how absorbed moisture changes the interlaminar strength of CFRP.", "The study measures how fast carbon fibers are produced.", "The study compares epoxy with aluminum."],
            ["Specimens were kept in hot, humid air and then tested at two temperatures.", "Specimens were tested only in a dry state.", "The specimens were weighed once at the end."],
            ["Moisture lowered strength, especially at high temperature, and changed the failure location.", "Moisture increased the strength by 27 percent.", "Wet and dry specimens failed in exactly the same way."],
        ],
        "retell": [
            "The study looks at how moisture reduces the interlaminar strength of a carbon/epoxy laminate.",
            "Specimens were kept in hot, humid air for up to 60 days and tested at room temperature and at 90 degrees.",
            "The strength dropped by 9 percent cold and 27 percent hot, so designers must consider hot and wet conditions.",
        ],
        "find": [("How much did the strength decrease at 90 °C?", "by 27 percent at 90 °C"), ("Where did the wet specimens fail?", "failed mainly at the interface"), ("How often was the weight gain measured?", "every five days"), ("What was the relative humidity?", "85 percent relative humidity"), ("How long were the specimens conditioned?", "for up to 60 days"), ("How much did the strength decrease at room temperature?", "by 9 percent at room temperature"), ("What should be considered in the design of composite structures?", "hot and wet conditions")],
        "parse": {
            "sentence": "Microscopy showed that wet specimens failed mainly at the interface, whereas dry specimens failed within the matrix.",
            "parts": [["Microscopy showed that", "микроскопия показала, что"], ["wet specimens failed mainly at the interface", "влажные образцы разрушались в основном по границе раздела"], ["whereas dry specimens failed within the matrix", "тогда как сухие — внутри матрицы (whereas — противопоставление)"]],
            "q": "Where did the dry specimens fail?", "options": ["Within the matrix", "At the interface", "In the grips"], "answer": 0,
        },
    },
    {
        "id": "t-vibration-bracket", "module": "doc-grammar", "level": 2, "topic": "test", "kind": "методика", "title": "Random vibration testing of an electronics bracket",
        "paragraphs": [
            "An aluminum bracket that supports an electronics box was subjected to random vibration testing in three perpendicular axes. The test levels were derived from the launch vehicle user's manual, with a qualification margin of 3 dB above the expected flight levels.",
            "Before and after each random run, a low-level sine sweep from 5 to 2000 Hz was performed to detect any change in the natural frequencies. A shift of more than 5 percent in the first natural frequency was defined as a failure criterion, because it usually indicates loosened fasteners or structural damage.",
            "Three triaxial accelerometers were bonded to the bracket and to the electronics box, and one control accelerometer was mounted on the shaker table.",
        ],
        "paragraphsRu": [
            "Алюминиевый кронштейн, на котором крепится блок электроники, подвергли испытаниям на случайную вибрацию по трём взаимно перпендикулярным осям. Уровни испытаний взяли из руководства пользователя ракеты-носителя с квалификационным запасом 3 дБ сверх ожидаемых полётных уровней.",
            "До и после каждого прогона случайной вибрации выполняли низкоуровневый синусоидальный проход от 5 до 2000 Гц, чтобы обнаружить изменение собственных частот. Критерием отказа был принят сдвиг первой собственной частоты более чем на 5 процентов, поскольку он обычно указывает на ослабление крепежа или повреждение конструкции.",
            "Три трёхосных акселерометра приклеили к кронштейну и к блоку электроники, а один управляющий акселерометр установили на стол вибростенда.",
        ],
        "summaries": [
            ["The bracket was vibrated in three axes at levels above the expected flight levels.", "The bracket was tested only in one axis at flight level.", "The test levels were chosen randomly by the operator."],
            ["Sine sweeps before and after each run checked for frequency shifts that indicate damage.", "Sine sweeps were used to heat the bracket.", "Any change in frequency was ignored."],
            ["Accelerometers measured the response of the bracket, the box and the table.", "Strain gauges were the only sensors used.", "No sensors were placed on the shaker table."],
        ],
        "retell": [
            "The bracket was vibrated in three axes, 3 dB above the expected flight levels.",
            "Sine sweeps before and after each run checked if the first frequency shifted by more than 5 percent.",
            "Accelerometers were placed on the bracket, on the box and on the shaker table.",
        ],
        "find": [("What was the qualification margin?", "qualification margin of 3 dB"), ("What was the failure criterion?", "more than 5 percent in the first natural frequency"), ("Where was the control accelerometer mounted?", "mounted on the shaker table"), ("In how many axes was the bracket tested?", "three perpendicular axes"), ("Where did the test levels come from?", "launch vehicle user's manual"), ("What was the frequency range of the sine sweep?", "from 5 to 2000 Hz"), ("What does a frequency shift usually indicate?", "loosened fasteners or structural damage")],
        "parse": {
            "sentence": "A shift of more than 5 percent in the first natural frequency was defined as a failure criterion, because it usually indicates loosened fasteners or structural damage.",
            "parts": [["A shift of more than 5 percent in the first natural frequency", "подлежащее — длинная группа: сдвиг более чем на 5% первой собственной частоты"], ["was defined as a failure criterion", "пассив: был принят за критерий отказа"], ["because it usually indicates…", "потому что обычно говорит об ослаблении крепежа или повреждении"]],
            "q": "What was defined as a failure criterion?", "options": ["A frequency shift of more than 5 percent", "Any loosened fastener", "A margin of 3 dB"], "answer": 0,
        },
    },
    {
        "id": "t-param-docs", "module": "doc-docs", "level": 2, "topic": "cad", "kind": "документация", "title": "Help: driving a model with global variables",
        "paragraphs": [
            "Global variables let you control several dimensions of a part or an assembly from one place. To create a variable, open the Equations dialog, type a name in the Global Variables section, and enter a value or an expression. Names are case-sensitive and must not contain spaces.",
            "To link a dimension to a variable, double-click the dimension in the graphics area, type an equals sign, and select the variable from the list. The dimension turns red if the expression cannot be evaluated. Note: after you change a variable, press Rebuild (Ctrl+B) to update the model. Circular references, where a variable depends on itself, are not supported and will produce an error.",
        ],
        "paragraphsRu": [
            "Глобальные переменные позволяют управлять несколькими размерами детали или сборки из одного места. Чтобы создать переменную, откройте диалог «Уравнения», введите имя в разделе «Глобальные переменные» и задайте значение или выражение. Имена чувствительны к регистру и не должны содержать пробелов.",
            "Чтобы связать размер с переменной, дважды щёлкните размер в графической области, введите знак равенства и выберите переменную из списка. Если выражение не удаётся вычислить, размер становится красным. Примечание: после изменения переменной нажмите «Перестроить» (Ctrl+B), чтобы обновить модель. Циклические ссылки, когда переменная зависит сама от себя, не поддерживаются и вызовут ошибку.",
        ],
        "summaries": [
            ["You create global variables in the Equations dialog to control several dimensions.", "Global variables can only be used in drawings.", "Variable names may contain spaces."],
            ["You link a dimension with an equals sign and rebuild after changes; circular references cause errors.", "Dimensions update automatically without rebuilding.", "A variable may depend on itself."],
        ],
        "retell": ["Global variables are created in the Equations dialog and control several dimensions at once.", "You link a dimension by typing an equals sign, and after a change you rebuild the model."],
        "find": [("What keyboard shortcut updates the model?", "Rebuild (Ctrl+B)"), ("What happens if the expression cannot be evaluated?", "turns red"), ("What must variable names not contain?", "must not contain spaces"), ("Which dialog do you open to create a variable?", "open the Equations dialog"), ("Are variable names case-sensitive?", "case-sensitive"), ("What do you type to link a dimension to a variable?", "type an equals sign"), ("What do circular references produce?", "will produce an error")],
        "parse": {
            "sentence": "Circular references, where a variable depends on itself, are not supported and will produce an error.",
            "parts": [["Circular references", "подлежащее: циклические ссылки"], [", where a variable depends on itself,", "пояснение: когда переменная зависит сама от себя"], ["are not supported and will produce an error", "не поддерживаются и вызовут ошибку"]],
            "q": "What is a circular reference?", "options": ["A variable that depends on itself", "A dimension that turns red", "A variable with a space in its name"], "answer": 0,
        },
    },
    {
        "id": "t-pt-datasheet", "module": "doc-docs", "level": 2, "topic": "sens", "kind": "даташит", "title": "PT-200 pressure transducer: specifications",
        "paragraphs": [
            "Pressure range: 0 to 200 bar gauge. Output signal: 4 to 20 mA, two-wire. Supply voltage: 10 to 30 V DC. Accuracy: ±0.25% FS (typical), ±0.5% FS (maximum), including non-linearity, hysteresis and repeatability. Response time: less than 1 ms.",
            "Operating temperature: −40 to +85 °C. Compensated temperature range: −20 to +80 °C. Proof pressure: 400 bar. Burst pressure: 800 bar. Wetted parts: stainless steel 316L. Note: exceeding the proof pressure may cause a permanent zero offset. Do not use with liquid oxygen unless the sensor has been cleaned for oxygen service.",
        ],
        "paragraphsRu": [
            "Диапазон давления: от 0 до 200 бар (избыточное). Выходной сигнал: 4–20 мА, двухпроводная схема. Напряжение питания: 10–30 В постоянного тока. Точность: ±0,25% ВПИ (типовая), ±0,5% ВПИ (максимальная), включая нелинейность, гистерезис и повторяемость. Время отклика: менее 1 мс.",
            "Рабочая температура: от −40 до +85 °C. Диапазон термокомпенсации: от −20 до +80 °C. Давление перегрузки: 400 бар. Разрушающее давление: 800 бар. Детали, контактирующие со средой: нержавеющая сталь 316L. Примечание: превышение давления перегрузки может вызвать необратимое смещение нуля. Не использовать с жидким кислородом, если датчик не прошёл очистку для работы с кислородом.",
        ],
        "summaries": [
            ["The first part lists the range, output, supply and accuracy of the transducer.", "The first part describes how to install the transducer.", "The first part lists the price and delivery time."],
            ["The second part gives temperature and pressure limits and safety notes.", "The second part says the sensor can be used with any fluid.", "The second part explains how to calibrate the sensor."],
        ],
        "retell": ["The PT-200 measures up to 200 bar with a 4 to 20 milliamp output and a maximum error of half a percent of full scale.", "It works from minus 40 to plus 85 degrees, must not exceed 400 bar, and needs oxygen cleaning for liquid oxygen."],
        "find": [("What is the maximum accuracy error?", "±0.5% FS (maximum)"), ("What may happen if you exceed the proof pressure?", "permanent zero offset"), ("What material are the wetted parts made of?", "stainless steel 316L"), ("What is the output signal?", "4 to 20 mA"), ("What is the supply voltage?", "10 to 30 V DC"), ("What is the response time?", "less than 1 ms"), ("What is the burst pressure?", "Burst pressure: 800 bar")],
        "parse": {
            "sentence": "Do not use with liquid oxygen unless the sensor has been cleaned for oxygen service.",
            "parts": [["Do not use with liquid oxygen", "запрет: не использовать с жидким кислородом"], ["unless", "если только не"], ["the sensor has been cleaned for oxygen service", "датчик прошёл очистку для работы с кислородом"]],
            "q": "When can the sensor be used with liquid oxygen?", "options": ["Only after cleaning for oxygen service", "Never under any conditions", "Only below 200 bar"], "answer": 0,
        },
    },
    # ——— Уровень 3 ———
    {
        "id": "t-adapter-req", "module": "doc-standard", "level": 3, "topic": "space", "kind": "требования", "title": "Structural requirements for a payload adapter",
        "paragraphs": [
            "The payload adapter shall withstand the limit loads defined in Section 4 multiplied by a factor of safety of 1.25 on yield and 1.4 on ultimate strength, without detrimental permanent deformation. Compliance shall be demonstrated by analysis and verified by a static qualification test on a dedicated test article.",
            "The first lateral natural frequency of the adapter with the payload mass simulator shall be above 15 Hz, and the first axial frequency shall be above 35 Hz, in order to avoid dynamic coupling with the launch vehicle. The frequencies should be measured by a low-level sine sweep before and after the qualification test.",
            "Minor surface scratches may be accepted without repair if their depth does not exceed 0.1 mm. Any crack, regardless of its size, shall be reported as a nonconformance and shall be dispositioned by the design authority before flight.",
        ],
        "paragraphsRu": [
            "Адаптер полезной нагрузки должен выдерживать эксплуатационные нагрузки, определённые в разделе 4 и умноженные на коэффициент безопасности 1,25 по пределу текучести и 1,4 по пределу прочности, без недопустимой остаточной деформации. Соответствие должно быть показано расчётом и подтверждено статическими квалификационными испытаниями на специально изготовленном испытательном образце.",
            "Первая поперечная собственная частота адаптера с имитатором массы полезной нагрузки должна быть выше 15 Гц, а первая продольная — выше 35 Гц, чтобы избежать динамического взаимодействия с ракетой-носителем. Частоты рекомендуется измерять низкоуровневым синусоидальным проходом до и после квалификационных испытаний.",
            "Мелкие поверхностные царапины допускается принимать без ремонта, если их глубина не превышает 0,1 мм. Любая трещина, независимо от её размера, должна оформляться как несоответствие, и решение по ней должен принять разработчик до полёта.",
        ],
        "summaries": [
            ["The adapter must carry scaled limit loads, shown by analysis and a static test.", "The adapter may be flown without any testing.", "The factor of safety is only applied to yield strength."],
            ["Minimum lateral and axial frequencies are required and should be checked by sine sweeps.", "The frequencies must be below 15 Hz.", "Sine sweeps are forbidden before the test."],
            ["Small scratches are acceptable, but every crack must be reported and dispositioned.", "Cracks shorter than 0.1 mm may be ignored.", "Scratches must always be repaired."],
        ],
        "retell": [
            "The adapter must carry the limit loads with safety factors of 1.25 and 1.4, proven by analysis and a static test.",
            "Its first frequencies must be above 15 hertz laterally and 35 hertz axially.",
            "Shallow scratches are fine, but any crack must be reported and approved before flight.",
        ],
        "find": [("What is the factor of safety on ultimate strength?", "1.4 on ultimate strength"), ("What is the minimum axial frequency?", "first axial frequency shall be above 35 Hz"), ("What is the maximum depth of an acceptable scratch?", "does not exceed 0.1 mm"), ("What is the factor of safety on yield?", "1.25 on yield"), ("What test shall verify compliance?", "static qualification test"), ("Why must the natural frequencies be high enough?", "avoid dynamic coupling"), ("Who shall disposition a crack before flight?", "dispositioned by the design authority")],
        "parse": {
            "sentence": "Any crack, regardless of its size, shall be reported as a nonconformance and shall be dispositioned by the design authority before flight.",
            "parts": [["Any crack, regardless of its size,", "подлежащее: любая трещина, независимо от размера"], ["shall be reported as a nonconformance", "обязательно: должна быть оформлена как несоответствие"], ["and shall be dispositioned by the design authority before flight", "и по ней должен принять решение разработчик до полёта"]],
            "q": "Which cracks must be reported?", "options": ["All cracks, of any size", "Only cracks deeper than 0.1 mm", "Only cracks found after flight"], "answer": 0,
        },
    },
    {
        "id": "t-combustion-instab", "module": "doc-speed", "level": 3, "topic": "prop", "kind": "обсуждение", "title": "Combustion instability: why engines shake themselves apart",
        "paragraphs": [
            "Combustion instability is a coupling between pressure oscillations in the combustion chamber and the heat release of the burning propellants. If the heat release is added in phase with the pressure peaks, the oscillations grow, sometimes within milliseconds, until they damage the injector or the chamber wall.",
            "High-frequency instabilities are usually associated with the acoustic modes of the chamber, especially the first tangential mode. Low-frequency instabilities, often called chugging, are more commonly linked to the feed system, where the pressure drop across the injector is too small to isolate the chamber from disturbances in the propellant lines.",
            "Engineers use several approaches to suppress instability. Baffles on the injector face and acoustic cavities in the chamber wall damp the acoustic modes, while a sufficient injector pressure drop, typically 15 to 20 percent of the chamber pressure, reduces the risk of chugging. Because the phenomenon is difficult to predict, full-scale hot fire testing remains essential.",
        ],
        "paragraphsRu": [
            "Неустойчивость горения — это взаимодействие колебаний давления в камере сгорания с тепловыделением горящего топлива. Если тепло выделяется в фазе с пиками давления, колебания нарастают — иногда за миллисекунды, — пока не повредят форсуночную головку или стенку камеры.",
            "Высокочастотную неустойчивость обычно связывают с акустическими модами камеры, особенно с первой тангенциальной модой. Низкочастотную неустойчивость, которую часто называют «чаггингом», чаще связывают с системой подачи, когда перепад давления на форсунках слишком мал, чтобы развязать камеру от возмущений в топливных магистралях.",
            "Для подавления неустойчивости инженеры применяют несколько подходов. Антипульсационные перегородки на огневом днище и акустические резонаторы в стенке камеры демпфируют акустические моды, а достаточный перепад давления на форсунках — обычно 15–20 процентов давления в камере — снижает риск низкочастотной неустойчивости. Поскольку это явление трудно предсказать, полноразмерные огневые испытания по-прежнему необходимы.",
        ],
        "summaries": [
            ["Instability grows when heat release is in phase with pressure oscillations.", "Instability happens only after the engine is shut down.", "Heat release always damps pressure oscillations."],
            ["High-frequency modes relate to chamber acoustics, low-frequency chugging to the feed system.", "Chugging is caused by the tangential acoustic mode.", "The feed system has no effect on stability."],
            ["Baffles, cavities and enough injector pressure drop help, but testing is still necessary.", "Instability can be fully predicted by simulation.", "A small pressure drop prevents chugging."],
        ],
        "retell": [
            "Combustion instability appears when heat release adds energy to pressure oscillations in the chamber.",
            "Fast oscillations come from chamber acoustics, and slow chugging comes from the feed system.",
            "Baffles, acoustic cavities and a large enough pressure drop help, but engines still need hot fire tests.",
        ],
        "find": [("Which mode is especially associated with high-frequency instability?", "first tangential mode"), ("What is the typical injector pressure drop?", "15 to 20 percent of the chamber pressure"), ("What are low-frequency instabilities often called?", "often called chugging"), ("What is combustion instability a coupling between?", "pressure oscillations in the combustion chamber"), ("When do the oscillations grow?", "in phase with the pressure peaks"), ("Where are acoustic cavities placed?", "acoustic cavities in the chamber wall"), ("Why is full-scale hot fire testing still essential?", "difficult to predict")],
        "parse": {
            "sentence": "Low-frequency instabilities, often called chugging, are more commonly linked to the feed system, where the pressure drop across the injector is too small to isolate the chamber from disturbances in the propellant lines.",
            "parts": [["Low-frequency instabilities, often called chugging,", "подлежащее с пояснением: низкочастотные неустойчивости («чаггинг»)"], ["are more commonly linked to the feed system", "чаще связаны с системой подачи"], ["where the pressure drop across the injector is too small to isolate the chamber…", "где перепад на форсунках слишком мал, чтобы развязать камеру с возмущениями в магистралях"]],
            "q": "Why does the feed system cause chugging?", "options": ["The injector pressure drop is too small", "The chamber has no baffles", "The propellants are too cold"], "answer": 0,
        },
    },
    {
        "id": "t-bonded-fatigue", "module": "doc-speed", "level": 3, "topic": "mat", "kind": "результаты", "title": "Fatigue of bonded composite joints",
        "paragraphs": [
            "Single-lap joints of carbon/epoxy adherends bonded with a toughened epoxy film adhesive were tested under constant-amplitude tension–tension fatigue at a stress ratio of 0.1 and a frequency of 5 Hz. Crack growth in the bondline was monitored with a travelling microscope and with backface strain gauges placed near the overlap ends.",
            "The fatigue threshold, defined as the maximum load at which no crack initiation was detected after two million cycles, was approximately 35 percent of the static failure load. Above this level, cracks initiated at the overlap ends, where peel stresses are highest, and then propagated along the adhesive–adherend interface.",
            "Joints with a tapered adherend edge and an adhesive fillet showed a 40 percent longer fatigue life than joints with square edges. The backface strain gauges detected crack initiation on average 15 percent of the fatigue life earlier than the microscope, which suggests that they could be used for structural health monitoring of bonded joints in service.",
        ],
        "paragraphsRu": [
            "Одинарные нахлёсточные соединения углеэпоксидных элементов, склеенных плёночным эпоксидным клеем повышенной трещиностойкости, испытывали на усталость по циклу «растяжение — растяжение» с постоянной амплитудой при коэффициенте асимметрии цикла 0,1 и частоте 5 Гц. Рост трещины в клеевом шве контролировали передвижным микроскопом и тензорезисторами на тыльной стороне, наклеенными у концов нахлёста.",
            "Порог усталости — максимальная нагрузка, при которой за два миллиона циклов не было обнаружено зарождения трещины, — составил примерно 35 процентов статической разрушающей нагрузки. Выше этого уровня трещины зарождались у концов нахлёста, где напряжения отрыва максимальны, а затем распространялись по границе раздела «клей — склеиваемый элемент».",
            "Соединения со скошенной кромкой склеиваемого элемента и клеевой галтелью показали на 40 процентов большую усталостную долговечность, чем соединения с прямыми кромками. Тензорезисторы на тыльной стороне обнаруживали зарождение трещины в среднем на 15 процентов усталостной долговечности раньше микроскопа, а значит, их можно было бы применять для контроля состояния клеевых соединений в эксплуатации.",
        ],
        "summaries": [
            ["Bonded lap joints were fatigue-tested, and cracks were monitored with a microscope and gauges.", "The joints were tested only under static load.", "The adhesive was a liquid paste without any film."],
            ["Below about 35 percent of the static load, no cracks started; above it, cracks grew from the overlap ends.", "Cracks started in the middle of the overlap.", "The threshold was 90 percent of the static load."],
            ["Tapered edges with fillets lived longer, and strain gauges detected cracks earlier than the microscope.", "Square edges gave the longest fatigue life.", "The strain gauges could not detect crack initiation."],
        ],
        "retell": [
            "Carbon/epoxy lap joints were fatigue-tested, and crack growth was monitored with a microscope and strain gauges.",
            "No cracks started below about 35 percent of the static load; above it, cracks grew from the overlap ends.",
            "Tapered edges gave 40 percent longer life, and the gauges saw cracks earlier, so they could monitor joints in service.",
        ],
        "find": [("What was the stress ratio of the fatigue test?", "stress ratio of 0.1"), ("Where did the cracks initiate?", "initiated at the overlap ends"), ("How much longer did tapered joints last?", "40 percent longer fatigue life"), ("What was the test frequency?", "frequency of 5 Hz"), ("What instrument was used to watch crack growth?", "travelling microscope"), ("What was the fatigue threshold?", "approximately 35 percent"), ("What could the backface gauges be used for?", "structural health monitoring")],
        "parse": {
            "sentence": "The fatigue threshold, defined as the maximum load at which no crack initiation was detected after two million cycles, was approximately 35 percent of the static failure load.",
            "parts": [["The fatigue threshold,", "подлежащее: порог усталости"], ["defined as the maximum load at which no crack initiation was detected after two million cycles,", "определение (причастный оборот): максимальная нагрузка, при которой за два миллиона циклов трещина не зародилась"], ["was approximately 35 percent of the static failure load", "сказуемое: составил около 35% статической разрушающей нагрузки"]],
            "q": "What was about 35 percent of the static failure load?", "options": ["The fatigue threshold", "The fatigue life of tapered joints", "The frequency of the test"], "answer": 0,
        },
    },
    {
        "id": "t-panel-report", "module": "doc-standard", "level": 3, "topic": "test", "kind": "отчёт об испытаниях", "title": "Test report: static load test of a composite floor panel",
        "paragraphs": [
            "Test article: sandwich floor panel, carbon/epoxy face sheets on aluminum honeycomb, serial number FP-003. Objective: to verify that the panel carries the ultimate design load of 12 kN without failure and the limit load of 8 kN without detrimental permanent deformation. The panel was simply supported on two edges and loaded at four points through rubber pads by a hydraulic actuator.",
            "The load was applied in steps of 10 percent of limit load, with a two-minute hold at each step. At limit load, the maximum deflection was 6.8 mm, which is 5 percent below the prediction, and the residual deflection after unloading was 0.1 mm, within the allowed 0.2 mm. At 11.4 kN, a local crushing of the core under one of the loading pads was heard and later confirmed by ultrasonic inspection.",
            "Deviation: during the first loading, the test was paused at 60 percent of limit load because of a data acquisition fault; the panel was unloaded and the test was restarted. Result: the panel reached the ultimate load of 12 kN and held it for three seconds without global failure. The local core crushing is attributed to the pad size and is not considered representative of the flight configuration. Status: PASS, with one observation.",
        ],
        "paragraphsRu": [
            "Объект испытаний: трёхслойная панель пола, обшивки из углепластика на алюминиевом сотовом заполнителе, заводской номер FP-003. Цель: подтвердить, что панель выдерживает расчётную разрушающую нагрузку 12 кН без разрушения и эксплуатационную нагрузку 8 кН без недопустимой остаточной деформации. Панель свободно опирали по двум кромкам и нагружали гидравлическим приводом в четырёх точках через резиновые прокладки.",
            "Нагрузку прикладывали ступенями по 10 процентов эксплуатационной с выдержкой две минуты на каждой ступени. При эксплуатационной нагрузке максимальный прогиб составил 6,8 мм, что на 5 процентов меньше расчётного, а остаточный прогиб после разгрузки — 0,1 мм при допустимых 0,2 мм. При 11,4 кН был слышен звук местного смятия сот под одной из нагружающих прокладок, что позднее подтвердил ультразвуковой контроль.",
            "Отклонение: при первом нагружении испытание приостановили на 60 процентах эксплуатационной нагрузки из-за сбоя системы сбора данных; панель разгрузили и начали испытание заново. Результат: панель достигла расчётной разрушающей нагрузки 12 кН и выдержала её в течение трёх секунд без общего разрушения. Местное смятие заполнителя объясняется размером прокладки и не считается характерным для лётной конфигурации. Статус: ПРОЙДЕНО, с одним замечанием.",
        ],
        "summaries": [
            ["The report tests whether a sandwich panel carries its design loads in a four-point setup.", "The report describes the manufacturing of the honeycomb core.", "The panel was tested under vibration."],
            ["Deflection matched predictions, and local core crushing was noticed near ultimate load.", "The panel broke completely at limit load.", "The residual deflection was far above the allowed value."],
            ["After a restart, the panel held ultimate load; the test passed with one observation.", "The test failed because of the data acquisition fault.", "The core crushing is considered a flight problem."],
        ],
        "retell": [
            "The report checks if a sandwich floor panel carries 8 kN without permanent damage and 12 kN without failure.",
            "Deflection was 5 percent below the prediction, but the core crushed locally under one pad at 11.4 kN.",
            "After a restart caused by a data fault, the panel held the ultimate load, so the test passed with one observation.",
        ],
        "find": [("What was the maximum deflection at limit load?", "maximum deflection was 6.8 mm"), ("Why was the test paused?", "data acquisition fault"), ("At what load was core crushing heard?", "At 11.4 kN"), ("What is the serial number of the panel?", "FP-003"), ("What applied the load to the panel?", "hydraulic actuator"), ("How long was the hold at each load step?", "two-minute hold"), ("How long did the panel hold the ultimate load?", "for three seconds")],
        "parse": {
            "sentence": "The local core crushing is attributed to the pad size and is not considered representative of the flight configuration.",
            "parts": [["The local core crushing", "подлежащее: местное смятие заполнителя"], ["is attributed to the pad size", "пассив: объясняется размером прокладки"], ["and is not considered representative of the flight configuration", "и не считается характерным для лётной конфигурации"]],
            "q": "Why did the core crush locally?", "options": ["Because of the loading pad size", "Because the panel was too heavy", "Because of the data acquisition fault"], "answer": 0,
        },
    },
    {
        "id": "t-stackup", "module": "doc-docs", "level": 3, "topic": "cad", "kind": "документация", "title": "Tolerance stack-up: worst case or statistical?",
        "paragraphs": [
            "A tolerance stack-up calculates how the tolerances of individual parts combine in an assembly to affect a critical dimension, such as a gap or an interference. In a worst-case analysis, all tolerances are added arithmetically, assuming that every part is simultaneously at its most unfavorable limit.",
            "Worst-case analysis guarantees that every assembly will fit, but it often leads to unnecessarily tight and expensive tolerances when the chain contains many parts. A statistical analysis, most commonly the root sum square method, assumes that the dimensions are independent and normally distributed and combines the tolerances as the square root of the sum of their squares.",
            "For a chain of five parts, each with a tolerance of ±0.1 mm, the worst-case result is ±0.5 mm, whereas the root sum square result is about ±0.22 mm. The statistical method is therefore appropriate for high-volume production with capable processes, while worst-case analysis should be used for safety-critical interfaces and for small batches, where the statistical assumptions may not hold.",
        ],
        "paragraphsRu": [
            "Расчёт размерной цепи показывает, как допуски отдельных деталей складываются в сборке и влияют на критичный размер, например зазор или натяг. При расчёте на максимум-минимум все допуски складываются арифметически в предположении, что каждая деталь одновременно находится на самом неблагоприятном пределе.",
            "Расчёт на максимум-минимум гарантирует собираемость каждого изделия, но при большом числе звеньев в цепи часто приводит к неоправданно жёстким и дорогим допускам. Вероятностный расчёт — чаще всего методом квадратного корня из суммы квадратов — предполагает, что размеры независимы и распределены нормально, и объединяет допуски как квадратный корень из суммы их квадратов.",
            "Для цепи из пяти деталей с допуском ±0,1 мм каждая расчёт на максимум-минимум даёт ±0,5 мм, а метод квадратного корня из суммы квадратов — около ±0,22 мм. Поэтому вероятностный метод подходит для крупносерийного производства со стабильными процессами, а расчёт на максимум-минимум следует применять для интерфейсов, критичных для безопасности, и для малых партий, где статистические допущения могут не выполняться.",
        ],
        "summaries": [
            ["A stack-up shows how part tolerances add up; worst case assumes all parts at their worst limits.", "A stack-up measures the weight of an assembly.", "Worst-case analysis ignores tolerances."],
            ["Worst case is safe but expensive; the statistical method uses the root sum square.", "The statistical method always gives larger results than worst case.", "The root sum square adds tolerances arithmetically."],
            ["An example shows the difference, and each method has its proper use.", "Worst case should be used for all high-volume production.", "Statistical methods are best for safety-critical interfaces."],
        ],
        "retell": [
            "A tolerance stack-up shows how part tolerances combine; worst case adds them all up.",
            "Worst case is safe but expensive, so the root sum square method combines them statistically.",
            "For five parts it gives 0.22 instead of 0.5 millimeters, but for safety-critical parts we still use worst case.",
        ],
        "find": [("What is the worst-case result for five parts?", "the worst-case result is ±0.5 mm"), ("What is the most common statistical method?", "root sum square method"), ("When should worst-case analysis be used?", "safety-critical interfaces and for small batches"), ("What is an example of a critical dimension?", "a gap or an interference"), ("What does worst-case analysis guarantee?", "every assembly will fit"), ("What is the root sum square result for five parts?", "about ±0.22 mm"), ("When is the statistical method appropriate?", "high-volume production")],
        "parse": {
            "sentence": "In a worst-case analysis, all tolerances are added arithmetically, assuming that every part is simultaneously at its most unfavorable limit.",
            "parts": [["In a worst-case analysis", "при расчёте на максимум-минимум"], ["all tolerances are added arithmetically", "пассив: все допуски складываются арифметически"], ["assuming that every part is simultaneously at its most unfavorable limit", "в предположении, что каждая деталь одновременно на самом неблагоприятном пределе"]],
            "q": "What does worst-case analysis assume?", "options": ["All parts are at their worst limits at the same time", "Dimensions are normally distributed", "Only one part is out of tolerance"], "answer": 0,
        },
    },
    {
        "id": "t-load-cell-unc", "module": "doc-standard", "level": 3, "topic": "sens", "kind": "методика", "title": "Estimating the uncertainty of a load cell measurement",
        "paragraphs": [
            "Every measurement result should be reported together with its uncertainty. For a load measured with a strain gauge load cell, the main contributions are the calibration uncertainty of the load cell, its non-linearity and hysteresis, the resolution of the data acquisition system, temperature effects and the repeatability of the setup.",
            "Each contribution shall be expressed as a standard uncertainty. Values given as limits in a datasheet, for example ±0.05 percent of full scale, are usually treated as a rectangular distribution and divided by the square root of three. The standard uncertainties are then combined as the square root of the sum of their squares, provided that they are independent.",
            "The combined standard uncertainty is multiplied by a coverage factor, normally k = 2, to obtain the expanded uncertainty, which corresponds to a confidence level of approximately 95 percent. For example, a 50 kN load cell with a combined standard uncertainty of 20 N would be reported as 50.00 kN ± 0.04 kN (k = 2).",
        ],
        "paragraphsRu": [
            "Любой результат измерения следует приводить вместе с его неопределённостью. Для силы, измеренной тензорезисторным датчиком силы, основные составляющие — неопределённость калибровки датчика, его нелинейность и гистерезис, разрешение системы сбора данных, влияние температуры и повторяемость установки.",
            "Каждую составляющую обязательно выражают в виде стандартной неопределённости. Значения, заданные в даташите как пределы, например ±0,05 процента ВПИ, обычно считают равномерно распределёнными и делят на квадратный корень из трёх. Затем стандартные неопределённости объединяют как квадратный корень из суммы их квадратов — при условии, что они независимы.",
            "Суммарную стандартную неопределённость умножают на коэффициент охвата, обычно k = 2, и получают расширенную неопределённость, соответствующую уровню доверия примерно 95 процентов. Например, результат измерения датчиком силы на 50 кН с суммарной стандартной неопределённостью 20 Н записали бы как 50,00 кН ± 0,04 кН (k = 2).",
        ],
        "summaries": [
            ["Load measurements need an uncertainty, which comes from several listed sources.", "Load cells have no measurement uncertainty.", "Only temperature affects the result."],
            ["Each source becomes a standard uncertainty, and independent ones are combined by root sum square.", "Datasheet limits are multiplied by three.", "Uncertainties are simply added arithmetically."],
            ["The combined value times k = 2 gives the expanded uncertainty at about 95 percent confidence.", "The coverage factor is always 10.", "Expanded uncertainty corresponds to 50 percent confidence."],
        ],
        "retell": [
            "A load measurement must include its uncertainty, which comes from calibration, non-linearity, resolution, temperature and repeatability.",
            "Each part becomes a standard uncertainty, and independent parts are combined by root sum square.",
            "Multiplying by k equals 2 gives the expanded uncertainty, about 95 percent confidence.",
        ],
        "find": [("By what are datasheet limits divided?", "divided by the square root of three"), ("What is the normal coverage factor?", "normally k = 2"), ("How would the 50 kN measurement be reported?", "50.00 kN ± 0.04 kN"), ("What should be reported together with a measurement result?", "together with its uncertainty"), ("How shall each contribution be expressed?", "expressed as a standard uncertainty"), ("When can the standard uncertainties be combined by root sum square?", "provided that they are independent"), ("What confidence level does the expanded uncertainty give?", "approximately 95 percent")],
        "parse": {
            "sentence": "The combined standard uncertainty is multiplied by a coverage factor, normally k = 2, to obtain the expanded uncertainty, which corresponds to a confidence level of approximately 95 percent.",
            "parts": [["The combined standard uncertainty is multiplied by a coverage factor", "пассив: суммарную стандартную неопределённость умножают на коэффициент охвата"], [", normally k = 2,", "пояснение: обычно k = 2"], ["to obtain the expanded uncertainty, which corresponds to … 95 percent", "цель: чтобы получить расширенную неопределённость, соответствующую уровню доверия около 95%"]],
            "q": "What do you get after multiplying by the coverage factor?", "options": ["The expanded uncertainty", "The resolution", "The calibration certificate"], "answer": 0,
        },
    },
    {
        "id": "t-fea-guide", "module": "doc-grammar", "level": 3, "topic": "test", "kind": "руководство", "title": "Good practice for finite element stress analysis",
        "paragraphs": [
            "A finite element model is only as good as its boundary conditions. Over-constrained supports, such as fully fixed bolt holes, artificially stiffen the structure and move the stress peaks, while under-constrained models cannot be solved at all. The supports should represent the real stiffness of the interface as closely as reasonably possible.",
            "Stress results near point loads, sharp re-entrant corners and single constrained nodes are singularities: they increase without limit as the mesh is refined and should not be used for strength assessment. A mesh convergence study, in which the element size is reduced until the peak stress in the region of interest changes by less than 5 percent, shall be performed for every critical location.",
            "Finally, the model should be correlated with test data whenever possible. A difference of more than 10 percent between predicted and measured strains usually points to an error in the boundary conditions, the material properties or the load introduction, rather than to a problem with the solver itself.",
        ],
        "paragraphsRu": [
            "Конечно-элементная модель хороша ровно настолько, насколько хороши её граничные условия. Избыточные закрепления, например полностью заделанные болтовые отверстия, искусственно повышают жёсткость конструкции и смещают пики напряжений, а недозакреплённую модель вообще невозможно решить. Опоры должны воспроизводить реальную жёсткость интерфейса настолько точно, насколько это разумно возможно.",
            "Напряжения вблизи сосредоточенных сил, острых входящих углов и одиночных закреплённых узлов — это сингулярности: при измельчении сетки они растут неограниченно, и использовать их для оценки прочности нельзя. Для каждого критического места обязательно выполняется исследование сходимости сетки, в котором размер элемента уменьшают, пока пиковое напряжение в зоне интереса не станет меняться менее чем на 5 процентов.",
            "Наконец, модель по возможности следует верифицировать по результатам испытаний. Расхождение более 10 процентов между расчётными и измеренными деформациями обычно указывает на ошибку в граничных условиях, свойствах материала или приложении нагрузки, а не на проблему самого решателя.",
        ],
        "summaries": [
            ["Boundary conditions must represent real supports; too many or too few constraints are both wrong.", "Fully fixing every hole is always the safest choice.", "Boundary conditions do not affect the results."],
            ["Singular stresses must be ignored, and mesh convergence must be checked at critical points.", "Stresses at sharp corners converge quickly.", "A convergence study is optional."],
            ["Models should be correlated with tests; large differences usually mean input errors.", "Differences with test data are always caused by the solver.", "Correlation with tests is impossible."],
        ],
        "retell": [
            "Supports in the model must be as stiff as the real interface; fixing everything or too little is wrong.",
            "Stresses at point loads and sharp corners are singular, and the mesh must converge within 5 percent.",
            "Compare the model with tests; more than 10 percent difference usually means wrong inputs.",
        ],
        "find": [("What is the convergence criterion?", "changes by less than 5 percent"), ("What does a difference of more than 10 percent usually point to?", "error in the boundary conditions"), ("What do over-constrained supports do?", "artificially stiffen the structure"), ("What is a finite element model only as good as?", "only as good as its boundary conditions"), ("What should the supports represent?", "real stiffness of the interface"), ("What happens to singular stresses when the mesh is refined?", "increase without limit"), ("What should the model be correlated with?", "correlated with test data")],
        "parse": {
            "sentence": "A mesh convergence study, in which the element size is reduced until the peak stress in the region of interest changes by less than 5 percent, shall be performed for every critical location.",
            "parts": [["A mesh convergence study,", "подлежащее: исследование сходимости сетки"], ["in which the element size is reduced until the peak stress … changes by less than 5 percent,", "вставка: в нём размер элемента уменьшают, пока пиковое напряжение в зоне интереса не изменится меньше чем на 5%"], ["shall be performed for every critical location", "обязательно: должно выполняться для каждого критического места"]],
            "q": "What shall be performed for every critical location?", "options": ["A mesh convergence study", "A test with point loads", "A change of the solver"], "answer": 0,
        },
    },
    # ——— Документы КБ: ТЗ, протокол, даташит, несоответствие, инструкция, объявление, чертёж ———
    {
        "id": "t-thruster-req", "module": "doc-standard", "level": 2, "topic": "prop", "kind": "требования", "title": "Technical requirements: a cold gas thruster for a CubeSat",
        "paragraphs": [
            "This document defines the technical requirements for a cold gas thruster module for a 6U CubeSat. The module shall use nitrogen as the propellant and shall fit inside a volume of 100 × 100 × 50 mm. The total mass of the module with full tanks shall not exceed 1.2 kg.",
            "Each thruster shall produce a thrust of 10 mN ± 10 percent at a tank pressure of 4 bar. The minimum impulse bit should be less than 0.1 mN·s, so that the satellite can make small attitude corrections. The module may use one common tank for all four thrusters.",
            "The module shall survive the random vibration levels given in Annex B without leakage. Leak tightness shall be verified by a helium leak test before and after vibration, and the leak rate shall be below 1 × 10⁻⁶ mbar·l/s. Any deviation from these requirements shall be agreed with the customer in writing.",
        ],
        "paragraphsRu": [
            "Настоящий документ устанавливает технические требования к модулю двигателей на холодном газе для CubeSat формата 6U. Модуль должен использовать в качестве рабочего тела азот и должен помещаться в объём 100 × 100 × 50 мм. Полная масса модуля с заправленными баками не должна превышать 1,2 кг.",
            "Каждый двигатель должен создавать тягу 10 мН ± 10 процентов при давлении в баке 4 бар. Минимальный импульс рекомендуется обеспечить менее 0,1 мН·с, чтобы спутник мог выполнять небольшие коррекции ориентации. Допускается использовать один общий бак для всех четырёх двигателей.",
            "Модуль должен выдерживать уровни случайной вибрации, приведённые в приложении Б, без потери герметичности. Герметичность должна подтверждаться испытаниями гелиевым течеискателем до и после вибрации, при этом натекание должно быть менее 1 × 10⁻⁶ мбар·л/с. Любое отступление от настоящих требований должно быть письменно согласовано с заказчиком.",
        ],
        "summaries": [
            ["The module uses nitrogen and must fit into a given volume and mass.", "The module uses liquid oxygen and has no mass limit.", "The document describes how to launch a CubeSat."],
            ["Thrust and impulse bit are specified, and one common tank is allowed.", "Each thruster must have its own separate tank.", "The thrust may be any value the supplier chooses."],
            ["The module must stay leak-tight after vibration, and a helium test checks this.", "Leak testing is done only after launch.", "Deviations can be made without telling the customer."],
        ],
        "retell": [
            "The thruster module uses nitrogen, fits into 100 by 100 by 50 millimeters and weighs no more than 1.2 kilograms.",
            "Each thruster gives 10 millinewtons, small impulses are needed for attitude control, and one tank is allowed.",
            "The module must not leak after vibration, and a helium leak test checks this before and after.",
        ],
        "find": [
            ("What gas shall the module use as propellant?", "use nitrogen as the propellant"),
            ("What is the maximum mass of the module?", "shall not exceed 1.2 kg"),
            ("What thrust shall each thruster produce?", "thrust of 10 mN"),
            ("Why should the minimum impulse bit be small?", "small attitude corrections"),
            ("How many tanks may the module use?", "one common tank"),
            ("How shall leak tightness be verified?", "helium leak test"),
            ("Who must agree to any deviation?", "agreed with the customer"),
        ],
        "parse": {
            "sentence": "Leak tightness shall be verified by a helium leak test before and after vibration, and the leak rate shall be below 1 × 10⁻⁶ mbar·l/s.",
            "parts": [["Leak tightness shall be verified", "обязательно (пассив): герметичность должна быть подтверждена"], ["by a helium leak test before and after vibration", "гелиевым течеискателем до и после вибрации"], ["and the leak rate shall be below 1 × 10⁻⁶ mbar·l/s", "и натекание должно быть меньше 1 × 10⁻⁶ мбар·л/с"]],
            "q": "When shall the helium leak test be done?", "options": ["Before and after vibration", "Only after launch", "Only during vibration"], "answer": 0,
        },
    },
    {
        "id": "t-valve-protocol", "module": "doc-standard", "level": 2, "topic": "test", "kind": "протокол испытаний", "title": "Test protocol: proof and leak test of a solenoid valve",
        "paragraphs": [
            "Test item: solenoid valve SV-12, serial number 0457. Test date: 14 March. The aim of the test was to check that the valve body holds the proof pressure and that the closed valve does not leak. The test was carried out according to procedure TP-031, revision C.",
            "First, the valve was filled with water and pressurized to the proof pressure of 45 bar for five minutes. No leakage and no permanent deformation were found. After drying, the valve was connected to a helium leak detector. With 30 bar of helium at the inlet, the measured internal leak rate was 2 × 10⁻⁵ mbar·l/s, while the limit is 1 × 10⁻⁴ mbar·l/s.",
            "One deviation was recorded: the room temperature was 27 °C instead of the required 20 ± 5 °C, because the air conditioning was out of order. The test engineer and the customer representative agreed that this does not affect the result. Conclusion: the valve passed the test and can be used for further assembly.",
        ],
        "paragraphsRu": [
            "Объект испытаний: электромагнитный клапан SV-12, заводской номер 0457. Дата испытаний: 14 марта. Цель испытаний — проверить, что корпус клапана выдерживает давление опрессовки и что закрытый клапан герметичен. Испытания проведены по методике TP-031, редакция C.",
            "Сначала клапан заполнили водой и выдержали под давлением опрессовки 45 бар в течение пяти минут. Течей и остаточной деформации не обнаружено. После сушки клапан подключили к гелиевому течеискателю. При 30 бар гелия на входе измеренная внутренняя негерметичность составила 2 × 10⁻⁵ мбар·л/с при допустимой 1 × 10⁻⁴ мбар·л/с.",
            "Зафиксировано одно отклонение: температура в помещении была 27 °C вместо требуемых 20 ± 5 °C, так как не работал кондиционер. Инженер по испытаниям и представитель заказчика согласились, что это не влияет на результат. Заключение: клапан испытания выдержал и может быть допущен к дальнейшей сборке.",
        ],
        "summaries": [
            ["The protocol gives the test item, the date, the aim and the procedure.", "The protocol describes how the valve was designed.", "The test checked the electrical power of the valve."],
            ["The valve held 45 bar of water, and its helium leak rate was below the limit.", "The valve leaked during the water test.", "The helium leak rate was ten times above the limit."],
            ["A small temperature deviation did not affect the result, and the valve passed.", "The test failed because the room was too warm.", "The deviation was not discussed with the customer."],
        ],
        "retell": [
            "The protocol is for valve SV-12, number 0457, tested by procedure TP-031 for strength and leaks.",
            "The valve held 45 bar of water for five minutes, and the helium leak rate was five times below the limit.",
            "The room was too warm, but everyone agreed it did not matter, so the valve passed.",
        ],
        "find": [
            ("What is the serial number of the valve?", "serial number 0457"),
            ("Which procedure was used?", "procedure TP-031"),
            ("What was the proof pressure?", "proof pressure of 45 bar"),
            ("How long was the proof pressure held?", "for five minutes"),
            ("What was the measured internal leak rate?", "leak rate was 2 × 10⁻⁵"),
            ("Why was the room temperature too high?", "air conditioning was out of order"),
            ("What can the valve be used for now?", "used for further assembly"),
        ],
        "parse": {
            "sentence": "With 30 bar of helium at the inlet, the measured internal leak rate was 2 × 10⁻⁵ mbar·l/s, while the limit is 1 × 10⁻⁴ mbar·l/s.",
            "parts": [["With 30 bar of helium at the inlet", "условие: при 30 бар гелия на входе"], ["the measured internal leak rate was 2 × 10⁻⁵ mbar·l/s", "измеренная внутренняя негерметичность составила 2 × 10⁻⁵ мбар·л/с"], ["while the limit is 1 × 10⁻⁴ mbar·l/s", "тогда как допустимое значение — 1 × 10⁻⁴ мбар·л/с (while — противопоставление)"]],
            "q": "Is the measured leak rate above or below the limit?", "options": ["Below the limit", "Above the limit", "Exactly at the limit"], "answer": 0,
        },
    },
    {
        "id": "t-tc-datasheet", "module": "doc-docs", "level": 1, "topic": "sens", "kind": "даташит", "title": "Type K thermocouple probe: datasheet",
        "paragraphs": [
            "Type: K (nickel-chromium / nickel-aluminum). Measuring range: −50 to +1100 °C. Tolerance: class 1, ±1.5 °C or ±0.4 percent of the reading, whichever is greater. Sheath: Inconel 600, diameter 3 mm, length 150 mm.",
            "Junction: insulated, so the signal is not affected by the metal of the test article. Response time: about 1.5 s in moving water. Connector: miniature plug, yellow. Cable: 2 m, glass fiber insulation, maximum temperature 400 °C.",
            "Note: the probe can be bent once, but the bend radius must be at least three times the sheath diameter. Do not bend the last 20 mm near the tip. For accurate results, the probe should be inserted into the medium to a depth of at least ten diameters.",
        ],
        "paragraphsRu": [
            "Тип: K (хромель / алюмель). Диапазон измерений: от −50 до +1100 °C. Допуск: класс 1, ±1,5 °C или ±0,4 процента от показания — в зависимости от того, что больше. Оболочка: инконель 600, диаметр 3 мм, длина 150 мм.",
            "Спай: изолированный, поэтому на сигнал не влияет металл объекта испытаний. Время отклика: около 1,5 с в проточной воде. Разъём: миниатюрная вилка, жёлтая. Кабель: 2 м, изоляция из стекловолокна, максимальная температура 400 °C.",
            "Примечание: зонд можно согнуть один раз, но радиус изгиба должен быть не меньше трёх диаметров оболочки. Не сгибайте последние 20 мм у кончика. Для точных измерений зонд следует погружать в среду на глубину не менее десяти диаметров.",
        ],
        "summaries": [
            ["The first part gives the type, range, tolerance and sheath of the probe.", "The first part explains how to install the probe.", "The first part lists the price of the probe."],
            ["The second part describes the junction, response time, connector and cable.", "The second part says the cable can work at 1100 °C.", "The second part describes how to calibrate the probe."],
            ["The note explains how to bend the probe and how deep to insert it.", "The probe can be bent many times near the tip.", "The probe should only touch the surface of the medium."],
        ],
        "retell": [
            "This is a type K probe for minus 50 to 1100 degrees, with an Inconel sheath 3 millimeters thick.",
            "The junction is insulated, the response time is about 1.5 seconds, and the cable works up to 400 degrees.",
            "You can bend the probe once, but not near the tip, and you should insert it at least ten diameters deep.",
        ],
        "find": [
            ("What is the highest temperature the probe can measure?", "+1100 °C"),
            ("What is the sheath made of?", "Inconel 600"),
            ("Why is the junction insulated?", "not affected by the metal"),
            ("What color is the connector?", "miniature plug, yellow"),
            ("What is the maximum temperature of the cable?", "maximum temperature 400 °C"),
            ("What is the minimum bend radius?", "three times the sheath diameter"),
            ("Which part of the probe must not be bent?", "last 20 mm near the tip"),
            ("How deep should the probe be inserted?", "at least ten diameters"),
        ],
        "parse": {
            "sentence": "Note: the probe can be bent once, but the bend radius must be at least three times the sheath diameter.",
            "parts": [["Note: the probe can be bent once", "примечание: зонд можно согнуть один раз (пассив с can)"], ["but the bend radius must be", "но радиус изгиба должен быть"], ["at least three times the sheath diameter", "не меньше трёх диаметров оболочки"]],
            "q": "What is the minimum bend radius for this 3 mm sheath?", "options": ["9 mm", "3 mm", "20 mm"], "answer": 0,
        },
    },
    {
        "id": "t-ncr-bracket", "module": "doc-standard", "level": 2, "topic": "cad", "kind": "несоответствие", "title": "Nonconformance report: wrong hole position on a bracket",
        "paragraphs": [
            "Report number: NCR-2026-041. Part: bracket BR-220, drawing revision B, batch of 12 parts. During final inspection, the quality inspector found that the position of the two mounting holes on part number 7 was out of tolerance. The measured offset was 0.35 mm, while the drawing allows a position tolerance of 0.2 mm.",
            "The other eleven parts of the batch were checked and were found to be correct. The root cause was a wrong zero point on the milling machine after a tool change. The operator did not repeat the zero point check, which is required by the work instruction.",
            "Disposition: the part cannot be used as is, because the holes must align with the electronics box. The part shall be reworked by drilling the holes to the next standard size and using larger bolts, if the design authority agrees. Corrective action: a zero point check after every tool change was added to the machine checklist.",
        ],
        "paragraphsRu": [
            "Номер извещения: NCR-2026-041. Деталь: кронштейн BR-220, чертёж редакции B, партия из 12 деталей. При окончательном контроле контролёр ОТК обнаружил, что положение двух крепёжных отверстий на детали № 7 выходит за допуск. Измеренное смещение составило 0,35 мм, тогда как чертёж допускает позиционный допуск 0,2 мм.",
            "Остальные одиннадцать деталей партии проверили и признали годными. Первопричина — неверная нулевая точка на фрезерном станке после смены инструмента. Оператор не повторил проверку нулевой точки, которую требует рабочая инструкция.",
            "Решение: использовать деталь без доработки нельзя, потому что отверстия должны совпасть с блоком электроники. Деталь должна быть доработана рассверливанием отверстий до следующего стандартного размера с установкой болтов большего диаметра, если согласится разработчик. Корректирующее действие: в контрольный лист станка добавлена проверка нулевой точки после каждой смены инструмента.",
        ],
        "summaries": [
            ["One bracket in a batch had its holes out of position tolerance.", "All twelve brackets were scrapped.", "The holes were too small for the bolts."],
            ["The other parts were fine; the cause was a skipped zero point check.", "The cause was a mistake in the drawing.", "Five more parts of the batch were also wrong."],
            ["The part will be reworked if the designer agrees, and a new check was added.", "The part will be used without any changes.", "No corrective action was planned."],
        ],
        "retell": [
            "One bracket out of twelve had its two holes 0.35 millimeters off, but only 0.2 is allowed.",
            "The other parts were good; the cause was a wrong zero point after a tool change.",
            "The holes will be drilled bigger if the designer agrees, and a zero point check was added to the checklist.",
        ],
        "find": [
            ("How many parts were in the batch?", "batch of 12 parts"),
            ("Which part was out of tolerance?", "part number 7"),
            ("What was the measured offset?", "offset was 0.35 mm"),
            ("What position tolerance does the drawing allow?", "position tolerance of 0.2 mm"),
            ("What was the root cause?", "wrong zero point on the milling machine"),
            ("Why can the part not be used as is?", "align with the electronics box"),
            ("Who must agree to the rework?", "if the design authority agrees"),
            ("Where was the new check added?", "added to the machine checklist"),
        ],
        "parse": {
            "sentence": "The operator did not repeat the zero point check, which is required by the work instruction.",
            "parts": [["The operator did not repeat", "оператор не повторил"], ["the zero point check", "проверку нулевой точки (цепочка: главное слово check)"], [", which is required by the work instruction", "которую требует (пассив: которая требуется) рабочая инструкция"]],
            "q": "What requires the zero point check?", "options": ["The work instruction", "The drawing", "The customer"], "answer": 0,
        },
    },
    {
        "id": "t-bench-safety", "module": "doc-grammar", "level": 1, "topic": "test", "kind": "инструкция по безопасности", "title": "Safety rules for the hydraulic test bench",
        "paragraphs": [
            "Only trained staff may operate the hydraulic test bench. Before work, safety glasses and gloves must be put on, and long hair must be tied back. Visitors must stay behind the yellow line at all times.",
            "Before the pump is started, all hoses and fittings must be checked for damage. The test article must be fixed with all bolts, and the protective cover must be closed. Never stand in front of a pressurized hose, because a broken hose can move very fast.",
            "If oil is leaking or a strange noise is heard, press the red emergency stop button at once. The pressure is then released through the relief valve. Do not open the cover until the pressure gauge shows zero. Report every incident to the lab manager on the same day.",
        ],
        "paragraphsRu": [
            "Работать на гидравлическом испытательном стенде разрешается только обученному персоналу. Перед работой необходимо надеть защитные очки и перчатки, длинные волосы — убрать. Посетители должны всё время находиться за жёлтой линией.",
            "Перед запуском насоса все шланги и штуцеры необходимо проверить на повреждения. Объект испытаний должен быть закреплён всеми болтами, защитный кожух — закрыт. Никогда не стойте напротив шланга под давлением: оборвавшийся шланг может очень быстро хлестнуть.",
            "Если подтекает масло или слышен странный шум, немедленно нажмите красную кнопку аварийного останова. Давление при этом сбрасывается через предохранительный клапан. Не открывайте кожух, пока манометр не покажет ноль. О каждом происшествии сообщайте заведующему лабораторией в тот же день.",
        ],
        "summaries": [
            ["Only trained people with protective equipment work at the bench, and visitors keep their distance.", "Anyone may operate the bench without training.", "Visitors may stand next to the test article."],
            ["Before starting, check the hoses, fix the test article and close the cover.", "The cover must stay open during the test.", "You should stand in front of the hoses to watch them."],
            ["In an emergency, stop the bench, wait for zero pressure and report the incident.", "Open the cover at once when you hear a noise.", "Incidents should be reported at the end of the year."],
        ],
        "retell": [
            "Only trained staff with glasses and gloves may work at the bench, and visitors stay behind the yellow line.",
            "Check the hoses, fix the test article and close the cover before the pump starts.",
            "If something is wrong, press the emergency stop, wait for zero pressure and report it the same day.",
        ],
        "find": [
            ("Who may operate the bench?", "Only trained staff"),
            ("What must be put on before work?", "safety glasses and gloves"),
            ("Where must visitors stay?", "behind the yellow line"),
            ("What must be checked before the pump is started?", "hoses and fittings"),
            ("Why should you never stand in front of a pressurized hose?", "can move very fast"),
            ("What should you press if oil is leaking?", "red emergency stop button"),
            ("How is the pressure released?", "through the relief valve"),
            ("When can you open the cover?", "pressure gauge shows zero"),
            ("Who should you report an incident to?", "to the lab manager"),
        ],
        "parse": {
            "sentence": "Before the pump is started, all hoses and fittings must be checked for damage.",
            "parts": [["Before the pump is started", "пассив: перед тем как насос будет запущен"], ["all hoses and fittings", "подлежащее: все шланги и штуцеры"], ["must be checked for damage", "пассив с must: должны быть проверены на повреждения"]],
            "q": "What must be checked for damage?", "options": ["All hoses and fittings", "The pump motor", "The pressure gauge"], "answer": 0,
        },
    },
    {
        "id": "t-cleanroom-notice", "module": "doc-structure", "level": 1, "topic": "space", "kind": "объявление", "title": "Notice: new rules for the integration clean room",
        "paragraphs": [
            "To all staff of the assembly and test department. From Monday, 3 November, new rules will apply in clean room 2, where the flight model of the satellite is being integrated. The aim is to protect the optics and the electronics from dust and static electricity.",
            "Everyone must wear a clean suit, a hood, shoe covers and gloves inside the room. Before you touch the flight hardware, connect your wrist strap to the grounding point. Paper, pencils and food are not allowed, because they produce particles. Use only the special clean room notebooks, which are available at the entrance.",
            "The number of people in the room is limited to six. Please book your time in the shared calendar at least one day in advance. If you have questions, call the clean room manager on extension 214.",
        ],
        "paragraphsRu": [
            "Всем сотрудникам отдела сборки и испытаний. С понедельника, 3 ноября, в чистой комнате 2, где идёт сборка лётного образца спутника, вводятся новые правила. Цель — защитить оптику и электронику от пыли и статического электричества.",
            "Внутри помещения все обязаны носить чистый комбинезон, капюшон, бахилы и перчатки. Прежде чем прикасаться к лётному оборудованию, подключите антистатический браслет к точке заземления. Бумага, карандаши и еда запрещены, потому что от них летят частицы. Пользуйтесь только специальными блокнотами для чистых помещений — их можно взять у входа.",
            "Число людей в помещении ограничено шестью. Пожалуйста, бронируйте время в общем календаре не позднее чем за день. С вопросами звоните ответственному за чистую комнату по внутреннему номеру 214.",
        ],
        "summaries": [
            ["New clean room rules start on 3 November to protect the satellite.", "Clean room 2 will be closed from 3 November.", "The notice invites the staff to a party."],
            ["Staff must wear clean clothing, use a wrist strap and bring no paper or food.", "Gloves are needed only for visitors.", "Normal paper notebooks can be used in the room."],
            ["Only six people are allowed, time must be booked, and the manager answers questions.", "Any number of people may enter without booking.", "Questions should be sent to the customer."],
        ],
        "retell": [
            "From 3 November, new rules protect the satellite in clean room 2 from dust and static electricity.",
            "Wear a clean suit and gloves, use a wrist strap, and do not bring paper or food.",
            "Only six people may be inside, so book a day ahead and call the manager if you have questions.",
        ],
        "find": [
            ("When do the new rules start?", "From Monday, 3 November"),
            ("What is being integrated in clean room 2?", "flight model of the satellite"),
            ("What is the aim of the new rules?", "protect the optics and the electronics"),
            ("What must you connect before you touch the flight hardware?", "wrist strap"),
            ("Why are paper and pencils not allowed?", "they produce particles"),
            ("Where are the clean room notebooks available?", "available at the entrance"),
            ("How many people can be in the room?", "limited to six"),
            ("How early must you book your time?", "at least one day in advance"),
        ],
        "parse": {
            "sentence": "From Monday, 3 November, new rules will apply in clean room 2, where the flight model of the satellite is being integrated.",
            "parts": [["From Monday, 3 November,", "с понедельника, 3 ноября"], ["new rules will apply in clean room 2", "новые правила будут действовать в чистой комнате 2"], [", where the flight model of the satellite is being integrated", "где сейчас собирают (пассив, длительное время: is being + V3) лётный образец спутника"]],
            "q": "What is happening in clean room 2 now?", "options": ["The flight model is being integrated", "The room is being cleaned", "A party is being prepared"], "answer": 0,
        },
    },
    {
        "id": "t-drawing-notes", "module": "doc-docs", "level": 2, "topic": "cad", "kind": "технические требования чертежа", "title": "Drawing notes: a machined flange",
        "paragraphs": [
            "Material: aluminum alloy 6061-T6. Unless otherwise specified, linear tolerances are ±0.1 mm and angular tolerances are ±0.5°. All dimensions are in millimeters and apply after surface treatment.",
            "Remove all burrs and break sharp edges to 0.2–0.5 mm. Surface roughness shall be Ra 3.2 µm on all surfaces, except the sealing face, which shall be Ra 0.8 µm. The sealing face must not have any radial scratches, because they can cause a leak.",
            "Threaded holes shall be inspected with a go/no-go gauge. After machining, the part shall be cleaned and anodized, but the threaded holes and the sealing face shall be masked. Mark the part number and the serial number with ink in the area shown in view A.",
        ],
        "paragraphsRu": [
            "Материал: алюминиевый сплав 6061-T6. Неуказанные предельные отклонения линейных размеров ±0,1 мм, угловых ±0,5°. Все размеры в миллиметрах и действительны после покрытия.",
            "Заусенцы удалить, острые кромки притупить на 0,2–0,5 мм. Шероховатость всех поверхностей Ra 3,2 мкм, кроме уплотнительной поверхности — Ra 0,8 мкм. На уплотнительной поверхности не допускаются радиальные риски, так как они могут вызвать негерметичность.",
            "Резьбовые отверстия контролировать калибрами «проходной — непроходной». После механической обработки деталь очистить и анодировать, резьбовые отверстия и уплотнительную поверхность защитить от покрытия. Обозначение и заводской номер детали маркировать краской в зоне, показанной на виде А.",
        ],
        "summaries": [
            ["The notes give the material, the general tolerances and the units.", "All tolerances on the drawing are ±1 mm.", "The dimensions apply before surface treatment."],
            ["Edges must be deburred, and the sealing face needs a finer finish without radial scratches.", "Sharp edges must stay sharp.", "The sealing face may be rougher than the other surfaces."],
            ["Threads are checked with gauges, the part is anodized with masking, and it is marked.", "The threaded holes must be anodized too.", "The part number is engraved on the sealing face."],
        ],
        "retell": [
            "The flange is made of 6061-T6 aluminum, with general tolerances of 0.1 millimeters and half a degree.",
            "Remove burrs, keep Ra 3.2 everywhere and Ra 0.8 on the sealing face, without radial scratches.",
            "Check the threads with gauges, anodize the part with masking, and mark it in the area shown in view A.",
        ],
        "find": [
            ("What alloy is the flange made of?", "6061-T6"),
            ("What are the linear tolerances if nothing else is given?", "linear tolerances are ±0.1 mm"),
            ("When do the dimensions apply?", "after surface treatment"),
            ("How much should sharp edges be broken?", "0.2–0.5 mm"),
            ("What is the roughness of the sealing face?", "Ra 0.8 µm"),
            ("Why must the sealing face have no radial scratches?", "can cause a leak"),
            ("How shall threaded holes be inspected?", "go/no-go gauge"),
            ("Where should the part number be marked?", "in view A"),
        ],
        "parse": {
            "sentence": "Unless otherwise specified, linear tolerances are ±0.1 mm and angular tolerances are ±0.5°.",
            "parts": [["Unless otherwise specified", "если не указано иное (unless — если не)"], ["linear tolerances are ±0.1 mm", "линейные допуски — ±0,1 мм"], ["and angular tolerances are ±0.5°", "угловые допуски — ±0,5°"]],
            "q": "When do the ±0.1 mm tolerances apply?", "options": ["When no other tolerance is given", "Only for threaded holes", "Only before anodizing"], "answer": 0,
        },
    },
    {
        "id": "t-prepreg-storage", "module": "doc-docs", "level": 2, "topic": "mat", "kind": "техническое описание", "title": "Prepreg storage and handling",
        "paragraphs": [
            "The carbon/epoxy prepreg is supplied on rolls in sealed plastic bags. It shall be stored in a freezer at −18 °C or below. Under these conditions, the shelf life is 12 months from the date of manufacture.",
            "Before use, the sealed bag must stay at room temperature until it is fully thawed, usually six to eight hours for a full roll. If the bag is opened while it is still cold, water from the air will condense on the material and can cause voids in the laminate.",
            "The out-life of the prepreg is 30 days at 23 °C. Every time a roll is taken out of the freezer, write the date and the hour on the label. Material that has passed its shelf life or its out-life may be used only after a new test of tack and gel time.",
        ],
        "paragraphsRu": [
            "Углеэпоксидный препрег поставляется в рулонах в запаянных полиэтиленовых пакетах. Его необходимо хранить в морозильной камере при −18 °C или ниже. В этих условиях срок хранения — 12 месяцев с даты изготовления.",
            "Перед использованием запаянный пакет должен лежать при комнатной температуре до полного размораживания — обычно шесть–восемь часов для целого рулона. Если вскрыть пакет, пока он ещё холодный, влага из воздуха сконденсируется на материале и может вызвать поры в ламинате.",
            "Жизнеспособность препрега вне морозильной камеры — 30 суток при 23 °C. Каждый раз, когда рулон достают из морозильной камеры, записывайте на этикетке дату и час. Материал с истёкшим сроком хранения или жизнеспособности допускается к применению только после повторной проверки липкости и времени гелеобразования.",
        ],
        "summaries": [
            ["The prepreg is kept sealed in a freezer and lasts 12 months.", "The prepreg is stored at room temperature.", "The shelf life is 12 days."],
            ["The bag must warm up before opening, or moisture can cause voids.", "The bag should be opened while it is still cold.", "Moisture improves the quality of the laminate."],
            ["Time outside the freezer is limited and recorded, and expired material needs a new test.", "Expired material must always be thrown away without testing.", "There is no limit on the time outside the freezer."],
        ],
        "retell": [
            "The prepreg is stored sealed in a freezer at minus 18 degrees and lasts 12 months.",
            "Let the closed bag warm up for six to eight hours, or water will condense and cause voids.",
            "It can stay out for 30 days, so write down each time it is taken out; old material must be tested again.",
        ],
        "find": [
            ("How is the prepreg supplied?", "sealed plastic bags"),
            ("At what temperature shall the prepreg be stored?", "at −18 °C or below"),
            ("What is the shelf life?", "shelf life is 12 months"),
            ("How long does a full roll need to thaw?", "six to eight hours"),
            ("What happens if the bag is opened while it is cold?", "condense on the material"),
            ("What is the out-life at 23 °C?", "out-life of the prepreg is 30 days"),
            ("What must you write on the label?", "the date and the hour"),
            ("What test is needed before expired material can be used?", "test of tack and gel time"),
        ],
        "parse": {
            "sentence": "If the bag is opened while it is still cold, water from the air will condense on the material and can cause voids in the laminate.",
            "parts": [["If the bag is opened while it is still cold", "условие (пассив): если пакет вскрыть, пока он ещё холодный"], ["water from the air will condense on the material", "влага из воздуха сконденсируется на материале"], ["and can cause voids in the laminate", "и может вызвать поры в ламинате"]],
            "q": "What can cause voids in the laminate?", "options": ["Water that condenses on cold material", "A freezer at −18 °C", "Writing the date on the label"], "answer": 0,
        },
    },
    # ——— Машиностроение (field: "mech"): близнецы космических текстов — те же модули, уровни и жанры ———
    # темы: mach — станки и обработка, join — сварка, крепёж, сборка, hyd — гидравлика, maint — обслуживание
    {
        "id": "t-mech-lathe", "field": "mech", "module": "doc-structure", "level": 1, "topic": "mach", "kind": "статья", "title": "How a lathe turns a shaft",
        "paragraphs": [
            "A lathe is a machine tool that makes round parts, such as shafts, pins and bushings. The workpiece is held in a chuck and turns with the spindle. A cutting tool moves along the workpiece and removes metal in the form of chips.",
            "Three settings control the cut: the cutting speed, the feed rate and the depth of cut. A higher speed saves time, but the tool becomes hot and wears faster. For this reason, the operator usually removes most of the metal with a rough cut first and then makes a light finishing cut. The finishing cut gives the final size and a smooth surface.",
        ],
        "paragraphsRu": [
            "Токарный станок — это металлорежущий станок для изготовления круглых деталей, например валов, пальцев и втулок. Заготовку зажимают в патроне, и она вращается вместе со шпинделем. Резец движется вдоль заготовки и снимает металл в виде стружки.",
            "Резание определяют три параметра: скорость резания, подача и глубина резания. Более высокая скорость экономит время, но инструмент сильнее нагревается и быстрее изнашивается. Поэтому оператор обычно сначала снимает бóльшую часть металла черновым проходом, а затем делает лёгкий чистовой проход. Чистовой проход даёт окончательный размер и гладкую поверхность.",
        ],
        "summaries": [
            ["A lathe turns the workpiece while a tool removes metal to make round parts.", "A lathe is used only to make flat plates.", "The cutting tool turns with the spindle, and the workpiece stays still."],
            ["Speed, feed and depth of cut control the cut; a rough cut comes before a finishing cut.", "A higher cutting speed makes the tool last longer.", "The finishing cut removes most of the metal."],
        ],
        "retell": ["A lathe makes round parts: the workpiece turns in the chuck, and the tool cuts chips from it.", "Speed, feed and depth of cut control the cut, and the operator makes a rough cut first and a light finishing cut last."],
        "find": [("What kind of parts does a lathe make?", "makes round parts"), ("What holds the workpiece?", "held in a chuck"), ("In what form is the metal removed?", "in the form of chips"), ("What three settings control the cut?", "the cutting speed, the feed rate and the depth of cut"), ("What happens to the tool at a higher speed?", "wears faster"), ("What does the finishing cut give?", "the final size and a smooth surface")],
        "parse": {
            "sentence": "For this reason, the operator usually removes most of the metal with a rough cut first and then makes a light finishing cut.",
            "parts": [["For this reason,", "поэтому — связка с предыдущим предложением"], ["the operator usually removes most of the metal with a rough cut first", "сначала оператор снимает бóльшую часть металла черновым проходом"], ["and then makes a light finishing cut", "а затем делает лёгкий чистовой проход"]],
            "q": "What does the operator do first?", "options": ["Removes most of the metal with a rough cut", "Makes a light finishing cut", "Measures the final size"], "answer": 0,
        },
    },
    {
        "id": "t-mech-cylinder", "field": "mech", "module": "doc-structure", "level": 1, "topic": "hyd", "kind": "статья", "title": "How a hydraulic cylinder works",
        "paragraphs": [
            "A hydraulic cylinder turns the pressure of oil into a straight-line force. It consists of a tube, a piston and a piston rod. A pump sends oil into the cylinder, and the oil pushes the piston and the rod out.",
            "The force of the cylinder depends on two things: the oil pressure and the area of the piston. For example, a piston with an area of 20 square centimeters at 100 bar gives a force of about 20 kN. Seals on the piston and on the rod keep the oil inside. If the seals are worn, oil leaks, and the cylinder becomes slow and weak.",
        ],
        "paragraphsRu": [
            "Гидроцилиндр превращает давление масла в прямолинейное усилие. Он состоит из гильзы, поршня и штока. Насос подаёт масло в цилиндр, и масло выталкивает поршень со штоком.",
            "Усилие цилиндра зависит от двух величин: давления масла и площади поршня. Например, поршень площадью 20 квадратных сантиметров при 100 бар даёт усилие около 20 кН. Уплотнения на поршне и на штоке удерживают масло внутри. Если уплотнения изношены, масло подтекает, и цилиндр становится медленным и слабым.",
        ],
        "summaries": [
            ["A cylinder uses oil pressure from a pump to push a piston and a rod in a straight line.", "A hydraulic cylinder turns electricity into rotation.", "The piston pushes oil back into the pump to create force."],
            ["The force is pressure times piston area, and worn seals let oil leak and make the cylinder weak.", "The force does not depend on the piston area.", "Worn seals make the cylinder faster and stronger."],
        ],
        "retell": ["A hydraulic cylinder uses oil from a pump to push a piston and a rod in a straight line.", "Its force is pressure times piston area, and worn seals let oil leak and make it weak."],
        "find": [("What does a hydraulic cylinder turn the oil pressure into?", "straight-line force"), ("What are the main parts of a cylinder?", "a tube, a piston and a piston rod"), ("What sends oil into the cylinder?", "A pump sends oil"), ("What does the force depend on?", "the oil pressure and the area of the piston"), ("What force does a 20 cm² piston give at 100 bar?", "force of about 20 kN"), ("What keeps the oil inside?", "keep the oil inside"), ("What happens if the seals are worn?", "becomes slow and weak")],
        "parse": {
            "sentence": "If the seals are worn, oil leaks, and the cylinder becomes slow and weak.",
            "parts": [["If the seals are worn,", "условие (пассив are worn): если уплотнения изношены"], ["oil leaks,", "масло подтекает"], ["and the cylinder becomes slow and weak", "и цилиндр становится медленным и слабым"]],
            "q": "What happens when the seals are worn?", "options": ["Oil leaks and the cylinder becomes weak", "The piston area becomes larger", "The pump stops at once"], "answer": 0,
        },
    },
    {
        "id": "t-mech-bearings", "field": "mech", "module": "doc-structure", "level": 1, "topic": "maint", "kind": "статья", "title": "Rolling bearings: why they fail",
        "paragraphs": [
            "A rolling bearing lets a shaft turn with very little friction. It has an inner ring, an outer ring, and balls or rollers between them. A bearing cage keeps the balls evenly spaced.",
            "Most bearings do not fail because they are old. They fail because of poor lubrication, dirt, misalignment or wrong mounting. A bearing that is beginning to fail often becomes noisy and hot. Regular checks of temperature and vibration help to find the problem early, before the machine stops.",
        ],
        "paragraphsRu": [
            "Подшипник качения позволяет валу вращаться с очень малым трением. У него есть внутреннее кольцо, наружное кольцо и шарики или ролики между ними. Сепаратор удерживает шарики на равном расстоянии друг от друга.",
            "Большинство подшипников выходит из строя не от старости. Они отказывают из-за плохой смазки, грязи, несоосности или неправильного монтажа. Подшипник, который начинает отказывать, часто шумит и греется. Регулярные проверки температуры и вибрации помогают обнаружить неисправность рано, до того как станок остановится.",
        ],
        "summaries": [
            ["A bearing has two rings with balls or rollers between them, so a shaft turns easily.", "A bearing increases friction to stop the shaft.", "The cage is the outer cover of the machine."],
            ["Bearings usually fail because of lubrication, dirt or mounting problems, and checks find this early.", "Bearings almost always fail simply because they are old.", "A failing bearing becomes quiet and cold."],
        ],
        "retell": ["A rolling bearing has an inner and an outer ring with balls or rollers between them, so the shaft turns easily.", "Bearings usually fail because of bad lubrication, dirt, misalignment or mounting, and temperature and vibration checks find the problem early."],
        "find": [("What does a rolling bearing let a shaft do?", "turn with very little friction"), ("What is between the inner and the outer ring?", "balls or rollers between them"), ("What keeps the balls evenly spaced?", "bearing cage"), ("Why do most bearings fail?", "poor lubrication, dirt, misalignment or wrong mounting"), ("What happens to a bearing that is beginning to fail?", "noisy and hot"), ("What checks help to find the problem early?", "checks of temperature and vibration")],
        "parse": {
            "sentence": "Regular checks of temperature and vibration help to find the problem early, before the machine stops.",
            "parts": [["Regular checks of temperature and vibration", "подлежащее: регулярные проверки температуры и вибрации"], ["help to find the problem early", "помогают обнаружить неисправность рано"], [", before the machine stops", "до того как станок остановится"]],
            "q": "What helps to find the problem early?", "options": ["Regular checks of temperature and vibration", "A new bearing cage", "Stopping the machine every day"], "answer": 0,
        },
    },
    {
        "id": "t-mech-oil-change", "field": "mech", "module": "doc-structure", "level": 1, "topic": "maint", "kind": "рабочая инструкция", "title": "Work instruction: changing the gearbox oil",
        "paragraphs": [
            "This instruction applies to the main gearbox of conveyor line 3. The oil shall be changed every 4000 operating hours or once a year, whichever comes first. The work takes about one hour and needs two people.",
            "Before you start, stop the conveyor and lock out the main switch with your personal lock. Let the gearbox cool down for at least 30 minutes, because hot oil can burn your skin. Put an oil tray under the drain plug, remove the plug and let the old oil drain completely.",
            "Clean the magnetic drain plug and look for metal particles on it. A few fine particles are normal, but large pieces must be reported to the maintenance supervisor. Fit the plug with a new washer and fill the gearbox with 12 liters of fresh oil until the level is in the middle of the sight glass. Write the date and the hours in the maintenance log.",
        ],
        "paragraphsRu": [
            "Настоящая инструкция относится к главному редуктору конвейерной линии 3. Масло необходимо менять каждые 4000 моточасов или раз в год — смотря что наступит раньше. Работа занимает около часа и выполняется вдвоём.",
            "Перед началом остановите конвейер и заблокируйте главный выключатель своим личным замком. Дайте редуктору остыть не менее 30 минут: горячее масло может обжечь кожу. Поставьте поддон под сливную пробку, выверните пробку и дайте старому маслу полностью стечь.",
            "Очистите магнитную сливную пробку и осмотрите её на наличие металлических частиц. Немного мелких частиц — норма, но о крупных кусочках нужно сообщить мастеру службы ремонта. Установите пробку с новой шайбой и залейте в редуктор 12 литров свежего масла, пока уровень не дойдёт до середины смотрового стекла. Запишите дату и моточасы в журнал обслуживания.",
        ],
        "summaries": [
            ["The instruction is for the conveyor gearbox, and the oil is changed every 4000 hours or yearly.", "The oil is changed every week by one person.", "The instruction is for all machines in the factory."],
            ["Stop and lock out the conveyor, let the gearbox cool, and drain the old oil.", "Drain the oil while it is still hot to save time.", "The conveyor can keep running during the oil change."],
            ["Check the plug for metal, refit it with a new washer, add fresh oil and record the work.", "Large metal pieces on the plug are normal and need no report.", "The old washer should always be used again."],
        ],
        "retell": [
            "The gearbox of conveyor line 3 gets new oil every 4000 hours or once a year.",
            "Stop and lock out the conveyor, wait 30 minutes, and drain the old oil into a tray.",
            "Check the magnetic plug for metal, fit a new washer, add 12 liters of oil and write it in the log.",
        ],
        "find": [
            ("How often shall the oil be changed?", "every 4000 operating hours"),
            ("How many people are needed?", "needs two people"),
            ("What must you lock out?", "lock out the main switch"),
            ("How long should the gearbox cool down?", "at least 30 minutes"),
            ("Why must you wait before draining the oil?", "hot oil can burn your skin"),
            ("What must be reported to the supervisor?", "large pieces must be reported"),
            ("How much fresh oil is needed?", "12 liters of fresh oil"),
            ("Where do you write the date and the hours?", "in the maintenance log"),
        ],
        "parse": {
            "sentence": "Fit the plug with a new washer and fill the gearbox with 12 liters of fresh oil until the level is in the middle of the sight glass.",
            "parts": [["Fit the plug with a new washer", "повелительное: установите пробку с новой шайбой"], ["and fill the gearbox with 12 liters of fresh oil", "и залейте в редуктор 12 литров свежего масла"], ["until the level is in the middle of the sight glass", "пока уровень не дойдёт до середины смотрового стекла (until — пока не)"]],
            "q": "When do you stop filling the oil?", "options": ["When the level is in the middle of the sight glass", "When the oil starts to leak", "After exactly one hour"], "answer": 0,
        },
    },
    {
        "id": "t-mech-tool-wear", "field": "mech", "module": "doc-abstract", "level": 2, "topic": "mach", "kind": "аннотация", "title": "Tool life of coated carbide inserts with minimum quantity lubrication",
        "paragraphs": [
            "Flood coolant can improve tool life in milling, but it is expensive to buy, filter and dispose of, and it can be harmful to operators. In this study, we compare dry milling, flood coolant and minimum quantity lubrication (MQL) when face milling a 42CrMo4 steel with coated carbide inserts.",
            "All tests were carried out on a vertical machining center at a cutting speed of 200 m/min and a feed of 0.15 mm per tooth. Flank wear was measured with an optical microscope after every ten passes, and the end of tool life was defined as a flank wear of 0.3 mm. The surface roughness of the workpiece was measured at the same intervals.",
            "With MQL, the tool life was 38 minutes, compared with 41 minutes for flood coolant and 22 minutes for dry milling. The surface roughness was similar for MQL and flood coolant, about Ra 0.9 µm. The results suggest that MQL can replace flood coolant in this operation and reduce the use of cutting fluid by more than 95 percent.",
        ],
        "paragraphsRu": [
            "Обильный полив СОЖ может повышать стойкость инструмента при фрезеровании, но жидкость дорого покупать, очищать и утилизировать, к тому же она может вредить здоровью операторов. В этом исследовании мы сравниваем фрезерование всухую, с обильным поливом СОЖ и с минимальной смазкой (MQL) при торцовом фрезеровании стали 42CrMo4 твердосплавными пластинами с покрытием.",
            "Все испытания проводили на вертикальном обрабатывающем центре при скорости резания 200 м/мин и подаче 0,15 мм на зуб. Износ по задней поверхности измеряли оптическим микроскопом через каждые десять проходов; критерием затупления принимали износ по задней поверхности 0,3 мм. Шероховатость поверхности заготовки измеряли с тем же интервалом.",
            "С MQL стойкость составила 38 минут — против 41 минуты с обильным поливом и 22 минут всухую. Шероховатость поверхности с MQL и с поливом оказалась близкой, около Ra 0,9 мкм. Результаты позволяют предположить, что в этой операции MQL может заменить обильный полив и сократить расход СОЖ более чем на 95 процентов.",
        ],
        "summaries": [
            ["The study compares dry milling, flood coolant and MQL because coolant is costly and can be harmful.", "The study shows how to make new carbide inserts.", "The study compares different steels without any cooling."],
            ["Tests on a machining center measured flank wear and roughness at regular intervals.", "Tool life ended when the insert broke into pieces.", "Wear was measured only once at the end of the test."],
            ["MQL gave almost the same tool life and surface as flood coolant with far less fluid.", "Dry milling gave the longest tool life.", "MQL made the surface much rougher than flood coolant."],
        ],
        "retell": [
            "Coolant is costly and can be harmful, so the authors compare dry milling, flood coolant and minimum lubrication.",
            "They milled steel at 200 meters per minute and measured flank wear every ten passes, with 0.3 millimeters as the end of tool life.",
            "MQL gave 38 minutes of tool life, close to 41 with coolant and much better than 22 dry, so it can replace flood coolant.",
        ],
        "find": [
            ("Why is flood coolant a problem?", "expensive to buy, filter and dispose of"),
            ("What steel was milled?", "42CrMo4 steel"),
            ("What was the cutting speed?", "cutting speed of 200 m/min"),
            ("How was flank wear measured?", "optical microscope"),
            ("What flank wear defined the end of tool life?", "flank wear of 0.3 mm"),
            ("What was the tool life with MQL?", "tool life was 38 minutes"),
            ("What was the tool life in dry milling?", "22 minutes for dry milling"),
            ("How much can MQL reduce the use of cutting fluid?", "more than 95 percent"),
        ],
        "parse": {
            "sentence": "Flank wear was measured with an optical microscope after every ten passes, and the end of tool life was defined as a flank wear of 0.3 mm.",
            "parts": [["Flank wear was measured with an optical microscope", "пассив: износ по задней поверхности измеряли оптическим микроскопом"], ["after every ten passes", "через каждые десять проходов"], ["and the end of tool life was defined as a flank wear of 0.3 mm", "пассив: критерием затупления принимали износ 0,3 мм"]],
            "q": "When did the tool life end?", "options": ["When the flank wear reached 0.3 mm", "After ten passes", "When the roughness reached Ra 0.9 µm"], "answer": 0,
        },
    },
    {
        "id": "t-mech-bolt-loosening", "field": "mech", "module": "doc-abstract", "level": 2, "topic": "join", "kind": "аннотация", "title": "Self-loosening of bolted joints under transverse vibration",
        "paragraphs": [
            "Bolted joints in machines and vehicles often work under vibration, and they can lose their clamp load over time. This paper investigates how three locking methods affect the self-loosening of M10 bolts of property class 8.8 under transverse vibration.",
            "The joints were tightened to a preload of 28 kN and tested on a Junker-type machine, which moves the clamped plates sideways by ±0.4 mm at 12.5 Hz. Plain joints were compared with joints using a split lock washer, a nylon-insert lock nut and a liquid thread locker. The clamp load was recorded continuously with a load washer.",
            "Plain joints lost 80 percent of their preload within 300 cycles. The split lock washer gave almost no improvement, whereas the lock nut kept about 60 percent of the preload after 2000 cycles. The thread locker performed best: the loss of preload was less than 10 percent. The authors conclude that split washers should not be used to prevent loosening under transverse vibration.",
        ],
        "paragraphsRu": [
            "Болтовые соединения в машинах и транспортных средствах часто работают в условиях вибрации и со временем могут терять усилие затяжки. В статье исследуется, как три способа стопорения влияют на самоотвинчивание болтов M10 класса прочности 8.8 при поперечной вибрации.",
            "Соединения затягивали до усилия 28 кН и испытывали на машине типа Юнкера, которая смещает стянутые пластины вбок на ±0,4 мм с частотой 12,5 Гц. Соединения без стопорения сравнивали с соединениями с пружинной шайбой, гайкой с нейлоновым кольцом и жидким фиксатором резьбы. Усилие затяжки непрерывно регистрировали кольцевым (шайбовым) датчиком силы.",
            "Соединения без стопорения потеряли 80 процентов затяжки за 300 циклов. Пружинная шайба почти ничего не улучшила, тогда как самоконтрящаяся гайка сохранила около 60 процентов затяжки после 2000 циклов. Лучше всех показал себя фиксатор резьбы: потеря затяжки составила менее 10 процентов. Авторы делают вывод, что пружинные шайбы не следует применять для защиты от самоотвинчивания при поперечной вибрации.",
        ],
        "summaries": [
            ["The paper studies how locking methods stop bolts from loosening under vibration.", "The paper explains how to make M10 bolts.", "The paper shows that vibration increases the clamp load."],
            ["Preloaded joints with different locking methods were shaken sideways, and the clamp load was recorded.", "The joints were tested without any preload.", "The clamp load was measured only once at the end."],
            ["Plain joints and split washers loosened fast, the lock nut helped, and thread locker worked best.", "The split lock washer was the best method.", "The thread locker lost most of its preload."],
        ],
        "retell": [
            "The paper studies how three locking methods stop M10 bolts from loosening under sideways vibration.",
            "Joints preloaded to 28 kilonewtons were shaken sideways on a Junker machine, and the clamp load was recorded all the time.",
            "Plain joints and split washers lost their preload fast, the lock nut kept 60 percent, and thread locker lost less than 10 percent.",
        ],
        "find": [
            ("What property class were the bolts?", "property class 8.8"),
            ("What preload were the joints tightened to?", "preload of 28 kN"),
            ("How far were the plates moved?", "sideways by ±0.4 mm"),
            ("What measured the clamp load?", "with a load washer"),
            ("How fast did plain joints lose their preload?", "within 300 cycles"),
            ("How much preload did the lock nut keep?", "about 60 percent of the preload"),
            ("Which locking method performed best?", "thread locker performed best"),
            ("What should not be used to prevent loosening?", "split washers should not be used"),
        ],
        "parse": {
            "sentence": "The split lock washer gave almost no improvement, whereas the lock nut kept about 60 percent of the preload after 2000 cycles.",
            "parts": [["The split lock washer gave almost no improvement,", "пружинная шайба почти ничего не улучшила"], ["whereas", "тогда как — противопоставление"], ["the lock nut kept about 60 percent of the preload after 2000 cycles", "самоконтрящаяся гайка сохранила около 60% затяжки после 2000 циклов"]],
            "q": "Which method kept about 60 percent of the preload?", "options": ["The lock nut", "The split lock washer", "The plain joint"], "answer": 0,
        },
    },
    {
        "id": "t-mech-pump-test", "field": "mech", "module": "doc-grammar", "level": 2, "topic": "hyd", "kind": "методика", "title": "Test method: performance test of a gear pump",
        "paragraphs": [
            "After repair, every gear pump is subjected to a performance test on the hydraulic test bench before it is returned to the customer. The test is carried out with ISO VG 46 hydraulic oil at a temperature of 50 ± 3 °C, because the viscosity of the oil strongly affects the results.",
            "The pump is driven by an electric motor at its rated speed of 1500 rpm. The outlet pressure is increased in steps of 50 bar from zero to the rated pressure of 200 bar by a loading valve. At each step, the flow rate is measured with a gear-type flow meter, and the input torque is recorded.",
            "The volumetric efficiency is calculated as the measured flow divided by the theoretical flow. A pump is accepted if its volumetric efficiency at rated pressure is at least 90 percent and no external leakage is found. Pumps that do not meet this criterion are dismantled again, and the worn parts are replaced.",
        ],
        "paragraphsRu": [
            "После ремонта каждый шестерённый насос проходит испытания на рабочие характеристики на гидравлическом стенде, прежде чем его вернут заказчику. Испытания проводят на гидравлическом масле ISO VG 46 при температуре 50 ± 3 °C, поскольку вязкость масла сильно влияет на результаты.",
            "Насос приводится электродвигателем с номинальной частотой вращения 1500 об/мин. Давление на выходе нагрузочным клапаном повышают ступенями по 50 бар от нуля до номинального давления 200 бар. На каждой ступени расход измеряют шестерённым расходомером и регистрируют крутящий момент на входе.",
            "Объёмный КПД рассчитывают как отношение измеренной подачи к теоретической. Насос принимают, если его объёмный КПД при номинальном давлении не менее 90 процентов и наружных утечек нет. Насосы, не удовлетворяющие этому критерию, снова разбирают и заменяют изношенные детали.",
        ],
        "summaries": [
            ["Repaired gear pumps are tested on a bench with oil at a controlled temperature.", "Repaired pumps are sent to the customer without any test.", "The oil temperature does not matter in this test."],
            ["The pump runs at rated speed while the pressure is raised step by step and flow and torque are measured.", "The pressure is raised at once to 500 bar.", "The pump is turned by hand during the test."],
            ["A volumetric efficiency of at least 90 percent with no leaks is needed; otherwise the pump is repaired again.", "Pumps with 70 percent efficiency are accepted.", "Pumps that fail the test are sent to the customer anyway."],
        ],
        "retell": [
            "Every repaired gear pump is tested on the bench with oil at 50 degrees, because viscosity affects the results.",
            "The pump runs at 1500 rpm, the pressure goes up in 50 bar steps to 200 bar, and flow and torque are measured.",
            "The pump passes if its volumetric efficiency is at least 90 percent and it does not leak; if not, it is repaired again.",
        ],
        "find": [
            ("When is the performance test carried out?", "After repair"),
            ("What oil is used?", "ISO VG 46"),
            ("Why is the oil temperature controlled?", "viscosity of the oil strongly affects"),
            ("What is the rated speed of the pump?", "rated speed of 1500 rpm"),
            ("In what steps is the pressure increased?", "in steps of 50 bar"),
            ("What is the flow rate measured with?", "gear-type flow meter"),
            ("How is the volumetric efficiency calculated?", "divided by the theoretical flow"),
            ("What happens to pumps that do not meet the criterion?", "dismantled again"),
        ],
        "parse": {
            "sentence": "The outlet pressure is increased in steps of 50 bar from zero to the rated pressure of 200 bar by a loading valve.",
            "parts": [["The outlet pressure", "подлежащее (цепочка): давление на выходе"], ["is increased in steps of 50 bar from zero to the rated pressure of 200 bar", "пассив: повышается ступенями по 50 бар от нуля до номинальных 200 бар"], ["by a loading valve", "чем: нагрузочным клапаном (by + исполнитель действия)"]],
            "q": "What increases the outlet pressure?", "options": ["A loading valve", "The electric motor", "The flow meter"], "answer": 0,
        },
    },
    {
        "id": "t-mech-bolt-req", "field": "mech", "module": "doc-standard", "level": 3, "topic": "join", "kind": "требования", "title": "Assembly requirements for bolted joints of a press frame",
        "paragraphs": [
            "All structural bolted joints of the press frame shall use bolts of property class 10.9 with hardened washers under both the bolt head and the nut. Bolts shall be tightened with a calibrated torque wrench to the values given in Table 3, which correspond to a preload of approximately 70 percent of the proof load of the bolt. Impact wrenches may be used for running down the bolts, but not for final tightening.",
            "Joints with more than four bolts shall be tightened in a cross pattern in at least two passes: first to 50 percent and then to 100 percent of the specified torque. After final tightening, each bolt should be marked with a paint line across the head and the washer, so that any later rotation can be detected during inspection.",
            "Bolts of property class 10.9 that have been tightened to full preload shall not be reused. Thread lubricant may be applied only if it is specified in the drawing, because it changes the relationship between torque and preload by up to 30 percent. Any joint in which the specified torque cannot be reached shall be reported to the design department before the press is put into operation.",
        ],
        "paragraphsRu": [
            "Во всех силовых болтовых соединениях рамы пресса должны применяться болты класса прочности 10.9 с закалёнными шайбами под головкой болта и под гайкой. Болты должны затягиваться тарированным динамометрическим ключом до значений из таблицы 3, которые соответствуют усилию затяжки примерно 70 процентов пробной нагрузки болта. Ударные гайковёрты допускается применять для предварительного заворачивания болтов, но не для окончательной затяжки.",
            "Соединения, в которых более четырёх болтов, должны затягиваться крест-накрест не менее чем в два прохода: сначала до 50, затем до 100 процентов заданного момента. После окончательной затяжки каждый болт рекомендуется пометить краской — линией через головку и шайбу, чтобы при осмотре можно было обнаружить последующий поворот.",
            "Болты класса прочности 10.9, уже затянутые на полное усилие, повторно применять запрещается. Смазку резьбы допускается наносить, только если она указана на чертеже, поскольку она меняет соотношение между моментом и усилием затяжки на величину до 30 процентов. О любом соединении, в котором не удаётся достичь заданного момента, необходимо сообщить в конструкторский отдел до ввода пресса в эксплуатацию.",
        ],
        "summaries": [
            ["Frame joints need 10.9 bolts with hardened washers, tightened by a calibrated torque wrench to Table 3.", "Any bolts may be used if they fit the holes.", "Impact wrenches must be used for final tightening."],
            ["Large joints are tightened crosswise in two passes, and bolts should be paint-marked.", "All bolts are tightened to full torque in one pass, one after another.", "Paint marks are forbidden on bolt heads."],
            ["Tightened 10.9 bolts must not be reused, lubricant needs the drawing, and problem joints must be reported.", "Bolts of class 10.9 may be reused many times.", "Lubricant has no effect on the preload."],
        ],
        "retell": [
            "Frame joints use 10.9 bolts with hardened washers, tightened with a calibrated torque wrench to about 70 percent of the proof load.",
            "Joints with more than four bolts are tightened crosswise in two passes, and each bolt gets a paint mark.",
            "Tightened 10.9 bolts are not reused, lubricant is used only if the drawing says so, and problem joints are reported.",
        ],
        "find": [
            ("What must be placed under the bolt head and the nut?", "hardened washers"),
            ("What tool shall be used for tightening?", "calibrated torque wrench"),
            ("What preload do the values in Table 3 correspond to?", "approximately 70 percent of the proof load"),
            ("What may impact wrenches be used for?", "running down the bolts"),
            ("In what pattern shall large joints be tightened?", "in a cross pattern"),
            ("Why should each bolt be marked with a paint line?", "later rotation can be detected"),
            ("Which bolts shall not be reused?", "shall not be reused"),
            ("How much can thread lubricant change the torque–preload relationship?", "by up to 30 percent"),
            ("Who must be told if the torque cannot be reached?", "reported to the design department"),
        ],
        "parse": {
            "sentence": "Bolts of property class 10.9 that have been tightened to full preload shall not be reused.",
            "parts": [["Bolts of property class 10.9", "подлежащее: болты класса прочности 10.9"], ["that have been tightened to full preload", "уточнение: которые уже затянуты на полное усилие (пассив в Present Perfect)"], ["shall not be reused", "обязательный запрет: повторно не применять"]],
            "q": "Which bolts must not be used again?", "options": ["10.9 bolts already tightened to full preload", "All new bolts", "Bolts with paint marks"], "answer": 0,
        },
    },
    {
        "id": "t-mech-weld-inspection", "field": "mech", "module": "doc-standard", "level": 2, "topic": "join", "kind": "отчёт о контроле", "title": "Inspection report: welds of a machine base frame",
        "paragraphs": [
            "Report number: IR-2026-118. Item: welded base frame for a grinding machine, drawing WF-310, revision A. Inspection method: visual inspection of all welds, followed by dye penetrant testing of the four lifting lugs. Acceptance criteria: quality level C according to ISO 5817.",
            "Most welds were found to be acceptable. However, on weld 14, an undercut 0.8 mm deep and 25 mm long was measured, while the maximum allowed depth is 0.5 mm. Weld spatter was found near weld 9, and it was removed by grinding during the inspection. No cracks were detected on the lifting lugs.",
            "Disposition: weld 14 shall be repaired by grinding the undercut area and adding one more weld pass, and then inspected again. The welder confirmed that the welding current had been set too high for the plate thickness of 6 mm. Status: the frame is on hold until the repair is accepted by the quality inspector.",
        ],
        "paragraphsRu": [
            "Номер отчёта: IR-2026-118. Изделие: сварная станина шлифовального станка, чертёж WF-310, редакция A. Метод контроля: визуальный контроль всех швов, затем капиллярный контроль четырёх грузовых проушин. Критерии приёмки: уровень качества C по ISO 5817.",
            "Большинство швов признаны годными. Однако на шве 14 измерен подрез глубиной 0,8 мм и длиной 25 мм, тогда как максимально допустимая глубина — 0,5 мм. Возле шва 9 обнаружены брызги металла; их удалили шлифовкой во время контроля. Трещин на грузовых проушинах не выявлено.",
            "Решение: шов 14 исправить — зашлифовать зону подреза и наложить ещё один проход, затем проконтролировать повторно. Сварщик подтвердил, что сварочный ток был выставлен слишком большим для толщины листа 6 мм. Статус: станина задержана до приёмки исправления контролёром ОТК.",
        ],
        "summaries": [
            ["The report gives the item, the inspection methods and the acceptance criteria.", "The report describes how the frame was designed.", "Only the lifting lugs were inspected."],
            ["One weld had an undercut that was too deep, spatter was removed, and no cracks were found.", "Cracks were found on all four lifting lugs.", "The undercut on weld 14 was within the limit."],
            ["Weld 14 will be repaired and checked again; the current was too high, and the frame is on hold.", "The frame was shipped to the customer without repair.", "The cause was a wrong drawing revision."],
        ],
        "retell": [
            "Report IR-2026-118 covers the welds of a grinding machine base frame, checked visually and with dye penetrant.",
            "One weld had an undercut of 0.8 millimeters, more than the allowed 0.5, but no cracks were found.",
            "Weld 14 will be ground and welded again, the current was too high, and the frame waits until the repair is accepted.",
        ],
        "find": [
            ("What machine is the frame for?", "for a grinding machine"),
            ("Which parts were tested with dye penetrant?", "four lifting lugs"),
            ("What quality level is required?", "quality level C"),
            ("How deep was the undercut on weld 14?", "0.8 mm deep"),
            ("What is the maximum allowed depth?", "maximum allowed depth is 0.5 mm"),
            ("How was the spatter removed?", "removed by grinding"),
            ("Why did the undercut appear?", "current had been set too high"),
            ("Who must accept the repair?", "accepted by the quality inspector"),
        ],
        "parse": {
            "sentence": "However, on weld 14, an undercut 0.8 mm deep and 25 mm long was measured, while the maximum allowed depth is 0.5 mm.",
            "parts": [["However, on weld 14,", "однако на шве 14"], ["an undercut 0.8 mm deep and 25 mm long was measured", "пассив: измерен подрез глубиной 0,8 мм и длиной 25 мм (размеры стоят после слова)"], ["while the maximum allowed depth is 0.5 mm", "тогда как максимально допустимая глубина — 0,5 мм"]],
            "q": "Is the undercut on weld 14 acceptable?", "options": ["No, it is deeper than allowed", "Yes, it is within the limit", "It was not measured"], "answer": 0,
        },
    },
    {
        "id": "t-mech-contamination", "field": "mech", "module": "doc-speed", "level": 3, "topic": "maint", "kind": "обсуждение", "title": "Contamination: the main cause of hydraulic failures",
        "paragraphs": [
            "Industry surveys repeatedly show that most failures of hydraulic systems are caused by contaminated fluid rather than by design faults. Solid particles, water and air all reduce the service life of components, but hard particles of about the same size as the internal clearances, typically 5 to 15 µm, are the most damaging, because they enter the gaps between moving parts and cause abrasive wear.",
            "Water is often underestimated. Even a small amount of free water reduces the lubricating ability of the oil, promotes corrosion and can lead to cavitation damage in pumps. Air entering through a loose suction fitting has a similar effect and is usually noticed first as a loud noise from the pump.",
            "Cleanliness is therefore specified as a code according to ISO 4406, which is based on the number of particles of 4, 6 and 14 µm and larger per milliliter of fluid. For a system with servo valves, a typical target is 16/14/11. Lowering the code by one step roughly halves the number of particles, and in practice the cost of better filtration is usually much smaller than the cost of unplanned downtime and replaced components.",
        ],
        "paragraphsRu": [
            "Отраслевые обзоры раз за разом показывают, что большинство отказов гидросистем вызвано загрязнённой рабочей жидкостью, а не ошибками конструкции. Твёрдые частицы, вода и воздух — все они сокращают срок службы элементов, но опаснее всего твёрдые частицы размером примерно с внутренние зазоры, обычно 5–15 мкм: они попадают в щели между движущимися деталями и вызывают абразивный износ.",
            "Воду часто недооценивают. Даже небольшое количество свободной воды ухудшает смазывающую способность масла, способствует коррозии и может привести к кавитационному разрушению насосов. Воздух, подсасываемый через неплотный штуцер всасывающей линии, действует так же, и первым признаком обычно бывает громкий шум насоса.",
            "Поэтому чистоту жидкости задают кодом по ISO 4406, который строится по числу частиц размером 4, 6 и 14 мкм и более в миллилитре жидкости. Для системы с сервоклапанами типичная цель — 16/14/11. Снижение кода на одну ступень примерно вдвое уменьшает число частиц, а на практике лучшая фильтрация обычно обходится намного дешевле внепланового простоя и замены элементов.",
        ],
        "summaries": [
            ["Most hydraulic failures come from contamination, and particles the size of the clearances are the worst.", "Most hydraulic failures are caused by design faults.", "Very large particles are the most dangerous because they block the pipes."],
            ["Water and air also damage the system, causing poor lubrication, corrosion, cavitation and noise.", "A little water in the oil improves lubrication.", "Air in the oil makes the pump quieter."],
            ["Cleanliness is set by an ISO 4406 code, and better filtration is cheaper than downtime.", "ISO 4406 measures the viscosity of the oil.", "Better filtration usually costs more than unplanned downtime."],
        ],
        "retell": [
            "Most hydraulic failures come from dirty fluid, and particles of 5 to 15 micrometers that fit into the clearances cause the most wear.",
            "Water reduces lubrication and causes corrosion and cavitation, and air from a loose fitting makes the pump noisy.",
            "Cleanliness is given as an ISO 4406 code such as 16/14/11, and good filtration costs less than downtime.",
        ],
        "find": [
            ("What causes most failures of hydraulic systems?", "contaminated fluid"),
            ("What particle size is the most damaging?", "typically 5 to 15 µm"),
            ("What kind of wear do hard particles cause?", "abrasive wear"),
            ("What can water lead to in pumps?", "cavitation damage in pumps"),
            ("How is air in the system usually noticed first?", "loud noise from the pump"),
            ("Which standard gives the cleanliness code?", "according to ISO 4406"),
            ("What is a typical target for a system with servo valves?", "16/14/11"),
            ("What happens when the code is lowered by one step?", "roughly halves the number of particles"),
        ],
        "parse": {
            "sentence": "Solid particles, water and air all reduce the service life of components, but hard particles of about the same size as the internal clearances, typically 5 to 15 µm, are the most damaging, because they enter the gaps between moving parts and cause abrasive wear.",
            "parts": [["Solid particles, water and air all reduce the service life of components,", "первая часть: твёрдые частицы, вода и воздух — все сокращают срок службы элементов"], ["but hard particles of about the same size as the internal clearances, typically 5 to 15 µm,", "подлежащее второй части: твёрдые частицы размером с внутренние зазоры, обычно 5–15 мкм"], ["are the most damaging, because they enter the gaps … and cause abrasive wear", "сказуемое: опаснее всего, потому что попадают в зазоры и вызывают абразивный износ"]],
            "q": "Why are particles of 5 to 15 µm the most damaging?", "options": ["They enter the gaps between moving parts", "They make the oil too thick", "They block the suction fitting"], "answer": 0,
        },
    },
]


def split_sentences(text: str) -> list[str]:
    protected = re.sub(r"\b(e\.g|i\.e|etc|Mr|Mrs|Dr|vs|No)\.", lambda m: m.group(0).replace(".", "\0"), re.sub(r"\s+", " ", text))
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])", protected)
    return [p.replace("\0", ".").strip() for p in parts if re.search(r"[A-Za-z]", p)]


def slug(w: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", w.lower()).strip("-")


def read_source(name: str) -> str:
    """Списки NGSL местами в cp1252 (café) — пробуем UTF-8, иначе cp1252."""
    raw = (SRC / name).read_bytes()
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252")


def lemma_forms() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for name in ["NGSL_12_lemmatized_for_teaching.csv", "NAWL_12_lemmatized_for_teaching.csv"]:
        for line in read_source(name).splitlines():
            if not line.strip() or line.startswith("#"):
                continue
            forms = [f.strip().lower() for f in line.split(",") if f.strip()]
            if forms:
                out.setdefault(forms[0], [])
                out[forms[0]] += [f for f in forms[1:] if f != forms[0] and f not in out[forms[0]]]
    return out


def ngsl_ranks() -> dict[str, int]:
    ranks = {}
    for i, line in enumerate((SRC / "NGSL_12_stats.csv").read_text(encoding="utf-8").splitlines()):
        if i == 0 or not line.strip():
            continue
        lemma, rank, *_ = line.split(",")
        ranks[lemma.strip().lower()] = int(rank)
    return ranks


def read_pairs(name: str) -> list[list[str]]:
    rows = []
    for line in (DICT / name).read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        rows.append([x.strip() for x in line.split("|")])
    return rows


def band_of(rank: int) -> str:
    return "ngsl1" if rank <= 500 else "ngsl2" if rank <= 1000 else "ngsl3" if rank <= 2000 else "ngsl4"


# Тема термина → специальность. Остальные темы (mat, test, cad, sens, doc) — общие.
TERM_FIELD = {"space": "space", "prop": "space", "mach": "mech", "join": "mech", "hyd": "mech", "maint": "mech"}
MECH_TOPICS = {"mach", "join", "hyd", "maint"}


def text_field(t: dict):
    """Космический текст — по ключевым словам (или теме space/prop), машиностроительный — явно field="mech"."""
    if t.get("field") == "mech":
        assert t["topic"] in MECH_TOPICS, f"{t['id']}: у машиностроительного текста тема {t['topic']}"
        assert not space_field(t["title"], *t["paragraphs"]), f"{t['id']}: машиностроительный текст про космос"
        return "mech"
    assert t["topic"] not in MECH_TOPICS, f"{t['id']}: тема {t['topic']} без field=mech"
    return "space" if t["topic"] in ("space", "prop") else space_field(t["title"], *t["paragraphs"])


def build_dictionary() -> list[dict]:
    forms = lemma_forms()
    ranks = ngsl_ranks()
    words: dict[str, dict] = {}
    for f in ["ngsl-1.txt", "ngsl-2.txt", "ngsl-3.txt", "ngsl-4.txt"]:
        for w, ru in read_pairs(f):
            key = w.lower()
            if key in ("true", "false"):
                w = key
            rank = ranks.get(key)
            assert rank, f"нет в NGSL: {w}"
            words[key] = {"id": f"w-{slug(key)}", "text": w if w == "I" else key, "ru": ru, "band": band_of(rank), "rank": rank, "forms": forms.get(key, []), "reviewed": False}
    for f in ["nawl-1.txt", "nawl-2.txt"]:
        for w, ru in read_pairs(f):
            key = w.lower()
            if key in words:
                continue
            words[key] = {"id": f"w-{slug(key)}", "text": key, "ru": ru, "band": "nawl", "forms": forms.get(key, []), "reviewed": False}
    tech = []
    for term, ipa, ru, topic in read_pairs("tech.txt"):
        key = term.lower()
        entry = with_field({"id": f"w-{slug(key)}", "text": term, "ru": ru, "ipa": ipa, "topic": topic, "band": "tech", "voices": STD, "reviewed": False}, TERM_FIELD.get(topic))
        if key in words:  # термин совпал с общим словом — берём техническое значение, но сохраняем полосу
            entry["freq"] = words[key]["band"]
            entry["forms"] = words[key]["forms"]
            del words[key]
        tech.append(entry)
    return tech + sorted(words.values(), key=lambda x: x.get("rank", 99_999))


def build():
    (OUT / "doc").mkdir(parents=True, exist_ok=True)
    (OUT / "dict").mkdir(parents=True, exist_ok=True)
    strategies = [{"module": m, **v} for m, v in STRATEGIES.items()]
    texts = []
    for t in TEXTS:
        sents = [split_sentences(p) for p in t["paragraphs"]]
        flat = [s for ps in sents for s in ps]
        for q, key in t["find"]:
            hits = [s for s in flat if key.lower() in s.lower()]
            assert len(hits) == 1, f"{t['id']}: ключ «{key}» найден {len(hits)} раз"
        assert len(t["summaries"]) == len(t["paragraphs"]) == len(t["retell"]), f"{t['id']}: число абзацев"
        assert len(t["paragraphsRu"]) == len(t["paragraphs"]), f"{t['id']}: число абзацев перевода"
        assert t["parse"]["sentence"] in flat, f"{t['id']}: разбираемое предложение не из текста"
        texts.append(with_field({
            **{k: v for k, v in t.items() if k not in ("find", "field")},
            "find": [{"q": q, "key": key} for q, key in t["find"]],
            "source": SOURCE, "license": LICENSE,
            # образцы пересказа — голосом по настройкам (вариант × пол)
            "speak": [{"text": r, "voice": v} for r in t["retell"] for v in STD],
            "reviewed": False,
        }, text_field(t)))
    # Модули doc-*: у космоса и машиностроения одинаковое число текстов (общие видят обе специальности).
    for m in sorted({t["module"] for t in texts}):
        n = {f: sum(1 for t in texts if t["module"] == m and t.get("field") in (None, f)) for f in ("space", "mech")}
        assert n["space"] == n["mech"], f"{m}: текстов у space {n['space']}, у mech {n['mech']}"
    dictionary = build_dictionary()

    def dump(path: Path, data):
        path.write_text(json.dumps(data, ensure_ascii=False, indent=None, separators=(",", ":")) + "\n", encoding="utf-8")

    (OUT / "doc" / "strategies.json").write_text(json.dumps(strategies, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (OUT / "doc" / "texts.json").write_text(json.dumps(texts, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    dump(OUT / "dict" / "words.json", dictionary)
    n_tech = sum(1 for w in dictionary if w["band"] == "tech")
    words_total = sum(len(" ".join(t["paragraphs"]).split()) for t in TEXTS)
    by_field = {f: sum(1 for t in texts if t.get("field") == f) for f in ("space", "mech")}
    terms = {f: sum(1 for w in dictionary if w.get("field") == f) for f in ("space", "mech")}
    print(f"Техдок: {len(texts)} текстов ({words_total} слов; space {by_field['space']}, mech {by_field['mech']}, общих {len(texts) - sum(by_field.values())}), {len(strategies)} стратегий; "
          f"словарь: {len(dictionary)} слов, из них технических {n_tech} (space {terms['space']}, mech {terms['mech']})")


if __name__ == "__main__":
    build()
