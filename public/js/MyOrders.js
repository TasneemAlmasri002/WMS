document.addEventListener('DOMContentLoaded', async () => {
    try {
        const hasAccess = await checkUserRole();
        if (hasAccess) {
            setupEventListeners();
            await loadOrders();
        }
    } catch (error) {
        console.error('خطأ أثناء تهيئة الصفحة:', error);
    }
});
// متغيرات التطبيق
let orders = [];
let currentUserRole = null;
async function checkUserRole() {
    try {
        const response = await fetch('/check-auth', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error(`فشل جلب بيانات المستخدم: ${response.status}`);
        }
        const data = await response.json();
        console.log('User data:', data);
        currentUserRole = data.user?.role || 'غير محدد';
        localStorage.setItem('user_role', currentUserRole);
        return true;
    } catch (error) {
        console.error('خطأ في التحقق من دور المستخدم:', error);
        alert('حدث خطأ أثناء التحقق من صلاحياتك. سيتم إعادة توجيهك إلى صفحة تسجيل الدخول.');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
        return false;
    }
}
function setupEventListeners() {
    const elements = {
        searchBtn: document.getElementById('searchBtn'),
        resetSearchBtn: document.getElementById('resetSearchBtn'),
        ordersTableBody: document.getElementById('ordersTableBody'),
        searchInput: document.getElementById('searchInput'),
        statusButtons: document.querySelectorAll('.status-btn'),
        searchResultsCount: document.getElementById('searchResultsCount'),
    };
    if (!elements.ordersTableBody) {
        console.error('عنصر ordersTableBody غير موجود');
        return;
    }
    if (!elements.searchResultsCount) {
        console.error('عنصر searchResultsCount غير موجود');
        return;
    }
    if (elements.searchBtn) {
        elements.searchBtn.addEventListener('click', () => {
            console.log('Search button clicked');
            searchOrders(elements);
        });
    } else {
        console.error('عنصر searchBtn غير موجود');
    }
    if (elements.resetSearchBtn) {
        elements.resetSearchBtn.addEventListener('click', () => resetSearch(elements));
    } else {
        console.error('عنصر resetSearchBtn غير موجود');
    }
    if (elements.statusButtons) {
        elements.statusButtons.forEach(button => {
            button.addEventListener('click', () => {
                elements.statusButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                filterOrdersByStatus(button.dataset.status);
            });
        });
    } else {
        console.error('عناصر status-btn غير موجودة');
    }
    updateSearchResultsCount(orders.length);
}
async function loadOrders() {
    try {
        console.log('جارٍ تحميل الطلبات...');
        const response = await fetch('/api/My_orders', {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`فشل جلب الطلبات: ${response.status} - ${errorData.message || response.statusText}`);
        }
        const data = await response.json();
        console.log('استجابة الـ API:', data);
        orders = data.items || [];
        console.log('الطلبات الخام من الـ API:', orders);
        if (orders.length === 0) {
            document.getElementById('ordersTableBody').innerHTML = `
                <tr>
                    <td colspan="6" class="empty-table">
                        <p>${data.message || 'لا توجد طلبات لعرضها'}</p>
                    </td>
                </tr>
            `;
            updateSearchResultsCount(0);
            return;
        }
        const ordersWithDetails = orders.map(order => ({
            order_id: order.order_id != null ? order.order_id.toString() : 'غير محدد',
            order_date: order.order_date ? new Date(order.order_date).toISOString().split('T')[0] : '-',
            manufacturer_name: order.manufacturer_name || 'غير محدد',
            amount: order.amount != null ? parseFloat(order.amount).toFixed(2) : '-',
            status: order.status || 'قيد الانتظار',
        }));
        console.log('الطلبات المُنسقة:', ordersWithDetails);
        renderOrders(ordersWithDetails);
        updateSearchResultsCount(ordersWithDetails.length);
    } catch (error) {
        console.error('خطأ في تحميل الطلبات:', error);
        document.getElementById('ordersTableBody').innerHTML = `
            <tr>
                <td colspan="6" class="empty-table">
                    <p>حدث خطأ أثناء تحميل الطلبات: ${error.message}</p>
                </td>
            </tr>
        `;
        updateSearchResultsCount(0);
    }
}
function renderOrders(items) {
    const ordersTableBody = document.getElementById('ordersTableBody');
    if (!ordersTableBody) {
        console.error('عنصر ordersTableBody غير موجود');
        return;
    }
    ordersTableBody.innerHTML = '';
    items.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.order_id}</td>
            <td>${order.order_date}</td>
            <td>${order.manufacturer_name}</td>
            <td>${order.amount}</td>
            <td class="status-${getStatusClass(order.status)}">${order.status}</td>
            <td><button class="btn btn-primary details-btn" data-order-id="${order.order_id}">تفاصيل الطلب</button></td>
        `;
        ordersTableBody.appendChild(row);
        row.querySelector('.details-btn').addEventListener('click', () => {
            window.location.href = `/Order_Product/order_details.html?order_id=${order.order_id}`;
        });
    });
}
function getStatusClass(status) {
    if (!status) return 'pending';
    switch (status.toLowerCase()) {
        case 'قيد الانتظار': return 'pending';
        case 'موافق عليه': return 'approved';
        case 'مرفوض': return 'rejected';
        case 'مكتمل': return 'completed';
        default: return 'pending';
    }
}
function searchOrders(elements) {
    const { searchInput, searchResultsCount } = elements;
    if (!searchInput || !searchResultsCount) {
        console.error('عناصر البحث مفقودة');
        return;
    }
    const query = searchInput.value.trim().toLowerCase();
    const rows = document.querySelectorAll('#ordersTableBody tr');
    let count = 0;
    console.log('استعلام البحث:', query);
    console.log('عدد الصفوف:', rows.length);
    rows.forEach(row => {
        const cells = row.querySelectorAll('td:not(:last-child)');
        let rowMatch = false;
        cells.forEach(cell => {
            const cellText = cell.textContent.trim().toLowerCase();
            const normalizedCellText = cellText.replace(/\b(\d+)\.0+\b/g, '$1');
            if (normalizedCellText.includes(query)) {
                rowMatch = true;
            }
        });
        row.style.display = query === '' || rowMatch ? '' : 'none';
        if (row.style.display !== 'none') count++;
    });
    updateSearchResultsCount(count, true);
}
function resetSearch(elements) {
    const { searchInput, searchResultsCount } = elements;
    if (searchInput) searchInput.value = '';
    const rows = document.querySelectorAll('#ordersTableBody tr');
    rows.forEach(row => {
        row.style.display = '';
    });
    updateSearchResultsCount(orders.length);
}
function filterOrdersByStatus(status) {
    const rows = document.querySelectorAll('#ordersTableBody tr');
    let count = 0;
    rows.forEach(row => {
        const statusCell = row.querySelector('td:nth-child(5)');
        if (!statusCell) {
            row.style.display = 'none';
            return;
        }
        const statusText = statusCell.textContent;
        row.style.display = status === '' || statusText === status ? '' : 'none';
        if (row.style.display !== 'none') count++;
    });
    updateSearchResultsCount(count, true);
}
function updateSearchResultsCount(count, isSearch = false) {
    const searchResultsCount = document.getElementById('searchResultsCount');
    if (searchResultsCount) {
        searchResultsCount.textContent = isSearch
            ? count > 0
                ? `تم العثور على ${count} نتيجة`
                : 'لم يتم العثور على نتائج'
            : '';
    } else {
        console.warn('عنصر searchResultsCount غير موجود');
    }
}