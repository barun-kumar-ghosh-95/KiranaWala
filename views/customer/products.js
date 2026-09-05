/**
 * KiranaWala — Customer Product Discovery
 * Handlers for store context, product grid rendering, searching, filtering, and sorting.
 * XSS-Safe: All dynamic text content is injected via .textContent DOM nodes.
 */

document.addEventListener('DOMContentLoaded', () => {
    initProductDiscovery();
});

// State Management
let storeData = null;
let allProducts = [];
let currentCategory = 'All';
let searchQuery = '';
let currentSort = 'default';

async function initProductDiscovery() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('storeId');

    // Accessibility focus setup
    setupAccessibilityListeners();

    if (!storeId || !isValidObjectId(storeId)) {
        renderErrorState('Invalid or missing Store ID. Please select a valid store from the dashboard.');
        return;
    }

    await loadStoreProducts(storeId);
}

function isValidObjectId(id) {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

function setupAccessibilityListeners() {
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            applyFiltersAndRender();
        });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            applyFiltersAndRender();
        });
    }
}

async function loadStoreProducts(storeId) {
    renderLoadingState();
    updateLiveRegion('Loading store products...');

    try {
        const response = await fetch(`/api/customer/stores/${storeId}/products`);

        if (response.status === 404) {
            renderErrorState('Store not found. It may have been removed or is currently unavailable.');
            updateLiveRegion('Store not found.');
            return;
        }

        if (response.status === 400) {
            renderErrorState('Invalid store ID provided.');
            updateLiveRegion('Invalid store ID.');
            return;
        }

        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }

        const data = await response.json();
        storeData = data.store;
        allProducts = Array.isArray(data.products) ? data.products : [];

        renderStoreHeader(storeData);
        renderCategoryFilters(allProducts);
        applyFiltersAndRender();

        updateLiveRegion(`Loaded products for ${storeData.name}. Found ${allProducts.length} items.`);

    } catch (error) {
        console.error('Error fetching store products:', error);
        renderErrorState('Unable to load products. Please check your connection and try again.', () => loadStoreProducts(storeId));
        updateLiveRegion('Error loading products.');
    }
}

// ─── Rendering Functions ───────────────────────────────────────────────────────

function renderStoreHeader(store) {
    const nameEl = document.getElementById('store-name');
    const catEl = document.getElementById('store-category-badge');
    const descEl = document.getElementById('store-description');

    if (nameEl) nameEl.textContent = store.name || 'Store';
    if (catEl) catEl.textContent = store.category || 'General Kirana';
    if (descEl) descEl.textContent = store.description || 'Welcome to our store!';
}

function renderCategoryFilters(products) {
    const container = document.getElementById('category-filter-container');
    if (!container) return;

    // Extract unique categories
    const categories = ['All'];
    products.forEach(p => {
        if (p.category && !categories.includes(p.category)) {
            categories.push(p.category);
        }
    });

    container.innerHTML = ''; // Container reset for pills

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `filter-pill ${cat === currentCategory ? 'active' : ''}`;
        btn.textContent = cat;
        btn.setAttribute('type', 'button');
        btn.setAttribute('aria-pressed', cat === currentCategory ? 'true' : 'false');
        btn.onclick = () => {
            currentCategory = cat;
            // Update aria states
            container.querySelectorAll('.filter-pill').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            applyFiltersAndRender();
        };
        container.appendChild(btn);
    });
}

