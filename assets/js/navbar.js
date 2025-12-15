(function() {
    'use strict';

    function getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/projects/')) {
            const parts = path.split('/').filter(p => p);
            const projectsIndex = parts.indexOf('projects');
            if (projectsIndex !== -1) {
                const depth = parts.length - projectsIndex - 1;
                return '../'.repeat(depth) || '../../';
            }
        }
        return '';
    }

    function createNavbar(config = {}) {
        const basePath = getBasePath();
        const { title, description } = config;
        
        const navBrand = title ? `
            <div class="nav-brand">
                <div class="nav-title">${title}</div>
                ${description ? `<div class="nav-description">${description}</div>` : ''}
            </div>
        ` : '';

        const navbarHTML = `
            <nav class="navbar">
                <div class="nav-container">
                    ${navBrand}
                    <div class="nav-links">
                        <a href="${basePath}index.html" class="nav-link">Home</a>
                        <a href="${basePath}projects.html" class="nav-link">Projects</a>
                        <a href="${basePath}contact.html" class="nav-link">Contact</a>
                    </div>
                    <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">
                        <svg class="theme-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="5" class="sun-circle"></circle>
                            <line x1="12" y1="1" x2="12" y2="3" class="sun-ray"></line>
                            <line x1="12" y1="21" x2="12" y2="23" class="sun-ray"></line>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" class="sun-ray"></line>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" class="sun-ray"></line>
                            <line x1="1" y1="12" x2="3" y2="12" class="sun-ray"></line>
                            <line x1="21" y1="12" x2="23" y2="12" class="sun-ray"></line>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" class="sun-ray"></line>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" class="sun-ray"></line>
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" class="moon-path"></path>
                        </svg>
                    </button>
                </div>
            </nav>
        `;

        const navbarContainer = document.getElementById('navbar-container') || document.body;
        if (navbarContainer === document.body) {
            navbarContainer.insertAdjacentHTML('afterbegin', navbarHTML);
        } else {
            navbarContainer.innerHTML = navbarHTML;
        }

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', function() {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
            });
        }

        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && (currentPath.endsWith(href) || currentPath.endsWith(href.replace('.html', '/')))) {
                link.classList.add('active');
            } else if (currentPath.includes('/projects/') && href && href.includes('projects.html')) {
                link.classList.add('active');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            const config = window.navbarConfig || {};
            createNavbar(config);
        });
    } else {
        const config = window.navbarConfig || {};
        createNavbar(config);
    }
})();

