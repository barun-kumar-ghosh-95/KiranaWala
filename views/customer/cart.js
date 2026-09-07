/**
 * KiranaWala — Customer Cart Frontend Handlers
 */

document.addEventListener('DOMContentLoaded', () => {
    initCart();
});

let cartData = null;

async function initCart() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/customer/login';
        return;
    }

    await loadCart();
}

async function loadCart() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch('/api/customer/cart', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            window.location.href = '/customer/login';
            return;
        }

        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }

        cartData = await response.json();
        renderCart(cartData);

    } catch (error) {
        console.error('Error fetching cart:', error);
        updateLiveRegion('Error loading cart.');
        alert('Failed to load your cart. Please try again.');
    }
}

function renderCart(cart) {
    const items = cart.items || [];
    const countBadge = document.getElementById('cart-item-count');
    const storeBanner = document.getElementById('cart-store-banner');
    const contentWrapper = document.getElementById('cart-content-wrapper');
    const emptyState = document.getElementById('empty-cart-state');
    const container = document.getElementById('cart-items-container');

    const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);

    if (countBadge) {
        countBadge.textContent = `${totalItems} item${totalItems === 1 ? '' : 's'}`;
    }

    if (items.length === 0) {
        if (storeBanner) storeBanner.style.display = 'none';
        if (contentWrapper) contentWrapper.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        updateLiveRegion('Your shopping cart is empty.');
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (contentWrapper) contentWrapper.style.display = 'grid';

    // Store Banner Context
    if (cart.store && storeBanner) {
        storeBanner.style.display = 'block';
        const nameEl = document.getElementById('cart-store-name');
        const catEl = document.getElementById('cart-store-category');
        const descEl = document.getElementById('cart-store-desc');

        if (nameEl) nameEl.textContent = cart.store.name || 'Store';
        if (catEl) catEl.textContent = cart.store.category || 'Kirana';
        if (descEl) descEl.textContent = cart.store.description || 'Local grocery store';
    }

    // Render Items List
    if (container) {
        container.innerHTML = '';
        items.forEach(item => {
            container.appendChild(createCartItemRow(item));
        });
    }

    // Render Summary
    const subtotalEl = document.getElementById('summary-subtotal');
    const totalEl = document.getElementById('summary-total');

    if (subtotalEl) subtotalEl.textContent = formatINR(cart.subtotal);
    if (totalEl) totalEl.textContent = formatINR(cart.total);

    const navBadge = document.getElementById('nav-cart-badge');
    if (navBadge) {
        navBadge.textContent = totalItems;
        navBadge.style.display = totalItems > 0 ? 'inline-flex' : 'none';
    }

    updateLiveRegion(`Loaded cart with ${totalItems} items. Total amount ${formatINR(cart.total)}.`);
}

function createCartItemRow(item) {
    const product = item.product || {};
    const card = document.createElement('div');
    card.className = 'cart-item-card';

    // 1. Image
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'cart-item-img-wrapper';
    const img = document.createElement('img');
    img.className = 'cart-item-img';
    const imgSrc = (product.image && !product.image.includes('example.com'))
        ? product.image
        : '/images/essentials-editorial.jpg';
    img.src = imgSrc;
    img.alt = product.name || 'Product Image';
    img.loading = 'lazy';
    img.onerror = () => {
        img.onerror = null;
        img.src = '/images/essentials-editorial.jpg';
    };
    imgWrapper.appendChild(img);

    // 2. Info
    const info = document.createElement('div');
    info.className = 'cart-item-info';

    const title = document.createElement('h3');
    title.className = 'cart-item-title';
    title.textContent = product.name || 'Unnamed Product';
    info.appendChild(title);

    const price = document.createElement('p');
    price.className = 'cart-item-price';
    price.textContent = `${formatINR(product.price)} / unit`;
    info.appendChild(price);

    const stockInfo = document.createElement('span');
    stockInfo.className = 'cart-item-stock';
    if (product.stock <= 5) {
        stockInfo.textContent = `Only ${product.stock} left in stock`;
        stockInfo.style.color = '#d32f2f';
    } else {
        stockInfo.textContent = 'In Stock';
    }
    info.appendChild(stockInfo);

    // 3. Controls (Quantity + Subtotal + Remove)
    const controls = document.createElement('div');
    controls.className = 'cart-item-controls';

    const qtyGroup = document.createElement('div');
    qtyGroup.className = 'quantity-selector';

    const minusBtn = document.createElement('button');
    minusBtn.className = 'qty-btn minus';
    minusBtn.textContent = '-';
    minusBtn.setAttribute('aria-label', `Decrease quantity for ${product.name}`);
    if (item.quantity <= 1) {
        minusBtn.disabled = true;
    } else {
        minusBtn.onclick = () => updateQuantity(product._id, item.quantity - 1);
    }

    const qtyVal = document.createElement('span');
    qtyVal.className = 'qty-value';
    qtyVal.textContent = item.quantity;

    const plusBtn = document.createElement('button');
    plusBtn.className = 'qty-btn plus';
    plusBtn.textContent = '+';
    plusBtn.setAttribute('aria-label', `Increase quantity for ${product.name}`);
    if (item.quantity >= product.stock) {
        plusBtn.disabled = true;
        plusBtn.title = 'Maximum stock limit reached';
    } else {
        plusBtn.onclick = () => updateQuantity(product._id, item.quantity + 1);
    }

    qtyGroup.appendChild(minusBtn);
    qtyGroup.appendChild(qtyVal);
    qtyGroup.appendChild(plusBtn);

    const subtotal = document.createElement('div');
    subtotal.className = 'cart-item-subtotal';
    subtotal.textContent = formatINR(item.subtotal);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-item';
    removeBtn.textContent = 'Remove';
    removeBtn.setAttribute('aria-label', `Remove ${product.name} from cart`);
    removeBtn.onclick = () => removeItem(product._id);

    controls.appendChild(qtyGroup);
    controls.appendChild(subtotal);
    controls.appendChild(removeBtn);

    card.appendChild(imgWrapper);
    card.appendChild(info);
    card.appendChild(controls);

    return card;
}

async function updateQuantity(productId, newQuantity) {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`/api/customer/cart/items/${productId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ quantity: newQuantity })
        });

        const data = await response.json();

        if (response.ok) {
            cartData = data;
            renderCart(cartData);
        } else {
            alert(data.message || 'Failed to update quantity');
        }
    } catch (error) {
        console.error('Error updating quantity:', error);
        alert('Network error while updating quantity.');
    }
}

async function removeItem(productId) {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`/api/customer/cart/items/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            await loadCart();
        } else {
            const data = await response.json();
            alert(data.message || 'Failed to remove item');
        }
    } catch (error) {
        console.error('Error removing item:', error);
        alert('Network error while removing item.');
    }
}

async function confirmClearCart() {
    if (!confirm('Are you sure you want to clear your entire cart?')) {
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch('/api/customer/cart', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            await loadCart();
        } else {
            alert('Failed to clear cart.');
        }
    } catch (error) {
        console.error('Error clearing cart:', error);
    }
}

function proceedToCheckout() {
    if (!cartData || !cartData.items || cartData.items.length === 0) {
        alert('Your cart is empty.');
        return;
    }
    window.location.href = '/customer/checkout';
}

function goBackToStores() {
    window.location.href = '/customer/dashboard';
}

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
