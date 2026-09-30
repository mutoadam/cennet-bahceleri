# Sakarya Vaaz Q4 Checkpoint - 2026-09-28

## Durum

AŞAMA 2A tamamlandı ve production Supabase'e uygulandı.

Hazır altyapı:
- programs.event_date DATE NULL
- programs.speaker_role TEXT NULL
- Tarihi geçen tek seferlik programların public görünürlüğü RLS ile kapanıyor.
- Admin geçmiş kayıtları görmeye devam ediyor.
- Program türleri:
  - Cuma Vaazı
  - Cumartesi Vaazı
  - Hafta İçi Vaazı / İrşad
- Android source değişikliği yapılmadı.

## AŞAMA 2B

AŞAMA 2B henüz tamamlanmadı.
Production program importu yapılmadı.
AŞAMA 2C'ye geçilmedi.

Önceki otomatik extraction sonuçları doğrulanmış final veri kabul edilmemelidir.

Son kaynak kontrollerinde doğrulanan kritik değerler:

### Page 2 - İdareciler
Unique program kontrol değeri: 40

### Page 5 - Cezaevi Vaizleri
Total assignment kontrol değeri: 131

Cezaevi Vaizi personel unvanıdır.
Normal halka açık camilerdeki görevlendirmeler PUBLIC'tir.
Sakarya Açık Ceza İnfaz Kurumu gibi kurum içi mekanlar ayrı değerlendirilmelidir.

### Page 6 - Emekliler
Program kontrol değeri: 77

Tarih bazlı dolu hücre sayıları:
02.10.2026 = 7
09.10.2026 = 5
16.10.2026 = 8
23.10.2026 = 4
30.10.2026 = 8
06.11.2026 = 4
13.11.2026 = 7
20.11.2026 = 5
27.11.2026 = 8
04.12.2026 = 4
11.12.2026 = 7
18.12.2026 = 5
25.12.2026 = 5
TOTAL = 77

Page 3 ve Page 4 henüz aynı kesin yöntemle final doğrulanmadı.

## Work PC staging

C:\Users\Administrator\Desktop\cennet-vaaz-2026-q4-stage\

Son staging run:
run_RECHECK2_2026-09-28T15-14-00-750Z

Desktop staging dosyaları Git checkpoint'ine dahil değildir.
Ev bilgisayarında eski staging sayılarını doğrulanmış final veri kabul etme.

## Devam Kuralı

Ev bilgisayarında:
1. Bu checkpoint branch çekilecek.
2. Page 3 ve Page 4 doğrudan PDF tablosundan kesin sütun/hücre yöntemiyle doğrulanacak.
3. Sonra tüm sayfalar birleştirilecek.
4. Venue matching yapılacak.
5. AŞAMA 2C ancak final veri doğrulandıktan sonra yapılacak.

---

# 2026-09-29 Gece Checkpoint Güncellemesi

## AŞAMA 2B - Yeni Doğrulanan Sayfalar

Page 3 - İl Vaizleri:

- Cuma Vaazı = 77
- Hafta İçi Vaazı / İrşad = 8
- Public Total = 85
- Mirror duplicate = 4
- Cuma matrix non-venue duty = 31
  - 18 İlçe İrşad
  - 13 Mustafa Keskin / Fetva Nöbeti

Page 4 - Fetva / ADRB Vaizleri:

- Cuma Vaazı public = 90
- Hafta İçi public = 4
- Manual / closed = 1
- Public Total = 94
- Mirror duplicate = 1
- Cuma matrix non-venue duty = 2

Verified staging output:

C:\Users\PC\Desktop\cennet-vaaz-2026-q4-stage\run_HOME_P34_2026-09-29T01-38-50\

Bu Desktop staging klasörü Git'e alınmayacak.
Kaynak doğrulama için yerel çalışma çıktısıdır.

## Önceden Doğrulanan Kontrol Değerleri

Page 2:
- Public unique program = 40

Page 5:
- Total assignment = 131
- 118 public
- 13 Sakarya Açık Ceza İnfaz Kurumu / manual-closed

Page 6:
- Public program = 77

