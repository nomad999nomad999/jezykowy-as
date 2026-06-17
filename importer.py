"""
Importer słów z pliku ChatGPT-ANGIELSKI LISTY.md
Wyciąga listy ZNAM / TROCHĘ ZNAM / NIE ZNAM i ładuje do bazy.
"""
import re
import os

ZNAM_BASELINE = """the, of, and, a, to, in, is, you, that, it, he, was, for, on, are, as, with, his, they, I, at, be, this, have, from, or, one, had, by, word, but, not, what, all, were, we, when, your, can, said, there, use, an, each, which, she, do, how, their, if, will, up, other, about, out, many, then, them, these, so, some, her, would, make, like, him, into, time, has, look, two, more, write, go, see, number, no, way, could, people, my, than, first, water, been, call, who, oil, its, now, find, long, down, day, did, get, come, made, may, part, over, new, sound, take, only, little, work, know, place, year, live, me, back, give, most, very, after, thing, our, just, name, good, sentence, man, think, say, great, where, help, through, much, before, line, right, too, means, old, any, same, tell, boy, follow, came, want, show, also, around, form, three, small, set, put, end, does, another, well, large, must, big, even, such, because, turn, here, why, ask, went, men, read, need, land, different, home, us, move, try, kind, hand, picture, again, change, off, play, spell, air, away, animal, house, point, page, letter, mother, answer, found, study, still, learn, should, America, world, high, every, near, add, food, between, own, below, country, plant, last, school, father, keep, tree, never, start, city, earth, eye, light, thought, head, under, story, saw, left, few, while, along, might, close, something, seem, next, hard, open, example, begin, life, always, those, both, paper, together, got, group, often, run, important, until, children, side, feet, car, mile, night, walk, white, sea, began, grow, took, river, four, carry, state, once, book, hear, stop, without, second, later, miss, idea, enough, eat, face, watch, far, real, almost, let, above, girl, sometimes, mountain, cut, young, talk, soon, list, song, being, leave, family, music, color, stand, sun, fish, area, mark, dog, horse, birds, problem, complete, room, knew, since, ever, piece, told, usually, friends, easy, heard, order, red, door, sure, become, top, ship, across, today, during, short, better, best, however, low, hours, black, products, happened, whole, measure, remember, early, waves, reached, listen, wind, rock, space, covered, fast, several, hold, himself, toward, five, step, morning, passed, vowel, true, hundred, against, numeral, table, north, slowly, money, map, farm, pulled, draw, voice, seen, cold, cried, plan, notice, south, sing, war, ground, fall, king, town, unit, figure, certain, field, travel, wood, fire, upon, done, English, road, half, ten, fly, gave, box, finally, wait, correct, quickly, person, became, shown, minutes, strong, verb, stars, front, feel, fact, inches, street, decided, contain, course, surface, produce, building, ocean, class, note, nothing, rest, carefully, scientists, inside, wheels, stay, green, known, island, week, less, machine, base, ago, stood, plane, system, behind, ran, round, boat, game, force, brought, understand, warm, common, bring, explain, dry, though, language, shape, deep, thousands, yes, clear, equation, yet, government, filled, heat, full, hot, check, object, rule, among, noun, power, cannot, able, six, size, dark, ball, material, special, heavy, fine, pair, circle, include, built, matter, square, perhaps, bill, felt, suddenly, test, direction, center, farmers, ready, anything, divided, general, energy, subject, Europe, moon, region, return, believe, dance, members, picked, simple, cells, paint, mind, love, cause, rain, exercise, eggs, train, blue, wish, drop, developed, window, difference, distance, heart, sit, sum, summer, wall, forest, probably, legs, sat, main, winter, wide, written, length, reason, kept, interest, arms, brother, race, present, beautiful, store, job, edge, past, sign, record, finished, discovered, wild, happy, beside, gone, sky, grass, million, weather, root, instruments, meet, third, months, paragraph, raised, represent, soft, whether, clothes, flowers, shall, teacher, held, describe, drive, cross, speak, solve, appear, metal, son, either, ice, sleep, village, factors, result, jumped, snow, ride, care, floor, hill, pushed, baby, buy, century, outside, everything, tall, already, instead, phrase, soil, bed, copy, free, hope, spring, case, laughed, nation, quite, type, themselves, temperature, bright, lead, everyone, method, section, lake, iron, within, dictionary, hair, age, amount, scale, pounds, broken, moment, tiny, possible, gold, milk, quiet, natural, lot, stone, act, build, middle, speed, count, cat, someone, sail, rolled, bear, smiled, angle, fraction, Africa, killed, melody, bottom, trip, hole, poor, fight, surprise, French, died, beat, exactly, remain, dress, fingers, row, least, catch, climbed, wrote, shouted, continued, itself, else, plains, gas, England, burning, design, joined, foot, law, ears, glass, grew, skin, valley, cents, key, president, brown, trouble, cool, cloud, lost, sent, symbols, wear, garden, equal, chose, decimal, church, control, practice, report, straight, rise, statement, stick, seeds, suppose, woman, answer, anyone, application, area, argument, arrive, article, artist, attention, available, average, avoid, background, balance, basic, beautiful, behavior, benefit, billion, board, budget, build, business, campaign, capacity, capital, career, category, challenge, chance, charge, choice, citizen, civil, clear, climate, close, coach, collection, college, comfortable, commercial, community, compare, competition, component, computer, concept, condition, conference, contact, content, context, contract, control, conversation, cooperation, corporate, cost, cultural, culture, customer, data, decision, definition, degree, design, despite, detail, development, difference, difficulty, direction, director, discovery, discussion, disease, distance, distribution, document, domestic, dominant, double, draft, draw, dream, drive, duration, economic, economy, education, effective, election, element, energy, enjoy, environment, especially, event, evidence, exactly, example, exchange, executive, experience, explain, explore, express, extreme, face, fail, family, federal, finish, focus, force, foreign, forget, form, former, forward, freedom, function, future, goal, government, ground, handle, health, heart, heat, history, human, identify, image, impact, improve, include, increase, individual, industry, influence, information, international, interview, investment, issue, item, itself, job, join, judge, knowledge, language, lawyer, leader, learn, legal, level, life, local, manage, management, material, measure, medical, meeting, method, military, modern, movement, natural, necessary, network, notice, object, operation, opportunity, actually, basically, anyway, whatever, somehow, maybe, rather, pretty, overall, though, anymore, somewhere, still, yet, even, just, almost, hardly, barely, simply, exactly, suddenly, forwards, backwards, lately, anytime, someplace, nowhere, nearly, immediately, frequently, occasionally, in the end, gonna, wanna, gotta, kinda, sorta, yeah, yep, nope, okay, uh, um, huh, whoa, oops, nah, hey, bye, guy, stuff, kid, whatever else, by the way, in fact, no longer, at times, in a way, right now, all of a sudden, every now and then, on purpose, by accident, in general, sooner or later, no matter what, from time to time"""