function applyFiltersAndRender() {
    let filtered = [...allProducts];

    // Category Filter
    if (currentCategory !== 'All') {
        filtered = filtered.filter(p => p.category === currentCategory);
    }

    // Search Query (Scoped strictly to store's products)
    if (searchQuery) {
        filtered = filtered.filter(p => {
            const name = (p.name || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            const cat = (p.category || '').toLowerCase();
            return name.includes(searchQuery) || desc.includes(searchQuery) || cat.includes(searchQuery);
        });
    }

    // Sorting
    if (currentSort === 'price-asc') {
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (currentSort === 'price-desc') {
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (currentSort === 'name-asc') {
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    renderProductGrid(filtered);
}

function renderProductGrid(products) {
    const grid = document.getElementById('products-grid');
    const resultCount = document.getElementById('results-count');

    if (!grid) return;
    grid.innerHTML = '';

    if (resultCount) {
        resultCount.textContent = `Showing ${products.length} product${products.length === 1 ? '' : 's'}`;
    }

    if (products.length === 0) {
        renderEmptyState();
        return;
    }

    products.forEach(product => {
        grid.appendChild(createProductCard(product));
    });
}

/**
 * Creates an XSS-safe Product Card DOM Element.
 */
function createProductCard(product) {
    const card = document.createElement('article');
    card.className = 'product-card-premium';
    card.setAttribute('tabindex', '0');

    // 1. Image / Icon Header
    const imgContainer = document.createElement('div');
    imgContainer.className = 'product-img-wrapper';

    const img = document.createElement('img');
    img.className = 'product-img';
    img.alt = product.name || 'Product Image';
    img.src = product.image || '';
    img.onerror = () => {
        // Safe fallback image handling
        img.style.display = 'none';
        const fallbackIcon = document.createElement('div');
        fallbackIcon.className = 'product-img-fallback';
        fallbackIcon.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
        `;
        imgContainer.appendChild(fallbackIcon);
    };
    imgContainer.appendChild(img);

    // Stock Badge
    const stockBadge = document.createElement('span');
    const stockVal = typeof product.stock === 'number' ? product.stock : 10;
    const isAvail = product.available !== false && stockVal > 0;

    if (!isAvail) {
        stockBadge.className = 'stock-badge out-of-stock';
        stockBadge.textContent = 'Out of Stock';
    } else if (stockVal <= 5) {
        stockBadge.className = 'stock-badge low-stock';
        stockBadge.textContent = `Low Stock (${stockVal} left)`;
    } else {
        stockBadge.className = 'stock-badge in-stock';
        stockBadge.textContent = 'In Stock';
    }
    imgContainer.appendChild(stockBadge);

    // 2. Card Content
    const content = document.createElement('div');
    content.className = 'product-content';

    const catBadge = document.createElement('span');
    catBadge.className = 'product-category-tag';
    catBadge.textContent = product.category || 'General';
    content.appendChild(catBadge);

    const title = document.createElement('h3');
    title.className = 'product-title';
    title.textContent = product.name || 'Unnamed Product';
    content.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'product-desc';
    desc.textContent = product.description || 'No description available.';
    content.appendChild(desc);

    // 3. Card Footer (Price & Action)
    const footer = document.createElement('div');
    footer.className = 'product-footer';

    const price = document.createElement('div');
    price.className = 'product-price';
    price.textContent = formatINR(product.price);
    footer.appendChild(price);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-cart';
    addBtn.textContent = isAvail ? 'Add to Cart' : 'Unavailable';
    if (!isAvail) {
        addBtn.disabled = true;
        addBtn.classList.add('disabled');
    } else {
        addBtn.title = 'Cart feature coming in Part 2';
        addBtn.onclick = () => {
            updateLiveRegion(`Added ${product.name} to cart selection.`);
            alert(`Added "${product.name}" to cart preview! (Cart checkout will be enabled in Part 2)`);
        };
    }
    footer.appendChild(addBtn);

    card.appendChild(imgContainer);
    card.appendChild(content);
    card.appendChild(footer);

    return card;
}

// ─── States ───────────────────────────────────────────────────────────────────

function renderLoadingState() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    grid.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'product-card-skeleton';
        grid.appendChild(skeleton);
    }
}

function renderEmptyState() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-products-state';

    const icon = document.createElement('div');
    icon.className = 'empty-icon';
    icon.textContent = '🛍️';
    emptyDiv.appendChild(icon);

    const title = document.createElement('h3');
    title.textContent = searchQuery || currentCategory !== 'All' 
        ? 'No matching products found' 
        : 'No products in this store yet';
    emptyDiv.appendChild(title);

    const p = document.createElement('p');
    p.textContent = searchQuery || currentCategory !== 'All'
        ? 'Try adjusting your search terms or clearing the category filter.'
        : 'This store has not listed any products for customer ordering yet.';
    emptyDiv.appendChild(p);

    if (searchQuery || currentCategory !== 'All') {
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn-reset-filters';
        resetBtn.textContent = 'Reset Filters & Search';
        resetBtn.onclick = () => {
            searchQuery = '';
            currentCategory = 'All';
            currentSort = 'default';
            const searchInput = document.getElementById('product-search');
            const sortSelect = document.getElementById('sort-select');
            if (searchInput) searchInput.value = '';
            if (sortSelect) sortSelect.value = 'default';
            renderCategoryFilters(allProducts);
            applyFiltersAndRender();
        };
        emptyDiv.appendChild(resetBtn);
    }

    grid.appendChild(emptyDiv);
}

function renderErrorState(message, retryCallback = null) {
    const grid = document.getElementById('products-grid');
    const headerContainer = document.getElementById('store-header-container');

    if (headerContainer) {
        const nameEl = document.getElementById('store-name');
        if (nameEl) nameEl.textContent = 'Store Unavailable';
    }

    if (!grid) return;
    grid.innerHTML = '';

    const errCard = document.createElement('div');
    errCard.className = 'error-products-card';

    const h3 = document.createElement('h3');
    h3.textContent = '⚠️ Unable to Load Products';
    errCard.appendChild(h3);

    const p = document.createElement('p');
    p.textContent = message;
    errCard.appendChild(p);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'error-btn-group';

    if (retryCallback) {
        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn-retry-products';
        retryBtn.textContent = 'Try Again';
        retryBtn.onclick = retryCallback;
        btnGroup.appendChild(retryBtn);
    }

    const backBtn = document.createElement('button');
    backBtn.className = 'btn-back-dashboard';
    backBtn.textContent = '← Back to Stores';
    backBtn.onclick = () => window.location.href = '/customer/dashboard';
    btnGroup.appendChild(backBtn);

    errCard.appendChild(btnGroup);
    grid.appendChild(errCard);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatINR(amount) {
    const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function updateLiveRegion(message) {
    const live = document.getElementById('accessibility-live-region');
    if (live) {
        live.textContent = message;
    }
}

function goBackToDashboard() {
    window.location.href = '/customer/dashboard';
}
