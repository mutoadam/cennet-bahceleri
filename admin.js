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

    // Primary Tab Switcher (Öneriler vs. Programlar)
    function initMainNavigation() {
        const tabSuggestions = document.getElementById('main-tab-suggestions');
        const tabPrograms = document.getElementById('main-tab-programs');
        const suggestionsContent = document.getElementById('suggestions-tab-content');
        const programsContent = document.getElementById('programs-tab-content');

        if (tabSuggestions && tabPrograms && suggestionsContent && programsContent) {
            tabSuggestions.addEventListener('click', () => {
                tabSuggestions.classList.add('active');
                tabPrograms.classList.remove('active');
                suggestionsContent.classList.remove('hidden');
                programsContent.classList.add('hidden');
            });

            tabPrograms.addEventListener('click', () => {
                tabPrograms.classList.add('active');
                tabSuggestions.classList.remove('active');
                programsContent.classList.remove('hidden');
                suggestionsContent.classList.add('hidden');
                loadPrograms();
            });
        }
    }

    // Primary Tab Switcher (Öneriler vs. Programlar)
    function initMainNavigation() {
        const tabSuggestions = document.getElementById('main-tab-suggestions');
        const tabPrograms = document.getElementById('main-tab-programs');
        const suggestionsContent = document.getElementById('suggestions-tab-content');
        const programsContent = document.getElementById('programs-tab-content');

        if (tabSuggestions && tabPrograms && suggestionsContent && programsContent) {
            tabSuggestions.addEventListener('click', () => {
                tabSuggestions.classList.add('active');
                tabPrograms.classList.remove('active');
                suggestionsContent.classList.remove('hidden');
                programsContent.classList.add('hidden');
            });

            tabPrograms.addEventListener('click', () => {
                tabPrograms.classList.add('active');
                tabSuggestions.classList.remove('active');
                programsContent.classList.remove('hidden');
                suggestionsContent.classList.add('hidden');
                loadPrograms();
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
        if (districtInput) districtInput.value = item.district || '';

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
        if (!district) {
            showToast("İlçe zorunludur.", "error");
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

    // Initial Load
    initViewSelector();
    initFilterListeners();
    initMainNavigation();
    initTrashBinListeners();
    initTabs();
    initPhotoUploadListeners();
    initLogoUploadListeners();
    loadData();
});
