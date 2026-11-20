# Műszak Naptár – működés és számítások

Ez a fájl azt írja le, hogyan működik az app és hogyan számolja a bérsorokat. Célja, hogy később (akár hónapok múlva, akár egy új Claude-beszélgetésben) gyorsan át lehessen látni, mit miért csinál a program. A leírás a **v3.3.2** állapotot tükrözi. Ahol valami nincs bérpapírral igazolva, azt külön jelzem.

---

## 1. Az app felépítése dióhéjban

Az app egy sima (framework nélküli) JavaScript PWA. Három fájl a lényeg: az `index.html` a felület, a `style.css` a kinézet, a `script.js` pedig minden logikát tartalmaz. A `service-worker.js` felel a telepíthetőségért és a frissítésekért, a `manifest.json` pedig a telepített app adatait (név, ikonok) adja meg.

Minden adat a készülék böngészőjében van, a `localStorage` `berszamfejtoYearlyData` kulcsa alatt. Nincs szerver, nincs fiók. Szerkezete évenként:

```
yearlyData[év] = {
  settings:            beállítások (besorolási bér, műszakrend, gyerekek száma, 25 év alatti kedvezmény, munkakezdés, szabadság napok …)
  calendar_data:       a naptár: calendar_data[hónap 0–11][nap] = "Nappal" | "Éjszaka" | "Szabadság 12 óra" | "Táppénz" | "Túlóra 12 óra" …
  bonusEntries:        havi prémium szorzók
  restaurantEntries:   havi étterem-levonás
  egyebJovedelmEntries: havi egyéb jövedelem
  notes:               jegyzetek
}
```

Támogatott évek: 2024–2028. A számításokat a `BerszamfejtoCalculator` osztály végzi, a `calculateMonthlyValue(címke, hónap, év)` függvény egy nagy `switch`, ami minden bérsorhoz (pl. „Alapbér”, „Nettó”) kiszámolja az adott hónap értékét. Fontos tudni, hogy a számolás mindig a **naptárban lévő jelölésekből** indul ki: az app csak annyit tud, amennyit a naptárba beírtál (vagy a műszakrend generált).

---

## 2. Műszakrendek

Az 1–4-es műszakrendek 8 napos ciklusban ismétlődnek 2024. január 1-től számolva (a 4-es rendnél például a ciklus 0. és 1. napja nappal, a 4. és 5. napja éjszaka). Az A, B és C műszakrend 21 napos ciklus, amely 2025. január 6-án, 20-án és 13-án indul, és ünnepnapokon nincs műszak. A „-” beállítás hétköznapi, nem műszakos munkarend.

Műszakrend váltásakor a kézzel beírt naptár-bejegyzések (szabadság, táppénz, túlóra) **szándékosan törlődnek**, mert egy új beosztás más napokra esik. Ez nem hiba. Évközi váltásnál az „évközi váltás” funkció csak a megadott naptól érvényesíti az új rendet.

---

## 3. Az alapfogalmak

A számoláshoz négy alapszám kell, ezekből épül minden:

A **besorolási bér** a havi alapbér (a beállításokban adod meg, és évente, sőt hónaponként is változhat). A **ledolgozandó napok** azok a napok, amikor a beosztás szerint dolgoznod kellene (a hónap műszakai, ünnepnapokkal és hiányzásokkal együtt). A **ledolgozott napok** a ténylegesen ledolgozott műszakok. A **pótlék-óradíj** a besorolási bér ÷ 174 óra.

---

## 4. A bérsorok, egyenként

**Alapbér.** Besorolási bér ÷ ledolgozandó napok × ledolgozott napok. Ha hiányzol (szabadság, táppénz), arányosan kevesebb az alapbér, a hiányzásokat külön sorok fizetik.

