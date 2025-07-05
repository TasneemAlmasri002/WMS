document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    if (document.querySelector('#dataTable')) {
        fetchAndDisplaySuppliers();
        setupFilters();
    } else {
        console.error("جدول البيانات غير موجود في الصفحة!");
    }
});

async function checkSession() {
    try {
        const response = await fetch('/check-auth');
        if (!response.ok) {
            window.location.href = '/';
            return;
        }
    } catch (error) {
        console.error('خطأ أثناء التحقق من الجلسة:', error);
        window.location.href = '/';
    }
}

async function fetchSuppliers(statusFilter = '') {
    try {
        let url = '/api/suppliers';
        const params = new URLSearchParams();
        if (statusFilter) params.append('status', statusFilter);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/';
                return [];
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const suppliers = await response.json();

        // جلب الشركات المرتبطة بكل مورد
        const manufacturersResponse = await fetch('/api/manufacturers');
        const manufacturers = await manufacturersResponse.json();

        // إضافة أسماء الشركات إلى كل مورد
        return suppliers.map(supplier => {
            const relatedManufacturers = manufacturers
                .filter(m => m.suppliers && m.suppliers.some(s => s.supplier_id === supplier.supplier_id))
                .map(m => m.manufacturer_name);
            return {
                ...supplier,
                manufacturers: relatedManufacturers.length > 0 ? relatedManufacturers : ['غير مرتبط'], // القيمة الأولية: غير مرتبط
                order_count: supplier.order_count || 0 // التأكد من أن order_count موجود و0 إذا لم يكن محددًا
            };
        });
    } catch (error) {
        console.error('خطأ أثناء جلب الموردين:', error);
        showMessage('حدث خطأ أثناء تحميل الموردين.');
        return [];
    }
}

