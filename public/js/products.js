let currentCategory = 'all';
let currentStatus = 'all';
let userRole = null;
let userId = null;

// Show notification message
function showMessage(text, type = 'info') {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) {
    document.getElementById('messageText').textContent = text;
    messageBox.style.display = 'flex';
    messageBox.className = `message-header ${type === 'error' ? 'error-message' : type === 'success' ? 'success' : 'info'}`;
    setTimeout(hideMessage, 3000);
  } else {
    console.warn('عنصر messageBox غير موجود، عرض الرسالة في وحدة التحكم:', text);
  }
}

// Hide notification message
function hideMessage() {
  const messageBox = document.getElementById('messageBox');
  if (messageBox) messageBox.style.display = 'none';
}

// Close popup
function closePopup(popupId) {
  const popup = document.getElementById(popupId);
  if (popup) popup.style.display = 'none';
}

// Update UI based on user role
function updateUIBasedOnRole() {
  const isSupplier = userRole === 'مورد';
  const isWarehouseEmployee = userRole === 'موظف المستودع';
  const isManagerOrAdmin = userRole === 'مدير' || userRole === 'مسؤول نظام';
  const addProductBtn = document.querySelector('.add-product-btn');
  const manageCategoriesBtn = document.querySelector('.manage-categories-btn');
  const exportBtn = document.querySelector('.export-btn');
  const importBtn = document.querySelector('.import-btn');
  const cartBtn = document.querySelector('.cart-btn');
  const backBtn = document.querySelector('.back-btn');
  const actionsColumn = document.querySelector('.actions-column');
  const actionsCells = document.querySelectorAll('.action-buttons');

  // إعادة تعيين الحالة الافتراضية للأزرار
  if (addProductBtn) addProductBtn.classList.add('hidden');
  if (manageCategoriesBtn) manageCategoriesBtn.classList.add('hidden');
  if (exportBtn) exportBtn.classList.add('hidden');
  if (importBtn) importBtn.classList.add('hidden');
  if (cartBtn) cartBtn.classList.add('hidden');
  if (backBtn) backBtn.classList.remove('hidden');
  // إبقاء actionsColumn و actionsCells مرئية افتراضيًا
  if (actionsColumn) actionsColumn.classList.remove('hidden');
  actionsCells.forEach(cell => cell.classList.remove('hidden'));

  if (isWarehouseEmployee) {
    if (cartBtn) cartBtn.classList.remove('hidden');
    if (actionsColumn) actionsColumn.classList.remove('hidden');
    actionsCells.forEach(cell => cell.classList.remove('hidden'));
  } else if (isSupplier) {
    if (addProductBtn) addProductBtn.classList.remove('hidden');
    if (manageCategoriesBtn) manageCategoriesBtn.classList.remove('hidden');
    if (exportBtn) exportBtn.classList.remove('hidden');
    if (importBtn) importBtn.classList.remove('hidden');
    if (actionsColumn) actionsColumn.classList.remove('hidden');
    actionsCells.forEach(cell => cell.classList.remove('hidden'));
  } else if (isManagerOrAdmin) {
    // يمكنك إضافة منطق إضافي هنا إذا أردت تحديد إجراءات خاصة بالمدير/الإداري
  }
}

// Open add product popup
function openAddProductPopup() {
  if (userRole !== 'مورد') {
    showMessage('غير مصرح لك بإضافة منتجات، هذه العملية متاحة للمورد فقط', 'error');
    return;
  }
  const urlParams = new URLSearchParams(window.location.search);
  const manufacturerId = urlParams.get('manufacturer_id');
  if (!manufacturerId) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }
  document.getElementById('manufacturerId').value = manufacturerId;
  loadCategoriesForSelect();
  document.getElementById('addProductPopup').style.display = 'flex';
}

// Open manage categories popup
function openManageCategoriesPopup() {
  if (userRole !== 'مورد') {
    showMessage('غير مصرح لك بإدارة الأصناف، هذه العملية متاحة للمورد فقط', 'error');
    return;
  }
  const urlParams = new URLSearchParams(window.location.search);
  const manufacturerId = urlParams.get('manufacturer_id');
  if (!manufacturerId) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }
  document.getElementById('manageManufacturerId').value = manufacturerId;
  loadCategories();
  document.getElementById('manageCategoriesPopup').style.display = 'flex';
}