**Hó közbeni munkakezdés.** A belépés hónapjában az osztó nem a belépéstől számolt műszakok száma, hanem a **teljes havi beosztás** (ahány műszak a műszakrend szerint az egész hónapban lenne, mintha 1-jétől dolgoznál). Az alapbér így: besorolási bér ÷ teljes havi beosztás × ledolgozott műszakok. Ugyanez az osztó érvényes a szabadság, a betegszabadság és a fizetett ünnep óradíjára. A túlóra óradíja a teljes hónap munkanapjaival (× 8) számol. A „Munkakezdés” nap 1 napnak számít a bérben és 8 órának a túlórakeretben. *Ez a módszer a cég rendes havi gyakorlatát követi (ledolgozott idő ÷ beosztott idő), valós belépő bérpapírral még nincs igazolva.*

**Szabadságra jutó fizetés.** Besorolási bér ÷ (ledolgozandó napok × 12) × szabadságos órák. Ehhez jön a **távolléti díj** pótlék-része (lásd lejjebb).

**Műszakpótlék 40%.** A ledolgozott éjszakai órák száma × pótlék-óradíj × 40%. **Hétvégi pótlék 50%:** a vasárnap ledolgozott órák × pótlék-óradíj × 50% (a szombat nem pótlékos, ezt bérpapírok is igazolják).

**Túlóra alap és túlórapótlék.** A túlóra alapja besorolási bér ÷ (a hónap munkanapjai × 8) × túlórák. A túlórapótlék pótlék-óradíj (÷ 174) alapján számolódik. Az A/B/C rendnél a vasárnapi túlóra külön, 100%-os pótlékkal számít. A túlóra keretéből (2025 decemberétől 4 hónapos elszámolás: dec–márc, ápr–júl, aug–nov, a keret a záró hónapban fizetődik ki) adódó órák is ide számítanak. A keret = a beosztott órák (műszakok × 12, plusz a munkakezdés napjának 8 órája) − a hétköznapok × 8 − a „Csúszó túlórakeretből” órák. A keretből vett csúszót egyszer kell levonni (ezt a v3.2.4 javította a túlóra óraszám sorában). Negatív keret nem ad negatív túlórapótlékot. A „Csúszó túlórából” opció a v3.2.4-ben megszűnt: műszakcserénél a műszakot kell áttenni egy másik napra, a kereten belüli csúszásra a „Csúszó túlórakeretből” való. *A keretlogika egésze nincs bérpapírral ellenőrizve.*

**Teljesítmény prémium.** Besorolási bér × 5% × a hónapra beírt prémium-szorzó. Ha a hónapban hiányzás volt, a valós bérpapíron gyakran nincs prémium; ilyenkor a prémium-szorzót érdemes 0-ra állítani.

**Fizetett ünnepnap.** Besorolási bér ÷ ledolgozandó napok × a munkaszüneti napok száma, ha az ünnep beosztott munkanapra esik. A munkaszüneti napok listája a `getHolidays()` függvényben van (fix ünnepek + húsvét és pünkösd). **December 24.** 2026-tól szerepel benne (2026. évi LXXII. törvény, hatályos 2026. november 14-től): a naptárban piros, aki dolgozik, annak ünnepnapi fizetés jár, az A/B/C rendben pedig nincs aznap műszak. A korábban előre legenerált A/B/C-s december 24-i műszakot az app egyszer, induláskor törli (`dec24Atallas()`), a kézzel beírt bejegyzéseket nem bántja.

**Adóköteles bruttó.** Az előző sorok összege (alapbér, túlóra alap, szabadság, távolléti díj, betegszabadság, fizetett ünnep, túlórapótlék, hétvégi és műszakpótlék, prémium, plusz az egyéb jövedelem). A **táppénz nem része**, mert azt a TB fizeti.

---

## 5. Járulék, adó, kedvezmények, nettó

**TB-járulék** = az adóköteles bruttó × 18,5%. A táppénz nem képez járulékalapot.

