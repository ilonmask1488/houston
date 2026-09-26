"""
Контент фазы 3 — Техдок: стратегии чтения, 18 технических текстов (6 тем × 3 уровня), встроенный словарь.

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
        "summaries": [
            ["A satellite consists of a payload, which does the mission, and a bus, which supports it.", "A satellite bus is a vehicle that carries astronauts to orbit.", "The payload provides power and controls the temperature."],
            ["The bus supplies power, controls attitude and temperature, and is often reused.", "Electronics work best at very low temperatures.", "Each mission needs a completely new bus design."],
        ],
        "retell": ["A satellite has a payload that does the job and a bus that supports it.", "The bus gives power, points the satellite and keeps the temperature right, and it can be reused."],
        "find": [("Where does the electrical power come from?", "solar arrays and batteries"), ("Why do engineers reuse the same bus design?", "saves time and money")],
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
        "summaries": [
            ["Fuel and oxidizer are pumped into a chamber where they burn.", "Liquid oxygen is used as fuel in all rockets.", "The chamber keeps the liquids cold."],
            ["The gas speeds up in the nozzle and creates thrust.", "The throat is the widest part of the nozzle.", "Thrust is the temperature of the gas."],
        ],
        "retell": ["The engine pumps fuel and oxidizer into a chamber, where they burn.", "The hot gas speeds up in the nozzle, and the fast jet creates thrust."],
        "find": [("What is the narrow part of the nozzle called?", "is called the throat"), ("What pushes the liquids into the combustion chamber?", "Pumps push both liquids")],
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
        "summaries": [
            ["In a composite, fibers carry the load and a matrix holds them together.", "Composites are made of a single metal.", "The matrix carries most of the load."],
            ["Composites are light and stiff but expensive and need careful inspection.", "Composites are always cheaper than aluminum.", "Damage in composites is easy to see."],
        ],
        "retell": ["A composite combines materials: the fibers carry the load and the matrix holds them.", "Composites are light and stiff, but they cost more and can hide damage, so they need inspection."],
        "find": [("What holds the fibers together?", "the matrix holds the fibers together"), ("Why do composites need careful inspection?", "hide damage inside")],
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
        "summaries": [
            ["In a tensile test, a specimen is pulled until it breaks.", "In a tensile test, a specimen is heated in an oven.", "The grips measure the temperature of the specimen."],
            ["Force and stretch are measured to build a stress-strain curve.", "The load cell measures how much the specimen stretches.", "The curve only shows the color of the material."],
        ],
        "retell": ["In a tensile test, a machine pulls a specimen until it breaks.", "We measure force and stretch and get a curve that shows the strength and the stiffness."],
        "find": [("What measures the force?", "a load cell measures the force"), ("What does the slope at the beginning of the curve show?", "slope at the beginning shows the stiffness")],
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
        "summaries": [
            ["A CAD model usually starts with a dimensioned 2D sketch.", "CAD models always start as 3D solids.", "Constraints are only used in drawings."],
            ["Features like extrude and revolve turn sketches into a parametric solid.", "A parametric model cannot be changed after it is built.", "Revolve pulls the sketch in a straight line."],
        ],
        "retell": ["A CAD model starts with a 2D sketch with dimensions and constraints.", "Features like extrude and revolve make it 3D, and because it is parametric, one change updates the part."],
        "find": [("Which feature turns a sketch around an axis?", "revolve, which turns it around an axis"), ("What happens when you change one dimension later?", "updates the whole part")],
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
        "summaries": [
            ["A glued strain gauge changes its resistance when the part stretches.", "A strain gauge is a large metal block bolted to the part.", "The gauge changes color under load."],
            ["A bridge converts the tiny change into a voltage, and temperature must be compensated.", "The amplifier heats the gauge to measure strain.", "Temperature has no effect on the gauge."],
        ],
        "retell": ["A strain gauge is glued to a part, and its resistance changes when the part stretches.", "A Wheatstone bridge turns this small change into a voltage, and a second gauge compensates for temperature."],
        "find": [("What is the strain gauge glued to?", "glued to the surface of a part"), ("How do good installations deal with temperature?", "compensate for it with a second gauge")],
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
        "find": [("How much mass did the strap add?", "added mass was only 38 g"), ("How accurate was the model?", "within 3 °C"), ("What is the strap made of?", "pyrolytic graphite sheets")],
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
        "find": [("How many hot fire tests were performed?", "In twelve hot fire tests"), ("How long did manufacturing take with the new design?", "ten days"), ("What caused the higher pressure drop?", "surface roughness inside the channels")],
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
        "find": [("How much did the strength decrease at 90 °C?", "by 27 percent at 90 °C"), ("Where did the wet specimens fail?", "failed mainly at the interface"), ("How often was the weight gain measured?", "every five days")],
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
        "find": [("What was the qualification margin?", "qualification margin of 3 dB"), ("What was the failure criterion?", "more than 5 percent in the first natural frequency"), ("Where was the control accelerometer mounted?", "mounted on the shaker table")],
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
        "summaries": [
            ["You create global variables in the Equations dialog to control several dimensions.", "Global variables can only be used in drawings.", "Variable names may contain spaces."],
            ["You link a dimension with an equals sign and rebuild after changes; circular references cause errors.", "Dimensions update automatically without rebuilding.", "A variable may depend on itself."],
        ],
        "retell": ["Global variables are created in the Equations dialog and control several dimensions at once.", "You link a dimension by typing an equals sign, and after a change you rebuild the model."],
        "find": [("What keyboard shortcut updates the model?", "Rebuild (Ctrl+B)"), ("What happens if the expression cannot be evaluated?", "turns red"), ("What must variable names not contain?", "must not contain spaces")],
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
        "summaries": [
            ["The first part lists the range, output, supply and accuracy of the transducer.", "The first part describes how to install the transducer.", "The first part lists the price and delivery time."],
            ["The second part gives temperature and pressure limits and safety notes.", "The second part says the sensor can be used with any fluid.", "The second part explains how to calibrate the sensor."],
        ],
        "retell": ["The PT-200 measures up to 200 bar with a 4 to 20 milliamp output and a maximum error of half a percent of full scale.", "It works from minus 40 to plus 85 degrees, must not exceed 400 bar, and needs oxygen cleaning for liquid oxygen."],
        "find": [("What is the maximum accuracy error?", "±0.5% FS (maximum)"), ("What may happen if you exceed the proof pressure?", "permanent zero offset"), ("What material are the wetted parts made of?", "stainless steel 316L")],
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
        "find": [("What is the factor of safety on ultimate strength?", "1.4 on ultimate strength"), ("What is the minimum axial frequency?", "first axial frequency shall be above 35 Hz"), ("What is the maximum depth of an acceptable scratch?", "does not exceed 0.1 mm")],
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
        "find": [("Which mode is especially associated with high-frequency instability?", "first tangential mode"), ("What is the typical injector pressure drop?", "15 to 20 percent of the chamber pressure"), ("What are low-frequency instabilities often called?", "often called chugging")],
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
        "find": [("What was the stress ratio of the fatigue test?", "stress ratio of 0.1"), ("Where did the cracks initiate?", "initiated at the overlap ends"), ("How much longer did tapered joints last?", "40 percent longer fatigue life")],
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
        "find": [("What was the maximum deflection at limit load?", "maximum deflection was 6.8 mm"), ("Why was the test paused?", "data acquisition fault"), ("At what load was core crushing heard?", "At 11.4 kN")],
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
        "find": [("What is the worst-case result for five parts?", "the worst-case result is ±0.5 mm"), ("What is the most common statistical method?", "root sum square method"), ("When should worst-case analysis be used?", "safety-critical interfaces and for small batches")],
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
        "find": [("By what are datasheet limits divided?", "divided by the square root of three"), ("What is the normal coverage factor?", "normally k = 2"), ("How would the 50 kN measurement be reported?", "50.00 kN ± 0.04 kN")],
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
        "find": [("What is the convergence criterion?", "changes by less than 5 percent"), ("What does a difference of more than 10 percent usually point to?", "error in the boundary conditions"), ("What do over-constrained supports do?", "artificially stiffen the structure")],
        "parse": {
            "sentence": "A mesh convergence study, in which the element size is reduced until the peak stress in the region of interest changes by less than 5 percent, shall be performed for every critical location.",
            "parts": [["A mesh convergence study,", "подлежащее: исследование сходимости сетки"], ["in which the element size is reduced until the peak stress … changes by less than 5 percent,", "вставка: в нём размер элемента уменьшают, пока пиковое напряжение в зоне интереса не изменится меньше чем на 5%"], ["shall be performed for every critical location", "обязательно: должно выполняться для каждого критического места"]],
            "q": "What shall be performed for every critical location?", "options": ["A mesh convergence study", "A test with point loads", "A change of the solver"], "answer": 0,
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
        entry = {"id": f"w-{slug(key)}", "text": term, "ru": ru, "ipa": ipa, "topic": topic, "band": "tech", "voices": STD, "reviewed": False}
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
        assert t["parse"]["sentence"] in flat, f"{t['id']}: разбираемое предложение не из текста"
        texts.append({
            **{k: v for k, v in t.items() if k not in ("find",)},
            "find": [{"q": q, "key": key} for q, key in t["find"]],
            "source": SOURCE, "license": LICENSE,
            # образцы пересказа — голосом по настройкам (вариант × пол)
            "speak": [{"text": r, "voice": v} for r in t["retell"] for v in STD],
            "reviewed": False,
        })
    dictionary = build_dictionary()

    def dump(path: Path, data):
        path.write_text(json.dumps(data, ensure_ascii=False, indent=None, separators=(",", ":")) + "\n", encoding="utf-8")

    (OUT / "doc" / "strategies.json").write_text(json.dumps(strategies, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (OUT / "doc" / "texts.json").write_text(json.dumps(texts, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    dump(OUT / "dict" / "words.json", dictionary)
    n_tech = sum(1 for w in dictionary if w["band"] == "tech")
    words_total = sum(len(" ".join(t["paragraphs"]).split()) for t in TEXTS)
    print(f"Техдок: {len(texts)} текстов ({words_total} слов), {len(strategies)} стратегий; словарь: {len(dictionary)} слов, из них технических {n_tech}")


if __name__ == "__main__":
    build()
