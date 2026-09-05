// Core Dashboard Logic for KiranaWala Day 3

document.addEventListener('DOMContentLoaded', initializeDashboard);

let map = null;
let userLat = null;
let userLng = null;
const DEFAULT_RADIUS_KM = 8;

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function initializeDashboard() {
    showSkeletonLoader();

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/customer/login';
        return;
    }

    await requestUserLocation();
}

// ─── Geolocation ─────────────────────────────────────────────────────────────

async function requestUserLocation() {
    const statusEl = document.getElementById('location-status');

    if (!navigator.geolocation) {
        statusEl.textContent = '📍 Geolocation not supported';
        statusEl.classList.add('warning');
        showMapPlaceholder();
        await fetchStoresFallback();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            userLat = position.coords.latitude;
            userLng = position.coords.longitude;

            statusEl.textContent = '📍 Using your current location';
            statusEl.classList.remove('warning');

            showMap();
            initMap(userLat, userLng);
            await fetchNearbyStores();
        },
        async (error) => {
            console.warn('Geolocation error:', error);
            statusEl.textContent = '📍 Location access needed — showing all stores';
            statusEl.classList.add('warning');
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
    // Guard: never init twice (protects against Retry re-triggering)
    if (map) return;

    map = L.map('map').setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // User location marker
    L.circleMarker([lat, lng], {
        color: '#1e3a8a',
        fillColor: '#3b82f6',
        fillOpacity: 0.8,
        radius: 8
    }).addTo(map).bindPopup('You are here').openPopup();
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
            p.style.margin = '4px 0';

            const btn = document.createElement('a');
            btn.href = 'javascript:void(0)';
            btn.textContent = 'View Products';
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
            showEmptyState();
        } else {
            renderStores(stores, true); // true = distances available
            plotStoreMarkers(stores);
        }

    } catch (error) {
        console.error('Error fetching nearby stores:', error);
        showErrorState();
    }
}

// Fallback: location denied — uses /api/customer/stores (confirmed to exist)
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
        }

    } catch (error) {
        console.error('Error fetching fallback stores:', error);
        showErrorState();
    }
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function renderStores(stores, hasDistance) {
    const container = document.getElementById('stores-container');
    container.innerHTML = '';

    stores.forEach(store => {
        container.appendChild(createStoreCard(store, hasDistance));
    });
}

/**
 * Creates a store card using safe DOM construction (XSS protection).
 * @param {object} storeData - store document from API
 * @param {boolean} hasDistance - whether to render a distance badge
 */
function createStoreCard(storeData, hasDistance) {
    // Safe data extraction with fallbacks
    const storeName = storeData.name ||
        (storeData.owner && storeData.owner.username
            ? `${storeData.owner.username}'s Store`
            : 'Unknown Store');
    const category = storeData.category || 'General';
    const description = storeData.description || 'Welcome to our store!';

    // Only display distance if the API actually provided a valid numeric value
    const distanceMeters = (hasDistance && typeof storeData.distance === 'number')
        ? storeData.distance
        : null;
    const distanceFormatted = distanceMeters !== null
        ? formatDistance(distanceMeters)
        : null;

    // ── DOM construction (XSS-safe: all user data via .textContent) ──
    const card = document.createElement('article');
    card.className = 'premium-store-card';
    // Accessible label without duplicating visible text
    card.setAttribute('aria-label', storeName);

    // Card header
    const header = document.createElement('div');
    header.className = 'card-header';

    const nameCatDiv = document.createElement('div');
    nameCatDiv.className = 'store-name-cat';

    const h3 = document.createElement('h3');
    h3.className = 'store-name';
    h3.textContent = storeName;

    const catEl = document.createElement('div');
    catEl.className = 'store-category';
    catEl.textContent = category;

    nameCatDiv.appendChild(h3);
    nameCatDiv.appendChild(catEl);
    header.appendChild(nameCatDiv);

    // Distance badge — only rendered if distance is known
    if (distanceFormatted !== null) {
        const distBadge = document.createElement('div');
        distBadge.className = 'store-distance';
        distBadge.textContent = distanceFormatted;
        header.appendChild(distBadge);
    }

    // Card body
    const body = document.createElement('div');
    body.className = 'card-body';

    const pDesc = document.createElement('p');
    pDesc.className = 'card-desc';
    pDesc.textContent = description;
    body.appendChild(pDesc);

    // Card footer
    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const btn = document.createElement('button');
    btn.className = 'btn-premium';
    btn.textContent = 'View Products';
    btn.onclick = () => viewProducts(storeData._id);
    footer.appendChild(btn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    return card;
}

// ─── State Displays ───────────────────────────────────────────────────────────

function showSkeletonLoader() {
    const container = document.getElementById('stores-container');
    container.innerHTML = '';

    for (let i = 0; i < 3; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-card';

        ['skel-line h1', 'skel-line h2', 'skel-line h3', 'skel-line btn'].forEach(cls => {
            const line = document.createElement('div');
            line.className = cls;
            skeleton.appendChild(line);
        });

        container.appendChild(skeleton);
    }
}

function showEmptyState() {
    const container = document.getElementById('stores-container');
    container.innerHTML = '';

    const div = document.createElement('div');
    div.className = 'state-message';

    const h3 = document.createElement('h3');
    h3.textContent = 'No stores nearby yet';

    const p = document.createElement('p');
    p.textContent = 'Try expanding your search radius or check again later.';

    div.appendChild(h3);
    div.appendChild(p);
    container.appendChild(div);
}

function showErrorState() {
    const container = document.getElementById('stores-container');
    container.innerHTML = '';

    const div = document.createElement('div');
    div.className = 'state-message';

    const h3 = document.createElement('h3');
    h3.textContent = 'Something went wrong';

    const p = document.createElement('p');
    p.textContent = "We couldn't load nearby stores right now.";

    const btn = document.createElement('button');
    btn.className = 'btn-retry';
    btn.textContent = 'Try Again';
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

/**
 * Formats a distance in meters to a readable string.
 * Returns null for invalid or missing values.
 */
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