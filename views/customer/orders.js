/**
 * KiranaWala — Customer Order History Frontend Handlers
 */

document.addEventListener('DOMContentLoaded', () => {
    initOrdersPage();
});

async function initOrdersPage() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/customer/login';
        return;
    }

    await loadOrdersList();
}

async function loadOrdersList() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch('/api/customer/orders', {
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

        const orders = await response.json();
        renderOrdersList(orders);

    } catch (error) {
        console.error('Error fetching orders:', error);
        updateLiveRegion('Unable to load your orders. Please try again.');
        showErrorState('Unable to load your orders. Please try again.');
    }
}

function renderOrdersList(orders) {
    const countBadge = document.getElementById('orders-count-badge');
    const container = document.getElementById('orders-list-container');
    const emptyState = document.getElementById('empty-orders-state');

    const totalOrders = Array.isArray(orders) ? orders.length : 0;

    if (countBadge) {
        countBadge.textContent = `${totalOrders} order${totalOrders === 1 ? '' : 's'}`;
    }

    if (!orders || orders.length === 0) {
        if (container) container.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        updateLiveRegion('No orders found in your order history.');
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (container) {
        container.style.display = 'flex';
        container.innerHTML = '';
        orders.forEach(order => {
            container.appendChild(createOrderCard(order));
        });
    }

    updateLiveRegion(`Loaded ${totalOrders} orders in history.`);
}

function createOrderCard(order) {
    const card = document.createElement('article');
    card.className = 'order-card-summary';
    card.setAttribute('tabindex', '0');

    // 1. Header (Order ID & Status Badge)
    const header = document.createElement('div');
    header.className = 'order-card-header';

    const titleGroup = document.createElement('div');
    const orderNum = document.createElement('h2');
    orderNum.className = 'order-card-id';
    orderNum.textContent = `Order #${formatShortOrderId(order._id)}`;

    const orderDate = document.createElement('span');
    orderDate.className = 'order-card-date';
    orderDate.textContent = `Placed: ${formatDate(order.createdAt)}`;

    titleGroup.appendChild(orderNum);
    titleGroup.appendChild(orderDate);

    const statusBadge = document.createElement('span');
    const statusUpper = (order.status || 'placed').toUpperCase();
    statusBadge.className = `order-status-badge status-${order.status || 'placed'}`;
    statusBadge.textContent = statusUpper;

    header.appendChild(titleGroup);
    header.appendChild(statusBadge);

    // 2. Body Details (Store context, item count, total)
    const body = document.createElement('div');
    body.className = 'order-card-body';

    const storeInfo = document.createElement('div');
    storeInfo.className = 'order-card-store';
    
    const storeName = document.createElement('strong');
    storeName.className = 'order-store-name';
    storeName.textContent = order.store ? order.store.name : 'Kirana Store';

    const storeCat = document.createElement('span');
    storeCat.className = 'order-store-cat';
    storeCat.textContent = order.store ? (order.store.category || 'Groceries') : 'Groceries';

    storeInfo.appendChild(storeName);
    storeInfo.appendChild(storeCat);

    const itemCount = order.items ? order.items.reduce((acc, i) => acc + (i.quantity || 1), 0) : 0;
    const summaryLine = document.createElement('div');
    summaryLine.className = 'order-card-meta';

    const itemsSpan = document.createElement('span');
    itemsSpan.textContent = `${itemCount} item${itemCount === 1 ? '' : 's'}`;

    const priceSpan = document.createElement('span');
    priceSpan.className = 'order-card-price';
    priceSpan.textContent = formatINR(order.total);

    summaryLine.appendChild(itemsSpan);
    summaryLine.appendChild(priceSpan);

    body.appendChild(storeInfo);
    body.appendChild(summaryLine);

    // 3. Footer Action Button
    const footer = document.createElement('div');
    footer.className = 'order-card-footer';

    const viewBtn = document.createElement('a');
    viewBtn.className = 'btn-view-order';
    viewBtn.href = `/customer/orders/${order._id}`;
    viewBtn.textContent = 'View Order Details →';
    viewBtn.setAttribute('aria-label', `View details for Order #${formatShortOrderId(order._id)}`);

    footer.appendChild(viewBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    return card;
}

function showErrorState(message) {
    const container = document.getElementById('orders-list-container');
    if (!container) return;

    container.innerHTML = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'error-orders-card';

    const h3 = document.createElement('h3');
    h3.textContent = '⚠️ Unable to Load Orders';
    errDiv.appendChild(h3);

    const p = document.createElement('p');
    p.textContent = message;
    errDiv.appendChild(p);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-retry-orders';
    retryBtn.textContent = 'Try Again';
    retryBtn.onclick = () => loadOrdersList();
    errDiv.appendChild(retryBtn);

    container.appendChild(errDiv);
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

function handleLogout() {
    localStorage.removeItem('token');
    window.location.href = '/customer/login';
}
