let currentUserRole = null;
let currentUserId = null;
document.addEventListener('DOMContentLoaded', () => {
  const loadingElement = document.querySelector('.loading');
  loadingElement.classList.add('visible');
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order_id');
  if (!orderId) {
    displayError('لم يتم تحديد رقم الطلب');
    loadingElement.classList.remove('visible');
    return;
  }
  // Fetch current user data
  fetch('/api/user', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('فشل في جلب بيانات المستخدم');
      }
      return response.json();
    })
    .then(userData => {
      currentUserRole = userData.role;
      currentUserId = userData.user_id;
      console.log('Current user:', { role: currentUserRole, id: currentUserId });
      // Fetch order data
      fetch(`/${orderId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
        .then(orderResponse => {
          if (!orderResponse.ok) {
            return orderResponse.json().then(data => {
              throw new Error(data.message || 'خطأ في جلب البيانات');
            });
          }
          return orderResponse.json();
        })
        .then(orderData => {
          loadingElement.classList.remove('visible');
          displayOrderData(orderData, currentUserRole);
        })
        .catch(error => {
          console.error('Error fetching order data:', error);
          loadingElement.classList.remove('visible');
          displayError(error.message);
        });
    })
    .catch(error => {
      console.error('Error fetching user data:', error);
      loadingElement.classList.remove('visible');
      displayError(error.message);
    });
  document.querySelector('.back-btn').addEventListener('click', () => {
    window.location.href = '/Order_Product/My_orders.html';
  });
  const printInvoiceBtn = document.querySelector('.print-invoice-btn');
  if (printInvoiceBtn) {
    printInvoiceBtn.addEventListener('click', () => printInvoice(orderId));
  }
  const saveRepBtn = document.querySelector('.save-rep-btn');
  if (saveRepBtn) {
    saveRepBtn.addEventListener('click', () => {
      if (currentUserRole !== 'مورد') {
        alert('فقط المورد يمكنه تعديل بيانات مندوب المبيعات');
        return;
      }
      const salesRepName = document.querySelector('#sales-rep-name').value.trim();
      const salesRepPhone = document.querySelector('#sales-rep-phone').value.trim();
      const salesRepPin = document.querySelector('#sales-rep-pin').value.trim();
      saveSalesRepData(orderId, { salesRepName, salesRepPhone, salesRepPin });
    });
  }
  const returnOrderBtn = document.querySelector('.return-order-btn');
if (returnOrderBtn) {
  returnOrderBtn.addEventListener('click', () => {
    const allowedRoles = ['موظف المستودع', 'مدير'];
    if (allowedRoles.includes(currentUserRole)) {
      showReturnPopup(orderId);
    } else {
      alert('غير مسموح بالإرجاع إلا لموظف المستودع أو المدير');
    }
  });
}
});
function displayOrderData(data, userRole) {
  const { order, items, supplier, employee } = data;
  document.querySelector('.order-number span').textContent = `رقم الطلب: #${order.order_id}`;
  document.querySelector('.order-date span').textContent = formatDate(order.order_date);
  document.querySelector('.supplier-name').textContent = supplier?.username || 'غير محدد';
  document.querySelector('.employee-name').textContent = employee?.username || 'غير محدد';
  document.querySelector('.payment-status').textContent = order.payment_status === 'مدفوع' ? 'مدفوع' : 'غير مدفوع';
  document.querySelector('.payment-method').textContent = order.payment_terms || 'غير محدد';
  // Enable return button if order is completed
  const returnOrderBtn = document.querySelector('.return-order-btn');
  if (order.status === 'مكتمل') {
    returnOrderBtn.disabled = false;
    returnOrderBtn.title = 'إرجاع الطلب';
  } else {
    returnOrderBtn.disabled = true;
    returnOrderBtn.title = 'غير مسموح بالإرجاع إلا بعد اكتمال الطلب';
  }
  const salesRepNameInput = document.querySelector('#sales-rep-name');
  const salesRepPhoneInput = document.querySelector('#sales-rep-phone');
  const salesRepPinInput = document.querySelector('#sales-rep-pin');
  const saveRepBtn = document.querySelector('.save-rep-btn');
  const salesRepFields = document.querySelectorAll('.sales-rep-field');
  const isSupplier = userRole === 'مورد' && supplier?.username && supplier.username !== 'غير محدد';
  salesRepFields.forEach(field => {
    field.classList.toggle('hidden', !supplier?.username || supplier.username === 'غير محدد');
  });
  saveRepBtn.classList.toggle('hidden', !isSupplier);
  salesRepNameInput.value = order.sales_rep_name || '';
  salesRepPhoneInput.value = order.sales_rep_phone || '';
  salesRepPinInput.value = isSupplier && order.sales_rep_pin ? order.sales_rep_pin : '';
  salesRepNameInput.readOnly = !isSupplier;
  salesRepPhoneInput.readOnly = !isSupplier;
  salesRepPinInput.readOnly = !isSupplier;
  salesRepPinInput.disabled = !isSupplier;
  salesRepPinInput.type = isSupplier ? 'text' : 'password';
  if (!isSupplier) {
    salesRepPinInput.placeholder = 'غير متاح';
  }
  const trackingContainer = document.querySelector('.order-tracking');
  trackingContainer.setAttribute('data-status', order.status);
  const tbody = document.querySelector('.products-body');
  tbody.innerHTML = items.map((item, index) => {
    const price = typeof item.price === 'number' ? item.price : (typeof item.price === 'string' ? parseFloat(item.price) || 0 : 0);
    const quantity = typeof item.quantity === 'number' ? item.quantity : (typeof item.quantity === 'string' ? parseInt(item.quantity) || 0 : 0);
    const total = (quantity * price).toFixed(2);
    const canReturn = order.status === 'مكتمل';
    return `
      <tr data-order-id="${order.order_id}" data-order-item-id="${item.order_item_id || ''}">
        <td data-label="رقم">${index + 1}</td>
        <td data-label="المنتج">${item.product_name || 'غير محدد'}</td>
        <td data-label="الباركود">${item.barcode || 'غير محدد'}</td>
        <td data-label="الكمية">${quantity}</td>
        <td data-label="السعر">${price.toFixed(2)} د.أ</td>
        <td data-label="الإجمالي">${total === '0.00' ? 'غير محدد' : total + ' د.أ'}</td>
        <td data-label="الملاحظات">${item.notes || 'لا توجد ملاحظات'}</td>
      </tr>
    `;
  }).join('');
  // Add event listeners for return buttons in table
  document.querySelectorAll('.return-btn:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-order-id');
      const orderItemId = btn.getAttribute('data-order-item-id');
      showReturnPopup(orderId, orderItemId);
    });
  });
  const { subtotal, tax, total } = calculateOrderSummary(items);
  const summaryContainer = document.querySelector('.order-summary');
  if (summaryContainer) {
    summaryContainer.innerHTML = `
      <p><strong>المجموع الفرعي:</strong> د.أ${subtotal.toFixed(2)}</p>
      <p><strong>الضريبة (16%):</strong> د.أ${tax.toFixed(2)}</p>
      <p><strong>المجموع الكلي:</strong> د.أ${total.toFixed(2)}</p>
    `;
  }
}
function showReturnPopup(orderId, orderItemId = null) {
  const popup = document.getElementById('returnPopup');
  popup.style.display = 'flex';
  // Set default values
  document.getElementById('order_id').value = orderId;
  document.getElementById('order_item_id').value = orderItemId || '';
  // Set return_date to current date and time (no timezone conversion)
  document.getElementById('return_date').value = new Date().toISOString().slice(0, 16);
  document.getElementById('category').value = '';
  document.getElementById('details').value = '';
  document.getElementById('attachment').value = '';
  // Remove any existing quantity field if present
  const existingQuantityField = document.querySelector('.form-group:has(#quantity)');
  if (existingQuantityField) {
    existingQuantityField.remove();
  }
  // Add return type select field dynamically if not present
  let returnTypeSelect = document.getElementById('return_type');
  if (!returnTypeSelect) {
    const selectContainer = document.createElement('div');
    selectContainer.className = 'form-group';
    selectContainer.innerHTML = `
      <label for="return_type">نوع الإرجاع:</label>
      <select id="return_type" name="return_type" required>
        <option value="full">إرجاع كامل</option>
        <option value="partial">إرجاع جزئي</option>
      </select>`;
    const returnForm = document.getElementById('returnForm');
    returnForm.insertBefore(selectContainer, returnForm.querySelector('.form-group:has(#details)') || returnForm.querySelector('.form-group:has(#attachment)'));
    returnTypeSelect = document.getElementById('return_type');
  }
  // Add order items table dynamically for partial return
  let orderItemsContainer = document.getElementById('order_items_container');
  if (!orderItemsContainer) {
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'form-group';
    itemsContainer.id = 'order_items_container';
    itemsContainer.innerHTML = `
      <table id="order_items_table" style="width: 100%; border-collapse: collapse; display: none;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px;">اسم المنتج</th>
            <th style="border: 1px solid #ddd; padding: 8px;">الكمية المتاحة</th>
            <th style="border: 1px solid #ddd; padding: 8px;">الكمية المراد إرجاعها</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>`;
    const returnForm = document.getElementById('returnForm');
    returnForm.insertBefore(itemsContainer, returnForm.querySelector('.form-group:has(#details)') || returnForm.querySelector('.form-group:has(#attachment)'));
    orderItemsContainer = document.getElementById('order_items_container');
  }
  // Ensure field order
  let categoryField = document.querySelector('.form-group:has(#category)');
  if (categoryField) {
    const returnForm = document.getElementById('returnForm');
    returnForm.insertBefore(categoryField, document.querySelector('.form-group:has(#return_type)'));
  }
  if (orderItemsContainer) {
    const returnForm = document.getElementById('returnForm');
    returnForm.insertBefore(orderItemsContainer, returnForm.querySelector('.form-group:has(#details)') || returnForm.querySelector('.form-group:has(#attachment)'));
  }
  let detailsField = document.querySelector('.form-group:has(#details)');
  if (detailsField) {
    const returnForm = document.getElementById('returnForm');
    returnForm.insertBefore(detailsField, document.querySelector('.form-group:has(#attachment)'));
  }
  // Fetch order items and populate the table
  const orderItemsTable = document.getElementById('order_items_table');
  const tableBody = orderItemsTable.querySelector('tbody');
  let selectedItems = [];
  const fetchOrderItems = () => {
    fetch(`/api/orders/${orderId}/items`, { credentials: 'include' })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(items => {
        if (!Array.isArray(items)) {
          throw new Error('Invalid response format: Expected an array');
        }
        tableBody.innerHTML = '';
        if (items.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 8px;">لا توجد منتجات متاحة</td></tr>';
          return;
        }
        items.forEach(item => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td style="border: 1px solid #ddd; padding: 8px;">${item.product_name}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">
              <select id="quantity_${item.order_item_id}" onchange="updateSelectedItems(${item.order_item_id}, ${item.quantity})">
                <option value="0">اختر الكمية</option>
                ${Array.from({ length: item.quantity }, (_, i) => i + 1).map(qty => `
                  <option value="${qty}">${qty}</option>
                `).join('')}
              </select>
            </td>`;
          tableBody.appendChild(row);
        });
        // For full return, automatically select all items
        if (returnTypeSelect.value === 'full') {
          selectedItems = items.map(item => ({
            order_item_id: item.order_item_id.toString(),
            quantity: item.quantity
          }));
          tableBody.querySelectorAll('select').forEach(select => {
            select.disabled = true;
            select.value = select.options[select.options.length - 1].value; // Select max quantity
          });
        }
        orderItemsTable.style.display = returnTypeSelect.value === 'partial' ? 'table' : 'none';
      })
      .catch(error => {
        console.error('Error fetching order items:', error);
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 8px;">خطأ أثناء جلب المنتجات</td></tr>';
        alert('خطأ أثناء جلب المنتجات: ' + error.message);
      });
  };
  window.updateSelectedItems = (orderItemId, maxQuantity) => {
    const select = document.getElementById(`quantity_${orderItemId}`);
    const quantity = parseInt(select.value);
    if (quantity === 0) {
      selectedItems = selectedItems.filter(item => item.order_item_id !== orderItemId.toString());
      return;
    }
    const existingItem = selectedItems.find(item => item.order_item_id === orderItemId.toString());
    if (existingItem) {
      existingItem.quantity = quantity;
    } else {
      selectedItems.push({
        order_item_id: orderItemId.toString(),
        quantity: quantity
      });
    }
  };
  // Set initial return type
  if (orderItemId) {
    returnTypeSelect.value = 'partial';
    orderItemsTable.style.display = 'table';
    fetchOrderItems();
  } else {
    returnTypeSelect.value = 'full';
    orderItemsTable.style.display = 'none';
    fetchOrderItems(); // Still fetch items to pre-populate selectedItems for full return
  }
  // Update fields visibility on return_type change
  returnTypeSelect.addEventListener('change', () => {
    const isPartial = returnTypeSelect.value === 'partial';
    orderItemsTable.style.display = isPartial ? 'table' : 'none';
    if (isPartial) {
      tableBody.querySelectorAll('select').forEach(select => {
        select.disabled = false;
        select.value = '0';
      });
      selectedItems = [];
      fetchOrderItems();
    } else {
      fetch(`/api/orders/${orderId}/items`, { credentials: 'include' })
        .then(response => response.json())
        .then(items => {
          selectedItems = items.map(item => ({
            order_item_id: item.order_item_id.toString(),
            quantity: item.quantity
          }));
          tableBody.querySelectorAll('select').forEach(select => {
            select.disabled = true;
            select.value = select.options[select.options.length - 1].value;
          });
        });
    }
  }, { once: true });
  // Handle popup close
  document.getElementById('closePopup').addEventListener('click', () => {
    popup.style.display = 'none';
    returnForm.reset();
    selectedItems = [];
    tableBody.innerHTML = '';
    orderItemsTable.style.display = 'none';
  }, { once: true });
  // Handle form submission
  const returnForm = document.getElementById('returnForm');
  returnForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const submitButton = returnForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
    const formData = new FormData(returnForm);
    formData.append('user_id', currentUserId);
    // Include selected items for partial return; for full return, backend handles items
    if (formData.get('return_type') === 'partial') {
      if (selectedItems.length === 0 || selectedItems.every(item => item.quantity === 0)) {
        alert('يرجى اختيار منتج واحد على الأقل وتحديد كمية للإرجاع الجزئي');
        submitButton.disabled = false;
        submitButton.textContent = 'إرسال المرتجع';
        return;
      }
      formData.append('items', JSON.stringify(selectedItems.filter(item => item.quantity > 0)));
    }
    fetch('/api/returns', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.error || `HTTP error! Status: ${response.status}`);
          });
        }
        return response.json();
      })
      .then(result => {
        if (result.return_id) {
          alert(`تم إرسال المرتجع بنجاح. رقم المرتجع: ${result.return_id}`);
          popup.style.display = 'none';
          returnForm.reset();
          selectedItems = [];
          tableBody.innerHTML = '';
          orderItemsTable.style.display = 'none';
          if (result.redirectUrl) {
            window.location.href = result.redirectUrl;
          } else {
            location.reload();
          }
        } else {
          throw new Error(result.error || 'فشل في إرسال طلب الإرجاع');
        }
      })
      .catch(error => {
        console.error('Error submitting return:', error);
        alert(error.message || 'خطأ أثناء إرسال المرتجع');
        submitButton.disabled = false;
        submitButton.textContent = 'إرسال المرتجع';
      });
  }, { once: true });
}
function saveSalesRepData(orderId, { salesRepName, salesRepPhone, salesRepPin }) {
  if (salesRepPin && !/^\d{4}$/.test(salesRepPin)) {
    alert('رمز PIN يجب أن يتكون من 4 أرقام');
    return;
  }
  fetch(`/api/orders/${orderId}/set-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pin: salesRepPin,
      sales_rep_name: salesRepName,
      sales_rep_phone: salesRepPhone,
    }),
    credentials: 'include',
  })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.message || 'فشل في حفظ بيانات المندوب');
        });
      }
      return response.json();
    })
    .then(result => {
      alert('تم حفظ بيانات المندوب بنجاح');
      location.reload();
    })
    .catch(error => {
      console.error('Error saving sales rep data:', error);
      alert(error.message || 'خطأ أثناء حفظ بيانات المندوب');
    });
}
function formatDate(dateString) {
  if (!dateString) return 'غير محدد';
  const date = new Date(dateString);
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return date.toLocaleDateString('ar-EG', options);
}
function displayError(message) {
  const orderInfoBox = document.querySelector('.order-info-box');
  orderInfoBox.innerHTML = `<p class="error-message">${message}</p>`;
}
function calculateOrderSummary(items) {
  const subtotal = items.reduce((sum, item) => {
    const price = typeof item.price === 'number' ? item.price : 0;
    const quantity = typeof item.quantity === 'number' ? item.quantity : 0;
    return sum + (price * quantity);
  }, 0);
  const taxRate = 0.16;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;
  return { subtotal, tax, total };
}
function printInvoice(orderId) {
  const orderData = {
    order: {
      order_id: document.querySelector('.order-number span').textContent.replace('رقم الطلب: #', ''),
      order_date: document.querySelector('.order-date span').textContent,
      manufacturer_name: document.querySelector('.supplier-name').textContent,
      payment_status: document.querySelector('.payment-status').textContent,
      employee_name: document.querySelector('.employee-name').textContent,
      supplier_name: document.querySelector('.supplier-name').textContent,
      payment_terms: document.querySelector('.payment-method').textContent,
      sales_rep_name: document.querySelector('#sales-rep-name').value || 'غير محدد',
      sales_rep_phone: document.querySelector('#sales-rep-phone').value || 'غير محدد',
      sales_rep_pin: currentUserRole === 'مورد' ? (document.querySelector('#sales-rep-pin').value || 'غير محدد') : 'غير متاح',
    },
    items: Array.from(document.querySelectorAll('.products-body tr')).map(row => {
      return {
        product_name: row.querySelector('td[data-label="المنتج"]').textContent,
        quantity: parseInt(row.querySelector('td[data-label="الكمية"]').textContent) || 0,
        price: parseFloat(row.querySelector('td[data-label="السعر"]').textContent) || 0,
      };
    }),
  };
  const payment = orderData.order;
  const items = orderData.items;
  const { subtotal, tax, total } = calculateOrderSummary(items);
  let invoiceContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة الطلب</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          direction: rtl;
        }
        h2 {
          text-align: center;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          padding: 8px;
          text-align: right;
          border-bottom: 1px solid #ddd;
        }
        th {
          background-color: #f2f2f2;
        }
        hr {
          margin: 20px 0;
        }
        p {
          margin: 5px 0;
        }
        .summary {
          margin-top: 20px;
          padding: 10px;
          border-top: 1px solid #ddd;
        }
        .summary p {
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <h2>فاتورة الطلب</h2>
      <hr>
      <p><strong>رقم الطلب:</strong> ${payment.order_id || '-'}</p>
      <p><strong>تاريخ الطلب:</strong> ${payment.order_date || 'غير محدد'}</p>
      <p><strong>اسم الشركة المصنعة:</strong> ${payment.manufacturer_name || 'غير محدد'}</p>
      <p><strong>حالة الدفع:</strong> ${payment.payment_status || 'غير مدفوع'}</p>
      <p><strong>اسم الموظف:</strong> ${payment.employee_name || 'غير محدد'}</p>
      <p><strong>اسم المورد:</strong> ${payment.supplier_name || 'غير محدد'}</p>
      <p><strong>طريقة الدفع:</strong> ${payment.payment_terms || 'غير محدد'}</p>
      <p><strong>اسم المندوب:</strong> ${payment.sales_rep_name || 'غير محدد'}</p>
      <p><strong>رقم هاتف المندوب:</strong> ${payment.sales_rep_phone || 'غير محدد'}</p>
      ${currentUserRole === 'مورد' ? `<p><strong>رمز PIN:</strong> ${payment.sales_rep_pin || 'غير محدد'}</p>` : ''}
      <hr>
      <h3>عناصر الطلب</h3>
      <table>
        <thead>
          <tr>
            <th>اسم المنتج</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
  `;
  items.forEach(item => {
    const priceValue = item.price != null ? Number(item.price) : 0;
    const price = isNaN(priceValue) ? '0.00' : priceValue.toFixed(2);
    const itemTotal = (item.quantity || 0) * priceValue;
    invoiceContent += `
      <tr>
        <td>${item.product_name || 'غير محدد'}</td>
        <td>${item.quantity || 0}</td>
        <td>د.أ${price}</td>
        <td>د.أ${itemTotal.toFixed(2)}</td>
      </tr>
    `;
  });
  invoiceContent += `
        </tbody>
      </table>
      <div class="summary">
        <p><strong>المجموع الفرعي:</strong> د.أ${subtotal.toFixed(2)}</p>
        <p><strong>الضريبة (16%):</strong> د.أ${tax.toFixed(2)}</p>
        <p><strong>المجموع النهائي:</strong> د.أ${total.toFixed(2)}</p>
      </div>
      <hr>
      <p style="text-align: center;">تم إنشاء هذه الفاتورة بتاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
      <script>
        window.onload = function() {
          window.print();
          setTimeout(() => window.close(), 100);
        };
      </script>
    </body>
    </html>
  `;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(invoiceContent);
  printWindow.document.close();
}