## Yarın Devam

Önce final RAW dataset tamamlanacak.

Beklenen public dağılım kontrolü:

- Page 2 = 40
- Page 3 = 85
- Page 4 = 94 public + 1 manual
- Page 5 = 118 public + 13 manual
- Page 6 = 77
- Page 7 = 14
- Page 8 = 13

Beklenen toplam:

- PUBLIC = 441
- MANUAL/CLOSED = 14
- NON-MILITARY TOTAL = 455

Beklenen public program türleri:

- Cuma Vaazı = 416
- Cumartesi Vaazı = 13
- Hafta İçi Vaazı / İrşad = 12

Bu sayılar PDF kaynak kayıtlarıyla birebir doğrulanmadan AŞAMA 2C import yapılmayacak.

# ADMIN PANEL - YENİ GEREKSİNİM

Sakarya İl Müftülüğü toplu vaaz kayıtları normal programlarla karışık şekilde yönetilmemeli.

Admin panelinde ayrı bir yönetim görünümü / bölümü oluşturulacak:

"Müftülük Vaaz Programları"

Bu bölüm mevcut public.programs kayıtlarını kullanacak.
Yeni paralel program tablosu oluşturulmayacak.

Amaç yalnız Admin yönetimini kolaylaştırmaktır.
Android veri akışı değişmeyecek.

## Batch Ayrımı

source ortak kalabilir:

sakarya_muftuluk_2026_q4

import_batch_id program türüne göre ayrılacak:

Cuma:
sakarya_muftuluk_2026_q4_cuma

Cumartesi:
sakarya_muftuluk_2026_q4_cumartesi

Hafta İçi:
sakarya_muftuluk_2026_q4_haftaici

Gerekirse manual/inceleme kayıtları:

sakarya_muftuluk_2026_q4_manual

Bu sayede Admin panelinde:

- Tümü
- Cuma Vaazları
- Cumartesi Vaazları
- Hafta İçi Vaazları
- İnceleme Gerekenler

şeklinde filtrelenebilir.

Yeni programları kopyalayan ayrı DB oluşturma.
Mevcut programs + source + import_batch_id kullanılacak.

## Admin Bölümü Kuralları

Admin panelindeki ayrı Müftülük Vaaz Programları bölümünde en az:

- Program türü
- Tarih
- Cami
- İlçe
- Hoca
- Hoca unvanı
- Vaaz konusu
- Batch
- Durum
- Süresi Doldu durumu

görülebilmeli.

Toplu batch işlemleri ileride:

- batch görüntüleme
- batch filtreleme
- gerekirse batch bazlı active/inactive

için kullanılabilir.

DELETE / toplu mutation otomatik yapılmayacak.

## Kritik Durum

AŞAMA 2C henüz yapılmadı.
Production vaaz program importu = 0.

Admin ayrı bölüm/batch işi de henüz yapılmadı.
Bu yalnız yarın uygulanacak gereksinim olarak checkpoint'e eklendi.


---

# CHECKPOINT UPDATE — 2026-09-30 / VENUE MATCHING

## AŞAMA 2B — FINAL RAW VERIFIED

Final RAW output:

C:\Users\PC\Desktop\cennet-vaaz-2026-q4-stage\run_HOME_FINAL_RAW_2026-09-29T21-14-00\

Exact verified totals:

- Page 2 Public: 40
- Page 3 Public: 85
  - Cuma: 77
  - Hafta İçi: 8
- Page 4 Public: 94
  - Cuma: 90
  - Hafta İçi: 4
- Page 4 Manual: 1
- Page 5 Public: 118
- Page 5 Manual: 13
- Page 6 Public: 77
- Page 7 Public: 14
- Page 8 Public: 13

Final type totals:

- Cuma Vaazı: 416
- Cumartesi Vaazı: 13
- Hafta İçi Vaazı / İrşad: 12
- PUBLIC TOTAL: 441
- MANUAL/CLOSED: 14
- TOTAL NON-MILITARY: 455

Other exact checks:

- event_date NULL: 12
- district NULL: 0
- teacher NULL: 0
- venue NULL: 0
- duplicate count: 0

