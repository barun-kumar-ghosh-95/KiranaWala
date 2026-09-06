/**
 * KiranaWala — Entry Experience Interactivity & Cinematic Motion Coordinator
 */

document.addEventListener('DOMContentLoaded', () => {
    initEntryMotion();
    initScrollCoordinator();
});

function initEntryMotion() {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
        document.querySelectorAll('.fade-up-init').forEach(el => {
            el.classList.add('fade-up-active');
        });
        if (window.Kirana3D && typeof window.Kirana3D.setReducedMotion === 'function') {
            window.Kirana3D.setReducedMotion(true);
        }
        return;
    }

    // Scroll reveal observer
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -50px 0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-up-active');
                obs.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-up-init').forEach(el => {
        observer.observe(el);
    });

    // Listen for system reduced-motion changes
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
        if (window.Kirana3D && typeof window.Kirana3D.setReducedMotion === 'function') {
            window.Kirana3D.setReducedMotion(e.matches);
        }
    });
}

function initScrollCoordinator() {
    let ticking = false;

    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
                const progress = totalHeight > 0 ? Math.max(0, Math.min(1, window.scrollY / totalHeight)) : 0;

                if (window.Kirana3D && typeof window.Kirana3D.onScroll === 'function') {
                    window.Kirana3D.onScroll(progress);
                }
                ticking = false;
            });
            ticking = true;
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    // Trigger initial progress
    onScroll();
}

