// Core Dashboard Logic for KiranaWala Day 3 & Elevated Editorial Discovery

document.addEventListener('DOMContentLoaded', initializeDashboard);

let map = null;
let userLat = null;
let userLng = null;
const DEFAULT_RADIUS_KM = 8;

let currentStores = [];
let currentHasDistance = false;
let activeCategory = 'all';
let searchQuery = '';

const STORE_FALLBACK_IMAGES = [
    '/images/store-background.jpg',
    '/images/essentials-editorial.jpg',
    '/images/shopkeeper-community.jpg',
    '/images/doorstep-delivery.jpg'
];

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function initializeDashboard() {
    showSkeletonLoader();
    setupDiscoveryControls();

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/customer/login';
        return;
    }

    loadCartCount(token);
    await requestUserLocation();
}

function setupDiscoveryControls() {
    const searchInput = document.getElementById('store-search-input');
    const searchClear = document.getElementById('store-search-clear');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            if (searchClear) {
                searchClear.style.display = searchQuery ? 'block' : 'none';
            }
            filterAndRenderStores();
        });
    }

    if (searchClear && searchInput) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            searchClear.style.display = 'none';
            searchInput.focus();
            filterAndRenderStores();
        });
    }

    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeCategory = chip.getAttribute('data-category') || 'all';
            filterAndRenderStores();
        });
    });
}

