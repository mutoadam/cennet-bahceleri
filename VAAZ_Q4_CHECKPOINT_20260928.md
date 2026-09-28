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