No production DB writes were performed.

---

## AŞAMA 2C-1 — FIRST VENUE MATCH

Production public.mosque_locations exact total:

- 1278

Initial match:

- PUBLIC: 441
- EXACT: 27
- NORMALIZED: 0
- CANDIDATE: 0
- UNMATCHED: 414

Output:

C:\Users\PC\Desktop\cennet-vaaz-2026-q4-stage\run_HOME_VENUE_MATCH_2026-09-29T21-51-32\

Initial matcher was found to be too strict / structurally incorrect.

---

## AŞAMA 2C-2A — VENUE AUDIT

Output:

C:\Users\PC\Desktop\cennet-vaaz-2026-q4-stage\run_HOME_VENUE_AUDIT_2026-09-29T23-00-09\

Findings:

- Source unique venue count: 416
- Safe-normalized unique count: 416
- Production mosque_locations: 1278
- mosque_locations.district semantics: MIXED
- Known venue lookup: 10 found / 0 not found

Important:

Source PDF official district and mosque_locations.district cannot be treated as strict identical geographic levels.

District hard-filter must NOT be used.

---

## AŞAMA 2C-2B — MATCHER CALIBRATION

Output:

C:\Users\PC\Desktop\cennet-vaaz-2026-q4-stage\run_HOME_MATCHER_CALIBRATION_2026-09-29T23-08-02\

Spot 25:

- OBVIOUS_MATCH: 5
- AMBIGUOUS: 12
- NO_CREDIBLE_MATCH: 8

Known positive controls:

- Safe auto-match: 10/10
- Ambiguous: 0
- Missed: 0

False-positive negative controls:

- Correctly rejected: 20/20
- False accepted: 0

Approved conceptual match classes:

- EXACT
- NORMALIZED_SAFE
- HIGH_CONFIDENCE
- AMBIGUOUS
- NO_MATCH

Similarity score alone must never determine a match.

---

## AŞAMA 2C-3 — FINAL VENUE MATCH ATTEMPT

Output:

C:\Users\PC\Desktop\cennet-vaaz-2026-q4-stage\run_HOME_FINAL_MATCH_2026-09-30T00-55-36\

Exact program-row totals:

- PUBLIC: 441
- EXACT: 27
- NORMALIZED_SAFE: 0
- HIGH_CONFIDENCE: 0
- AMBIGUOUS: 12
- NO_MATCH: 402

Sum = 441

Unique venue total:

- 416
- EXACT: 27
- NORMALIZED_SAFE: 0
- HIGH_CONFIDENCE: 0
- AMBIGUOUS: 12
- NO_MATCH: 377

Coordinate totals:

- Latitude filled: 14
- Longitude filled: 14
- Lat + lng both filled: 14
- Uncoordinated: 427

PUBLIC_READY:

- 14

PUBLIC_MANUAL_MATCH_REVIEW:

- 427

---

## CUMA / 10 KM READINESS

Cuma total:

- 416

Cuma match:

- EXACT: 25
- NORMALIZED_SAFE: 0
- HIGH_CONFIDENCE: 0
- AMBIGUOUS: 12
- NO_MATCH: 379

Coordinates:

- Coordinated: 12
- Uncoordinated: 404

10 KM coordinate coverage:

- 12 / 416
- 2.88%

This is NOT sufficient for production 10 KM behavior yet.

DO NOT import yet.
DO NOT create 10 KM RPC yet.

---

## IMPORTANT OPEN ISSUE

There is a mismatch requiring audit:

- EXACT program matches: 27
- Coordinated programs: 14

Therefore 13 EXACT-labelled program rows currently do not have usable latitude/longitude.

Before any further matcher application or production import, determine whether this is caused by:

1. mosque_locations records themselves having NULL coordinates,
2. matcher failing to transfer coordinates,
3. a mixture of both.

Also determine why HIGH_CONFIDENCE = 0 despite production mosque_locations containing 1278 records and all 10 known positive-control venues being found.

---

## NEXT STEP

Next exact task:

AŞAMA 2C-3A — MATCH FAILURE AUDIT