// Open edit product popup
function openEditProductPopup(productId) {
  if (userRole !== 'مورد') {
    showMessage('غير مصرح لك بتعديل منتجات، هذه العملية متاحة للمورد فقط', 'error');
    return;
  }
  const urlParams = new URLSearchParams(window.location.search);
  const manufacturerId = urlParams.get('manufacturer_id');
  if (!manufacturerId) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }
  fetch(`/api/products?manufacturer_id=${manufacturerId}`)
    .then(response => {
      if (!response.ok) throw new Error(`فشل في جلب المنتجات: ${response.status}`);
      return response.json();
    })
    .then(products => {
      const product = products.find(p => p.product_id === productId);
      if (!product) {
        showMessage('المنتج غير موجود', 'error');
        return;
      }
      document.getElementById('editProductId').value = product.product_id;
      document.getElementById('editProductName').value = product.product_name;
      document.getElementById('editDescription').value = product.description || '';
      document.getElementById('editBarcode').value = product.barcode || '';
      document.getElementById('editUnit').value = product.unit || '';
      document.getElementById('editPrice').value = product.price != null ? product.price : '';
      document.getElementById('editQuantity').value = product.quantity || 0;
      document.getElementById('editManufacturerId').value = product.manufacturer_id;
      loadCategoriesForEditSelect(product.category_id);
      document.getElementById('editProductPopup').style.display = 'flex';
    })
    .catch(error => {
      console.error('خطأ أثناء جلب بيانات المنتج:', error);
      showMessage(`حدث خطأ: ${error.message}`, 'error');
    });
}

// Open add to cart popup
function openAddToCartPopup(product) {
  console.log('فتح نافذة إضافة المنتج:', product);
  if (userRole !== 'موظف المستودع') {
    showMessage('فقط موظف المستودع يمكنه إضافة المنتجات إلى الطلب', 'error');
    return;
  }
  if (!product || product.quantity <= 0) {
    showMessage('لا يمكن إضافة هذا المنتج لأنه غير متوفر أو غير صالح', 'error');
    return;
  }
  const cartProductIdInput = document.getElementById('cartProductId');
  if (!cartProductIdInput) {
    console.error('حقل cartProductId غير موجود في النموذج');
    showMessage('خطأ في النموذج: حقل معرف المنتج غير موجود', 'error');
    return;
  }
  cartProductIdInput.value = product.product_id;
  const quantityInput = document.querySelector('#addToCartForm input[name="quantity"]');
  if (!quantityInput) {
    console.error('حقل quantity غير موجود في النموذج');
    showMessage('خطأ في النموذج: حقل الكمية غير موجود', 'error');
    return;
  }
  quantityInput.value = '1';
  const notesInput = document.querySelector('#addToCartForm textarea[name="notes"]');
  if (notesInput) {
    notesInput.value = '';
  }
  const detailsDiv = document.getElementById('cartProductDetails');
  if (!detailsDiv) {
    console.error('عنصر cartProductDetails غير موجود');
    showMessage('خطأ في النموذج: حقل تفاصيل المنتج غير موجود', 'error');
    return;
  }
  const price = product.price != null && !isNaN(product.price) ? Number(product.price).toFixed(2) : '-';
  detailsDiv.innerHTML = `
    <p><strong>اسم المنتج:</strong> ${product.product_name || '-'}</p>
    <p><strong>الصنف:</strong> ${product.category_name || '-'}</p>
    <p><strong>الوصف:</strong> ${product.description || '-'}</p>
    <p><strong>الباركود:</strong> ${product.barcode || '-'}</p>
    <p><strong>الوحدة:</strong> ${product.unit || '-'}</p>
    <p><strong>السعر:</strong> ${price}</p>
    <p><strong>الكمية المتوفرة:</strong> ${product.quantity}</p>
  `;
  const popup = document.getElementById('addToCartPopup');
  if (!popup) {
    console.error('عنصر addToCartPopup غير موجود');
    showMessage('خطأ في النافذة المنبثقة', 'error');
    return;
  }
  popup.style.display = 'flex';
}

// Go back to companies page
function goBackToCompanies() {
  window.location.href = '/Order_product/Manufacturers.html';
}

// Open cart modal
function openCartModal() {
  const manufacturerId = new URLSearchParams(window.location.search).get('manufacturer_id');
  if (!manufacturerId) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }
  window.location.href = `/Order_product/shoppingCart.html?manufacturer_id=${manufacturerId}`;
}

