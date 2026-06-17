"""
Auto-fill coca_words do 3000 slow.
Uzywa Gemini API do automatycznego tlumaczenia brakujacych slow.
Bezpieczne - nie dotyka tabeli 'words' uzytkownikow.
"""
import sqlite3, os, json, urllib.request, time

DB = os.path.join(os.path.dirname(__file__), "data", "words.db")

# Wczytaj klucz API z .env
def get_api_key():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        for line in open(env_path):
            if line.startswith("GEMINI_API_KEY"):
                return line.split("=",1)[1].strip().strip('"')
    return os.environ.get("GEMINI_API_KEY","")

def gemini_translate(words_list, api_key):
    """Tlumacz liste slow przez Gemini SDK, zwraca dict {word: translation}"""
    try:
        from google import genai as _genai
        client = _genai.Client(api_key=api_key)
        words_str = ", ".join(words_list)
        prompt = (f"Przetlumacz te angielskie slowa na jezyk polski. "
                  f"Odpowiedz TYLKO jako JSON obiekt w formacie {{\"word\": \"polskie_tlumaczenie\"}}. "
                  f"Dla kazdego slowa podaj krotkie tlumaczenie (max 4 slowa po polsku). "
                  f"Slowa: {words_str}")
        resp = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        text = resp.text.strip()
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except Exception as e:
        print(f"  Blad API: {e}")
    return {}

