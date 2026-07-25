/**
 * Cennet Bahçeleri - İlim Meclisi Öneri Formu Logic (script.js)
 */

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const heroSection = document.getElementById('hero-section');
    const formSection = document.getElementById('form-section');
    const successSection = document.getElementById('success-section');
    const suggestionForm = document.getElementById('suggestion-form');
    const submitBtn = document.getElementById('submit-btn');

    // Loader & Error Elements
    const formError = document.getElementById('form-error');
    const formErrorMsg = document.getElementById('form-error-msg');
    const formLoading = document.getElementById('form-loading');

    // Success Screen Detail Elements
    const summaryProgramName = document.getElementById('summary-program-name');
    const summaryVenueName = document.getElementById('summary-venue-name');
    const summaryDistrict = document.getElementById('summary-district');
    const summaryDatetime = document.getElementById('summary-datetime');
    const newSuggestionBtn = document.getElementById('new-suggestion-btn');

    let supabaseClient = null;
    let selectedSuggestionPhotos = []; // Central list for photos

    // UI Elements for Multi-Photo
    const photoInput = document.getElementById('photo_file');
    const photoPreviewsContainer = document.getElementById('photo-previews');

    // Organization Toggle Logic
    const organizationSelect = document.getElementById('organization');
    const otherOrgContainer = document.getElementById('other-org-container');
    const otherOrganizationInput = document.getElementById('other_organization');

    if (organizationSelect && otherOrgContainer) {
        organizationSelect.addEventListener('change', () => {
            if (organizationSelect.value === 'Diğer') {
                otherOrgContainer.classList.remove('hidden');
                otherOrganizationInput.required = true;
            } else {
                otherOrgContainer.classList.add('hidden');
                otherOrganizationInput.required = false;
                otherOrganizationInput.value = '';
            }
        });
    }

    // 1. Initialize Supabase Client
    function initSupabase() {
        try {
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
                supabaseUrl = window.SUPABASE_URL || window.supabaseUrl;
                supabaseKey = window.SUPABASE_KEY || window.supabaseKey || window.SUPABASE_ANON_KEY || window.supabaseAnonKey;
            }

            // Fallback for development/testing if config.js is not loaded yet
            if (!supabaseUrl || !supabaseKey) {
                supabaseUrl = 'https://qfjmpmpcdzyqticvscib.supabase.co';
                supabaseKey = 'sb_publishable_C-_vR25Q1CXgNMOJ7NE6ag_RC4iv9mH'; // Safe anon key from .env.
            }

            supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
            return true;
        } catch (error) {
            console.error('Supabase initialization error:', error);
            showError('Sistem başlatılamadı. Lütfen daha sonra tekrar deneyin.');
            return false;
        }
    }

    let suggestionsHasOrgId = false;

    // Detect if suggestions table has organization_id column
    async function detectSuggestionsOrgIdColumn() {
        if (!supabaseClient) return;
        try {
            const { error } = await supabaseClient.from('suggestions').select('organization_id').limit(1);
            suggestionsHasOrgId = !error;
            console.log("Suggestions table has organization_id column:", suggestionsHasOrgId);
        } catch (e) {
            console.warn("Error detecting organization_id in suggestions:", e);
            suggestionsHasOrgId = false;
        }
    }

    // Load organizations from Supabase
    async function loadOrganizations() {
        if (!supabaseClient) return;
        try {
            let { data, error } = await supabaseClient
                .from('organizations')
                .select('id, name, status')
                .eq('status', 'active')
                .order('name', { ascending: true });

            if (error) {
                console.warn("Error fetching active organizations, trying without status filter:", error);
                const fallbackResult = await supabaseClient
                    .from('organizations')
                    .select('id, name')
                    .order('name', { ascending: true });
                if (fallbackResult.error) throw fallbackResult.error;
                data = fallbackResult.data;
            }

            const activeOrganizations = data || [];
            populateOrganizationDropdown(activeOrganizations);
        } catch (err) {
            console.error("Failed to load organizations, keeping fallback options:", err);
        }
    }

    // Populate organization dropdown
    function populateOrganizationDropdown(orgList) {
        if (!organizationSelect) return;

        // Clear existing dynamic/static options except the first one "Kurum seçiniz"
        organizationSelect.innerHTML = '<option value="">Kurum seçiniz</option>';

        // Add "Bağımsız / Diğer" option
        const independentOpt = document.createElement('option');
        independentOpt.value = 'Bağımsız / Diğer';
        independentOpt.textContent = 'Bağımsız / Diğer';
        organizationSelect.appendChild(independentOpt);

        // Sort orgList alphabetically by name in Turkish
        const sortedList = [...orgList].sort((a, b) => 
            (a.name || '').localeCompare(b.name || '', 'tr')
        );

        // Add each organization as an option
        sortedList.forEach(org => {
            const opt = document.createElement('option');
            opt.value = org.id; // Store organization_id as the value
            opt.textContent = org.name;
            organizationSelect.appendChild(opt);
        });

        // Also add "Diğer" option at the end to allow custom input
        const otherOpt = document.createElement('option');
        otherOpt.value = 'Diğer';
        otherOpt.textContent = 'Diğer (Kendiniz Yazın)';
        organizationSelect.appendChild(otherOpt);
    }

    // Load program types from Supabase
    async function loadProgramTypes() {
        if (!supabaseClient) return;
        try {
            const { data, error } = await supabaseClient
                .from('program_types')
                .select('id, name, slug, icon_key, sort_order, status')
                .eq('status', 'active')
                .order('sort_order', { ascending: true });

            if (error) {
                console.warn("Error fetching program types, using fallback:", error);
                populateProgramTypeDropdown([]);
                return;
            }

            const activeTypes = data || [];
            populateProgramTypeDropdown(activeTypes);
        } catch (err) {
            console.error("Failed to load program types:", err);
            populateProgramTypeDropdown([]);
        }
    }

    // Populate program type dropdown
    function populateProgramTypeDropdown(typeList) {
        const programSelect = document.getElementById('program_name');
        if (!programSelect) return;

        // Clear existing options
        programSelect.innerHTML = '<option value="" disabled selected>Program türü seçiniz</option>';

        if (typeList.length === 0) {
            // Fallback static list in case of empty table or fetch error
            const fallbackTypes = [
                "Haftalık Sohbet", "Gençlik Sohbeti", "Hanımlar Sohbeti", "Aile Sohbeti", "Çocuk Sohbeti", "Soru-Cevap", "Hasbihal",
                "Hadis Dersi", "Fıkıh Dersi", "Tefsir Dersi", "İlmihal Dersi", "Akaid Dersi", "Siyer Dersi", "Mütalaa Dersi",
                "Zikir ve Sohbet", "Haftalık Ders ve Zikir", "Hatm-i Hacegân", "Evrâd ve Zikir", "Dua Programı",
                "Davet Ameli", "Maruf Çalışması", "3 Günlük Sefer", "Gençlik Buluşması",
                "Sinevizyon Sohbeti", "Seminer", "Konferans", "Panel", "Diğer"
            ];
            fallbackTypes.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                programSelect.appendChild(opt);
            });
            return;
        }

        // Add each program type as an option
        typeList.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type.name;
            opt.textContent = type.name;
            programSelect.appendChild(opt);
        });

        // Add "Diğer" option at the end if not already present
        if (!typeList.some(t => t.name === 'Diğer')) {
            const opt = document.createElement('option');
            opt.value = 'Diğer';
            opt.textContent = 'Diğer';
            programSelect.appendChild(opt);
        }
    }

    // UUID Fallback Helper
    function generateUUID() {
        if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    // Photo Selection Handler
    if (photoInput) {
        photoInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) return;

            if (selectedSuggestionPhotos.length + files.length > 6) {
                alert('En fazla 6 fotoğraf ekleyebilirsiniz.');
                photoInput.value = ''; // Reset input to allow re-selection
                return;
            }

            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
            const maxSize = 8 * 1024 * 1024; // 8MB

            files.forEach(file => {
                if (!allowedTypes.includes(file.type)) {
                    alert(`"${file.name}" desteklenmeyen bir dosya formatı. Sadece JPEG, PNG ve WEBP kabul edilir.`);
                    return;
                }
                if (file.size > maxSize) {
                    alert(`"${file.name}" çok büyük. En fazla 8 MB yüklenebilir.`);
                    return;
                }

                const clientId = Math.random().toString(36).substring(2, 11);
                const previewUrl = URL.createObjectURL(file);

                selectedSuggestionPhotos.push({
                    file: file,
                    previewUrl: previewUrl,
                    clientId: clientId,
                    isCover: selectedSuggestionPhotos.length === 0 // First one is cover by default
                });
            });

            photoInput.value = ''; // Clear input to allow re-selecting same file
            renderPhotoPreviews();
        });
    }

    // Render Photo Previews
    function renderPhotoPreviews() {
        if (!photoPreviewsContainer) return;

        if (selectedSuggestionPhotos.length === 0) {
            photoPreviewsContainer.innerHTML = '';
            photoPreviewsContainer.classList.add('hidden');
            return;
        }

        photoPreviewsContainer.classList.remove('hidden');
        photoPreviewsContainer.innerHTML = '';

        selectedSuggestionPhotos.forEach((photo, index) => {
            const item = document.createElement('div');
            item.className = `photo-preview-item ${photo.isCover ? 'is-cover' : ''}`;

            item.innerHTML = `
                <div class="preview-img-wrapper">
                    ${photo.isCover ? '<span class="cover-badge">Kapak</span>' : ''}
                    <img src="${photo.previewUrl}" alt="Önizleme">
                </div>
                <div class="preview-controls">
                    <button type="button" class="preview-btn btn-move" onclick="window.movePhoto('${photo.clientId}', -1)" title="Sola Taşı" ${index === 0 ? 'disabled' : ''}>
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <button type="button" class="preview-btn btn-move" onclick="window.movePhoto('${photo.clientId}', 1)" title="Sağa Taşı" ${index === selectedSuggestionPhotos.length - 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                    <button type="button" class="preview-btn btn-remove" onclick="window.removePhoto('${photo.clientId}')" title="Kaldır">
                        <i class="fa-solid fa-trash"></i> Kaldır
                    </button>
                    <button type="button" class="preview-btn btn-cover ${photo.isCover ? 'active' : ''}" onclick="window.setCoverPhoto('${photo.clientId}')">
                        ${photo.isCover ? '<i class="fa-solid fa-star"></i> Kapak' : 'Kapak Yap'}
                    </button>
                </div>
            `;
            photoPreviewsContainer.appendChild(item);
        });
    }

    // Exposure of controls to window for onclick handlers
    window.removePhoto = (clientId) => {
        const index = selectedSuggestionPhotos.findIndex(p => p.clientId === clientId);
        if (index > -1) {
            const removed = selectedSuggestionPhotos.splice(index, 1)[0];
            URL.revokeObjectURL(removed.previewUrl);

            // If we removed the cover, set the first one as cover
            if (removed.isCover && selectedSuggestionPhotos.length > 0) {
                selectedSuggestionPhotos[0].isCover = true;
            }
            renderPhotoPreviews();
        }
    };

    window.setCoverPhoto = (clientId) => {
        selectedSuggestionPhotos.forEach(p => p.isCover = (p.clientId === clientId));
        renderPhotoPreviews();
    };

    window.movePhoto = (clientId, direction) => {
        const index = selectedSuggestionPhotos.findIndex(p => p.clientId === clientId);
        if (index === -1) return;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= selectedSuggestionPhotos.length) return;

        const element = selectedSuggestionPhotos.splice(index, 1)[0];
        selectedSuggestionPhotos.splice(newIndex, 0, element);
        renderPhotoPreviews();
    };

    // Initialize on load
    if (initSupabase()) {
        detectSuggestionsOrgIdColumn().then(() => {
            loadOrganizations();
            loadProgramTypes();
        });
    }

    // Helper: Show Error
    function showError(message) {
        formErrorMsg.textContent = message;
        formError.classList.remove('hidden');
        formLoading.classList.add('hidden');
        submitBtn.disabled = false;
        
        // Scroll to error container
        formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Helper: Hide States
    function hideStates() {
        formError.classList.add('hidden');
        formLoading.classList.add('hidden');
    }

    // Helper: Safe Notification triggers for Telegram
    async function triggerNotification(data) {
        console.log("Triggering notification helpers.");
        const notifyFunctions = [
            'sendTelegramNotification',
            'notifyNewSuggestion',
            'notifyTelegram',
            'sendNotification',
            'notify'
        ];

        for (const funcName of notifyFunctions) {
            if (typeof window[funcName] === 'function') {
                try {
                    console.log(`Calling notification function: ${funcName}`);
                    await window[funcName](data);
                } catch (err) {
                    console.warn(`Error executing notification function ${funcName}:`, err);
                }
            }
        }
    }

    // Form Type Toggle logic
    const submissionTypeSelect = document.getElementById('submission_type');
    const correctionReasonGroup = document.getElementById('correction-reason-group');
    const correctionReasonSelect = document.getElementById('correction_reason');

    const formGroupsToToggle = [
        { id: 'venue_name', required: true },
        { id: 'district', required: true },
        { id: 'day', required: true },
        { id: 'time', required: true },
        { id: 'teacher', required: false },
        { id: 'organization', required: false },
        { id: 'women_friendly', required: false },
        { id: 'google_maps_link', required: false },
        { id: 'address', required: true },
        { id: 'photo_file', required: false }
    ];

    function updateFormFieldsVisibility() {
        if (!submissionTypeSelect) return;
        const isUpdate = submissionTypeSelect.value === 'update_request';
        
        if (isUpdate) {
            if (correctionReasonGroup) correctionReasonGroup.classList.remove('hidden');
            if (correctionReasonSelect) correctionReasonSelect.required = true;
            
            formGroupsToToggle.forEach(item => {
                const el = document.getElementById(item.id);
                if (el) {
                    el.required = false;
                    const fg = el.closest('.form-group');
                    if (fg) fg.classList.add('hidden');
                }
            });
        } else {
            if (correctionReasonGroup) correctionReasonGroup.classList.add('hidden');
            if (correctionReasonSelect) {
                correctionReasonSelect.required = false;
                correctionReasonSelect.value = '';
            }
            
            formGroupsToToggle.forEach(item => {
                const el = document.getElementById(item.id);
                if (el) {
                    el.required = item.required;
                    const fg = el.closest('.form-group');
                    if (fg) fg.classList.remove('hidden');
                }
            });
        }
    }

    if (submissionTypeSelect) {
        submissionTypeSelect.addEventListener('change', updateFormFieldsVisibility);
    }

    // 2. Submit Event Handler
    suggestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideStates();

        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        submitBtn.disabled = true;
        formLoading.classList.remove('hidden');

        const isUpdate = submissionTypeSelect && submissionTypeSelect.value === 'update_request';

        // Extract Form Inputs
        const programName = document.getElementById('program_name').value.trim();
        const contactName = document.getElementById('contact_name').value.trim();
        const contactPhone = document.getElementById('contact_phone').value.trim();
        const description = document.getElementById('description').value.trim();

        let venueName = "Düzeltme Talebi";
        let district = "Web";
        let day = "Gerekmiyor";
        let time = "Gerekmiyor";
        let teacher = "Belirtilmedi";
        let organization = "Belirtilmedi";
        let organizationId = null;
        let womenFriendly = false;
        let googleMapsLink = null;
        let address = "Belirtilmedi";

        if (!isUpdate) {
            venueName = document.getElementById('venue_name').value.trim();
            district = document.getElementById('district').value;
            day = document.getElementById('day').value;
            time = document.getElementById('time').value.trim();
            teacher = document.getElementById('teacher').value.trim();
            
            const orgSelectValue = document.getElementById('organization').value;
            if (orgSelectValue === 'Diğer') {
                const otherVal = document.getElementById('other_organization').value.trim();
                if (!otherVal) {
                    showError('Diğer kurum adını yazınız');
                    return;
                }
                organization = otherVal;
            } else if (orgSelectValue === 'Bağımsız / Diğer') {
                organization = 'Bağımsız / Diğer';
            } else if (orgSelectValue) {
                // It's a real organization from the database!
                organizationId = orgSelectValue; // UUID
                const selectedOpt = organizationSelect.options[organizationSelect.selectedIndex];
                organization = selectedOpt ? selectedOpt.textContent : '';
            }

            womenFriendly = document.getElementById('women_friendly').value === 'true';
            googleMapsLink = document.getElementById('google_maps_link').value.trim();
            address = document.getElementById('address').value.trim();
        }

        const suggestionId = generateUUID();
        let mainPhotoUrl = null;
        const uploadedPhotosMetadata = [];

        try {
            // A. Upload All Selected Photos
            if (!isUpdate && selectedSuggestionPhotos.length > 0) {
                console.log(`Uploading ${selectedSuggestionPhotos.length} photos...`);

                for (let i = 0; i < selectedSuggestionPhotos.length; i++) {
                    const photo = selectedSuggestionPhotos[i];
                    const fileExt = photo.file.name.split('.').pop() || 'jpg';
                    const uniqueFileName = `${generateUUID()}.${fileExt}`;
                    const storagePath = `suggestions/${suggestionId}/${uniqueFileName}`;

                    const { data: uploadData, error: uploadError } = await supabaseClient.storage
                        .from('suggestion-photos')
                        .upload(storagePath, photo.file);

                    if (uploadError) {
                        console.error(`Upload error for photo ${i}:`, uploadError);
                        continue; // Skip this photo if upload fails
                    }

                    const { data: publicUrlData } = supabaseClient.storage
                        .from('suggestion-photos')
                        .getPublicUrl(storagePath);

                    const publicUrl = publicUrlData.publicUrl;

                    if (photo.isCover) {
                        mainPhotoUrl = publicUrl;
                    }

                    uploadedPhotosMetadata.push({
                        suggestion_id: suggestionId,
                        program_id: null,
                        bucket_name: "suggestion-photos",
                        storage_path: storagePath,
                        photo_url: publicUrl,
                        sort_order: i,
                        is_cover: photo.isCover
                    });
                }
            }

            // B. Construct insert payload
            const suggestionPayload = {
                id: suggestionId,
                program_name: programName,
                venue_name: venueName,
                district: district,
                day: day,
                time: time,
                speaker: teacher || "Belirtilmedi",
                organization: organization || "Belirtilmedi",
                women_friendly: womenFriendly,
                address: address || "Belirtilmedi",
                google_maps_link: googleMapsLink || null,
                description: isUpdate ? `[Düzeltme Talebi - Nedeni: ${document.getElementById('correction_reason').value}]\n\nAçıklama:\n${description}` : description,
                contact_name: contactName || (isUpdate ? "Web Kullanıcısı" : "Belirtilmedi"),
                contact_phone: contactPhone || "Belirtilmedi",
                photo_url: mainPhotoUrl, // Store cover photo for backward compatibility
                status: 'pending', // Required for admin review
                source: isUpdate ? 'web_correction' : 'web_form',
                request_type: isUpdate ? 'update_request' : 'new_program'
            };

            if (suggestionsHasOrgId && organizationId) {
                suggestionPayload.organization_id = organizationId;
            }

            console.log("Inserting suggestion data...");

            // C. Insert into Supabase 'suggestions' table
            const { error: suggestionError } = await supabaseClient
                .from('suggestions')
                .insert([suggestionPayload]);

            if (suggestionError) throw suggestionError;

            // D. Insert Metadata into 'program_photos' if any photos were uploaded
            if (uploadedPhotosMetadata.length > 0) {
                const { error: metadataError } = await supabaseClient
                    .from('program_photos')
                    .insert(uploadedPhotosMetadata);

                if (metadataError) {
                    console.error("Metadata error code:", metadataError.code || "unknown");
                    showError("Öneriniz kaydedildi ancak ek fotoğrafların kaydı sırasında teknik bir hata oluştu. Ana bilgileriniz ve kapak fotoğrafınız bize ulaştı, lütfen tekrar göndermeyin.");
                    submitBtn.disabled = true; // Prevent duplicate submission

                    // Still trigger notification so admin knows about the new (partial) suggestion
                    await triggerNotification({ ...suggestionPayload });
                    return; // Stop here, do not show the full success screen
                }
            }

            console.log("Successfully inserted suggestion and metadata.");

            // D. Trigger notifications safely (e.g. notify.js)
            const notificationData = {
                ...suggestionPayload
            };
            await triggerNotification(notificationData);

            // E. POPULATE SUCCESS VIEW
            if (isUpdate) {
                summaryProgramName.textContent = programName;
                summaryVenueName.textContent = "Bilgi Hata Düzeltme Talebi";
                summaryDistrict.textContent = "Web Formu";
                summaryDatetime.textContent = "Sisteme Kaydedildi";
            } else {
                summaryProgramName.textContent = programName;
                summaryVenueName.textContent = venueName;
                summaryDistrict.textContent = district;
                summaryDatetime.textContent = `${day} günü, saat ${time}`;
            }

            // F. TOGGLE VIEW (HIDE Form/Hero, SHOW Success Screen)
            heroSection.classList.add('hidden');
            formSection.classList.add('hidden');
            successSection.classList.remove('hidden');

            // G. Scroll page to top immediately so success screen is perfectly in view
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Submission error occurred'); // Generic log for security
            showError('Öneriniz kaydedilirken bir hata oluştu. Lütfen bağlantınızı kontrol edip tekrar deneyin.');
        }
    });

    // 3. Reset Form and Go Back to initial screen
    newSuggestionBtn.addEventListener('click', () => {
        // Clear Photos State
        selectedSuggestionPhotos.forEach(p => URL.revokeObjectURL(p.previewUrl));
        selectedSuggestionPhotos = [];
        renderPhotoPreviews();

        // Reset form inputs
        suggestionForm.reset();

        // Restore form visibility default states
        updateFormFieldsVisibility();

        // Hide conditional organization fields on reset
        if (otherOrgContainer) {
            otherOrgContainer.classList.add('hidden');
        }
        if (otherOrganizationInput) {
            otherOrganizationInput.required = false;
        }

        // Switch screens (HIDE Success, SHOW Form & Hero)
        successSection.classList.add('hidden');
        heroSection.classList.remove('hidden');
        formSection.classList.remove('hidden');

        // Hide any previous error/loader remains
        hideStates();
        submitBtn.disabled = false;

        // Scroll back to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});
