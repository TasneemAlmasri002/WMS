let currentUserRole = null;
let currentUserId = null;
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/user', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    })
        .then(response => {
            if (!response.ok) throw new Error('فشل في جلب بيانات المستخدم');
            return response.json();
        })
        .then(userData => {
            currentUserRole = userData.role;
            currentUserId = userData.user_id;
            console.log('Current user:', { role: currentUserRole, id: currentUserId });
            displaySectionInfo();
            fetchOrders();
            fetchStockProducts();
            document.getElementById('addProductForm')?.addEventListener('submit', addProduct);
            document.getElementById('reportDamageForm').addEventListener('submit', reportDamage);
            document.getElementById('transferToStoreForm').addEventListener('submit', transferToStore);
        })
        .catch(error => {
            console.error('Error fetching user data:', error);
            displayError(error.message);
        });
});
function displaySectionInfo() {
    const params = new URLSearchParams(window.location.search);
    const sectionId = params.get('section_id');
    const sectionInfo = document.getElementById('sectionInfo');
    if (sectionId) {
        sectionInfo.style.display = 'block';
        document.getElementById('sectionId').textContent = sectionId;
        fetchSectionName(sectionId);
    } else {
        sectionInfo.style.display = 'none';
        displayError('معرف القسم غير محدد في عنوان URL');
    }
}
async function fetchSectionName(sectionId) {
    try {
        const response = await fetch(`/api/section/${sectionId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) throw new Error('فشل جلب اسم القسم');
        const data = await response.json();
        document.getElementById('sectionName').textContent = data.success ? data.section.section_name : 'غير متوفر';
    } catch (error) {
        console.error('Error fetching section name:', error);
        document.getElementById('sectionName').textContent = 'خطأ في الجلب';
    }
}
function openModal() {
    const modal = document.getElementById('addProductModal');
    modal.style.display = 'flex';
    document.getElementById('quantity-error').style.display = 'none';
    fetchOrders();
}
function closeModal() {
    const modal = document.getElementById('addProductModal');
    modal.style.display = 'none';
    document.getElementById('addProductForm').reset();
    document.getElementById('quantity-error').style.display = 'none';
    document.getElementById('product_id').innerHTML = '<option value="">اختر اسم المنتج</option>';
}
async function fetchOrders() {
    try {
        const response = await fetch('/api/orders-stock', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) throw new Error('فشل جلب الطلبات');
        const data = await response.json();
        const select = document.getElementById('order_id');
        select.innerHTML = '<option value="">اختر معرف الطلب</option>';
        if (data.success) {
            data.orders.forEach(order => {
                const option = document.createElement('option');
                option.value = order.order_id;
                option.textContent = `طلب #${order.order_id} (${order.status})`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching orders:', error);
        displayError('فشل جلب الطلبات');
    }
}
async function fetchProductsForOrder() {
    const orderId = document.getElementById('order_id').value;
    const productSelect = document.getElementById('product_id');
    productSelect.innerHTML = '<option value="">اختر اسم المنتج</option>';
    if (!orderId) return;
    try {
        const response = await fetch(`/api/order-items-stock/${orderId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) throw new Error('فشل جلب تفاصيل المنتجات');
        const data = await response.json();
        if (data.success) {
            data.orderItems.forEach(item => {
                const option = document.createElement('option');
                option.value = item.product_id;
                const remainingQuantity = item.quantity - (item.stocked_quantity || 0);
                option.textContent = `${item.product_name} (الكمية المتبقية: ${remainingQuantity})`;
                option.dataset.remaining = remainingQuantity;
                productSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching products for order:', error);
        displayError('فشل جلب المنتجات للطلب');
    }
}
async function addProduct(e) {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    const sectionId = params.get('section_id');
    const orderId = document.getElementById('order_id').value;
    const productId = document.getElementById('product_id').value;
    const quantityInput = document.getElementById('quantity');
    const quantity = parseInt(quantityInput.value);
    const manufacturingDate = document.getElementById('manufacturing_date').value;
    const expirationDate = document.getElementById('expiration_date').value;
    const alertEntryDate = document.getElementById('alert_entry_date').value;
    const stockEntryDate = document.getElementById('stock_entry_date').value;
    const quantityError = document.getElementById('quantity-error');
    quantityError.style.display = 'none';
    if (!sectionId) {
        quantityError.textContent = 'معرف القسم غير محدد في عنوان URL';
        quantityError.style.display = 'block';
        return;
    }
    if (!orderId || !productId || !quantity || quantity <= 0) {
        quantityError.textContent = 'جميع الحقول مطلوبة ويجب أن تكون الكمية أكبر من صفر';
        quantityError.style.display = 'block';
        return;
    }
    const productSelect = document.getElementById('product_id');
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    const remainingQuantity = parseInt(selectedOption.dataset.remaining);
    if (isNaN(remainingQuantity) || quantity > remainingQuantity) {
        quantityError.textContent = `الكمية تتجاوز المتبقي (${remainingQuantity})`;
        quantityError.style.display = 'block';
        return;
    }
    const requestBody = {
        section_id: parseInt(sectionId),
        order_id: parseInt(orderId),
        product_id: parseInt(productId),
        quantity,
        manufacturing_date: manufacturingDate || null,
        expiration_date: expirationDate || null,
        alert_entry_date: alertEntryDate || null,
        stock_entry_date: stockEntryDate || null,
    };
    console.log('Sending request to /api/stock-products:', requestBody);
    try {
        const response = await fetch('/api/stock-products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(requestBody),
        });
        const data = await response.json();
        console.log('Response from /api/stock-products:', data);
        if (!response.ok) {
            throw new Error(data.error || 'فشل إضافة المنتج إلى المخزون');
        }
        closeModal();
        fetchStockProducts();
        alert('تم إضافة المنتج بنجاح');
    } catch (error) {
        console.error('Error adding product:', error);
        quantityError.textContent = error.message || 'حدث خطأ أثناء إضافة المنتج';
        quantityError.style.display = 'block';
    }
}
async function fetchStockProducts() {
    const params = new URLSearchParams(window.location.search);
    const sectionId = params.get('section_id');
    const tbody = document.getElementById('stock-table-body');
    if (!sectionId) {
        tbody.innerHTML = '<tr><td colspan="7">يرجى تحديد معرف القسم في عنوان URL</td></tr>';
        return;
    }
    try {
        const response = await fetch(`/api/stock-products?section_id=${sectionId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'فشل جلب منتجات المخزون');
        }
        const data = await response.json();
        tbody.innerHTML = '';
        if (data.success && data.stockProducts.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            data.stockProducts.forEach(product => {
                const expiryDate = product.expiration_date ? new Date(product.expiration_date) : null;
                const alertDate = product.alert_entry_date ? new Date(product.alert_entry_date) : null;
                const daysUntilExpiry = expiryDate ? Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24)) : null;
                const initialDays = expiryDate && product.manufacturing_date ? Math.floor((expiryDate - new Date(product.manufacturing_date)) / (1000 * 60 * 60 * 24)) : 0;
                const nearExpiryThreshold = initialDays * 0.15;

                const isOutOfStock = product.quantity === 0;
                const isExpired = expiryDate && daysUntilExpiry < 0;
                const isNearExpiry = alertDate && daysUntilExpiry > 0 && daysUntilExpiry <= nearExpiryThreshold;
                const initialQuantity = Number(product.initial_quantity) || 0;
                const currentQuantity = Number(product.quantity) || 0;
                const isLowStock = initialQuantity > 0 && currentQuantity > 0 && currentQuantity <= initialQuantity * 0.15;

                let statusClass = '';
                if (isOutOfStock) statusClass = 'out-of-stock';
                else if (isExpired) statusClass = 'expired';
                else if (isNearExpiry) statusClass = 'near-expiry';
                else if (isLowStock) statusClass = 'low-stock';

                const dates = [
                    product.manufacturing_date ? `تاريخ التصنيع: ${new Date(product.manufacturing_date).toLocaleDateString('ar-EG', { timeZone: 'Asia/Riyadh' })}` : '',
                    product.expiration_date ? `تاريخ انتهاء الصلاحية: ${new Date(product.expiration_date).toLocaleDateString('ar-EG', { timeZone: 'Asia/Riyadh' })}` : '',
                    product.alert_entry_date ? `تاريخ التنبيه: ${new Date(product.alert_entry_date).toLocaleDateString('ar-EG', { timeZone: 'Asia/Riyadh' })}` : '',
                    product.stock_entry_date ? `تاريخ الدخول: ${new Date(product.stock_entry_date).toLocaleDateString('ar-EG', { timeZone: 'Asia/Riyadh' })}` : ''
                ].filter(d => d).join('<br>');

                const tr = document.createElement('tr');
                tr.className = statusClass;
                tr.innerHTML = `
                    <td>${product.stock_product_id}</td>
                    <td>${product.stock_id}</td>
                    <td>${product.order_id || 'غير متوفر'}</td>
                    <td>${product.product_name || 'غير متوفر'}</td>
                    <td>${product.quantity}</td>
                    <td>${dates}</td>
                    <td class="action-buttons">
                        ${currentUserRole === 'موظف المستودع' || currentUserRole === 'مدير' ? '<button class="damage-btn">إتلاف</button><button class="transfer-btn">نقل إلى المتجر</button>' : ''}
                    </td>
                `;
                if (currentUserRole === 'موظف المستودع' || currentUserRole === 'مدير') {
                    tr.querySelector('.damage-btn').addEventListener('click', () => openReportDamageModal(product.stock_product_id, product.product_id, sectionId, product.quantity));
                    tr.querySelector('.transfer-btn').addEventListener('click', () => openTransferToStoreModal(product.stock_product_id, product.product_id, sectionId, product.quantity));
                }
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="7">لا توجد منتجات في هذا القسم</td></tr>';
        }
    } catch (error) {
        console.error('Error fetching stock products:', error);
        tbody.innerHTML = `<tr><td colspan="7">خطأ: ${error.message}</td></tr>`;
    }
}
function openReportDamageModal(stockProductId, productId, sectionId, maxQuantity) {
    if (currentUserRole !== 'موظف المستودع' && currentUserRole !== 'مدير') {
        alert('فقط موظف المستودع أو المدير يمكنه تسجيل الإتلاف');
        return;
    }
    const modal = document.getElementById('reportDamageModal');
    modal.style.display = 'flex';
    document.getElementById('damageStockProductId').value = stockProductId;
    document.getElementById('damageProductId').value = productId;
    document.getElementById('damageSectionId').value = sectionId;
    document.getElementById('damageMaxQuantity').value = maxQuantity;
    document.getElementById('damageQuantity').value = maxQuantity;
    document.getElementById('damageQuantity').max = maxQuantity;
    document.getElementById('damageError').style.display = 'none';
    document.getElementById('damageQuantityError').style.display = 'none';
}
function closeReportDamageModal() {
    const modal = document.getElementById('reportDamageModal');
    modal.style.display = 'none';
    document.getElementById('reportDamageForm').reset();
    document.getElementById('damageError').style.display = 'none';
    document.getElementById('damageQuantityError').style.display = 'none';
}
async function reportDamage(e) {
    e.preventDefault();
    const stockProductId = document.getElementById('damageStockProductId').value;
    const productId = document.getElementById('damageProductId').value;
    const sectionId = document.getElementById('damageSectionId').value;
    const maxQuantity = parseInt(document.getElementById('damageMaxQuantity').value);
    const quantity = parseInt(document.getElementById('damageQuantity').value);
    const damageType = document.getElementById('damageType').value;
    const damageReason = document.getElementById('damageReason').value || 'غير محدد';
    const damageError = document.getElementById('damageError');
    const damageQuantityError = document.getElementById('damageQuantityError');
    damageError.style.display = 'none';
    damageQuantityError.style.display = 'none';
    if (!stockProductId || !productId || !sectionId || !currentUserId) {
        damageError.textContent = 'بيانات غير مكتملة';
        damageError.style.display = 'block';
        return;
    }
    if (!damageType) {
        damageError.textContent = 'يرجى تحديد نوع التلف';
        damageError.style.display = 'block';
        return;
    }
    if (isNaN(quantity) || quantity <= 0 || quantity > maxQuantity) {
        damageQuantityError.textContent = `الكمية يجب أن تكون بين 1 و ${maxQuantity}`;
        damageQuantityError.style.display = 'block';
        return;
    }
    try {
        const response = await fetch('/api/damaged-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                stock_product_id: parseInt(stockProductId),
                product_id: parseInt(productId),
                section_id: parseInt(sectionId),
                quantity,
                damage_type: damageType,
                damage_reason: damageReason,
                reported_by: parseInt(currentUserId),
                price: 0,
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'فشل تسجيل الإتلاف');
        }
        closeReportDamageModal();
        fetchStockProducts();
        alert('تم تسجيل الإتلاف بنجاح');
    } catch (error) {
        console.error('Error reporting damage:', error);
        damageError.textContent = error.message || 'حدث خطأ أثناء تسجيل الإتلاف';
        damageError.style.display = 'block';
    }
}
function openTransferToStoreModal(stockProductId, productId, fromSectionId, maxQuantity) {
    if (currentUserRole !== 'موظف المستودع' && currentUserRole !== 'مدير') {
        alert('فقط موظف المستودع أو المدير يمكنه تسجيل النقل إلى المتجر');
        return;
    }
    const modal = document.getElementById('transferToStoreModal');
    modal.style.display = 'flex';
    document.getElementById('transferStockProductId').value = stockProductId;
    document.getElementById('transferProductId').value = productId;
    document.getElementById('transferFromSectionId').value = fromSectionId;
    document.getElementById('transferMaxQuantity').value = maxQuantity;
    document.getElementById('transferQuantity').value = maxQuantity;
    document.getElementById('transferQuantity').max = maxQuantity;
    document.getElementById('transferDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('transferError').style.display = 'none';
    document.getElementById('transferQuantityError').style.display = 'none';
    document.getElementById('transferDateError').style.display = 'none';
    document.getElementById('transferNotes').value = '';
}
function closeTransferToStoreModal() {
    const modal = document.getElementById('transferToStoreModal');
    modal.style.display = 'none';
    document.getElementById('transferToStoreForm').reset();
    document.getElementById('transferError').style.display = 'none';
    document.getElementById('transferQuantityError').style.display = 'none';
    document.getElementById('transferDateError').style.display = 'none';
}
// دالة لنقل المنتجات إلى المتجر )
async function transferToStore(e) {
    e.preventDefault();
    const stockProductId = document.getElementById('transferStockProductId').value;
    const productId = document.getElementById('transferProductId').value;
    const fromSectionId = document.getElementById('transferFromSectionId').value;
    const maxQuantity = parseInt(document.getElementById('transferMaxQuantity').value);
    const quantity = parseInt(document.getElementById('transferQuantity').value);
    const transferDate = document.getElementById('transferDate').value;
    const notes = document.getElementById('transferNotes').value || null;
    const transferError = document.getElementById('transferError');
    const transferQuantityError = document.getElementById('transferQuantityError');
    const transferDateError = document.getElementById('transferDateError');
    transferError.style.display = 'none';
    transferQuantityError.style.display = 'none';
    transferDateError.style.display = 'none';
    // التحقق من البيانات
    if (!stockProductId || !productId || !fromSectionId || !currentUserId) {
        transferError.textContent = 'بيانات غير مكتملة';
        transferError.style.display = 'block';
        return;
    }
    if (isNaN(quantity) || quantity <= 0 || quantity > maxQuantity) {
        transferQuantityError.textContent = `الكمية يجب أن تكون بين 1 و ${maxQuantity}`;
        transferQuantityError.style.display = 'block';
        return;
    }
    if (!transferDate) {
        transferDateError.textContent = 'يرجى تحديد تاريخ النقل';
        transferDateError.style.display = 'block';
        return;
    }
    const requestBody = {
        stock_product_id: parseInt(stockProductId),
        product_id: parseInt(productId),
        from_section_id: parseInt(fromSectionId),
        quantity,
        transfer_date: transferDate,
        notes,
        transferred_by: parseInt(currentUserId),
    };
    try {
        const response = await fetch('/api/transfer-to-store', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(requestBody),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'فشل النقل إلى المتجر');
        }
        closeTransferToStoreModal();
        fetchStockProducts(); // تحديث قائمة المخزون
        alert('تم النقل إلى المتجر بنجاح');
    } catch (error) {
        console.error('Error transferring to store:', error);
        transferError.textContent = error.message || 'حدث خطأ أثناء النقل إلى المتجر';
        transferError.style.display = 'block';
    }
}
// دالة جديدة لجلب سجلات النقل
async function fetchTransferRecords(sectionId) {
    const tbody = document.getElementById('transfer-table-body'); // افتراض وجود جدول في HTML
    if (!tbody) return;
    try {
        const query = sectionId ? `?section_id=${sectionId}` : '';
        const response = await fetch(`/api/transfer-to-store${query}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('فشل جلب سجلات النقل');
        }
        const data = await response.json();
        tbody.innerHTML = '';
        if (data.success && data.transfers.length > 0) {
            data.transfers.forEach(transfer => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${transfer.transfer_id}</td>
                    <td>${transfer.stock_product_id || 'غير متوفر'}</td>
                    <td>${transfer.product_name || 'غير متوفر'}</td>
                    <td>${transfer.section_name || 'غير متوفر'}</td>
                    <td>${transfer.quantity}</td>
                    <td>${new Date(transfer.transfer_date).toLocaleDateString('ar-EG')}</td>
                    <td>${transfer.notes || 'لا توجد ملاحظات'}</td>
                    <td>${transfer.transferred_by_name || 'غير متوفر'}</td>
                    <td>${new Date(transfer.created_at).toLocaleDateString('ar-EG')}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="9">لا توجد سجلات نقل</td></tr>';
        }
    } catch (error) {
        console.error('Error fetching transfer records:', error);
        tbody.innerHTML = `<tr><td colspan="9">خطأ: ${error.message}</td></tr>`;
    }
}
// إضافة مستمع لتحديث سجلات النقل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const sectionId = params.get('section_id');
    if (sectionId) {
        fetchTransferRecords(sectionId);
    }
});
function displayError(message) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-message';
    errorContainer.style.color = '#D32F2F';
    errorContainer.style.margin = '10px 0';
    errorContainer.style.textAlign = 'center';
    errorContainer.textContent = message;
    document.querySelector('.content').prepend(errorContainer);
    setTimeout(() => errorContainer.remove(), 5000);
}