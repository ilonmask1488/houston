"""
Специальности (направления) Houston: общий контент виден всем, профильный — только своей специальности.

  field = None     — общее ядро (совещания, чертежи, допуски, испытания, письма, собеседование, быт)
  field = "space"  — ракетно-космическая техника (стиль Houston: эфир, позывной, спутник Ping)
  field = "mech"   — машиностроение (свой стиль: цех, планёрка, Винтик)

Приложение при загрузке оставляет элементы с field == выбранной специальности или без field
(src/content/index.ts → fill). Поэтому для каждого космического элемента в модуле курса нужен
машиностроительный «близнец» в том же модуле — иначе у механика модуль станет короче.

Правило авторских скриптов: элемент, текст которого про ракеты/космос, получает field="space"
(автоматически — space_field(...) по ключевым словам, или явно). Машиностроительный — field="mech" явно.
"""
import re

FIELDS = ("space", "mech")

# Только однозначно космическое. «engine», «test», «bracket», «composite» — общие для всех инженеров.
SPACE_RE = re.compile(
    r"\b(rockets?|spacecraft|space\s?(?:craft|station|industry|mission|missions|programme|program|engineering)|"
    r"satellites?|launch(?:er|ers| vehicle| vehicles| pad| site)?|orbit(?:al|s)?|cubesats?|payloads?|propellants?|"
    r"nozzles?|thrusters?|thrust|aerospace|Korolev|Baikonur|Roscosmos|Lavochkin|Mars|lunar)\b"
    r"|ракет|космич|космос|спутник|орбит|Королёв|Байконур|Роскосмос|Лавочкин|сопл|тяг[аиуе]\b",
    re.IGNORECASE,
)


def space_field(*texts):
    """'space', если хоть один текст явно про ракеты и космос, иначе None."""
    return "space" if any(t and SPACE_RE.search(t) for t in texts) else None


def with_field(item: dict, field):
    """Добавить field в элемент, только если он задан (общие элементы остаются без поля)."""
    if field:
        item["field"] = field
    return item
