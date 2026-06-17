import sqlite3, os
DB = os.path.join(os.path.dirname(__file__), "data", "words.db")
WORDS = [
("achieve","osiągać",336),("acquire","nabywać",337),("adapt","przystosować",338),("adequate","odpowiedni",339),("adjust","dostosować",340),
("admire","podziwiać",341),("admit","przyznać",342),("adopt","adoptować; przyjmować",343),("advance","postępować; zaawansowany",344),("advantage","zaleta; przewaga",345),
("affect","wpływać",346),("afford","pozwolić sobie na coś",347),("agency","agencja",348),("aggressive","agresywny",349),("agriculture","rolnictwo",350),
("ahead","przed; naprzód",351),("aid","pomoc; pomagać",352),("aim","cel; celować",353),("aircraft","samolot",354),("alarm","alarm; niepokój",355),
("alcohol","alkohol",356),("alive","żywy",357),("alliance","sojusz",358),("allocate","przydzielać",359),("alter","zmieniać",360),
("ambitious","ambitny",361),("ancient","starożytny",362),("anger","gniew",363),("annual","roczny",364),("apart","osobno; oprócz",365),
("appeal","apel; odwoływać się",366),("apply","aplikować; stosować",367),("approach","podejście; zbliżać się",368),("appropriate","odpowiedni",369),("approve","zatwierdzać",370),
("argue","kłócić się; argumentować",371),("arrange","organizować; układać",372),("arrest","aresztować",373),("arrive","przybywać",374),("aspect","aspekt",375),
("assign","przypisywać",376),("assist","pomagać",377),("assume","zakładać",378),("attach","dołączać",379),("attend","uczestniczyć",380),
("attract","przyciągać",381),("authority","władza; autorytet",382),("aware","świadomy",383),("awful","okropny",384),("balance","równowaga; saldo",385),
("barely","ledwo",386),("bargain","okazja; targować się",387),("barrier","bariera",388),("battle","bitwa; walka",389),("beat","pokonać; bić",390),
("bedroom","sypialnia",391),("behaviour","zachowanie",392),("belong","należeć",393),("beneath","poniżej; pod",394),("benefit","korzyść",395),
("beyond","poza",396),("billion","miliard",397),("birth","narodziny",398),("block","blok; blokować",399),("bond","więź; obligacja",400),
("border","granica",401),("bother","przeszkadzać",402),("brave","odważny",403),("breath","oddech",404),("brief","krótki",405),
("broad","szeroki",406),("budget","budżet",407),("burden","ciężar",408),("calm","spokojny; uspokajać",409),("capable","zdolny",410),
("capture","schwytać; uchwycić",411),("careful","ostrożny",412),("carry","nieść; nosić",413),("cast","obsada; rzucać",414),("cause","powód; powodować",415),
("cease","przestawać",416),("central","centralny; główny",417),("century","stulecie",418),("certain","pewny",419),("chain","łańcuch",420),
("challenge","wyzwanie",421),("chance","szansa; przypadek",422),("channel","kanał",423),("character","charakter; postać",424),("charge","opłata; oskarżać",425),
("check","sprawdzać",426),("chemical","chemiczny",427),("chief","główny; szef",428),("choice","wybór",429),("circumstance","okoliczność",430),
("citizen","obywatel",431),("civil","cywilny",432),("claim","twierdzić; roszczenie",433),("climate","klimat",434),("climb","wspinać się",435),
("collect","zbierać",436),("combine","łączyć",437),("comfort","komfort; pocieszać",438),("comment","komentarz",439),("commit","popełniać; zobowiązywać",440),
("compare","porównywać",441),("compete","rywalizować",442),("complex","złożony",443),("concern","troska; niepokoić",444),("conduct","prowadzić; zachowanie",445),
("conflict","konflikt",446),("confuse","mylić",447),("connect","łączyć; podłączać",448),("conscious","świadomy",449),("consequence","konsekwencja",450),
]
conn = sqlite3.connect(DB)
conn.executemany("INSERT OR IGNORE INTO coca_words (word,translation,frequency_rank) VALUES (?,?,?)", WORDS)
conn.commit()
conn.close()
print(f"Inserted {len(WORDS)} words batch 1")
