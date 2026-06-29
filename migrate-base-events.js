/**
 * Cennet Bahçeleri - Base Events Migration Script (Paket G2)
 * 
 * Bu script, uygulama içerisindeki baseEvents listesini Supabase public.programs tablosuna güvenli şekilde aktarır.
 * Aynı program_name + venue_name + district + day + time bilgisine sahip kayıtlar varsa bunları tekrar eklemez (Duplicate Kontrolü).
 * 
 * GÜVENLİK VE KALİTE GÜNCELLEMELERİ:
 * - Bu script bir tek seferlik (one-time) veri göçü (migration) dosyasıdır.
 * - public/client tarafında kesinlikle KULLANILMAMALIDIR (güvenlik nedeniyle).
 * - Row Level Security (RLS) politikalarını bypass etmek ve toplu ekleme yapabilmek için SUPABASE_SERVICE_ROLE_KEY gerektirir.
 * 
 * Çalıştırma Talimatı:
 * 1. Proje ana dizininde (root) terminali açın.
 * 2. .env veya .env. dosyasına SUPABASE_SERVICE_ROLE_KEY ve SUPABASE_URL değerlerini girin.
 * 3. Aşağıdaki komutu çalıştırın:
 *    node migrate-base-events.js
 * 
 * Not: Bu script modern Node.js sürümlerindeki yerleşik 'fetch' API'sini kullanır, harici kütüphane kurulumu gerektirmez.
 */

const fs = require('fs');
const path = require('path');

// 1. Supabase Kimlik Bilgilerini Yükle
let SUPABASE_URL = process.env.SUPABASE_URL;
let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const envFiles = [
    path.join(__dirname, '.env.'),
    path.join(__dirname, '.env'),
    path.join(process.cwd(), '.env.'),
    path.join(process.cwd(), '.env')
];

for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
        try {
            const content = fs.readFileSync(envFile, 'utf8');
            content.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;
                
                const index = trimmed.indexOf('=');
                if (index !== -1) {
                    const key = trimmed.substring(0, index).trim();
                    const val = trimmed.substring(index + 1).trim();
                    if (key === 'SUPABASE_URL' && !SUPABASE_URL) SUPABASE_URL = val;
                    if (key === 'SUPABASE_SERVICE_ROLE_KEY' && !SUPABASE_SERVICE_ROLE_KEY) SUPABASE_SERVICE_ROLE_KEY = val;
                }
            });
        } catch (e) {
            // Sessizce geç
        }
    }
}

// Yedek değerler veya hata kontrolü
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('HATA: Supabase URL veya Service Role Key bulunamadı.');
    console.error('Bu script veritabanı güvenliği ve bypass RLS için SUPABASE_SERVICE_ROLE_KEY gerektirir.');
    console.error('Lütfen .env veya .env. dosyasına SUPABASE_SERVICE_ROLE_KEY tanımladığınızdan emin olun.\n');
    process.exit(1);
}