TROCHE_ZNAM = {
    "penalty": "kara, grzywna",
    "court": "sąd",
    "above": "nad, powyżej",
    "charge": "opłata; oskarżyć",
    "common": "powszechny, wspólny",
    "contain": "zawierać",
    "current": "obecny; prąd",
    "growth": "wzrost",
    "majority": "większość",
    "necessary": "konieczny",
    "ceiling": "sufit",
    "withdraw": "wypłacić; wycofać",
    "mortgage": "hipoteka",
    "revenue": "przychód",
    "seem": "wydawać się",
    "along": "wzdłuż; razem z",
    "affect": "wpływać",
    "among": "wśród",
    "executive": "wykonawczy; dyrektor",
    "factor": "czynnik",
    "including": "włączając",
    "indeed": "rzeczywiście, faktycznie",
    "likely": "prawdopodobnie",
    "nor": "ani (w zdaniach przeczących)",
    "statement": "oświadczenie; stwierdzenie",
    "ability": "zdolność",
    "achieve": "osiągnąć",
    "additional": "dodatkowy",
    "admit": "przyznać",
    "although": "chociaż",
    "approach": "podejście; zbliżać się",
    "concern": "obawa; dotyczyć",
    "effort": "wysiłek",
    "surface": "powierzchnia",
    "particular": "szczególny",
    "pattern": "wzór",
    "property": "własność",
    "realize": "zdać sobie sprawę",
    "responsibility": "odpowiedzialność",
    "significant": "znaczący, istotny",
    "affect": "wpływać",
    "majority": "większość",
}

