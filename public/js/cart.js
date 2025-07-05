const API_CONFIG = {
  USER: '/api/user',
  PRODUCTS: '/api/products',
  CART: '/api/cart',
  ORDERS: '/api/orders',
  ORDER_RESERVATIONS: '/api/order-reservations',
};

let cart = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await checkUserRole();
    await loadCartItems();
    setupEventListeners();
  } catch (error) {
    console.error('خطأ أثناء تحميل الصفحة:', error);
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
    console.log('بيانات المستخدم من /api/user:', data);
    if (data.role !== 'موظف المستودع') {
      showMessage('فقط موظف المستودع يمكنه الوصول إلى هذه الصفحة', 'error');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      throw new Error('غير مصرح');
    }
  } catch (error) {
    console.error('خطأ في التحقق من دور المستخدم:', error);
    showMessage('حدث خطأ أثناء جلب بيانات المستخدم', 'error');
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
    throw error;
  }
}

function setupEventListeners() {
  const elements = {
    searchBtn: document.getElementById('searchBtn'),
    resetSearchBtn: document.getElementById('resetSearchBtn'),
    continueShopping: document.getElementById('continueShopping'),
    placeOrder: document.getElementById('placeOrder'),
    confirmOrder: document.getElementById('confirmOrder'),
    cancelOrder: document.getElementById('cancelOrder'),
    closeBtn: document.querySelector('.close-btn'),
    closeMessageBtn: document.querySelector('.close-message-btn'),
    searchInput: document.getElementById('productSearch'),
  };

  if (elements.searchBtn) {
    elements.searchBtn.addEventListener('click', searchProducts);
  }
  if (elements.resetSearchBtn) {
    elements.resetSearchBtn.addEventListener('click', resetSearch);
  }
  if (elements.continueShopping) {
    elements.continueShopping.addEventListener('click', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const manufacturerId = urlParams.get('manufacturer_id');
      window.location.href = `/Order_product/products.html?manufacturer_id=${manufacturerId}`;
    });
  }
  if (elements.placeOrder) {
    elements.placeOrder.addEventListener('click', showOrderConfirmation);
  }
  if (elements.confirmOrder) {
    elements.confirmOrder.addEventListener('click', submitOrder);
  }
  if (elements.cancelOrder) {
    elements.cancelOrder.addEventListener('click', hideOrderConfirmation);
  }
  if (elements.closeBtn) {
    elements.closeBtn.addEventListener('click', hideOrderConfirmation);
  }
  if (elements.closeMessageBtn) {
    elements.closeMessageBtn.addEventListener('click', hideMessage);
  }
}

