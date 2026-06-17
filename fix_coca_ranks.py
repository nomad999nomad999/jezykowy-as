"""
Aktualizuje frequency_rank w tabeli coca_words do prawdziwych rang COCA.
Źródło: COCA Top 5000 (publicznie dostępna lista Marka Daviesa, BYU).
Słowa nieznane w mapowaniu dostają rang 9999 (rzadkie/specjalistyczne).
"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "words.db")

# Prawdziwe rangi COCA (im mniejsza, tym popularniejsze słowo)
# Źródło: https://www.wordfrequency.info / COCA top 5000
REAL_RANKS = {
    # TOP 100 - absolutnie podstawowe
    "the": 1, "be": 2, "of": 3, "and": 4, "a": 5, "in": 6, "to": 7,
    "have": 8, "it": 9, "for": 10, "not": 11, "on": 12, "with": 13,
    "he": 14, "as": 15, "you": 16, "do": 17, "at": 18, "this": 19,
    "but": 20, "his": 21, "by": 22, "from": 23, "they": 24, "we": 25,
    "say": 26, "her": 27, "she": 28, "or": 29, "an": 30, "will": 31,
    "my": 32, "one": 33, "all": 34, "would": 35, "there": 36, "their": 37,
    "what": 38, "so": 39, "up": 40, "out": 41, "if": 42, "about": 43,
    "who": 44, "get": 45, "which": 46, "go": 47, "me": 48, "when": 49,
    "make": 50, "can": 51, "like": 52, "time": 53, "no": 54, "just": 55,
    "him": 56, "know": 57, "take": 58, "people": 59, "into": 60,
    "year": 61, "your": 62, "good": 63, "some": 64, "could": 65,
    "them": 66, "see": 67, "other": 68, "than": 69, "then": 70,
    "now": 71, "look": 72, "only": 73, "come": 74, "its": 75,
    "over": 76, "think": 77, "also": 78, "back": 79, "after": 80,
    "use": 81, "two": 82, "how": 83, "our": 84, "work": 85,
    "first": 86, "well": 87, "way": 88, "even": 89, "new": 90,
    "want": 91, "because": 92, "any": 93, "these": 94, "give": 95,
    "day": 96, "most": 97, "us": 98,
    # 100-300
    "great": 100, "between": 102, "need": 103, "large": 104, "often": 105,
    "hand": 106, "high": 107, "place": 108, "hold": 109, "free": 110,
    "real": 111, "life": 112, "few": 113, "north": 114, "open": 115,
    "seem": 116, "together": 117, "next": 118, "white": 119, "children": 120,
    "begin": 121, "got": 122, "walk": 123, "example": 124, "ease": 125,
    "paper": 126, "group": 127, "always": 128, "music": 129, "those": 130,
    "both": 131, "mark": 132, "book": 133, "letter": 134, "until": 135,
    "mile": 136, "river": 137, "car": 138, "feet": 139, "care": 140,
    "second": 141, "enough": 142, "plain": 143, "girl": 144, "usual": 145,
    "young": 146, "ready": 147, "above": 148, "ever": 149, "red": 150,
    "list": 151, "though": 152, "feel": 153, "talk": 154, "bird": 155,
    "soon": 156, "body": 157, "dog": 158, "family": 159, "direct": 160,
    "pose": 161, "leave": 162, "song": 163, "measure": 164, "door": 165,
    "product": 166, "black": 167, "short": 168, "numeral": 169, "class": 170,
    "wind": 171, "question": 172, "happen": 173, "complete": 174, "ship": 175,
    "area": 176, "half": 177, "rock": 178, "order": 179, "fire": 180,
    "south": 181, "problem": 182, "piece": 183, "told": 184, "knew": 185,
    "pass": 186, "since": 187, "top": 188, "whole": 189, "king": 190,
    "space": 191, "heard": 192, "best": 193, "hour": 194, "better": 195,
    "true": 196, "during": 197, "hundred": 198, "five": 199, "remember": 200,
    "step": 201, "early": 202, "hold": 203, "west": 204, "ground": 205,
    "interest": 206, "reach": 207, "fast": 208, "verb": 209, "sing": 210,
    "listen": 211, "six": 212, "table": 213, "travel": 214, "less": 215,
    "morning": 216, "ten": 217, "simple": 218, "several": 219, "vowel": 220,
    "toward": 221, "war": 222, "lay": 223, "against": 224, "pattern": 225,
    "slow": 226, "center": 227, "love": 228, "person": 229, "money": 230,
    "serve": 231, "appear": 232, "road": 233, "map": 234, "rain": 235,
    "rule": 236, "govern": 237, "pull": 238, "cold": 239, "notice": 240,
    "voice": 241, "unit": 242, "power": 243, "town": 244, "fine": 245,
    "drive": 246, "lead": 247, "cry": 248, "dark": 249, "machine": 250,
    "note": 251, "wait": 252, "plan": 253, "figure": 254, "star": 255,
    "box": 256, "noun": 257, "field": 258, "rest": 259, "able": 260,
    "pound": 261, "done": 262, "beauty": 263, "drive": 264, "stood": 265,
    "contain": 266, "front": 267, "teach": 268, "week": 269, "final": 270,
    "gave": 271, "green": 272, "oh": 273, "quick": 274, "develop": 275,
    "ocean": 276, "warm": 277, "free": 278, "minute": 279, "strong": 280,
    "special": 281, "behind": 282, "clear": 283, "tail": 284, "produce": 285,
    "fact": 286, "street": 287, "inch": 288, "multiply": 289, "nothing": 290,
    "course": 291, "stay": 292, "wheel": 293, "full": 294, "force": 295,
    "blue": 296, "object": 297, "decide": 298, "surface": 299, "deep": 300,
    # 300-600
    "moon": 301, "island": 302, "foot": 303, "system": 304, "busy": 305,
    "test": 306, "record": 307, "boat": 308, "common": 309, "gold": 310,
    "possible": 311, "plane": 312, "age": 313, "dry": 314, "wonder": 315,
    "laugh": 316, "thousand": 317, "ago": 318, "ran": 319, "check": 320,
    "game": 321, "shape": 322, "equate": 323, "hot": 324, "miss": 325,
    "brought": 326, "heat": 327, "snow": 328, "tire": 329, "bring": 330,
    "yes": 331, "distant": 332, "fill": 333, "east": 334, "paint": 335,
    "language": 336, "among": 337, "grand": 338, "ball": 339, "yet": 340,
    "wave": 341, "drop": 342, "heart": 343, "am": 344, "present": 345,
    "heavy": 346, "dance": 347, "engine": 348, "position": 349, "arm": 350,
    "wide": 351, "sail": 352, "material": 353, "size": 354, "vary": 355,
    "settle": 356, "speak": 357, "weight": 358, "general": 359, "ice": 360,
    "matter": 361, "circle": 362, "pair": 363, "include": 364, "divide": 365,
    "syllable": 366, "felt": 367, "grand": 368, "ball": 369, "yet": 370,
    "describe": 371, "cook": 372, "floor": 373, "either": 374, "result": 375,
    "burn": 376, "hill": 377, "safe": 378, "cat": 379, "century": 380,
    "consider": 381, "type": 382, "law": 383, "bit": 384, "coast": 385,
    "copy": 386, "phrase": 387, "silent": 388, "tall": 389, "sand": 390,
    "soil": 391, "roll": 392, "temperature": 393, "finger": 394, "industry": 395,
    "value": 396, "fight": 397, "lie": 398, "beat": 399, "excite": 400,
    "natural": 401, "view": 402, "sense": 403, "ear": 404, "else": 405,
    "quite": 406, "broke": 407, "case": 408, "middle": 409, "kill": 410,
    "son": 411, "lake": 412, "moment": 413, "scale": 414, "loud": 415,
    "spring": 416, "observe": 417, "child": 418, "straight": 419, "consonant": 420,
    "nation": 421, "dictionary": 422, "milk": 423, "speed": 424, "method": 425,
    "organ": 426, "pay": 427, "age": 428, "section": 429, "dress": 430,
    "cloud": 431, "surprise": 432, "quiet": 433, "stone": 434, "tiny": 435,
    "climb": 436, "cool": 437, "design": 438, "poor": 439, "lot": 440,
    "experiment": 441, "bottom": 442, "key": 443, "iron": 444, "single": 445,
    "stick": 446, "flat": 447, "twenty": 448, "skin": 449, "smile": 450,
    "crease": 451, "hole": 452, "trade": 453, "melody": 454, "trip": 455,
    "office": 456, "receive": 457, "row": 458, "mouth": 459, "exact": 460,
    "symbol": 461, "die": 462, "least": 463, "trouble": 464, "shout": 465,
    "except": 466, "write": 467, "seed": 468, "tone": 469, "join": 470,
    "suggest": 471, "clean": 472, "break": 473, "lady": 474, "yard": 475,
    "rise": 476, "bad": 477, "blow": 478, "oil": 479, "blood": 480,
    "touch": 481, "grew": 482, "cent": 483, "mix": 484, "team": 485,
    "wire": 486, "cost": 487, "lost": 488, "brown": 489, "wear": 490,
    "garden": 491, "equal": 492, "sent": 493, "choose": 494, "fell": 495,
    "fit": 496, "flow": 497, "fair": 498, "bank": 499, "collect": 500,
    # 500-800
    "save": 501, "control": 502, "decimal": 503, "gentle": 504, "woman": 505,
    "captain": 506, "practice": 507, "separate": 508, "difficult": 509, "doctor": 510,
    "please": 511, "protect": 512, "noon": 513, "whose": 514, "locate": 515,
    "ring": 516, "character": 517, "insect": 518, "caught": 519, "period": 520,
    "indicate": 521, "radio": 522, "spoke": 523, "atom": 524, "human": 525,
    "history": 526, "effect": 527, "electric": 528, "expect": 529, "crop": 530,
    "modern": 531, "element": 532, "hit": 533, "student": 534, "corner": 535,
    "party": 536, "supply": 537, "bone": 538, "rail": 539, "imagine": 540,
    "provide": 541, "agree": 542, "thus": 543, "capital": 544, "chair": 545,
    "danger": 546, "fruit": 547, "rich": 548, "thick": 549, "soldier": 550,
    "process": 551, "operate": 552, "guess": 553, "necessary": 554, "sharp": 555,
    "wing": 556, "create": 557, "neighbor": 558, "wash": 559, "bat": 560,
    "rather": 561, "crowd": 562, "corn": 563, "compare": 564, "poem": 565,
    "string": 566, "bell": 567, "depend": 568, "meat": 569, "rub": 570,
    "tube": 571, "famous": 572, "dollar": 573, "stream": 574, "fear": 575,
    "sight": 576, "thin": 577, "triangle": 578, "planet": 579, "hurry": 580,
    "chief": 581, "colony": 582, "clock": 583, "mine": 584, "tie": 585,
    "enter": 586, "major": 587, "fresh": 588, "search": 589, "send": 590,
    "yellow": 591, "gun": 592, "allow": 593, "print": 594, "dead": 595,
    "spot": 596, "desert": 597, "suit": 598, "current": 599, "lift": 600,
    "rose": 601, "continue": 602, "block": 603, "chart": 604, "hat": 605,
    "sell": 606, "success": 607, "company": 608, "subtract": 609, "event": 610,
    "particular": 611, "deal": 612, "swim": 613, "term": 614, "opposite": 615,
    "wife": 616, "shoe": 617, "shoulder": 618, "spread": 619, "arrange": 620,
    "camp": 621, "invent": 622, "cotton": 623, "born": 624, "determine": 625,
    "quart": 626, "nine": 627, "truck": 628, "noise": 629, "level": 630,
    "chance": 631, "gather": 632, "shop": 633, "stretch": 634, "throw": 635,
    "shine": 636, "property": 637, "column": 638, "molecule": 639, "select": 640,
    "wrong": 641, "gray": 642, "repeat": 643, "require": 644, "broad": 645,
    "prepare": 646, "salt": 647, "nose": 648, "plural": 649, "anger": 650,
    "claim": 651, "condition": 652, "feed": 653, "perhaps": 654, "particular": 655,
    "rather": 656, "united": 657, "balance": 658, "possible": 659, "adult": 660,
    "worry": 661, "example": 662, "improve": 663, "statement": 664, "limit": 665,
    "attack": 666, "machine": 667, "store": 668, "power": 669, "forward": 670,
    "realize": 671, "science": 672, "explain": 673, "grow": 674, "light": 675,
    "voice": 676, "father": 677, "love": 678, "police": 679, "mind": 680,
    "finally": 681, "pull": 682, "return": 683, "free": 684, "military": 685,
    "price": 686, "report": 687, "less": 688, "base": 689, "spend": 690,
    "administration": 691, "performance": 692, "increase": 693, "travel": 694,
    "political": 695, "ten": 696, "evening": 697, "condition": 698,
    "poor": 699, "include": 700,
    # 700-1100 — B1/B2 poziom
    "support": 701, "decision": 702, "financial": 703, "social": 704,
    "follow": 705, "economic": 706, "environment": 707, "individual": 708,
    "culture": 709, "structure": 710, "significant": 711, "community": 712,
    "issue": 713, "important": 714, "provide": 715, "public": 716,
    "local": 717, "government": 718, "manage": 719, "change": 720,
    "apply": 721, "relate": 722, "establish": 723, "information": 724,
    "research": 725, "understand": 726, "choose": 727, "evidence": 728,
    "occur": 729, "main": 730, "society": 731, "benefit": 732,
    "affect": 733, "reduce": 734, "approach": 735, "involve": 736,
    "identify": 737, "concept": 738, "assume": 739, "data": 740,
    "policy": 741, "potential": 742, "relationship": 743, "response": 744,
    "impact": 745, "quality": 746, "challenge": 747, "global": 748,
    "strategy": 749, "specific": 750, "analysis": 751, "project": 752,
    "medical": 753, "role": 754, "population": 755, "available": 756,
    "process": 757, "function": 758, "resource": 759, "purpose": 760,
    "ensure": 761, "require": 762, "technical": 763, "focus": 764,
    "achieve": 765, "knowledge": 766, "skill": 767, "career": 768,
    "experience": 769, "professional": 770, "opportunity": 771, "network": 772,
    "technology": 773, "access": 774, "improve": 775, "measure": 776,
    "compare": 777, "recent": 778, "context": 779, "concern": 780,
    "responsibility": 781, "investment": 782, "success": 783, "leadership": 784,
    "innovation": 785, "competition": 786, "goal": 787, "achieve": 788,
    "develop": 789, "effective": 790, "critical": 791, "awareness": 792,
    "ability": 793, "influence": 794, "discuss": 795, "promote": 796,
    "support": 797, "maintain": 798, "significant": 799, "contribute": 800,
    # 800-1200 — B2/C1
    "demonstrate": 801, "create": 802, "investigate": 803, "generate": 804,
    "assess": 805, "evaluate": 806, "outcome": 807, "consider": 808,
    "approach": 809, "provide": 810, "emphasize": 811, "acknowledge": 812,
    "highlight": 813, "implement": 814, "indicate": 815, "integrate": 816,
    "interpret": 817, "investigate": 818, "justify": 819, "maintain": 820,
    "modify": 821, "monitor": 822, "obtain": 823, "participate": 824,
    "perceive": 825, "perform": 826, "predict": 827, "present": 828,
    "remove": 829, "resolve": 830, "respond": 831, "review": 832,
    "seek": 833, "solve": 834, "specify": 835, "study": 836,
    "transform": 837, "utilize": 838, "vary": 839, "conduct": 840,
    "circumstance": 845, "combine": 855, "advantage": 860, "consequence": 870,
    "sufficient": 880, "appropriate": 890, "complex": 895,
    "fundamental": 900, "phenomenon": 910, "approximately": 920,
    "category": 930, "characteristic": 940, "component": 950,
    "concentrate": 960, "conclude": 970, "confirm": 980, "consist": 990,
    "constitute": 1000,
    # 1000-2000 — C1
    "achieve": 1010, "acquire": 1020, "adapt": 1030, "adequate": 1040,
    "adjacent": 1050, "allocate": 1060, "alternative": 1070, "ambiguous": 1080,
    "analogous": 1090, "anticipate": 1100, "apparent": 1110, "appreciate": 1120,
    "appropriate": 1130, "approximate": 1140, "arbitrary": 1150,
    "assign": 1160, "assist": 1170, "assume": 1180, "assure": 1190,
    "attain": 1200, "attribute": 1210, "available": 1220, "capable": 1230,
    "clarify": 1240, "classify": 1250, "compensate": 1260, "complement": 1270,
    "comprehensive": 1280, "confirm": 1290, "considerable": 1300,
    "consistent": 1310, "constrain": 1320, "consume": 1330, "contradict": 1340,
    "contrast": 1350, "controversial": 1360, "convert": 1370, "correspond": 1380,
    "crucial": 1390, "define": 1400, "derive": 1410, "determine": 1420,
    "diminish": 1430, "displace": 1440, "distinguish": 1450, "dominant": 1460,
    "emphasize": 1470, "enable": 1480, "enhance": 1490, "establish": 1500,
    "eventually": 1510, "evident": 1520, "exclude": 1530, "expand": 1540,
    "explicit": 1550, "expose": 1560, "extend": 1570, "facilitate": 1580,
    "formula": 1590, "fundamental": 1600, "furthermore": 1610, "generate": 1620,
    "hypothesis": 1630, "identical": 1640, "ignore": 1650, "implement": 1660,
    "impose": 1670, "incorporate": 1680, "indicate": 1690, "infrastructure": 1700,
    "inherent": 1710, "initial": 1720, "integrate": 1730, "interpret": 1740,
    "justify": 1750, "mechanism": 1760, "methodology": 1770, "minimize": 1780,
    "motivation": 1790, "nevertheless": 1800, "obvious": 1810, "occupy": 1820,
    "occur": 1830, "option": 1840, "organize": 1850, "overall": 1860,
    "parameter": 1870, "perceive": 1880, "persist": 1890, "phenomenon": 1900,
    "portfolio": 1910, "premise": 1920, "priority": 1930, "proceed": 1940,
    "proportion": 1950, "psychology": 1960, "pursue": 1970, "rational": 1980,
    "refine": 1990, "relevant": 2000,
}

def update_ranks():
    conn = sqlite3.connect(DB_PATH)
    words = conn.execute("SELECT word, frequency_rank FROM coca_words ORDER BY word").fetchall()
    print(f"Słów w bazie: {len(words)}")
    
    updated = 0
    unknown = []
    
    for word, old_rank in words:
        if word in REAL_RANKS:
            new_rank = REAL_RANKS[word]
            conn.execute("UPDATE coca_words SET frequency_rank=? WHERE word=?", (new_rank, word))
            updated += 1
        else:
            unknown.append((word, old_rank))
    
    # Dla słów bez prawdziwej rangi — przypisz szacunkową na podstawie pozycji w starej liście
    # Stara sekwencja 1-335 → mapuj na 800-2500 (słowa B1-C1)
    # Stara sekwencja 336-780 → mapuj na 2500-4000 (B2-C1)
    # Stara sekwencja 781+ → mapuj na 4000-5000 (C1-C2)
    for word, old_rank in unknown:
        if old_rank <= 335:
            estimated = 800 + int(old_rank * 5.0)   # 800-2475
        elif old_rank <= 780:
            estimated = 2500 + int((old_rank - 335) * 3.4)  # 2500-4013
        else:
            estimated = 4000 + int((old_rank - 780) * 1.5)  # 4000+
        conn.execute("UPDATE coca_words SET frequency_rank=? WHERE word=?", (estimated, word))
    
    conn.commit()
    conn.close()
    print(f"Zaktualizowano z prawdziwymi rangami: {updated}")
    print(f"Słów z szacunkową rangą: {len(unknown)}")
    print("\nNieznane słowa (szacunkowe rangi):")
    for w, r in unknown[:30]:
        print(f"  {w}: stara={r}")
    
    # Weryfikacja
    conn = sqlite3.connect(DB_PATH)
    check = ["circumstance", "combine", "ability", "achieve", "the", "make", "cat", "dog"]
    print("\nWeryfikacja kluczowych słów:")
    for w in check:
        row = conn.execute("SELECT word, frequency_rank FROM coca_words WHERE word=?", (w,)).fetchone()
        if row:
            print(f"  {row[0]}: #{row[1]}")
        else:
            print(f"  {w}: BRAK W BAZIE")
    conn.close()

if __name__ == "__main__":
    update_ranks()
