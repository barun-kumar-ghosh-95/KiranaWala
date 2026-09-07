/**
 * KiranaWala Ultra-Premium UI/UX Engine
 * Global experience layer: Toast notifications, form input layout audit,
 * micro-interactions, button state feedback, and skeleton management.
 */

(function () {
  'use strict';

  // Respect reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =========================================================================
  // 1. Toast Notification System
  // =========================================================================
  class ToastSystem {
    constructor() {
      this.container = null;
      this._init();
    }

    _init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._createContainer());
      } else {
        this._createContainer();
      }
    }

    _createContainer() {
      if (document.getElementById('kw-toast-container')) {
        this.container = document.getElementById('kw-toast-container');
        return;
      }
      this.container = document.createElement('div');
      this.container.id = 'kw-toast-container';
      this.container.className = 'kw-toast-container';
      this.container.setAttribute('role', 'region');
      this.container.setAttribute('aria-label', 'Notifications');
      document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 3500) {
      if (!this.container) this._createContainer();

      const toast = document.createElement('div');
      toast.className = `kw-toast kw-toast-${type}`;
      toast.setAttribute('role', 'alert');

      const iconSvg = this._getIcon(type);

      toast.innerHTML = `
        <div class="kw-toast-icon">${iconSvg}</div>
        <div class="kw-toast-message">${this._escape(message)}</div>
        <button class="kw-toast-close" aria-label="Dismiss">&times;</button>
        <div class="kw-toast-progress" style="animation-duration: ${duration}ms;"></div>
      `;

      const closeBtn = toast.querySelector('.kw-toast-close');
      closeBtn.addEventListener('click', () => this.dismiss(toast));

      this.container.appendChild(toast);

      // Trigger reflow for slide-in animation
      toast.offsetHeight;
      toast.classList.add('kw-toast-show');

      const timer = setTimeout(() => {
        this.dismiss(toast);
      }, duration);

      toast.addEventListener('mouseenter', () => {
        const progress = toast.querySelector('.kw-toast-progress');
        if (progress) progress.style.animationPlayState = 'paused';
        clearTimeout(timer);
      });

      toast.addEventListener('mouseleave', () => {
        const progress = toast.querySelector('.kw-toast-progress');
        if (progress) progress.style.animationPlayState = 'running';
        setTimeout(() => this.dismiss(toast), 1500);
      });
    }

    dismiss(toast) {
      if (!toast || toast.classList.contains('kw-toast-hiding')) return;
      toast.classList.remove('kw-toast-show');
      toast.classList.add('kw-toast-hiding');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }

    _getIcon(type) {
      switch (type) {
        case 'success':
          return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        case 'error':
          return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        case 'warning':
          return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        default:
          return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
      }
    }

    _escape(str) {
      const div = document.createElement('div');
      div.innerText = str;
      return div.innerHTML;
    }
  }

  window.KWToast = new ToastSystem();

  // =========================================================================
  // 2. Global Form Input Layout & Spacing Auditor
  // =========================================================================
  function initFormInputEnhancements() {
    // Audit all inputs across all forms
    const wrappers = document.querySelectorAll('.input-row, .auth-form-group, .form-group, .input-group');
    wrappers.forEach((wrapper) => {
      const input = wrapper.querySelector('input, select, textarea');
      if (!input) return;

      const leftIcon = wrapper.querySelector('.icon-box, .input-icon-left, .icon');
      if (leftIcon) {
        input.classList.add('kw-has-left-icon');
        wrapper.style.position = 'relative';
      }
    });

    // Handle Password Visibility Toggles
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach((input) => {
      if (input.dataset.hasToggle) return;
      input.dataset.hasToggle = 'true';
      input.classList.add('kw-has-right-toggle');

      const wrapper = input.parentElement;
      if (!wrapper) return;

      if (getComputedStyle(wrapper).position === 'static') {
        wrapper.style.position = 'relative';
      }

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'kw-password-toggle';
      toggleBtn.setAttribute('aria-label', 'Toggle password visibility');
      toggleBtn.setAttribute('tabindex', '-1');
      toggleBtn.innerHTML = `<svg class="kw-eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        toggleBtn.innerHTML = isPassword
          ? `<svg class="kw-eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
          : `<svg class="kw-eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      });

      wrapper.appendChild(toggleBtn);
    });
  }

  function initButtonFeedback() {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn && !submitBtn.dataset.noSpinner) {
        const originalText = submitBtn.innerHTML || submitBtn.value;
        submitBtn.dataset.originalContent = originalText;
        submitBtn.disabled = true;
        submitBtn.classList.add('kw-btn-loading');

        if (submitBtn.tagName === 'INPUT') {
          submitBtn.value = 'Processing...';
        } else {
          submitBtn.innerHTML = `<span class="kw-spinner"></span> <span>Processing...</span>`;
        }

        setTimeout(() => {
          if (submitBtn.disabled && submitBtn.classList.contains('kw-btn-loading')) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('kw-btn-loading');
            if (submitBtn.tagName === 'INPUT') {
              submitBtn.value = originalText;
            } else {
              submitBtn.innerHTML = originalText;
            }
          }
        }, 5000);
      }
    });
  }

  // =========================================================================
  // 3. Scroll Reveal Animation Engine
  // =========================================================================
  function initScrollReveals() {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-animate], .card, .product-card, .store-card, .stat-card').forEach((el) => {
        el.classList.add('kw-revealed');
      });
      return;
    }

    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const delay = (index % 6) * 60; // staggered delay in ms
          setTimeout(() => {
            el.classList.add('kw-revealed');
          }, delay);
          obs.unobserve(el);
        }
      });
    }, observerOptions);

    const targets = document.querySelectorAll('[data-animate], .card, .product-card, .store-card, .stat-card');
    targets.forEach((el) => {
      if (!el.classList.contains('kw-reveal-init')) {
        el.classList.add('kw-reveal-init');
        observer.observe(el);
      }
    });
  }

  // Helper for dynamic skeleton insertion
  window.KWSkeleton = {
    getStoreCards(count = 3) {
      let html = '';
      for (let i = 0; i < count; i++) {
        html += `
          <div class="store-card kw-skeleton-card">
            <div class="kw-skeleton-box" style="height: 180px; width: 100%; border-radius: 12px 12px 0 0;"></div>
            <div style="padding: 1.25rem;">
              <div class="kw-skeleton-box" style="height: 24px; width: 70%; margin-bottom: 12px;"></div>
              <div class="kw-skeleton-box" style="height: 16px; width: 45%; margin-bottom: 16px;"></div>
              <div class="kw-skeleton-box" style="height: 40px; width: 100%; border-radius: 8px;"></div>
            </div>
          </div>
        `;
      }
      return html;
    },
    getProductCards(count = 4) {
      let html = '';
      for (let i = 0; i < count; i++) {
        html += `
          <div class="product-card kw-skeleton-card">
            <div class="kw-skeleton-box" style="height: 160px; width: 100%; border-radius: 8px;"></div>
            <div style="padding: 1rem 0 0 0;">
              <div class="kw-skeleton-box" style="height: 20px; width: 80%; margin-bottom: 8px;"></div>
              <div class="kw-skeleton-box" style="height: 16px; width: 40%; margin-bottom: 12px;"></div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="kw-skeleton-box" style="height: 24px; width: 30%;"></div>
                <div class="kw-skeleton-box" style="height: 36px; width: 40%; border-radius: 6px;"></div>
              </div>
            </div>
          </div>
        `;
      }
      return html;
    }
  };

  // =========================================================================
  // 4. Initialization
  // =========================================================================
  function init() {
    initFormInputEnhancements();
    initButtonFeedback();
    initScrollReveals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
