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
