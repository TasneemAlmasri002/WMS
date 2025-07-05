// جلب دور المستخدم من الخادم
async function getUserRole() {
    try {
        const response = await fetch('/api/user', {
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
        });
        if (!response.ok) throw new Error(`فشل في جلب بيانات المستخدم: ${response.status}`);
        const user = await response.json();
        return user.role ? user.role.trim() : null;
    } catch (error) {
        console.error('خطأ في جلب الدور:', error);
        return null;
    }
}

// فتح نافذة إضافة شركة
function openAddManufacturerPopup() {
    document.getElementById('addManufacturerPopup').style.display = 'flex';
    document.getElementById('nameError').textContent = '';
    document.getElementById('contactError').textContent = '';
    document.getElementById('addManufacturerForm').reset();
}

// فتح نافذة تعديل شركة
function openEditManufacturerPopup(id, name, contact) {
    document.getElementById('editManufacturerPopup').style.display = 'flex';
    document.getElementById('edit_manufacturer_id').value = id;
    document.getElementById('edit_manufacturer_name').value = name;
    document.getElementById('edit_contact_info').value = contact || '';
    document.getElementById('editNameError').textContent = '';
    document.getElementById('editContactError').textContent = '';
}

// إغلاق النافذة
function closePopup(popupId) {
    document.getElementById(popupId).style.display = 'none';
}

// عرض رسالة إشعار
function showMessage(text, type = 'info') {
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');
    messageText.textContent = text;
    messageBox.style.display = 'flex';
    messageBox.className = `message-header ${type === 'error' ? 'error' : 'success'}`;
    setTimeout(hideMessage, 3000);
}

// إخفاء رسالة الإشعار
function hideMessage() {
    document.getElementById('messageBox').style.display = 'none';
}