**SZJA-előleg** = 15% × (adóköteles bruttó + táppénz). A táppénz tehát adóköteles, de nem járulékköteles. Ha 25 év alatti kedvezményre vagy jogosult, az SZJA ennyivel csökken: a kisebbik érték a 15% × bruttó és a havi maximum (2026-ban **107 365 Ft/hó**, 2027-től az adat még nincs, addig ez marad).

**Családi kedvezmény.** Gyerekenként havonta: 1 gyereknél 20 000 Ft, 2 gyereknél 40 000 Ft/gyerek, 3 vagy több gyereknél 66 000 Ft/gyerek (2026). Ez adómentes, a levonásokból **vonódik le**, nem adódik a bruttóhoz. A sorrend: először az SZJA-ból, és ha az SZJA kisebb a kedvezménynél, a maradék a 18,5%-os TB-járulékból (a kedvezmény legfeljebb a fizetendő SZJA + TB erejéig érvényesül). Ezt a modellt valós bérpapírok forintra igazolják.

**Nettó** = bruttó + táppénz + egyéb jövedelem − TB − SZJA − étterem-levonás. A családi kedvezmény külön tagként nem szerepel, mert már az SZJA és a TB soraiban benne van.

**13. havi fizetés (novemberben).** A cég a 13. havit a novemberi elszámoláshoz köti (a novemberi fizetés december 9-én érkezik, a 13. havi előtte), ezért a novemberi bérszámfejtés alatt, piros vonallal elválasztva külön blokk mutatja. A bruttó a novemberi besorolási bér (1 havi bér), ebből 18,5% TB és 15% SZJA-előleg. A kedvezmények havi keretek, és a cég gyakorlata szerint **először a 13. havin** érvényesülnek: a 25 év alatti kedvezmény és a családi kedvezmény a 13. havi adója és járuléka erejéig, a novemberi rendes fizetés pedig a keret **maradékát** kapja. A két kifizetés együtt ugyanannyi nettót ad, mintha egyben számolnák el (ezt teszt ellenőrzi). Ha a valós bérpapíron a novemberi fizetésnél a maradék kedvezmény nem jelenik meg, az app mutatja, mennyinek kellett volna járnia, a különbség az adóbevallásban jön vissza. A számítás a 2025-ös „Karácsonyi pénz” bérpapírt (560 400 Ft, kedvezmény nélkül) forintra visszaadja. Ha a munkakezdés november után van, nincs 13. havi; év közben belépőnél is teljes egy havi bérrel számol (nem arányosít). *A 13. havi a táppénz alapjába jelenleg nem számít bele.*

---

## 6. Betegszabadság és táppénz

Ez a legbonyolultabb rész, ezért részletesen:

**A betegszabadság** évi 120 óra, ami 12 órás műszakoknál 10 műszak. Amíg a keret tart, a betegségi napok betegszabadságnak számítanak, a fizetés a távolléti díj 70%-a: besorolási bér ÷ (ledolgozandó napok × 12) × betegszabadság-órák × 70%, plusz a pótlék-rész (lásd lent). A keret **évente** újul. A keret fogyását az app a naptárból számolja, hónapról hónapra.

**Ha a keret elfogyott, táppénz jár** minden naptári napra, a szabadnapokra is (ezért kell a naptárban csak a beosztott napokat jelölni „Táppénz”-nek, a „Táppénz kezdete …” és „Táppénz vége …” jelölésekkel; a köztes szabadnapokat az app maga tölti ki).

**Távolléti díj pótlék-rész** (a bérpapírokon „Szabadságra távolléti díj”). Ez az átlagpótlék Ft/óra × órák. Az átlagpótlék szabálya, forintra igazolva két bérpapír-hónappal:

> a távollét hónapját megelőző **6 teljes hónap** (műszakpótlék + hétvégi pótlék, **a túlórapótlék nélkül**) ÷ ugyanezen hónapok **ledolgozott (nem túlóra) óráinak** összege

Betegszabadságnál ennek a 70%-a jár, szabadságnál a teljes érték.

