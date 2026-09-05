/**
 * KiranaWala — Customer Checkout Frontend Handlers
 */

document.addEventListener('DOMContentLoaded', () => {
    initCheckout();
});

let currentCart = null;

async function initCheckout() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/customer/login';
        return;
    }

    await loadCheckoutCart();
}

async function loadCheckoutCart() {
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

        currentCart = await response.json();

        if (!currentCart.items || currentCart.items.length === 0) {
            alert('Your cart is empty. Please add products before checking out.');
            window.location.href = '/customer/cart';
            return;
        }

        renderCheckoutSummary(currentCart);

    } catch (error) {
        console.error('Error loading checkout cart:', error);
        alert('Failed to load checkout details.');
    }
}

function renderCheckoutSummary(cart) {
    const itemsList = document.getElementById('checkout-items-list');
    const storeName = document.getElementById('checkout-store-name');
    const storeCat = document.getElementById('checkout-store-cat');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const totalEl = document.getElementById('checkout-total');

    if (cart.store) {
        if (storeName) storeName.textContent = cart.store.name || 'Store';
        if (storeCat) storeCat.textContent = cart.store.category || 'Kirana';
    }

    if (itemsList) {
        itemsList.innerHTML = '';
        cart.items.forEach(item => {
            const product = item.product || {};
            const itemRow = document.createElement('div');
            itemRow.className = 'checkout-item-row';

            const itemTitle = document.createElement('div');
            itemTitle.className = 'checkout-item-name';
            itemTitle.textContent = `${product.name || 'Product'} × ${item.quantity}`;

            const itemSubtotal = document.createElement('div');
            itemSubtotal.className = 'checkout-item-price';
            itemSubtotal.textContent = formatINR(item.subtotal);

            itemRow.appendChild(itemTitle);
            itemRow.appendChild(itemSubtotal);
            itemsList.appendChild(itemRow);
        });
    }

    if (subtotalEl) subtotalEl.textContent = formatINR(cart.subtotal);
    if (totalEl) totalEl.textContent = formatINR(cart.total);
}

async function handlePlaceOrder(event) {
    event.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/customer/login';
        return;
    }

    const fullName = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const city = document.getElementById('city').value.trim();
    const pincode = document.getElementById('pincode').value.trim();

    if (!fullName || !phone || !address) {
        alert('Please fill in all required delivery fields.');
        return;
    }

    const submitBtn = document.getElementById('btn-place-order');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Placing Order...';
    }

    try {
        const response = await fetch('/api/customer/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                deliveryAddress: {
                    fullName,
                    phone,
                    address,
                    city,
                    pincode
                }
            })
        });

        const result = await response.json();

        if (response.ok && result.order) {
            renderOrderSuccess(result.order);
        } else {
            alert(result.message || 'Failed to place order.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Place Order →';
            }
        }
    } catch (error) {
        console.error('Error placing order:', error);
        alert('Network error occurred while placing order. Please try again.');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Place Order →';
        }
    }
}

function renderOrderSuccess(order) {
    const formWrapper = document.getElementById('checkout-form-wrapper');
    const successScreen = document.getElementById('order-success-screen');

    if (formWrapper) formWrapper.style.display = 'none';
    if (successScreen) successScreen.style.display = 'block';

    const orderIdEl = document.getElementById('success-order-id');
    const storeEl = document.getElementById('success-store-name');
    const addressEl = document.getElementById('success-delivery-address');
    const totalEl = document.getElementById('success-total-paid');

    if (orderIdEl) orderIdEl.textContent = `Order #${order._id}`;
    if (storeEl) storeEl.textContent = order.store ? order.store.name : 'Store';
    if (addressEl) {
        const addr = order.deliveryAddress || {};
        addressEl.textContent = `${addr.fullName}, ${addr.address}, ${addr.city || ''} (${addr.phone})`;
    }
    if (totalEl) totalEl.textContent = formatINR(order.total);

    const viewOrderBtn = document.getElementById('btn-view-placed-order');
    if (viewOrderBtn) {
        viewOrderBtn.href = `/customer/orders/${order._id}`;
    }

    updateLiveRegion(`Order placed successfully! Order ID ${order._id}. Total amount ${formatINR(order.total)}.`);
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
