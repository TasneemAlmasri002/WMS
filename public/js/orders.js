const API_CONFIG = {
  USER: '/api/user',
  ORDERS: '/api/orders-manage'
};
let orders = [];
let currentUserRole = null;
const activeTimers = new Map(); // لتتبع المؤقتات النشطة
document.addEventListener('DOMContentLoaded', async () => {
  const hasAccess = await checkUserRole();
  if (hasAccess) {
    setupEventListeners();
    loadOrders();
  }
});
async function checkUserRole() {
  try {
    const response = await fetch(API_CONFIG.USER, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`فشل جلب بيانات المستخدم: ${response.status}`);
    }
    const data = await response.json();
    console.log('User role:', data.role);
    const validRoles = ['مسؤول النظام', 'مدير'];
    if (!validRoles.includes(data.role)) {
      showMessage('فقط مسؤول النظام أو المدير يمكنه الوصول إلى إدارة الطلبات', 'error');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      return false;
    }
    currentUserRole = data.role;
    localStorage.setItem('user_role', data.role);
    return true;
  } catch (error) {
    console.error('خطأ في التحقق من دور المستخدم:', error);
    showMessage('حدث خطأ أثناء جلب بيانات المستخدم', 'error');
    setTimeout(() => {
      window.location.href = '/';
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
    orderPopup: document.getElementById('orderPopup'),
    closeMessageBtn: document.querySelector('.close-message-btn')
  };
  if (!elements.ordersTableBody) {
    console.error('عنصر ordersTableBody غير موجود');
    return;
  }
  if (!elements.orderPopup) {
    console.error('عنصر orderPopup غير موجود');
    return;
  }
  if (elements.searchBtn) {
    elements.searchBtn.addEventListener('click', searchOrders);
  }
  if (elements.resetSearchBtn) {
    elements.resetSearchBtn.addEventListener('click', resetSearch);
  }
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', searchOrders);
  }
  if (elements.statusButtons) {
    elements.statusButtons.forEach(button => {
      button.addEventListener('click', () => {
        elements.statusButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        filterOrdersByStatus(button.dataset.status);
      });
    });
  }
  elements.ordersTableBody.addEventListener('click', handleOrderActions);
  if (elements.closeMessageBtn) {
    elements.closeMessageBtn.addEventListener('click', hideMessage);
  }
}
async function loadOrders() {
  try {
    console.log('Loading orders...');
    const response = await fetch(API_CONFIG.ORDERS, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`فشل جلب الطلبات: ${response.status} - ${errorData.message || response.statusText}`);
    }
    const data = await response.json();
    orders = data.items || [];
    if (orders.length === 0) {
      document.getElementById('ordersTableBody').innerHTML = `
        <tr>
          <td colspan="7" class="empty-table">
            <p>لا توجد طلبات</p>
          </td>
        </tr>
      `;
      updateSearchResultsCount(0);
      return;
    }
    // جلب بيانات الحجوزات لكل طلب
    for (let order of orders) {
      try {
        const reservationsResponse = await fetch(`${API_CONFIG.ORDERS}/${order.order_id}/reservations`, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (reservationsResponse.ok) {
          const reservationsData = await reservationsResponse.json();
          const reservations = reservationsData.reservations || [];
          const nearestExpiry = reservations.reduce((earliest, res) => {
            if (!res.reservation_expiry) return earliest;
            const expiry = new Date(res.reservation_expiry);
            return !earliest || expiry < earliest ? expiry : earliest;
          }, null);
          order.reservation_expiry = nearestExpiry ? nearestExpiry.toISOString() : null;
        } else {
          order.reservation_expiry = null;
        }
      } catch (error) {
        console.warn(`فشل جلب الحجوزات للطلب ${order.order_id}:`, error.message);
        order.reservation_expiry = null;
      }
    }
    const ordersWithDetails = orders
      .filter(order => order.status !== 'تفاصيل إضافية')
      .map(order => ({
        order_id: order.order_id,
        order_date: new Date(order.order_date).toISOString().split('T')[0],
        manufacturer_name: order.manufacturer_name || 'غير معروف',
        amount: order.amount != null ? parseFloat(order.amount).toFixed(2) : '-',
        status: order.status || '-',
        employee_name: order.employee_name || 'غير معروف',
        user_status: order.user_status || 'Active',
        rejection_reason: order.rejection_reason || '-',
        reservation_expiry: order.reservation_expiry,
      }));
    renderOrders(ordersWithDetails);
    updateSearchResultsCount(ordersWithDetails.length);
  } catch (error) {
    console.error('خطأ في تحميل الطلبات:', error);
    showMessage(`حدث خطأ أثناء تحميل الطلبات: ${error.message}`, 'error');
    renderOrders([]);
    updateSearchResultsCount(0);
  }
}
async function showOrderDetailsPopup(orderId) {
  const orderPopup = document.getElementById('orderPopup');
  const popupContent = orderPopup?.querySelector('.popup-content');
  if (!orderPopup || !popupContent) {
    console.error('عنصر orderPopup أو popup-content غير موجود');
    showMessage('خطأ: النافذة المنبثقة غير متوفرة', 'error');
    return;
  }
  try {
    console.log('Fetching details for order:', orderId);
    const response = await fetch(`${API_CONFIG.ORDERS}/${orderId}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    console.log('Details response status:', response.status);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`فشل جلب تفاصيل الطلب: ${response.status} - ${errorData.message || response.statusText}`);
    }
    const data = await response.json();
    const order = data.order;
    const items = data.items || [];
    console.log('Order details:', { order, items });
    let reservations = [];
    try {
      const reservationsResponse = await fetch(`${API_CONFIG.ORDERS}/${orderId}/reservations`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (reservationsResponse.ok) {
        const reservationsData = await reservationsResponse.json();
        reservations = reservationsData.reservations || [];
        console.log('Reservations:', reservations);
      } else if (reservationsResponse.status === 404) {
        console.log('No reservations found for order:', orderId);
      } else {
        throw new Error(`فشل جلب بيانات الحجوزات: ${reservationsResponse.status}`);
      }
    } catch (reservationError) {
      console.warn('خطأ في جلب بيانات الحجوزات، قد لا توجد حجوزات:', reservationError.message);
    }
    let reservationsHtml = '';
    if (reservations.length > 0) {
      reservationsHtml = `
        <h3>الحجوزات المرتبطة بالطلب</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>رقم الحجز</th>
              <th>الكمية المحجوزة</th>
              <th>الوقت المتبقي</th>
            </tr>
          </thead>
          <tbody id="reservationsTableBody-${orderId}">
            ${reservations.map(res => `
              <tr id="reservation-row-${res.reservation_id}">
                <td>${res.reservation_id || 'غير معروف'}</td>
                <td>${res.reserved_quantity || '-'}</td>
                <td id="timer-${res.reservation_id}">-</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      reservationsHtml = '<p>لا توجد حجوزات مرتبطة بهذا الطلب</p>';
    }
    let itemsHtml = '';
    if (items.length > 0) {
      itemsHtml = `
        <h3>المنتجات في الطلب</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>اسم المنتج</th>
              <th>الكمية</th>
              <th>السعر (دينار)</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.product_name || 'غير معروف'}</td>
                <td>${item.quantity || '-'}</td>
                <td>${item.price != null ? parseFloat(item.price).toFixed(2) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      itemsHtml = '<p>لا توجد منتجات مرتبطة بهذا الطلب</p>';
    }
    popupContent.innerHTML = `
      <span class="close-btn">×</span>
      <h2>تفاصيل الطلب رقم ${order.order_id}</h2>
      <p><strong>تاريخ الطلب:</strong> ${new Date(order.order_date).toISOString().split('T')[0]}</p>
      <p><strong>اسم الشركة:</strong> ${order.manufacturer_name || 'غير معروف'}</p>
      <p><strong>اسم الموظف:</strong> ${order.employee_name || 'غير معروف'}</p>
      <p><strong>المبلغ:</strong> ${order.amount != null ? parseFloat(order.amount).toFixed(2) + ' دينار' : '-'}</p>
      <p><strong>الحالة:</strong> ${order.status || '-'}</p>
      <p><strong>حالة المستخدم:</strong> ${order.user_status === 'Active' ? 'نشط' : 'غير نشط'}</p>
      ${order.rejection_reason ? `<p><strong>سبب الرفض:</strong> ${order.rejection_reason}</p>` : ''}
      ${reservationsHtml}
      ${itemsHtml}
      <button class="btn btn-secondary close-popup-btn">إغلاق</button>
    `;
    orderPopup.style.display = 'flex';
    reservations.forEach(res => {
      if (res.reservation_expiry && new Date(res.reservation_expiry) > new Date()) {
        startCountdown(res.reservation_id, new Date(res.reservation_expiry), orderId, order.status, `reservation-row-${res.reservation_id}`);
      } else if (res.reservation_expiry) {
        document.getElementById(`timer-${res.reservation_id}`).textContent = 'انتهى الوقت';
      }
    });
    const closeBtn = popupContent.querySelector('.close-btn');
    const closePopupBtn = popupContent.querySelector('.close-popup-btn');
    [closeBtn, closePopupBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          orderPopup.style.display = 'none';
          // إيقاف المؤقتات المرتبطة بالحجوزات المعروضة فقط
          reservations.forEach(res => {
            if (activeTimers.has(res.reservation_id)) {
              clearInterval(activeTimers.get(res.reservation_id));
              activeTimers.delete(res.reservation_id);
            }
          });
        });
      }
    });
  } catch (error) {
    console.error('خطأ في جلب تفاصيل الطلب:', error);
    showMessage(`حدث خطأ أثناء جلب تفاصيل الطلب: ${error.message}`, 'error');
  }
}
function startCountdown(reservationId, expiryDate, orderId, currentStatus, rowId) {
  const timerElement = document.getElementById(`timer-${reservationId}`);
  const rowElement = document.getElementById(rowId);
  if (!timerElement || !rowElement) return;
  // التحقق مما إذا كان الحجز قد انتهى
  const now = new Date();
  if (now >= expiryDate) {
    timerElement.textContent = 'انتهى الوقت';
    return;
  }
  const updateTimer = async () => {
    const now = new Date();
    const timeLeft = expiryDate - now;
    if (timeLeft <= 0) {
      timerElement.textContent = 'انتهى الوقت';
      if (activeTimers.has(reservationId)) {
        clearInterval(activeTimers.get(reservationId));
        activeTimers.delete(reservationId);
      }
      // إعادة تحميل الطلبات لتعكس تحديث الخادم
      await loadOrders();
      return;
    }
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    timerElement.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  updateTimer();
  const interval = setInterval(updateTimer, 1000);
  activeTimers.set(reservationId, interval);
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
    row.id = `order-row-${order.order_id}`;
    let actionContent = '';
    const lockedStatuses = ['موافق عليه', 'مرفوض', 'مكتمل'];
    const canModify = !lockedStatuses.includes(order.status) && ['مدير', 'مسؤول النظام'].includes(currentUserRole);
    console.log('Render order:', { order_id: order.order_id, status: order.status, canModify, currentUserRole });
    if (lockedStatuses.includes(order.status)) {
      if (order.status === 'موافق عليه') {
        actionContent = 'تم الموافقة';
      } else if (order.status === 'مرفوض') {
        actionContent = 'تم الرفض';
      } else if (order.status === 'مكتمل') {
        actionContent = 'مكتمل';
      }
    } else {
      actionContent = `
        <button class="btn btn-primary approve-btn" data-id="${order.order_id}">موافقة</button>
        <button class="btn btn-danger reject-btn" data-id="${order.order_id}">رفض</button>
      `;
    }
    actionContent = `
      <button class="btn btn-info details-btn" data-id="${order.order_id}">عرض التفاصيل</button>
      ${actionContent}
    `;
    row.innerHTML = `
      <td>${order.order_id}</td>
      <td>${order.order_date}</td>
      <td>${order.manufacturer_name}</td>
      <td>${order.employee_name}</td>
      <td>${order.amount !== '-' ? `${order.amount} دينار` : '-'}</td>
      <td>${order.status}</td>
      <td>${actionContent}</td>
    `;
    ordersTableBody.appendChild(row);
    // تطبيق تنبيهات الألوان بناءً على reservation_expiry في الجدول الرئيسي
    if (order.reservation_expiry && new Date(order.reservation_expiry) > new Date()) {
      const now = new Date();
      const timeLeft = new Date(order.reservation_expiry) - now;
      if (timeLeft <= 1800000) { // أقل من 30 دقيقة
        row.style.backgroundColor = '#ff0000'; // أحمر قوي
      } else if (timeLeft <= 3600000) { // أقل من ساعة
        row.style.backgroundColor = '#ffcccc'; // أحمر فاتح
      }
    }
  });
}
async function handleOrderActions(event) {
  const orderId = parseInt(event.target.dataset.id);
  if (!orderId) return;
  console.log('Handling action for order:', orderId, 'Button:', event.target.className);
  try {
    const response = await fetch(API_CONFIG.USER, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('فشل التحقق من الصلاحيات');
    }
    const user = await response.json();
    if (!['مدير', 'مسؤول النظام'].includes(user.role)) {
      showMessage('غير مصرح لك بتغيير حالة الطلب', 'error');
      return;
    }
    if (event.target.classList.contains('approve-btn')) {
      await updateOrderStatus(orderId, 'موافق عليه');
    } else if (event.target.classList.contains('reject-btn')) {
      showRejectPopup(orderId);
    } else if (event.target.classList.contains('details-btn')) {
      await showOrderDetailsPopup(orderId);
    }
  } catch (error) {
    console.error('خطأ في التحقق من الصلاحيات:', error);
    showMessage('حدث خطأ أثناء التحقق من الصلاحيات', 'error');
  }
}
async function updateOrderStatus(orderId, newStatus, rejectionReason = '') {
  try {
    console.log('Updating order:', { orderId, newStatus, rejectionReason });
    // جلب الحجوزات المرتبطة بالطلب لإيقاف المؤقتات
    const reservationsResponse = await fetch(`${API_CONFIG.ORDERS}/${orderId}/reservations`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    let reservationIds = [];
    if (reservationsResponse.ok) {
      const reservationsData = await reservationsResponse.json();
      reservationIds = (reservationsData.reservations || []).map(res => res.reservation_id);
    }
    // إيقاف المؤقتات المرتبطة بالحجوزات
    reservationIds.forEach(reservationId => {
      if (activeTimers.has(reservationId)) {
        clearInterval(activeTimers.get(reservationId));
        activeTimers.delete(reservationId);
      }
    });
    // إرسال طلب تحديث الحالة
    const response = await fetch(`${API_CONFIG.ORDERS}/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, rejection_reason: rejectionReason }),
      credentials: 'include'
    });
    const result = await response.json();
    console.log('Update response:', result);
    if (!response.ok) {
      throw new Error(`${result.message || 'فشل تحديث حالة الطلب'}: ${result.sqlMessage || ''}`);
    }
    showMessage(`تم تحديث حالة الطلب بنجاح`, 'success');
    await loadOrders();
  } catch (error) {
    console.error('خطأ في تحديث حالة الطلب:', error);
    showMessage(`حدث خطأ أثناء تحديث حالة الطلب: ${error.message}`, 'error');
  }
}
function showRejectPopup(orderId) {
  const orderPopup = document.getElementById('orderPopup');
  const popupContent = orderPopup?.querySelector('.popup-content');
  if (!orderPopup || !popupContent) {
    console.error('عنصر orderPopup أو popup-content غير موجود');
    showMessage('خطأ: النافذة المنبثقة غير متوفرة', 'error');
    return;
  }
  popupContent.innerHTML = `
    <span class="close-btn">×</span>
    <h2>رفض الطلب</h2>
    <form id="rejectForm">
      <label>سبب الرفض:</label>
      <textarea id="rejectionReason" placeholder="أدخل سبب الرفض" required></textarea>
      <button type="submit" class="btn btn-danger">تأكيد الرفض</button>
      <button type="button" class="btn btn-secondary cancel-btn">إلغاء</button>
    </form>
  `;
  orderPopup.style.display = 'flex';
  const rejectForm = document.getElementById('rejectForm');
  if (rejectForm) {
    rejectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rejectionReason = document.getElementById('rejectionReason').value;
      await updateOrderStatus(orderId, 'مرفوض', rejectionReason);
      orderPopup.style.display = 'none';
    });
  }
  const closeBtn = popupContent.querySelector('.close-btn');
  const cancelBtn = popupContent.querySelector('.cancel-btn');
  [closeBtn, cancelBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        orderPopup.style.display = 'none';
      });
    }
  });
}
function searchOrders() {
  const searchInput = document.getElementById('searchInput');
  const searchResultsCount = document.getElementById('searchResultsCount');
  if (!searchInput) {
    console.error('عنصر searchInput غير موجود');
    showMessage('خطأ: حقل البحث غير موجود', 'error');
    return;
  }
  const searchTerm = searchInput.value.toLowerCase().trim();
  if (!searchTerm) {
    showMessage('يرجى إدخال كلمة للبحث', 'info');
    return;
  }
  const filteredOrders = orders
    .filter(order => order.status !== 'تفاصيل إضافية')
    .filter(order =>
      order.order_id.toString().includes(searchTerm) ||
      order.manufacturer_name.toLowerCase().includes(searchTerm) ||
      order.employee_name.toLowerCase().includes(searchTerm) ||
      order.status.toLowerCase().includes(searchTerm) ||
      order.rejection_reason?.toLowerCase().includes(searchTerm)
    ).map(order => ({
      order_id: order.order_id,
      order_date: new Date(order.order_date).toISOString().split('T')[0],
      manufacturer_name: order.manufacturer_name || 'غير معروف',
      amount: order.amount != null ? parseFloat(order.amount).toFixed(2) : '-',
      status: order.status || '-',
      employee_name: order.employee_name || 'غير معروف',
      user_status: order.user_status || 'Active',
      rejection_reason: order.rejection_reason || '-',
      reservation_expiry: order.reservation_expiry,
    }));
  renderOrders(filteredOrders);
  updateSearchResultsCount(filteredOrders.length);
}
function resetSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchResultsCount = document.getElementById('searchResultsCount');
  if (searchInput) {
    searchInput.value = '';
  }
  const ordersWithDetails = orders
    .filter(order => order.status !== 'تفاصيل إضافية')
    .map(order => ({
      order_id: order.order_id,
      order_date: new Date(order.order_date).toISOString().split('T')[0],
      manufacturer_name: order.manufacturer_name || 'غير معروف',
      amount: order.amount != null ? parseFloat(order.amount).toFixed(2) : '-',
      status: order.status || '-',
      employee_name: order.employee_name || 'غير معروف',
      user_status: order.user_status || 'Active',
      rejection_reason: order.rejection_reason || '-',
      reservation_expiry: order.reservation_expiry,
    }));
  renderOrders(ordersWithDetails);
  updateSearchResultsCount(ordersWithDetails.length);
}
function filterOrdersByStatus(status) {
  const filteredOrders = status === '' ? orders : orders.filter(order => order.status === status && order.status !== 'تفاصيل إضافية');
  const ordersWithDetails = filteredOrders.map(order => ({
    order_id: order.order_id,
    order_date: new Date(order.order_date).toISOString().split('T')[0],
    manufacturer_name: order.manufacturer_name || 'غير معروف',
    amount: order.amount != null ? parseFloat(order.amount).toFixed(2) : '-',
    status: order.status || '-',
    employee_name: order.employee_name || 'غير معروف',
    user_status: order.user_status || 'Active',
    rejection_reason: order.rejection_reason || '-',
    reservation_expiry: order.reservation_expiry,
  }));
  renderOrders(ordersWithDetails);
  updateSearchResultsCount(filteredOrders.length);
}
function updateSearchResultsCount(count) {
  const searchResultsCount = document.getElementById('searchResultsCount');
  if (searchResultsCount) {
    searchResultsCount.textContent = `عدد النتائج: ${count}`;
  } else {
    console.warn('عنصر searchResultsCount غير موجود');
  }
}
let lastMessage = null;
function showMessage(message, type) {
  if (lastMessage === message) return; // منع تكرار الرسالة
  lastMessage = message;
  const messagePopup = document.getElementById('messagePopup');
  const messageText = document.getElementById('messageText');
  if (messagePopup && messageText) {
    messageText.textContent = message;
    messagePopup.style.display = 'flex';
    messagePopup.className = `message-header ${type === 'error' ? 'error-message' : type === 'success' ? 'success' : 'info'}`;
    setTimeout(() => {
      hideMessage();
      lastMessage = null;
    }, 3000);
  } else {
    console.error('عنصر messagePopup أو messageText غير موجود');
  }
}
function hideMessage() {
  const messagePopup = document.getElementById('messagePopup');
  if (messagePopup) {
    messagePopup.style.display = 'none';
  }
} 