Goals:

1. Audit the 13 EXACT-but-uncoordinated records.
2. Determine DB-coordinate-missing vs matcher-transfer-bug exact counts.
3. Audit at least 60 real NO_MATCH records against production mosque_locations.
4. Inspect source-vs-DB naming differences.
5. Explain HIGH_CONFIDENCE = 0 with exact rejection counts.
6. Calculate mosque_locations overall coordinate coverage.
7. Do not change match status.
8. Do not apply coordinates.
9. Do not import programs.
10. Do not create 10 KM RPC.

Production DB writes remain forbidden until this audit is complete.

---

## SOURCE PDF IDENTITY LOCK

Canonical source PDF on HOME PC:

C:\Users\PC\Downloads\vaizler listesi(1).pdf

SHA256:

0AF584DA1A9E31EB0E91AA8544951FC22ADBFACA07B791223BBE2A0BB6A847E8

RULE FOR WORK PC:

The work-PC PDF must NOT be trusted by filename alone.

Before using it, calculate SHA256 with Get-FileHash.

Only if the WORK-PC PDF SHA256 is exactly:

0AF584DA1A9E31EB0E91AA8544951FC22ADBFACA07B791223BBE2A0BB6A847E8

may it be treated as the same canonical source PDF.

If hash differs:
STOP.
Do not extract/rebuild vaaz data from that PDF.

IMPORTANT:
The verified HOME staging chain remains authoritative.
Do not regenerate AŞAMA 2B / venue outputs on the work PC merely because the PDF exists there.

---

## CHECKPOINT UPDATE — 2026-09-30 / AŞAMA 2C-3D INTERRUPTED

AŞAMA 2C-3D Classification Delta Audit başlatıldı ancak coding model:

RESOURCE_EXHAUSTED

hatası nedeniyle tamamlanamadı.

Bu nedenle AŞAMA 2C-3D için henüz güvenilir final sonuç YOKTUR.

Son doğrulanmış durum AŞAMA 2C-3C'dir.

### AŞAMA 2C-3C VERIFIED

PUBLIC:
441

Match classes:

- EXACT: 22
- NORMALIZED_SAFE: 0
- HIGH_CONFIDENCE: 0
- AMBIGUOUS: 14
- NO_MATCH: 405

Coordinates:

- Coordinated: 22
- Uncoordinated: 419

PUBLIC_READY:
22

PUBLIC_MANUAL_REVIEW:
419

### CUMA

Total:
416

- EXACT: 20
- AMBIGUOUS: 13
- NO_MATCH: 383

Coordinates:

- Coordinated: 20
- Uncoordinated: 396

10 KM coordinate coverage:
4.81%

### TRANSFER BUG VALIDATION

3 MATCHER_TRANSFER_BUG kaydı staging tarafında başarıyla koordinat aldı:

3 / 3 FIXED

### RECLASSIFICATIONS

prog_exact_5:
EXACT -> AMBIGUOUS

prog_exact_8:
EXACT -> AMBIGUOUS

### OPEN ISSUE

Önceki EXACT:

27

Yeni EXACT:

22

Bilinen intentional loss:

2 kayıt

- prog_exact_5
- prog_exact_8

Bu nedenle 3 ek EXACT kaybının nedeni henüz kesinleşmemiştir.

AŞAMA 2C-3D'nin amacı:

- old/new 441 kayıt transition matrix üretmek
- EXACT -> başka sınıf geçen tüm kayıtları bulmak
- beklenmeyen EXACT kayıplarının root cause'unu belirlemek
- NO_MATCH 402 -> 405 artışını açıklamak
- AMBIGUOUS 12 -> 14 artışını doğrulamak
- coordinate 14 -> 22 artışını kayıt bazında doğrulamak

### NEXT STEP ON HOME PC

AŞAMA 2C-3D – CLASSIFICATION DELTA AUDIT

yeniden çalıştırılacak.

Bu audit tamamlanmadan:

- production import YOK
- 419 kayıt admin review queue YOK
- mosque_locations coordinate update YOK
- 10 KM RPC YOK
- matcher final kabulü YOK
