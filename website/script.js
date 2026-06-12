/* ================================================================
   AI INTERVIEW SYSTEM — ADVERTISEMENT WEBSITE SCRIPTS
   Handles: Navigation, Scroll Animations, Counter Animation,
            Mobile Menu, Form Handling, Smooth Interactions
   ================================================================ */

(function () {
    'use strict';

    // ---- DOM Ready ----
    document.addEventListener('DOMContentLoaded', init);

    // Apply theme BEFORE DOMContentLoaded to prevent flash
    (function applyStoredTheme() {
        var stored = localStorage.getItem('ai-interview-theme');
        if (stored === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    })();

    function init() {
        initThemeToggle();
        initNavbar();
        initMobileMenu();
        initScrollReveal();
        initCounterAnimation();
        initSmoothScroll();
        initContactForm();
        initParallaxCards();
    }


    /* ==========================
       THEME TOGGLE
       ========================== */
    function initThemeToggle() {
        var toggleBtn = document.getElementById('theme-toggle');
        var toggleBtnMobile = document.getElementById('theme-toggle-mobile');
        var currentTheme = localStorage.getItem('ai-interview-theme') || 'dark';

        function setTheme(theme) {
            if (theme === 'light') {
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            localStorage.setItem('ai-interview-theme', theme);
            currentTheme = theme;
        }

        function toggleTheme() {
            var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
        }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleTheme);
        }

        if (toggleBtnMobile) {
            toggleBtnMobile.addEventListener('click', toggleTheme);
        }
    }


    /* ==========================
       NAVBAR SCROLL EFFECT
       ========================== */
    function initNavbar() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;

        let lastScroll = 0;

        function handleScroll() {
            const currentScroll = window.scrollY;

            if (currentScroll > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }

            lastScroll = currentScroll;
        }

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial check
    }


    /* ==========================
       MOBILE MENU
       ========================== */
    function initMobileMenu() {
        const hamburger = document.getElementById('hamburger');
        const mobileMenu = document.getElementById('mobile-menu');

        if (!hamburger || !mobileMenu) return;

        hamburger.addEventListener('click', function () {
            hamburger.classList.toggle('active');
            mobileMenu.classList.toggle('open');
            document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
        });

        // Close on link click
        const mobileLinks = mobileMenu.querySelectorAll('.mobile-link');
        mobileLinks.forEach(function (link) {
            link.addEventListener('click', function () {
                hamburger.classList.remove('active');
                mobileMenu.classList.remove('open');
                document.body.style.overflow = '';
            });
        });

        // Close on clicking action buttons
        const mobileActions = mobileMenu.querySelectorAll('.btn');
        mobileActions.forEach(function (btn) {
            btn.addEventListener('click', function () {
                hamburger.classList.remove('active');
                mobileMenu.classList.remove('open');
                document.body.style.overflow = '';
            });
        });
    }


    /* ==========================
       SCROLL REVEAL ANIMATION
       ========================== */
    function initScrollReveal() {
        // Add 'reveal' class to elements that should animate on scroll
        const selectors = [
            '.feature-card',
            '.step-item',
            '.tech-card',
            '.testimonial-card',
            '.pricing-card',
            '.contact-info-item',
            '.contact-form',
            '.section-header'
        ];

        const elements = document.querySelectorAll(selectors.join(', '));
        elements.forEach(function (el) {
            el.classList.add('reveal');
        });

        // Intersection Observer
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -80px 0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    // Stagger animations for siblings
                    const parent = entry.target.parentElement;
                    const siblings = parent.querySelectorAll('.reveal');
                    let delay = 0;

                    siblings.forEach(function (sib) {
                        if (sib === entry.target || isElementInViewport(sib)) {
                            sib.style.transitionDelay = delay + 'ms';
                            sib.classList.add('visible');
                            delay += 80;
                        }
                    });

                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        elements.forEach(function (el) {
            observer.observe(el);
        });
    }

    function isElementInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }


    /* ==========================
       COUNTER ANIMATION
       ========================== */
    function initCounterAnimation() {
        const counters = document.querySelectorAll('.stat-number[data-target]');
        if (!counters.length) return;

        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.5
        };

        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        counters.forEach(function (counter) {
            observer.observe(counter);
        });
    }

    function animateCounter(element) {
        const target = parseInt(element.getAttribute('data-target'), 10);
        const duration = 2000; // ms
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(eased * target);

            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = target;
            }
        }

        requestAnimationFrame(update);
    }


    /* ==========================
       SMOOTH SCROLL
       ========================== */
    function initSmoothScroll() {
        // Handle all anchor links
        document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
            anchor.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;

                const target = document.querySelector(targetId);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }


    /* ==========================
       CONTACT FORM
       ========================== */
    function initContactForm() {
        const form = document.getElementById('contact-form');
        if (!form) return;

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalContent = submitBtn.innerHTML;

            // Show loading state
            submitBtn.innerHTML = '<span>Sending...</span>';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';

            // Simulate form submission
            setTimeout(function () {
                submitBtn.innerHTML = '<span style="color:#22c55e;">✓ Message Sent!</span>';
                submitBtn.style.opacity = '1';

                // Reset form
                form.reset();

                // Restore button after delay
                setTimeout(function () {
                    submitBtn.innerHTML = originalContent;
                    submitBtn.disabled = false;
                }, 3000);
            }, 1500);
        });
    }


    /* ==========================
       PARALLAX FLOATING CARDS
       ========================== */
    function initParallaxCards() {
        const heroSection = document.getElementById('hero');
        if (!heroSection) return;

        const cards = heroSection.querySelectorAll('.floating-card');
        if (!cards.length) return;

        heroSection.addEventListener('mousemove', function (e) {
            const rect = heroSection.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;

            cards.forEach(function (card, index) {
                const speed = (index + 1) * 8;
                const translateX = x * speed;
                const translateY = y * speed;

                card.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px)';
            });
        });

        heroSection.addEventListener('mouseleave', function () {
            cards.forEach(function (card) {
                card.style.transform = 'translate(0, 0)';
                card.style.transition = 'transform 0.5s ease-out';
            });
        });

        heroSection.addEventListener('mouseenter', function () {
            cards.forEach(function (card) {
                card.style.transition = 'transform 0.15s ease-out';
            });
        });
    }

})();
