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
});