// Fetch user role and ID
async function fetchUserRole(retryCount = 1) {
  try {
    console.log(`جلب بيانات المستخدم من /api/user (محاولة ${2 - retryCount + 1})`);
    const response = await fetch('/api/user', {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    console.log('حالة استجابة /api/user:', response.status);
    if (!response.ok) {
      if (response.status === 401) {
        console.warn('المستخدم غير مسجل الدخول أو الجلسة منتهية');
        showMessage('يرجى تسجيل الدخول أولاً', 'error');
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 2500);
        return false;
      }
      throw new Error(`فشل في جلب بيانات المستخدم: ${response.status}`);
    }
    const data = await response.json();
    console.log('استجابة /api/user:', data);
    if (!data.user_id) {
      console.error('استجابة /api/user لا تحتوي على user_id:', data);
      if (retryCount > 0) {
        console.log('إعادة محاولة جلب بيانات المستخدم');
        return await fetchUserRole(retryCount - 1);
      }
      showMessage('خطأ: معرف المستخدم غير موجود في بيانات الجلسة', 'error');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 2500);
      return false;
    }
    userRole = data.role;
    userId = data.user_id;
    console.log('تم الجلب بنجاح - userRole:', userRole, 'userId:', userId);
    updateUIBasedOnRole();
    await loadCategories();
    loadProducts('all', 'all');
    return true;
  } catch (error) {
    console.error('خطأ في جلب بيانات المستخدم:', error);
    if (retryCount > 0) {
      console.log('إعادة محاولة جلب بيانات المستخدم بعد الخطأ');
      return await fetchUserRole(retryCount - 1);
    }
    showMessage(`حدث خطأ أثناء جلب بيانات الجلسة: ${error.message}`, 'error');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 2500);
    return false;
  }
}

// Load categories
async function loadCategories() {
  const urlParams = new URLSearchParams(window.location.search);
  const manufacturerId = urlParams.get('manufacturer_id');
  if (!manufacturerId) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }
  try {
    const response = await fetch(`/api/categories?manufacturer_id=${manufacturerId}`);
    if (!response.ok) {
      throw new Error(`فشل في جلب الأصناف: ${response.status}`);
    }
    const categories = await response.json();
    console.log('الأصناف المجلوبة:', categories);
    const categoryList = document.getElementById('categoryList');
    if (categoryList) {
      categoryList.innerHTML = '';
      if (categories.length === 0) {
        categoryList.innerHTML = '<p>لا توجد أصناف متاحة. أضف صنفًا جديدًا.</p>';
      } else {
        categories.forEach(category => {
          const categoryItem = `
            <div class="category-item">
              <span>${category.category_name}</span>
              ${userRole === 'مورد' ? `<button class="delete-btn" onclick="deleteCategory(${category.category_id})">حذف</button>` : ''}
            </div>
          `;
          categoryList.innerHTML += categoryItem;
        });
      }
    }
    const categoriesBar = document.querySelector('.categories-bar');
    if (categoriesBar) {
      const existingCategoryButtons = document.querySelectorAll('.category-btn:not([data-category="all"])');
      existingCategoryButtons.forEach(btn => btn.remove());
      if (categories.length === 0) {
        categoriesBar.innerHTML = '<button class="btn btn-primary category-btn active" onclick="filterProducts(\'all\')" data-category="all">الكل</button>';
      } else {
        categories.forEach(category => {
          const button = document.createElement('button');
          button.className = 'btn btn-primary category-btn';
          button.setAttribute('data-category', category.category_id);
          button.textContent = category.category_name;
          button.onclick = () => filterProducts(category.category_id);
          categoriesBar.appendChild(button);
        });
      }
    }
  } catch (error) {
    console.error('خطأ أثناء جلب الأصناف:', error);
    showMessage(`حدث خطأ أثناء جلب الأصناف: ${error.message}`, 'error');
  }
}

// Load categories for add product select
async function loadCategoriesForSelect() {
  const urlParams = new URLSearchParams(window.location.search);
  const manufacturerId = urlParams.get('manufacturer_id');
  if (!manufacturerId) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }
  try {
    const response = await fetch(`/api/categories?manufacturer_id=${manufacturerId}`);
    if (!response.ok) {
      throw new Error(`فشل في جلب الأصناف: ${response.status}`);
    }
    const categories = await response.json();
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">اختر صنفًا</option>';
      categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.category_id;
        option.textContent = category.category_name;
        categorySelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('خطأ أثناء جلب الأصناف للاختيار:', error);
    showMessage('حدث خطأ أثناء جلب الأصناف', 'error');
  }
}