**A táppénz összege** = táppénzes napok × napi táppénz. A napi táppénz = a napi átlagkereset × 60%, legfeljebb a napi plafon (a minimálbér kétszerese ÷ 30; 2026-ban 21 520 Ft). A napi átlagkeresetet a betegség kezdetén határozzák meg és végig ugyanaz marad (ezt a februári és márciusi bérpapír igazolta: ugyanaz a napi összeg).

A napi átlagkereset számítása az Ebtv. szerint, és így van az appban is:

1. Az időszak vége a betegség kezdetét megelőző **3. hónap utolsó napja**.
2. Innen visszafelé **180 figyelembe vehető naptári napot** gyűjtünk, de legfeljebb a betegség kezdete előtti naptári év január 1-jéig.
3. A **táppénzes napok kieső napok**: nem számítanak bele, a régebbi napok pótolják őket. A betegszabadság napjai igen (azok járulékköteles jövedelmek).
4. Egy hónap járulékalapját (az adóköteles bruttót) a hónap figyelembe vehető napjaira arányosítjuk, az összeget elosztjuk a gyűjtött napokkal.
5. Ha nincs 180 nap, de legalább 120 van, akkor 120 napból számolunk. 30–119 napnál a tényleges napok számával osztunk. 30 nap alatt a szerződés szerinti jövedelem (a havi bér ÷ 30) az alap.

**Pontosság.** A szabály szerkezete három valós betegség (február, június, szeptember) napi alapjával konzisztens, ha a 2025-ös hónapokra kb. 1 millió Ft/hó járulékalapot feltételezünk. Forintra pontosan nem ellenőrizhető, amíg a 2025-ös járulékalapok nincsenek meg. *A 730 napos 50%/60% szabály még nincs benne: az app mindig 60%-ot számol.*

---

## 7. Mi van bérpapírral igazolva, és mi nem

**Forintra (±1–2 Ft) egyezik valós bérpapírokkal:** az alapbér, a szabadságra jutó fizetés, a műszakpótlék és a hétvégi pótlék, a túlóra alap és a túlórapótlék, a 120 órás betegszabadság és annak 70%-a, a TB és az SZJA a családi kedvezménnyel, a táppénz kizárása a TB-alapból és beszámítása az SZJA-alapba, valamint a távolléti díj pótlékátlag szabálya.

**Nincs igazolva / ismert hiányosság:** a negyedéves túlórakeret logikája, a táppénz napi alapja forintra, az 50%/60% szabály (730 nap), az egyéb havi tételek közül a SZÉP-kártya (a valós bérpapíron a járandóság része, de nem adóköteles; az app „Egyéb jövedelem” sora viszont adózik), a kumulált (éves) SZJA- és TB-elszámolás, amit a munkáltató a hónapok között végez, az app ezt nem modellezi, ezért 1–2 forint, ritkán több eltérés előfordulhat.

---

## 8. Frissítés, verziózás, ikonok

A **service worker** hálózat-első: ha van net, mindig a legfrissebb fájlt tölti le, hálózat nélkül a gyorsítótárból dolgozik. A frissítés „titkos”: a láthatatlan átfedő réteg (overlay) a háttérben telepíti az új verziót, így a felhasználónak nem kell gombot nyomnia. Ezt szándékosan hagytuk így.

**Új verzió kiadásakor három helyen kell növelni a számot**: a `service-worker.js` `CACHE_NAME` értékét, a `script.js` `ChangelogManager.currentVersion` értékét és a `getChangelog()` új bejegyzését. Ha ezek közül valamelyik kimarad, a böngésző nem fogja észrevenni a frissítést, vagy a változásnapló nem jelenik meg.