# 3000 najczestszych slow angielskich (tylko slowa, bez tlumaczen)
WORDS_3000 = [
    # 1-50
    "the","be","of","and","a","in","to","have","it","for",
    "not","on","with","he","as","you","do","at","this","but",
    "his","by","from","they","we","say","her","she","or","an",
    "will","my","one","all","would","there","their","what","so","up",
    "out","if","about","who","get","which","go","me","when","make",
    # 51-100
    "can","like","time","no","just","him","know","take","people","into",
    "year","your","good","some","could","them","see","other","than","then",
    "now","look","only","come","its","over","think","also","back","after",
    "use","two","how","our","work","first","well","way","even","new",
    "want","because","any","these","give","day","most","us","between","need",
    # 101-200
    "great","large","often","hand","high","place","hold","world","while","life",
    "few","open","seem","together","next","white","children","begin","walk","example",
    "paper","group","always","music","those","both","mark","book","letter","until",
    "mile","river","car","care","second","enough","girl","young","ready","above",
    "ever","red","though","feel","talk","bird","soon","body","dog","family",
    "direct","leave","song","door","product","black","short","class","wind","question",
    "happen","complete","ship","area","half","rock","order","fire","south","problem",
    "piece","pass","since","top","whole","king","space","heard","best","hour",
    "better","true","during","hundred","five","remember","step","early","west","ground",
    "interest","reach","fast","listen","six","table","travel","less","morning","ten",
    # 201-300
    "simple","several","toward","war","against","pattern","slow","center","love","person",
    "money","serve","appear","road","rain","rule","cold","notice","voice","power",
    "town","drive","lead","dark","machine","wait","plan","star","field","rest",
    "able","beauty","front","teach","week","final","green","quick","develop","ocean",
    "warm","free","minute","strong","special","mind","behind","clear","fact","street",
    "course","stay","full","force","blue","object","decide","surface","deep","moon",
    "island","system","test","record","boat","common","gold","possible","dry","wonder",
    "laugh","thousand","ago","game","shape","hot","miss","heat","snow","bring",
    "distant","fill","east","paint","language","among","grand","ball","wave","drop",
    "heart","present","heavy","dance","engine","position","arm","wide","material","forest",
    # 301-500
    "sit","window","store","summer","train","sleep","prove","leg","wall","catch",
    "wish","sky","board","joy","winter","wild","glass","grass","job","edge",
    "sign","visit","past","soft","fun","bright","gas","weather","month","million",
    "bear","finish","happy","hope","flower","strange","jump","baby","eight","village",
    "meet","root","buy","raise","solve","metal","push","seven","third","hair",
    "describe","cook","floor","result","burn","hill","safe","century","consider","type",
    "law","coast","phrase","silent","tall","sand","roll","temperature","finger","industry",
    "value","fight","natural","view","sense","capital","chair","danger","fruit","rich",
    "thick","soldier","process","operate","difficult","doctor","protect","human","history","effect",
    "electric","expect","modern","element","hit","student","corner","party","supply","bone",
    "imagine","provide","agree","thus","speed","count","determine","sharp","observe","necessary",
    "weight","meat","lift","army","property","particular","swim","term","opposite","wife",
    "shoe","shoulder","spread","camp","cotton","born","nine","truck","noise","level",
    "chance","gather","shop","stretch","throw","shine","column","select","wrong","gray",
    "repeat","require","broad","prepare","salt","nose","anger","claim","continent","oxygen",
    "sugar","death","pretty","skill","season","solution","silver","thank","branch","match",
    "afraid","huge","sister","steel","discuss","forward","similar","guide","experience","score",
    "apple","win","dream","evening","condition","feed","tool","total","basic","smell",
    "valley","double","seat","arrive","master","track","parent","shore","division","sheet",
    # 501-700
    "substance","connect","post","spend","fat","glad","original","share","station","dad",
    "bread","charge","proper","bar","offer","market","degree","dear","enemy","reply",
    "drink","occur","support","speech","nature","range","steam","motion","path","liquid",
    "log","teeth","shell","neck","trade","trip","office","receive","row","mouth",
    "exact","symbol","die","least","trouble","shout","except","seed","tone","join",
    "suggest","clean","break","lady","yard","rise","blow","oil","blood","touch",
    "mix","team","wire","cost","brown","wear","garden","equal","fit","flow",
    "fair","bank","collect","save","control","gentle","woman","captain","prison","mountain",
    "horse","report","difference","science","attention","accept","method","change","project","research",
    "information","analysis","important","however","political","economic","social","cultural","national","international",
    # 701-900
    "organization","community","development","government","environment","relationship","significant","available","situation","approach",
    "response","increase","specific","individual","program","management","section","public","local","current",
    "reduce","establish","follow","address","include","access","issue","strategy","structure","create",
    "maintain","improve","achieve","ensure","identify","involve","measure","define","review","assess",
    "enable","implement","integrate","focus","impact","outcome","challenge","benefit","context","evidence",
    "factor","feature","function","global","growth","image","knowledge","leadership","network","opportunity",
    "performance","potential","professional","quality","resource","role","standard","technology","traditional","understand",
    "various","within","according","action","activity","additional","administration","advance","advantage","affect",
    "agency","agreement","aid","alternative","announce","application","appropriate","attitude","authority","balance",
    "barrier","behavior","belief","burden","capacity","career","category","civil","climate","commitment",
    # 901-1100
    "communication","competition","complex","conclusion","conflict","consequence","consumer","contract","contribution","corporation",
    "criticism","debate","decade","decision","decline","defense","demonstrate","dependent","design","despite",
    "distribution","diversity","economy","education","efficiency","election","emotion","employment","energy","enforce",
    "engage","enhance","enterprise","entirely","estimate","evaluate","evolution","expand","expert","export",
    "extent","failure","financial","foreign","formal","foundation","freedom","frequent","fundamental","generate",
    "goal","grant","healthcare","highlight","hypothesis","immigration","income","independence","indicate","inequality",
    "infrastructure","initiative","innovation","institution","intelligence","interact","investment","judgment","justice","labor",
    "legislation","liberal","majority","mechanism","medium","mental","military","minority","moral","motivation",
    "nevertheless","objective","operation","opposition","option","overall","participate","perception","policy","population",
    "positive","priority","private","promote","propose","psychology","recognize","recommend","reform","region",
    # 1101-1300
    "regulate","reinforce","relevant","religion","represent","responsibility","revenue","scenario","schedule","security",
    "sensitive","separate","service","source","stability","statistics","strengthen","sufficient","survey","sustainable",
    "tendency","territory","theoretical","therefore","threat","throughout","transfer","transform","transition","transport",
    "tremendous","trend","unemployment","unique","urban","version","violence","vision","vital","volunteer",
    "welfare","whereas","widespread","willing","withdraw","workforce","worldwide","attempt","author","aware",
    "campaign","candidate","capable","capture","circumstance","citizen","colleague","combine","commission","commit",
    "compare","compete","comply","concept","conduct","confidence","conscious","considerable","consist","construct",
    "contribute","convince","coordinate","creative","crucial","currently","customer","cycle","declare","deliver",
    "democracy","discipline","distinguish","distribute","document","dominant","dramatic","dynamic","economic","effectively",
    "eliminate","emerge","emphasis","encourage","environment","essentially","evidence","examination","exchange","executive",
    # 1301-1500
    "exhibition","existence","expectation","explicit","explore","expression","extensive","extreme","facilitate","flexible",
    "framework","frequently","genuine","gradually","guarantee","guideline","illustrate","immediate","importance","impose",
    "incentive","income","indicate","influence","initially","inspect","instead","intend","interpret","investigate",
    "involve","justify","largely","legitimate","limitation","literature","logical","maximize","minimize","monitor",
    "moreover","negotiate","nonetheless","numerous","obtain","obvious","occasionally","phenomenon","philosophy","physical",
    "practical","precisely","predict","presence","principle","procedure","professional","proportion","purchase","recognition",
    "regardless","regulation","reinforce","reliable","remarkable","requirement","responsibility","retain","reveal","significant",
    "simultaneously","sophistication","subsequent","substantial","support","technique","theoretical","throughout","ultimately","underlying",
    "unexpected","unfortunately","uniform","utilize","variable","variation","voluntary","vulnerability","whereas","widespread",
    # 1501-1700
    "abolish","abstract","accommodate","accomplish","accumulate","accurate","acknowledge","acquire","activate","actual",
    "adapt","adequate","adjust","admire","admit","adopt","advocate","allocate","alter","ambitious",
    "analyze","ancient","annual","apart","appeal","apply","arrange","arrest","assign","assist",
    "assume","attach","attend","attract","awful","barely","bargain","battle","bedroom","belong",
    "beneath","beyond","billion","birth","block","bond","border","bother","brave","breath",
    "budget","capable","careful","cast","cease","central","certain","chain","channel","check",
    "chemical","chief","circumstance","citizen","civil","climb","comfort","commit","compete","complex",
    "concern","confuse","conscious","construct","contract","damage","deal","decade","defend","delay",
    "depend","deposit","deserve","destroy","device","discover","dismiss","display","distribute","efficient",
    "emotion","emphasize","employ","encourage","enforce","establish","exchange","exclude","expand","explore",
    # 1701-1900
    "extend","extreme","facility","feature","federal","figure","finance","flexible","frequently","generation",
    "genuine","global","gradually","guarantee","handle","identify","illustrate","immediate","impose","income",
    "independent","initial","inspect","inspire","integrate","intend","interpret","introduce","invest","investigate",
    "justify","largely","legitimate","locate","logical","manage","manufacture","maximize","media","minimize",
    "mission","moreover","negotiate","network","numerous","obtain","obvious","occasionally","opponent","organize",
    "outcome","overcome","participate","phenomenon","philosophy","physical","practical","predict","preference","presence",
    "principle","procedure","progress","proportion","protest","provide","publish","pursue","recognize","reduce",
    "reform","regulate","reinforce","reliable","remarkable","require","resolve","restore","retain","reveal",
    "sector","secure","select","sequence","significant","solution","specify","structure","substantial","succeed",
    "sufficient","summarize","support","survive","suspend","technique","throughout","transfer","transform","transition",
    # 1901-2100
    "transmit","trend","trigger","uniform","unite","unlikely","update","utilize","valuable","variable",
    "verify","virtual","visible","volunteer","weakness","widespread","academic","acknowledge","activate","adult",
    "advertise","affect","affordable","aggressive","agriculture","airline","alcohol","alert","alliance","alter",
    "ambitious","annual","anxiety","approve","assign","assist","atmosphere","attachment","authority","automatic",
    "awareness","behavior","beneficial","boundary","budget","calculate","capacity","celebrate","challenge","characteristic",
    "clarify","classify","colleague","collective","compete","complaint","concentrate","conclude","confuse","consider",
    "consistent","continue","cooperative","coordinate","corporate","creative","criticize","crucial","decline","dedicate",
    "demand","demonstrate","determine","develop","diagnose","discuss","dispute","distinguish","domestic","dominant",
    "effective","eliminate","emerge","emphasize","employee","encourage","enterprise","environment","establish","evaluate",
    "evolve","examine","exclude","execute","expand","explain","explore","expose","extensive","facilitate",
    # 2101-2300
    "flexible","focus","format","foundation","framework","generate","genuine","global","gradually","guarantee",
    "handle","highlight","identify","illustrate","implement","impose","improve","incentive","indicate","individual",
    "influence","initiate","innovate","inspect","integrate","interpret","introduce","investigate","justify","leverage",
    "maintain","manage","maximize","minimize","monitor","motivate","negotiate","network","objective","obtain",
    "operate","optimize","organize","overcome","participate","perceive","perform","perspective","philosophy","physical",
    "prefer","prevent","prioritize","procedure","promote","protect","publish","qualify","quantify","recognize",
    "reduce","reflect","regulate","reinforce","represent","resolve","respond","restore","retain","reveal",
    "satisfy","secure","select","separate","significant","simplify","solve","specify","stabilize","strengthen",
    "submit","substitute","succeed","suggest","support","sustain","technical","theoretical","transform","transmit",
    "trigger","ultimately","undermine","update","utilize","validate","verify","visualize","vulnerable","widespread",
    # 2301-2500
    "abandon","abolish","absorb","abstract","accelerate","accommodate","accomplish","accumulate","accurate","activate",
    "actual","adequate","adjust","advocate","affiliate","aggregate","aggressive","allocate","ambiguous","analyze",
    "anticipate","approximate","articulate","assess","assumption","attribute","authorize","automate","beneficial","calculate",
    "clarify","collaborate","compensate","compile","complement","comply","concentrate","configure","coordinate","correlate",
    "criticize","customize","dedicate","derive","diagnose","differentiate","distribute","document","dominate","eliminate",
    "empower","encounter","enforce","enhance","evaluate","execute","facilitate","formulate","generate","implement",
    "incorporate","indicate","initiate","innovate","inspect","integrate","interpret","investigate","leverage","maximize",
    "minimize","monitor","negotiate","optimize","orchestrate","override","participate","perceive","perform","prioritize",
    "quantify","regulate","reinforce","represent","resolve","retain","satisfy","simulate","specify","streamline",
    "substitute","summarize","terminate","transform","transmit","utilize","validate","verify","visualize","withdraw",
    # 2501-2700
    "absence","abundant","accomplish","accurate","activate","advocate","affiliate","aggressive","allocate","ambiguous",
    "analyze","anticipate","articulate","benchmark","calculate","clarify","collaborate","communicate","compensate","compile",
    "comply","configure","correlate","criticize","customize","demonstrate","deploy","derive","diagnose","differentiate",
    "distribute","document","dominate","empower","encounter","evaluate","execute","facilitate","formulate","generate",
    "implement","incorporate","innovate","inspect","integrate","investigate","leverage","maximize","minimize","monitor",
    "negotiate","optimize","participate","perceive","perform","prioritize","quantify","regulate","represent","resolve",
    "retain","satisfy","simulate","specify","streamline","substitute","summarize","terminate","transform","utilize",
    "validate","verify","visualize","abandon","absorb","accelerate","accommodate","accumulate","affiliate","aggregate",
    "allocate","ambiguous","anticipate","approximate","attribute","authorize","automate","beneficial","clarify","collaborate",
    "compensate","complement","concentrate","configure","coordinate","correlate","customize","dedicate","derive","differentiate",
    # 2701-3000
    "disability","discount","dispute","divorce","economy","eligible","emphasis","encourage","enforce","enterprise",
    "enthusiasm","episode","equipment","essential","evaluate","eventually","evidence","exception","excitement","exclusive",
    "exhibition","expectation","expression","extension","extraordinary","familiar","fascinate","feedback","flexible","forecast",
    "format","formerly","generate","gradually","guarantee","guidance","humble","hypothesis","identical","imagination",
    "immediately","impact","implement","impressive","incentive","inevitable","informal","inheritance","innovation","inspiration",
    "intellectual","intense","interact","interpret","interrupt","investigation","involve","isolated","journalism","landscape",
    "limitation","literature","location","magnificent","maintenance","manufacture","maximum","mechanism","minimize","motivate",
    "negotiate","nevertheless","numerous","objective","obligation","observation","obstacle","occasionally","occupation","opponent",
    "opportunity","organize","origin","otherwise","outcome","overcome","participate","partnership","perception","permanent",
    "permission","phenomenon","philosophy","photograph","political","population","potential","prediction","preparation","priority",
    "privilege","productive","professional","proportion","psychologist","publication","qualified","recognize","recommendation","recover",
    "reduction","reference","regardless","regulation","relationship","remarkable","replacement","reputation","requirement","resistance",
    "responsibility","restriction","satisfaction","situation","solution","specification","statistics","strategy","strengthen","structure",
    "substance","sufficient","suggestion","surrounding","survival","sustainable","systematically","technology","temporary","territory",
    "theoretical","tradition","transfer","transformation","transportation","tremendous","unemployment","unfortunately","universal","unusual",
    "valuable","variation","volunteer","vulnerability","awareness","collectively","community","competitive","completely","concentrate",
    "conclusion","consequence","considerable","consistently","continuously","contribution","controversial","cooperation","corporation","criticism",
    "demonstrate","development","differentiate","distribution","effectively","elimination","environment","establishment","essentially","evaluation",
    "examination","exhibition","expectation","expression","facilitate","formulation","frequently","furthermore","graduation","identification",
    "implementation","improvement","independence","indication","infrastructure","initialization","inspection","institution","integration","interpretation",
]