// جلب الشركات وعرضها مع التحكم بالصلاحيات
async function loadManufacturers() {
    try {
        const role = await getUserRole();
        const isSystemAdmin = role === 'مسؤول النظام';
        const isManager = role === 'مدير';
        const response = await fetch('/api/manufacturers', {
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`فشل في جلب الشركات: ${response.status} ${response.statusText}`);
        }
        const manufacturers = await response.json();
        const tbody = document.querySelector('#manufacturersTable tbody');
        tbody.innerHTML = '';

        // إخفاء الأزرار الحساسة إذا لم يكن المستخدم مسؤول النظام
        const addBtn = document.getElementById('addManufacturerBtn');
        const exportBtn = document.querySelector('.export-btn');
        const importBtn = document.querySelector('#importFile')?.nextElementSibling;
        if (!isSystemAdmin) {
            if (addBtn) addBtn.style.display = 'none';
            if (exportBtn) exportBtn.style.display = 'none';
            if (importBtn) importBtn.style.display = 'none';
        } else {
            if (addBtn) addBtn.style.display = 'inline-block';
            if (exportBtn) exportBtn.style.display = 'inline-block';
            if (importBtn) importBtn.style.display = 'inline-block';
        }

        manufacturers.forEach(manufacturer => {
            const suppliersCount = manufacturer.suppliers ? manufacturer.suppliers.length : 0;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td onclick="goToProducts(${manufacturer.manufacturer_id})" style="cursor: pointer;">${manufacturer.manufacturer_name}</td>
                <td>${manufacturer.contact_info || '-'}</td>
                <td>
                    <button class="supplier-action-btn" onclick="showSuppliersPopup(${manufacturer.manufacturer_id})">
                        ${suppliersCount} مورد${suppliersCount !== 1 ? 'ون' : ''}
                    </button>
                    ${(isSystemAdmin || isManager) ? `<button class="btn btn-sm btn-primary" onclick="openAssignSuppliersPopup(${manufacturer.manufacturer_id})">تحديد الموردين</button>` : ''}
                </td>
                <td>${manufacturer.product_count || 0}</td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="goToProducts(${manufacturer.manufacturer_id})">إنشاء طلب</button>
                    ${(isSystemAdmin || isManager) ? `<button class="btn btn-sm btn-secondary" onclick="openEditManufacturerPopup(${manufacturer.manufacturer_id}, '${manufacturer.manufacturer_name.replace(/'/g, "\\'")}', '${(manufacturer.contact_info || '').replace(/'/g, "\\'")}')">تعديل</button>` : ''}
                    ${isSystemAdmin ? `<button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteManufacturer(${manufacturer.manufacturer_id})">حذف</button>` : ''}
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('خطأ أثناء جلب الشركات:', error);
        showMessage('حدث خطأ أثناء جلب البيانات', 'error');
    }
}

// الانتقال إلى صفحة المنتجات
function goToProducts(manufacturerId) {
    window.location.href = `/Order_product/products.html?manufacturer_id=${manufacturerId}`;
}

// إضافة شركة جديدة
document.getElementById('addManufacturerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = await getUserRole();
    if (role !== 'مسؤول النظام') {
        showMessage('غير مصرح لك بإضافة شركة', 'error');
        return;
    }

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    document.getElementById('nameError').textContent = '';
    document.getElementById('contactError').textContent = '';

    if (!data.manufacturer_name.trim()) {
        document.getElementById('nameError').textContent = 'اسم الشركة مطلوب';
        return;
    }

    try {
        const response = await fetch('/api/manufacturers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        if (!response.ok) {
            const errorData = await response.json();
            if (errorData.field === 'manufacturer_name') {
                document.getElementById('nameError').textContent = errorData.message;
            } else {
                throw new Error('فشل في إضافة الشركة');
            }
            return;
        }
        closePopup('addManufacturerPopup');
        showMessage('تم إضافة الشركة بنجاح');
        loadManufacturers();
    } catch (error) {
        console.error('خطأ أثناء إضافة الشركة:', error);
        showMessage('حدث خطأ أثناء إضافة الشركة', 'error');
    }
});

// تعديل شركة
document.getElementById('editManufacturerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = await getUserRole();
    if (!['مسؤول النظام', 'مدير'].includes(role)) {
        showMessage('غير مصرح لك بتعديل الشركة', 'error');
        return;
    }

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    document.getElementById('editNameError').textContent = '';
    document.getElementById('editContactError').textContent = '';

    if (!data.manufacturer_name.trim()) {
        document.getElementById('editNameError').textContent = 'اسم الشركة مطلوب';
        return;
    }

    try {
        const response = await fetch(`/api/manufacturers/${data.manufacturer_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        if (!response.ok) {
            const errorData = await response.json();
            if (errorData.field === 'manufacturer_name') {
                document.getElementById('editNameError').textContent = errorData.message;
            } else {
                throw new Error('فشل في تعديل الشركة');
            }
            return;
        }
        closePopup('editManufacturerPopup');
        showMessage('تم تعديل الشركة بنجاح');
        loadManufacturers();
    } catch (error) {
        console.error('خطأ أثناء تعديل الشركة:', error);
        showMessage('حدث خطأ أثناء تعديل الشركة', 'error');
    }
});

// حذف شركة
async function deleteManufacturer(id) {
    const role = await getUserRole();
    if (role !== 'مسؤول النظام') {
        showMessage('غير مصرح لك بحذف الشركة', 'error');
        return;
    }

    if (!confirm('هل أنت متأكد من حذف هذه الشركة؟')) return;

    try {
        const response = await fetch(`/api/manufacturers/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        if (!response.ok) throw new Error('فشل في حذف الشركة');
        showMessage('تم حذف الشركة بنجاح');
        loadManufacturers();
    } catch (error) {
        console.error('خطأ أثناء الحذف:', error);
        showMessage('حدث خطأ أثناء الحذف', 'error');
    }
}

// تصدير البيانات كـ CSV
async function exportData() {
    const role = await getUserRole();
    if (role !== 'مسؤول النظام') {
        showMessage('غير مصرح لك بتصدير البيانات', 'error');
        return;
    }

    try {
        const response = await fetch('/api/manufacturers', {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('فشل في تصدير البيانات');
        const manufacturers = await response.json();

        const headers = ['معرف الشركة', 'اسم الشركة', 'معلومات الاتصال'];
        const csvRows = [headers.join(',')];

        manufacturers.forEach(manufacturer => {
            const values = [
                manufacturer.manufacturer_id,
                `"${manufacturer.manufacturer_name.replace(/"/g, '""')}"`,
                `"${(manufacturer.contact_info || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(values.join(','));
        });
        const csvContent = csvRows.join('\n');

        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'الشركات.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('خطأ أثناء التصدير:', error);
        showMessage('حدث خطأ أثناء تصدير البيانات', 'error');
    }
}

// البحث في الجدول
function search() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const rows = document.querySelectorAll('#manufacturersTable tbody tr');
    let count = 0;

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (query === '' || text.includes(query)) {
            row.style.display = '';
            count++;
        } else {
            row.style.display = 'none';
        }
    });

    const searchResultsCount = document.getElementById('searchResultsCount');
    if (query !== '') {
        searchResultsCount.textContent = `تم العثور على ${count} نتيجة`;
    } else {
        searchResultsCount.textContent = '';
    }
}

// إعادة تعيين البحث
function resetSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResultsCount').textContent = '';
    search();
}

// البحث في الموردين
function searchSuppliers() {
    const query = document.getElementById('supplierSearch').value.trim().toLowerCase();
    const rows = document.querySelectorAll('#suppliersSelectTableBody tr');
    let visibleCount = 0;

    rows.forEach(row => {
        const supplierName = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        if (query === '' || supplierName.includes(query)) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const noResultsMessage = document.getElementById('noSuppliersMessage');
    if (noResultsMessage) {
        noResultsMessage.style.display = visibleCount === 0 && query !== '' ? 'block' : 'none';
    }
}

// عرض الموردين في نافذة منبثقة
async function showSuppliersPopup(manufacturerId) {
    try {
        const response = await fetch(`/api/manufacturers/${manufacturerId}/suppliers`, {
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`فشل في جلب الموردين: ${response.status}`);
        }
        const suppliers = await response.json();
        const tableBody = document.getElementById('suppliersTableBody');
        tableBody.innerHTML = '';

        if (suppliers.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="2" class="no-suppliers">لا يوجد موردون مرتبطون</td></tr>';
        } else {
            suppliers.forEach(supplier => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${supplier.supplier_id}</td>
                    <td>${supplier.suppliername}</td>
                `;
                tableBody.appendChild(row);
            });
        }

        document.getElementById('suppliersPopup').style.display = 'flex';
    } catch (error) {
        console.error('خطأ أثناء جلب الموردين:', error);
        showMessage('حدث خطأ أثناء عرض الموردين', 'error');
    }
}

// إغلاق نافذة الموردين
function closeSuppliersPopup() {
    document.getElementById('suppliersPopup').style.display = 'none';
}

// جلب الموردين
async function fetchSuppliers() {
    try {
        const response = await fetch('/api/suppliers', {
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`فشل في جلب الموردين: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('خطأ أثناء جلب الموردين:', error);
        showMessage('حدث خطأ أثناء جلب الموردين', 'error');
        return [];
    }
}

// فتح نافذة تحديد الموردين
async function openAssignSuppliersPopup(manufacturerId) {
    const role = await getUserRole();
    if (!['مسؤول النظام', 'مدير'].includes(role)) {
        showMessage('غير مصرح لك بتحديد الموردين', 'error');
        return;
    }

    const popup = document.getElementById('assignSuppliersPopup');
    const tableBody = document.getElementById('suppliersSelectTableBody');
    popup.style.display = 'flex';
    tableBody.innerHTML = '<tr><td colspan="3">جارٍ التحميل...</td></tr>';

    try {
        const suppliers = await fetchSuppliers();
        const currentSuppliersResponse = await fetch('/api/manufacturers', {
            credentials: 'include'
        });
        if (!currentSuppliersResponse.ok) {
            throw new Error('فشل في جلب بيانات الشركات');
        }
        const manufacturers = await currentSuppliersResponse.json();
        const currentManufacturer = manufacturers.find(m => m.manufacturer_id === manufacturerId);
        const currentSupplierIds = currentManufacturer?.suppliers.map(s => s.supplier_id) || [];

        tableBody.innerHTML = '';
        if (suppliers.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" class="no-suppliers">لا يوجد موردون متاحون</td></tr>';
        } else {
            suppliers.forEach(supplier => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${supplier.supplier_id}</td>
                    <td>${supplier.suppliername}</td>
                    <td>
                        <input type="checkbox" name="supplier" value="${supplier.supplier_id}"
                               ${currentSupplierIds.includes(supplier.supplier_id) ? 'checked' : ''}>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }

        document.getElementById('assignSuppliersForm').dataset.manufacturerId = manufacturerId;
    } catch (error) {
        console.error('خطأ أثناء فتح نافذة تحديد الموردين:', error);
        showMessage('حدث خطأ أثناء تحميل الموردين', 'error');
        tableBody.innerHTML = '<tr><td colspan="3" class="no-suppliers">فشل في تحميل الموردين</td></tr>';
    }
}

// إغلاق نافذة تحديد الموردين
function closeAssignSuppliersPopup() {
    document.getElementById('assignSuppliersPopup').style.display = 'none';
    const searchContainer = document.querySelector('#assignSuppliersForm .search-container');
    if (searchContainer) searchContainer.remove();
    const noSuppliersMessage = document.getElementById('noSuppliersMessage');
    if (noSuppliersMessage) noSuppliersMessage.remove();
}

// حفظ تحديد الموردين
async function assignSuppliers() {
    const role = await getUserRole();
    if (!['مسؤول النظام', 'مدير'].includes(role)) {
        showMessage('غير مصرح لك بتحديد الموردين', 'error');
        return;
    }

    const manufacturerId = document.getElementById('assignSuppliersForm').dataset.manufacturerId;
    const selectedSuppliers = Array.from(document.querySelectorAll('input[name="supplier"]:checked'))
        .map(input => input.value);

    try {
        const response = await fetch(`/api/manufacturers/${manufacturerId}/suppliers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ supplier_ids: selectedSuppliers }),
            credentials: 'include'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل في تحديث الموردين');
        }
        showMessage('تم تحديث الموردين بنجاح');
        closeAssignSuppliersPopup();
        loadManufacturers();
    } catch (error) {
        console.error('خطأ أثناء تحديث الموردين:', error);
        showMessage(`حدث خطأ أثناء تحديث الموردين`, 'error');
    }
}

// تهيئة الصفحة عند التحميل
window.onload = async () => {
    loadManufacturers();
};