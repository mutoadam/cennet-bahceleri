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
    let knownColumns = ['id', 'program_name', 'venue_name', 'city', 'district', 'day', 'time', 'teacher', 'organization', 'women_friendly', 'address', 'google_maps_link', 'description', 'contact_name', 'contact_phone', 'photo_url', 'status', 'created_at', 'updated_at', 'ladies_suitable', 'is_ladies_suitable', 'isLadiesSuitable'];

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
    async function syncSuggestionToProgram(suggestion, sourceType) {
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

        // 3. Resolve photo_url
        const photo_url = suggestion.photo_url || suggestion.photoUrl || suggestion.image_url || suggestion.imageUrl || suggestion.photo || suggestion.image || null;

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
            status: 'active',
            source: sourceType
        };

        console.log("Programs tablosuna aktarılan veri:", programPayload);

        // 5. Insert to programs
        const { error: insertError } = await supabaseClient
            .from('programs')
            .insert(programPayload);

        if (insertError) {
            console.error("Programs tablosuna ekleme hatası:", insertError);
            throw insertError;
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
        document.getElementById('edit-district').value = currentSuggestion.district || '';
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
        }
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
                    await syncSuggestionToProgram(responseData[0], 'admin_manual');
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

    // Initial Load
    initTabs();
    loadData();
});