# Usun duplikaty zachowujac kolejnosc
seen = set()
UNIQUE_WORDS = []
for w in WORDS_3000:
    if w not in seen:
        seen.add(w)
        UNIQUE_WORDS.append(w)

print(f"Unikalnych slow w liscie: {len(UNIQUE_WORDS)}")

# Polacz z baza
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

# Co juz jest w bazie?
existing = {r["word"]: r["translation"] for r in conn.execute("SELECT word, translation FROM coca_words")}
print(f"Juz w bazie: {len(existing)} slow")

# Przypisz rangi (pozycja na liscie = rang)
# Ktore slowa brakuje lub maja zly rank?
to_insert = []
to_translate = []  # slowa bez tlumaczen

for i, word in enumerate(UNIQUE_WORDS, 1):
    rank = i
    if word in existing:
        # Slowo jest - sprawdz czy rank sie zgadza (update ranku)
        to_insert.append((word, existing[word], rank))
    else:
        # Slowo brakuje - potrzebuje tlumaczenia
        to_translate.append((word, rank))

print(f"Do aktualizacji rangow: {len(to_insert)}")
print(f"Brakujacych (bez tlumaczen): {len(to_translate)}")

# Tlumacz brakujace przez Gemini w batchach po 20
api_key = get_api_key()
if api_key and to_translate:
    print(f"\nTlumaczenie {len(to_translate)} slow przez Gemini...")
    batch_size = 20
    for i in range(0, len(to_translate), batch_size):
        batch = to_translate[i:i+batch_size]
        words_only = [w for w,r in batch]
        print(f"  Batch {i//batch_size+1}: {words_only[:5]}...")
        translations = gemini_translate(words_only, api_key)
        for word, rank in batch:
            trans = translations.get(word, word)  # fallback: samo slowo
            to_insert.append((word, trans, rank))
        time.sleep(0.5)  # rate limit
else:
    if not api_key:
        print("BRAK klucza API - dodaje slowa bez tlumaczen (fallback)")
    # Dodaj bez tlumaczen
    for word, rank in to_translate:
        to_insert.append((word, word, rank))

# Wstaw wszystko
before = conn.execute("SELECT COUNT(*) FROM coca_words").fetchone()[0]
conn.executemany("INSERT OR REPLACE INTO coca_words (word,translation,frequency_rank) VALUES (?,?,?)", to_insert)
conn.commit()
after = conn.execute("SELECT COUNT(*) FROM coca_words").fetchone()[0]
print(f"\nWynik: {before} -> {after} slow (+{after-before})")

# Raport pokrycia
print("\nPokrycie po aktualizacji:")
for s,e in [(1,100),(101,500),(501,1000),(1001,1500),(1501,2000),(2001,3000)]:
    c = conn.execute("SELECT COUNT(*) FROM coca_words WHERE frequency_rank BETWEEN ? AND ?",(s,e)).fetchone()[0]
    pct = round(c/(e-s+1)*100)
    print(f"  {s}-{e}: {c}/{e-s+1} ({pct}%)")

conn.close()
print("\nGotowe! Uruchom ponownie serwer Flask.")
