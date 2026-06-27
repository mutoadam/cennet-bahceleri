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

    let supabaseClient = null;

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

    // 2. Fetch Suggestions & Stats
    async function loadData() {
        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        showLoader();

        try {
            // Fetch Pending Suggestions
            // public.suggestions table status = pending, sorted by created_at DESC
            const { data: pendingSuggestions, error: pendingError } = await supabaseClient
                .from('suggestions')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (pendingError) throw pendingError;

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

            // Display list
            renderSuggestions(pendingSuggestions);

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

            card.innerHTML = `
                <div class="card-header-info">
                    <span class="category-badge">${escapeHtml(item.category || 'Belirtilmemiş')}</span>
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

    // Modal functions (Paket A — Admin İncele Modalı)
    function openInspectModal(item) {
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

        // Show Modal overlay
        const modal = document.getElementById('inspect-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    function closeInspectModal() {
        const modal = document.getElementById('inspect-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // Event Listeners for buttons
    refreshBtn.addEventListener('click', loadData);
    retryBtn.addEventListener('click', loadData);

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
        }
    });

    // Initial Load
    loadData();
});