function displaySuppliers(suppliers) {
    const tableBody = document.querySelector('#dataTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (suppliers.length === 0) {
        tableBody.innerHTML = `
            <tr><td colspan="9">لا توجد بيانات للموردين</td></tr>
        `;
        return;
    }

    suppliers.forEach(supplier => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${supplier.supplier_id}</td>
            <td>${supplier.suppliername}</td> 
            <td>${supplier.manufacturers.join(', ')}</td>
            <td>${supplier.email}</td>
            <td>${supplier.phone_number}</td>
            <td>
                <input type="text" class="editable-address" value="${supplier.address || ''}" 
                       data-supplier-id="${supplier.supplier_id}" 
                       onchange="updateSupplierAddress(this)">
            </td>
            <td>${supplier.status === 'Active' ? 'نشط' : 'غير نشط'}</td>
            <td>${supplier.order_count}</td>
            <td class="action-buttons">
                <button class="view-btn" onclick="showOrders(${supplier.supplier_id})">عرض الطلبات</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function updateSupplierAddress(inputElement) {
    const supplierId = inputElement.getAttribute('data-supplier-id');
    const newAddress = inputElement.value.trim() || null;

    try {
        const response = await fetch(`/api/suppliers/${supplierId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: newAddress })
        });
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            throw new Error('فشل في تعديل العنوان');
        }
        const data = await response.json();
        showMessage(data.message);
    } catch (error) {
        showMessage('حدث خطأ أثناء تعديل العنوان: ' + error.message);
        inputElement.value = '';
    }
}

function setupFilters() {
    const activityFilter = document.getElementById('activityFilter');
    if (!activityFilter) return;
    activityFilter.addEventListener('change', () => {
        const currentStatus = activityFilter.value;
        fetchAndDisplaySuppliers(currentStatus);
    });
}

async function fetchAndDisplaySuppliers(statusFilter = '') {
    const suppliers = await fetchSuppliers(statusFilter);
    displaySuppliers(suppliers);
}

async function searchSuppliers() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const statusFilter = document.getElementById('activityFilter').value;

    const suppliers = await fetchSuppliers(statusFilter);
    const filteredSuppliers = suppliers.filter(supplier => {
        return (
            supplier.supplier_id.toString().includes(searchTerm) ||
            supplier.suppliername.toLowerCase().includes(searchTerm) || // استخدام suppliername
            supplier.email.toLowerCase().includes(searchTerm) ||
            supplier.phone_number.toLowerCase().includes(searchTerm) ||
            (supplier.address || '').toLowerCase().includes(searchTerm) ||
            (supplier.manufacturers.join(', ') || '').toLowerCase().includes(searchTerm) ||
            (supplier.status === 'Active' ? 'نشط' : 'غير نشط').toLowerCase().includes(searchTerm)
        );
    });

    displaySuppliers(filteredSuppliers);
    document.getElementById('searchResultsCount').textContent = `عدد النتائج: ${filteredSuppliers.length}`;
}

function resetSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResultsCount').textContent = '';
    document.getElementById('activityFilter').value = '';
    fetchAndDisplaySuppliers();
}


async function exportToCSV() {
    const statusFilter = document.getElementById('activityFilter').value;
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();

    let suppliers = await fetchSuppliers(statusFilter);
    if (searchTerm) {
        suppliers = suppliers.filter(supplier => {
            return (
                supplier.supplier_id.toString().includes(searchTerm) ||
                supplier.suppliername.toLowerCase().includes(searchTerm) ||
                supplier.email.toLowerCase().includes(searchTerm) ||
                supplier.phone_number.toLowerCase().includes(searchTerm) ||
                (supplier.address || '').toLowerCase().includes(searchTerm) ||
                (supplier.manufacturers.join(', ') || '').toLowerCase().includes(searchTerm) ||
                (supplier.status === 'Active' ? 'نشط' : 'غير نشط').toLowerCase().includes(searchTerm)
            );
        });
    }

    if (suppliers.length === 0) {
        showMessage('لا توجد بيانات للتصدير!');
        return;
    }

    const headers = ['معرف المورد', 'اسم المورد', 'البريد الإلكتروني', 'رقم الهاتف', 'العنوان', 'الشركة المصنعة', 'الحالة', 'عدد الطلبات'];
    const rows = suppliers.map(supplier => [
        supplier.supplier_id,
        supplier.suppliername,
        supplier.email,
        `"${supplier.phone_number}"`, // إضافة علامتي اقتباس
        supplier.address || 'غير محدد',
        supplier.manufacturers.join(', '),
        supplier.status === 'Active' ? 'نشط' : 'غير نشط', // حالة بالعربية
        supplier.order_count
    ]);

    let csvContent = '\ufeff';
    csvContent += headers.join(',') + '\n';
    csvContent += rows.map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'suppliers_tracking.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function showOrders(supplierId) {
    try {
        const response = await fetch(`/api/suppliers/${supplierId}/orders`);
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/';
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const orders = await response.json();
        displayOrders(orders);
        document.getElementById('ordersPopup').style.display = 'flex';
    } catch (error) {
        showMessage('حدث خطأ أثناء جلب الطلبات: ' + error.message);
    }
}

function displayOrders(orders) {
    const tableBody = document.querySelector('#ordersTable tbody');
    tableBody.innerHTML = '';
    if (orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">لا توجد طلبات لهذا المورد</td></tr>';
        return;
    }
    orders.forEach(order => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${order.order_id}</td>
            <td>${new Date(order.order_date).toLocaleDateString('ar')}</td>
            <td>${order.amount || 'غير محدد'}</td>
            <td>${order.payment_status || 'غير مدفوع'}</td>
            <td>${order.payment_terms || 'غير محدد'}</td>
            <td>${order.delivery_status || 'غير محدد'}</td>
        `;
        tableBody.appendChild(row);
    });
}

function closeOrdersPopup() {
    document.getElementById('ordersPopup').style.display = 'none';
}

function showMessage(message) {
    const messageHeader = document.getElementById('messageHeader');
    document.getElementById('messageText').textContent = message;
    messageHeader.style.display = 'flex';
    setTimeout(() => {
        messageHeader.style.display = 'none';
    }, 3000);
}

function hideMessage() {
    document.getElementById('messageHeader').style.display = 'none';
}