async function loadCartItems() {
  const manufacturerId = new URLSearchParams(window.location.search).get('manufacturer_id');
  if (!manufacturerId) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }

  try {
    const cartResponse = await fetch(`${API_CONFIG.CART}?manufacturer_id=${manufacturerId}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!cartResponse.ok) {
      throw new Error(`فشل جلب عناصر العربة: ${cartResponse.status}`);
    }
    cart = await cartResponse.json();
    console.log('Loaded cart items:', cart);

    if (cart.length === 0) {
      document.getElementById('cartItems').innerHTML = `
        <tr>
          <td colspan="8" class="empty-cart">
            <p>العربة فارغة</p>
          </td>
        </tr>
      `;
      updateSummary([]);
      return;
    }

    const cartWithDetails = cart.map(cartItem => ({
      id: cartItem.product_id,
      cart_id: cartItem.cart_id,
      product_name: cartItem.product_name || 'غير معروف',
      description: cartItem.description || '-',
      barcode: cartItem.barcode || '-',
      category_name: cartItem.category_name || '-',
      unit: cartItem.unit || '-',
      price: cartItem.price != null ? parseFloat(cartItem.price).toFixed(2) : '-',
      quantity: cartItem.quantity,
      product_quantity: cartItem.product_quantity || 0,
      notes: cartItem.notes || '-',
    }));

    renderCartItems(cartWithDetails);
    updateSummary(cartWithDetails);
  } catch (error) {
    console.error('خطأ في تحميل العربة:', error);
    showMessage('حدث خطأ أثناء تحميل العربة', 'error');
    renderCartItems([]);
    updateSummary([]);
  }
}

function renderCartItems(items) {
  const cartItemsContainer = document.getElementById('cartItems');
  if (!cartItemsContainer) {
    console.error('عنصر cartItems غير موجود');
    return;
  }
  cartItemsContainer.innerHTML = '';
  items.forEach(item => {
    const isAvailable = item.product_quantity >= item.quantity;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.product_name || '-'}</td>
      <td>${item.description || '-'}</td>
      <td>${item.barcode || '-'}</td>
      <td>${item.category_name || '-'}</td>
      <td>${item.unit || '-'}</td>
      <td>${item.price !== '-' ? `${item.price} دينار` : '-'}</td>
      <td>
        <div class="quantity-controls">
          <button onclick="updateQuantity(${item.cart_id}, -1)" ${!isAvailable ? 'disabled' : ''}>-</button>
          <input type="number" class="quantity-input" value="${item.quantity}" min="1" data-id="${item.cart_id}" ${!isAvailable ? 'disabled' : ''}>
          <button onclick="updateQuantity(${item.cart_id}, 1)" ${!isAvailable ? 'disabled' : ''}>+</button>
        </div>
      </td>
      <td>
        ${!isAvailable ? `<span class="unavailable">غير متوفر (المتوفر: ${item.product_quantity})</span>` : ''}
        <button class="delete-btn" data-cart-id="${item.cart_id}">حذف</button>
      </td>
    `;
    cartItemsContainer.appendChild(row);
  });

  document.querySelectorAll('.quantity-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const cartId = parseInt(e.target.dataset.id);
      const newQuantity = parseInt(e.target.value);
      await updateQuantity(cartId, newQuantity, true);
    });
  });
  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      const cartId = parseInt(event.target.dataset.cartId);
      await deleteItemFromServer(cartId);
    });
  });
}

async function updateQuantity(cartId, change, isDirect = false) {
  try {
    const item = cart.find(item => item.cart_id === cartId);
    if (!item) {
      showMessage('العنصر غير موجود في العربة', 'error');
      return;
    }

    let newQuantity = isDirect ? (change >= 1 ? change : 1) : ((item.quantity || 1) + change);
    if (newQuantity <= 0) {
      await deleteItemFromServer(cartId);
      return;
    }

    if (newQuantity > item.product_quantity) {
      showMessage(`الكمية المطلوبة (${newQuantity}) أكبر من الكمية المتوفرة (${item.product_quantity})`, 'error');
      newQuantity = item.product_quantity;
    }

    const response = await fetch(`${API_CONFIG.CART}/${cartId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: newQuantity }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `فشل تحديث الكمية: ${response.status}`);
    }

    item.quantity = newQuantity;
    showMessage(`تم تحديث كمية ${item.product_name} إلى ${newQuantity}`, 'success');
    await loadCartItems();
  } catch (error) {
    console.error('خطأ في تحديث الكمية:', error);
    showMessage(`حدث خطأ أثناء تحديث الكمية: ${error.message}`, 'error');
    await loadCartItems();
  }
}

async function deleteItemFromServer(cartId) {
  try {
    const item = cart.find(item => item.cart_id === cartId);
    if (!item) {
      showMessage('العنصر غير موجود في العربة', 'error');
      return;
    }

    const response = await fetch(`${API_CONFIG.CART}/${cartId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `فشل حذف العنصر: ${response.status}`);
    }

    cart = cart.filter(item => item.cart_id !== cartId);
    showMessage(`تم حذف ${item.product_name} من العربة`, 'success');
    await loadCartItems();
  } catch (error) {
    console.error('خطأ في حذف العنصر:', error);
    showMessage(`حدث خطأ أثناء حذف العنصر: ${error.message}`, 'error');
    await loadCartItems();
  }
}