NIE_ZNAM = {
    "advantage": "zaleta; przewaga",
    "claim": "twierdzić; roszczenie",
    "combination": "połączenie",
    "commitment": "zobowiązanie",
    "complex": "złożony",
    "confidence": "pewność siebie",
    "consider": "rozważać",
    "consideration": "rozwaga",
    "contribution": "wkład",
    "demand": "popyt; żądać",
    "determine": "określać, ustalać",
    "doubt": "wątpliwość",
    "dozen": "tuzin (12)",
    "establish": "ustanawiać; zakładać",
    "thought": "myśl",
    "variety": "różnorodność",
    "expense": "wydatek",
    "extend": "rozszerzać",
    "feature": "cecha",
    "figure": "postać; liczba",
    "interest": "zainteresowanie; odsetki",
    "involve": "angażować",
    "mention": "wspominać",
    "notice": "zauważyć",
    "occur": "występować",
    "principle": "zasada",
    "purpose": "cel",
    "recent": "niedawny",
    "relate": "odnosić się; powiązać",
    "remain": "pozostawać",
    "reveal": "ujawniać",
    "adjust": "dostosować",
    "afford": "pozwolić sobie na coś",
    "alter": "zmieniać",
    "assess": "oceniać",
    "associate": "kojarzyć",
    "assumption": "założenie",
    "attach": "dołączać",
    "elsewhere": "gdzie indziej",
    "meanwhile": "w międzyczasie",
    "eventually": "ostatecznie; w końcu",
    "somewhat": "nieco",
    "otherwise": "w przeciwnym razie; inaczej",
    "likewise": "podobnie, tak samo",
    "besides": "poza tym; oprócz",
    "hardly ever": "prawie nigdy",
    "rarely": "rzadko",
    "at most": "co najwyżej",
    "right away": "od razu",
    "at all": "w ogóle",
    "as well": "również",
    "so far": "jak dotąd",
    "for a while": "przez jakiś czas",
    "in the meantime": "w międzyczasie",
    "announced": "ogłosił; ogłoszony",
}


def get_znam_words():
    """Zwraca listę słów ZNAM jako set."""
    words = set()
    for w in ZNAM_BASELINE.split(","):
        w = w.strip().lower()
        if w:
            words.add(w)
    return words


def get_troche_znam():
    """Zwraca słownik TROCHĘ ZNAM {słowo: tłumaczenie}."""
    return dict(TROCHE_ZNAM)


def get_nie_znam():
    """Zwraca słownik NIE ZNAM {słowo: tłumaczenie}."""
    return dict(NIE_ZNAM)


def load_all_to_db(db):
    """Ładuje wszystkie 3 listy do bazy danych (jednorazowo)."""
    if db.is_imported():
        print("Dane już zaimportowane – pomijam.")
        return

    print("Importuję listę ZNAM...")
    for word in get_znam_words():
        db.add_word(word, "", "ZNAM", source="import")

    print("Importuję listę TROCHĘ ZNAM...")
    for word, translation in get_troche_znam().items():
        db.add_word(word, translation, "TROCHE", source="import")

    print("Importuję listę NIE ZNAM...")
    for word, translation in get_nie_znam().items():
        db.add_word(word, translation, "NIE_ZNAM", source="import")

    db.mark_imported()
    total = len(get_znam_words()) + len(get_troche_znam()) + len(get_nie_znam())
    print(f"Import zakończony. Załadowano {total} słów.")