A **képernyőmagasság** a `--app-h` CSS-változóból jön, amit a `script.js` eleje a `window.innerHeight` alapján állít: induláskor, majd 0,1–2,5 másodperc múlva többször, átméretezéskor, előtérbe kerüléskor és a bérszámfejtés megnyitásakor. Ez azért kell, mert egyes Android-telefonokon a telepített appban a `100dvh` nagyobb a látható területnél, és a lista alja kilógott (jellemzően csak első megnyitáskor, a háttérből visszatérve már jó volt). Ha ezt a változót kiveszed, a hiba visszajön.

Az **útmutató** (Információ fül, „Útmutató lépésről lépésre”) képei az `utmutato/` mappában vannak, WebP formátumban (600 px széles, összesen kb. 210 KB). Kitalált minta-adatokkal készültek a valódi appról; ha a felület változik, érdemes újrakészíteni őket.

A **kinézet** (v3.3.0-tól) két rétegből áll: a `style.css` adja az elrendezést (méretek, magasságok, animációk), a `minimal.css` pedig a kinézetet (színek, betűk, keretek), és utána töltődik be, ezért felülírja. A színek a `minimal.css` elején vannak tokenként (`--paper`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`, `--danger`), világos és sötét változatban; ha valamit át akarsz színezni, ott kell. A betűtípus IBM Plex Sans (Google Fonts), a számok egyforma szélességűek. A műszakszínek a `script.js` elején vannak: `SHIFT_COLORS` (világos) és `SHIFT_COLORS_DARK` (sötét); a naptárban a bal oldali csík a szövegszínt használja. Ha egy felhasználó korábban a régi, erős alapszíneket mentette el, azokat a program automatikusan az újakra cseréli (`SHIFT_COLORS_REGI`), a ténylegesen saját színeket viszont megtartja. A bérszámfejtés sorai `data-tetel` attribútumot kapnak (pl. `tr[data-tetel="Nettó"]`), így a CSS sorra pontosan célozhat.

A **műszak húzása** (drag & drop) a `ShiftDragDrop` osztályban van. Hosszú nyomással (0,35 mp) indul, így a sima koppintás továbbra is a napválasztó ablakot nyitja, a gyors oldalra húzás pedig hónapot vált. A böngésző beépített drag & drop-ját szándékosan nem használja, mert az érintőképernyőn nem működik; helyette pointer eseményeket figyel, és húzás közben letiltja a görgetést (`touchmove` + `preventDefault`) és a hónapváltást (`handleSwipe` megkérdezi az `isBusy()`-t). Üres napra engedve áthelyez, foglalt napra engedve felcserél; az üres nap `" "` értéket kap, különben a program újragenerálná rajta az eredeti műszakot. A megjegyzések a dátumnál maradnak. A „Munkakezdés” nap nem húzható. Utána 6 másodpercig „Visszavonás” gomb jelenik meg. Csak a látott hónapon belül lehet húzni.

Az ikonok: `icon-192.png` és `icon-512.png` (általános), `icon-maskable-192.png` és `icon-maskable-512.png` (Androidos maszkolt ikon, biztonságos margóval), `apple-touch-icon.png` (iOS, 180 px), valamint a favicon fájlok.

---

## 9. Hogyan lehet ellenőrizni a számolást

A fejlesztés során jsdom alapú tesztekkel futtattuk a számolómagot (az `index.html` + `script.js` betöltése, majd a `calculateMonthlyValue` hívása tetszőleges naptár-állapotra). A tesztek mind a bérpapírokból vett valós számokkal vetették össze az app eredményét. Új szabály beépítése előtt érdemes ugyanígy egy valós bérpapírt kiválasztani, a naptárt beállítani hozzá, és a sorokat soronként összevetni.

Ha a bérpapíron és az appban eltérés van, a leggyakoribb ok **nem a képlet**, hanem az hogy a naptár nem egyezik a valósággal: hiányzik egy szabadság, túlóra vagy táppénzes nap, vagy más a műszakrend. Az átlagpótlék és a táppénz alapja az **előző hónapok** naptárából is számol, ezért ezeknél a korábbi hónapokat is helyesen kell kitölteni.