function updateSummary(items) {
  const productsCount = items.length;
  const totalPrice = items.reduce((sum, item) => {
    return item.price !== '-' && item.product_quantity >= item.quantity ? sum + (parseFloat(item.price) * item.quantity) : sum;
  }, 0).toFixed(2);

  const summaryBar = document.getElementById('summaryBar');
  if (summaryBar) {
    summaryBar.innerHTML = `
      <span>عدد المنتجات: ${productsCount}</span>
      <span class="total-price">السعر الكلي: ${totalPrice} دينار</span>
      <button class="btn btn-primary" id="placeOrder">إرسال الطلب</button>
    `;
    const placeOrderBtn = document.getElementById('placeOrder');
    if (placeOrderBtn) {
      placeOrderBtn.addEventListener('click', showOrderConfirmation);
    }
  }
}

function searchProducts() {
  const searchInput = document.getElementById('productSearch');
  const searchResultsCount = document.getElementById('searchResultsCount');
  if (!searchInput) {
    console.error('عنصر productSearch غير موجود');
    showMessage('خطأ: حقل البحث غير موجود', 'error');
    return;
  }
  const searchTerm = searchInput.value.toLowerCase().trim();
  if (!searchTerm) {
    showMessage('يرجى إدخال كلمة للبحث', 'info');
    return;
  }
  const filteredItems = cart.filter(item => {
    return (
      (item.product_name?.toLowerCase().includes(searchTerm) || false) ||
      (item.description?.toLowerCase().includes(searchTerm) || false) ||
      (item.barcode?.toLowerCase().includes(searchTerm) || false) ||
      (item.category_name?.toLowerCase().includes(searchTerm) || false) ||
      (item.unit?.toLowerCase().includes(searchTerm) || false) ||
      (item.price != null && item.price.toString().toLowerCase().includes(searchTerm) || false) ||
      (item.quantity != null && item.quantity.toString().toLowerCase().includes(searchTerm) || false) ||
      (item.product_quantity != null && item.product_quantity.toString().toLowerCase().includes(searchTerm) || false)
    );
  }).map(item => ({
    id: item.product_id,
    cart_id: item.cart_id,
    product_name: item.product_name || 'غير معروف',
    description: item.description || '-',
    barcode: item.barcode || '-',
    category_name: item.category_name || '-',
    unit: item.unit || '-',
    price: item.price != null ? parseFloat(item.price).toFixed(2) : '-',
    quantity: item.quantity,
    product_quantity: item.product_quantity || 0,
    notes: item.notes || '-',
  }));
  renderCartItems(filteredItems);
  updateSummary(filteredItems);
  if (searchResultsCount) {
    searchResultsCount.textContent = `عدد النتائج: ${filteredItems.length}`;
  } else {
    console.warn('عنصر searchResultsCount غير موجود');
  }
}

function resetSearch() {
  const searchInput = document.getElementById('productSearch');
  const searchResultsCount = document.getElementById('searchResultsCount');
  if (searchInput) {
    searchInput.value = '';
  }
  const cartWithDetails = cart.map(cartItem => ({
    id: cartItem.product_id,
    cart_id: cartItem.cart_id,
    product_name: cartItem.product_name || 'غير معروف',
    description: cartItem.description || '-',
    barcode: cartItem.barcode || '-',
    category_name: cartItem.category_name || '-',
    unit: cartItem.unit || '-',
    price: cartItem.price != null ? parseFloat(cartItem.price).toFixed(2) : '-',
    quantity: cartItem.quantity,
    product_quantity: cartItem.product_quantity || 0,
    notes: cartItem.notes || '-',
  }));
  renderCartItems(cartWithDetails);
  updateSummary(cartWithDetails);
  if (searchResultsCount) {
    searchResultsCount.textContent = '';
  }
}