// 2. Taşınacak Ham Veri Listesi (Part 1 ve Part 2 Birleşimi)
const baseEvents = [
  // --- PART 1 ---
  {
    "program_name": "Asr-ı Saadet Gençlik Sohbeti",
    "venue_name": "Çarşı İKVA",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Pazartesi",
    "time": "20:00",
    "teacher": "Muhammed İkbal Eren Hoca",
    "organization": "Asr-ı Saadet",
    "women_friendly": false,
    "address": "Çarşı İKVA",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Gençlerin manevi gelişimine katkı sağlayan, edep ve samimiyet odaklı haftalık sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "asr_saadet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Tefsir ve İlmihal",
    "venue_name": "Hz. Ömer Camii Yakını - Erenler",
    "city": "Sakarya",
    "district": "Erenler",
    "day": "Pazartesi",
    "time": "Yatsı sonrası",
    "teacher": "Mustafa Yüzücü Hoca",
    "organization": "Hz. Ömer Camii",
    "women_friendly": false,
    "address": "Hz. Ömer Camii Yakını - Erenler",
    "google_maps_link": "https://maps.google.com/?q=40.7600,30.4200",
    "description": "Kur'an-ı Kerim ayetlerinin tefsir edildiği, günlük ve pratik fıkhi meselelerin ilmihal ışığında işlendiği ders halkası.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Akaid Dersi",
    "venue_name": "Erenler / Dilmen",
    "city": "Sakarya",
    "district": "Erenler",
    "day": "Pazartesi",
    "time": "20:00",
    "teacher": "Samed Kılıç Hoca",
    "organization": "Ümmetder Erenler",
    "women_friendly": false,
    "address": "Erenler / Dilmen",
    "google_maps_link": "https://maps.google.com/?q=40.7600,30.4200",
    "description": "Ehl-i sünnet vel cemaat akaid esaslarının muteber kelam kaynakları eşliğinde okunduğu haftalık ilim meclisi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ummetder",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Yahya Emine Erdem Camii",
    "city": "Sakarya",
    "district": "Yenikent",
    "day": "Pazartesi",
    "time": "Yatsı sonrası",
    "teacher": "-",
    "organization": "Ümmetder Yenikent",
    "women_friendly": false,
    "address": "Yahya Emine Erdem Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Kardeşlik ikliminin ihya edildiği, nebevi şuur and ahlakın esas alındığı feyizli ve samimi haftalık mahalle sohbeti.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ummetder",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "İhyâü Ulûmi'd-Dîn Dersi",
    "venue_name": "Sezginler Camii",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Pazartesi",
    "time": "Yatsı öncesi",
    "teacher": "Mahmut Kayabaşı Hoca",
    "organization": "Sezginler Camii",
    "women_friendly": false,
    "address": "Sezginler Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "İmam Gazali hazretlerinin ölümsüz eseri İhyâü Ulûmi'd-Dîn'den nefis terbiyesi, ihlas ve zühd konularının okunduğu ders halkası.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Hayatü's Sahabe ve Soru Cevap",
    "venue_name": "Doğanbey Camii",
    "city": "Sakarya",
    "district": "Erenler",
    "day": "Pazartesi",
    "time": "Yatsı sonrası",
    "teacher": "Nurullah Okur Hoca",
    "organization": "Doğanbey Camii",
    "women_friendly": false,
    "address": "Doğanbey Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7600,30.4200",
    "description": "Peygamber Efendimiz (s.a.v.) ve asil sahabilerinin örnek yaşam öykülerinin işlendiği, gençlik sorularının açıklandığı feyiz meclisi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Esma-ül Hüsna Dersi",
    "venue_name": "İFAM Güneşler",
    "city": "Sakarya",
    "district": "Güneşler",
    "day": "Salı",
    "time": "20:00",
    "teacher": "-",
    "organization": "İFAM Güneşler",
    "women_friendly": false,
    "address": "İFAM Güneşler",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Yüce Rabbimizin esrarengiz şifalar ve hikmetler barındıran Esma-ül Hüsna (99 ismi) tefekkür ve şerh dersi meclisidir.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ifam",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Riyâzü's Sâlihîn Hadis Dersi",
    "venue_name": "Sapanca",
    "city": "Sakarya",
    "district": "Sapanca",
    "day": "Salı",
    "time": "Yatsı sonrası",
    "teacher": "-",
    "organization": "Ahbab-ı Kehf",
    "women_friendly": false,
    "address": "Sapanca",
    "google_maps_link": "https://maps.google.com/?q=40.6908,30.2644",
    "description": "İmam Nevevi'nin kıymetli eseri Riyâzü's Sâlihîn'den ahlaki terbiyeyi ve salih amelleri konu alan hadislerin okunduğu ders meclisi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ahbabi_kehf",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Maruf Çalışması",
    "venue_name": "Ümmetder Merkez - Adapazarı",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Salı",
    "time": "Akşam Namazı Sonrası",
    "teacher": "-",
    "organization": "Ümmetder Merkez",
    "women_friendly": false,
    "address": "Ümmetder Merkez - Adapazarı",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Maruf çalışması kapsamında gerçekleştirilen haftalık istişare ve hizmet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ummetder",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Davet Ameli",
    "venue_name": "Doğanbey Camii",
    "city": "Sakarya",
    "district": "Erenler",
    "day": "Salı",
    "time": "Yatsı sonrası",
    "teacher": "-",
    "organization": "Doğanbey Camii",
    "women_friendly": false,
    "address": "Doğanbey Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7600,30.4200",
    "description": "Davet ve tebliğ çalışmalarına yönelik haftalık ameli program.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Kampüs Camii",
    "city": "Sakarya",
    "district": "Serdivan",
    "day": "Salı",
    "time": "Yatsı sonrası",
    "teacher": "-",
    "organization": "Kampüs Camii",
    "women_friendly": false,
    "address": "Kampüs Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7603,30.3703",
    "description": "Kampüs gençliğine hitaben hazırlanan, gündelik ahlaki şuur and ibadet disiplinini aşılayan sıcak sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Sahih-i Müslim Hadis Dersi",
    "venue_name": "Hidayet Camii",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Salı",
    "time": "Yatsıdan 20 dakika önce",
    "teacher": "Mahmut Kayabaşı Hoca",
    "organization": "Hidayet Camii",
    "women_friendly": false,
    "address": "Hidayet Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Muteber hadis kaynağı Sahih-i Müslim'den nebevi sünnet şerhleri ve fıkhi çıkarımların kalplere nakşedildiği ders meclisi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Asr-ı Saadet Gençlik Sohbeti",
    "venue_name": "Tepekum Yeşil Camii Derneği",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Çarşamba",
    "time": "21:00",
    "teacher": "Muhammed İkbal Eren Hoca",
    "organization": "Asr-ı Saadet",
    "women_friendly": false,
    "address": "Tepekum Yeşil Camii Derneği",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Gençlerin manevi gelişimine katkı sağlayan ve asr-ı saadet ikliminin ruhunu gönüllere taşıyan haftalık sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "asr_saadet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Ümmetder Ferizli Haftalık Sohbet",
    "venue_name": "Ümmet Mescidi Ferizli",
    "city": "Sakarya",
    "district": "Ferizli",
    "day": "Çarşamba",
    "time": "20:00",
    "teacher": "Ömer Hoca",
    "organization": "Ümmetder",
    "women_friendly": false,
    "address": "Ümmet Mescidi Ferizli",
    "google_maps_link": "https://maps.google.com/?q=40.9131,30.4357",
    "description": "Ferizli'deki kardeşlerimizin feyiz dolu akreplerde bir araya geldiği, samimi gönül mimarı ders sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ummetder",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Ümmetder Korucuk Haftalık Sohbet",
    "venue_name": "Korucuk",
    "city": "Sakarya",
    "district": "Korucuk",
    "day": "Çarşamba",
    "time": "20:00",
    "teacher": "-",
    "organization": "Ümmetder Korucuk",
    "women_friendly": false,
    "address": "Korucuk",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Kur'an ahlakı ve nebevi adap doğrultusunda aile, toplum ve maneviyat şuurunun işlendiği haftalık meclis.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ummetder",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Teşvikiye Camii Gençlik Sohbeti",
    "venue_name": "Teşvikiye Camii",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Çarşamba",
    "time": "Yatsı sonrası",
    "teacher": "-",
    "organization": "Teşvikiye Camii",
    "women_friendly": false,
    "address": "Teşvikiye Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Genç neslin akide, şuur and dava bilinciyle donanması amacıyla kurulan samimi hasbihal ve sohbet dersi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "El-Münebbihat Hadis Dersi",
    "venue_name": "Yıldırım Camii",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Çarşamba",
    "time": "Yatsıya 20 dakika kala",
    "teacher": "Mahmut Kayabaşı Hoca",
    "organization": "Yıldırım Camii",
    "women_friendly": false,
    "address": "Yıldırım Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "İbn Hacer el-Askalânî hazretlerinin kalplere hitap eden öğüt ve ikaz hadislerinin şerh edilerek incelendiği irşad dersi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Hisar Kapısı Mütalaa Dersi",
    "venue_name": "Serdivan",
    "city": "Sakarya",
    "district": "Serdivan",
    "day": "Çarşamba",
    "time": "20:00",
    "teacher": "-",
    "organization": "Hisar Kapısı",
    "women_friendly": false,
    "address": "Serdivan",
    "google_maps_link": "https://maps.google.com/?q=40.7603,30.3703",
    "description": "Teolojik, ahlaki ve içtimai makalelerin, felsefi ve fıkhi yönleriyle derinlikli mütalaa edildiği akademik ders halkası.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": null,
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "M. Mahmud Efendi Külliyesi",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Çarşamba",
    "time": "Yatsı Namazı Sonrası",
    "teacher": "Ramazan İlhan Hoca",
    "organization": "Şûrâ-i Müceddidiyye Sakarya",
    "women_friendly": false,
    "address": "M. Mahmud Efendi Külliyesi",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Ehl-i sünnet çizgisinde haftalık sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": null,
    "status": "active",
    "source": "app_migration"
  },
  // --- PART 2 ---
  {
    "program_name": "Zikir Sofrası",
    "venue_name": "Çiftlik Camii",
    "city": "Sakarya",
    "district": "Erenler",
    "day": "Perşembe",
    "time": "Yatsı Namazı Sonrası",
    "teacher": "-",
    "organization": "Çiftlik Camii",
    "women_friendly": false,
    "address": "Çiftlik Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7635,30.4132",
    "description": "Yatsı namazı sonrasında gerçekleştirilen zikir ve sohbet halkası.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Doğanbey Camii",
    "city": "Sakarya",
    "district": "Erenler",
    "day": "Perşembe",
    "time": "Yatsı Namazı Sonrası",
    "teacher": "Nurullah Okur Hoca",
    "organization": "Doğanbey Camii",
    "women_friendly": true,
    "address": "Doğanbey Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7675,30.4190",
    "description": "Kur'an, sünnet ve günlük hayat üzerine haftalık sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Tepekum Yeşil Camii",
    "city": "Sakarya",
    "district": "Erenler",
    "day": "Perşembe",
    "time": "Yatsı Namazı Sonrası",
    "teacher": "İsmail Yaşar Hoca",
    "organization": "Tepekum Yeşil Camii",
    "women_friendly": true,
    "address": "Tepekum Yeşil Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7620,30.4230",
    "description": "Aile ve toplum hayatına yönelik haftalık sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Gençlik Sohbeti",
    "venue_name": "Ali Kuzu Camii",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Perşembe",
    "time": "Yatsı Namazı Öncesi",
    "teacher": "Mahmut Kayabaşı Hoca",
    "organization": "Ali Kuzu Camii",
    "women_friendly": false,
    "address": "Ali Kuzu Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7710,30.4045",
    "description": "Gençlerin manevi gelişimine yönelik haftalık sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Güneşler",
    "city": "Sakarya",
    "district": "Güneşler",
    "day": "Perşembe",
    "time": "20:30",
    "teacher": "-",
    "organization": "Darüsselam Güneşler",
    "women_friendly": false,
    "address": "Güneşler",
    "google_maps_link": "https://maps.google.com/?q=40.7930,30.4180",
    "description": "İslami ilimler ve ahlak konularının işlendiği haftalık sohbet.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "darusselam",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Akaid, Fıkıh ve Hadis Sohbeti",
    "venue_name": "Hacı Zehra Camii",
    "city": "Sakarya",
    "district": "Serdivan",
    "day": "Perşembe",
    "time": "20:00",
    "teacher": "-",
    "organization": "Hacı Zehra Camii",
    "women_friendly": false,
    "address": "Hacı Zehra Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7715,30.3700",
    "description": "Akaid, fıkıh ve hadis derslerinden oluşan haftalık ilim meclisi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Maltepe Mah.",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Perşembe",
    "time": "20:00",
    "teacher": "-",
    "organization": "Ümmetder Maltepe",
    "women_friendly": false,
    "address": "Maltepe Mah.",
    "google_maps_link": "https://maps.google.com/?q=40.7660,30.3950",
    "description": "Haftalık sohbet ve ilim meclisi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ummetder",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Hızırtepe Mah.",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Perşembe",
    "time": "20:00",
    "teacher": "-",
    "organization": "Ümmetder Hızırtepe",
    "women_friendly": false,
    "address": "Hızırtepe Mah.",
    "google_maps_link": "https://maps.google.com/?q=40.7580,30.3910",
    "description": "Haftalık sohbet ve ilim meclisi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ummetder",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "14 Secdeler, Esma-i Hüsna Sohbeti",
    "venue_name": "Adapazarı",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Perşembe",
    "time": "Yatsı Namazı Sonrası",
    "teacher": "-",
    "organization": "Mukadder",
    "women_friendly": false,
    "address": "Adapazarı",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Esma-i Hüsna ve zikir konularının işlendiği sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": null,
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Zikir ve Sohbet",
    "venue_name": "Sapanca",
    "city": "Sakarya",
    "district": "Sapanca",
    "day": "Perşembe",
    "time": "Yatsı Namazı ve Sonrası",
    "teacher": "Molla Mustafa Sakaryevi",
    "organization": "Osmanlı Ak Dergâhı",
    "women_friendly": false,
    "address": "Sapanca",
    "google_maps_link": "https://maps.google.com/?q=40.6930,30.2660",
    "description": "Tasavvuf, zikir ve manevi eğitim ağırlıklı sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": null,
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Buhara Camii",
    "city": "Sakarya",
    "district": "Sapanca",
    "day": "Perşembe",
    "time": "Yatsı Namazı Sonrası",
    "teacher": "Cevat Karadağ Hoca / Burak Hoca",
    "organization": "İsmailağa Sapanca",
    "women_friendly": false,
    "address": "Buhara Camii",
    "google_maps_link": "https://maps.google.com/?q=40.6950,30.2700",
    "description": "Kur'an, sünnet and günlük hayat üzerine haftalık sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Hendek Tepecik Camii Altı",
    "city": "Sakarya",
    "district": "Hendek",
    "day": "Perşembe",
    "time": "Yatsı Namazı Sonrası",
    "teacher": "Erkam Ocak Hoca",
    "organization": "İsmailağa Hendek",
    "women_friendly": false,
    "address": "Hendek Tepecik Camii Altı",
    "google_maps_link": "https://maps.google.com/?q=40.7980,30.7500",
    "description": "Ehl-i sünnet itikadı ve ahlak konularının işlendiği haftalık sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Geyve Eşme Camii",
    "city": "Sakarya",
    "district": "Geyve",
    "day": "Perşembe",
    "time": "Yatsı Namazı Sonrası",
    "teacher": "Ahmet Taşçı Hoca",
    "organization": "İsmailağa Geyve",
    "women_friendly": false,
    "address": "Geyve Eşme Camii",
    "google_maps_link": "https://maps.google.com/?q=40.5150,30.3150",
    "description": "İslami ilimler ve günlük yaşama dair sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Kuba Mescidi",
    "city": "Sakarya",
    "district": "Karasu",
    "day": "Perşembe",
    "time": "Yatsı Namazı Sonrası",
    "teacher": "Ahmet Kopuz Hoca",
    "organization": "İsmailağa Karasu",
    "women_friendly": false,
    "address": "Kuba Mescidi",
    "google_maps_link": "https://maps.google.com/?q=41.1100,30.6800",
    "description": "Haftalık sohbet ve ilim meclisi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Babüsselam Mescidi",
    "city": "Sakarya",
    "district": "Kaynarca",
    "day": "Perşembe",
    "time": "Yatsı Namazı Sonrası",
    "teacher": "Sadettin Öztekin Hoca",
    "organization": "İsmailağa Kaynarca",
    "women_friendly": false,
    "address": "Babüsselam Mescidi",
    "google_maps_link": "https://maps.google.com/?q=41.0250,30.3050",
    "description": "Kur'an, sünnet and manevi hayat üzerine haftalık sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Asr-ı Saadet Gençlik & MGD",
    "venue_name": "Battı Çıktı",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Perşembe",
    "time": "19:30",
    "teacher": "Muhammed İkbal Eren Hoca",
    "organization": "Asr-ı Saadet Gençlik",
    "women_friendly": false,
    "address": "Battı Çıktı",
    "google_maps_link": "https://maps.google.com/?q=40.7745,30.4005",
    "description": "Gençlerin kaynaşması, sohbet ve tecrübe paylaşımı amacıyla gerçekleştirilen haftalık buluşma.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "asr_saadet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "İKVA Haftalık Sohbet",
    "venue_name": "İKVA Çarşı",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Cuma",
    "time": "Yatsı sonrası",
    "teacher": "Mürsel Körpe Hoca",
    "organization": "İslami Kimliği Koruma Vakfı (İKVA)",
    "women_friendly": false,
    "address": "İKVA Çarşı",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "İslam kimliği bilincinin ihya edildiği, kalplere tefekkür ve sabır feyizleri üfleyen haftalık şahsiyet dersi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ikva",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Darüsselam Fıkıh Dersi",
    "venue_name": "Altınova",
    "city": "Sakarya",
    "district": "Serdivan",
    "day": "Cuma",
    "time": "Yatsı sonrası",
    "teacher": "-",
    "organization": "Darüsselam Gençlik",
    "women_friendly": false,
    "address": "Altınova",
    "google_maps_link": "https://maps.google.com/?q=40.7603,30.3703",
    "description": "Muteber fıkıh risalelerinden helal-haram, ibadet ve muamelat rükünlerinin detaylıca irdelendiği ilmihal ders halkası.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "darusselam",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Ümmetder Merkez Maruf Çalışması",
    "venue_name": "Ümmetder Merkez",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Cuma",
    "time": "Yatsı sonrası",
    "teacher": "Cevat Karadağ Hoca",
    "organization": "Ümmetder Merkez",
    "women_friendly": false,
    "address": "Ümmetder Merkez",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Ümmetder çatısı altında, kalbi ameller, infak şuuru ve nebevi davet sorumluluklarının işlendiği büyük haftalık buluşma.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ummetder",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Hisar Kapısı Haftalık Sohbet",
    "venue_name": "Serdivan",
    "city": "Sakarya",
    "district": "Serdivan",
    "day": "Cuma",
    "time": "20:00",
    "teacher": "-",
    "organization": "Hisar Kapısı",
    "women_friendly": false,
    "address": "Serdivan",
    "google_maps_link": "https://maps.google.com/?q=40.7603,30.3703",
    "description": "Sıcak ve feyizli bir meclis havasında, irfan kültürü ve asrın manevi sorunlarına reçeteler sunan samimi sohbet.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": null,
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Seriyye Vakfı (Çarşı) Haftalık Sohbet",
    "venue_name": "Çarşı",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Cuma",
    "time": "20:30",
    "teacher": "-",
    "organization": "Seriyye Vakfı",
    "women_friendly": false,
    "address": "Çarşı",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Mukaddesat ve şuur çerçevesinde şekillenen, ehli sünnet davası aşkıyla yanan kalplerin haftalık feyiz meclisi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": null,
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "İFAM Merkez Haftalık Sohbet (Küpçüler)",
    "venue_name": "Küpçüler",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Cuma",
    "time": "Yatsı sonrası",
    "teacher": "-",
    "organization": "İFAM Merkez",
    "women_friendly": false,
    "address": "Küpçüler",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "İlmi ve Fikri Araştırmalar Merkez bünyesinde, Kur'an ve Sünnet penceresinden hayata bakış hasbıhalleri sunan ders meclisi.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ifam",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Şifa-i Şerif Hadis Dersi",
    "venue_name": "Yenigün Fatih Camii",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Cuma",
    "time": "Yatsıdan 15 dakika önce",
    "teacher": "Mahmut Kayabaşı Hoca",
    "organization": "Yenigün Fatih Camii",
    "women_friendly": false,
    "address": "Yenigün Fatih Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Kadı İyâz hazretlerinin dünyaca meşhur, Peygamber Efendimiz Efendimiz'in şahsiyeti ve mucizelerini ihtiva eden Şifâ-i Şerîf okuma dersidir.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Ümmetder Merkez - Adapazarı",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Pazar",
    "time": "Sabah Namazı Sonrası",
    "teacher": "Cevat Karadağ Hoca",
    "organization": "Ümmetder Merkez",
    "women_friendly": false,
    "address": "Ümmetder Merkez - Adapazarı",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Sabah namazı sonrasında gerçekleştirilen haftalık sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "ummetder",
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "M. Mahmud Efendi Külliyesi - Adapazarı",
    "city": "Sakarya",
    "district": "Adapazarı",
    "day": "Pazar",
    "time": "Sabah Namazı Sonrası",
    "teacher": "Ramazan İlhan Hoca",
    "organization": "M. Mahmud Efendi Külliyesi",
    "women_friendly": false,
    "address": "M. Mahmud Efendi Külliyesi - Adapazarı",
    "google_maps_link": "https://maps.google.com/?q=40.7731,30.4014",
    "description": "Sabah namazı sonrasında gerçekleştirilen haftalık sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": null,
    "status": "active",
    "source": "app_migration"
  },
  {
    "program_name": "Haftalık Sohbet",
    "venue_name": "Erenler Doğanbey Camii",
    "city": "Sakarya",
    "district": "Erenler",
    "day": "Pazar",
    "time": "Sabah Namazı Sonrası",
    "teacher": "Nurullah Okur Hoca",
    "organization": "Doğanbey Camii",
    "women_friendly": false,
    "address": "Erenler Doğanbey Camii",
    "google_maps_link": "https://maps.google.com/?q=40.7600,30.4200",
    "description": "Sabah namazı sonrasında gerçekleştirilen haftalık sohbet programı.",
    "contact_name": null,
    "contact_phone": null,
    "photo_url": null,
    "logo_url": "diyanet",
    "status": "active",
    "source": "app_migration"
  }
];

