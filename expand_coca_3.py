import sqlite3, os
DB = os.path.join(os.path.dirname(__file__), "data", "words.db")
WORDS = [
("layer","warstwa",601),("lead","prowadzić",602),("learn","uczyć się",603),("legal","prawny; legalny",604),("length","długość",605),
("liberal","liberalny",606),("link","łączyć; link",607),("loss","strata",608),("maintain","utrzymywać",609),("majority","większość",610),
("manage","zarządzać; radzić sobie",611),("master","mistrz; opanowywać",612),("match","mecz; pasować",613),("matter","sprawa; mieć znaczenie",614),("measure","mierzyć; miara",615),
("mental","umysłowy; psychiczny",616),("message","wiadomość",617),("military","wojskowy",618),("million","milion",619),("mind","umysł",620),
("mistake","błąd",621),("mix","mieszać; mieszanka",622),("model","model; wzór",623),("modern","nowoczesny",624),("motion","ruch",625),
("move","ruszać się",626),("murder","morderstwo",627),("narrow","wąski",628),("necessary","konieczny",629),("network","sieć",630),
("notice","zauważać; powiadomienie",631),("obtain","uzyskiwać",632),("obvious","oczywisty",633),("occur","zdarzać się",634),("offer","oferta; oferować",635),
("official","oficjalny; urzędnik",636),("operate","działać; obsługiwać",637),("opinion","opinia",638),("ordinary","zwykły",639),("organize","organizować",640),
("overall","ogólny; w sumie",641),("overcome","pokonywać",642),("pain","ból",643),("parent","rodzic",644),("participate","uczestniczyć",645),
("particular","szczególny",646),("partly","częściowo",647),("pass","mijać; zdawać",648),("pattern","wzór; schemat",649),("pause","przerwa; zatrzymywać",650),
("perform","wykonywać; grać",651),("period","okres; czas",652),("permit","zezwalać",653),("persist","wytrwać",654),("pick","wybierać",655),
("platform","platforma",656),("policy","polityka; zasady",657),("positive","pozytywny",658),("power","moc; władza",659),("practice","praktyka; ćwiczyć",660),
("predict","przewidywać",661),("prefer","wolić",662),("present","obecny; prezentować",663),("pressure","nacisk; ciśnienie",664),("prevent","zapobiegać",665),
("prior","wcześniejszy",666),("prison","więzienie",667),("proceed","kontynuować",668),("profit","zysk",669),("promote","promować",670),
("proof","dowód",671),("propose","proponować",672),("protect","chronić",673),("prove","udowadniać",674),("publish","publikować",675),
("pursue","dążyć; ścigać",676),("quality","jakość",677),("raise","podnosić; wychowywać",678),("rapid","szybki",679),("reach","dosięgać",680),
("react","reagować",681),("reality","rzeczywistość",682),("receive","otrzymywać",683),("recent","ostatni; niedawny",684),("recognize","rozpoznawać",685),
("refer","odnosić się",686),("reform","reforma",687),("refuse","odmawiać",688),("regard","uwzględniać",689),("release","zwalniać; wydawać",690),
("rely","polegać",691),("remove","usuwać",692),("replace","zastępować",693),("require","wymagać",694),("respond","odpowiadać",695),
("restrict","ograniczać",696),("retire","przechodzić na emeryturę",697),("reveal","ujawniać",698),("rise","wzrost; wzrastać",699),("risk","ryzyko; ryzykować",700),
("role","rola",701),("rough","szorstki; trudny",702),("safety","bezpieczeństwo",703),("sample","próbka",704),("scale","skala; ważyć",705),
("scene","scena; miejsce zdarzenia",706),("schedule","harmonogram; planować",707),("seek","szukać; dążyć",708),("select","wybierać; selekcjonować",709),("sense","zmysł; sens",710),
("separate","oddzielny; separować",711),("series","seria; serial",712),("serve","służyć",713),("settle","osiedlać się; ustalać",714),("severe","surowy; dotkliwy",715),
("share","dzielić; udział",716),("signal","sygnał",717),("significant","znaczący",718),("silent","cichy; milczący",719),("simple","prosty",720),
("situation","sytuacja",721),("skill","umiejętność",722),("smooth","gładki; łagodny",723),("solar","słoneczny",724),("solve","rozwiązywać",725),
("source","źródło",726),("specific","konkretny",727),("speed","prędkość",728),("stable","stabilny",729),("standard","standard",730),
("statement","stwierdzenie",731),("status","status; stan",732),("strategy","strategia",733),("strength","siła; mocna strona",734),("strike","strajk; uderzać",735),
("structure","struktura",736),("struggle","zmagać się; walka",737),("subject","temat; przedmiot",738),("succeed","osiągać sukces",739),("sufficient","wystarczający",740),
("suggest","sugerować",741),("supply","dostarczać; podaż",742),("support","wspierać",743),("suppose","przypuszczać",744),("survive","przeżywać",745),
("suspect","podejrzewać",746),("switch","przełączyć; zmiana",747),("task","zadanie",748),("tend","mieć tendencję",749),("territory","terytorium",750),
("theme","temat; motyw",751),("threat","zagrożenie",752),("throughout","przez cały; wszędzie",753),("tool","narzędzie",754),("tough","trudny; twardy",755),
("tradition","tradycja",756),("transfer","przenosić; transfer",757),("transform","przekształcać",758),("trust","ufać; zaufanie",759),("typical","typowy",760),
("unique","unikalny; wyjątkowy",761),("unit","jednostka",762),("unless","chyba że",763),("unusual","niezwykły",764),("value","wartość; cenić",765),
("vast","ogromny; rozległy",766),("violence","przemoc",767),("vision","wizja; wzrok",768),("vulnerable","wrażliwy",769),("waste","marnować; odpad",770),
("wealth","bogactwo",771),("weapon","broń",772),("welcome","witać; mile widziany",773),("whereas","podczas gdy; natomiast",774),("willing","chętny",775),
("wise","mądry",776),("wonder","zastanawiać się; cud",777),("worry","martwić się",778),("worth","wart; wartość",779),("wrap","owijać",780),
("accident","wypadek; przypadek",781),("accommodation","zakwaterowanie",782),("account","konto; relacja",783),("accurate","dokładny",784),("achievement","osiągnięcie",785),
("action","działanie; akcja",786),("active","aktywny",787),("activity","działalność; aktywność",788),("actual","rzeczywisty; faktyczny",789),("addition","dodatek",790),
("address","adres; mówić do",791),("administration","administracja",792),("adult","dorosły",793),("adventure","przygoda",794),("advice","porada; rada",795),
("affordable","przystępny cenowo",796),("afraid","przestraszony",797),("afternoon","popołudnie",798),("agreement","umowa; porozumienie",799),("airport","lotnisko",800),
]
conn = sqlite3.connect(DB)
conn.executemany("INSERT OR IGNORE INTO coca_words (word,translation,frequency_rank) VALUES (?,?,?)", WORDS)
conn.commit()
conn.close()
print(f"Inserted batch 3: {len(WORDS)} words")
