/**
 * Cennet Bahçeleri Admin Paneli - JavaScript Altyapısı (Faz 2)
 */

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const loader = document.getElementById('loader');
    const errorContainer = document.getElementById('error-container');
    const emptyContainer = document.getElementById('empty-container');
    const suggestionsList = document.getElementById('suggestions-list');
    const suggestionsCount = document.getElementById('suggestions-count');
    
    const statsPendingVal = document.getElementById('stats-pending-val');
    const statsApprovedVal = document.getElementById('stats-approved-val');
    const statsRejectedVal = document.getElementById('stats-rejected-val');
    
    const refreshBtn = document.getElementById('refresh-btn');
    const retryBtn = document.getElementById('retry-btn');

    // Add Modal Elements
    const addModal = document.getElementById('add-modal');
    const addProgramBtn = document.getElementById('add-program-btn');
    const addModalCloseTop = document.getElementById('add-modal-close-top');
    const addBtnCancel = document.getElementById('add-btn-cancel');
    const addBtnSave = document.getElementById('add-btn-save');
    const addForm = document.getElementById('add-form');

    let supabaseClient = null;
    let currentSuggestion = null;
    let currentTabStatus = 'pending';
    let loadedPrograms = [];
    let isTrashBinView = false;
    let knownColumns = ['id', 'program_name', 'venue_name', 'city', 'district', 'day', 'time', 'teacher', 'organization', 'women_friendly', 'address', 'google_maps_link', 'description', 'contact_name', 'contact_phone', 'photo_url', 'status', 'created_at', 'updated_at', 'ladies_suitable', 'is_ladies_suitable', 'isLadiesSuitable'];
    let activeOrganizations = [];
    
    const SAKARYA_DISTRICTS = [
        "Adapazarı",
        "Akyazı",
        "Arifiye",
        "Erenler",
        "Ferizli",
        "Geyve",
        "Hendek",
        "Karapürçek",
        "Karasu",
        "Kaynarca",
        "Kocaali",
        "Pamukova",
        "Sapanca",
        "Serdivan",
        "Söğütlü",
        "Taraklı"
    ];
    
    // ROADMAP: İleride sık kullanılan programlar için is_pinned alanı eklenebilir.
    let currentViewMode = localStorage.getItem('cennetBahceleriProgramsViewMode') || 'card';

    // 1. Supabase Client Initialization
    function initSupabase() {
        try {
            // Check if supabase object exists from CDN
            if (typeof supabase === 'undefined') {
                throw new Error('Supabase library is not loaded from CDN.');
            }

            let supabaseUrl = '';
            let supabaseKey = '';

            // Check CENNET_CONFIG
            if (window.CENNET_CONFIG) {
                supabaseUrl = window.CENNET_CONFIG.supabaseUrl || window.CENNET_CONFIG.SUPABASE_URL;
                supabaseKey = window.CENNET_CONFIG.supabaseKey || window.CENNET_CONFIG.SUPABASE_KEY || window.CENNET_CONFIG.SUPABASE_ANON_KEY;
            }

            // Check CONFIG
            if ((!supabaseUrl || !supabaseKey) && window.CONFIG) {
                supabaseUrl = window.CONFIG.supabaseUrl || window.CONFIG.SUPABASE_URL || supabaseUrl;
                supabaseKey = window.CONFIG.supabaseKey || window.CONFIG.SUPABASE_KEY || window.CONFIG.SUPABASE_ANON_KEY || supabaseKey;
            }

            // Check APP_CONFIG
            if ((!supabaseUrl || !supabaseKey) && window.APP_CONFIG) {
                supabaseUrl = window.APP_CONFIG.supabaseUrl || window.APP_CONFIG.SUPABASE_URL || supabaseUrl;
                supabaseKey = window.APP_CONFIG.supabaseKey || window.APP_CONFIG.SUPABASE_KEY || window.APP_CONFIG.SUPABASE_ANON_KEY || supabaseKey;
            }

            // Check direct window level
            if (!supabaseUrl || !supabaseKey) {
                supabaseUrl = window.SUPABASE_URL || window.supabaseUrl || supabaseUrl;
                supabaseKey = window.SUPABASE_KEY || window.supabaseKey || window.SUPABASE_ANON_KEY || window.supabaseAnonKey || supabaseKey;
            }

            if (!supabaseUrl || !supabaseKey) {
                console.error('Supabase URL veya Anon Key eksik! config.js içindeki değerleri kontrol edin.');
            }

            supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
            return true;
        } catch (error) {
            console.error('Supabase başlatma hatası:', error);
            showError();
            return false;
        }
    }

    // Column detection helper
    async function detectColumns() {
        try {
            const { data, error } = await supabaseClient.from('suggestions').select('*').limit(1);
            if (!error && data && data.length > 0) {
                knownColumns = Object.keys(data[0]);
                console.log("Successfully detected suggestions table columns:", knownColumns);
            }
        } catch (e) {
            console.warn("Failed to detect columns on init:", e);
        }
    }

    // 2. Fetch Suggestions & Stats
    async function loadData() {
        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        if (!knownColumns) {
            await detectColumns();
        }

        showLoader();

        try {
            // Fetch Current Status Suggestions
            // public.suggestions table status matching currentTabStatus, sorted by created_at DESC
            const { data: statusSuggestions, error: fetchError } = await supabaseClient
                .from('suggestions')
                .select('*')
                .eq('status', currentTabStatus)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            // Fetch counts for Stats
            // We run these in parallel to make it extremely efficient
            const [pendingCountRes, approvedCountRes, rejectedCountRes] = await Promise.all([
                supabaseClient.from('suggestions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabaseClient.from('suggestions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
                supabaseClient.from('suggestions').select('*', { count: 'exact', head: true }).eq('status', 'rejected')
            ]);

            // Update Stats Display
            statsPendingVal.textContent = pendingCountRes.count !== null ? pendingCountRes.count : '0';
            statsApprovedVal.textContent = approvedCountRes.count !== null ? approvedCountRes.count : '0';
            statsRejectedVal.textContent = rejectedCountRes.count !== null ? rejectedCountRes.count : '0';

            // Update Page Title and Description based on active status
            const pageTitle = document.querySelector('.page-title-section h2');
            const pageDesc = document.querySelector('.page-title-section .section-desc');
            if (pageTitle && pageDesc) {
                if (currentTabStatus === 'pending') {
                    pageTitle.textContent = "Bekleyen İlim Meclisi Önerileri";
                    pageDesc.textContent = "Vatandaşlar tarafından form aracılığıyla gönderilen ve onay bekleyen program önerileri.";
                } else if (currentTabStatus === 'approved') {
                    pageTitle.textContent = "Onaylanan İlim Meclisi Önerileri";
                    pageDesc.textContent = "Admin tarafından onaylanmış ve sistemde yayında olan programlar.";
                } else if (currentTabStatus === 'rejected') {
                    pageTitle.textContent = "Reddedilen İlim Meclisi Önerileri";
                    pageDesc.textContent = "Kriterleri karşılamadığı için reddedilen program önerileri.";
                }
            }

            // Display list
            renderSuggestions(statusSuggestions);

        } catch (error) {
            console.error('Veri çekme hatası:', error);
            showError();
        }
    }

    // 3. Render list to screen
    function renderSuggestions(suggestions) {
        // Clear list
        suggestionsList.innerHTML = '';
        
        // Update count badge
        suggestionsCount.textContent = suggestions.length;

        if (suggestions.length === 0) {
            showEmpty();
            return;
        }

        hideStates();

        suggestions.forEach(item => {
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            
            // Format Date
            const createdDate = item.created_at ? formatDate(item.created_at) : 'Bilinmeyen Tarih';
            
            // Photo markup
            let photoMarkup = '';
            if (item.photo_url) {
                photoMarkup = `
                    <div class="suggestion-photo-preview">
                        <img src="${item.photo_url}" alt="Öneri Fotoğrafı" onerror="this.src='https://placehold.co/100x100?text=Hata';">
                    </div>
                `;
            }

            // Status formatting for Card
            let statusText = "Bekleyen Öneri";
            let statusClass = "status-badge status-pending";
            const statusVal = (item.status || 'pending').toLowerCase();
            if (statusVal === 'pending' || statusVal === 'beklemede') {
                statusText = "Bekleyen Öneri";
                statusClass = "status-badge status-pending";
            } else if (statusVal === 'approved' || statusVal === 'onaylandı' || statusVal === 'onaylandi' || statusVal === 'aktif') {
                statusText = "Onaylandı";
                statusClass = "status-badge status-approved";
            } else if (statusVal === 'rejected' || statusVal === 'reddedildi' || statusVal === 'red') {
                statusText = "Reddedildi";
                statusClass = "status-badge status-rejected";
            }

            card.innerHTML = `
                <div class="card-header-info">
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <span class="category-badge">${escapeHtml(item.category || 'Belirtilmemiş')}</span>
                        <span class="${statusClass}" style="font-size: 11px; padding: 2px 8px; display: inline-flex; align-items: center;">${escapeHtml(statusText)}</span>
                    </div>
                    <span class="date-badge"><i class="fa-regular fa-calendar-days"></i> ${createdDate}</span>
                </div>
                
                <h4 class="program-title">${escapeHtml(item.program_name || 'İsimsiz Sohbet')}</h4>
                <p class="venue-info"><i class="fa-solid fa-location-dot"></i> <strong>${escapeHtml(item.venue_name || 'Bilinmeyen Mekân')}</strong></p>
                
                <div class="details-grid">
                    <div class="detail-item">
                        <span class="detail-label">İl / İlçe:</span>
                        <span class="detail-value">${escapeHtml(item.city || 'Sakarya')} / ${escapeHtml(item.district || '-')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Gün & Saat:</span>
                        <span class="detail-value">${escapeHtml(item.day || '-')} - ${escapeHtml(item.time || '-')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Öneren Kişi:</span>
                        <span class="detail-value">${escapeHtml(item.contact_name || 'Anonim')}</span>
                    </div>
                </div>

                ${photoMarkup}

                <div class="card-actions">
                    <button class="btn btn-primary btn-inspect" data-id="${item.id}">
                        <i class="fa-solid fa-magnifying-glass"></i> İncele
                    </button>
                </div>
            `;

            // Bind Event to Inspect Button
            const inspectBtn = card.querySelector('.btn-inspect');
            inspectBtn.addEventListener('click', () => {
                openInspectModal(item);
            });

            suggestionsList.appendChild(card);
        });
    }

    // Helpers
    function showLoader() {
        loader.classList.remove('hidden');
        errorContainer.classList.add('hidden');
        emptyContainer.classList.add('hidden');
        suggestionsList.classList.add('hidden');
    }

    function showError() {
        loader.classList.add('hidden');
        errorContainer.classList.remove('hidden');
        emptyContainer.classList.add('hidden');
        suggestionsList.classList.add('hidden');
        
        // Zero stats
        statsPendingVal.textContent = 'Hata';
        statsApprovedVal.textContent = 'Hata';
        statsRejectedVal.textContent = 'Hata';
    }

    function showEmpty() {
        loader.classList.add('hidden');
        errorContainer.classList.add('hidden');
        emptyContainer.classList.remove('hidden');
        suggestionsList.classList.add('hidden');

        // Dynamically update empty message
        const emptyTitle = emptyContainer.querySelector('h4');
        const emptyDesc = emptyContainer.querySelector('p');
        if (emptyTitle) {
            emptyTitle.textContent = "Bu kategoride kayıt bulunmuyor.";
        }
        if (emptyDesc) {
            if (currentTabStatus === 'pending') {
                emptyDesc.textContent = "Tüm öneriler karara bağlanmış durumda. Yeni öneri geldiğinde burada listelenecektir.";
            } else if (currentTabStatus === 'approved') {
                emptyDesc.textContent = "Onaylanmış herhangi bir öneri bulunmamaktadır.";
            } else if (currentTabStatus === 'rejected') {
                emptyDesc.textContent = "Reddedilmiş herhangi bir öneri bulunmamaktadır.";
            }
        }
    }

    function hideStates() {
        loader.classList.add('hidden');
        errorContainer.classList.add('hidden');
        emptyContainer.classList.add('hidden');
        suggestionsList.classList.remove('hidden');
    }

    // Format ISO Date String to Turkish Date string
    function formatDate(isoString) {
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return isoString;
        }
    }

    // Helper to escape HTML characters (Security)
    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.toString().replace(/[&<>"']/g, m => map[m]);
    }

    // Sync Approved/Added Suggestion to Programs Table (Paket F2)
    async function syncSuggestionToProgram(suggestion, sourceType, logoUrlOverride = null) {
        if (!supabaseClient) return;
        console.log("syncSuggestionToProgram başlatıldı - suggestion:", suggestion, "sourceType:", sourceType);

        // 1. Duplicate check: programs tablosunda aynı suggestion_id varsa tekrar insert yapılmasın
        const { data: existingPrograms, error: checkError } = await supabaseClient
            .from('programs')
            .select('id')
            .eq('suggestion_id', suggestion.id);

        if (checkError) {
            console.error("Duplicate kontrolü sırasında hata oluştu:", checkError);
            throw checkError;
        }

        if (existingPrograms && existingPrograms.length > 0) {
            console.log(`suggestion_id: ${suggestion.id} zaten programs tablosunda mevcut. Tekrar eklenmedi.`);
            return; // Treat as success
        }

        // 2. Resolve women_friendly
        let women_friendly = false;
        if (
            suggestion.women_friendly === true || 
            suggestion.is_ladies_suitable === true || 
            suggestion.isLadiesSuitable === true || 
            suggestion.ladies_suitable === true || 
            suggestion.ladies_only === true || 
            suggestion.ladiesOnly === true
        ) {
            women_friendly = true;
        } else {
            const descLower = (suggestion.description || '').toLowerCase();
            if (descLower.includes('hanımlara uygundur') || descLower.includes('hanimlara uygundur')) {
                women_friendly = true;
            }
        }

        // 3. Resolve photo_url & logo_url
        const photo_url = suggestion.photo_url || suggestion.photoUrl || suggestion.image_url || suggestion.imageUrl || suggestion.photo || suggestion.image || null;
        const logo_url = logoUrlOverride || suggestion.logo_url || suggestion.logoUrl || null;

        // 4. Construct programs payload
        const programPayload = {
            suggestion_id: suggestion.id,
            program_name: suggestion.program_name || '',
            venue_name: suggestion.venue_name || '',
            city: suggestion.city || 'Sakarya',
            district: suggestion.district || '',
            day: suggestion.day || '',
            time: suggestion.time || '',
            teacher: suggestion.teacher || suggestion.speaker || suggestion.hoca || suggestion.lecturer || '',
            organization: suggestion.organization || suggestion.institution || suggestion.association || suggestion.community || suggestion.cemaat || suggestion.dernek || suggestion.kurum || '',
            women_friendly: women_friendly,
            address: suggestion.address || suggestion.location || '',
            google_maps_link: suggestion.google_maps_link || suggestion.googleMapsLink || suggestion.maps_link || suggestion.mapsLink || suggestion.map_link || suggestion.mapLink || '',
            description: suggestion.description || '',
            contact_name: suggestion.contact_name || suggestion.contact_person || suggestion.contactPerson || suggestion.sender_name || suggestion.sender || '',
            contact_phone: suggestion.contact_phone || suggestion.contactPhone || suggestion.phone || suggestion.whatsapp || suggestion.telefon || '',
            photo_url: photo_url,
            logo_url: logo_url,
            status: 'active',
            source: sourceType
        };

        console.log("Programs tablosuna aktarılan veri:", programPayload);

        // 5. Insert to programs (robust fallback in case logo_url column doesn't exist yet)
        const { error: insertError } = await supabaseClient
            .from('programs')
            .insert(programPayload);

        if (insertError) {
            console.error("Programs tablosuna ekleme hatası:", insertError);
            const errMsg = (insertError.message || '').toLowerCase();
            if (errMsg.includes('logo_url') && 'logo_url' in programPayload) {
                console.warn("logo_url column seems to be missing in programs table. Retrying sync without logo_url.");
                delete programPayload.logo_url;
                const { error: retryError } = await supabaseClient
                    .from('programs')
                    .insert(programPayload);
                if (retryError) {
                    throw retryError;
                }
            } else {
                throw insertError;
            }
        }
    }

    // Modal functions (Paket A — Admin İncele Modalı)
    function openInspectModal(item) {
        currentSuggestion = item;
        console.log("İncele tıklandı", item);
        try {
            // Resolve field values (fallback to 'Belirtilmemiş' for missing strings, handle potential variant keys)
            const programName = item.program_name || 'Belirtilmemiş';
            const category = item.category || 'Belirtilmemiş';
            const venueName = item.venue_name || 'Belirtilmemiş';
            const city = item.city || 'Sakarya';
            const district = item.district || 'Belirtilmemiş';
            const day = item.day || 'Belirtilmemiş';
            const time = item.time || 'Belirtilmemiş';
            
            // Hoca / Speaker fallback
            const teacher = item.teacher || item.speaker || item.hoca || item.lecturer || 'Belirtilmemiş';
            
            // Organization / Kurum / Cemaat / Dernek
            const organization = item.organization || item.institution || item.association || item.community || item.cemaat || item.dernek || item.kurum || 'Belirtilmemiş';
            
            // Hanımlara uygun mu? (isLadiesSuitable logic)
            let isLadies = false;
            if (item.is_ladies_suitable === true || item.isLadiesSuitable === true || item.ladies_suitable === true || item.ladies_only === true || item.ladiesOnly === true) {
                isLadies = true;
            } else {
                // Keyword check in textual fields
                const fieldsToSearch = [
                    item.program_name,
                    item.description,
                    item.notes,
                    item.category,
                    item.venue_name
                ].filter(Boolean).map(s => s.toLowerCase());
                
                isLadies = fieldsToSearch.some(s => s.includes('hanım') || s.includes('bayan') || s.includes('kadın') || s.includes('kizler') || s.includes('kızlar'));
            }
            const ladiesText = isLadies ? "Evet" : "Belirtilmemiş";

            // Contact info / Sender
            const contactName = item.contact_name || item.contact_person || item.contactPerson || item.sender_name || item.sender || 'Belirtilmemiş';
            const contactPhone = item.contact_phone || item.contactPhone || item.phone || item.whatsapp || item.telefon || 'Belirtilmemiş';
            
            // Address
            const address = item.address || item.location || 'Belirtilmemiş';
            
            // Status formatting
            let statusText = "Bekleyen Öneri";
            let statusClass = "status-badge status-pending";
            const statusVal = (item.status || 'pending').toLowerCase();
            if (statusVal === 'pending' || statusVal === 'beklemede') {
                statusText = "Bekleyen Öneri";
                statusClass = "status-badge status-pending";
            } else if (statusVal === 'approved' || statusVal === 'onaylandı' || statusVal === 'onaylandi' || statusVal === 'aktif') {
                statusText = "Onaylandı";
                statusClass = "status-badge status-approved";
            } else if (statusVal === 'rejected' || statusVal === 'reddedildi' || statusVal === 'red') {
                statusText = "Reddedildi";
                statusClass = "status-badge status-rejected";
            } else {
                statusText = item.status;
                statusClass = "status-badge";
            }
            
            // Created date
            const createdDate = item.created_at ? formatDate(item.created_at) : 'Belirtilmeyen Tarih';
            
            // Description
            const description = item.description || item.notes || 'Açıklama belirtilmemiş.';

            // Populate elements
            document.getElementById('modal-program-name').textContent = programName;
            document.getElementById('modal-category').textContent = category;
            document.getElementById('modal-venue-name').textContent = venueName;
            document.getElementById('modal-location').textContent = `${city} / ${district}`;
            document.getElementById('modal-day').textContent = day;
            document.getElementById('modal-time').textContent = time;
            document.getElementById('modal-teacher').textContent = teacher;
            document.getElementById('modal-organization').textContent = organization;
            document.getElementById('modal-ladies').textContent = ladiesText;
            
            document.getElementById('modal-contact-name').textContent = contactName;
            document.getElementById('modal-contact-phone').textContent = contactPhone;
            document.getElementById('modal-address').textContent = address;
            
            const statusContainer = document.getElementById('modal-status');
            statusContainer.innerHTML = `<span class="${statusClass}">${escapeHtml(statusText)}</span>`;
            
            document.getElementById('modal-created-at').textContent = createdDate;
            document.getElementById('modal-description').textContent = description;

            // Photo logic
            const photoUrl = item.photo_url || item.photoUrl || item.image_url || item.imageUrl || item.photo || item.image;
            const photoContainer = document.getElementById('modal-photo-container');
            const photoImg = document.getElementById('modal-photo-img');

            if (photoUrl) {
                photoImg.src = photoUrl;
                photoImg.onerror = () => {
                    photoContainer.classList.add('hidden');
                };
                photoContainer.classList.remove('hidden');
            } else {
                photoContainer.classList.add('hidden');
            }

            // Google Maps Link logic
            let mapsUrl = item.google_maps_link || item.googleMapsLink || item.maps_link || item.mapsLink || item.map_link || item.mapLink;
            if (!mapsUrl) {
                if (item.latitude && item.longitude) {
                    mapsUrl = `https://maps.google.com/?q=${item.latitude},${item.longitude}`;
                } else if (item.venue_name && item.venue_name !== 'Belirtilmemiş') {
                    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName + " " + (district !== 'Belirtilmemiş' ? district : '') + " " + city)}`;
                }
            }

            const mapsBtn = document.getElementById('modal-btn-maps');
            if (mapsUrl) {
                mapsBtn.href = mapsUrl;
                mapsBtn.classList.remove('disabled');
                mapsBtn.style.pointerEvents = 'auto';
            } else {
                mapsBtn.href = '#';
                mapsBtn.classList.add('disabled');
                mapsBtn.style.pointerEvents = 'none';
            }

            // Phone logic
            const phoneBtn = document.getElementById('modal-btn-phone');
            if (contactPhone && contactPhone !== 'Belirtilmemiş' && contactPhone !== '-') {
                const cleanPhone = contactPhone.replace(/\D/g, '');
                phoneBtn.href = `tel:${cleanPhone}`;
                phoneBtn.classList.remove('disabled');
                phoneBtn.style.pointerEvents = 'auto';
            } else {
                phoneBtn.href = '#';
                phoneBtn.classList.add('disabled');
                phoneBtn.style.pointerEvents = 'none';
            }

            // Control action buttons based on status
            const approveBtn = document.getElementById('modal-btn-approve');
            const rejectBtn = document.getElementById('modal-btn-reject');
            const editBtn = document.getElementById('modal-btn-edit');

            if (approveBtn) approveBtn.classList.remove('hidden');
            if (rejectBtn) rejectBtn.classList.remove('hidden');
            if (editBtn) editBtn.classList.remove('hidden');

            if (statusVal === 'pending' || statusVal === 'beklemede') {
                // Pending suggestion: Onayla, Reddet, Düzenle are all active
            } else if (statusVal === 'approved' || statusVal === 'onaylandı' || statusVal === 'onaylandi' || statusVal === 'aktif') {
                // Approved suggestion: Onayla hidden, Reddet and Düzenle active
                if (approveBtn) approveBtn.classList.add('hidden');
            } else if (statusVal === 'rejected' || statusVal === 'reddedildi' || statusVal === 'red') {
                // Rejected suggestion: Reddet hidden, Onayla and Düzenle active
                if (rejectBtn) rejectBtn.classList.add('hidden');
            }

            // Show Modal overlay
            const modal = document.getElementById('inspect-modal');
            console.log("Modal bulundu mu?", modal);
            if (modal) {
                modal.classList.remove('hidden');
                document.body.style.overflow = "hidden";
            }
        } catch (e) {
            console.error("openInspectModal Hatası:", e);
        }
    }

    function closeInspectModal() {
        const modal = document.getElementById('inspect-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = "";
        }
        exitEditMode();
    }

    // Edit Mode functions (Paket C)
    function enterEditMode() {
        if (!currentSuggestion) return;

        const viewBody = document.getElementById('modal-view-body');
        const editBody = document.getElementById('modal-edit-body');
        const viewFooter = document.getElementById('modal-footer-view');
        const editFooter = document.getElementById('modal-footer-edit');

        if (viewBody) viewBody.classList.add('hidden');
        if (editBody) editBody.classList.remove('hidden');
        if (viewFooter) viewFooter.classList.add('hidden');
        if (editFooter) editFooter.classList.remove('hidden');

        // Populate form inputs
        document.getElementById('edit-program-name').value = currentSuggestion.program_name || '';
        document.getElementById('edit-venue-name').value = currentSuggestion.venue_name || '';
        document.getElementById('edit-city').value = currentSuggestion.city || 'Sakarya';
        
        const currentDistrict = currentSuggestion.district ? currentSuggestion.district.trim() : '';
        const editDistrictSelect = document.getElementById('edit-district');
        const editDistrictWarning = document.getElementById('edit-district-warning');
        if (editDistrictSelect) {
            const foundDistrict = SAKARYA_DISTRICTS.find(d => d.toLocaleLowerCase('tr-TR') === currentDistrict.toLocaleLowerCase('tr-TR'));
            if (foundDistrict) {
                editDistrictSelect.value = foundDistrict;
                if (editDistrictWarning) editDistrictWarning.classList.add('hidden');
            } else {
                editDistrictSelect.value = ''; // Reset to "İlçe Seçiniz"
                if (editDistrictWarning) editDistrictWarning.classList.remove('hidden');
            }
        }

        document.getElementById('edit-day').value = currentSuggestion.day || '';
        document.getElementById('edit-time').value = currentSuggestion.time || '';
        
        // Hoca / Speaker fallback
        const teacher = currentSuggestion.teacher || currentSuggestion.speaker || currentSuggestion.hoca || currentSuggestion.lecturer || '';
        document.getElementById('edit-teacher').value = teacher;
        
        // Organization
        const organization = currentSuggestion.organization || currentSuggestion.institution || currentSuggestion.association || currentSuggestion.community || currentSuggestion.cemaat || currentSuggestion.dernek || currentSuggestion.kurum || '';
        document.getElementById('edit-organization').value = organization;
        
        // Contact Name
        const contactName = currentSuggestion.contact_name || currentSuggestion.contact_person || currentSuggestion.contactPerson || currentSuggestion.sender_name || currentSuggestion.sender || '';
        document.getElementById('edit-contact-name').value = contactName;
        
        // Contact Phone
        const contactPhone = currentSuggestion.contact_phone || currentSuggestion.contactPhone || currentSuggestion.phone || currentSuggestion.whatsapp || currentSuggestion.telefon || '';
        document.getElementById('edit-contact-phone').value = contactPhone;
        
        // Maps
        const mapsLink = currentSuggestion.google_maps_link || currentSuggestion.googleMapsLink || currentSuggestion.maps_link || currentSuggestion.mapsLink || currentSuggestion.map_link || currentSuggestion.mapLink || '';
        document.getElementById('edit-google-maps-link').value = mapsLink;
        
        // Address
        document.getElementById('edit-address').value = currentSuggestion.address || currentSuggestion.location || '';
        
        // Description
        document.getElementById('edit-description').value = currentSuggestion.description || currentSuggestion.notes || '';
    }

    function exitEditMode() {
        const viewBody = document.getElementById('modal-view-body');
        const editBody = document.getElementById('modal-edit-body');
        const viewFooter = document.getElementById('modal-footer-view');
        const editFooter = document.getElementById('modal-footer-edit');

        if (viewBody) viewBody.classList.remove('hidden');
        if (editBody) editBody.classList.add('hidden');
        if (viewFooter) viewFooter.classList.remove('hidden');
        if (editFooter) editFooter.classList.add('hidden');
    }

    async function handleSaveUpdate() {
        if (!supabaseClient || !currentSuggestion) return;

        const saveBtn = document.getElementById('modal-btn-save');
        const cancelBtn = document.getElementById('modal-btn-cancel');

        // Disable save/cancel buttons and show loading spinner
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.classList.add('disabled');
        }
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.classList.add('disabled');
        }

        const originalSaveHTML = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
        }

        try {
            const id = currentSuggestion.id;

            // Get edited form values
            const program_name = document.getElementById('edit-program-name').value.trim();
            const venue_name = document.getElementById('edit-venue-name').value.trim();
            const city = document.getElementById('edit-city').value.trim();
            const district = document.getElementById('edit-district').value.trim();
            const day = document.getElementById('edit-day').value.trim();
            const time = document.getElementById('edit-time').value.trim();
            const teacher = document.getElementById('edit-teacher').value.trim();
            const organization = document.getElementById('edit-organization').value.trim();
            const contact_name = document.getElementById('edit-contact-name').value.trim();
            const contact_phone = document.getElementById('edit-contact-phone').value.trim();
            const google_maps_link = document.getElementById('edit-google-maps-link').value.trim();
            const address = document.getElementById('edit-address').value.trim();
            const description = document.getElementById('edit-description').value.trim();

            if (!program_name || !venue_name || !city || !district || !day || !time) {
                showToast("Lütfen zorunlu alanları doldurun.", "error");
                throw new Error("Gerekli alanlar boş bırakılamaz.");
            }

            if (!SAKARYA_DISTRICTS.includes(district)) {
                showToast("Lütfen geçerli bir ilçe seçiniz.", "error");
                throw new Error("Geçersiz veya boş ilçe seçimi.");
            }

            // Build safe payload with columns we are certain exist (city is excluded completely from database payload)
            const updatePayload = {
                program_name,
                venue_name,
                district,
                day,
                time,
                contact_name,
                contact_phone,
                description
            };

            // Optional fields check - only add if they exist in currentSuggestion (meaning they are valid database columns)
            if ('teacher' in currentSuggestion) {
                updatePayload.teacher = teacher;
            } else if ('speaker' in currentSuggestion) {
                updatePayload.speaker = teacher;
            } else if ('hoca' in currentSuggestion) {
                updatePayload.hoca = teacher;
            } else if ('lecturer' in currentSuggestion) {
                updatePayload.lecturer = teacher;
            }

            if ('organization' in currentSuggestion) {
                updatePayload.organization = organization;
            } else if ('association' in currentSuggestion) {
                updatePayload.association = organization;
            } else if ('community' in currentSuggestion) {
                updatePayload.community = organization;
            } else if ('dernek' in currentSuggestion) {
                updatePayload.dernek = organization;
            } else if ('kurum' in currentSuggestion) {
                updatePayload.kurum = organization;
            }

            if ('address' in currentSuggestion) {
                updatePayload.address = address;
            } else if ('location' in currentSuggestion) {
                updatePayload.location = address;
            }

            if ('google_maps_link' in currentSuggestion) {
                updatePayload.google_maps_link = google_maps_link;
            } else if ('googleMapsLink' in currentSuggestion) {
                updatePayload.googleMapsLink = google_maps_link;
            } else if ('maps_link' in currentSuggestion) {
                updatePayload.maps_link = google_maps_link;
            } else if ('mapsLink' in currentSuggestion) {
                updatePayload.mapsLink = google_maps_link;
            }

            if ('updated_at' in currentSuggestion) {
                updatePayload.updated_at = new Date().toISOString();
            }

            console.log("Updating suggestion ID:", id);
            console.log("Initial payload:", updatePayload);

            let attempt = 0;
            let success = false;
            let responseData = null;
            let responseError = null;

            while (attempt < 5) {
                console.log(`Update attempt #${attempt + 1}, Payload:`, updatePayload);
                const { data, error } = await supabaseClient
                    .from('suggestions')
                    .update(updatePayload)
                    .eq('id', id)
                    .select();

                if (!error) {
                    responseData = data;
                    success = true;
                    break;
                }

                responseError = error;
                console.warn(`Attempt #${attempt + 1} failed:`, error);

                // Analyze error message to detect and remove missing columns automatically
                const errMsg = (error.message || '').toLowerCase();
                let columnRemoved = false;

                // Look for column names enclosed in quotes or in plaintext
                const quoteMatches = errMsg.match(/['"`]([a-z0-9_]+)['"`]/g) || [];
                const extractedWords = quoteMatches.map(m => m.replace(/['"`]/g, ''));
                const allWords = errMsg.split(/[^a-z0-9_]/);

                const candidates = new Set([...extractedWords, ...allWords]);

                for (const key of Object.keys(updatePayload)) {
                    if (candidates.has(key.toLowerCase()) || errMsg.includes(key.toLowerCase())) {
                        console.log(`Detected offending column '${key}' in error message, removing from update payload.`);
                        delete updatePayload[key];
                        columnRemoved = true;
                    }
                }

                // If no exact column can be parsed from error message but it's a schema/column error, try removing optional columns
                if (!columnRemoved) {
                    const optionalKeys = ['teacher', 'organization', 'address', 'google_maps_link', 'updated_at'];
                    for (const optKey of optionalKeys) {
                        if (optKey in updatePayload) {
                            console.log(`No direct match. Removing optional column '${optKey}' as a safe fallback.`);
                            delete updatePayload[optKey];
                            columnRemoved = true;
                            break;
                        }
                    }
                }

                if (!columnRemoved) {
                    // No key left or unable to resolve offending column, stop retrying
                    break;
                }

                attempt++;
            }

            if (!success) {
                throw responseError;
            }

            if (!responseData || responseData.length === 0) {
                console.error("Hiç kayıt güncellenmedi. Tabloda id bulunamamış veya RLS engellemiş olabilir.");
                showToast("Hiç kayıt güncellenmedi.", "error");
                return;
            }

            // Success
            showToast("Öneri güncellendi.", "success");

            // Update currentSuggestion cache with the database returned object
            const updatedItem = responseData[0];
            Object.assign(currentSuggestion, updatedItem);

            // Re-render openInspectModal with the updated item to reflect in view mode
            openInspectModal(currentSuggestion);

            // Hide edit mode, back to view mode
            exitEditMode();

            // Refresh parent list & counters in background
            await loadData();

        } catch (error) {
            console.error('Düzenleme sırasında hata oluştu:', error);
            showToast("Düzenleme sırasında hata oluştu.", "error");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.classList.remove('disabled');
                saveBtn.innerHTML = originalSaveHTML;
            }
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.classList.remove('disabled');
            }
        }
    }

    // Status Update Handler (Paket B)
    async function handleStatusUpdate(newStatus) {
        if (!supabaseClient || !currentSuggestion) return;

        const approveBtn = document.getElementById('modal-btn-approve');
        const rejectBtn = document.getElementById('modal-btn-reject');

        // Disable buttons and show loading state
        if (approveBtn) {
            approveBtn.disabled = true;
            approveBtn.classList.add('disabled');
        }
        if (rejectBtn) {
            rejectBtn.disabled = true;
            rejectBtn.classList.add('disabled');
        }

        // Save original innerHTML to restore later
        const originalApproveHTML = approveBtn ? approveBtn.innerHTML : '';
        const originalRejectHTML = rejectBtn ? rejectBtn.innerHTML : '';

        if (newStatus === 'approved' && approveBtn) {
            approveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Onaylanıyor...';
        } else if (newStatus === 'rejected' && rejectBtn) {
            rejectBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reddediliyor...';
        }

        try {
            const id = currentSuggestion.id;
            let updatePayload = { status: newStatus };
            
            // Safe check for updated_at column
            if ('updated_at' in currentSuggestion) {
                updatePayload.updated_at = new Date().toISOString();
            }

            console.log("Update id:", currentSuggestion.id);
            console.log("Yeni status:", newStatus);

            let { data, error } = await supabaseClient
                .from('suggestions')
                .update(updatePayload)
                .eq('id', id)
                .select();

            if (error && updatePayload.updated_at) {
                console.warn("updated_at ile güncelleme başarısız oldu, sadece status deneniyor:", error);
                const retryRes = await supabaseClient
                    .from('suggestions')
                    .update({ status: newStatus })
                    .eq('id', id)
                    .select();
                data = retryRes.data;
                error = retryRes.error;
            }

            console.log("Update sonucu:", data);
            if (error) {
                console.error(error);
            }

            if (error) {
                throw error;
            }

            if (!data || data.length === 0) {
                console.error("Hiç kayıt güncellenmedi. Tabloda id bulunamamış veya RLS engellemiş olabilir.");
                showToast("Hiç kayıt güncellenmedi.", "error");
                return;
            }

            let syncSuccess = true;
            if (newStatus === 'approved') {
                try {
                    await syncSuggestionToProgram(data[0], 'suggestion');
                } catch (syncError) {
                    syncSuccess = false;
                    console.error("Programs tablosuna aktarım hatası:", syncError);
                }
            }

            // Show success toast
            if (newStatus === 'approved') {
                if (syncSuccess) {
                    showToast("Öneri onaylandı ve programa aktarıldı.", "success");
                } else {
                    showToast("Öneri onaylandı fakat programa aktarılamadı.", "error");
                }
            } else {
                showToast("Öneri reddedildi.", "success");
            }

            // Close modal
            closeInspectModal();

            // Refresh list & counters
            await loadData();

        } catch (error) {
            console.error('İşlem sırasında hata oluştu:', error);
            showToast("İşlem sırasında hata oluştu.", "error");
        } finally {
            // Restore buttons
            if (approveBtn) {
                approveBtn.disabled = false;
                approveBtn.classList.remove('disabled');
                approveBtn.innerHTML = originalApproveHTML;
            }
            if (rejectBtn) {
                rejectBtn.disabled = false;
                rejectBtn.classList.remove('disabled');
                rejectBtn.innerHTML = originalRejectHTML;
            }
        }
    }

    // Dynamic Toast Notification
    function showToast(message, type = "success") {
        let toast = document.getElementById('admin-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'admin-toast';
            document.body.appendChild(toast);
        }

        toast.className = `toast-notification toast-${type}`;

        const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;

        // Force reflow
        toast.offsetHeight;

        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Event Listeners for buttons
    refreshBtn.addEventListener('click', loadData);
    retryBtn.addEventListener('click', loadData);

    // Programs Event Listeners
    document.getElementById('programs-refresh-btn')?.addEventListener('click', loadPrograms);
    document.getElementById('programs-retry-btn')?.addEventListener('click', loadPrograms);

    // Modal Action Buttons (Paket B)
    document.getElementById('modal-btn-approve')?.addEventListener('click', async () => {
        if (!currentSuggestion) return;
        const confirmApprove = confirm("Bu öneriyi onaylamak istediğinize emin misiniz?");
        if (confirmApprove) {
            await handleStatusUpdate('approved');
        }
    });

    document.getElementById('modal-btn-reject')?.addEventListener('click', async () => {
        if (!currentSuggestion) return;
        const confirmReject = confirm("Bu öneriyi reddetmek istediğinize emin misiniz?");
        if (confirmReject) {
            await handleStatusUpdate('rejected');
        }
    });

    // Modal Edit Mode Actions (Paket C)
    document.getElementById('modal-btn-edit')?.addEventListener('click', () => {
        enterEditMode();
    });

    document.getElementById('modal-btn-cancel')?.addEventListener('click', () => {
        exitEditMode();
    });

    document.getElementById('modal-btn-save')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await handleSaveUpdate();
    });

    // Modal Close Listeners
    document.getElementById('modal-btn-close')?.addEventListener('click', closeInspectModal);
    document.getElementById('modal-close-top')?.addEventListener('click', closeInspectModal);

    // Close on overlay click
    document.getElementById('inspect-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'inspect-modal') {
            closeInspectModal();
        }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInspectModal();
            closeAddModal();
            if (typeof closeProgramEditModal === 'function') {
                closeProgramEditModal();
            }
            if (typeof closeDeleteConfirmModal === 'function') {
                closeDeleteConfirmModal();
            }
        }
    });

    // Add Modal functions and listeners
    function closeAddModal() {
        if (addModal) {
            addModal.classList.add('hidden');
            document.body.style.overflow = "";
        }
    }

    addProgramBtn?.addEventListener('click', () => {
        if (addForm) {
            addForm.reset();
            const cityInput = document.getElementById('add-city');
            if (cityInput) cityInput.value = 'Sakarya';
            const addOrgSelect = document.getElementById('add-org-select');
            if (addOrgSelect) addOrgSelect.value = '';
        }
        
        // Reset photo upload elements
        const addPhotoFile = document.getElementById('add-photo-file');
        if (addPhotoFile) addPhotoFile.value = '';
        const addFileName = document.getElementById('add-photo-file-name');
        if (addFileName) addFileName.textContent = 'Seçilen dosya yok';
        const addPreviewContainer = document.getElementById('add-photo-preview-container');
        if (addPreviewContainer) addPreviewContainer.classList.add('hidden');
        const addPreviewImg = document.getElementById('add-photo-preview-img');
        if (addPreviewImg) addPreviewImg.src = '';
        const addProgress = document.getElementById('add-upload-progress');
        if (addProgress) addProgress.classList.add('hidden');

        // Reset logo upload elements
        const addLogoFile = document.getElementById('add-program-logo-file');
        if (addLogoFile) addLogoFile.value = '';
        const addLogoFileName = document.getElementById('add-program-logo-file-name');
        if (addLogoFileName) addLogoFileName.textContent = 'Seçilen dosya yok';
        const addLogoPreviewContainer = document.getElementById('add-program-logo-preview-container');
        if (addLogoPreviewContainer) addLogoPreviewContainer.classList.add('hidden');
        const addLogoPreviewImg = document.getElementById('add-program-logo-preview-img');
        if (addLogoPreviewImg) {
            addLogoPreviewImg.src = '';
            addLogoPreviewImg.style.display = 'none';
        }
        const addLogoPreviewText = document.getElementById('add-program-logo-preview-text');
        if (addLogoPreviewText) {
            addLogoPreviewText.classList.add('hidden');
            addLogoPreviewText.style.display = 'none';
        }
        const addLogoProgress = document.getElementById('add-logo-upload-progress');
        if (addLogoProgress) addLogoProgress.classList.add('hidden');
        const addLogoUrl = document.getElementById('add-program-logo-url');
        if (addLogoUrl) addLogoUrl.value = '';

        if (addModal) {
            addModal.classList.remove('hidden');
            document.body.style.overflow = "hidden";
        }
    });

    addModalCloseTop?.addEventListener('click', closeAddModal);
    addBtnCancel?.addEventListener('click', closeAddModal);

    addModal?.addEventListener('click', (e) => {
        if (e.target.id === 'add-modal') {
            closeAddModal();
        }
    });

    async function handleAddProgramSubmit() {
        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        const saveBtn = document.getElementById('add-btn-save');
        const cancelBtn = document.getElementById('add-btn-cancel');

        // Get edited form values
        const program_name = document.getElementById('add-program-name').value.trim();
        const venue_name = document.getElementById('add-venue-name').value.trim();
        const city = document.getElementById('add-city').value.trim();
        const district = document.getElementById('add-district').value.trim();
        const day = document.getElementById('add-day').value.trim();
        const time = document.getElementById('add-time').value.trim();
        const teacher = document.getElementById('add-teacher').value.trim();
        const organization = document.getElementById('add-organization').value.trim();
        const contact_name = document.getElementById('add-contact-name').value.trim();
        const contact_phone = document.getElementById('add-contact-phone').value.trim();
        const google_maps_link = document.getElementById('add-google-maps-link').value.trim();
        const address = document.getElementById('add-address').value.trim();
        let description = document.getElementById('add-description').value.trim();
        const isLadiesSuitable = document.getElementById('add-ladies').value === 'yes';
        const photo_url = document.getElementById('add-photo-url').value.trim();

        if (!program_name || !venue_name || !city || !district || !day || !time) {
            showToast("Lütfen zorunlu alanları doldurun.", "error");
            return;
        }

        if (!SAKARYA_DISTRICTS.includes(district)) {
            showToast("Lütfen geçerli bir ilçe seçiniz.", "error");
            return;
        }

        // Disable save/cancel buttons and show loading spinner
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.classList.add('disabled');
        }
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.classList.add('disabled');
        }

        const originalSaveHTML = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
        }

        try {
            // Build initial payload with status 'pending' (to satisfy any RLS insert policy, will be updated to 'approved' immediately after)
            const insertPayload = {
                program_name,
                venue_name,
                city: city || 'Sakarya',
                district,
                day,
                time,
                contact_name,
                contact_phone,
                description,
                status: 'pending'
            };

            // Helper to check and add valid columns
            function addIfValid(dbKeys, value) {
                if (!knownColumns) {
                    insertPayload[dbKeys[0]] = value;
                    return;
                }
                for (const key of dbKeys) {
                    if (knownColumns.includes(key)) {
                        insertPayload[key] = value;
                        return;
                    }
                }
            }

            // Hoca
            if (teacher) {
                addIfValid(['teacher', 'speaker', 'hoca', 'lecturer'], teacher);
            }
            
            // Organization
            if (organization) {
                addIfValid(['organization', 'association', 'community', 'dernek', 'kurum'], organization);
            }
            
            // Address
            if (address) {
                addIfValid(['address', 'location'], address);
            }
            
            // Google Maps Link
            if (google_maps_link) {
                addIfValid(['google_maps_link', 'googleMapsLink', 'maps_link', 'mapsLink'], google_maps_link);
            }
            
            // Photo URL
            if (photo_url) {
                addIfValid(['photo_url', 'photoUrl', 'image_url', 'imageUrl'], photo_url);
            }

            // Ladies Suitable
            if (isLadiesSuitable) {
                let ladiesKeyAdded = false;
                const ladiesKeys = ['ladies_suitable', 'is_ladies_suitable', 'isLadiesSuitable'];
                if (knownColumns) {
                    for (const key of ladiesKeys) {
                        if (knownColumns.includes(key)) {
                            insertPayload[key] = true;
                            ladiesKeyAdded = true;
                            break;
                        }
                    }
                }
                if (!ladiesKeyAdded) {
                    // Prepend/append to description if column doesn't exist
                    insertPayload.description += "\n\n(Not: Hanımlara uygundur.)";
                }
            }

            console.log("Inserting program, initial payload:", insertPayload);

            let attempt = 0;
            let success = false;
            let responseData = null;
            let responseError = null;

            while (attempt < 5) {
                console.log(`Insert attempt #${attempt + 1}, Payload:`, insertPayload);
                const { data, error } = await supabaseClient
                    .from('suggestions')
                    .insert(insertPayload)
                    .select();

                if (!error) {
                    responseData = data;
                    success = true;
                    break;
                }

                responseError = error;
                console.warn(`Attempt #${attempt + 1} failed:`, error);

                // Analyze error message to detect and remove missing columns automatically
                const errMsg = (error.message || '').toLowerCase();
                let columnRemoved = false;

                // Look for column names enclosed in quotes or in plaintext
                const quoteMatches = errMsg.match(/['"`]([a-z0-9_]+)['"`]/g) || [];
                const extractedWords = quoteMatches.map(m => m.replace(/['"`]/g, ''));
                const allWords = errMsg.split(/[^a-z0-9_]/);

                const candidates = new Set([...extractedWords, ...allWords]);

                for (const key of Object.keys(insertPayload)) {
                    if (candidates.has(key.toLowerCase()) || errMsg.includes(key.toLowerCase())) {
                        console.log(`Detected offending column '${key}' in error message, removing from insert payload.`);
                        if (key === 'ladies_suitable' || key === 'is_ladies_suitable' || key === 'isLadiesSuitable') {
                            if (isLadiesSuitable && !insertPayload.description.includes("Hanımlara uygundur")) {
                                insertPayload.description += "\n\n(Not: Hanımlara uygundur.)";
                            }
                        }
                        delete insertPayload[key];
                        columnRemoved = true;
                    }
                }

                // Fallback: If no column could be detected, remove optional columns
                if (!columnRemoved) {
                    const optionalKeys = ['teacher', 'organization', 'address', 'google_maps_link', 'photo_url', 'source', 'ladies_suitable', 'is_ladies_suitable', 'isLadiesSuitable'];
                    for (const optKey of optionalKeys) {
                        if (optKey in insertPayload) {
                            console.log(`No direct match. Removing optional column '${optKey}' as a safe fallback.`);
                            if ((optKey === 'ladies_suitable' || optKey === 'is_ladies_suitable' || optKey === 'isLadiesSuitable') && isLadiesSuitable) {
                                if (!insertPayload.description.includes("Hanımlara uygundur")) {
                                    insertPayload.description += "\n\n(Not: Hanımlara uygundur.)";
                                }
                            }
                            delete insertPayload[optKey];
                            columnRemoved = true;
                            break;
                        }
                    }
                }

                if (!columnRemoved) {
                    break;
                }

                attempt++;
            }

            if (!success) {
                throw responseError;
            }

            // After successful insert as 'pending', update the status to 'approved'
            if (responseData && responseData.length > 0) {
                const insertedId = responseData[0].id;
                console.log(`Successfully inserted pending suggestion ID: ${insertedId}. Now updating to approved...`);
                const { data: updateData, error: updateError } = await supabaseClient
                    .from('suggestions')
                    .update({ status: 'approved' })
                    .eq('id', insertedId)
                    .select();

                if (updateError) {
                    console.error("Failed to update manually added suggestion status to approved:", updateError);
                    throw updateError;
                } else if (updateData && updateData.length > 0) {
                    responseData = updateData;
                }
            }

            // Success
            let syncSuccess = true;
            if (responseData && responseData.length > 0) {
                try {
                    const logo_url = document.getElementById('add-program-logo-url')?.value.trim() || '';
                    await syncSuggestionToProgram(responseData[0], 'admin_manual', logo_url);
                } catch (syncError) {
                    syncSuccess = false;
                    console.error("Programs tablosuna aktarım hatası (manuel):", syncError);
                }
            } else {
                syncSuccess = false;
            }

            if (syncSuccess) {
                showToast("Program başarıyla eklendi ve yayına hazırlandı.", "success");
            } else {
                showToast("Program eklendi fakat programs tablosuna aktarılamadı.", "error");
            }
            closeAddModal();

            // Set current tab to approved
            const approvedTabBtn = document.querySelector('.tab-btn[data-status="approved"]');
            if (approvedTabBtn) {
                const tabBtns = document.querySelectorAll('.tab-btn');
                tabBtns.forEach(b => b.classList.remove('active'));
                approvedTabBtn.classList.add('active');
            }
            currentTabStatus = 'approved';

            // Reload data
            await loadData();

        } catch (error) {
            console.error('Program eklenirken hata oluştu:', error);
            showToast("Program eklenirken hata oluştu.", "error");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.classList.remove('disabled');
                saveBtn.innerHTML = originalSaveHTML;
            }
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.classList.remove('disabled');
            }
        }
    }

    addBtnSave?.addEventListener('click', async (e) => {
        e.preventDefault();
        await handleAddProgramSubmit();
    });

    // Tab buttons event listeners
    function initTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTabStatus = btn.getAttribute('data-status');
                await loadData();
            });
        });
    }

    // ==========================================================
    // Programlar (Programs) H2 Custom Implementation
    // ==========================================================

    function getSourceBadge(source) {
        let label = 'KAYNAK YOK';
        let badgeClass = 'source-badge source-unknown';
        
        if (source === 'app_migration') {
            label = 'APP';
            badgeClass = 'source-badge source-app';
        } else if (source === 'admin_manual') {
            label = 'MANUEL';
            badgeClass = 'source-badge source-manual';
        } else if (source === 'approved_suggestion' || source === 'suggestion') {
            label = 'ÖNERİ';
            badgeClass = 'source-badge source-suggestion';
        }
        return { label, badgeClass };
    }

    function getStatusBadge(status) {
        let label = 'Durum belirsiz';
        let badgeClass = 'status-badge status-unknown';
        
        const statusVal = (status || '').toLowerCase();
        if (statusVal === 'active') {
            label = '🟢 Devam Ediyor';
            badgeClass = 'status-badge status-approved';
        } else if (statusVal === 'passive' || statusVal === 'inactive') {
            label = '🌙 Ara Verildi';
            badgeClass = 'status-badge status-rejected';
        } else if (statusVal === 'deleted') {
            label = '🗑 Silindi';
            badgeClass = 'status-badge status-deleted';
        }
        return { label, badgeClass };
    }

    // ==========================================================
    // Program Status Change Toggle Logic (Paket H5)
    // ==========================================================
    let programToToggle = null;

    function openStatusConfirmModal(item) {
        programToToggle = item;
        const modal = document.getElementById('status-confirm-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = "hidden";
        }
    }

    function closeStatusConfirmModal() {
        const modal = document.getElementById('status-confirm-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = "";
        }
        programToToggle = null;
    }

    async function handleStatusConfirmOk() {
        if (!programToToggle) return;
        const programId = programToToggle.id;
        closeStatusConfirmModal();
        await updateProgramStatus(programId, 'inactive');
    }

    async function updateProgramStatus(programId, newStatus) {
        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        // Set loading state on the button
        const buttons = document.querySelectorAll(`.btn-status-toggle[data-id="${programId}"]`);
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Güncelleniyor...';
        });

        try {
            console.log(`Updating program ID ${programId} status to ${newStatus}...`);
            const { error } = await supabaseClient
                .from('programs')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', programId);

            if (error) {
                console.warn("Update with updated_at failed, trying status only:", error);
                const retryRes = await supabaseClient
                    .from('programs')
                    .update({ status: newStatus })
                    .eq('id', programId);
                if (retryRes.error) throw retryRes.error;
            }

            showToast("Program başarıyla güncellendi.", "success");
            await loadPrograms();

        } catch (error) {
            console.error('Program durum güncelleme hatası:', error);
            showToast("Güncelleme sırasında hata oluştu.", "error");
            await loadPrograms();
        }
    }

    // ==========================================================
    // Program Deletion Logic (Paket H6)
    // ==========================================================
    let programToDelete = null;

    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const deleteConfirmName = document.getElementById('delete-confirm-name');
    const deleteConfirmVenue = document.getElementById('delete-confirm-venue');
    const deleteConfirmDistrict = document.getElementById('delete-confirm-district');
    const deleteConfirmDay = document.getElementById('delete-confirm-day');
    const deleteConfirmTime = document.getElementById('delete-confirm-time');
    const deleteConfirmCancelBtn = document.getElementById('delete-confirm-cancel-btn');
    const deleteConfirmCloseTop = document.getElementById('delete-confirm-close-top');
    const deleteConfirmOkBtn = document.getElementById('delete-confirm-ok-btn');

    function openDeleteConfirmModal(item) {
        programToDelete = item;
        if (deleteConfirmName) deleteConfirmName.textContent = item.program_name || '-';
        if (deleteConfirmVenue) deleteConfirmVenue.textContent = item.venue_name || '-';
        if (deleteConfirmDistrict) deleteConfirmDistrict.textContent = item.district || '-';
        if (deleteConfirmDay) deleteConfirmDay.textContent = item.day || '-';
        if (deleteConfirmTime) deleteConfirmTime.textContent = item.time || '-';

        if (deleteConfirmModal) {
            deleteConfirmModal.classList.remove('hidden');
            document.body.style.overflow = "hidden";
        }
    }

    function closeDeleteConfirmModal() {
        if (deleteConfirmModal) {
            deleteConfirmModal.classList.add('hidden');
            document.body.style.overflow = "";
        }
        programToDelete = null;
    }

    async function handleDeleteProgram() {
        if (!programToDelete || !programToDelete.id) {
            showToast("Program silinemedi.", "error");
            closeDeleteConfirmModal();
            return;
        }

        const programId = programToDelete.id;

        if (deleteConfirmOkBtn) {
            deleteConfirmOkBtn.disabled = true;
            deleteConfirmOkBtn.classList.add('disabled');
            deleteConfirmOkBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Taşınıyor...';
        }
        if (deleteConfirmCancelBtn) {
            deleteConfirmCancelBtn.disabled = true;
            deleteConfirmCancelBtn.classList.add('disabled');
        }

        try {
            console.log(`Soft deleting program with ID: ${programId}`);
            let updatedRows = [];
            let updateError = null;

            const updatePayload = {
                status: 'deleted',
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabaseClient
                .from('programs')
                .update(updatePayload)
                .eq('id', programId)
                .select();
            
            updateError = error;
            updatedRows = data;

            if (updateError) {
                console.warn("Soft delete with updated_at failed, retrying without updated_at:", updateError);
                const retryRes = await supabaseClient
                    .from('programs')
                    .update({ status: 'deleted' })
                    .eq('id', programId)
                    .select();
                updateError = retryRes.error;
                updatedRows = retryRes.data;
            }

            if (updateError) {
                throw updateError;
            }

            if (!updatedRows || updatedRows.length === 0) {
                throw new Error("Program güncellenemedi (kayıt bulunamadı veya RLS engelledi).");
            }

            // Successfully soft deleted
            showToast("Program çöp kutusuna taşındı.", "success");
            closeDeleteConfirmModal();

            // Sync local state
            if (typeof loadedPrograms !== 'undefined' && Array.isArray(loadedPrograms)) {
                loadedPrograms = loadedPrograms.filter(p => p.id !== programId);
                processPrograms(loadedPrograms);
            } else {
                await loadPrograms();
            }

        } catch (error) {
            console.error('Program silme hatası:', error);
            showToast("Program silinemedi.", "error");
        } finally {
            if (deleteConfirmOkBtn) {
                deleteConfirmOkBtn.disabled = false;
                deleteConfirmOkBtn.classList.remove('disabled');
                deleteConfirmOkBtn.textContent = 'Programı Sil';
            }
            if (deleteConfirmCancelBtn) {
                deleteConfirmCancelBtn.disabled = false;
                deleteConfirmCancelBtn.classList.remove('disabled');
            }
        }
    }

    async function restoreProgram(programId) {
        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        try {
            console.log(`Restoring program ID ${programId} to inactive...`);
            const { data, error } = await supabaseClient
                .from('programs')
                .update({ status: 'inactive', updated_at: new Date().toISOString() })
                .eq('id', programId)
                .select();

            let updateError = error;
            let updatedRows = data;

            if (updateError) {
                console.warn("Restore with updated_at failed, trying status only:", updateError);
                const retryRes = await supabaseClient
                    .from('programs')
                    .update({ status: 'inactive' })
                    .eq('id', programId)
                    .select();
                updateError = retryRes.error;
                updatedRows = retryRes.data;
            }

            if (updateError) {
                throw updateError;
            }

            if (!updatedRows || updatedRows.length === 0) {
                throw new Error("No rows updated.");
            }

            showToast("Program çöp kutusundan geri alındı.", "success");
            await loadPrograms();

        } catch (error) {
            console.error('Program geri alma hatası:', error);
            showToast("Program geri alınamadı.", "error");
        }
    }

    async function loadPrograms() {
        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        showProgramsLoader();

        try {
            console.log("Fetching program records from public.programs...");
            const { data: programsData, error: fetchError } = await supabaseClient
                .from('programs')
                .select('*')
                .order('created_at', { ascending: false });

            if (fetchError) {
                console.warn("created_at sorting failed, trying program_name sorting:", fetchError);
                const { data: altProgramsData, error: altFetchError } = await supabaseClient
                    .from('programs')
                    .select('*')
                    .order('program_name', { ascending: true });
                
                if (altFetchError) throw altFetchError;
                processPrograms(altProgramsData);
            } else {
                processPrograms(programsData);
            }
        } catch (error) {
            console.error('Programlar yüklenirken hata oluştu:', error);
            showProgramsError();
        }
    }

    function processPrograms(programs) {
        // Separate deleted and normal programs (deleted are kept for Trash Bin view)
        const normalPrograms = programs.filter(p => (p.status || '').toLowerCase() !== 'deleted');
        const deletedPrograms = programs.filter(p => (p.status || '').toLowerCase() === 'deleted');

        const totalCount = normalPrograms.length;
        const activeCount = normalPrograms.filter(p => (p.status || '').toLowerCase() === 'active').length;
        const passiveCount = totalCount - activeCount;

        const statsTotalVal = document.getElementById('stats-total-programs-val');
        const statsActiveVal = document.getElementById('stats-active-programs-val');
        const statsPassiveVal = document.getElementById('stats-passive-programs-val');
        const statsTrashVal = document.getElementById('stats-trash-programs-val');

        if (statsTotalVal) statsTotalVal.textContent = totalCount;
        if (statsActiveVal) statsActiveVal.textContent = activeCount;
        if (statsPassiveVal) statsPassiveVal.textContent = passiveCount;
        if (statsTrashVal) statsTrashVal.textContent = deletedPrograms.length;

        // Set loadedPrograms to deletedPrograms when in trash bin view, otherwise normalPrograms
        if (isTrashBinView) {
            loadedPrograms = deletedPrograms;
        } else {
            loadedPrograms = normalPrograms;
        }

        populateFilterOptions(loadedPrograms);
        applyFilters();
    }

    function populateFilterOptions(programs) {
        const districtSelect = document.getElementById('filter-district');
        const daySelect = document.getElementById('filter-day');

        if (districtSelect) {
            const currentSelected = districtSelect.value;
            districtSelect.innerHTML = '<option value="">Tüm İlçeler</option>';
            
            // Unique trimmed districts sorted Turkish-safely
            const districts = [...new Set(programs.map(p => (p.district || '').trim()).filter(Boolean))];
            districts.sort((a, b) => a.localeCompare(b, 'tr'));
            
            districts.forEach(d => {
                const option = document.createElement('option');
                option.value = d;
                option.textContent = d;
                districtSelect.appendChild(option);
            });
            
            if (districts.includes(currentSelected)) {
                districtSelect.value = currentSelected;
            } else {
                districtSelect.value = '';
            }
        }

        if (daySelect) {
            const currentSelected = daySelect.value;
            daySelect.innerHTML = '<option value="">Tüm Günler</option>';
            
            const uniqueDays = [...new Set(programs.map(p => (p.day || '').trim()).filter(Boolean))];
            
            // Standard days in Turkish
            const standardDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
            const foundDays = [];
            standardDays.forEach(sd => {
                const match = uniqueDays.find(ud => ud.toLowerCase() === sd.toLowerCase());
                if (match) {
                    foundDays.push(match);
                }
            });
            const otherDays = uniqueDays.filter(ud => !standardDays.some(sd => sd.toLowerCase() === ud.toLowerCase()));
            otherDays.sort((a, b) => a.localeCompare(b, 'tr'));
            const finalDays = [...foundDays, ...otherDays];
            
            finalDays.forEach(d => {
                const option = document.createElement('option');
                option.value = d;
                option.textContent = d;
                daySelect.appendChild(option);
            });

            if (finalDays.includes(currentSelected)) {
                daySelect.value = currentSelected;
            } else {
                daySelect.value = '';
            }
        }
    }

    function applyFilters() {
        const searchQuery = document.getElementById('filter-search')?.value.trim().toLowerCase() || '';
        const selectedDistrict = isTrashBinView ? '' : (document.getElementById('filter-district')?.value || '');
        const selectedDay = isTrashBinView ? '' : (document.getElementById('filter-day')?.value || '');
        const selectedStatus = isTrashBinView ? '' : (document.getElementById('filter-status')?.value || '');
        const selectedSource = isTrashBinView ? '' : (document.getElementById('filter-source')?.value || '');

        const filtered = loadedPrograms.filter(item => {
            // 1. Search filter
            if (searchQuery) {
                const name = (item.program_name || '').toLowerCase();
                const venue = (item.venue_name || '').toLowerCase();
                const teacher = (item.teacher || '').toLowerCase();
                const org = (item.organization || '').toLowerCase();
                const dist = (item.district || '').toLowerCase();
                const desc = (item.description || '').toLowerCase();
                
                if (!name.includes(searchQuery) &&
                    !venue.includes(searchQuery) &&
                    !teacher.includes(searchQuery) &&
                    !org.includes(searchQuery) &&
                    !dist.includes(searchQuery) &&
                    !desc.includes(searchQuery)) {
                    return false;
                }
            }

            // 2. District filter
            if (selectedDistrict && (item.district || '').trim() !== selectedDistrict) {
                return false;
            }

            // 3. Day filter
            if (selectedDay && (item.day || '').trim() !== selectedDay) {
                return false;
            }

            // 4. Status filter
            if (selectedStatus) {
                const statusVal = (item.status || '').toLowerCase();
                if (selectedStatus === 'active') {
                    if (statusVal !== 'active') return false;
                } else if (selectedStatus === 'passive') {
                    if (statusVal !== 'passive' && statusVal !== 'inactive') return false;
                }
            }

            // 5. Source filter
            if (selectedSource) {
                const source = item.source;
                if (selectedSource === 'app_migration') {
                    if (source !== 'app_migration') return false;
                } else if (selectedSource === 'admin_manual') {
                    if (source !== 'admin_manual') return false;
                } else if (selectedSource === 'suggestion') {
                    if (source !== 'approved_suggestion' && source !== 'suggestion') return false;
                } else if (selectedSource === 'unknown') {
                    if (source === 'app_migration' || source === 'admin_manual' || source === 'approved_suggestion' || source === 'suggestion') return false;
                }
            }

            return true;
        });

        // Req 9: Show filter info text
        const infoText = document.getElementById('filter-info-text');
        if (infoText) {
            infoText.textContent = `${loadedPrograms.length} program içinden ${filtered.length} kayıt gösteriliyor.`;
        }

        // Update list header subtitle
        const subtitleText = document.querySelector('.header-title-wrapper .subtitle-text');
        if (subtitleText) {
            subtitleText.innerHTML = `<span id="programs-count-total">${loadedPrograms.length}</span> program içinden <span id="programs-count">${filtered.length}</span> kayıt gösteriliyor`;
        }

        renderPrograms(filtered);
    }

    function renderPrograms(programs) {
        const programsList = document.getElementById('programs-list');
        const programsCount = document.getElementById('programs-count');

        if (!programsList) return;

        programsList.innerHTML = '';

        if (programsCount) {
            programsCount.textContent = programs.length;
        }

        if (programs.length === 0) {
            const emptyContainer = document.getElementById('programs-empty-container');
            if (emptyContainer) {
                if (loadedPrograms.length > 0) {
                    const searchQuery = document.getElementById('filter-search')?.value.trim() || '';
                    const selectedDistrict = document.getElementById('filter-district')?.value || '';
                    const selectedDay = document.getElementById('filter-day')?.value || '';
                    const selectedStatus = document.getElementById('filter-status')?.value || '';
                    const selectedSource = document.getElementById('filter-source')?.value || '';

                    let activeFiltersHtml = '';
                    if (searchQuery) activeFiltersHtml += `<span class="active-filter-badge">Arama: "${escapeHtml(searchQuery)}"</span>`;
                    if (selectedDistrict) activeFiltersHtml += `<span class="active-filter-badge">İlçe: ${escapeHtml(selectedDistrict)}</span>`;
                    if (selectedDay) activeFiltersHtml += `<span class="active-filter-badge">Gün: ${escapeHtml(selectedDay)}</span>`;
                    if (selectedStatus) {
                        const statusText = selectedStatus === 'active' ? 'Devam Eden' : 'Ara Verilen';
                        activeFiltersHtml += `<span class="active-filter-badge">Durum: ${statusText}</span>`;
                    }
                    if (selectedSource) {
                        let sourceText = 'Tüm Kaynaklar';
                        if (selectedSource === 'app_migration') sourceText = 'APP';
                        else if (selectedSource === 'admin_manual') sourceText = 'MANUEL';
                        else if (selectedSource === 'suggestion') sourceText = 'ÖNERİ';
                        else if (selectedSource === 'unknown') sourceText = 'KAYNAK YOK';
                        activeFiltersHtml += `<span class="active-filter-badge">Kaynak: ${sourceText}</span>`;
                    }

                    emptyContainer.innerHTML = `
                        <i class="fa-solid fa-filter-circle-xmark state-icon" style="color: var(--md-secondary); font-size: 48px;"></i>
                        <h4>Filtreye uygun program bulunamadı.</h4>
                        <p style="margin-bottom: 15px; color: var(--md-on-surface-variant);">Seçili filtreleri temizleyerek tüm programları tekrar görüntüleyebilirsiniz.</p>
                        ${activeFiltersHtml ? `<div class="active-filters-container" style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px;">${activeFiltersHtml}</div>` : ''}
                        <button id="empty-clear-filters-btn" class="btn btn-secondary btn-sm" style="border-radius: var(--radius-md);"><i class="fa-solid fa-filter-circle-xmark"></i> Filtreleri Temizle</button>
                    `;

                    const clearBtn = emptyContainer.querySelector('#empty-clear-filters-btn');
                    if (clearBtn) {
                        clearBtn.addEventListener('click', () => {
                            document.getElementById('filter-clear-btn')?.click();
                        });
                    }
                } else {
                    emptyContainer.innerHTML = `
                        <i class="fa-solid fa-clipboard-question state-icon"></i>
                        <h4>Şu anda kayıtlı program bulunmuyor.</h4>
                        <p>Veri tabanında kayıtlı herhangi bir program bulunmamaktadır.</p>
                    `;
                }
            }
            showProgramsEmpty();
            return;
        }

        hideProgramsStates();

        // Configure class list for the programs-list wrapper according to view mode
        programsList.className = 'suggestions-list'; 
        if (currentViewMode === 'card') {
            programsList.classList.add('grid-list', 'view-card');
        } else {
            programsList.classList.add('programs-list-table-wrapper');
        }

        if (currentViewMode === 'card') {
            programs.forEach(item => {
                const card = document.createElement('div');
                card.className = 'suggestion-card';
                
                const sourceBadge = getSourceBadge(item.source);
                const statusBadge = getStatusBadge(item.status);

                let photoMarkup = '';
                if (item.photo_url) {
                    photoMarkup = `
                        <div class="suggestion-photo-preview">
                            <img src="${item.photo_url}" alt="Program Fotoğrafı" onerror="this.style.display='none';">
                        </div>
                    `;
                }

                let ladiesMarkup = '';
                if (item.women_friendly || item.ladies_suitable || item.is_ladies_suitable) {
                    ladiesMarkup = `<span class="category-badge" style="background-color: #fce4ec; color: #c2185b; border-color: rgba(194, 24, 91, 0.2);"><i class="fa-solid fa-person-dress"></i> Hanımlara Uygun</span>`;
                }

                const statusVal = (item.status || '').toLowerCase();
                const toggleButtonHtml = statusVal === 'active'
                    ? `<button class="btn btn-secondary btn-status-toggle" data-id="${item.id}" data-action="pause" style="width: 100%;"><i class="fa-solid fa-moon"></i> 🌙 Ara Ver</button>`
                    : `<button class="btn btn-primary btn-status-toggle" data-id="${item.id}" data-action="resume" style="width: 100%;"><i class="fa-solid fa-play"></i> ▶️ Devam Ettir</button>`;

                const editButtonHtml = isTrashBinView ? '' : `
                    <button class="btn-card-edit" title="Programı Düzenle">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                `;

                card.innerHTML = `
                    <div class="card-header-info">
                        <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                            <span class="${sourceBadge.badgeClass}" style="font-size: 11px; padding: 2px 8px;">${escapeHtml(sourceBadge.label)}</span>
                            <span class="${statusBadge.badgeClass}" style="font-size: 11px; padding: 2px 8px;">${escapeHtml(statusBadge.label)}</span>
                            ${ladiesMarkup}
                        </div>
                        ${editButtonHtml}
                    </div>
                    
                    <h4 class="program-title" title="${escapeHtml(item.program_name || 'İsimsiz Program')}">${escapeHtml(item.program_name || 'İsimsiz Program')}</h4>
                    <p class="venue-info" title="${escapeHtml(item.venue_name || 'Bilinmeyen Mekân')}"><i class="fa-solid fa-location-dot"></i> <strong>${escapeHtml(item.venue_name || 'Bilinmeyen Mekân')}</strong></p>
                    
                    <div class="details-grid">
                        <div class="detail-item" title="${escapeHtml(item.district || '-')}">
                            <span class="detail-label">📍 İlçe:</span>
                            <span class="detail-value">${escapeHtml(item.district || '-')}</span>
                        </div>
                        <div class="detail-item" title="${escapeHtml(item.day || '-')} - ${escapeHtml(item.time || '-')}">
                            <span class="detail-label">🕒 Gün & Saat:</span>
                            <span class="detail-value">${escapeHtml(item.day || '-')} - ${escapeHtml(item.time || '-')}</span>
                        </div>
                        <div class="detail-item" title="${escapeHtml(item.teacher || '-')}">
                            <span class="detail-label">👤 Hoca:</span>
                            <span class="detail-value">${escapeHtml(item.teacher || '-')}</span>
                        </div>
                        <div class="detail-item" title="${escapeHtml(item.organization || '-')}">
                            <span class="detail-label">🏢 Kurum / Dernek:</span>
                            <span class="detail-value">${escapeHtml(item.organization || '-')}</span>
                        </div>
                    </div>

                    ${photoMarkup}

                    <div class="card-actions" style="margin-top: auto; display: flex; gap: 8px; width: 100%;">
                        ${isTrashBinView ? `
                            <button class="btn btn-primary btn-restore-program" data-id="${item.id}" style="width: 100%; background-color: var(--md-primary); border-color: var(--md-primary);"><i class="fa-solid fa-trash-arrow-up"></i> Geri Al</button>
                        ` : `
                            ${toggleButtonHtml}
                            <button class="btn btn-reject btn-delete-program" data-id="${item.id}" style="width: auto; min-width: 44px; padding: 0 12px; background-color: var(--md-error-container); color: var(--md-error);" title="Programı Sil">
                                <i class="fa-solid fa-trash-can"></i> Sil
                            </button>
                        `}
                    </div>
                `;

                // Bind click event to card edit button (Paket H4)
                const cardEditBtn = card.querySelector('.btn-card-edit');
                if (cardEditBtn) {
                    cardEditBtn.addEventListener('click', () => {
                        openProgramEditModal(item);
                    });
                }

                // Bind click event to status toggle button (Paket H5)
                const statusToggleBtn = card.querySelector('.btn-status-toggle');
                if (statusToggleBtn) {
                    statusToggleBtn.addEventListener('click', async () => {
                        const action = statusToggleBtn.getAttribute('data-action');
                        if (action === 'pause') {
                            openStatusConfirmModal(item);
                        } else if (action === 'resume') {
                            await updateProgramStatus(item.id, 'active');
                        }
                    });
                }

                // Bind click event to card delete button (Paket H6)
                const deleteBtn = card.querySelector('.btn-delete-program');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => {
                        openDeleteConfirmModal(item);
                    });
                }

                // Bind click event to card restore button (Paket H6.2)
                const restoreBtn = card.querySelector('.btn-restore-program');
                if (restoreBtn) {
                    restoreBtn.addEventListener('click', async () => {
                        await restoreProgram(item.id);
                    });
                }

                programsList.appendChild(card);
            });
        } else {
            // Render List View or Compact View using semantic table representation
            const tableResponsive = document.createElement('div');
            tableResponsive.className = 'programs-table-responsive';

            const table = document.createElement('table');
            table.className = currentViewMode === 'list' 
                ? 'programs-admin-table list-view-table' 
                : 'programs-admin-table compact-view-table';

            if (currentViewMode === 'compact') {
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Durum</th>
                            <th>Kaynak</th>
                            <th>Program</th>
                            <th>İlçe</th>
                            <th>Gün</th>
                            <th>Saat</th>
                            <th>Hoca</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                `;
            } else {
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Durum</th>
                            <th>Kaynak</th>
                            <th>Program Adı</th>
                            <th>Mekân</th>
                            <th>İlçe</th>
                            <th>Gün</th>
                            <th>Saat</th>
                            <th>Hoca</th>
                            <th>Kurum</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                `;
            }

            const tbody = table.querySelector('tbody');

            programs.forEach(item => {
                const tr = document.createElement('tr');
                
                const sourceBadge = getSourceBadge(item.source);
                const statusBadge = getStatusBadge(item.status);
                const statusVal = (item.status || '').toLowerCase();

                let toggleButtonHtml = '';
                if (currentViewMode === 'list') {
                    toggleButtonHtml = statusVal === 'active'
                        ? `<button class="btn btn-secondary btn-sm btn-status-toggle" data-id="${item.id}" data-action="pause"><i class="fa-solid fa-moon"></i> 🌙 Ara Ver</button>`
                        : `<button class="btn btn-primary btn-sm btn-status-toggle" data-id="${item.id}" data-action="resume"><i class="fa-solid fa-play"></i> ▶️ Devam Ettir</button>`;
                } else {
                    // Ultra dense style for Compact View
                    toggleButtonHtml = statusVal === 'active'
                        ? `<button class="btn btn-secondary btn-status-toggle" data-id="${item.id}" data-action="pause" style="min-height: 28px; padding: 2px 6px; font-size: 11px;"><i class="fa-solid fa-moon"></i> Ara Ver</button>`
                        : `<button class="btn btn-primary btn-status-toggle" data-id="${item.id}" data-action="resume" style="min-height: 28px; padding: 2px 6px; font-size: 11px;"><i class="fa-solid fa-play"></i> Devam Ettir</button>`;
                }

                let actionsHtml = '';
                if (isTrashBinView) {
                    actionsHtml = `
                        <button class="btn btn-primary btn-sm btn-restore-program" data-id="${item.id}" style="background-color: var(--md-primary); border-color: var(--md-primary);">
                            <i class="fa-solid fa-trash-arrow-up"></i> Geri Al
                        </button>
                    `;
                } else {
                    actionsHtml = `
                        <button class="btn-table-edit" title="Programı Düzenle">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        ${toggleButtonHtml}
                        <button class="btn-table-delete text-danger" data-id="${item.id}" title="Programı Sil">
                            <i class="fa-solid fa-trash-can"></i> Sil
                        </button>
                    `;
                }

                if (currentViewMode === 'compact') {
                    tr.innerHTML = `
                        <td title="${escapeHtml(statusBadge.label)}">
                            <span class="${statusBadge.badgeClass}">${escapeHtml(statusBadge.label)}</span>
                        </td>
                        <td title="${escapeHtml(sourceBadge.label)}">
                            <span class="${sourceBadge.badgeClass}">${escapeHtml(sourceBadge.label)}</span>
                        </td>
                        <td title="${escapeHtml(item.program_name || 'İsimsiz Program')}">
                            <span class="table-program-name">${escapeHtml(item.program_name || 'İsimsiz Program')}</span>
                        </td>
                        <td title="${escapeHtml(item.district || '-')}">${escapeHtml(item.district || '-')}</td>
                        <td title="${escapeHtml(item.day || '-')}">${escapeHtml(item.day || '-')}</td>
                        <td title="${escapeHtml(item.time || '-')}"><strong>${escapeHtml(item.time || '-')}</strong></td>
                        <td title="${escapeHtml(item.teacher || '-')}">${escapeHtml(item.teacher || '-')}</td>
                        <td>
                            <div class="table-actions">
                                ${actionsHtml}
                            </div>
                        </td>
                    `;
                } else {
                    tr.innerHTML = `
                        <td title="${escapeHtml(statusBadge.label)}">
                            <span class="${statusBadge.badgeClass}">${escapeHtml(statusBadge.label)}</span>
                        </td>
                        <td title="${escapeHtml(sourceBadge.label)}">
                            <span class="${sourceBadge.badgeClass}">${escapeHtml(sourceBadge.label)}</span>
                        </td>
                        <td title="${escapeHtml(item.program_name || 'İsimsiz Program')}">
                            <span class="table-program-name">${escapeHtml(item.program_name || 'İsimsiz Program')}</span>
                        </td>
                        <td title="${escapeHtml(item.venue_name || '-')}">
                            <span class="table-venue-name">${escapeHtml(item.venue_name || '-')}</span>
                        </td>
                        <td title="${escapeHtml(item.district || '-')}">${escapeHtml(item.district || '-')}</td>
                        <td title="${escapeHtml(item.day || '-')}">${escapeHtml(item.day || '-')}</td>
                        <td title="${escapeHtml(item.time || '-')}"><strong>${escapeHtml(item.time || '-')}</strong></td>
                        <td title="${escapeHtml(item.teacher || '-')}">${escapeHtml(item.teacher || '-')}</td>
                        <td title="${escapeHtml(item.organization || '-')}">${escapeHtml(item.organization || '-')}</td>
                        <td>
                            <div class="table-actions">
                                ${actionsHtml}
                            </div>
                        </td>
                    `;
                }

                // Bind click event to table edit button
                const tableEditBtn = tr.querySelector('.btn-table-edit');
                if (tableEditBtn) {
                    tableEditBtn.addEventListener('click', () => {
                        openProgramEditModal(item);
                    });
                }

                // Bind click event to status toggle button
                const statusToggleBtn = tr.querySelector('.btn-status-toggle');
                if (statusToggleBtn) {
                    statusToggleBtn.addEventListener('click', async () => {
                        const action = statusToggleBtn.getAttribute('data-action');
                        if (action === 'pause') {
                            openStatusConfirmModal(item);
                        } else if (action === 'resume') {
                            await updateProgramStatus(item.id, 'active');
                        }
                    });
                }

                // Bind click event to table delete button (Paket H6)
                const tableDeleteBtn = tr.querySelector('.btn-table-delete');
                if (tableDeleteBtn) {
                    tableDeleteBtn.addEventListener('click', () => {
                        openDeleteConfirmModal(item);
                    });
                }

                // Bind click event to table restore button (Paket H6.2)
                const tableRestoreBtn = tr.querySelector('.btn-restore-program');
                if (tableRestoreBtn) {
                    tableRestoreBtn.addEventListener('click', async () => {
                        await restoreProgram(item.id);
                    });
                }

                tbody.appendChild(tr);
            });

            tableResponsive.appendChild(table);
            programsList.appendChild(tableResponsive);
        }
    }

    function showProgramsLoader() {
        const loader = document.getElementById('programs-loader');
        const errorContainer = document.getElementById('programs-error-container');
        const emptyContainer = document.getElementById('programs-empty-container');
        const list = document.getElementById('programs-list');

        if (loader) loader.classList.remove('hidden');
        if (errorContainer) errorContainer.classList.add('hidden');
        if (emptyContainer) emptyContainer.classList.add('hidden');
        if (list) list.classList.add('hidden');
    }

    function showProgramsError() {
        const loader = document.getElementById('programs-loader');
        const errorContainer = document.getElementById('programs-error-container');
        const emptyContainer = document.getElementById('programs-empty-container');
        const list = document.getElementById('programs-list');

        if (loader) loader.classList.add('hidden');
        if (errorContainer) errorContainer.classList.remove('hidden');
        if (emptyContainer) emptyContainer.classList.add('hidden');
        if (list) list.classList.add('hidden');
    }

    function showProgramsEmpty() {
        const loader = document.getElementById('programs-loader');
        const errorContainer = document.getElementById('programs-error-container');
        const emptyContainer = document.getElementById('programs-empty-container');
        const list = document.getElementById('programs-list');

        if (loader) loader.classList.add('hidden');
        if (errorContainer) errorContainer.classList.add('hidden');
        if (emptyContainer) emptyContainer.classList.remove('hidden');
        if (list) list.classList.add('hidden');
    }

    function hideProgramsStates() {
        const loader = document.getElementById('programs-loader');
        const errorContainer = document.getElementById('programs-error-container');
        const emptyContainer = document.getElementById('programs-empty-container');
        const list = document.getElementById('programs-list');

        if (loader) loader.classList.add('hidden');
        if (errorContainer) errorContainer.classList.add('hidden');
        if (emptyContainer) emptyContainer.classList.add('hidden');
        if (list) list.classList.remove('hidden');
    }

    function initFilterListeners() {
        document.getElementById('filter-search')?.addEventListener('input', applyFilters);
        document.getElementById('filter-district')?.addEventListener('change', applyFilters);
        document.getElementById('filter-day')?.addEventListener('change', applyFilters);
        document.getElementById('filter-status')?.addEventListener('change', applyFilters);
        document.getElementById('filter-source')?.addEventListener('change', applyFilters);
        
        document.getElementById('filter-clear-btn')?.addEventListener('click', () => {
            const searchInput = document.getElementById('filter-search');
            if (searchInput) searchInput.value = '';

            const districtSelect = document.getElementById('filter-district');
            if (districtSelect) districtSelect.value = '';

            const daySelect = document.getElementById('filter-day');
            if (daySelect) daySelect.value = '';

            const statusSelect = document.getElementById('filter-status');
            if (statusSelect) statusSelect.value = 'active';

            const sourceSelect = document.getElementById('filter-source');
            if (sourceSelect) sourceSelect.value = '';

            applyFilters();
        });
    }

    // Primary Tab Switcher (Öneriler vs. Programlar vs. Kurumlar vs. Camiler)
    function initMainNavigation() {
        const tabSuggestions = document.getElementById('main-tab-suggestions');
        const tabPrograms = document.getElementById('main-tab-programs');
        const tabOrganizations = document.getElementById('main-tab-organizations');
        const tabMosques = document.getElementById('main-tab-mosques');
        const suggestionsContent = document.getElementById('suggestions-tab-content');
        const programsContent = document.getElementById('programs-tab-content');
        const organizationsContent = document.getElementById('organizations-tab-content');
        const mosquesContent = document.getElementById('mosques-tab-content');

        if (tabSuggestions && tabPrograms && tabOrganizations && tabMosques && suggestionsContent && programsContent && organizationsContent && mosquesContent) {
            tabSuggestions.addEventListener('click', () => {
                tabSuggestions.classList.add('active');
                tabPrograms.classList.remove('active');
                tabOrganizations.classList.remove('active');
                tabMosques.classList.remove('active');
                suggestionsContent.classList.remove('hidden');
                programsContent.classList.add('hidden');
                organizationsContent.classList.add('hidden');
                mosquesContent.classList.add('hidden');
            });

            tabPrograms.addEventListener('click', () => {
                tabPrograms.classList.add('active');
                tabSuggestions.classList.remove('active');
                tabOrganizations.classList.remove('active');
                tabMosques.classList.remove('active');
                programsContent.classList.remove('hidden');
                suggestionsContent.classList.add('hidden');
                organizationsContent.classList.add('hidden');
                mosquesContent.classList.add('hidden');
                loadPrograms();
            });

            tabOrganizations.addEventListener('click', () => {
                tabOrganizations.classList.add('active');
                tabSuggestions.classList.remove('active');
                tabPrograms.classList.remove('active');
                tabMosques.classList.remove('active');
                organizationsContent.classList.remove('hidden');
                suggestionsContent.classList.add('hidden');
                programsContent.classList.add('hidden');
                mosquesContent.classList.add('hidden');
                loadAdminOrganizations();
            });

            tabMosques.addEventListener('click', () => {
                tabMosques.classList.add('active');
                tabSuggestions.classList.remove('active');
                tabPrograms.classList.remove('active');
                tabOrganizations.classList.remove('active');
                mosquesContent.classList.remove('hidden');
                suggestionsContent.classList.add('hidden');
                programsContent.classList.add('hidden');
                organizationsContent.classList.add('hidden');
                loadMosques();
            });
        }
    }

    // ==========================================================
    // Program Düzenleme Paneli İşlevleri (Paket H4)
    // ==========================================================
    let currentEditProgram = null;
    let initialProgramState = null;

    function openProgramEditModal(item) {
        currentEditProgram = item;
        initialProgramState = JSON.parse(JSON.stringify(item)); // Değişiklikleri izlemek için derin kopya alıyoruz

        // Sadece okunabilir alanlar
        const idInput = document.getElementById('edit-program-id');
        if (idInput) idInput.value = item.id || '';

        const suggIdInput = document.getElementById('edit-program-suggestion-id');
        if (suggIdInput) suggIdInput.value = item.suggestion_id || '';

        // Kaynak Rozeti (Source Mapping)
        let sourceLabel = 'KAYNAK YOK';
        if (item.source === 'app_migration') {
            sourceLabel = 'APP';
        } else if (item.source === 'admin_manual') {
            sourceLabel = 'MANUEL';
        } else if (item.source === 'approved_suggestion' || item.source === 'suggestion') {
            sourceLabel = 'ÖNERİ';
        }

        const sourceBadge = document.getElementById('edit-program-source-badge');
        if (sourceBadge) {
            sourceBadge.textContent = sourceLabel;
            // Kaynağa göre renk ayarı
            if (item.source === 'app_migration') {
                sourceBadge.style.backgroundColor = '#e3f2fd';
                sourceBadge.style.color = '#0d47a1';
            } else if (item.source === 'admin_manual') {
                sourceBadge.style.backgroundColor = '#e8f5e9';
                sourceBadge.style.color = '#1b5e20';
            } else if (item.source === 'approved_suggestion' || item.source === 'suggestion') {
                sourceBadge.style.backgroundColor = '#fff3e0';
                sourceBadge.style.color = '#e65100';
            } else {
                sourceBadge.style.backgroundColor = '#f5f5f5';
                sourceBadge.style.color = '#616161';
            }
        }

        // Tarih Bilgileri
        const createdAtDisplay = document.getElementById('edit-program-created-at-display');
        const updatedAtDisplay = document.getElementById('edit-program-updated-at-display');
        if (createdAtDisplay) {
            createdAtDisplay.textContent = `Oluşturulma Tarihi: ${item.created_at ? formatDate(item.created_at) : '-'}`;
        }
        if (updatedAtDisplay) {
            updatedAtDisplay.textContent = `Güncellenme Tarihi: ${item.updated_at ? formatDate(item.updated_at) : '-'}`;
        }

        // Form alanlarını doldur
        const nameInput = document.getElementById('edit-program-name-input');
        if (nameInput) nameInput.value = item.program_name || '';

        const venueInput = document.getElementById('edit-program-venue-name');
        if (venueInput) venueInput.value = item.venue_name || '';

        const cityInput = document.getElementById('edit-program-city');
        if (cityInput) cityInput.value = item.city || 'Sakarya';

        const districtInput = document.getElementById('edit-program-district');
        const editProgramDistrictWarning = document.getElementById('edit-program-district-warning');
        if (districtInput) {
            const currentDistrict = item.district ? item.district.trim() : '';
            const foundDistrict = SAKARYA_DISTRICTS.find(d => d.toLocaleLowerCase('tr-TR') === currentDistrict.toLocaleLowerCase('tr-TR'));
            if (foundDistrict) {
                districtInput.value = foundDistrict;
                if (editProgramDistrictWarning) editProgramDistrictWarning.classList.add('hidden');
            } else {
                districtInput.value = ''; // Reset to "İlçe Seçiniz"
                if (editProgramDistrictWarning) editProgramDistrictWarning.classList.remove('hidden');
            }
        }

        const dayInput = document.getElementById('edit-program-day');
        if (dayInput) dayInput.value = item.day || '';

        const timeInput = document.getElementById('edit-program-time');
        if (timeInput) timeInput.value = item.time || '';

        const teacherInput = document.getElementById('edit-program-teacher');
        if (teacherInput) teacherInput.value = item.teacher || '';

        const orgInput = document.getElementById('edit-program-organization');
        if (orgInput) orgInput.value = item.organization || '';

        const ladiesInput = document.getElementById('edit-program-ladies');
        if (ladiesInput) ladiesInput.value = item.women_friendly ? 'true' : 'false';

        // Yayın Durumu (status)
        const statusInput = document.getElementById('edit-program-status');
        if (statusInput) {
            const statusVal = (item.status || 'active').toLowerCase();
            if (statusVal === 'active' || statusVal === 'aktif') {
                statusInput.value = 'active';
            } else {
                statusInput.value = 'inactive';
            }
        }

        const photoInput = document.getElementById('edit-program-photo-url');
        if (photoInput) photoInput.value = item.photo_url || '';

        // Handle photo upload UI setup for edit modal
        const editPhotoFile = document.getElementById('edit-program-photo-file');
        if (editPhotoFile) editPhotoFile.value = '';
        const editFileName = document.getElementById('edit-program-photo-file-name');
        const editPreviewContainer = document.getElementById('edit-program-photo-preview-container');
        const editPreviewImg = document.getElementById('edit-program-photo-preview-img');
        const editProgress = document.getElementById('edit-upload-progress');
        if (editProgress) editProgress.classList.add('hidden');

        if (item.photo_url) {
            if (editFileName) editFileName.textContent = 'Mevcut fotoğraf';
            if (editPreviewImg) editPreviewImg.src = item.photo_url;
            if (editPreviewContainer) editPreviewContainer.classList.remove('hidden');
        } else {
            if (editFileName) editFileName.textContent = 'Seçilen dosya yok';
            if (editPreviewImg) editPreviewImg.src = '';
            if (editPreviewContainer) editPreviewContainer.classList.add('hidden');
        }

        const logoInput = document.getElementById('edit-program-logo-url');
        if (logoInput) logoInput.value = item.logo_url || '';

        // Auto-select helper organization dropdown
        const orgSelect = document.getElementById('edit-program-org-select');
        if (orgSelect) {
            orgSelect.value = ""; // default to none
            if (item.organization && activeOrganizations && activeOrganizations.length > 0) {
                const foundOrg = activeOrganizations.find(o => (o.name || '').toLowerCase() === item.organization.toLowerCase());
                if (foundOrg) {
                    orgSelect.value = foundOrg.id;
                }
            }
        }

        // Reset logo upload input
        const editLogoFile = document.getElementById('edit-program-logo-file');
        if (editLogoFile) editLogoFile.value = '';
        const editLogoProgress = document.getElementById('edit-logo-upload-progress');
        if (editLogoProgress) editLogoProgress.classList.add('hidden');

        updateLogoPreview(
            item.logo_url,
            'edit-program-logo-preview-container',
            'edit-program-logo-preview-img',
            'edit-program-logo-preview-text',
            'edit-program-logo-file-name'
        );

        const contactNameInput = document.getElementById('edit-program-contact-name');
        if (contactNameInput) contactNameInput.value = item.contact_name || '';

        const contactPhoneInput = document.getElementById('edit-program-contact-phone');
        if (contactPhoneInput) contactPhoneInput.value = item.contact_phone || '';

        const mapsInput = document.getElementById('edit-program-google-maps-link');
        if (mapsInput) mapsInput.value = item.google_maps_link || '';

        const addressInput = document.getElementById('edit-program-address');
        if (addressInput) addressInput.value = item.address || '';

        const descInput = document.getElementById('edit-program-description');
        if (descInput) descInput.value = item.description || '';

        // Modalı göster
        const modal = document.getElementById('edit-program-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = "hidden";
        }
    }

    function closeProgramEditModal(force = false) {
        if (!force && hasProgramChanges()) {
            const confirmExit = confirm("Kaydedilmemiş değişiklikler var. Çıkmak istiyor musunuz?");
            if (!confirmExit) return;
        }

        const modal = document.getElementById('edit-program-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = "";
        }
        currentEditProgram = null;
        initialProgramState = null;
    }

    function hasProgramChanges() {
        if (!initialProgramState) return false;

        const program_name = document.getElementById('edit-program-name-input')?.value.trim() || '';
        const venue_name = document.getElementById('edit-program-venue-name')?.value.trim() || '';
        const city = document.getElementById('edit-program-city')?.value.trim() || 'Sakarya';
        const district = document.getElementById('edit-program-district')?.value.trim() || '';
        const day = document.getElementById('edit-program-day')?.value.trim() || '';
        const time = document.getElementById('edit-program-time')?.value.trim() || '';
        const teacher = document.getElementById('edit-program-teacher')?.value.trim() || '';
        const organization = document.getElementById('edit-program-organization')?.value.trim() || '';
        const women_friendly = document.getElementById('edit-program-ladies')?.value === 'true';
        const status = document.getElementById('edit-program-status')?.value || 'active';
        const photo_url = document.getElementById('edit-program-photo-url')?.value.trim() || '';
        const logo_url = document.getElementById('edit-program-logo-url')?.value.trim() || '';
        const contact_name = document.getElementById('edit-program-contact-name')?.value.trim() || '';
        const contact_phone = document.getElementById('edit-program-contact-phone')?.value.trim() || '';
        const google_maps_link = document.getElementById('edit-program-google-maps-link')?.value.trim() || '';
        const address = document.getElementById('edit-program-address')?.value.trim() || '';
        const description = document.getElementById('edit-program-description')?.value.trim() || '';

        return (
            program_name !== (initialProgramState.program_name || '') ||
            venue_name !== (initialProgramState.venue_name || '') ||
            city !== (initialProgramState.city || 'Sakarya') ||
            district !== (initialProgramState.district || '') ||
            day !== (initialProgramState.day || '') ||
            time !== (initialProgramState.time || '') ||
            teacher !== (initialProgramState.teacher || '') ||
            organization !== (initialProgramState.organization || '') ||
            women_friendly !== (!!initialProgramState.women_friendly) ||
            (status === 'active' ? 'active' : 'inactive') !== ((initialProgramState.status || 'active').toLowerCase() === 'active' ? 'active' : 'inactive') ||
            photo_url !== (initialProgramState.photo_url || '') ||
            logo_url !== (initialProgramState.logo_url || '') ||
            contact_name !== (initialProgramState.contact_name || '') ||
            contact_phone !== (initialProgramState.contact_phone || '') ||
            google_maps_link !== (initialProgramState.google_maps_link || '') ||
            address !== (initialProgramState.address || '') ||
            description !== (initialProgramState.description || '')
        );
    }

    async function handleProgramEditSave() {
        if (!supabaseClient || !currentEditProgram) return;

        const program_name = document.getElementById('edit-program-name-input').value.trim();
        const venue_name = document.getElementById('edit-program-venue-name').value.trim();
        const city = document.getElementById('edit-program-city').value.trim() || 'Sakarya';
        const district = document.getElementById('edit-program-district').value.trim();
        const day = document.getElementById('edit-program-day').value.trim();
        const time = document.getElementById('edit-program-time').value.trim();

        // Basit form validasyonu
        if (!program_name) {
            showToast("Program adı zorunludur.", "error");
            return;
        }
        if (!venue_name) {
            showToast("Mekân adı zorunludur.", "error");
            return;
        }
        if (!city) {
            showToast("İl alanı zorunludur.", "error");
            return;
        }
        if (!district || !SAKARYA_DISTRICTS.includes(district)) {
            showToast("Lütfen geçerli bir ilçe seçiniz.", "error");
            return;
        }
        if (!day) {
            showToast("Gün zorunludur.", "error");
            return;
        }
        if (!time) {
            showToast("Saat zorunludur.", "error");
            return;
        }

        const teacher = document.getElementById('edit-program-teacher').value.trim();
        const organization = document.getElementById('edit-program-organization').value.trim();
        const women_friendly = document.getElementById('edit-program-ladies').value === 'true';
        const status = document.getElementById('edit-program-status').value;
        const photo_url = document.getElementById('edit-program-photo-url').value.trim();
        const logo_url = document.getElementById('edit-program-logo-url').value.trim();
        const contact_name = document.getElementById('edit-program-contact-name').value.trim();
        const contact_phone = document.getElementById('edit-program-contact-phone').value.trim();
        const google_maps_link = document.getElementById('edit-program-google-maps-link').value.trim();
        const address = document.getElementById('edit-program-address').value.trim();
        const description = document.getElementById('edit-program-description').value.trim();

        const saveBtn = document.getElementById('edit-program-btn-save');
        const cancelBtn = document.getElementById('edit-program-btn-cancel');

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.classList.add('disabled');
        }
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.classList.add('disabled');
        }

        const originalSaveHTML = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
        }

        try {
            // Güvenli payload oluşturulması
            const updatePayload = {
                program_name,
                venue_name,
                city,
                district,
                day,
                time,
                teacher,
                organization,
                women_friendly,
                status,
                photo_url,
                logo_url,
                contact_name,
                contact_phone,
                google_maps_link,
                address,
                description,
                updated_at: new Date().toISOString()
            };

            console.log("Updating program payload:", updatePayload);

            let attempt = 0;
            let success = false;
            let responseData = null;
            let responseError = null;

            while (attempt < 5) {
                console.log(`Program update attempt #${attempt + 1}, Payload:`, updatePayload);
                const { data, error } = await supabaseClient
                    .from('programs')
                    .update(updatePayload)
                    .eq('id', currentEditProgram.id)
                    .select();

                if (!error) {
                    responseData = data;
                    success = true;
                    break;
                }

                responseError = error;
                console.warn(`Program update attempt #${attempt + 1} failed:`, error);

                // Hata mesajını analiz edip bilinmeyen kolonları otomatik olarak kaldır
                const errMsg = (error.message || '').toLowerCase();
                let columnRemoved = false;

                const quoteMatches = errMsg.match(/['"`]([a-z0-9_]+)['"`]/g) || [];
                const extractedWords = quoteMatches.map(m => m.replace(/['"`]/g, ''));
                const allWords = errMsg.split(/[^a-z0-9_]/);
                const candidates = new Set([...extractedWords, ...allWords]);

                for (const key of Object.keys(updatePayload)) {
                    if (candidates.has(key.toLowerCase()) || errMsg.includes(key.toLowerCase())) {
                        console.log(`Detected offending column '${key}' in programs error message, removing from update payload.`);
                        delete updatePayload[key];
                        columnRemoved = true;
                    }
                }

                if (!columnRemoved) {
                    // Hiçbir kolon doğrudan eşleşmiyorsa sırayla opsiyonel alanları kaldır
                    const optionalKeys = ['logo_url', 'updated_at', 'photo_url', 'contact_name', 'contact_phone', 'google_maps_link', 'address', 'description', 'teacher', 'organization'];
                    for (const optKey of optionalKeys) {
                        if (optKey in updatePayload) {
                            console.log(`Removing optional column '${optKey}' from programs update as fallback.`);
                            delete updatePayload[optKey];
                            columnRemoved = true;
                            break;
                        }
                    }
                }

                if (!columnRemoved) {
                    break;
                }
                attempt++;
            }

            if (!success) {
                throw responseError;
            }

            showToast("Program başarıyla güncellendi.", "success");
            closeProgramEditModal(true); // Değişiklik onayını bypass et

            // Listeyi yenile
            await loadPrograms();

        } catch (error) {
            console.error('Program güncellenirken hata oluştu:', error);
            showToast("Program güncellenirken hata oluştu.", "error");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.classList.remove('disabled');
                saveBtn.innerHTML = originalSaveHTML;
            }
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.classList.remove('disabled');
            }
        }
    }

    // Modal Kapatma Dinleyicileri
    document.getElementById('edit-program-modal-close-top')?.addEventListener('click', () => closeProgramEditModal());
    document.getElementById('edit-program-btn-cancel')?.addEventListener('click', () => closeProgramEditModal());
    document.getElementById('edit-program-btn-save')?.addEventListener('click', () => handleProgramEditSave());

    document.getElementById('edit-program-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'edit-program-modal') {
            closeProgramEditModal();
        }
    });

    // Status Confirmation Modal Listeners (Paket H5)
    document.getElementById('status-confirm-close-top')?.addEventListener('click', closeStatusConfirmModal);
    document.getElementById('status-confirm-cancel-btn')?.addEventListener('click', closeStatusConfirmModal);
    document.getElementById('status-confirm-ok-btn')?.addEventListener('click', handleStatusConfirmOk);
    document.getElementById('status-confirm-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'status-confirm-modal') {
            closeStatusConfirmModal();
        }
    });

    // Delete Confirmation Modal Listeners (Paket H6)
    document.getElementById('delete-confirm-close-top')?.addEventListener('click', closeDeleteConfirmModal);
    document.getElementById('delete-confirm-cancel-btn')?.addEventListener('click', closeDeleteConfirmModal);
    document.getElementById('delete-confirm-ok-btn')?.addEventListener('click', handleDeleteProgram);
    document.getElementById('delete-confirm-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'delete-confirm-modal') {
            closeDeleteConfirmModal();
        }
    });

    function initViewSelector() {
        const viewBtns = document.querySelectorAll('.view-btn');
        viewBtns.forEach(btn => {
            const btnView = btn.getAttribute('data-view');
            if (btnView === currentViewMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            btn.addEventListener('click', () => {
                viewBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentViewMode = btnView;
                localStorage.setItem('cennetBahceleriProgramsViewMode', currentViewMode);
                applyFilters();
            });
        });
    }

    // Trash Bin Listeners (Paket H6.2)
    function initTrashBinListeners() {
        const trashBinBtn = document.getElementById('trash-bin-btn');
        const backToProgramsBtn = document.getElementById('back-to-programs-btn');
        const programsListTitle = document.getElementById('programs-list-title');
        const filterPanel = document.getElementById('programs-filter-panel');

        trashBinBtn?.addEventListener('click', async () => {
            isTrashBinView = true;
            trashBinBtn.classList.add('hidden');
            backToProgramsBtn?.classList.remove('hidden');
            if (programsListTitle) programsListTitle.textContent = "Çöp Kutusu";
            filterPanel?.classList.add('trash-view-active');
            
            // Clear search to prevent unexpected filtering on entering trash bin
            const searchInput = document.getElementById('filter-search');
            if (searchInput) searchInput.value = '';

            await loadPrograms();
        });

        backToProgramsBtn?.addEventListener('click', async () => {
            isTrashBinView = false;
            backToProgramsBtn.classList.add('hidden');
            trashBinBtn?.classList.remove('hidden');
            if (programsListTitle) programsListTitle.textContent = "Program Listesi";
            filterPanel?.classList.remove('trash-view-active');
            
            // Clear search to prevent unexpected filtering on returning to normal list
            const searchInput = document.getElementById('filter-search');
            if (searchInput) searchInput.value = '';

            await loadPrograms();
        });
    }

    async function uploadProgramPhoto(photoFile, progressElementId, fileNameElementId, previewImgElementId, previewContainerId, urlInputElementId) {
        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        const progressEl = document.getElementById(progressElementId);
        const fileNameEl = document.getElementById(fileNameElementId);
        const previewImgEl = document.getElementById(previewImgElementId);
        const previewContainerEl = document.getElementById(previewContainerId);
        const urlInputEl = document.getElementById(urlInputElementId);

        if (!photoFile) return;

        // Validation
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(photoFile.type)) {
            showToast("Geçersiz dosya tipi. Lütfen JPG, JPEG, PNG veya WEBP seçin.", "error");
            return;
        }

        const maxSize = 5 * 1024 * 1024; // 5 MB
        if (photoFile.size > maxSize) {
            showToast("Dosya boyutu 5 MB'dan küçük olmalıdır.", "error");
            return;
        }

        if (fileNameEl) {
            fileNameEl.textContent = photoFile.name;
        }

        if (progressEl) {
            progressEl.classList.remove('hidden');
        }

        try {
            const fileExt = photoFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
            const filePath = `programs/${fileName}`;

            console.log("Uploading program photo to storage:", filePath);

            // Try bucket "program-photos" first, fallback to "suggestion-photos" then "suggestions"
            let uploadResult = null;
            let finalBucket = 'program-photos';

            try {
                uploadResult = await supabaseClient.storage
                    .from('program-photos')
                    .upload(filePath, photoFile);
                
                if (uploadResult && uploadResult.error) {
                    console.log("Failed in program-photos bucket, trying 'suggestion-photos' bucket.", uploadResult.error);
                    finalBucket = 'suggestion-photos';
                    uploadResult = await supabaseClient.storage
                        .from('suggestion-photos')
                        .upload(filePath, photoFile);
                }

                if (uploadResult && uploadResult.error) {
                    console.log("Failed in suggestion-photos bucket, trying 'suggestions' bucket.", uploadResult.error);
                    finalBucket = 'suggestions';
                    uploadResult = await supabaseClient.storage
                        .from('suggestions')
                        .upload(filePath, photoFile);
                }
            } catch (uploadErr) {
                console.warn("Storage upload error during direct attempt:", uploadErr);
                // Try fallback suggestions buckets inside catch
                try {
                    finalBucket = 'suggestion-photos';
                    uploadResult = await supabaseClient.storage
                        .from('suggestion-photos')
                        .upload(filePath, photoFile);
                    
                    if (uploadResult && uploadResult.error) {
                        finalBucket = 'suggestions';
                        uploadResult = await supabaseClient.storage
                            .from('suggestions')
                            .upload(filePath, photoFile);
                    }
                } catch (fallbackErr) {
                    console.warn("Fallback upload error:", fallbackErr);
                }
            }

            if (uploadResult && !uploadResult.error) {
                // Try to resolve public URL
                try {
                    const { data: publicUrlData } = supabaseClient.storage
                        .from(finalBucket)
                        .getPublicUrl(filePath);
                    
                    const photoUrl = publicUrlData.publicUrl;
                    console.log("Resolved public photo URL:", photoUrl);

                    if (urlInputEl) {
                        urlInputEl.value = photoUrl;
                        // Fire change event to ensure any forms register the manual changes too
                        urlInputEl.dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    if (previewImgEl) {
                        previewImgEl.src = photoUrl;
                    }

                    if (previewContainerEl) {
                        previewContainerEl.classList.remove('hidden');
                    }

                    showToast("Fotoğraf başarıyla yüklendi.", "success");
                } catch (urlErr) {
                    console.warn("Could not get public URL:", urlErr);
                    showToast("Fotoğraf yüklendi fakat genel URL alınamadı.", "error");
                }
            } else {
                console.error("Photo upload failed:", uploadResult ? uploadResult.error : "No upload result");
                showToast("Fotoğraf yüklenirken hata oluştu.", "error");
                if (fileNameEl) {
                    fileNameEl.textContent = "Hata oluştu";
                }
            }
        } catch (err) {
            console.error("Photo upload try/catch error:", err);
            showToast("Fotoğraf yüklenirken beklenmeyen bir hata oluştu.", "error");
        } finally {
            if (progressEl) {
                progressEl.classList.add('hidden');
            }
        }
    }

    function initPhotoUploadListeners() {
        // --- Add Modal ---
        const addUploadTrigger = document.getElementById('add-photo-upload-trigger');
        const addPhotoFile = document.getElementById('add-photo-file');
        const addRemoveBtn = document.getElementById('add-photo-remove-btn');
        const addUrlInput = document.getElementById('add-photo-url');

        addUploadTrigger?.addEventListener('click', () => {
            addPhotoFile?.click();
        });

        addPhotoFile?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await uploadProgramPhoto(
                    file,
                    'add-upload-progress',
                    'add-photo-file-name',
                    'add-photo-preview-img',
                    'add-photo-preview-container',
                    'add-photo-url'
                );
            }
        });

        addRemoveBtn?.addEventListener('click', () => {
            if (addPhotoFile) addPhotoFile.value = '';
            const addFileName = document.getElementById('add-photo-file-name');
            if (addFileName) addFileName.textContent = 'Seçilen dosya yok';
            const addPreviewContainer = document.getElementById('add-photo-preview-container');
            if (addPreviewContainer) addPreviewContainer.classList.add('hidden');
            const addPreviewImg = document.getElementById('add-photo-preview-img');
            if (addPreviewImg) addPreviewImg.src = '';
            if (addUrlInput) addUrlInput.value = '';
        });

        // --- Edit Modal ---
        const editUploadTrigger = document.getElementById('edit-program-photo-upload-trigger');
        const editPhotoFile = document.getElementById('edit-program-photo-file');
        const editRemoveBtn = document.getElementById('edit-program-photo-remove-btn');
        const editUrlInput = document.getElementById('edit-program-photo-url');

        editUploadTrigger?.addEventListener('click', () => {
            editPhotoFile?.click();
        });

        editPhotoFile?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await uploadProgramPhoto(
                    file,
                    'edit-upload-progress',
                    'edit-program-photo-file-name',
                    'edit-program-photo-preview-img',
                    'edit-program-photo-preview-container',
                    'edit-program-photo-url'
                );
            }
        });

        editRemoveBtn?.addEventListener('click', () => {
            if (editPhotoFile) editPhotoFile.value = '';
            const editFileName = document.getElementById('edit-program-photo-file-name');
            if (editFileName) editFileName.textContent = 'Seçilen dosya yok';
            const editPreviewContainer = document.getElementById('edit-program-photo-preview-container');
            if (editPreviewContainer) editPreviewContainer.classList.add('hidden');
            const editPreviewImg = document.getElementById('edit-program-photo-preview-img');
            if (editPreviewImg) editPreviewImg.src = '';
            if (editUrlInput) editUrlInput.value = '';
        });
    }

    async function uploadProgramLogo(logoFile, progressElementId, fileNameElementId, previewImgElementId, previewTextElementId, previewContainerId, urlInputElementId) {
        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        const progressEl = document.getElementById(progressElementId);
        const fileNameEl = document.getElementById(fileNameElementId);
        const previewImgEl = document.getElementById(previewImgElementId);
        const previewTextEl = document.getElementById(previewTextElementId);
        const previewContainerEl = document.getElementById(previewContainerId);
        const urlInputEl = document.getElementById(urlInputElementId);

        if (!logoFile) return;

        // Validation: jpg, jpeg, png, webp
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(logoFile.type)) {
            showToast("Geçersiz dosya tipi. Lütfen JPG, JPEG, PNG veya WEBP seçin.", "error");
            return;
        }

        const maxSize = 2 * 1024 * 1024; // 2 MB
        if (logoFile.size > maxSize) {
            showToast("Logo boyutu 2 MB'dan küçük olmalıdır.", "error");
            return;
        }

        if (fileNameEl) {
            fileNameEl.textContent = logoFile.name;
        }

        if (progressEl) {
            progressEl.classList.remove('hidden');
        }

        try {
            const fileExt = logoFile.name.split('.').pop();
            const randomStr = Math.random().toString(36).substring(2, 7);
            const filePath = `logos/${Date.now()}_${randomStr}.${fileExt}`;

            console.log("Uploading logo to storage:", filePath);

            // Upload directly to "program-logos" bucket
            const { data, error } = await supabaseClient.storage
                .from('program-logos')
                .upload(filePath, logoFile);

            if (error) {
                throw error;
            }

            // Resolve public URL
            const { data: publicUrlData } = supabaseClient.storage
                .from('program-logos')
                .getPublicUrl(filePath);

            const logoUrl = publicUrlData.publicUrl;
            console.log("Resolved public logo URL:", logoUrl);

            if (urlInputEl) {
                urlInputEl.value = logoUrl;
                // Trigger change event
                urlInputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }

            updateLogoPreview(
                logoUrl,
                previewContainerId,
                previewImgElementId,
                previewTextElementId,
                fileNameElementId
            );

            showToast("Logo başarıyla yüklendi.", "success");
        } catch (err) {
            console.error("Logo upload error:", err);
            showToast("Logo yüklenirken hata oluştu.", "error");
            if (fileNameEl) {
                fileNameEl.textContent = "Hata oluştu";
            }
        } finally {
            if (progressEl) {
                progressEl.classList.add('hidden');
            }
        }
    }

    function updateLogoPreview(logoUrlValue, previewContainerId, previewImgId, previewTextId, fileNameId = null) {
        const previewContainer = document.getElementById(previewContainerId);
        const previewImg = document.getElementById(previewImgId);
        const previewText = document.getElementById(previewTextId);
        
        if (!previewContainer) return;

        const val = (logoUrlValue || '').trim();

        if (val) {
            previewContainer.classList.remove('hidden');
            // Check if it's a full URL (http:// or https:// or starts with /)
            const isFullUrl = val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/');
            if (isFullUrl) {
                if (previewImg) {
                    previewImg.src = val;
                    previewImg.classList.remove('hidden');
                    previewImg.style.display = 'block';
                }
                if (previewText) {
                    previewText.classList.add('hidden');
                    previewText.style.display = 'none';
                }
            } else {
                // Short code
                if (previewImg) {
                    previewImg.src = '';
                    previewImg.classList.add('hidden');
                    previewImg.style.display = 'none';
                }
                if (previewText) {
                    previewText.textContent = `Logo kodu: ${val}`;
                    previewText.classList.remove('hidden');
                    previewText.style.display = 'block';
                }
            }
        } else {
            previewContainer.classList.add('hidden');
            if (previewImg) {
                previewImg.src = '';
                previewImg.classList.add('hidden');
                previewImg.style.display = 'none';
            }
            if (previewText) {
                previewText.classList.add('hidden');
                previewText.style.display = 'none';
            }
            const fileNameEl = fileNameId ? document.getElementById(fileNameId) : null;
            if (fileNameEl) {
                fileNameEl.textContent = 'Seçilen dosya yok';
            }
        }
    }

    function initLogoUploadListeners() {
        // --- Add Modal ---
        const addLogoUploadTrigger = document.getElementById('add-program-logo-upload-trigger');
        const addLogoFile = document.getElementById('add-program-logo-file');
        const addLogoRemoveBtn = document.getElementById('add-program-logo-remove-btn');
        const addLogoUrlInput = document.getElementById('add-program-logo-url');

        addLogoUploadTrigger?.addEventListener('click', () => {
            addLogoFile?.click();
        });

        addLogoFile?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await uploadProgramLogo(
                    file,
                    'add-logo-upload-progress',
                    'add-program-logo-file-name',
                    'add-program-logo-preview-img',
                    'add-program-logo-preview-text',
                    'add-program-logo-preview-container',
                    'add-program-logo-url'
                );
            }
        });

        addLogoRemoveBtn?.addEventListener('click', () => {
            if (addLogoFile) addLogoFile.value = '';
            const addLogoFileName = document.getElementById('add-program-logo-file-name');
            if (addLogoFileName) addLogoFileName.textContent = 'Seçilen dosya yok';
            const addLogoPreviewContainer = document.getElementById('add-program-logo-preview-container');
            if (addLogoPreviewContainer) addLogoPreviewContainer.classList.add('hidden');
            const addLogoPreviewImg = document.getElementById('add-program-logo-preview-img');
            if (addLogoPreviewImg) {
                addLogoPreviewImg.src = '';
                addLogoPreviewImg.style.display = 'none';
            }
            const addLogoPreviewText = document.getElementById('add-program-logo-preview-text');
            if (addLogoPreviewText) {
                addLogoPreviewText.classList.add('hidden');
                addLogoPreviewText.style.display = 'none';
            }
            if (addLogoUrlInput) {
                addLogoUrlInput.value = '';
                addLogoUrlInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        addLogoUrlInput?.addEventListener('input', (e) => {
            updateLogoPreview(
                e.target.value,
                'add-program-logo-preview-container',
                'add-program-logo-preview-img',
                'add-program-logo-preview-text',
                'add-program-logo-file-name'
            );
        });

        // --- Edit Modal ---
        const editLogoUploadTrigger = document.getElementById('edit-program-logo-upload-trigger');
        const editLogoFile = document.getElementById('edit-program-logo-file');
        const editLogoRemoveBtn = document.getElementById('edit-program-logo-remove-btn');
        const editLogoUrlInput = document.getElementById('edit-program-logo-url');

        editLogoUploadTrigger?.addEventListener('click', () => {
            editLogoFile?.click();
        });

        editLogoFile?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await uploadProgramLogo(
                    file,
                    'edit-logo-upload-progress',
                    'edit-program-logo-file-name',
                    'edit-program-logo-preview-img',
                    'edit-program-logo-preview-text',
                    'edit-program-logo-preview-container',
                    'edit-program-logo-url'
                );
            }
        });

        editLogoRemoveBtn?.addEventListener('click', () => {
            if (editLogoFile) editLogoFile.value = '';
            const editLogoFileName = document.getElementById('edit-program-logo-file-name');
            if (editLogoFileName) editLogoFileName.textContent = 'Seçilen dosya yok';
            const editLogoPreviewContainer = document.getElementById('edit-program-logo-preview-container');
            if (editLogoPreviewContainer) editLogoPreviewContainer.classList.add('hidden');
            const editLogoPreviewImg = document.getElementById('edit-program-logo-preview-img');
            if (editLogoPreviewImg) {
                editLogoPreviewImg.src = '';
                editLogoPreviewImg.style.display = 'none';
            }
            const editLogoPreviewText = document.getElementById('edit-program-logo-preview-text');
            if (editLogoPreviewText) {
                editLogoPreviewText.classList.add('hidden');
                editLogoPreviewText.style.display = 'none';
            }
            if (editLogoUrlInput) {
                editLogoUrlInput.value = '';
                editLogoUrlInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        editLogoUrlInput?.addEventListener('input', (e) => {
            updateLogoPreview(
                e.target.value,
                'edit-program-logo-preview-container',
                'edit-program-logo-preview-img',
                'edit-program-logo-preview-text',
                'edit-program-logo-file-name'
            );
        });
    }

    async function loadOrganizations() {
        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        const addSelect = document.getElementById('add-org-select');
        const editSelect = document.getElementById('edit-program-org-select');

        try {
            // Set Loading state
            if (addSelect) addSelect.innerHTML = '<option value="">Yükleniyor...</option>';
            if (editSelect) editSelect.innerHTML = '<option value="">Yükleniyor...</option>';

            const { data, error } = await supabaseClient
                .from('organizations')
                .select('id, name, logo_url')
                .eq('status', 'active');

            if (error) throw error;

            activeOrganizations = data || [];
            // Türk alfabesine göre mükemmel alfabetik sıralama (Ç, Ğ, İ, Ö, Ş, Ü dahil)
            activeOrganizations.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));

            let optionsHtml = '<option value="">Çatı kurumu seçiniz</option>';
            if (activeOrganizations.length === 0) {
                optionsHtml = '<option value="">Kayıtlı aktif kayıt bulunamadı</option>';
            } else {
                activeOrganizations.forEach(org => {
                    optionsHtml += `<option value="${org.id}">${escapeHtml(org.name)}</option>`;
                });
            }

            if (addSelect) addSelect.innerHTML = optionsHtml;
            if (editSelect) editSelect.innerHTML = optionsHtml;

        } catch (err) {
            console.error("Kurumlar yüklenirken hata oluştu (organizations tablosu olmayabilir):", err);
            activeOrganizations = [];
            const errorOptionsHtml = '<option value="">Liste yüklenemedi</option>';
            if (addSelect) addSelect.innerHTML = errorOptionsHtml;
            if (editSelect) editSelect.innerHTML = errorOptionsHtml;
        }
    }

    function initOrganizationListeners() {
        const addSelect = document.getElementById('add-org-select');
        addSelect?.addEventListener('change', (e) => {
            const orgId = e.target.value;
            if (orgId) {
                const org = activeOrganizations.find(o => o.id === orgId);
                if (org) {
                    const orgInput = document.getElementById('add-organization');
                    if (orgInput) orgInput.value = org.name;
                    
                    const logoInput = document.getElementById('add-program-logo-url');
                    if (logoInput) {
                        logoInput.value = org.logo_url || '';
                        updateLogoPreview(
                            org.logo_url,
                            'add-program-logo-preview-container',
                            'add-program-logo-preview-img',
                            'add-program-logo-preview-text',
                            'add-program-logo-file-name'
                        );
                    }
                }
            }
        });

        const editSelect = document.getElementById('edit-program-org-select');
        editSelect?.addEventListener('change', (e) => {
            const orgId = e.target.value;
            if (orgId) {
                const org = activeOrganizations.find(o => o.id === orgId);
                if (org) {
                    const orgInput = document.getElementById('edit-program-organization');
                    if (orgInput) orgInput.value = org.name;
                    
                    const logoInput = document.getElementById('edit-program-logo-url');
                    if (logoInput) {
                        logoInput.value = org.logo_url || '';
                        updateLogoPreview(
                            org.logo_url,
                            'edit-program-logo-preview-container',
                            'edit-program-logo-preview-img',
                            'edit-program-logo-preview-text',
                            'edit-program-logo-file-name'
                        );
                    }
                }
            }
        });
    }

    function initDistrictWarningListeners() {
        const editDistrictSelect = document.getElementById('edit-district');
        const editDistrictWarning = document.getElementById('edit-district-warning');
        editDistrictSelect?.addEventListener('change', () => {
            if (editDistrictSelect.value && editDistrictWarning) {
                editDistrictWarning.classList.add('hidden');
            }
        });

        const editProgramDistrictSelect = document.getElementById('edit-program-district');
        const editProgramDistrictWarning = document.getElementById('edit-program-district-warning');
        editProgramDistrictSelect?.addEventListener('change', () => {
            if (editProgramDistrictSelect.value && editProgramDistrictWarning) {
                editProgramDistrictWarning.classList.add('hidden');
            }
        });
    }

    // ==========================================================
    // Kurumlar (Organizations) Yönetim Paneli Modülü (H9-D)
    // ==========================================================
    let loadedOrganizations = [];
    let detectedOrgColumns = [];

    // Türkçe Karakter Normalizasyonu ve Slug Oluşturucu
    function generateSlug(text) {
        if (!text) return '';
        let str = text.toLocaleLowerCase('tr-TR');
        str = str.replace(/-[ıi]/g, ''); // -ı, -i eklerini temizle
        
        const turkishMap = {
            'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u'
        };
        
        str = str.split('').map(char => turkishMap[char] || char).join('');
        str = str.replace(/[^a-z0-9]+/g, '_'); // Alfasayısal olmayanları alt çizgi yap
        str = str.replace(/^_+|_+$/g, '');     // Baştaki/sondaki alt çizgileri temizle
        return str;
    }

    // Kurumlar Sekmesi Durum Yönetim Yardımcıları
    function showOrgsLoader() {
        document.getElementById('organizations-loader')?.classList.remove('hidden');
        document.getElementById('organizations-error-container')?.classList.add('hidden');
        document.getElementById('organizations-empty-container')?.classList.add('hidden');
        document.getElementById('organizations-list')?.classList.add('hidden');
    }

    function showOrgsError() {
        document.getElementById('organizations-loader')?.classList.add('hidden');
        document.getElementById('organizations-error-container')?.classList.remove('hidden');
        document.getElementById('organizations-empty-container')?.classList.add('hidden');
        document.getElementById('organizations-list')?.classList.add('hidden');
    }

    function showOrgsEmpty() {
        document.getElementById('organizations-loader')?.classList.add('hidden');
        document.getElementById('organizations-error-container')?.classList.add('hidden');
        document.getElementById('organizations-empty-container')?.classList.remove('hidden');
        document.getElementById('organizations-list')?.classList.add('hidden');
    }

    function hideOrgsStates() {
        document.getElementById('organizations-loader')?.classList.add('hidden');
        document.getElementById('organizations-error-container')?.classList.add('hidden');
        document.getElementById('organizations-empty-container')?.classList.add('hidden');
        document.getElementById('organizations-list')?.classList.remove('hidden');
    }

    // Tüm Kurumları Yükle (Aktif + Pasif)
    async function loadAdminOrganizations() {
        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        showOrgsLoader();

        try {
            console.log("Loading all organizations from Supabase...");
            const { data, error } = await supabaseClient
                .from('organizations')
                .select('*');

            if (error) throw error;

            loadedOrganizations = data || [];
            if (loadedOrganizations.length > 0) {
                detectedOrgColumns = Object.keys(loadedOrganizations[0]);
                console.log("Detected organizations table columns:", detectedOrgColumns);
            }
            // Türkçe sıralama
            loadedOrganizations.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));

            renderOrgs(loadedOrganizations);

            // İstatistikleri Güncelle
            const activeOrgsCount = loadedOrganizations.filter(o => o.status === 'active').length;
            const passiveOrgsCount = loadedOrganizations.length - activeOrgsCount;

            const statsActive = document.getElementById('stats-active-orgs-val');
            const statsPassive = document.getElementById('stats-passive-orgs-val');
            if (statsActive) statsActive.textContent = activeOrgsCount;
            if (statsPassive) statsPassive.textContent = passiveOrgsCount;

        } catch (err) {
            console.error("Kurum listesi yüklenemedi:", err);
            showOrgsError();
        }
    }

    // Kurum Kartlarını Render Et
    function renderOrgs(orgs) {
        const list = document.getElementById('organizations-list');
        const count = document.getElementById('organizations-count');
        if (!list) return;

        list.innerHTML = '';
        if (count) count.textContent = orgs.length;

        if (orgs.length === 0) {
            showOrgsEmpty();
            return;
        }

        hideOrgsStates();

        orgs.forEach(org => {
            const card = document.createElement('div');
            card.className = 'suggestion-card org-card';
            if (org.status === 'inactive') {
                card.classList.add('org-card-inactive');
            }

            const statusText = org.status === 'active' ? 'Aktif' : 'Pasif';
            const statusClass = org.status === 'active' ? 'status-badge status-approved' : 'status-badge status-rejected';

            // Logo Önizleme veya Baş Harf Kutusu
            let logoHtml = '';
            const initials = (org.name || 'K').trim().substring(0, 2).toUpperCase();
            if (org.logo_url) {
                logoHtml = `
                    <div class="org-logo-wrapper">
                        <img src="${escapeHtml(org.logo_url)}" alt="${escapeHtml(org.name)} Logosu" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="org-logo-placeholder" style="display:none;">${escapeHtml(initials)}</div>
                    </div>
                `;
            } else {
                logoHtml = `
                    <div class="org-logo-wrapper">
                        <div class="org-logo-placeholder" style="display:flex;">${escapeHtml(initials)}</div>
                    </div>
                `;
            }

            // Sosyal ve Bağlantı İkonları
            let linksHtml = '';
            const websiteVal = org.website_url || org.website || '';
            const instagramVal = org.instagram_url || org.instagram || '';
            const youtubeVal = org.youtube_url || org.youtube || '';
            const whatsappVal = org.whatsapp_url || org.whatsapp || '';
            const googleMapsVal = org.google_maps || org.google_maps_url || org.maps_link || '';

            if (websiteVal) {
                linksHtml += `<a href="${escapeHtml(websiteVal)}" target="_blank" class="org-link-icon" title="Website"><i class="fa-solid fa-globe"></i></a>`;
            }
            if (instagramVal) {
                const igUrl = instagramVal.startsWith('http') ? instagramVal : `https://instagram.com/${instagramVal}`;
                linksHtml += `<a href="${escapeHtml(igUrl)}" target="_blank" class="org-link-icon" title="Instagram"><i class="fa-brands fa-instagram"></i></a>`;
            }
            if (youtubeVal) {
                const ytUrl = youtubeVal.startsWith('http') ? youtubeVal : `https://youtube.com/${youtubeVal}`;
                linksHtml += `<a href="${escapeHtml(ytUrl)}" target="_blank" class="org-link-icon" title="YouTube"><i class="fa-brands fa-youtube"></i></a>`;
            }
            if (whatsappVal) {
                const cleanWa = whatsappVal.replace(/\D/g, '');
                const waUrl = `https://wa.me/${cleanWa.startsWith('90') || cleanWa.length > 10 ? cleanWa : '90' + cleanWa}`;
                linksHtml += `<a href="${escapeHtml(waUrl)}" target="_blank" class="org-link-icon" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`;
            }
            if (googleMapsVal) {
                linksHtml += `<a href="${escapeHtml(googleMapsVal)}" target="_blank" class="org-link-icon" title="Google Maps"><i class="fa-solid fa-map-location-dot"></i></a>`;
            }

            const statusActionText = org.status === 'active' ? 'Pasife Al' : 'Aktif Et';
            const statusActionIcon = org.status === 'active' ? 'fa-eye-slash' : 'fa-eye';
            const statusActionClass = org.status === 'active' ? 'btn-status-toggle btn-secondary' : 'btn-status-toggle btn-primary';

            card.innerHTML = `
                <div class="card-header-info" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <span class="${statusClass}" style="font-size: 11px; padding: 2px 8px;">${escapeHtml(statusText)}</span>
                        <span class="category-badge" style="font-size: 11px; padding: 2px 8px; background-color: var(--md-secondary-container); color: var(--md-on-secondary-container); border-color: rgba(181, 141, 61, 0.2);">@${escapeHtml(org.slug || '')}</span>
                    </div>
                    <button class="btn-card-edit btn-org-edit" title="Kurumu Düzenle" style="background: transparent; border: none; color: var(--md-primary); cursor: pointer; font-size: 16px; padding: 4px;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                </div>
                
                <div class="org-card-main-content">
                    ${logoHtml}
                    <div class="org-card-text-area">
                        <h4 class="program-title" style="margin-bottom: 4px; font-size: 18px; font-weight: 700; color: var(--md-primary);">${escapeHtml(org.name || 'İsimsiz Kurum')}</h4>
                        <p style="font-size: 14px; line-height: 1.4; color: var(--md-on-surface-variant); max-height: 60px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                            ${escapeHtml(org.description || 'Açıklama belirtilmemiş.')}
                        </p>
                    </div>
                </div>
                
                <div class="org-card-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--md-outline); gap: 12px; width: 100%;">
                    <div class="org-links-wrapper" style="display: flex; gap: 10px; font-size: 18px;">
                        ${linksHtml || '<span style="font-size: 13px; color: var(--md-on-surface-variant);">Bağlantı yok</span>'}
                    </div>
                    <button class="btn btn-sm ${statusActionClass} btn-org-status-toggle" style="min-height: 36px; padding: 6px 12px; font-size: 13px;" data-id="${org.id}" data-status="${org.status}">
                        <i class="fa-solid ${statusActionIcon}"></i> ${statusActionText}
                    </button>
                </div>
            `;

            // Düzenle Butonu Dinleyicisi
            card.querySelector('.btn-org-edit').addEventListener('click', () => {
                openOrgModal(org);
            });

            // Pasife Al / Aktif Et Butonu Dinleyicisi
            card.querySelector('.btn-org-status-toggle').addEventListener('click', async () => {
                const newStatus = org.status === 'active' ? 'inactive' : 'active';
                await toggleOrgStatus(org.id, newStatus);
            });

            list.appendChild(card);
        });
    }

    // Kurum Ekleme / Düzenleme Modalı Aç
    function openOrgModal(org = null) {
        const modal = document.getElementById('org-modal');
        const title = document.getElementById('org-modal-title');
        const idInput = document.getElementById('org-modal-id');
        const nameInput = document.getElementById('org-modal-name-input');
        const slugInput = document.getElementById('org-modal-slug-input');
        const logoUrlInput = document.getElementById('org-modal-logo-url');
        const websiteInput = document.getElementById('org-modal-website');
        const instagramInput = document.getElementById('org-modal-instagram');
        const youtubeInput = document.getElementById('org-modal-youtube');
        const whatsappInput = document.getElementById('org-modal-whatsapp');
        const googleMapsInput = document.getElementById('org-modal-google-maps');
        const descriptionInput = document.getElementById('org-modal-description');
        const statusInput = document.getElementById('org-modal-status');

        // Reset logo inputs
        const fileInput = document.getElementById('org-modal-logo-file');
        if (fileInput) fileInput.value = '';
        const fileNameDisp = document.getElementById('org-modal-logo-file-name');
        if (fileNameDisp) fileNameDisp.textContent = 'Seçilen dosya yok';
        const progressContainer = document.getElementById('org-modal-logo-upload-progress');
        if (progressContainer) progressContainer.classList.add('hidden');

        if (org) {
            // DÜZENLEME MODU
            if (title) title.textContent = "Kurum / Cemaat / Oluşum Bilgilerini Düzenle";
            if (idInput) idInput.value = org.id || '';
            if (nameInput) nameInput.value = org.name || '';
            if (slugInput) slugInput.value = org.slug || '';
            if (logoUrlInput) logoUrlInput.value = org.logo_url || '';
            if (websiteInput) websiteInput.value = org.website_url || org.website || '';
            if (instagramInput) instagramInput.value = org.instagram_url || org.instagram || '';
            if (youtubeInput) youtubeInput.value = org.youtube_url || org.youtube || '';
            if (whatsappInput) whatsappInput.value = org.whatsapp_url || org.whatsapp || '';
            if (googleMapsInput) googleMapsInput.value = org.google_maps || org.google_maps_url || org.maps_link || '';
            if (descriptionInput) descriptionInput.value = org.description || '';
            if (statusInput) statusInput.value = org.status || 'active';

            updateLogoPreview(
                org.logo_url,
                'org-modal-logo-preview-container',
                'org-modal-logo-preview-img',
                'org-modal-logo-preview-text',
                'org-modal-logo-file-name'
            );
        } else {
            // EKLEME MODU
            if (title) title.textContent = "Yeni Kurum / Cemaat / Oluşum Ekle";
            if (idInput) idInput.value = '';
            if (nameInput) nameInput.value = '';
            if (slugInput) slugInput.value = '';
            if (logoUrlInput) logoUrlInput.value = '';
            if (websiteInput) websiteInput.value = '';
            if (instagramInput) instagramInput.value = '';
            if (youtubeInput) youtubeInput.value = '';
            if (whatsappInput) whatsappInput.value = '';
            if (googleMapsInput) googleMapsInput.value = '';
            if (descriptionInput) descriptionInput.value = '';
            if (statusInput) statusInput.value = 'active';

            updateLogoPreview(
                '',
                'org-modal-logo-preview-container',
                'org-modal-logo-preview-img',
                'org-modal-logo-preview-text',
                'org-modal-logo-file-name'
            );
        }

        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = "hidden";
        }

        // Bu kuruma bağlı programları yükle veya gizle (K-2A)
        const connectedSection = document.getElementById('org-connected-programs-section');
        if (connectedSection) {
            if (org && org.id) {
                connectedSection.classList.remove('hidden');
                loadOrgConnectedPrograms(org);
            } else {
                connectedSection.classList.add('hidden');
                const container = document.getElementById('org-programs-container');
                if (container) container.innerHTML = '';
            }
        }
    }

    // Kuruma bağlı programları yükle ve listele (K-2A)
    async function loadOrgConnectedPrograms(org) {
        const loader = document.getElementById('org-programs-loader');
        const container = document.getElementById('org-programs-container');
        if (!supabaseClient || !container || !org || !org.id) return;

        if (loader) loader.classList.remove('hidden');
        container.innerHTML = '';

        try {
            console.log(`Loading connected programs for organization ID: ${org.id}, Name: ${org.name}`);
            const { data, error } = await supabaseClient
                .from('programs')
                .select('*');

            if (error) throw error;

            if (loader) loader.classList.add('hidden');

            const cleanStr = (str) => {
                return (str || '')
                    .trim()
                    .toLowerCase()
                    .replace(/i̇/g, 'i') // Turkish dotted-i combo
                    .replace(/ı/g, 'i')
                    .replace(/ğ/g, 'g')
                    .replace(/ü/g, 'u')
                    .replace(/ş/g, 's')
                    .replace(/ö/g, 'o')
                    .replace(/ç/g, 'c');
            };

            const orgId = org.id;
            const orgName = (org.name || '').trim();
            const cleanedOrgName = cleanStr(orgName);

            const seenIds = new Set();
            const activePrograms = (data || []).filter(p => {
                // Sadece silinmemiş (deleted olmayan) programlar
                if (p.status === 'deleted') return false;
                if (seenIds.has(p.id)) return false;

                // 1. programs.organization_id = selectedOrganization.id ise eşleşsin
                if (p.organization_id && p.organization_id === orgId) {
                    seenIds.add(p.id);
                    return true;
                }

                // 2. programs.organization alanı selectedOrganization.name ile birebir eşleşiyorsa listele (fallback)
                const pOrg = (p.organization || '').trim();
                const cleanedPOrg = cleanStr(pOrg);

                if (cleanedPOrg && cleanedOrgName) {
                    if (cleanedPOrg === cleanedOrgName) {
                        seenIds.add(p.id);
                        return true;
                    }

                    // 3. Eğer selectedOrganization.name "Ümmetder" ise "Ümmetder" ile başlayan kayıtlar da gelsin.
                    if (cleanedOrgName === 'ummetder' && cleanedPOrg.startsWith('ummetder')) {
                        seenIds.add(p.id);
                        return true;
                    }

                    // 4. Eğer selectedOrganization.name "İsmailağa" ise "İsmailağa" ile başlayan kayıtlar da gelsin.
                    if (cleanedOrgName === 'ismailaga' && cleanedPOrg.startsWith('ismailaga')) {
                        seenIds.add(p.id);
                        return true;
                    }
                }

                return false;
            });

            if (activePrograms.length === 0) {
                container.innerHTML = `
                    <div class="org-programs-empty">
                        <i class="fa-solid fa-circle-info" style="color: var(--md-secondary); margin-right: 6px;"></i>
                        Bu kuruma bağlı aktif program bulunamadı.
                    </div>
                `;
                return;
            }

            // Render as cards (K-4 & K-5)
            let cardsHtml = '<div class="org-programs-grid">';
            activePrograms.forEach(p => {
                const statusBadge = getStatusBadge(p.status);
                const subeAdi = p.organization ? p.organization.trim() : '';
                const subeHtml = subeAdi ? `
                    <div class="org-program-sube">
                        <i class="fa-solid fa-house-chimney"></i> <span>Şube: ${escapeHtml(subeAdi)}</span>
                    </div>
                ` : '';
                
                cardsHtml += `
                    <div class="org-program-card">
                        <div class="org-program-card-header">
                            <span class="org-program-time-badge">
                                <i class="fa-regular fa-calendar-days"></i> ${escapeHtml(p.day || '-')} | <i class="fa-regular fa-clock"></i> ${escapeHtml(p.time || '-')}
                            </span>
                            <span class="${statusBadge.badgeClass}" style="font-size: 10px; padding: 2px 6px; font-weight: 600;">${escapeHtml(statusBadge.label)}</span>
                        </div>
                        <h4 class="org-program-card-title">${escapeHtml(p.program_name || 'İsimsiz Program')}</h4>
                        <div class="org-program-card-meta">
                            <div class="org-program-venue">
                                <i class="fa-solid fa-location-dot"></i> <strong>${escapeHtml(p.venue_name || '-')}</strong> (${escapeHtml(p.district || '-')})
                            </div>
                            ${subeHtml}
                        </div>
                    </div>
                `;
            });
            cardsHtml += '</div>';

            container.innerHTML = cardsHtml;
        } catch (err) {
            console.error("Kurum programları yüklenirken hata oluştu:", err);
            if (loader) loader.classList.add('hidden');
            container.innerHTML = `
                <div class="org-programs-empty" style="color: var(--md-error); border-color: var(--md-error);">
                    <i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i>
                    Programlar yüklenirken bir hata oluştu. Lütfen tekrar deneyin.
                </div>
            `;
        }
    }

    // Modalı Kapat
    function closeOrgModal() {
        const modal = document.getElementById('org-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = "";
        }
    }

    // Kurum Kaydet (Insert veya Update)
    async function handleOrgSave() {
        if (!supabaseClient) return;

        const id = document.getElementById('org-modal-id').value;
        const name = document.getElementById('org-modal-name-input').value.trim();
        const slug = document.getElementById('org-modal-slug-input').value.trim();
        const logo_url = document.getElementById('org-modal-logo-url').value.trim();
        const website = document.getElementById('org-modal-website').value.trim();
        const instagram = document.getElementById('org-modal-instagram').value.trim();
        const youtube = document.getElementById('org-modal-youtube').value.trim();
        const whatsapp = document.getElementById('org-modal-whatsapp').value.trim();
        const google_maps = document.getElementById('org-modal-google-maps').value.trim();
        const description = document.getElementById('org-modal-description').value.trim();
        const status = document.getElementById('org-modal-status').value;

        if (!name) {
            showToast("Kurum adı alanı zorunludur.", "error");
            return;
        }
        if (!slug) {
            showToast("Slug alanı zorunludur.", "error");
            return;
        }

        const saveBtn = document.getElementById('org-modal-btn-save');
        const cancelBtn = document.getElementById('org-modal-btn-cancel');

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
        }
        if (cancelBtn) cancelBtn.disabled = true;

        try {
            // Ensure we have detected organizations columns to avoid speculative columns failing
            if (!detectedOrgColumns || detectedOrgColumns.length === 0) {
                try {
                    const { data, error } = await supabaseClient
                        .from('organizations')
                        .select('*')
                        .limit(1);
                    if (!error && data && data.length > 0) {
                        detectedOrgColumns = Object.keys(data[0]);
                        console.log("Successfully auto-detected organization columns on save:", detectedOrgColumns);
                    }
                } catch (e) {
                    console.warn("Could not auto-detect organizations columns on save:", e);
                }
            }

            const orgPayload = {
                name,
                slug,
                description,
                status
            };

            // Baştan doğru mapping kullanalım ve sadece tablodaki gerçek kolonları gönderelim
            if (detectedOrgColumns.length > 0) {
                if (detectedOrgColumns.includes('logo_url')) orgPayload.logo_url = logo_url;
                if (detectedOrgColumns.includes('website_url')) orgPayload.website_url = website;
                if (detectedOrgColumns.includes('instagram_url')) orgPayload.instagram_url = instagram;
                if (detectedOrgColumns.includes('youtube_url')) orgPayload.youtube_url = youtube;
                if (detectedOrgColumns.includes('whatsapp_url')) orgPayload.whatsapp_url = whatsapp;

                // Google Maps alanı kontrolü ve birebir eşleme
                if (detectedOrgColumns.includes('google_maps')) {
                    orgPayload.google_maps = google_maps;
                } else if (detectedOrgColumns.includes('google_maps_url')) {
                    orgPayload.google_maps_url = google_maps;
                } else if (detectedOrgColumns.includes('maps_link')) {
                    orgPayload.maps_link = google_maps;
                }
            } else {
                // Eğer kolonlar tespit edilemediyse (tablo boşsa vb.), en olası doğru isimleri gönderelim
                orgPayload.logo_url = logo_url;
                orgPayload.website_url = website;
                orgPayload.instagram_url = instagram;
                orgPayload.youtube_url = youtube;
                orgPayload.whatsapp_url = whatsapp;
                orgPayload.google_maps = google_maps;
            }

            let success = false;
            let responseError = null;
            let attempt = 0;

            while (attempt < 5) {
                console.log(`Org save attempt #${attempt + 1}, Payload:`, orgPayload);
                
                let res;
                if (id) {
                    res = await supabaseClient
                        .from('organizations')
                        .update(orgPayload)
                        .eq('id', id)
                        .select();
                } else {
                    res = await supabaseClient
                        .from('organizations')
                        .insert(orgPayload)
                        .select();
                }

                if (!res.error) {
                    success = true;
                    break;
                }

                responseError = res.error;
                console.warn(`Org save attempt #${attempt + 1} failed:`, res.error);

                // Hata mesajından eksik kolonları ayıkla ve payload'u temizle
                const errMsg = (res.error.message || '').toLowerCase();
                let columnRemoved = false;

                const quoteMatches = errMsg.match(/['"`]([a-z0-9_]+)['"`]/g) || [];
                const extractedWords = quoteMatches.map(m => m.replace(/['"`]/g, ''));
                const allWords = errMsg.split(/[^a-z0-9_]/);
                const candidates = new Set([...extractedWords, ...allWords]);

                for (const key of Object.keys(orgPayload)) {
                    if (candidates.has(key.toLowerCase()) || errMsg.includes(key.toLowerCase())) {
                        console.log(`Offending column '${key}' detected for organizations table. Pruning.`);
                        delete orgPayload[key];
                        columnRemoved = true;
                    }
                }

                if (!columnRemoved) {
                    // Hiçbiri doğrudan eşleşmiyorsa opsiyonel sosyal ağları sırayla kaldır
                    const optionalKeys = [
                        'website_url', 'instagram_url', 'youtube_url', 'whatsapp_url',
                        'website', 'instagram', 'youtube', 'whatsapp',
                        'google_maps', 'google_maps_url', 'maps_link',
                        'description', 'logo_url', 'slug'
                    ];
                    for (const optKey of optionalKeys) {
                        if (optKey in orgPayload) {
                            console.log(`Fallback: Pruning optional column '${optKey}' from organizations.`);
                            delete orgPayload[optKey];
                            columnRemoved = true;
                            break;
                        }
                    }
                }

                if (!columnRemoved) {
                    break;
                }
                attempt++;
            }

            if (!success) throw responseError;

            showToast("Kurum başarıyla kaydedildi.", "success");
            closeOrgModal();

            // Yenile
            await loadAdminOrganizations();
            await loadOrganizations();

        } catch (err) {
            console.error("Kurum kaydedilemedi:", err);
            showToast("Kurum kaydedilirken bir hata oluştu: " + (err.message || ''), "error");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Kaydet';
            }
            if (cancelBtn) cancelBtn.disabled = false;
        }
    }

    // Durum Değişikliği (Aktif / Pasif)
    async function toggleOrgStatus(orgId, newStatus) {
        if (!supabaseClient) return;

        try {
            const { error } = await supabaseClient
                .from('organizations')
                .update({ status: newStatus })
                .eq('id', orgId);

            if (error) throw error;

            showToast(`Kurum başarıyla ${newStatus === 'active' ? 'aktifleştirildi' : 'pasifleştirildi'}.`, "success");

            // Listeleri ve dropdown'ları yenile
            await loadAdminOrganizations();
            await loadOrganizations();

        } catch (err) {
            console.error("Kurum durumu değiştirilemedi:", err);
            showToast("Kurum durumu değiştirilirken hata oluştu.", "error");
        }
    }

    // Kurumlar Dinleyicileri
    function initOrgListeners() {
        // Yeni Kurum Modalı Aç
        document.getElementById('add-organization-btn')?.addEventListener('click', () => {
            openOrgModal();
        });

        // Kurumları Yenile butonu
        document.getElementById('organizations-refresh-btn')?.addEventListener('click', async () => {
            await loadAdminOrganizations();
        });

        // Retry butonu
        document.getElementById('organizations-retry-btn')?.addEventListener('click', async () => {
            await loadAdminOrganizations();
        });

        // Modal kapatma butonları
        document.getElementById('org-modal-close-top')?.addEventListener('click', closeOrgModal);
        document.getElementById('org-modal-btn-cancel')?.addEventListener('click', closeOrgModal);
        document.getElementById('org-modal-btn-save')?.addEventListener('click', handleOrgSave);

        // Arka plana tıklayarak modalı kapatma
        document.getElementById('org-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'org-modal') {
                closeOrgModal();
            }
        });

        // Kurum Adı yazılırken otomatik slug oluştur
        const nameInput = document.getElementById('org-modal-name-input');
        const slugInput = document.getElementById('org-modal-slug-input');
        const idInput = document.getElementById('org-modal-id');

        nameInput?.addEventListener('input', () => {
            if (!idInput || !idInput.value) { // Sadece yeni kayıtlarda otomatik oluştur
                if (slugInput) {
                    slugInput.value = generateSlug(nameInput.value);
                }
            }
        });

        // Logo Dosya Yükleyici Ayarı
        const uploadTrigger = document.getElementById('org-modal-logo-upload-trigger');
        const fileInput = document.getElementById('org-modal-logo-file');
        const removeBtn = document.getElementById('org-modal-logo-remove-btn');
        const urlInput = document.getElementById('org-modal-logo-url');

        uploadTrigger?.addEventListener('click', () => {
            fileInput?.click();
        });

        fileInput?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await uploadProgramLogo(
                    file,
                    'org-modal-logo-upload-progress',
                    'org-modal-logo-file-name',
                    'org-modal-logo-preview-img',
                    'org-modal-logo-preview-text',
                    'org-modal-logo-preview-container',
                    'org-modal-logo-url'
                );
            }
        });

        removeBtn?.addEventListener('click', () => {
            if (fileInput) fileInput.value = '';
            const fileName = document.getElementById('org-modal-logo-file-name');
            if (fileName) fileName.textContent = 'Seçilen dosya yok';
            const previewContainer = document.getElementById('org-modal-logo-preview-container');
            if (previewContainer) previewContainer.classList.add('hidden');
            const previewImg = document.getElementById('org-modal-logo-preview-img');
            if (previewImg) {
                previewImg.src = '';
                previewImg.style.display = 'none';
            }
            const previewText = document.getElementById('org-modal-logo-preview-text');
            if (previewText) {
                previewText.classList.add('hidden');
                previewText.style.display = 'none';
            }
            if (urlInput) {
                urlInput.value = '';
                urlInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        urlInput?.addEventListener('input', (e) => {
            updateLogoPreview(
                e.target.value,
                'org-modal-logo-preview-container',
                'org-modal-logo-preview-img',
                'org-modal-logo-preview-text',
                'org-modal-logo-file-name'
            );
        });
    }

    // ==========================================================
    // CAMII KONUM YÖNETİMİ İŞLEVLERİ (Faz 2 - H-M1)
    // ==========================================================
    let mosquesListCache = [];

    function extractLatLngFromGoogleMapsLink(link) {
        if (!link) return null;
        
        // Check for short goo.gl link and warn user
        if (link.includes("maps.app.goo.gl") || link.includes("goo.gl/maps")) {
            return { isShort: true };
        }
        
        // Pattern 1: @40.8021,30.7456,17z or similar
        const patternAt = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const matchAt = link.match(patternAt);
        if (matchAt && matchAt.length >= 3) {
            return {
                latitude: parseFloat(matchAt[1]),
                longitude: parseFloat(matchAt[2])
            };
        }
        
        // Pattern 2: !3d40.8021!4d30.7456 or similar
        const patternExcl = /!3d(-?\d+\.\d+).*!4d(-?\d+\.\d+)/;
        const matchExcl = link.match(patternExcl);
        if (matchExcl && matchExcl.length >= 3) {
            return {
                latitude: parseFloat(matchExcl[1]),
                longitude: parseFloat(matchExcl[2])
            };
        }
        
        // Pattern 3: standard query param q=lat,lng or sll=lat,lng or ll=lat,lng
        const patternQuery = /[?&](?:q|ll|sll)=(-?\d+\.\d+),(-?\d+\.\d+)/;
        const matchQuery = link.match(patternQuery);
        if (matchQuery && matchQuery.length >= 3) {
            return {
                latitude: parseFloat(matchQuery[1]),
                longitude: parseFloat(matchQuery[2])
            };
        }
        
        return null;
    }

    async function loadMosques() {
        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        showMosquesLoader();

        try {
            const { data, error } = await supabaseClient
                .from('mosque_locations')
                .select('*')
                .order('mosque_name', { ascending: true });

            if (error) throw error;

            mosquesListCache = data || [];
            updateMosqueStats(mosquesListCache);
            applyMosqueFilters();

        } catch (error) {
            console.error("Cami konumları yüklenirken hata:", error);
            showMosquesError();

            const errMsg = (error.message || '').toLowerCase();
            const isTableMissing = errMsg.includes('relation "public.mosque_locations" does not exist') || errMsg.includes('does not exist');

            const errorMessage = document.getElementById('mosques-error-message');
            const sqlSuggestion = document.getElementById('mosques-sql-suggestion');

            if (isTableMissing) {
                if (errorMessage) errorMessage.innerHTML = `<code>mosque_locations</code> tablosu veritabanınızda bulunamadı.<br>Lütfen aşağıdaki SQL'i Supabase SQL Editor üzerinde çalıştırıp tekrar deneyin:`;
                if (sqlSuggestion) {
                    sqlSuggestion.innerHTML = `CREATE TABLE IF NOT EXISTS public.mosque_locations (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    mosque_name text NOT NULL,
    city text NOT NULL DEFAULT 'Sakarya',
    district text NOT NULL,
    neighborhood text,
    address text,
    google_maps_link text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Etkinleştirme
ALTER TABLE public.mosque_locations ENABLE ROW LEVEL SECURITY;

-- Politikalar (Policies)
CREATE POLICY "Public Read Access" ON public.mosque_locations FOR SELECT USING (true);
CREATE POLICY "Public Write Access" ON public.mosque_locations FOR ALL USING (true);`;
                    sqlSuggestion.classList.remove('hidden');
                }
            } else {
                if (errorMessage) errorMessage.textContent = "Bağlantı hatası veya yetki yetersizliği. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.";
                if (sqlSuggestion) sqlSuggestion.classList.add('hidden');
            }
        }
    }

    function updateMosqueStats(mosques) {
        const totalCount = mosques.length;
        const activeCount = mosques.filter(m => m.status === 'active').length;
        const passiveCount = mosques.filter(m => m.status === 'inactive').length;

        const totalVal = document.getElementById('stats-total-mosques-val');
        const activeVal = document.getElementById('stats-active-mosques-val');
        const passiveVal = document.getElementById('stats-passive-mosques-val');

        if (totalVal) totalVal.textContent = totalCount;
        if (activeVal) activeVal.textContent = activeCount;
        if (passiveVal) passiveVal.textContent = passiveCount;
    }

    function isMosqueUnnamed(m) {
        if (!m.mosque_name) return true;
        const lowerName = m.mosque_name.toLocaleLowerCase('tr-TR');
        return lowerName.includes('isimsiz') || lowerName.includes('adsiz');
    }

    function getVerificationStatus(m) {
        if (m.verification_status) {
            return m.verification_status;
        }
        return isMosqueUnnamed(m) ? 'unverified' : 'verified';
    }

    function applyMosqueFilters() {
        const searchVal = (document.getElementById('mosques-filter-search')?.value || '').trim().toLocaleLowerCase('tr-TR');
        const districtVal = document.getElementById('mosques-filter-district')?.value || '';
        const statusVal = document.getElementById('mosques-filter-status')?.value || '';
        const verificationVal = document.getElementById('mosques-filter-verification')?.value || '';
        const unnamedVal = document.getElementById('mosques-filter-unnamed')?.value || 'hide';
        const sortVal = document.getElementById('mosques-filter-sort')?.value || 'az';

        let filtered = [...mosquesListCache];

        // 1. District filter
        if (districtVal) {
            filtered = filtered.filter(m => (m.district || '').toLocaleLowerCase('tr-TR') === districtVal.toLocaleLowerCase('tr-TR'));
        }

        // 2. Status filter
        if (statusVal) {
            filtered = filtered.filter(m => m.status === statusVal);
        }

        // 3. Verification filter
        if (verificationVal) {
            filtered = filtered.filter(m => getVerificationStatus(m) === verificationVal);
        }

        // 4. Unnamed filter
        if (unnamedVal === 'hide') {
            filtered = filtered.filter(m => !isMosqueUnnamed(m));
        }

        // 5. Search query filter
        if (searchVal) {
            filtered = filtered.filter(m => {
                const name = (m.mosque_name || '').toLocaleLowerCase('tr-TR');
                const dist = (m.district || '').toLocaleLowerCase('tr-TR');
                const neigh = (m.neighborhood || '').toLocaleLowerCase('tr-TR');
                const addr = (m.address || '').toLocaleLowerCase('tr-TR');
                return name.includes(searchVal) || dist.includes(searchVal) || neigh.includes(searchVal) || addr.includes(searchVal);
            });
        }

        // 4. Sorting
        if (sortVal === 'az') {
            filtered.sort((a, b) => (a.mosque_name || '').localeCompare(b.mosque_name || '', 'tr'));
        } else if (sortVal === 'za') {
            filtered.sort((a, b) => (b.mosque_name || '').localeCompare(a.mosque_name || '', 'tr'));
        } else if (sortVal === 'district') {
            filtered.sort((a, b) => {
                const distCompare = (a.district || '').localeCompare(b.district || '', 'tr');
                if (distCompare !== 0) return distCompare;
                return (a.mosque_name || '').localeCompare(b.mosque_name || '', 'tr');
            });
        } else if (sortVal === 'newest') {
            filtered.sort((a, b) => {
                const idA = a.id || 0;
                const idB = b.id || 0;
                // If created_at is available, use it, otherwise fall back to id comparison
                if (a.created_at && b.created_at) {
                    return new Date(b.created_at) - new Date(a.created_at);
                }
                return idB - idA;
            });
        } else if (sortVal === 'oldest') {
            filtered.sort((a, b) => {
                const idA = a.id || 0;
                const idB = b.id || 0;
                if (a.created_at && b.created_at) {
                    return new Date(a.created_at) - new Date(b.created_at);
                }
                return idA - idB;
            });
        }

        renderMosques(filtered);
    }

    function renderMosques(mosques) {
        const list = document.getElementById('mosques-list');
        const countText = document.getElementById('mosques-count-text');
        const count = document.getElementById('mosques-count');
        if (!list) return;

        list.innerHTML = '';
        if (count) count.textContent = mosques.length;
        if (countText) {
            countText.textContent = `${mosquesListCache.length} cami içinden ${mosques.length} kayıt gösteriliyor.`;
        }

        if (mosques.length === 0) {
            showMosquesEmpty();
            return;
        }

        hideMosquesStates();

        mosques.forEach(m => {
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            if (m.status === 'inactive') {
                card.classList.add('org-card-inactive');
            }

            const isUnnamed = isMosqueUnnamed(m);
            const verificationStatus = getVerificationStatus(m);
            const isVerified = verificationStatus === 'verified';

            const verificationText = isVerified ? 'Doğrulandı' : 'Doğrulanmadı';
            const verificationClass = isVerified ? 'status-badge status-approved' : 'status-badge status-pending';

            const statusText = m.status === 'active' ? 'Aktif' : 'Pasif';
            const statusClass = m.status === 'active' ? 'status-badge status-approved' : 'status-badge status-rejected';

            const statusActionText = m.status === 'active' ? 'Pasife Al' : 'Aktif Et';
            const statusActionIcon = m.status === 'active' ? 'fa-eye-slash' : 'fa-eye';
            const statusActionClass = m.status === 'active' ? 'btn-status-toggle btn-secondary' : 'btn-status-toggle btn-primary';

            let mapsLinkBtn = '';
            if (m.google_maps_link) {
                mapsLinkBtn = `<a href="${escapeHtml(m.google_maps_link)}" target="_blank" class="org-link-icon" style="color: var(--md-secondary); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" title="Google Maps"><i class="fa-solid fa-map-location-dot"></i> Haritada Aç</a>`;
            } else {
                mapsLinkBtn = `<a href="https://www.google.com/maps/search/?api=1&query=${m.latitude},${m.longitude}" target="_blank" class="org-link-icon" style="color: var(--md-secondary); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" title="Google Maps"><i class="fa-solid fa-map-location-dot"></i> Haritada Aç</a>`;
            }

            card.innerHTML = `
                <div class="card-header-info" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                        <span class="${statusClass}" style="font-size: 11px; padding: 2px 8px;">${escapeHtml(statusText)}</span>
                        <span class="category-badge" style="font-size: 11px; padding: 2px 8px; background-color: var(--md-secondary-container); color: var(--md-on-secondary-container); border-color: rgba(181, 141, 61, 0.2);">${escapeHtml(m.district || '')}</span>
                        <span class="${verificationClass}" style="font-size: 11px; padding: 2px 8px;"><i class="fa-solid ${isVerified ? 'fa-circle-check' : 'fa-circle-question'}"></i> ${verificationText}</span>
                        ${isUnnamed ? '<span class="status-badge status-rejected" style="font-size: 11px; padding: 2px 8px;"><i class="fa-solid fa-eye-slash"></i> İsimsiz</span>' : ''}
                    </div>
                    <button class="btn-card-edit btn-mosque-edit" title="Camiyi Düzenle" style="background: transparent; border: none; color: var(--md-primary); cursor: pointer; font-size: 16px; padding: 4px;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                </div>
                
                <div class="org-card-main-content" style="display: flex; gap: 16px; margin-top: 12px; align-items: flex-start;">
                    <div class="org-logo-wrapper" style="width: 56px; height: 56px; border-radius: var(--radius-md); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background-color: var(--md-primary-container); color: var(--md-primary);">
                        <i class="fa-solid fa-mosque" style="font-size: 24px;"></i>
                    </div>
                    <div class="org-card-text-area" style="flex: 1;">
                        <h4 class="program-title" style="margin-bottom: 4px; font-size: 18px; font-weight: 700; color: var(--md-primary); line-height: 1.3;">${escapeHtml(m.mosque_name || 'İsimsiz Camii')}</h4>
                        <p style="font-size: 13px; font-weight: 500; color: var(--md-on-surface-variant); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                            <i class="fa-solid fa-location-dot"></i> ${escapeHtml(m.city || 'Sakarya')} / ${escapeHtml(m.district || '')} ${m.neighborhood ? ' - ' + escapeHtml(m.neighborhood) : ''}
                        </p>
                        <p style="font-size: 12px; font-family: monospace; color: var(--md-on-surface-variant);">
                            Koord: ${m.latitude}, ${m.longitude}
                        </p>
                        <p style="font-size: 14px; line-height: 1.4; color: var(--md-on-surface-variant); margin-top: 6px; max-height: 40px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                            ${escapeHtml(m.address || 'Adres belirtilmemiş.')}
                        </p>
                    </div>
                </div>
                
                <div class="org-card-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--md-outline); gap: 12px; width: 100%; flex-wrap: wrap;">
                    <div class="org-links-wrapper" style="display: flex; gap: 10px; font-size: 14px; align-items: center;">
                        ${mapsLinkBtn}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm ${isVerified ? 'btn-secondary' : 'btn-primary'} btn-mosque-verify-toggle" style="min-height: 36px; padding: 6px 12px; font-size: 13px;" data-id="${m.id}">
                            <i class="fa-solid ${isVerified ? 'fa-circle-xmark' : 'fa-circle-check'}"></i> ${isVerified ? 'Doğrulamayı Kaldır' : 'Doğrula'}
                        </button>
                        <button class="btn btn-sm ${statusActionClass} btn-mosque-status-toggle" style="min-height: 36px; padding: 6px 12px; font-size: 13px;" data-id="${m.id}">
                            <i class="fa-solid ${statusActionIcon}"></i> ${statusActionText}
                        </button>
                    </div>
                </div>
            `;

            // Edit button handler
            card.querySelector('.btn-mosque-edit').addEventListener('click', () => {
                openEditMosqueModal(m);
            });

            // Verify toggle button handler
            card.querySelector('.btn-mosque-verify-toggle').addEventListener('click', async () => {
                const newVerification = isVerified ? 'unverified' : 'verified';
                await toggleMosqueVerification(m.id, newVerification);
            });

            // Status toggle button handler
            card.querySelector('.btn-mosque-status-toggle').addEventListener('click', async () => {
                const newStatus = m.status === 'active' ? 'inactive' : 'active';
                await toggleMosqueStatus(m.id, newStatus);
            });

            list.appendChild(card);
        });
    }

    function showMosquesLoader() {
        document.getElementById('mosques-loader')?.classList.remove('hidden');
        document.getElementById('mosques-error-container')?.classList.add('hidden');
        document.getElementById('mosques-empty-container')?.classList.add('hidden');
        document.getElementById('mosques-list')?.classList.add('hidden');
    }

    function showMosquesError() {
        document.getElementById('mosques-loader')?.classList.add('hidden');
        document.getElementById('mosques-error-container')?.classList.remove('hidden');
        document.getElementById('mosques-empty-container')?.classList.add('hidden');
        document.getElementById('mosques-list')?.classList.add('hidden');
    }

    function showMosquesEmpty() {
        document.getElementById('mosques-loader')?.classList.add('hidden');
        document.getElementById('mosques-error-container')?.classList.add('hidden');
        document.getElementById('mosques-empty-container')?.classList.remove('hidden');
        document.getElementById('mosques-list')?.classList.add('hidden');
    }

    function hideMosquesStates() {
        document.getElementById('mosques-loader')?.classList.add('hidden');
        document.getElementById('mosques-error-container')?.classList.add('hidden');
        document.getElementById('mosques-empty-container')?.classList.add('hidden');
        document.getElementById('mosques-list')?.classList.remove('hidden');
    }

    function openAddMosqueModal() {
        document.getElementById('mosque-modal-title').textContent = "Yeni Camii Konumu Ekle";
        document.getElementById('mosque-modal-id').value = '';
        document.getElementById('mosque-modal-name-input').value = '';
        document.getElementById('mosque-modal-district-input').value = '';
        document.getElementById('mosque-modal-neighborhood-input').value = '';
        document.getElementById('mosque-modal-google-maps-input').value = '';
        document.getElementById('mosque-modal-latitude-input').value = '';
        document.getElementById('mosque-modal-longitude-input').value = '';
        document.getElementById('mosque-modal-address-input').value = '';
        document.getElementById('mosque-modal-status-input').value = 'active';
        document.getElementById('mosque-modal-link-warning').classList.add('hidden');
        
        document.getElementById('mosque-modal').classList.remove('hidden');
        document.body.style.overflow = "hidden";
    }

    function openEditMosqueModal(m) {
        document.getElementById('mosque-modal-title').textContent = "Camii Konumunu Düzenle";
        document.getElementById('mosque-modal-id').value = m.id;
        document.getElementById('mosque-modal-name-input').value = m.mosque_name || '';
        document.getElementById('mosque-modal-district-input').value = m.district || '';
        document.getElementById('mosque-modal-neighborhood-input').value = m.neighborhood || '';
        document.getElementById('mosque-modal-google-maps-input').value = m.google_maps_link || '';
        document.getElementById('mosque-modal-latitude-input').value = m.latitude || '';
        document.getElementById('mosque-modal-longitude-input').value = m.longitude || '';
        document.getElementById('mosque-modal-address-input').value = m.address || '';
        document.getElementById('mosque-modal-status-input').value = m.status || 'active';
        document.getElementById('mosque-modal-link-warning').classList.add('hidden');
        
        document.getElementById('mosque-modal').classList.remove('hidden');
        document.body.style.overflow = "hidden";
    }

    function closeMosqueModal() {
        document.getElementById('mosque-modal').classList.add('hidden');
        document.body.style.overflow = "";
    }

    async function saveMosque() {
        if (!supabaseClient) return;

        const saveBtn = document.getElementById('mosque-modal-btn-save');
        const cancelBtn = document.getElementById('mosque-modal-btn-cancel');

        const id = document.getElementById('mosque-modal-id').value;
        const mosque_name = document.getElementById('mosque-modal-name-input').value.trim();
        const city = document.getElementById('mosque-modal-city-input').value.trim();
        const district = document.getElementById('mosque-modal-district-input').value;
        const neighborhood = document.getElementById('mosque-modal-neighborhood-input').value.trim();
        const google_maps_link = document.getElementById('mosque-modal-google-maps-input').value.trim();
        const latitudeStr = document.getElementById('mosque-modal-latitude-input').value.trim();
        const longitudeStr = document.getElementById('mosque-modal-longitude-input').value.trim();
        const address = document.getElementById('mosque-modal-address-input').value.trim();
        const status = document.getElementById('mosque-modal-status-input').value;

        if (!mosque_name || !district || !latitudeStr || !longitudeStr) {
            showToast("Lütfen zorunlu alanları (*) doldurun.", "error");
            return;
        }

        const latitude = parseFloat(latitudeStr);
        const longitude = parseFloat(longitudeStr);

        if (isNaN(latitude) || isNaN(longitude)) {
            showToast("Lütfen geçerli enlem ve boylam koordinatları girin.", "error");
            return;
        }

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.classList.add('disabled');
        }
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.classList.add('disabled');
        }

        const originalSaveHTML = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
        }

        try {
            const payload = {
                mosque_name,
                city,
                district,
                neighborhood,
                address,
                google_maps_link,
                latitude,
                longitude,
                status,
                updated_at: new Date().toISOString()
            };

            if (!id) {
                // INSERT
                payload.source = 'manual';
                payload.verification_status = 'verified';
                payload.verified_at = new Date().toISOString();
                payload.verified_by = 'admin';
                payload.created_at = new Date().toISOString();
                const { error } = await supabaseClient
                    .from('mosque_locations')
                    .insert(payload);

                if (error) throw error;
                showToast("Camii konumu kaydedildi.", "success");
            } else {
                // UPDATE
                payload.verification_status = 'verified';
                payload.verified_at = new Date().toISOString();
                payload.verified_by = 'admin';
                const { error } = await supabaseClient
                    .from('mosque_locations')
                    .update(payload)
                    .eq('id', id);

                if (error) throw error;
                showToast("Camii konumu kaydedildi.", "success");
            }

            closeMosqueModal();
            await loadMosques();

        } catch (error) {
            console.error("Cami konumu kaydedilemedi:", error);
            showToast("Camii konumu kaydedilemedi.", "error");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.classList.remove('disabled');
                saveBtn.innerHTML = originalSaveHTML;
            }
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.classList.remove('disabled');
            }
        }
    }

    async function toggleMosqueStatus(id, newStatus) {
        if (!supabaseClient) return;

        try {
            const { error } = await supabaseClient
                .from('mosque_locations')
                .update({
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;

            showToast("Camii konumu kaydedildi.", "success");
            await loadMosques();
        } catch (error) {
            console.error("Cami durumu değiştirilirken hata oluştu:", error);
            showToast("Camii konumu kaydedilemedi.", "error");
        }
    }

    async function toggleMosqueVerification(id, newVerification) {
        if (!supabaseClient) return;

        try {
            const isVerifying = newVerification === 'verified';
            const payload = {
                verification_status: newVerification,
                verified_at: isVerifying ? new Date().toISOString() : null,
                verified_by: isVerifying ? 'admin' : null,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from('mosque_locations')
                .update(payload)
                .eq('id', id);

            if (error) throw error;

            showToast("Camii doğrulama durumu güncellendi.", "success");
            await loadMosques();
        } catch (error) {
            console.error("Cami doğrulama durumu değiştirilirken hata oluştu:", error);
            showToast("Camii doğrulama durumu değiştirilemedi.", "error");
        }
    }

    // ==========================================================
    // OSM TOPLU CAMİ GETİRME İŞLEVLERİ (Faz 2 - H-M2-A)
    // ==========================================================
    let osmResults = [];

    function trNormalize(str) {
        if (!str) return '';
        return str
            .toLocaleLowerCase('tr-TR')
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }

    function isCloseLocation(lat1, lon1, lat2, lon2, threshold = 0.0005) {
        return Math.abs(lat1 - lat2) < threshold && Math.abs(lon1 - lon2) < threshold;
    }

    function openOsmModal() {
        document.getElementById('osm-preview-section')?.classList.add('hidden');
        document.getElementById('osm-empty')?.classList.add('hidden');
        document.getElementById('osm-loader')?.classList.add('hidden');
        document.getElementById('osm-modal-btn-save')?.classList.add('hidden');
        if (document.getElementById('osm-selection-summary')) {
            document.getElementById('osm-selection-summary').textContent = '';
        }
        osmResults = [];
        
        document.getElementById('osm-modal').classList.remove('hidden');
        document.body.style.overflow = "hidden";
    }

    function closeOsmModal() {
        document.getElementById('osm-modal').classList.add('hidden');
        document.body.style.overflow = "";
    }

    async function fetchOsmMosques() {
        const district = document.getElementById('osm-modal-district-input')?.value;
        const fetchBtn = document.getElementById('osm-fetch-btn');
        
        if (!district) {
            showToast("Lütfen bir ilçe seçin.", "error");
            return;
        }

        // Show loader and hide content areas
        document.getElementById('osm-loader')?.classList.remove('hidden');
        document.getElementById('osm-preview-section')?.classList.add('hidden');
        document.getElementById('osm-empty')?.classList.add('hidden');
        document.getElementById('osm-modal-btn-save')?.classList.add('hidden');
        if (document.getElementById('osm-selection-summary')) {
            document.getElementById('osm-selection-summary').textContent = '';
        }

        if (fetchBtn) {
            fetchBtn.disabled = true;
            fetchBtn.classList.add('disabled');
            fetchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aranıyor...';
        }

        osmResults = [];

        // Primary: Nested area query
        const query = `[out:json][timeout:30];
area["name"="Sakarya"]->.prov;
area["name"="${district}"](area.prov)->.dist;
(
  node["amenity"="place_of_worship"]["religion"="muslim"](area.dist);
  way["amenity"="place_of_worship"]["religion"="muslim"](area.dist);
);
out center;`;

        // Fallback 1: Direct area query (if not correctly nested inside Sakarya on OSM)
        const fallbackQuery = `[out:json][timeout:30];
area["name"="${district}"]->.dist;
(
  node["amenity"="place_of_worship"]["religion"="muslim"](area.dist);
  way["amenity"="place_of_worship"]["religion"="muslim"](area.dist);
);
out center;`;

        // Fallback 2: Province query with Javascript local filtering
        const finalFallbackQuery = `[out:json][timeout:30];
area["name"="Sakarya"]->.prov;
(
  node["amenity"="place_of_worship"]["religion"="muslim"](area.prov);
  way["amenity"="place_of_worship"]["religion"="muslim"](area.prov);
);
out center;`;

        let elements = [];

        try {
            console.log(`OSM Fetching nested area for: ${district}`);
            const response = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query));
            if (response.ok) {
                const data = await response.json();
                elements = data.elements || [];
            }
        } catch (e) {
            console.warn("OSM nested query failed, trying direct area query:", e);
        }

        if (elements.length === 0) {
            try {
                console.log(`OSM Fetching direct area for: ${district}`);
                const response = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(fallbackQuery));
                if (response.ok) {
                    const data = await response.json();
                    elements = data.elements || [];
                }
            } catch (e) {
                console.warn("OSM direct district query failed, trying Sakarya province with JS filter:", e);
            }
        }

        if (elements.length === 0) {
            try {
                console.log("OSM Fetching whole province Sakarya...");
                const response = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(finalFallbackQuery));
                if (response.ok) {
                    const data = await response.json();
                    const rawElements = data.elements || [];
                    
                    const districtLower = district.toLocaleLowerCase('tr-TR');
                    elements = rawElements.filter(el => {
                        const addrDistrict = (el.tags?.['addr:district'] || '').toLocaleLowerCase('tr-TR');
                        const addrSuburb = (el.tags?.['addr:suburb'] || '').toLocaleLowerCase('tr-TR');
                        const addrNeighbourhood = (el.tags?.['addr:neighbourhood'] || '').toLocaleLowerCase('tr-TR');
                        const name = (el.tags?.name || '').toLocaleLowerCase('tr-TR');
                        
                        return addrDistrict.includes(districtLower) || 
                               addrSuburb.includes(districtLower) || 
                               addrNeighbourhood.includes(districtLower) || 
                               name.includes(districtLower);
                    });
                }
            } catch (e) {
                console.error("OSM Overpass API completely failed:", e);
                showToast("OSM verisi alınamadı. Lütfen tekrar deneyin.", "error");
                document.getElementById('osm-loader')?.classList.add('hidden');
                if (fetchBtn) {
                    fetchBtn.disabled = false;
                    fetchBtn.classList.remove('disabled');
                    fetchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Camileri Bul (OSM)';
                }
                return;
            }
        }

        document.getElementById('osm-loader')?.classList.add('hidden');

        if (fetchBtn) {
            fetchBtn.disabled = false;
            fetchBtn.classList.remove('disabled');
            fetchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Camileri Bul (OSM)';
        }

        if (elements.length === 0) {
            document.getElementById('osm-empty')?.classList.remove('hidden');
            return;
        }

        // Map results
        osmResults = elements.map(el => {
            const lat = el.lat || (el.center && el.center.lat);
            const lon = el.lon || (el.center && el.center.lon);
            
            const isUnnamed = !(el.tags?.name || el.tags?.description || el.tags?.official_name);
            let rawName = el.tags?.name || el.tags?.description || el.tags?.official_name || "İsimsiz Cami/Mescid";
            let mosque_name = rawName.trim();
            if (!mosque_name.toLocaleLowerCase('tr-TR').includes("cami") && !mosque_name.toLocaleLowerCase('tr-TR').includes("mescid")) {
                mosque_name = mosque_name + " Camii";
            }

            const neighborhood = el.tags?.['addr:suburb'] || el.tags?.['addr:neighbourhood'] || el.tags?.['addr:quarter'] || '';
            const street = el.tags?.['addr:street'] || '';
            const housenumber = el.tags?.['addr:housenumber'] || '';

            let address = el.tags?.['addr:full'] || '';
            if (!address) {
                const parts = [];
                if (neighborhood) parts.push(neighborhood + " Mah.");
                if (street) parts.push(street + " Sk.");
                if (housenumber) parts.push("No: " + housenumber);
                address = parts.join(' ');
            }

            return {
                mosque_name,
                city: 'Sakarya',
                district: district,
                neighborhood,
                address: address || 'Adres bilgisi alınamadı.',
                latitude: lat,
                longitude: lon,
                google_maps_link: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
                status: 'active',
                isUnnamed: isUnnamed
            };
        }).filter(item => item.latitude && item.longitude);

        if (osmResults.length === 0) {
            document.getElementById('osm-empty')?.classList.remove('hidden');
            return;
        }

        renderOsmPreview();
    }

    function renderOsmPreview() {
        const list = document.getElementById('osm-preview-list');
        const countSpan = document.getElementById('osm-found-count');
        const hideUnnamed = document.getElementById('osm-hide-unnamed')?.checked;
        
        if (!list) return;
        list.innerHTML = '';
        
        // Filter out unnamed results if "osm-hide-unnamed" is checked
        const filteredResults = hideUnnamed 
            ? osmResults.filter(item => !item.isUnnamed) 
            : osmResults;

        if (countSpan) countSpan.textContent = filteredResults.length;

        filteredResults.forEach((item, filteredIndex) => {
            const index = osmResults.indexOf(item);
            const tr = document.createElement('tr');
            
            // Check duplicate
            const isDuplicateInDb = mosquesListCache.some(existing => {
                const sameNameAndDistrict = trNormalize(existing.mosque_name) === trNormalize(item.mosque_name) &&
                    trNormalize(existing.district) === trNormalize(item.district);
                const sameLocation = isCloseLocation(existing.latitude, existing.longitude, item.latitude, item.longitude);
                return sameNameAndDistrict || sameLocation;
            });

            const rowStyle = isDuplicateInDb ? 'style="opacity: 0.65; background-color: #fdfaf2;"' : '';
            const dupBadge = isDuplicateInDb ? '<br><span style="color: #b7791f; background-color: #fefcbf; font-size: 11px; padding: 1px 6px; border-radius: 4px; font-weight: 600; display: inline-block; margin-top: 4px;">Sistemde Kayıtlı</span>' : '';
            
            // Unnamed records should NOT be selected by default (requirement 1)
            const isChecked = !isDuplicateInDb && !item.isUnnamed;

            tr.innerHTML = `
                <tr ${rowStyle}>
                    <td style="padding: 12px 10px; text-align: center;">
                        <input type="checkbox" class="osm-item-checkbox" data-index="${index}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                    </td>
                    <td style="padding: 12px 10px; font-weight: 600; color: var(--md-primary);">
                        ${escapeHtml(item.mosque_name)}
                        ${item.isUnnamed ? '<br><span style="color: #dc2626; background-color: #fee2e2; font-size: 11px; padding: 1px 6px; border-radius: 4px; font-weight: 600; display: inline-block; margin-top: 4px;">İsimsiz Kayıt</span>' : ''}
                        ${dupBadge}
                    </td>
                    <td style="padding: 12px 10px; font-weight: 500;">${escapeHtml(item.district)}</td>
                    <td style="padding: 12px 10px; color: var(--md-on-surface-variant); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.address)}">
                        ${escapeHtml(item.address)}
                    </td>
                    <td style="padding: 12px 10px; font-family: monospace; font-size: 11px; color: #666;">
                        ${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}
                    </td>
                </tr>
            `;
            
            list.appendChild(tr);
        });

        // Set select all checkbox initial state
        const selectAllCb = document.getElementById('osm-select-all');
        const checkedCbs = list.querySelectorAll('.osm-item-checkbox:checked');
        const allCbs = list.querySelectorAll('.osm-item-checkbox');
        if (selectAllCb) {
            selectAllCb.checked = allCbs.length === checkedCbs.length && allCbs.length > 0;
        }

        // Add item level change listeners
        list.querySelectorAll('.osm-item-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                const checked = list.querySelectorAll('.osm-item-checkbox:checked');
                const total = list.querySelectorAll('.osm-item-checkbox');
                if (selectAllCb) {
                    selectAllCb.checked = checked.length === total.length;
                }
                updateOsmSelectionSummary();
            });
        });

        document.getElementById('osm-preview-section')?.classList.remove('hidden');
        updateOsmSelectionSummary();
    }

    function updateOsmSelectionSummary() {
        const list = document.getElementById('osm-preview-list');
        if (!list) return;
        
        const checkedCount = list.querySelectorAll('.osm-item-checkbox:checked').length;
        
        // Count how many are currently rendered/visible
        const hideUnnamed = document.getElementById('osm-hide-unnamed')?.checked;
        const totalCount = hideUnnamed 
            ? osmResults.filter(item => !item.isUnnamed).length 
            : osmResults.length;
        
        const summarySpan = document.getElementById('osm-selection-summary');
        if (summarySpan) {
            summarySpan.textContent = `${totalCount} camiden ${checkedCount} tanesi seçildi`;
        }

        const saveBtn = document.getElementById('osm-modal-btn-save');
        if (saveBtn) {
            if (checkedCount > 0) {
                saveBtn.classList.remove('hidden');
            } else {
                saveBtn.classList.add('hidden');
            }
        }
    }

    async function saveSelectedOsmMosques() {
        if (!supabaseClient) return;

        const list = document.getElementById('osm-preview-list');
        if (!list) return;

        const checkedCbs = list.querySelectorAll('.osm-item-checkbox:checked');
        if (checkedCbs.length === 0) {
            showToast("Lütfen kaydedilecek en az bir cami seçin.", "error");
            return;
        }

        // Check if there are checked unnamed records and ask confirmation
        let hasUnnamedChecked = false;
        for (const cb of checkedCbs) {
            const index = parseInt(cb.getAttribute('data-index'));
            const item = osmResults[index];
            if (item && item.isUnnamed) {
                hasUnnamedChecked = true;
                break;
            }
        }

        if (hasUnnamedChecked) {
            const confirmSave = confirm("Seçtiğiniz kayıtlar arasında 'İsimsiz Cami/Mescid' içeren kayıtlar bulunuyor. Bu kayıtları isimsiz olarak kaydetmek istediğinize emin misiniz?");
            if (!confirmSave) {
                return;
            }
        }

        const saveBtn = document.getElementById('osm-modal-btn-save');
        const cancelBtn = document.getElementById('osm-modal-btn-cancel');
        
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.classList.add('disabled');
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
        }
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.classList.add('disabled');
        }

        let savedCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;

        for (const cb of checkedCbs) {
            const index = parseInt(cb.getAttribute('data-index'));
            const item = osmResults[index];
            if (!item) continue;

            // Strict duplicate check against cached live list
            const isDuplicate = mosquesListCache.some(existing => {
                const sameNameAndDistrict = trNormalize(existing.mosque_name) === trNormalize(item.mosque_name) &&
                    trNormalize(existing.district) === trNormalize(item.district);
                const sameLocation = isCloseLocation(existing.latitude, existing.longitude, item.latitude, item.longitude);
                return sameNameAndDistrict || sameLocation;
            });

            if (isDuplicate) {
                duplicateCount++;
                continue;
            }

            const payload = {
                mosque_name: item.mosque_name,
                city: item.city,
                district: item.district,
                neighborhood: item.neighborhood,
                address: item.address,
                latitude: item.latitude,
                longitude: item.longitude,
                google_maps_link: item.google_maps_link,
                status: item.status,
                source: 'osm',
                verification_status: 'unverified',
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            };

            try {
                let { error } = await supabaseClient
                    .from('mosque_locations')
                    .insert(payload);

                if (error) throw error;
                savedCount++;
            } catch (err) {
                console.error("OSM cami kaydedilemedi:", err);
                errorCount++;
            }
        }

        await loadMosques();

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('disabled');
            saveBtn.textContent = 'Seçilenleri Kaydet';
        }
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.classList.remove('disabled');
        }

        closeOsmModal();

        showToast(`${savedCount} cami kaydedildi, ${duplicateCount} kayıt zaten vardı.`, "success");
    }

    function initMosqueListeners() {
        // Add button
        document.getElementById('add-mosque-btn')?.addEventListener('click', openAddMosqueModal);
        
        // OSM button
        document.getElementById('osm-import-btn')?.addEventListener('click', openOsmModal);
        
        // Close modal
        document.getElementById('mosque-modal-close-top')?.addEventListener('click', closeMosqueModal);
        document.getElementById('mosque-modal-btn-cancel')?.addEventListener('click', closeMosqueModal);
        
        // Close OSM Modal
        document.getElementById('osm-modal-close-top')?.addEventListener('click', closeOsmModal);
        document.getElementById('osm-modal-btn-cancel')?.addEventListener('click', closeOsmModal);
        
        // Save modal
        document.getElementById('mosque-modal-btn-save')?.addEventListener('click', saveMosque);
        
        // Fetch OSM Button
        document.getElementById('osm-fetch-btn')?.addEventListener('click', fetchOsmMosques);
        
        // OSM Select All
        document.getElementById('osm-select-all')?.addEventListener('change', (e) => {
            const checked = e.target.checked;
            document.querySelectorAll('.osm-item-checkbox').forEach(cb => {
                cb.checked = checked;
            });
            updateOsmSelectionSummary();
        });

        // OSM Hide Unnamed Checkbox
        document.getElementById('osm-hide-unnamed')?.addEventListener('change', () => {
            renderOsmPreview();
        });

        // OSM Save Button
        document.getElementById('osm-modal-btn-save')?.addEventListener('click', saveSelectedOsmMosques);

        // Refresh button
        document.getElementById('mosques-refresh-btn')?.addEventListener('click', loadMosques);
        document.getElementById('mosques-retry-btn')?.addEventListener('click', loadMosques);

        // Filters
        document.getElementById('mosques-filter-search')?.addEventListener('input', applyMosqueFilters);
        document.getElementById('mosques-filter-district')?.addEventListener('change', applyMosqueFilters);
        document.getElementById('mosques-filter-status')?.addEventListener('change', applyMosqueFilters);
        document.getElementById('mosques-filter-verification')?.addEventListener('change', applyMosqueFilters);
        document.getElementById('mosques-filter-unnamed')?.addEventListener('change', applyMosqueFilters);
        document.getElementById('mosques-filter-sort')?.addEventListener('change', applyMosqueFilters);

        // Clear Filters Button
        document.getElementById('mosques-clear-filters-btn')?.addEventListener('click', () => {
            const searchField = document.getElementById('mosques-filter-search');
            const districtField = document.getElementById('mosques-filter-district');
            const statusField = document.getElementById('mosques-filter-status');
            const verificationField = document.getElementById('mosques-filter-verification');
            const unnamedField = document.getElementById('mosques-filter-unnamed');
            const sortField = document.getElementById('mosques-filter-sort');

            if (searchField) searchField.value = '';
            if (districtField) districtField.value = '';
            if (statusField) statusField.value = '';
            if (verificationField) verificationField.value = '';
            if (unnamedField) unnamedField.value = 'hide';
            if (sortField) sortField.value = 'az';

            applyMosqueFilters();
        });

        // Google Maps parsing
        const googleMapsInput = document.getElementById('mosque-modal-google-maps-input');
        if (googleMapsInput) {
            googleMapsInput.addEventListener('input', (e) => {
                const link = e.target.value.trim();
                if (!link) {
                    document.getElementById('mosque-modal-link-warning').classList.add('hidden');
                    return;
                }
                
                const parsed = extractLatLngFromGoogleMapsLink(link);
                if (parsed) {
                    if (parsed.isShort) {
                        document.getElementById('mosque-modal-link-warning').classList.remove('hidden');
                        showToast("Kısa Google Maps linkleri otomatik çözümlenemiyor. Lütfen Google Maps’ten uzun bağlantıyı yapıştırın.", "error");
                    } else {
                        document.getElementById('mosque-modal-link-warning').classList.add('hidden');
                        document.getElementById('mosque-modal-latitude-input').value = parsed.latitude;
                        document.getElementById('mosque-modal-longitude-input').value = parsed.longitude;
                        showToast("Koordinatlar otomatik çözümlendi.", "success");
                    }
                } else {
                    document.getElementById('mosque-modal-link-warning').classList.add('hidden');
                }
            });
        }
    }

    // Initial Load
    initViewSelector();
    initFilterListeners();
    initMainNavigation();
    initTrashBinListeners();
    initTabs();
    initPhotoUploadListeners();
    initLogoUploadListeners();
    initOrganizationListeners();
    initDistrictWarningListeners();
    initOrgListeners();
    initMosqueListeners();
    loadOrganizations();
    loadData();
});
