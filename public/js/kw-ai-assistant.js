/**
 * KiranaWala — Customer AI Shopping Assistant
 *
 * Ultra-Premium, accessible frontend assistant layer.
 * Connects natural language customer queries with verified backend products,
 * live store discovery, and existing cart APIs.
 *
 * Security: NEVER includes API keys. Calls POST /api/customer/ai/chat with JWT.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------
  let isModalOpen = false;
  let isProcessing = false;
  let lastFocusedElement = null;
  let userLocation = null;
  let conversationContext = []; // Stores recent turns for short follow-ups

  const SUGGESTED_PROMPTS = [
    'Breakfast for 4 under ₹300',
    'Ingredients for chai',
    'Healthy snacks',
    'Dinner essentials'
  ];

  // ---------------------------------------------------------------------------
  // DOM Initialization
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', initAIAssistant);

  function initAIAssistant() {
    // Only mount for customer role users (token present)
    const token = localStorage.getItem('token');
    if (!token) return;

    injectStylesIfNeeded();
    createFloatingTrigger();
    createAssistantModal();
    setupGlobalListeners();
    obtainUserLocationIfAvailable();
  }

  function obtainUserLocationIfAvailable() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          };
        },
        () => {
          // Location unavailable or denied — proceed gracefully
          userLocation = null;
        },
        { timeout: 5000, maximumAge: 60000 }
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Floating Trigger & Entry Points
  // ---------------------------------------------------------------------------
  function createFloatingTrigger() {
    if (document.getElementById('kw-ai-trigger-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'kw-ai-trigger-btn';
    btn.className = 'kw-ai-trigger-fab';
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'Open KiranaWala AI Shopping Assistant');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML = `
      <span class="kw-ai-fab-sparkle" aria-hidden="true">✨</span>
      <span class="kw-ai-fab-label">Ask KiranaWala</span>
    `;

    btn.addEventListener('click', () => openAIAssistant());
    document.body.appendChild(btn);

    // Also attach listeners to any hero cards or prompt chips on page
    document.querySelectorAll('[data-ai-prompt]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const promptText = el.getAttribute('data-ai-prompt');
        if (promptText) {
          openAIAssistant(promptText);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Modal Drawer Construction
  // ---------------------------------------------------------------------------
  function createAssistantModal() {
    if (document.getElementById('kw-ai-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'kw-ai-modal-overlay';
    overlay.className = 'kw-ai-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'kw-ai-modal-title');
    overlay.style.display = 'none';

    overlay.innerHTML = `
      <div class="kw-ai-modal-drawer" id="kw-ai-modal-drawer" tabindex="-1">
        <!-- Header -->
        <header class="kw-ai-modal-header">
          <div class="kw-ai-header-title-group">
            <span class="kw-ai-header-icon" aria-hidden="true">✨</span>
            <div>
              <h2 id="kw-ai-modal-title" class="kw-ai-modal-title">Ask KiranaWala</h2>
              <span class="kw-ai-header-subtitle">AI Shopping Assistant</span>
            </div>
          </div>
          <button type="button" class="kw-ai-close-btn" id="kw-ai-close-btn" aria-label="Close Assistant">&times;</button>
        </header>

        <!-- Body Scroll Area -->
        <div class="kw-ai-modal-body" id="kw-ai-modal-body">
          <!-- Welcome / Idle Hero Banner -->
          <div class="kw-ai-welcome-card" id="kw-ai-welcome-card">
            <h3 class="kw-ai-welcome-heading">Need help finding something?</h3>
            <p class="kw-ai-welcome-text">Ask for recipe ingredients, meal planning under a budget, or daily staples from nearby stores.</p>
            
            <div class="kw-ai-prompts-label">Suggested Prompts:</div>
            <div class="kw-ai-prompt-chips" role="group" aria-label="Suggested Prompts">
              ${SUGGESTED_PROMPTS.map(
                (p) => `<button type="button" class="kw-ai-prompt-chip" data-prompt="${p}">${p}</button>`
              ).join('')}
            </div>
          </div>

          <!-- Chat History -->
          <div class="kw-ai-chat-history" id="kw-ai-chat-history" aria-live="polite"></div>

          <!-- Live Status Indicator (IDLE, THINKING, SEARCHING, RESULTS, ERROR) -->
          <div class="kw-ai-status-bar" id="kw-ai-status-bar" style="display:none;" aria-live="polite">
            <span class="kw-ai-status-pulse"></span>
            <span id="kw-ai-status-text">Searching local kirana stores...</span>
          </div>

          <!-- Verified Products Section -->
          <section class="kw-ai-products-section" id="kw-ai-products-section" style="display:none;" aria-label="Recommended Products">
            <div class="kw-ai-products-header">
              <span class="kw-ai-products-title">Verified Nearby Recommendations</span>
              <span id="kw-ai-subtotal-badge" class="kw-ai-subtotal-badge">Total: ₹0</span>
            </div>
            
            <div class="kw-ai-products-actions" id="kw-ai-add-all-wrapper" style="display:none;">
              <button type="button" class="kw-ai-btn-add-all" id="kw-ai-btn-add-all">
                🛒 Add All Items to Cart
              </button>
            </div>

            <div class="kw-ai-products-grid" id="kw-ai-products-grid"></div>
          </section>
        </div>

        <!-- Footer Input Bar -->
        <footer class="kw-ai-modal-footer">
          <form id="kw-ai-form" class="kw-ai-form" onsubmit="return false;">
            <input 
              type="text" 
              id="kw-ai-input" 
              class="kw-ai-input" 
              placeholder="Ask for meal ideas, items under ₹300, chai ingredients..."
              aria-label="Ask KiranaWala AI"
              maxlength="2000"
              autocomplete="off"
            />
            <button type="button" id="kw-ai-send-btn" class="kw-ai-send-btn" aria-label="Send query">
              <span>Send</span>
              <span class="kw-ai-send-icon" aria-hidden="true">→</span>
            </button>
          </form>
        </footer>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event Bindings
    document.getElementById('kw-ai-close-btn').addEventListener('click', closeAIAssistant);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAIAssistant();
    });

    const form = document.getElementById('kw-ai-form');
    const input = document.getElementById('kw-ai-input');
    const sendBtn = document.getElementById('kw-ai-send-btn');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendQuery();
    });
    sendBtn.addEventListener('click', handleSendQuery);

    // Delegate prompt chip clicks
    overlay.querySelectorAll('.kw-ai-prompt-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-prompt');
        if (text) {
          input.value = text;
          handleSendQuery();
        }
      });
    });
  }

  function setupGlobalListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeAIAssistant();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Open / Close Modal Logic
  // ---------------------------------------------------------------------------
  function openAIAssistant(initialQuery = '') {
    lastFocusedElement = document.activeElement;
    isModalOpen = true;

    const overlay = document.getElementById('kw-ai-modal-overlay');
    const drawer = document.getElementById('kw-ai-modal-drawer');
    const input = document.getElementById('kw-ai-input');

    if (!overlay || !drawer) return;

    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      overlay.classList.add('kw-ai-overlay-active');
      drawer.classList.add('kw-ai-drawer-active');
    });

    if (input) {
      if (initialQuery) {
        input.value = initialQuery;
        handleSendQuery();
      } else {
        input.focus();
      }
    }
  }

  function closeAIAssistant() {
    isModalOpen = false;
    const overlay = document.getElementById('kw-ai-modal-overlay');
    const drawer = document.getElementById('kw-ai-modal-drawer');

    if (overlay && drawer) {
      overlay.classList.remove('kw-ai-overlay-active');
      drawer.classList.remove('kw-ai-drawer-active');
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 250);
    }

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  // ---------------------------------------------------------------------------
  // Send Query Flow
  // ---------------------------------------------------------------------------
  async function handleSendQuery() {
    const input = document.getElementById('kw-ai-input');
    if (!input || isProcessing) return;

    const query = input.value.trim();
    if (!query) return;

    input.value = '';
    isProcessing = true;

    // Append User Message to Chat History
    appendChatMessage('user', query);
    conversationContext.push({ role: 'user', content: query });

    // Update UI Status: THINKING -> SEARCHING
    setStatusState('SEARCHING', 'Searching KiranaWala database...');

    try {
      const token = localStorage.getItem('token');
      const payload = {
        message: query,
        context: {
          ...(userLocation || {}),
          conversationHistory: conversationContext.slice(-4) // Keep last 4 turns
        }
      };

      const res = await fetch('/api/customer/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        setStatusState('ERROR', 'Session expired. Please sign in again.');
        showToast('Please login to use KiranaWala AI', 'error');
        setTimeout(() => { window.location.href = '/customer/login'; }, 1500);
        return;
      }

      if (res.status === 403) {
        setStatusState('ERROR', 'Access denied: Customer account required.');
        showToast('AI Shopping Assistant is only available for customer accounts', 'error');
        return;
      }

      if (res.status === 503) {
        setStatusState('ERROR', 'AI Assistant is temporarily offline. Please try later.');
        appendChatMessage('assistant', 'The AI assistant is temporarily offline. Please check back shortly!');
        return;
      }

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      
      // Append AI Response Text
      appendChatMessage('assistant', data.message || 'Here are the recommended items from nearby stores:');
      conversationContext.push({ role: 'assistant', content: data.message });

      // Render Verified Backend Products
      const verifiedProducts = Array.isArray(data.products) ? data.products : [];
      renderRecommendedProducts(verifiedProducts);

      setStatusState('IDLE', '');

    } catch (err) {
      console.error('[kw-ai-assistant] Query error:', err);
      setStatusState('ERROR', 'Unable to reach AI Assistant. Please check connection.');
      appendChatMessage('assistant', 'Sorry, I encountered an issue connecting to local stores. Please try again.');
    } finally {
      isProcessing = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Status Bar State Handler
  // ---------------------------------------------------------------------------
  function setStatusState(state, text) {
    const statusBar = document.getElementById('kw-ai-status-bar');
    const statusText = document.getElementById('kw-ai-status-text');

    if (!statusBar || !statusText) return;

    if (state === 'IDLE' || !text) {
      statusBar.style.display = 'none';
      return;
    }

    statusBar.style.display = 'flex';
    statusBar.className = `kw-ai-status-bar kw-ai-status-${state.toLowerCase()}`;
    statusText.textContent = text;
  }

  // ---------------------------------------------------------------------------
  // Chat History Renderer
  // ---------------------------------------------------------------------------
  function appendChatMessage(sender, text) {
    const history = document.getElementById('kw-ai-chat-history');
    const welcome = document.getElementById('kw-ai-welcome-card');

    if (welcome) welcome.style.display = 'none';
    if (!history) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `kw-ai-msg kw-ai-msg-${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'kw-ai-msg-bubble';
    bubble.textContent = text; // XSS-Safe textContent

    msgDiv.appendChild(bubble);
    history.appendChild(msgDiv);

    // Scroll to bottom
    const body = document.getElementById('kw-ai-modal-body');
    if (body) body.scrollTop = body.scrollHeight;
  }

  // ---------------------------------------------------------------------------
  // Verified Product Cards Renderer
  // ---------------------------------------------------------------------------
  function renderRecommendedProducts(products) {
    const section = document.getElementById('kw-ai-products-section');
    const grid = document.getElementById('kw-ai-products-grid');
    const subtotalBadge = document.getElementById('kw-ai-subtotal-badge');
    const addAllWrapper = document.getElementById('kw-ai-add-all-wrapper');
    const addAllBtn = document.getElementById('kw-ai-btn-add-all');

    if (!section || !grid) return;

    grid.innerHTML = '';

    if (!products || products.length === 0) {
      section.style.display = 'none';
      if (addAllWrapper) addAllWrapper.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    // Server-Verified Subtotal Calculation
    const totalVerifiedSubtotal = products.reduce(
      (sum, p) => sum + (typeof p.price === 'number' ? p.price : 0),
      0
    );

    if (subtotalBadge) {
      subtotalBadge.textContent = `Total: ₹${totalVerifiedSubtotal.toLocaleString('en-IN')}`;
    }

    // Configure "Add All" action button
    if (addAllWrapper && addAllBtn) {
      if (products.length > 1) {
        addAllWrapper.style.display = 'block';
        addAllBtn.onclick = () => handleAddAllToCart(products, addAllBtn);
      } else {
        addAllWrapper.style.display = 'none';
      }
    }

    products.forEach((product) => {
      grid.appendChild(createVerifiedProductCard(product));
    });

    const body = document.getElementById('kw-ai-modal-body');
    if (body) body.scrollTop = body.scrollHeight;
  }

  /**
   * Creates an XSS-safe Product Card reusing KiranaWala product-card-premium layout.
   */
  function createVerifiedProductCard(product) {
    const card = document.createElement('article');
    card.className = 'product-card-premium kw-ai-card';
    card.setAttribute('tabindex', '0');

    // 1. Image Wrapper
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'product-img-wrapper';

    const img = document.createElement('img');
    img.className = 'product-img';
    img.alt = product.name || 'Product';
    img.src = product.image || '/images/essentials-editorial.jpg';
    img.onerror = () => { img.src = '/images/essentials-editorial.jpg'; };
    imgWrapper.appendChild(img);

    // Stock Badge
    const stockBadge = document.createElement('span');
    const isAvail = product.available !== false && product.stock > 0;
    stockBadge.className = `stock-badge ${isAvail ? 'in-stock' : 'out-of-stock'}`;
    stockBadge.textContent = isAvail ? (product.stock <= 5 ? `Low Stock (${product.stock})` : 'In Stock') : 'Out of Stock';
    imgWrapper.appendChild(stockBadge);

    // 2. Content Body
    const content = document.createElement('div');
    content.className = 'product-content';

    const tagsRow = document.createElement('div');
    tagsRow.className = 'kw-ai-tags-row';

    const catBadge = document.createElement('span');
    catBadge.className = 'product-category-tag';
    catBadge.textContent = product.category || 'General';
    tagsRow.appendChild(catBadge);

    if (product.store && product.store.name) {
      const storeBadge = document.createElement('span');
      storeBadge.className = 'kw-ai-store-tag';
      storeBadge.textContent = `🏪 ${product.store.name}`;
      tagsRow.appendChild(storeBadge);
    }
    content.appendChild(tagsRow);

    const title = document.createElement('h3');
    title.className = 'product-title';
    title.textContent = product.name || 'Product';
    content.appendChild(title);

    if (product.description) {
      const desc = document.createElement('p');
      desc.className = 'product-desc';
      desc.textContent = product.description;
      content.appendChild(desc);
    }

    // 3. Footer Price & Add Button
    const footer = document.createElement('div');
    footer.className = 'product-footer';

    const price = document.createElement('div');
    price.className = 'product-price';
    price.textContent = `₹${(product.price || 0).toLocaleString('en-IN')}`;
    footer.appendChild(price);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-cart';
    addBtn.textContent = isAvail ? 'Add to Cart' : 'Unavailable';
    if (!isAvail) {
      addBtn.disabled = true;
      addBtn.classList.add('disabled');
    } else {
      addBtn.onclick = (e) => {
        e.stopPropagation();
        handleSingleAddToCart(product, addBtn);
      };
    }
    footer.appendChild(addBtn);

    card.appendChild(imgWrapper);
    card.appendChild(content);
    card.appendChild(footer);

    return card;
  }

  // ---------------------------------------------------------------------------
  // Cart Actions & Single-Store Enforcement
  // ---------------------------------------------------------------------------

  async function handleSingleAddToCart(product, btnElement) {
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Please sign in to add products to your cart', 'warning');
      return;
    }

    if (btnElement) {
      btnElement.disabled = true;
      btnElement.textContent = 'Adding...';
    }

    try {
      const res = await fetch('/api/customer/cart/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId: product._id, quantity: 1 })
      });

      const data = await res.json();

      if (res.ok) {
        showToast(`Added "${product.name}" to your cart!`, 'success');
        updateHeaderCartBadge(data.items);
        if (btnElement) {
          btnElement.textContent = '✓ Added';
          setTimeout(() => {
            btnElement.disabled = false;
            btnElement.textContent = 'Add to Cart';
          }, 2000);
        }
      } else if (data.code === 'CROSS_STORE_CONFLICT') {
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.textContent = 'Add to Cart';
        }
        if (confirm(`${data.message}\n\nWould you like to clear your current cart to start shopping from ${product.store ? product.store.name : 'this store'}?`)) {
          await clearCart(token);
          await handleSingleAddToCart(product, btnElement);
        }
      } else {
        showToast(data.message || 'Could not add item to cart', 'error');
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.textContent = 'Add to Cart';
        }
      }
    } catch (err) {
      console.error('[kw-ai-assistant] Cart error:', err);
      showToast('Network error adding to cart', 'error');
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.textContent = 'Add to Cart';
      }
    }
  }

  async function handleAddAllToCart(products, buttonEl) {
    const token = localStorage.getItem('token');
    if (!token) return;

    const availableProducts = products.filter(p => p.available !== false && p.stock > 0);
    const unavailableCount = products.length - availableProducts.length;

    if (availableProducts.length === 0) {
      showToast('None of the recommended products are currently in stock.', 'warning');
      return;
    }

    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = 'Adding items...';
    }

    let addedCount = 0;
    let failedCount = unavailableCount;
    let crossStoreTriggered = false;

    for (const prod of availableProducts) {
      try {
        const res = await fetch('/api/customer/cart/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ productId: prod._id, quantity: 1 })
        });

        const data = await res.json();

        if (res.ok) {
          addedCount++;
          updateHeaderCartBadge(data.items);
        } else if (data.code === 'CROSS_STORE_CONFLICT') {
          crossStoreTriggered = true;
          if (confirm(`Cart Conflict: ${data.message}\n\nClear your current cart to add items from ${prod.store ? prod.store.name : 'this store'}?`)) {
            await clearCart(token);
            await handleAddAllToCart(products, buttonEl);
            return;
          } else {
            failedCount++;
            break;
          }
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error('Error adding batch item:', err);
        failedCount++;
      }
    }

    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = '🛒 Add All Items to Cart';
    }

    if (addedCount > 0) {
      if (failedCount > 0) {
        showToast(`${addedCount} item${addedCount === 1 ? '' : 's'} added. ${failedCount} item${failedCount === 1 ? '' : 's'} unavailable or out of stock.`, 'warning');
      } else {
        showToast(`Successfully added all ${addedCount} items to your cart!`, 'success');
      }
    } else if (!crossStoreTriggered) {
      showToast('Could not add recommended items to cart.', 'error');
    }
  }

  async function clearCart(token) {
    try {
      await fetch('/api/customer/cart', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.warn('Could not clear cart:', e);
    }
  }

  function updateHeaderCartBadge(items) {
    const badge = document.getElementById('nav-cart-badge') || document.getElementById('nav-cart-count');
    if (!badge) return;

    const count = Array.isArray(items) ? items.reduce((sum, i) => sum + (i.quantity || 1), 0) : 0;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function showToast(msg, type = 'info') {
    if (window.showToast) {
      window.showToast(msg, type);
    } else if (window.KwUI && window.KwUI.toast) {
      window.KwUI.toast(msg, type);
    } else {
      alert(msg);
    }
  }

  function injectStylesIfNeeded() {
    // Styles are included in styles.css
  }

  // Expose global controller
  window.KiranaWalaAI = {
    open: openAIAssistant,
    close: closeAIAssistant
  };

})();