const cleanValue = (val) => {
    if (val === null || val === undefined) return null;
    const trimmed = String(val).trim();
    if (trimmed === '' || trimmed === '-') return null;
    return trimmed;
};

async function runMigration() {
    console.log(`\n======================================================`);
    console.log(` Cennet Bahçeleri - Veri Göçü (Migration) Başlatılıyor`);
    console.log(`======================================================`);
    console.log(`Toplam işlenecek yerel kayıt sayısı: ${baseEvents.length}`);
    console.log(`Supabase URL: ${SUPABASE_URL}`);
    console.log(`------------------------------------------------------`);

    try {
        // 1. Mevcut programları çek
        const getUrl = `${SUPABASE_URL}/rest/v1/programs?select=program_name,venue_name,district,day,time`;
        const getRes = await fetch(getUrl, {
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
        });

        if (!getRes.ok) {
            const errText = await getRes.text();
            throw new Error(`Mevcut kayıtlar çekilemedi. HTTP ${getRes.status}: ${errText}`);
        }

        const existingPrograms = await getRes.json();
        const existingKeys = new Set();

        const makeKey = (pName, vName, district, day, time) => {
            return `${(pName || '').trim().toLowerCase()}_${(vName || '').trim().toLowerCase()}_${(district || '').trim().toLowerCase()}_${(day || '').trim().toLowerCase()}_${(time || '').trim().toLowerCase()}`;
        };

        existingPrograms.forEach(p => {
            existingKeys.add(makeKey(p.program_name, p.venue_name, p.district, p.day, p.time));
        });

        console.log(`Veritabanında mevcut olan program sayısı: ${existingKeys.size}`);

        let skippedCount = 0;
        const newRecordsToInsert = [];

        // 2. Yeni eklenecek kayıtları süz ve temizlik yap
        for (const item of baseEvents) {
            const key = makeKey(item.program_name, item.venue_name, item.district, item.day, item.time);
            
            if (existingKeys.has(key)) {
                skippedCount++;
                continue;
            }

            // Veri temizliği
            const itemTeacher = cleanValue(item.teacher);
            const itemOrganization = cleanValue(item.organization);
            const itemContactName = cleanValue(item.contact_name);
            const itemContactPhone = cleanValue(item.contact_phone);

            const cleanPhotoUrl = (item.photo_url || '').trim() || null;
            const cleanLogoUrl = (item.logo_url || '').trim() || null;

            // Normalizasyon ve Kurallar:
            const payload = {
                suggestion_id: null,
                program_name: (item.program_name || '').trim(),
                venue_name: (item.venue_name || '').trim(),
                city: (item.city || '').trim() || 'Sakarya', // boşsa "Sakarya" yap
                district: (item.district || '').trim(),
                day: (item.day || '').trim(),
                time: (item.time || '').trim(),
                teacher: itemTeacher,
                organization: itemOrganization,
                women_friendly: item.women_friendly === true, // bilinmiyorsa / boşsa false
                address: (item.address || '').trim() || '',
                google_maps_link: (item.google_maps_link || '').trim() || '',
                description: (item.description || '').trim() || '',
                contact_name: itemContactName,
                contact_phone: itemContactPhone,
                photo_url: cleanPhotoUrl,
                logo_url: cleanLogoUrl,
                status: 'active', // kural: active
                source: 'app_migration' // kural: app_migration
            };

            newRecordsToInsert.push(payload);
        }

        let addedCount = 0;
        let errorCount = 0;
        const errors = [];

        // 3. Yeni kayıtları tek bir POST ile Supabase'e ekle
        if (newRecordsToInsert.length > 0) {
            const postUrl = `${SUPABASE_URL}/rest/v1/programs`;
            try {
                const postRes = await fetch(postUrl, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(newRecordsToInsert)
                });

                if (postRes.ok) {
                    const insertedData = await postRes.json();
                    addedCount = insertedData.length || newRecordsToInsert.length;
                } else {
                    errorCount = newRecordsToInsert.length;
                    const errText = await postRes.text();
                    errors.push({
                        program: 'Toplu Ekleme Hatası (Bulk Insert Error)',
                        error: `HTTP ${postRes.status}: ${errText}`
                    });
                }
            } catch (postError) {
                errorCount = newRecordsToInsert.length;
                errors.push({
                    program: 'Toplu Ekleme Sırasında Beklenmedik Hata',
                    error: postError.message
                });
            }
        }

        console.log(`\n---------------- GÖÇ ÖZETİ ----------------`);
        console.log(`- Toplam JSON Kayıt Sayısı : ${baseEvents.length}`);
        console.log(`- Veritabanında Mevcut Kayıt Sayısı : ${existingKeys.size}`);
        console.log(`- Zaten Var Olduğu İçin Atlanan Kayıt Sayısı : ${skippedCount}`);
        console.log(`- Yeni Eklenecek Kayıt Sayısı : ${newRecordsToInsert.length}`);
        console.log(`- Başarıyla Eklenen Kayıt Sayısı : ${addedCount}`);
        console.log(`- Hata Alan                 : ${errorCount}`);
        console.log(`-------------------------------------------`);

        if (errors.length > 0) {
            console.error('\nHata Detayları:');
            errors.forEach((err, idx) => {
                console.error(`${idx + 1}. [${err.program}] -> ${err.error}`);
            });
        } else {
            console.log('\n✔ Tebrikler! Tüm işlemler başarıyla ve hatasız şekilde tamamlandı.');
        }

    } catch (error) {
        console.error('\n❌ Beklenmeyen bir hata oluştu:', error.message);
    }
}

runMigration();