// Load categories for edit product select
async function loadCategoriesForEditSelect(selectedCategoryId) {
  const urlParams = new URLSearchParams(window.location.search);
  const manufacturerId = urlParams.get('manufacturer_id');
  if (!manufacturerId) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }
  try {
    const response = await fetch(`/api/categories?manufacturer_id=${manufacturerId}`);
    if (!response.ok) {
      throw new Error(`فشل في جلب الأصناف: ${response.status}`);
    }
    const categories = await response.json();
    const categorySelect = document.getElementById('editCategorySelect');
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">اختر صنفًا</option>';
      categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.category_id;
        option.textContent = category.category_name;
        if (category.category_id == selectedCategoryId) {
          option.selected = true;
        }
        categorySelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('خطأ أثناء جلب الأصناف للاختيار:', error);
    showMessage('حدث خطأ أثناء جلب الأصناف', 'error');
  }
}

// Load products with filtering
async function loadProducts(category = 'all', status = 'all') {
  const urlParams = new URLSearchParams(window.location.search);
  const manufacturerId = urlParams.get('manufacturer_id');
  if (!manufacturerId) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }
  currentCategory = category;
  currentStatus = status;
  console.log('جلب المنتجات مع الفلاتر:', { category, status, manufacturerId });
  try {
    let url = `/api/products?manufacturer_id=${manufacturerId}`;
    if (category !== 'all') {
      url += `&category=${category}`;
    }
    if (status !== 'all') {
      url += `&quantity=${currentStatus}`;
    }
    console.log('رابط طلب المنتجات:', url);
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `فشل في جلب المنتجات: ${response.status}`);
    }
    const products = await response.json();
    console.log('المنتجات المجلوبة:', products);
    const tbody = document.querySelector('#productsTable tbody');
    if (tbody) {
      tbody.innerHTML = '';
      const isSupplier = userRole === 'مورد';
      const isWarehouseEmployee = userRole === 'موظف المستودع';
      const isManagerOrAdmin = userRole === 'مدير' || userRole === 'مسؤول نظام';
      if (products.length === 0) {
        const colspan = 7;
        tbody.innerHTML = `<tr><td colspan="${colspan}">لا توجد منتجات متاحة</td></tr>`;
      } else {
        products.forEach(product => {
          const row = document.createElement('tr');
          let rowHTML = `
            <td>${product.product_name || '-'}</td>
            <td>${product.category_name || 'غير مصنف'}</td>
            <td>${product.description || '-'}</td>
            <td>${product.barcode || '-'}</td>
            <td>${product.unit || '-'}</td>
            <td>${product.price != null ? Number(product.price).toFixed(2) : '-'}</td>
            <td>${product.quantity > 0 ? product.quantity : 'غير متوفر'}</td>
          `;
          if (!isManagerOrAdmin) {
            rowHTML += `
              <td class="action-buttons">
                ${
                  isWarehouseEmployee
                    ? `
                      <button class="btn btn-primary add-to-cart-btn" 
                              data-product='${JSON.stringify(product)}'
                              ${product.quantity <= 0 ? 'disabled' : ''}>
                        إضافة إلى العربة
                      </button>
                    `
                    : isSupplier
                    ? `
                      <button class="btn btn-secondary" onclick="openEditProductPopup(${product.product_id})">تعديل</button>
                      <button class="delete-btn" onclick="deleteProduct(${product.product_id})">حذف</button>
                    `
                    : '<span style="color: #f44336;">غير مصرح</span>'
                }
              </td>
            `;
          } else {
            rowHTML += '<td class="action-buttons"><span style="color: #f44336;">غير مصرح</span></td>';
          }
          row.innerHTML = rowHTML;
          tbody.appendChild(row);
        });
      }
      document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', () => {
          const product = JSON.parse(newButton.getAttribute('data-product'));
          openAddToCartPopup(product);
        });
      });
      const searchInput = document.getElementById('searchInput');
      const searchResultsCount = document.getElementById('searchResultsCount');
      if (searchInput?.value.trim()) {
        search();
      } else {
        searchResultsCount.textContent = '';
      }
    }
  } catch (error) {
    console.error('خطأ أثناء جلب المنتجات:', error);
    showMessage('حدث خطأ أثناء جلب المنتجات', 'error');
  }
}

