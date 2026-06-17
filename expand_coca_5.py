import sqlite3, os
DB = os.path.join(os.path.dirname(__file__), "data", "words.db")
WORDS = [
("individual","indywidualny; jednostka",951),("industry","przemysł; branża",952),("inequality","nierówność",953),("inflation","inflacja",954),("information","informacja",955),
("injection","zastrzyk",956),("innovation","innowacja",957),("institution","instytucja",958),("integration","integracja",959),("intelligence","inteligencja",960),
("interaction","interakcja",961),("interesting","interesujący; ciekawy",962),("international","międzynarodowy",963),("investment","inwestycja",964),("invitation","zaproszenie",965),
("journalism","dziennikarstwo",966),("judgment","osąd; wyrok",967),("justice","sprawiedliwość",968),("kingdom","królestwo",969),("landscape","krajobraz",970),
("language","język",971),("leadership","przywództwo",972),("legislation","ustawodawstwo",973),("limitation","ograniczenie",974),("literature","literatura",975),
("location","lokalizacja; miejsce",976),("management","zarządzanie",977),("manufacturing","produkcja",978),("marriage","małżeństwo",979),("material","materiał",980),
("maximum","maksymalny; maksimum",981),("medication","lekarstwo; leczenie",982),("medium","średni; medium",983),("membership","członkostwo",984),("memorial","pamiątkowy; pomnik",985),
("migration","migracja",986),("minimum","minimalny; minimum",987),("minority","mniejszość",988),("mission","misja",989),("mixture","mieszanina",990),
("monarchy","monarchia",991),("motivation","motywacja",992),("movement","ruch; przeprowadzka",993),("mystery","tajemnica",994),("nationality","narodowość",995),
("negotiation","negocjacja",996),("newspaper","gazeta",997),("normally","normalnie",998),("objective","cel; obiektywny",999),("observation","obserwacja",1000),
("opportunity","okazja; możliwość",1001),("opposition","sprzeciw; opozycja",1002),("organisation","organizacja",1003),("outcome","wynik; rezultat",1004),("ownership","własność; posiadanie",1005),
("parliament","parlament",1006),("partnership","partnerstwo",1007),("patient","pacjent; cierpliwy",1008),("payment","płatność",1009),("perfectly","idealnie; doskonale",1010),
("permanent","stały; trwały",1011),("personality","osobowość",1012),("photography","fotografia",1013),("physical","fizyczny",1014),("planning","planowanie",1015),
("political","polityczny",1016),("population","populacja; ludność",1017),("possibility","możliwość",1018),("preparation","przygotowanie",1019),("presentation","prezentacja",1020),
("preservation","ochrona; konserwacja",1021),("previously","wcześniej; uprzednio",1022),("prisoner","więzień",1023),("probably","prawdopodobnie",1024),("productive","produktywny",1025),
("professional","zawodowy; profesjonalny",1026),("progress","postęp; progresja",1027),("property","własność; nieruchomość",1028),("proportion","proporcja",1029),("protection","ochrona",1030),
("psychology","psychologia",1031),("publication","publikacja",1032),("punishment","kara; ukaranie",1033),("purpose","cel; zamiar",1034),("qualification","kwalifikacja",1035),
("question","pytanie; kwestionować",1036),("recognition","uznanie; rozpoznanie",1037),("recommendation","zalecenie; rekomendacja",1038),("reduction","redukcja; zmniejszenie",1039),("reflection","odbicie; refleksja",1040),
("regulation","regulacja; przepis",1041),("relationship","związek; relacja",1042),("religion","religia",1043),("remarkable","niezwykły; godny uwagi",1044),("reputation","reputacja",1045),
("research","badania; badać",1046),("resolution","rezolucja; postanowienie",1047),("responsibility","odpowiedzialność",1048),("revolution","rewolucja",1049),("satisfaction","satysfakcja",1050),
("security","bezpieczeństwo; ochrona",1051),("sensitive","wrażliwy; czuły",1052),("settlement","osada; porozumienie",1053),("shortage","niedobór; brak",1054),("solution","rozwiązanie",1055),
("somewhere","gdzieś",1056),("specialist","specjalista",1057),("spiritual","duchowy",1058),("statement","oświadczenie; stwierdzenie",1059),("statistics","statystyki",1060),
("successful","udany; pomyślny",1061),("suddenly","nagle",1062),("sustainable","zrównoważony",1063),("sympathy","współczucie; sympatia",1064),("technology","technologia",1065),
("terrorism","terroryzm",1066),("together","razem",1067),("tolerance","tolerancja",1068),("tradition","tradycja",1069),("treatment","leczenie; traktowanie",1070),
("truly","naprawdę; prawdziwie",1071),("understanding","zrozumienie; rozumienie",1072),("unemployment","bezrobocie",1073),("unfortunately","niestety",1074),("university","uniwersytet",1075),
("variation","odmiana; wariacja",1076),("vehicle","pojazd",1077),("violence","przemoc",1078),("volunteer","wolontariusz",1079),("weakness","słabość",1080),
("whatever","cokolwiek",1081),("whenever","kiedy tylko; zawsze gdy",1082),("wherever","gdziekolwiek",1083),("widespread","powszechny; szeroko rozpowszechniony",1084),("wonderful","cudowny; wspaniały",1085),
("ability","zdolność; umiejętność",1086),("absence","nieobecność; brak",1087),("absolutely","absolutnie; zupełnie",1088),("academic","akademicki",1089),("acceptable","akceptowalny",1090),
("accessible","dostępny; przystępny",1091),("accompany","towarzyszyć",1092),("accomplish","osiągać; realizować",1093),("accordingly","odpowiednio; stosownie",1094),("accumulate","gromadzić; nagromadzać",1095),
("accurately","dokładnie; precyzyjnie",1096),("addiction","uzależnienie",1097),("admittedly","trzeba przyznać",1098),("adolescent","nastolatek",1099),("advancement","postęp; awans",1100),
]
conn = sqlite3.connect(DB)
conn.executemany("INSERT OR IGNORE INTO coca_words (word,translation,frequency_rank) VALUES (?,?,?)", WORDS)
conn.commit()
conn.close()
print(f"Inserted batch 5: {len(WORDS)} words")
