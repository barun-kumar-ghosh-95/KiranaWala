/**
 * KiranaWala — Customer Order Details Frontend Handlers
 */

document.addEventListener('DOMContentLoaded', () => {
    initOrderDetailsPage();
});

let currentOrderData = null;

async function initOrderDetailsPage() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/customer/login';
        return;
    }

    const orderId = getOrderIdFromURL();
    if (!orderId) {
        showOrderError('Invalid Order Request', 'No order ID was specified in the URL.');
        return;
    }

    await loadOrderDetails(orderId);
}

function getOrderIdFromURL() {
    const pathname = window.location.pathname;
    const parts = pathname.split('/').filter(p => p.length > 0);
    // URL pattern: /customer/orders/:orderId
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart !== 'orders' && lastPart.length === 24) {
        return lastPart;
    }
    // Query param fallback (?orderId=...)
    const params = new URLSearchParams(window.location.search);
    return params.get('orderId') || (lastPart !== 'orders' ? lastPart : null);
}

async function loadOrderDetails(orderId) {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`/api/customer/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            window.location.href = '/customer/login';
            return;
        }

        if (response.status === 404) {
            showOrderError('Order Not Found', 'You do not have access to this order or it does not exist.');
            return;
        }

        if (response.status === 400) {
            showOrderError('Invalid Order ID', 'The provided order identifier is invalid.');
            return;
        }

        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }

        currentOrderData = await response.json();
        renderOrderDetails(currentOrderData);

    } catch (error) {
        console.error('Error loading order details:', error);
        showOrderError('Unable to Load Order', 'Network error while fetching order details. Please check your connection.');
    }
}

function renderOrderDetails(order) {
    const errorState = document.getElementById('order-error-state');
    const contentGrid = document.getElementById('order-details-content');

    if (errorState) errorState.style.display = 'none';
    if (contentGrid) contentGrid.style.display = 'grid';

    // 1. Header Information
    const titleEl = document.getElementById('order-main-heading');
    const dateEl = document.getElementById('order-placed-date');
    const badgeEl = document.getElementById('order-status-badge');
    const storeNameEl = document.getElementById('order-store-name');
    const storeCatEl = document.getElementById('order-store-cat');

    const formattedId = formatShortOrderId(order._id);
    if (titleEl) titleEl.textContent = `Order #${formattedId}`;
    if (dateEl) dateEl.textContent = `Placed on ${formatDate(order.createdAt)}`;
    
    const statusVal = order.status || 'placed';
    if (badgeEl) {
        badgeEl.textContent = statusVal.toUpperCase();
        badgeEl.className = `order-status-badge status-${statusVal}`;
    }

    if (order.store) {
        if (storeNameEl) storeNameEl.textContent = order.store.name || 'Store';
        if (storeCatEl) storeCatEl.textContent = order.store.category || 'Groceries';
    }

    // 2. Visual Timeline
    renderStatusTimeline(statusVal);

    // 3. Items Receipt Table (Using Historical Snapshots)
    renderOrderItems(order.items || []);

    // 4. Financial Summary
    const subtotalEl = document.getElementById('order-subtotal');
    const totalEl = document.getElementById('order-total');
    if (subtotalEl) subtotalEl.textContent = formatINR(order.subtotal);
    if (totalEl) totalEl.textContent = formatINR(order.total);

    // 5. Delivery Address
    renderDeliveryAddress(order.deliveryAddress || {});

    // 6. Cancel Action Button Container
    const cancelBox = document.getElementById('cancel-order-container');
    if (cancelBox) {
        cancelBox.style.display = statusVal === 'placed' ? 'block' : 'none';
    }

    updateLiveRegion(`Loaded details for Order #${formattedId}. Status is ${statusVal.toUpperCase()}. Total amount ${formatINR(order.total)}.`);
}