// Update cart count
async function updateCartCount(manufacturerId) {
  try {
    console.log(`جلب عناصر العربة لـ manufacturer_id=${manufacturerId}`);
    const response = await fetch(`/api/cart?manufacturer_id=${manufacturerId}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 403) {
        console.log('تم تجاهل 403: المستخدم غير مصرح له');
        return;
      }
      if (response.status === 500) {
        console.error('خطأ خادم داخلي في /api/cart:', errorData.message || 'غير معروف');
      }
      throw new Error(errorData.message || `فشل في جلب العناصر: ${response.status}`);
    }
    const cartItems = await response.json();
    console.log('عناصر العربة المجلوبة:', cartItems);
    const cartCountElement = document.getElementById('cartCount');
    if (cartCountElement) {
      const uniqueProductsCount = new Set(cartItems.map(item => item.product_id)).size;
      cartCountElement.textContent = uniqueProductsCount;
    }
  } catch (error) {
    console.error('خطأ في تحديث عداد العربة:', error);
    if (!error.message.includes('403')) {
      showMessage('تعذر تحديث عدد عناصر العربة', 'error');
    }
  }
}

// Check if product is in cart
async function isProductInCart(productId, manufacturerId) {
  try {
    const response = await fetch(`/api/cart?manufacturer_id=${manufacturerId}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`فشل في جلب بيانات العربة: ${response.status}`);
    }
    const cartItems = await response.json();
    const cartItem = cartItems.find(item => item.product_id === productId);
    return {
      exists: !!cartItem,
      cartId: cartItem ? cartItem.cart_id : null,
      quantity: cartItem ? cartItem.quantity : 0,
      notes: cartItem ? cartItem.notes : null,
    };
  } catch (error) {
    console.error('خطأ أثناء التحقق من وجود المنتج في العربة:', error);
    return { exists: false, cartId: null, quantity: 0, notes: null };
  }
}

// Check cart manufacturer compatibility
async function checkCartManufacturer(manufacturerId) {
  try {
    const response = await fetch(`/api/cart?manufacturer_id=${manufacturerId}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`فشل في جلب بيانات العربة: ${response.status}`);
    }
    const cartItems = await response.json();
    if (cartItems.length === 0) {
      return { isValid: true };
    }
    const cartManufacturerId = cartItems[0].manufacturer_id;
    return {
      isValid: cartManufacturerId == manufacturerId,
      cartManufacturerId: cartManufacturerId,
    };
  } catch (error) {
    console.error('خطأ أثناء التحقق من الشركة المصنعة في العربة:', error);
    showMessage(`خطأ في التحقق من العربة: ${error.message}`, 'error');
    return { isValid: false };
  }
}

// Add to cart
async function addToCart(cartData, productName, manufacturerId) {
  try {
    if (!cartData.product_id || !cartData.quantity || !cartData.manufacturer_id) {
      throw new Error('معرف المنتج، الكمية، ومعرف الشركة المصنعة مطلوبة');
    }
    if (cartData.quantity < 1) {
      throw new Error('الكمية يجب أن تكون أكبر من صفر');
    }

    // جلب الكمية المتوفرة للمنتج
    const productResponse = await fetch(`/api/products?manufacturer_id=${manufacturerId}`);
    if (!productResponse.ok) {
      throw new Error(`فشل في جلب بيانات المنتج: ${productResponse.status}`);
    }
    const products = await productResponse.json();
    const product = products.find(p => p.product_id === cartData.product_id);
    if (!product) {
      showMessage('المنتج غير موجود', 'error');
      return;
    }
    if (cartData.quantity > product.quantity) {
      showMessage(`الكمية المطلوبة (${cartData.quantity}) أكبر من الكمية المتوفرة (${product.quantity}). سيتم تعيينها إلى ${product.quantity}.`, 'warning');
      cartData.quantity = product.quantity; // تعيين القيمة إلى الحد الأقصى المتوفر
    }

    // التحقق مما إذا كان المنتج موجودًا بالفعل في العربة
    const cartCheckResponse = await fetch(`/api/cart?manufacturer_id=${manufacturerId}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!cartCheckResponse.ok) {
      throw new Error(`فشل في جلب بيانات العربة: ${cartCheckResponse.status}`);
    }
    const cartItems = await cartCheckResponse.json();
    const existingItem = cartItems.find(item => item.product_id === cartData.product_id);

    let response;
    let message;
    if (existingItem && existingItem.cart_id) {
      // تحديث الكمية إذا كان المنتج موجودًا
      const updatedQuantity = existingItem.quantity + cartData.quantity;
      if (updatedQuantity > product.quantity) {
        showMessage(`الكمية الإجمالية (${updatedQuantity}) تتجاوز الكمية المتوفرة (${product.quantity}). سيتم تعيينها إلى ${product.quantity}.`, 'warning');
        cartData.quantity = product.quantity - existingItem.quantity; // ضبط الكمية للباقي المتوفر
      }
      response = await fetch(`/api/cart/${existingItem.cart_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: existingItem.quantity + cartData.quantity, notes: cartData.notes || existingItem.notes }),
        credentials: 'include',
      });
      message = `تم تحديث كمية ${productName} في العربة إلى ${existingItem.quantity + cartData.quantity}!`;
    } else {
      // إضافة منتج جديد إذا لم يكن موجودًا
      response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cartData),
        credentials: 'include',
      });
      message = `تمت إضافة ${productName} إلى العربة!`;
    }

    const result = await response.json();
    console.log('استجابة /api/cart:', result);
    if (!response.ok) {
      throw new Error(result.message || 'فشل إضافة/تحديث المنتج في العربة');
    }
    showMessage(message, 'success');
    closePopup('addToCartPopup');
    document.getElementById('addToCartForm')?.reset();
    await updateCartCount(manufacturerId);
  } catch (error) {
    console.error('خطأ أثناء إضافة/تحديث المنتج في العربة:', error);
    showMessage(`خطأ: ${error.message}`, 'error');
    throw error;
  }
}

// Show clear cart confirmation
function showClearCartConfirmation(cartData, callback) {
  const confirmationPopup = document.createElement('div');
  confirmationPopup.className = 'popup';
  confirmationPopup.style.display = 'flex';
  confirmationPopup.innerHTML = `
    <div class="popup-content">
      <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
      <h2>تحذير</h2>
      <p>العربة تحتوي على منتجات من شركة أخرى. يمكنك إضافة منتجات من شركة واحدة فقط لكل طلب.</p>
      <p>هل تريد مسح العربة وإضافة هذا المنتج؟</p>
      <div class="form-group">
        <button class="btn btn-danger" id="clearCartBtn">مسح العربة</button>
        <button class="btn btn-secondary" id="cancelBtn">إلغاء</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmationPopup);
  document.getElementById('clearCartBtn').addEventListener('click', async () => {
    try {
      const response = await fetch('/api/cart', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('فشل في مسح العربة');
      }
      confirmationPopup.remove();
      closePopup('addToCartPopup');
      await callback();
    } catch (error) {
      console.error('خطأ أثناء مسح العربة:', error);
      showMessage(`حدث خطأ: ${error.message}`, 'error');
    }
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    confirmationPopup.remove();
    closePopup('addToCartPopup');
  });
}

// Add product
async function addProduct(event) {
  event.preventDefault();
  if (userRole !== 'مورد') {
    showMessage('غير مصرح لك بإضافة منتجات، هذه العملية متاحة للمورد فقط', 'error');
    return;
  }
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData);
  if (!data.product_name) {
    showMessage('يرجى إدخال اسم المنتج', 'error');
    return;
  }
  if (!data.manufacturer_id) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }
  if (!data.quantity || data.quantity < 0) {
    showMessage('يرجى إدخال كمية صالحة', 'error');
    return;
  }
  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_name: data.product_name,
        category_id: data.category_id ? parseInt(data.category_id) : null,
        description: data.description || null,
        barcode: data.barcode || null,
        unit: data.unit || null,
        price: data.price ? parseFloat(data.price) : null,
        quantity: parseInt(data.quantity) || 0,
        manufacturer_id: parseInt(data.manufacturer_id),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'فشل في إضافة المنتج');
    }
    showMessage('تم إضافة المنتج بنجاح', 'success');
    event.target.reset();
    closePopup('addProductPopup');
    loadProducts(currentCategory, currentStatus);
  } catch (error) {
    console.error('خطأ أثناء إضافة المنتج:', error);
    showMessage(`حدث خطأ: ${error.message}`, 'error');
  }
}

