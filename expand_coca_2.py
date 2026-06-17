import sqlite3, os
DB = os.path.join(os.path.dirname(__file__), "data", "words.db")
WORDS = [
("constant","stały; ciągły",451),("construct","budować; konstruować",452),("contain","zawierać",453),("context","kontekst",454),("contrast","kontrast",455),
("contribute","przyczyniać się",456),("convince","przekonywać",457),("cope","radzić sobie",458),("correct","poprawny; korygować",459),("cost","koszt; kosztować",460),
("count","liczyć",461),("countryside","wieś; krajobraz",462),("courage","odwaga",463),("crash","wypadek; rozbijać się",464),("create","tworzyć",465),
("credit","kredyt; zasługa",466),("crime","przestępstwo",467),("crisis","kryzys",468),("criticism","krytyka",469),("crowd","tłum",470),
("crucial","kluczowy",471),("culture","kultura",472),("currency","waluta",473),("damage","szkoda; uszkadzać",474),("debate","debata",475),
("decade","dekada",476),("decide","decydować",477),("declare","deklarować",478),("decline","spadać; odmawiać",479),("define","definiować",480),
("delay","opóźnienie",481),("deliver","dostarczać",482),("demand","żądanie; żądać",483),("demonstrate","demonstrować",484),("deny","zaprzeczać",485),
("depend","zależeć",486),("describe","opisywać",487),("deserve","zasługiwać",488),("design","projekt; projektować",489),("despite","mimo",490),
("detail","szczegół",491),("determine","ustalać",492),("develop","rozwijać",493),("device","urządzenie",494),("differ","różnić się",495),
("difficult","trudny",496),("direct","bezpośredni; kierować",497),("disappear","znikać",498),("discover","odkrywać",499),("discuss","dyskutować",500),
("display","wyświetlać; wystawiać",501),("distance","odległość",502),("distinct","wyraźny; odrębny",503),("divide","dzielić",504),("double","podwójny; podwajać",505),
("draw","rysować; przyciągać",506),("dream","marzenie; marzyć",507),("drive","jeździć; napęd",508),("drop","upuszczać; spadać",509),("earn","zarabiać",510),
("ease","łatwość; ułatwiać",511),("edge","krawędź; przewaga",512),("educate","kształcić",513),("elect","wybierać",514),("element","element",515),
("emerge","wyłaniać się",516),("employ","zatrudniać",517),("encourage","zachęcać",518),("enhance","ulepszać",519),("enormous","ogromny",520),
("entire","cały",521),("equal","równy",522),("escape","uciekać; ucieczka",523),("establish","ustanawiać",524),("evidence","dowód",525),
("evil","zły; zło",526),("examine","badać",527),("exchange","wymiana; wymieniać",528),("exist","istnieć",529),("expect","oczekiwać",530),
("expense","wydatek",531),("explain","wyjaśniać",532),("express","wyrażać",533),("extend","rozszerzać",534),("extreme","ekstremalny",535),
("factor","czynnik",536),("failure","porażka; awaria",537),("fair","sprawiedliwy; targi",538),("faith","wiara",539),("familiar","znajomy",540),
("famous","sławny",541),("fantastic","fantastyczny",542),("fate","los; przeznaczenie",543),("feed","karmić",544),("fight","walczyć; walka",545),
("figure","figura; cyfra",546),("firm","firma; twardy",547),("fix","naprawiać",548),("flat","płaski; mieszkanie",549),("focus","skupiać",550),
("force","siła; zmuszać",551),("forget","zapominać",552),("form","forma; tworzyć",553),("found","zakładać",554),("frame","rama; oprawa",555),
("freedom","wolność",556),("frequent","częsty",557),("fresh","świeży",558),("function","funkcja",559),("fundamental","podstawowy",560),
("gain","zysk; zyskiwać",561),("general","ogólny; generał",562),("global","globalny",563),("goal","cel; bramka",564),("grant","przyznawać; dotacja",565),
("grow","rosnąć; hodować",566),("guarantee","gwarantować",567),("guide","przewodnik; prowadzić",568),("guilty","winny",569),("harm","szkoda; krzywdzić",570),
("hate","nienawidzić",571),("healthy","zdrowy",572),("heavy","ciężki",573),("hide","chować; ukrywać",574),("highlight","podkreślać",575),
("hold","trzymać; odbywać",576),("honest","uczciwy",577),("huge","ogromny",578),("identify","identyfikować",579),("ignore","ignorować",580),
("immediate","natychmiastowy",581),("impact","wpływ; uderzenie",582),("implement","wdrażać",583),("impossible","niemożliwy",584),("improve","poprawiać",585),
("indicate","wskazywać",586),("influence","wpływ; wpływać",587),("initial","początkowy",588),("insist","nalegać",589),("instead","zamiast",590),
("intend","zamierzać",591),("invest","inwestować",592),("involve","angażować",593),("judge","sędzia; osądzać",594),("justify","uzasadniać",595),
("keep","trzymać; kontynuować",596),("kill","zabijać",597),("knowledge","wiedza",598),("lack","brak; brakować",599),("launch","uruchamiać",600),
]
conn = sqlite3.connect(DB)
conn.executemany("INSERT OR IGNORE INTO coca_words (word,translation,frequency_rank) VALUES (?,?,?)", WORDS)
conn.commit()
conn.close()
print(f"Inserted batch 2: {len(WORDS)} words")