function renderStatusTimeline(status) {
    const container = document.getElementById('status-timeline-container');
    if (!container) return;
    container.innerHTML = '';

    const stepper = document.createElement('div');
    stepper.className = 'timeline-stepper-inner';

    if (status === 'cancelled') {
        stepper.appendChild(createTimelineStep('Order Placed', 'completed', '✓'));
        stepper.appendChild(createTimelineStep('Cancelled', 'cancelled', '✕'));
    } else {
        const steps = [
            { key: 'placed', label: 'Order Placed' },
            { key: 'processing', label: 'Processing' },
            { key: 'completed', label: 'Completed' }
        ];

        const statusOrder = ['placed', 'processing', 'completed'];
        const currentIdx = statusOrder.indexOf(status);

        steps.forEach((step, idx) => {
            let stepState = 'pending';
            let icon = '○';

            if (idx < currentIdx) {
                stepState = 'completed';
                icon = '✓';
            } else if (idx === currentIdx) {
                stepState = 'active';
                icon = '●';
            }

            stepper.appendChild(createTimelineStep(step.label, stepState, icon));
        });
    }

    container.appendChild(stepper);
}

function createTimelineStep(label, state, iconSymbol) {
    const stepNode = document.createElement('div');
    stepNode.className = `timeline-step step-${state}`;

    const iconNode = document.createElement('div');
    iconNode.className = 'timeline-icon';
    iconNode.textContent = iconSymbol;

    const labelNode = document.createElement('div');
    labelNode.className = 'timeline-label';
    labelNode.textContent = label;

    stepNode.appendChild(iconNode);
    stepNode.appendChild(labelNode);

    return stepNode;
}

function renderOrderItems(items) {
    const container = document.getElementById('order-items-table');
    if (!container) return;
    container.innerHTML = '';

    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'order-item-row';

        const info = document.createElement('div');
        info.className = 'order-item-info';

        // MANDATORY REQUIREMENT: Display historical productNameSnapshot & unitPrice
        const name = document.createElement('strong');
        name.className = 'order-item-name';
        name.textContent = item.productNameSnapshot || (item.product ? item.product.name : 'Grocery Item');

        const meta = document.createElement('span');
        meta.className = 'order-item-meta';
        meta.textContent = `${item.quantity} × ${formatINR(item.unitPrice)}`;

        info.appendChild(name);
        info.appendChild(meta);

        const subtotal = document.createElement('div');
        subtotal.className = 'order-item-subtotal';
        subtotal.textContent = formatINR(item.subtotal);

        row.appendChild(info);
        row.appendChild(subtotal);

        container.appendChild(row);
    });
}

function renderDeliveryAddress(addr) {
    const nameEl = document.getElementById('addr-fullname');
    const phoneEl = document.getElementById('addr-phone');
    const streetEl = document.getElementById('addr-street');
    const cityEl = document.getElementById('addr-city-pincode');

    if (nameEl) nameEl.textContent = addr.fullName || 'Customer';
    if (phoneEl) phoneEl.textContent = `📞 Phone: ${addr.phone || 'N/A'}`;
    if (streetEl) streetEl.textContent = addr.address || '';
    
    const cityPin = [addr.city, addr.pincode].filter(Boolean).join(', ');
    if (cityEl) cityEl.textContent = cityPin || '';
}

async function confirmCancelOrder() {
    if (!currentOrderData || currentOrderData.status !== 'placed') {
        alert('This order cannot be cancelled.');
        return;
    }

    if (!confirm('Are you sure you want to cancel this order? Item stock will be restored to the store inventory.')) {
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const cancelBtn = document.getElementById('btn-cancel-order');
    if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Cancelling...';
    }

    try {
        const response = await fetch(`/api/customer/orders/${currentOrderData._id}/cancel`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (response.ok && result.order) {
            currentOrderData = result.order;
            renderOrderDetails(currentOrderData);
            alert('Order cancelled successfully.');
        } else {
            alert(result.message || 'Failed to cancel order.');
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.textContent = 'Cancel Order';
            }
        }
    } catch (error) {
        console.error('Error cancelling order:', error);
        alert('Network error while cancelling order.');
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.textContent = 'Cancel Order';
        }
    }
}

function showOrderError(title, message) {
    const contentGrid = document.getElementById('order-details-content');
    const errorState = document.getElementById('order-error-state');
    const errorTitle = document.getElementById('error-title');
    const errorMsg = document.getElementById('error-message');

    if (contentGrid) contentGrid.style.display = 'none';
    if (errorState) errorState.style.display = 'block';
    if (errorTitle) errorTitle.textContent = title;
    if (errorMsg) errorMsg.textContent = message;

    updateLiveRegion(`${title}: ${message}`);
}

function formatShortOrderId(id) {
    if (!id) return 'KW-0000';
    return `KW-${id.substring(id.length - 6).toUpperCase()}`;
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
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
