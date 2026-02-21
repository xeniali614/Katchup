document.addEventListener('DOMContentLoaded', () => {
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
        logoutBtn.addEventListener('click', async () => {
            try {
                const { createClient } = window.supabase;
                const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
                await supabaseClient.auth.signOut();
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = 'login.html';
            }
        });
    }
});