// Edit product
async function editProduct(event) {
  event.preventDefault();
  if (userRole !== 'مورد') {
    showMessage('غير مصرح لك بتعديل منتجات، هذه العملية متاحة للمورد فقط', 'error');
    return;
  }
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData);
  if (!data.product_name) {
    showMessage('يرجى إدخال اسم المنتج', 'error');
    return;
  }
  if (!data.manufacturer_id) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }
  if (!data.quantity || data.quantity < 0) {
    showMessage('يرجى إدخال كمية صالحة', 'error');
    return;
  }
  try {
    const response = await fetch(`/api/products/${data.product_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_name: data.product_name,
        category_id: data.category_id ? parseInt(data.category_id) : null,
        description: data.description || null,
        barcode: data.barcode || null,
        unit: data.unit || null,
        price: data.price ? parseFloat(data.price) : null,
        quantity: parseInt(data.quantity) || 0,
        manufacturer_id: parseInt(data.manufacturer_id),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'فشل في تعديل المنتج');
    }
    showMessage('تم تعديل المنتج بنجاح', 'success');
    closePopup('editProductPopup');
    loadProducts(currentCategory, currentStatus);
  } catch (error) {
    console.error('خطأ أثناء تعديل المنتج:', error);
    showMessage(`حدث خطأ: ${error.message}`, 'error');
  }
}

// Add category
async function addCategory(event) {
  event.preventDefault();
  if (userRole !== 'مورد') {
    showMessage('غير مصرح لك بإضافة أصناف، هذه العملية متاحة للمورد فقط', 'error');
    return;
  }
  const formData = new FormData(event.target);
  const data = {
    category_name: formData.get('category_name'),
    manufacturer_id: formData.get('manufacturer_id'),
  };
  if (!data.category_name) {
    showMessage('يرجى إدخال اسم الصنف', 'error');
    return;
  }
  if (!data.manufacturer_id) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }
  try {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'فشل في إضافة الصنف');
    }
    showMessage('تم إضافة الصنف بنجاح', 'success');
    event.target.reset();
    closePopup('manageCategoriesPopup');
    await loadCategories();
  } catch (error) {
    console.error('خطأ أثناء إضافة الصنف:', error);
    showMessage(`حدث خطأ: ${error.message}`, 'error');
  }
}

// Delete category
async function deleteCategory(categoryId) {
  if (userRole !== 'مورد') {
    showMessage('غير مصرح لك بحذف أصناف، هذه العملية متاحة للمورد فقط', 'error');
    return;
  }
  if (confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
    const urlParams = new URLSearchParams(window.location.search);
    const manufacturerId = urlParams.get('manufacturer_id');
    if (!manufacturerId) {
      showMessage('معرف الشركة المصنعة غير موجود', 'error');
      return;
    }
    try {
      const response = await fetch(`/api/categories/${categoryId}?manufacturer_id=${manufacturerId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'فشل في حذف الصنف');
      }
      showMessage('تم حذف الصنف بنجاح', 'success');
      loadCategories();
      if (currentCategory == categoryId) {
        filterProducts('all');
      }
    } catch (error) {
      console.error('خطأ أثناء حذف الصنف:', error);
      showMessage(`حدث خطأ: ${error.message}`, 'error');
    }
  }
}

