document.addEventListener('DOMContentLoaded', async () => {
    const hasAccess = await checkUserRole();
    if (hasAccess) {
        setupEventListeners();
        loadReturns();
    }
});
// متغيرات التطبيق
let returns = [];
let currentUserRole = null;
async function checkUserRole() {
    try {
        const response = await fetch('/api/user', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error(`فشل جلب بيانات المستخدم: ${response.status}`);
        }
        const data = await response.json();
        console.log('User data from /api/user:', data);
        currentUserRole = data.role || 'غير محدد';
        localStorage.setItem('user_role', currentUserRole);
        return true;
    } catch (error) {
        console.error('خطأ في التحقق من دور المستخدم:', error);
        alert('حدث خطأ أثناء جلب بيانات المستخدم');
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
        returnsTableBody: document.getElementById('returnsTableBody'),
        searchInput: document.getElementById('searchInput'),
        statusButtons: document.querySelectorAll('.status-btn'),
        categoryButtons: document.querySelectorAll('.category-btn'),
        searchResultsCount: document.getElementById('searchResultsCount')
    };
    if (!elements.returnsTableBody) {
        console.error('عنصر returnsTableBody غير موجود');
        return;
    }
    if (!elements.searchResultsCount) {
        console.error('عنصر searchResultsCount غير موجود');
        return;
    }
    if (elements.searchBtn) {
        elements.searchBtn.addEventListener('click', () => {
            console.log('Search button clicked');
            searchReturns();
        });
    } else {
        console.error('عنصر searchBtn غير موجود');
    }
    if (elements.resetSearchBtn) {
        elements.resetSearchBtn.addEventListener('click', resetSearch);
    } else {
        console.error('عنصر resetSearchBtn غير موجود');
    }
    if (elements.statusButtons) {
        elements.statusButtons.forEach(button => {
            button.addEventListener('click', () => {
                elements.statusButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                filterReturnsByStatus(button.dataset.status);
            });
        });
    } else {
        console.error('عناصر status-btn غير موجودة');
    }
    if (elements.categoryButtons) {
        elements.categoryButtons.forEach(button => {
            button.addEventListener('click', () => {
                elements.categoryButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                filterReturnsByCategory(button.dataset.category);
            });
        });
    } else {
        console.error('عناصر category-btn غير موجودة');
    }
    updateSearchResultsCount(returns.length);
}
// Helper function to format date in YYYY-MM-DD with English numerals
function formatGregorianDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
async function loadReturns() {
    try {
        console.log('جاري تحميل المرتجعات...');
        const response = await fetch('/api/returns', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`فشل جلب المرتجعات: ${response.status} - ${errorData.message || response.statusText}`);
        }
        const data = await response.json();
        returns = Array.isArray(data) ? data : [];
        console.log('Raw API response:', data);
        console.log('البيانات المسترجعة من الـ API:', returns);
        if (returns.length === 0) {
            document.getElementById('returnsTableBody').innerHTML = `
                <tr>
                    <td colspan="8" class="empty-table">
                        <p>لا توجد مرتجعات لعرضها</p>
                    </td>
                </tr>
            `;
            updateSearchResultsCount(0);
            return;
        }
        const returnsWithDetails = returns.map(ret => ({
            return_id: ret.return_id != null ? ret.return_id.toString() : 'غير محدد',
            order_id: ret.order_id != null ? ret.order_id.toString() : 'غير محدد',
            return_date: formatGregorianDate(ret.return_date), // Use custom formatter
            status: ret.status || 'قيد الانتظار',
            category: ret.category || 'غير محدد',
            attachment: ret.attachment || null,
            user_name: ret.user_name || 'غير محدد',
            rejection_reason: ret.rejection_reason || null
        }));
        console.log('المرتجعات بعد التنسيق:', returnsWithDetails);
        renderReturns(returnsWithDetails);
        console.log('Table rendered with returns:', returnsWithDetails);
        updateSearchResultsCount(returnsWithDetails.length);
    } catch (error) {
        console.error('خطأ في تحميل المرتجعات:', error);
        let errorMessage = `فشل في جلب المرتجعات: ${error.message}`;
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'لا يمكن الاتصال بالخادم، يرجى التحقق من الشبكة';
        } else if (error.message.includes('500')) {
            errorMessage = 'خطأ داخلي في الخادم، يرجى المحاولة لاحقًا';
        }
        alert(errorMessage);
        renderReturns([]);
        updateSearchResultsCount(0);
    }
}
function renderReturns(items) {
    const returnsTableBody = document.getElementById('returnsTableBody');
    if (!returnsTableBody) {
        console.error('عنصر returnsTableBody غير موجود');
        return;
    }
    returnsTableBody.innerHTML = '';
    items.forEach(ret => {
        const row = document.createElement('tr');
        let actionsContainer = document.createElement('td');
        console.log(`Processing return ${ret.return_id}: status=${ret.status}, role=${currentUserRole}`);
        console.log(`currentUserRole type: ${typeof currentUserRole}, value: '${currentUserRole}'`);
        const statusNormalized = ret.status ? ret.status.trim() : 'قيد الانتظار';
        console.log(`statusNormalized for return ${ret.return_id}: '${statusNormalized}'`);
        if (currentUserRole === 'مورد' && statusNormalized === 'قيد الانتظار') {
            console.log(`Showing approve/reject buttons for return ${ret.return_id}`);
            const approveBtn = document.createElement('button');
            approveBtn.className = 'action-btn approve-btn';
            approveBtn.setAttribute('data-return-id', ret.return_id);
            approveBtn.textContent = 'موافقة';
            const rejectBtn = document.createElement('button');
            rejectBtn.className = 'action-btn reject-btn';
            rejectBtn.setAttribute('data-return-id', ret.return_id);
            rejectBtn.textContent = 'رفض';
            actionsContainer.appendChild(approveBtn);
            actionsContainer.appendChild(document.createTextNode(' ')); // إضافة مسافة بين الأزرار
            actionsContainer.appendChild(rejectBtn);
        } else if (currentUserRole.trim() === 'موظف المستودع' && statusNormalized === 'موافق عليه') {
            console.log(`Showing process button for return ${ret.return_id}`);
            const processBtn = document.createElement('button');
            processBtn.className = 'action-btn process-btn';
            processBtn.setAttribute('data-return-id', ret.return_id);
            processBtn.textContent = 'تمت المعالجة';
            actionsContainer.appendChild(processBtn);
        }
        console.log(`Actions for return ${ret.return_id}:`, actionsContainer.innerHTML);
        if (statusNormalized === 'مرفوض' && ret.rejection_reason) {
            const reasonBtn = document.createElement('button');
            reasonBtn.className = 'action-btn reason-btn';
            reasonBtn.setAttribute('data-return-id', ret.return_id);
            reasonBtn.textContent = 'عرض سبب الرفض';
            actionsContainer.appendChild(document.createTextNode(' ')); // إضافة مسافة بين الأزرار
            actionsContainer.appendChild(reasonBtn);
        }
        row.innerHTML = `
            <td>${ret.return_id}</td>
            <td>${ret.order_id}</td>
            <td class="status-${getStatusClass(statusNormalized)}">${ret.status}</td>
            <td>${ret.return_date}</td>
            <td>${ret.category}</td>
            <td>${ret.attachment ? `<a href="/api/returns/${ret.return_id}/attachment" target="_blank">تنزيل المرفق</a>` : 'لا يوجد'}</td>
            <td><button class="action-btn items-btn" data-return-id="${ret.return_id}">عرض العناصر</button></td>
        `;
        row.appendChild(actionsContainer);
        returnsTableBody.appendChild(row);
        row.querySelector('.items-btn')?.addEventListener('click', () => showReturnItems(ret.return_id));
        row.querySelector('.approve-btn')?.addEventListener('click', () => handleApproveReject(ret.return_id, 'approve'));
        row.querySelector('.reject-btn')?.addEventListener('click', () => handleApproveReject(ret.return_id, 'reject'));
        row.querySelector('.process-btn')?.addEventListener('click', () => {
            console.log(`Process button clicked for return ${ret.return_id}`);
            handleProcess(ret.return_id);
        });
        row.querySelector('.reason-btn')?.addEventListener('click', () => showRejectionReason(ret.return_id, ret.rejection_reason));
    });
}
function getStatusClass(status) {
    if (!status) return 'pending';
    switch (status.toLowerCase()) {
        case 'قيد الانتظار': return 'pending';
        case 'موافق عليه': return 'approved';
        case 'مرفوض': return 'rejected';
        case 'تمت المعالجة': return 'processed';
        default: return 'pending';
    }
}
async function handleApproveReject(returnId, action) {
    let rejection_reason = null;
    if (action === 'reject') {
        rejection_reason = prompt('يرجى إدخال سبب الرفض:');
        if (!rejection_reason) {
            alert('يجب إدخال سبب الرفض');
            return;
        }
    }
    try {
        const response = await fetch(`/api/returns/${returnId}/approve-reject`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action, rejection_reason })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'فشل تنفيذ الإجراء');
        }
        alert(data.message);
        loadReturns(); // إعادة تحميل المرتجعات لضمان تحديث الحالة
    } catch (error) {
        console.error(`خطأ في ${action === 'approve' ? 'الموافقة' : 'الرفض'}:`, error);
        alert(`فشل في ${action === 'approve' ? 'الموافقة' : 'الرفض'}: ${error.message}`);
    }
}
async function handleProcess(returnId) {
    try {
        const response = await fetch(`/api/returns/${returnId}/process`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'فشل معالجة المرتجع');
        }
        alert(data.message);
        loadReturns(); // إعادة تحميل المرتجعات
    } catch (error) {
        console.error('خطأ في معالجة المرتجع:', error);
        alert('فشل في معالجة المرتجع: ' + error.message);
    }
}
async function showReturnItems(returnId) {
    try {
        console.log('جاري تحميل عناصر المرتجع لـ return_id:', returnId);
        const response = await fetch(`/api/returns/${returnId}/items`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`فشل جلب عناصر المرتجع: ${response.status} - ${errorData.message || response.statusText}`);
        }
        const items = await response.json();
        console.log('عناصر المرتجع:', items);
        showItemsModal(returnId, items);
    } catch (error) {
        console.error('خطأ في تحميل عناصر المرتجع:', error);
        alert('فشل في جلب عناصر المرتجع: ' + error.message);
    }
}
function showItemsModal(returnId, items) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>عناصر المرتجع #${returnId}</h3>
                <button class="close-btn">×</button>
            </div>
            <div class="modal-body">
                ${items.length > 0 ? `
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>اسم المنتج</th>
                                <th>الكمية</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((item, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${item.product_name || 'غير متوفر'}</td>
                                    <td>${item.quantity || '0'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p class="no-items">الرجاء إرجاع جميع المنتجات بالطلب</p>'}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close-btn').addEventListener('click', () => {
        modal.remove();
    });
}
function showRejectionReason(returnId, reason) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>سبب رفض المرتجع #${returnId}</h3>
                <button class="close-btn">×</button>
            </div>
            <div class="modal-body">
                <p>${reason || 'لا يوجد سبب محدد'}</p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close-btn').addEventListener('click', () => {
        modal.remove();
    });
}
function searchReturns() {
    const searchInput = document.getElementById('searchInput');
    const searchResultsCount = document.getElementById('searchResultsCount');
    if (!searchInput) {
        console.error('عنصر searchInput غير موجود');
        return;
    }
    if (!searchResultsCount) {
        console.error('عنصر searchResultsCount غير موجود');
        return;
    }
    const query = searchInput.value.trim().toLowerCase();
    const rows = document.querySelectorAll('#returnsTableBody tr');
    let count = 0;
    console.log('البحث باستخدام:', query);
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
        if (query === '' || rowMatch) {
            row.style.display = '';
            count++;
        } else {
            row.style.display = 'none';
        }
    });
    updateSearchResultsCount(count, true);
}
function resetSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchResultsCount = document.getElementById('searchResultsCount');
    if (searchInput) {
        searchInput.value = '';
    }
    const rows = document.querySelectorAll('#returnsTableBody tr');
    rows.forEach(row => {
        row.style.display = '';
    });
    updateSearchResultsCount(returns.length);
}
function filterReturnsByStatus(status) {
    const rows = document.querySelectorAll('#returnsTableBody tr');
    let count = 0;
    rows.forEach(row => {
        const statusCell = row.querySelector('td:nth-child(3)').textContent.trim();
        if (status === '' || statusCell === status) {
            row.style.display = '';
            count++;
        } else {
            row.style.display = 'none';
        }
    });
    updateSearchResultsCount(count, true);
}
function filterReturnsByCategory(category) {
    const rows = document.querySelectorAll('#returnsTableBody tr');
    let count = 0;
    rows.forEach(row => {
        const categoryCell = row.querySelector('td:nth-child(5)').textContent;
        if (category === '' || categoryCell === category) {
            row.style.display = '';
            count++;
        } else {
            row.style.display = 'none';
        }
    });
    updateSearchResultsCount(count, true);
}
function updateSearchResultsCount(count, isSearch = false) {
    const searchResultsCount = document.getElementById('searchResultsCount');
    if (searchResultsCount) {
        if (isSearch) {
            searchResultsCount.textContent = count > 0 ? `تم العثور على ${count} نتيجة` : 'لم يتم العثور على نتائج';
        } else {
            searchResultsCount.textContent = '';
        }
    } else {
        console.warn('عنصر searchResultsCount غير موجود');
    }
}