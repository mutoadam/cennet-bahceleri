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

    // Initialize on load
    initSupabase();

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
        console.log("Triggering notification helpers with data:", data);
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

    // 2. Submit Event Handler
    suggestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideStates();

        if (!supabaseClient) {
            if (!initSupabase()) return;
        }

        submitBtn.disabled = true;
        formLoading.classList.remove('hidden');

        // Extract Form Inputs
        const programName = document.getElementById('program_name').value.trim();
        const venueName = document.getElementById('venue_name').value.trim();
        const district = document.getElementById('district').value;
        const day = document.getElementById('day').value;
        const time = document.getElementById('time').value.trim();
        const teacher = document.getElementById('teacher').value.trim();
        
        let organization = null;
        const orgSelectValue = document.getElementById('organization').value;
        if (orgSelectValue === 'Diğer') {
            const otherVal = document.getElementById('other_organization').value.trim();
            if (!otherVal) {
                showError('Diğer kurum adını yazınız');
                return;
            }
            organization = otherVal;
        } else if (orgSelectValue) {
            organization = orgSelectValue;
        }

        const womenFriendly = document.getElementById('women_friendly').value === 'true';
        const googleMapsLink = document.getElementById('google_maps_link').value.trim();
        const address = document.getElementById('address').value.trim();
        const description = document.getElementById('description').value.trim();
        const contactName = document.getElementById('contact_name').value.trim();
        const contactPhone = document.getElementById('contact_phone').value.trim();
        const photoFile = document.getElementById('photo_file').files[0];

        let photoUrl = null;

        try {
            // A. If file is attached, upload it to Supabase Storage
            if (photoFile) {
                const fileExt = photoFile.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
                const filePath = `suggestions/${fileName}`;

                console.log("Uploading photo:", filePath);

                // We try bucket "suggestion-photos" first, fallback to "suggestions"
                let uploadResult = null;
                try {
                    uploadResult = await supabaseClient.storage
                        .from('suggestion-photos')
                        .upload(filePath, photoFile);
                    
                    if (uploadResult.error) {
                        // Retry with bucket suggestions
                        console.log("Failed in suggestion-photos bucket, trying 'suggestions' bucket.");
                        uploadResult = await supabaseClient.storage
                            .from('suggestions')
                            .upload(filePath, photoFile);
                    }
                } catch (uploadErr) {
                    console.warn("Storage upload error:", uploadErr);
                }

                if (uploadResult && !uploadResult.error) {
                    // Try to resolve public URL
                    try {
                        const { data: publicUrlData } = supabaseClient.storage
                            .from(uploadResult.data.fullPath.split('/')[0] || 'suggestion-photos')
                            .getPublicUrl(filePath);
                        photoUrl = publicUrlData.publicUrl;
                        console.log("Resolved public photo URL:", photoUrl);
                    } catch (urlErr) {
                        console.warn("Could not get public URL:", urlErr);
                    }
                } else {
                    console.warn("Photo upload skipped or failed:", uploadResult ? uploadResult.error : "No upload result");
                }
            }

            // B. Construct insert payload
            const suggestionPayload = {
                program_name: programName,
                venue_name: venueName,
                city: 'Sakarya',
                district: district,
                day: day,
                time: time,
                teacher: teacher || null,
                organization: organization || null,
                women_friendly: womenFriendly,
                address: address,
                google_maps_link: googleMapsLink || null,
                description: description,
                contact_name: contactName || null,
                contact_phone: contactPhone || null,
                photo_url: photoUrl || null,
                status: 'pending' // Required for admin review
            };

            console.log("Inserting suggestion data:", suggestionPayload);

            // C. Insert into Supabase 'suggestions' table
            const { data, error } = await supabaseClient
                .from('suggestions')
                .insert([suggestionPayload])
                .select();

            if (error) {
                throw error;
            }

            console.log("Successfully inserted suggestion:", data);

            // D. Trigger notifications safely (e.g. notify.js)
            const notificationData = {
                id: data && data[0] ? data[0].id : null,
                ...suggestionPayload
            };
            await triggerNotification(notificationData);

            // E. POPULATE SUCCESS VIEW
            summaryProgramName.textContent = programName;
            summaryVenueName.textContent = venueName;
            summaryDistrict.textContent = district;
            summaryDatetime.textContent = `${day} günü, saat ${time}`;

            // F. TOGGLE VIEW (HIDE Form/Hero, SHOW Success Screen)
            heroSection.classList.add('hidden');
            formSection.classList.add('hidden');
            successSection.classList.remove('hidden');

            // G. Scroll page to top immediately so success screen is perfectly in view
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Submission error:', error);
            showError('Öneriniz kaydedilirken bir veritabanı hatası oluştu: ' + (error.message || 'Lütfen bağlantınızı kontrol edip tekrar deneyin.'));
        }
    });

    // 3. Reset Form and Go Back to initial screen
    newSuggestionBtn.addEventListener('click', () => {
        // Reset form inputs
        suggestionForm.reset();

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