// Delete product
async function deleteProduct(id) {
  if (userRole !== 'مورد') {
    showMessage('غير مصرح لك بحذف منتجات، هذه العملية متاحة للمورد فقط', 'error');
    return;
  }
  if (confirm('هل أنت متأكد من الحذف؟')) {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'فشل في حذف المنتج');
      }
      showMessage('تم حذف المنتج بنجاح', 'success');
      loadProducts(currentCategory, currentStatus);
    } catch (error) {
      console.error('خطأ أثناء حذف المنتج:', error);
      showMessage(`حدث خطأ: ${error.message}`, 'error');
    }
  }
}

// Export data
async function exportData() {
  if (userRole !== 'مورد') {
    showMessage('غير مصرح لك بتصدير البيانات، هذه العملية متاحة للمورد فقط', 'error');
    return;
  }
  const urlParams = new URLSearchParams(window.location.search);
  const manufacturerId = urlParams.get('manufacturer_id');
  if (!manufacturerId) {
    showMessage('معرف الشركة المصنعة غير موجود', 'error');
    return;
  }
  try {
    let url = `/api/products?manufacturer_id=${manufacturerId}`;
    if (currentCategory !== 'all') {
      url += `&category=${currentCategory}`;
    }
    if (currentStatus !== 'all') {
      url += `&quantity=${currentStatus}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `فشل في جلب البيانات: ${response.status}`);
    }
    const products = await response.json();
    const csvRows = [];
    const headers = [
      'اسم المنتج',
      'الصنف',
      'الوصف',
      'الباركود',
      'الوحدة',
      'السعر',
      'الكمية'
    ];
    csvRows.push(headers.join(','));
    products.forEach(product => {
      const row = [
        `"${product.product_name || '-'}"`,
        `"${product.category_name || 'غير مصنف'}"`,
        `"${product.description || '-'}"`,
        `"${product.barcode || '-'}"`,
        `"${product.unit || '-'}"`,
        product.price != null ? Number(product.price).toFixed(2) : '-',
        product.quantity
      ];
      csvRows.push(row.join(','));
    });
    const BOM = '\uFEFF';
    const csvContent = BOM + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const urlBlob = URL.createObjectURL(blob);
    link.setAttribute('href', urlBlob);
    link.setAttribute('download', 'products.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(urlBlob);
    showMessage('تم تصدير البيانات بنجاح', 'success');
  } catch (error) {
    console.error('خطأ أثناء تصدير البيانات:', error);
    showMessage(`حدث خطأ: ${error.message}`, 'error');
  }
}

// Filter products by category
function filterProducts(category) {
  console.log('تصفية المنتجات حسب الصنف:', category);
  const buttons = document.querySelectorAll('.category-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  const targetBtn = document.querySelector(`.category-btn[data-category="${category}"]`);
  if (targetBtn) targetBtn.classList.add('active');
  else document.querySelector('.category-btn[data-category="all"]').classList.add('active');
  loadProducts(category, currentStatus);
}

// Filter products by status
function filterByStatus() {
  const statusSelect = document.getElementById('statusFilter');
  if (!statusSelect) {
    console.error('عنصر statusFilter غير موجود');
    showMessage('خطأ في واجهة البحث', 'error');
    return;
  }
  const status = statusSelect.value;
  console.log('تصفية المنتجات حسب الحالة:', status);
  currentStatus = status;
  loadProducts(currentCategory, status);
}

// Search in table
function search() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const rows = document.querySelectorAll('#productsTable tbody tr');
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

// Reset search
function resetSearch() {
  const searchInput = document.getElementById('searchInput');
  searchInput.value = '';
  document.getElementById('searchResultsCount').textContent = '';
  search();
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
  const searchInput = document.getElementById('searchInput');
  const searchResultsCount = document.getElementById('searchResultsCount');
  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        search();
      }
    });
  }
  if (searchResultsCount) {
    searchResultsCount.textContent = '';
  }
});

// Event handlers
document.getElementById('addToCartForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log('إرسال نموذج إضافة إلى العربة');
  if (userRole !== 'موظف المستودع') {
    showMessage('فقط موظف المستودع يمكنه إضافة المنتجات إلى الطلب', 'error');
    return;
  }
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  const productId = parseInt(data.product_id);
  const quantity = parseInt(data.quantity);
  const notes = data.notes?.trim() || null;
  const manufacturerId = new URLSearchParams(window.location.search).get('manufacturer_id');
  console.log('قيم الحقول قبل التحقق:', { productId, quantity, notes, manufacturerId });
  if (!productId || isNaN(productId)) {
    showMessage('معرف المنتج غير صالح', 'error');
    return;
  }
  if (!quantity || isNaN(quantity) || quantity < 1) {
    showMessage('الكمية يجب أن تكون رقمًا صحيحًا أكبر من صفر', 'error');
    return;
  }
  if (!manufacturerId || isNaN(parseInt(manufacturerId))) {
    showMessage('معرف الشركة المصنعة غير صالح', 'error');
    return;
  }
  try {
    const productResponse = await fetch(`/api/products?manufacturer_id=${manufacturerId}`);
    if (!productResponse.ok) {
      throw new Error(`فشل في جلب بيانات المنتج: ${productResponse.status}`);
    }
    const products = await productResponse.json();
    const product = products.find(p => p.product_id === productId);
    if (!product) {
      showMessage('المنتج غير موجود', 'error');
      return;
    }
    if (product.quantity <= 0) {
      showMessage('المنتج غير متوفر', 'error');
      return;
    }
    if (quantity > product.quantity) {
      showMessage(`الكمية المطلوبة (${quantity}) أكبر من الكمية المتوفرة (${product.quantity})`, 'error');
      return;
    }
    const manufacturerCheck = await checkCartManufacturer(manufacturerId);
    if (!manufacturerCheck.isValid && manufacturerCheck.cartManufacturerId) {
      const cartData = {
        product_id: productId,
        quantity: quantity,
        notes: notes,
        manufacturer_id: parseInt(manufacturerId),
      };
      showClearCartConfirmation(cartData, async () => {
        await addToCart(cartData, product.product_name, manufacturerId);
      });
      return;
    }
    const cartData = {
      product_id: productId,
      quantity: quantity,
      notes: notes,
      manufacturer_id: parseInt(manufacturerId),
    };
    await addToCart(cartData, product.product_name, manufacturerId);
  } catch (error) {
    console.error('خطأ أثناء إضافة إلى العربة:', error);
    showMessage(`خطأ: ${error.message}`, 'error');
  }
});

// Add event listeners
document.getElementById('addProductForm')?.addEventListener('submit', addProduct);
document.getElementById('editProductForm')?.addEventListener('submit', editProduct);
document.getElementById('addCategoryForm')?.addEventListener('submit', addCategory);

// Initialize page
window.onload = () => {
  console.log('تحميل صفحة المنتجات');
  fetchUserRole().then(() => {
    const manufacturerId = new URLSearchParams(window.location.search).get('manufacturer_id');
    if (manufacturerId && userRole === 'موظف المستودع') {
      updateCartCount(manufacturerId);
    }
  });
};