document.addEventListener('DOMContentLoaded', async () => {
    const publicPages = new Set(['index.html', 'login.html', 'join.html']);
    const currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

    const enforceProfileAccess = async () => {
        if (publicPages.has(currentPage)) {
            return true;
        }

        if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_KEY) {
            return true;
        }

        try {
            const { createClient } = window.supabase;
            const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

            const { data: userData, error: userError } = await supabaseClient.auth.getUser();
            const user = userData?.user;

            if (userError || !user) {
                window.location.href = 'login.html';
                return false;
            }

            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('id, username')
                .eq('id', user.id)
                .maybeSingle();

            const hasValidProfile = profile && profile.id && profile.username && profile.username.trim().length > 0;
            if (profileError || !hasValidProfile) {
                await supabaseClient.auth.signOut();
                window.location.href = 'login.html';
                return false;
            }

            return true;
        } catch (error) {
            console.error('Access check error:', error);
            window.location.href = 'login.html';
            return false;
        }
    };

    const canAccessPage = await enforceProfileAccess();
    if (!canAccessPage) {
        return;
    }

    const hamburgerBtn = document.getElementById('hamburger-btn')
        || document.getElementById('hamburger')
        || document.querySelector('.hamburger-btn');

    const hamburgerMenu = document.getElementById('hamburger-menu')
        || document.querySelector('.hamburger-menu');

    if (hamburgerBtn && hamburgerMenu) {
        hamburgerBtn.addEventListener('click', function() {
            hamburgerBtn.classList.toggle('active');
            hamburgerMenu.classList.toggle('active');
        });
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                const { createClient } = window.supabase;
                const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
                await supabaseClient.auth.signOut();
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = 'index.html';
            }
        });
    }
});