async function loadCartCount(token) {
    try {
        const badge = document.getElementById('nav-cart-badge');
        if (!badge) return;

        const res = await fetch('/api/customer/cart', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const count = Array.isArray(data.items)
                ? data.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
                : 0;
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (err) {
        console.warn('Could not load cart count:', err);
    }
}

// ─── Geolocation ─────────────────────────────────────────────────────────────

function updateLocationStatus(text, isWarning) {
    const statusEl = document.getElementById('location-status');
    if (!statusEl) return;

    statusEl.innerHTML = '';

    const dot = document.createElement('span');
    dot.className = 'status-pulse-dot';

    const textNode = document.createElement('span');
    textNode.id = 'location-status-text';
    textNode.textContent = `📍 ${text}`;

    statusEl.appendChild(dot);
    statusEl.appendChild(textNode);

    if (isWarning) {
        statusEl.classList.add('warning');
    } else {
        statusEl.classList.remove('warning');
    }
}

async function requestUserLocation() {
    updateLocationStatus('Detecting location...', false);

    if (!navigator.geolocation) {
        updateLocationStatus('Geolocation not supported', true);
        showMapPlaceholder();
        await fetchStoresFallback();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            userLat = position.coords.latitude;
            userLng = position.coords.longitude;

            updateLocationStatus('Using your current location', false);

            showMap();
            initMap(userLat, userLng);
            await fetchNearbyStores();
        },
        async (error) => {
            console.warn('Geolocation error:', error);
            updateLocationStatus('Location access needed — showing all stores', true);
            showMapPlaceholder();
            await fetchStoresFallback();
        },
        { timeout: 10000 }
    );
}

// ─── Map Visibility Helpers ───────────────────────────────────────────────────

function showMap() {
    const mapSection = document.getElementById('map-section');
    const placeholder = document.getElementById('map-placeholder');
    if (mapSection) mapSection.hidden = false;
    if (placeholder) placeholder.hidden = true;
}

function showMapPlaceholder() {
    const mapSection = document.getElementById('map-section');
    const placeholder = document.getElementById('map-placeholder');
    if (mapSection) mapSection.hidden = true;
    if (placeholder) placeholder.hidden = false;
}

// ─── Leaflet Map ─────────────────────────────────────────────────────────────

function initMap(lat, lng) {
    // Guard: never init twice
    if (map) return;

    map = L.map('map').setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // User location marker
    L.circleMarker([lat, lng], {
        color: '#0052FF',
        fillColor: '#3B82F6',
        fillOpacity: 0.9,
        radius: 8,
        weight: 3
    }).addTo(map).bindPopup('<strong>📍 You are here</strong>').openPopup();
}

function plotStoreMarkers(stores) {
    if (!map) return;

    const bounds = [];
    if (userLat && userLng) {
        bounds.push([userLat, userLng]);
    }

    stores.forEach(store => {
        if (store.location && store.location.coordinates) {
            const [lng, lat] = store.location.coordinates;
            bounds.push([lat, lng]);

            const storeName = store.name || 'Store';
            const distance = formatDistance(store.distance);

            // XSS-safe popup content via DOM API
            const popupContent = document.createElement('div');

            const strong = document.createElement('strong');
            strong.textContent = storeName;

            const p = document.createElement('p');
            p.textContent = `${store.category || 'General'}${distance ? ' · ' + distance : ''}`;
            p.style.margin = '4px 0 8px 0';
            p.style.fontSize = '0.85rem';
            p.style.color = '#475569';

            const btn = document.createElement('a');
            btn.href = 'javascript:void(0)';
            btn.textContent = 'View Products →';
            btn.onclick = () => viewProducts(store._id);

            popupContent.appendChild(strong);
            popupContent.appendChild(p);
            popupContent.appendChild(btn);

            L.marker([lat, lng])
             .addTo(map)
             .bindPopup(popupContent);
        }
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// ─── API Fetching ─────────────────────────────────────────────────────────────

async function fetchNearbyStores() {
    try {
        const token = localStorage.getItem('token');
        const url = `/api/customer/stores/nearby?latitude=${userLat}&longitude=${userLng}&radiusKm=${DEFAULT_RADIUS_KM}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const stores = await response.json();

        if (stores.length === 0) {
            updateLocationStatus('Showing all verified partner stores', true);
            await fetchStoresFallback();
        } else {
            renderStores(stores, true); // true = distances available
            plotStoreMarkers(stores);
        }

    } catch (error) {
        console.error('Error fetching nearby stores:', error);
        showErrorState();
    }
}

// Fallback: location denied or 0 stores in radius — uses /api/customer/stores
async function fetchStoresFallback() {
    try {
        const token = localStorage.getItem('token');

        const response = await fetch('/api/customer/stores', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Fallback API returned ${response.status}`);
        }

        const stores = await response.json();

        if (!Array.isArray(stores) || stores.length === 0) {
            showEmptyState();
        } else {
            renderStores(stores, false); // false = no distances available
            plotStoreMarkers(stores);
        }

    } catch (error) {
        console.error('Error fetching fallback stores:', error);
        showErrorState();
    }
}

// ─── Rendering & Filtering ───────────────────────────────────────────────────

function renderStores(stores, hasDistance) {
    currentStores = Array.isArray(stores) ? stores : [];
    currentHasDistance = Boolean(hasDistance);
    filterAndRenderStores();
}

function filterAndRenderStores() {
    const container = document.getElementById('stores-container');
    if (!container) return;

    let filtered = currentStores.slice();

    // 1. Category filter
    if (activeCategory !== 'all') {
        filtered = filtered.filter(store => {
            const cat = (store.category || '').toLowerCase();
            if (activeCategory === 'general') {
                return cat.includes('general') || cat.includes('kirana') || cat.includes('grocery') || cat.includes('groceries');
            }
            if (activeCategory === 'spices') {
                return cat.includes('spice') || cat.includes('grain') || cat.includes('produce');
            }
            if (activeCategory === 'dairy') {
                return cat.includes('dairy') || cat.includes('milk') || cat.includes('daily') || cat.includes('essential');
            }
            return cat.includes(activeCategory);
        });
    }

    // 2. Search query filter
    if (searchQuery) {
        filtered = filtered.filter(store => {
            const name = (store.name || '').toLowerCase();
            const desc = (store.description || '').toLowerCase();
            const cat = (store.category || '').toLowerCase();
            return name.includes(searchQuery) || desc.includes(searchQuery) || cat.includes(searchQuery);
        });
    }

    // Update count badge
    const countBadge = document.getElementById('stores-count-badge');
    if (countBadge) {
        const total = filtered.length;
        countBadge.textContent = `${total} store${total === 1 ? '' : 's'} available`;
    }

    container.innerHTML = '';

    if (filtered.length === 0) {
        const div = document.createElement('div');
        div.className = 'state-message';
        const h3 = document.createElement('h3');
        h3.textContent = 'No matching stores found';
        const p = document.createElement('p');
        p.textContent = searchQuery
            ? `No stores matched "${searchQuery}". Try clearing filters or changing search keywords.`
            : 'No stores available in this category.';
        div.appendChild(h3);
        div.appendChild(p);
        container.appendChild(div);
        return;
    }

    filtered.forEach((store, index) => {
        container.appendChild(createStoreCard(store, currentHasDistance, index));
    });
}

/**
 * Creates an elevated store card with 16:9 illustrated header, badges, and smooth CTA.
 * (Preserves all contract classes: .premium-store-card, .card-header, .store-name, .store-category, .card-body, .card-footer, .btn-premium)
 */
function createStoreCard(storeData, hasDistance, index = 0) {
    const storeName = storeData.name ||
        (storeData.owner && storeData.owner.username
            ? `${storeData.owner.username}'s Store`
            : 'Neighborhood Kirana');
    const category = storeData.category || 'General Kirana';
    const description = storeData.description || 'Verified local neighborhood grocery store with daily fresh essentials.';

    const distanceMeters = (hasDistance && typeof storeData.distance === 'number')
        ? storeData.distance
        : null;
    const distanceFormatted = distanceMeters !== null
        ? formatDistance(distanceMeters)
        : null;

    // Outer Card
    const card = document.createElement('article');
    card.className = 'premium-store-card';
    card.setAttribute('aria-label', storeName);

    // 1. Illustrated 16:9 Media Header Frame
    const mediaFrame = document.createElement('div');
    mediaFrame.className = 'card-media-frame';

    const img = document.createElement('img');
    img.className = 'store-thumbnail-img';
    // Fallback image rotation based on index or category
    const imageSrc = (storeData.image && !storeData.image.includes('example.com'))
        ? storeData.image
        : STORE_FALLBACK_IMAGES[index % STORE_FALLBACK_IMAGES.length];
    img.src = imageSrc;
    img.alt = `${storeName} Storefront`;
    img.loading = 'lazy';
    mediaFrame.appendChild(img);

    // Category Chip on Image
    const catChip = document.createElement('span');
    catChip.className = 'card-category-chip';
    catChip.textContent = category;
    mediaFrame.appendChild(catChip);

    // Distance/Speed Chip on Image
    if (distanceFormatted !== null) {
        const delChip = document.createElement('span');
        delChip.className = 'card-delivery-chip';
        delChip.textContent = `⚡ 15–20 min • ${distanceFormatted}`;
        mediaFrame.appendChild(delChip);
    } else {
        const verifiedPartner = document.createElement('span');
        verifiedPartner.className = 'card-delivery-chip';
        verifiedPartner.textContent = '📍 Local Partner';
        mediaFrame.appendChild(verifiedPartner);
    }

    // 2. Card Header
    const header = document.createElement('div');
    header.className = 'card-header';

    const nameCatDiv = document.createElement('div');
    nameCatDiv.className = 'store-name-cat';

    const h3 = document.createElement('h3');
    h3.className = 'store-name';
    h3.textContent = storeName;

    // Verified checkmark
    const verified = document.createElement('span');
    verified.className = 'verified-icon';
    verified.title = 'Verified Merchant';
    verified.textContent = '✓';
    h3.appendChild(verified);

    const catEl = document.createElement('div');
    catEl.className = 'store-category';
    catEl.textContent = category;

    nameCatDiv.appendChild(h3);
    nameCatDiv.appendChild(catEl);
    header.appendChild(nameCatDiv);

    if (distanceFormatted !== null) {
        const distBadge = document.createElement('div');
        distBadge.className = 'store-distance';
        distBadge.textContent = distanceFormatted;
        header.appendChild(distBadge);
    }

    // 3. Card Body
    const body = document.createElement('div');
    body.className = 'card-body';

    const pDesc = document.createElement('p');
    pDesc.className = 'card-desc';
    pDesc.textContent = description;
    body.appendChild(pDesc);

    const perks = document.createElement('div');
    perks.className = 'store-features-row';
    perks.innerHTML = '<span class="feature-pill">⚡ Fast Local Delivery</span><span class="feature-pill">🛡️ Fresh Daily Stock</span>';
    body.appendChild(perks);

    // 4. Card Footer
    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const btn = document.createElement('button');
    btn.className = 'btn-premium';
    btn.innerHTML = 'Browse Store <span class="btn-arrow" aria-hidden="true">→</span>';
    btn.onclick = () => viewProducts(storeData._id);
    footer.appendChild(btn);

    // Assembly
    card.appendChild(mediaFrame);
    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    return card;
}

// ─── State Displays ───────────────────────────────────────────────────────────

function showSkeletonLoader() {
    const container = document.getElementById('stores-container');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 3; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-card';

        const thumb = document.createElement('div');
        thumb.className = 'skel-thumb';
        skeleton.appendChild(thumb);

        const skelBody = document.createElement('div');
        skelBody.className = 'skel-body';

        ['skel-line h1', 'skel-line h2', 'skel-line h3', 'skel-line btn'].forEach(cls => {
            const line = document.createElement('div');
            line.className = cls;
            skelBody.appendChild(line);
        });

        skeleton.appendChild(skelBody);
        container.appendChild(skeleton);
    }
}

function showEmptyState() {
    const container = document.getElementById('stores-container');
    if (!container) return;
    container.innerHTML = '';

    const countBadge = document.getElementById('stores-count-badge');
    if (countBadge) countBadge.textContent = '0 stores';

    const div = document.createElement('div');
    div.className = 'state-message';

    const h3 = document.createElement('h3');
    h3.textContent = 'No stores nearby yet';

    const p = document.createElement('p');
    p.textContent = 'We are expanding rapidly. Try adjusting your location or check again soon.';

    div.appendChild(h3);
    div.appendChild(p);
    container.appendChild(div);
}

function showErrorState() {
    const container = document.getElementById('stores-container');
    if (!container) return;
    container.innerHTML = '';

    const countBadge = document.getElementById('stores-count-badge');
    if (countBadge) countBadge.textContent = 'Error loading';

    const div = document.createElement('div');
    div.className = 'state-message';

    const h3 = document.createElement('h3');
    h3.textContent = 'Unable to load stores';

    const p = document.createElement('p');
    p.textContent = "We encountered a network error while fetching neighborhood stores.";

    const btn = document.createElement('button');
    btn.className = 'btn-retry';
    btn.innerHTML = '🔄 Try Again';
    btn.onclick = () => {
        showSkeletonLoader();
        if (userLat && userLng) {
            fetchNearbyStores();
        } else {
            fetchStoresFallback();
        }
    };

    div.appendChild(h3);
    div.appendChild(p);
    div.appendChild(btn);
    container.appendChild(div);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDistance(meters) {
    if (typeof meters !== 'number' || isNaN(meters)) return null;
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

function viewProducts(storeId) {
    window.location.href = `/customer/products?storeId=${storeId}`;
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/';
}