function showOrderConfirmation() {
  if (cart.length === 0) {
    showMessage('العربة فارغة', 'error');
    return;
  }
  const hasInsufficientItems = cart.some(item => item.quantity > item.product_quantity);
  if (hasInsufficientItems) {
    showMessage('لا يمكن إرسال الطلب لوجود منتجات بكميات غير كافية', 'error');
    return;
  }
  const orderConfirmationPopup = document.getElementById('orderConfirmationPopup');
  if (orderConfirmationPopup) {
    orderConfirmationPopup.style.display = 'flex';
  }
}

function hideOrderConfirmation() {
  const orderConfirmationPopup = document.getElementById('orderConfirmationPopup');
  if (orderConfirmationPopup) {
    orderConfirmationPopup.style.display = 'none';
  }
}

async function submitOrder() {
  const urlParams = new URLSearchParams(window.location.search);
  const manufacturerId = urlParams.get('manufacturer_id');
  if (!manufacturerId) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }

  if (cart.length === 0) {
    showMessage('العربة فارغة', 'error');
    return;
  }

  // Prepare order items
  const items = cart
    .map(item => ({
      id: item.product_id,
      quantity: parseInt(item.quantity, 10),
      notes: item.notes || null,
    }))
    .filter(item => {
      if (!item.id || isNaN(item.quantity) || item.quantity <= 0) {
        console.error('Skipping invalid item:', item);
        return false;
      }
      return true;
    });

  if (items.length === 0) {
    showMessage('لا توجد عناصر صالحة في العربة لإنشاء الطلب', 'error');
    return;
  }

  try {
    // Step 1: Reserve quantities
    const reservationResponse = await fetch(API_CONFIG.ORDER_RESERVATIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        manufacturer_id: manufacturerId,
        items: items.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
        })),
      }),
    });

    if (!reservationResponse.ok) {
      const errorData = await reservationResponse.json().catch(() => ({}));
      throw new Error(`فشل حجز الكميات: ${reservationResponse.status} - ${errorData.error || 'خطأ غير معروف'}`);
    }

    const reservationData = await reservationResponse.json();
    console.log('Quantities reserved:', reservationData);

    // Step 2: Create the order
    const orderResponse = await fetch(API_CONFIG.ORDERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        manufacturer_id: manufacturerId,
        reservation_id: reservationData.reservation_id,
        order_id: reservationData.order_id,
        items,
      }),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json().catch(() => ({}));
      // Rollback: Delete reservation and temporary order
      await fetch(`${API_CONFIG.ORDER_RESERVATIONS}/${reservationData.reservation_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      await fetch(`${API_CONFIG.ORDERS}/${reservationData.order_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      throw new Error(`فشل إنشاء الطلب: ${orderResponse.status} - ${errorData.error || 'خطأ غير معروف'}`);
    }

    const orderData = await orderResponse.json();
    console.log('Order created:', orderData);

    // Step 3: Clear the cart
    const clearCartResponse = await fetch(`${API_CONFIG.CART}/clear`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!clearCartResponse.ok) {
      console.warn('فشل مسح العربة:', clearCartResponse.status);
    }

    // Success: Hide confirmation and redirect
    hideOrderConfirmation();
    showMessage('تم إنشاء الطلب بنجاح!', 'success');
    setTimeout(() => {
      window.location.href = `/Order_product/products.html?manufacturer_id=${manufacturerId}`;
    }, 2000);
  } catch (error) {
    console.error('خطأ أثناء إنشاء الطلب:', error);
    showMessage(`خطأ: ${error.message}`, 'error');
  }
}

function showMessage(message, type, duration = 3000) {
  const messagePopup = document.getElementById('messagePopup');
  const messageText = document.getElementById('messageText');
  if (messagePopup && messageText) {
    messageText.textContent = message;
    messagePopup.style.display = 'flex';
    messagePopup.className = `message-header ${type === 'error' ? 'error-message' : type === 'success' ? 'success' : 'info'}`;
    setTimeout(hideMessage, duration);
  }
}

function hideMessage() {
  const messagePopup = document.getElementById('messagePopup');
  if (messagePopup) {
    messagePopup.style.display = 'none';
  }
}