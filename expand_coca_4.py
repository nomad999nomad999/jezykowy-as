import sqlite3, os
DB = os.path.join(os.path.dirname(__file__), "data", "words.db")
WORDS = [
("animal","zwierzę",801),("anxiety","niepokój; lęk",802),("apparently","najwyraźniej",803),("appearance","wygląd",804),("application","aplikacja; wniosek",805),
("appointment","spotkanie",806),("approximately","mniej więcej",807),("architecture","architektura",808),("argument","kłótnia; argument",809),("army","armia",810),
("artificial","sztuczny",811),("artist","artysta",812),("atmosphere","atmosfera",813),("attraction","atrakcja",814),("audience","publiczność",815),
("automatically","automatycznie",816),("available","dostępny",817),("average","średni; przeciętny",818),("background","tło; historia",819),("beautiful","piękny",820),
("behaviour","zachowanie",821),("bicycle","rower",822),("birthday","urodziny",823),("bleeding","krwawienie",824),("blessing","błogosławieństwo",825),
("breathe","oddychać",826),("brilliant","genialny; świetny",827),("broken","zepsuty; złamany",828),("building","budynek; budowanie",829),("burning","palący; pożar",830),
("business","biznes; firma",831),("carefully","ostrożnie; starannie",832),("celebrate","świętować",833),("championship","mistrzostwo",834),("changing","zmieniający się",835),
("charity","dobroczynność; organizacja charytatywna",836),("childhood","dzieciństwo",837),("clothing","odzież; ubranie",838),("collapse","zapaść; runąć",839),("colleague","kolega; współpracownik",840),
("collection","kolekcja; zbiór",841),("comfortable","wygodny",842),("competition","konkurs; rywalizacja",843),("completely","całkowicie; zupełnie",844),("complicated","skomplikowany",845),
("concentration","koncentracja; skupienie",846),("confident","pewny siebie",847),("confusion","zamieszanie; dezorientacja",848),("connection","połączenie; związek",849),("consider","rozważać; uważać za",850),
("considerable","znaczny; spory",851),("constantly","stale; ciągle",852),("construction","budowa; konstrukcja",853),("consumer","konsument; klient",854),("contract","umowa; kontrakt",855),
("conversation","rozmowa",856),("corruption","korupcja",857),("countryside","wieś; tereny wiejskie",858),("creative","kreatywny; twórczy",859),("creature","stworzenie; istota",860),
("dangerous","niebezpieczny",861),("darkness","ciemność; mrok",862),("daughter","córka",863),("decision","decyzja",864),("decoration","dekoracja",865),
("deliberately","celowo; rozmyślnie",866),("democracy","demokracja",867),("departure","odlot; wyjazd",868),("depression","depresja",869),("destruction","zniszczenie",870),
("development","rozwój",871),("difference","różnica",872),("difficulty","trudność",873),("direction","kierunek; wskazówki",874),("discovery","odkrycie",875),
("discussion","dyskusja",876),("disease","choroba",877),("disorder","nieporządek; zaburzenie",878),("distribution","dystrybucja; rozdział",879),("diversity","różnorodność",880),
("document","dokument; dokumentować",881),("domestic","domowy; krajowy",882),("dominant","dominujący",883),("dramatic","dramatyczny",884),("drawing","rysunek",885),
("dream","marzenie; sen",886),("dressed","ubrany",887),("driving","jazda; prowadzenie",888),("economy","gospodarka; ekonomia",889),("education","edukacja",890),
("effective","skuteczny; efektywny",891),("elderly","starszy; w podeszłym wieku",892),("election","wybory",893),("electronic","elektroniczny",894),("emergency","nagły wypadek",895),
("emotional","emocjonalny",896),("empire","imperium",897),("employment","zatrudnienie",898),("enemy","wróg; nieprzyjaciel",899),("energy","energia",900),
("engagement","zaangażowanie; zaręczyny",901),("engineering","inżynieria",902),("environment","środowisko",903),("equality","równość",904),("equipment","sprzęt; wyposażenie",905),
("essential","niezbędny; istotny",906),("eventually","w końcu; ostatecznie",907),("example","przykład",908),("excellent","doskonały; znakomity",909),("exciting","ekscytujący",910),
("existence","istnienie; egzystencja",911),("expansion","ekspansja; rozszerzenie",912),("experience","doświadczenie; przeżywać",913),("experiment","eksperyment",914),("export","eksportować; eksport",915),
("exposure","ekspozycja; narażenie",916),("extremely","niezwykle; ekstremalnie",917),("facilities","udogodnienia; obiekty",918),("favourite","ulubiony",919),("feature","cecha; funkcja",920),
("fiction","fikcja",921),("financial","finansowy",922),("finding","odkrycie; ustalenie",923),("football","piłka nożna",924),("foreign","zagraniczny; obcy",925),
("formal","formalny",926),("forward","do przodu; naprzód",927),("foundation","fundacja; fundament",928),("friendship","przyjaźń",929),("generation","pokolenie; generacja",930),
("generous","hojny; szczodry",931),("government","rząd",932),("gradually","stopniowo",933),("grateful","wdzięczny",934),("growth","wzrost; rozwój",935),
("happiness","szczęście",936),("happen","dziać się; zdarzyć się",937),("headquarters","siedziba główna; kwatera",938),("helpful","pomocny",939),("historical","historyczny",940),
("holiday","urlop; święto",941),("homeless","bezdomny",942),("hospital","szpital",943),("household","gospodarstwo domowe",944),("humanity","ludzkość; człowieczeństwo",945),
("imagination","wyobraźnia",946),("immigrant","imigrant",947),("important","ważny",948),("impression","wrażenie; impresja",949),("independence","niezależność",950),
]
conn = sqlite3.connect(DB)
conn.executemany("INSERT OR IGNORE INTO coca_words (word,translation,frequency_rank) VALUES (?,?,?)", WORDS)
conn.commit()
conn.close()
print(f"Inserted batch 4: {len(WORDS)} words")
