const hamburgerBtn = document.getElementById('hamburger-btn');
const hamburgerMenu = document.getElementById('hamburger-menu');

if (hamburgerBtn && hamburgerMenu) {
    hamburgerBtn.addEventListener('click', function() {
        hamburgerBtn.classList.toggle('active');
        hamburgerMenu.classList.toggle('active');
    });
}