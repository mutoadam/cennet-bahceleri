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

            // Check if config exists
            if (!window.CENNET_CONFIG) {
                console.warn('window.CENNET_CONFIG bulunamadı! Lütfen config.js dosyasını kontrol edin. Geçici test verileri veya .env kullanılacak.');
                // Fallback to empty config to prevent hard crash
                window.CENNET_CONFIG = {
                    supabaseUrl: '',
                    supabaseKey: ''
                };
            }

           const supabaseUrl =
    window.CENNET_CONFIG.SUPABASE_URL || "";

const supabaseKey =
    window.CENNET_CONFIG.SUPABASE_ANON_KEY || "";

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
                console.log('İncelenen Öneri Detayı:', item);
                alert(`Öneri detayları konsola yazdırıldı.\n\nProgram: ${item.program_name}\nMekân: ${item.venue_name}\nÖneren: ${item.contact_name}`);
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

    // Event Listeners for buttons
    refreshBtn.addEventListener('click', loadData);
    retryBtn.addEventListener('click', loadData);

    // Initial Load
    loadData();
});

