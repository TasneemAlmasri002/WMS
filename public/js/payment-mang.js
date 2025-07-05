document.addEventListener('DOMContentLoaded', function () {
    // DOM elements
    const paymentTableBody = document.querySelector('#paymentTable tbody');
    const popup = document.getElementById('popup-overlay');
    const supplierSelect = document.getElementById('supplier');
    const paymentTermsSelect = document.getElementById('payment-terms');
    const orderItemsTableBody = document.querySelector('#order-items-table tbody');
    const saveBtn = document.getElementById('save-btn');
    const closePopupBtn = document.getElementById('close-popup-btn');
    const closePopupBtnSecondary = document.getElementById('close-popup-btn-secondary');
    const alertsContainer = document.getElementById('messageBox');
    const popupAlerts = document.getElementById('popup-alerts');
    const paymentCompletionPopup = document.getElementById('payment-completion-popup');
    const confirmPaymentBtn = document.getElementById('confirm-payment-btn');
    const cancelPaymentBtn = document.getElementById('cancel-payment-btn');
    const closePaymentPopupBtn = document.getElementById('close-payment-popup-btn');
    // متغيرات عالمية
    let currentPaymentData = null;
    let currentOrderId = null;
    let lastMessage = null;
    // دالة لحساب الضريبة والمجموع النهائي
    function calculateOrderSummary(amount) {
      const subtotal = Number(amount) || 0;
      const taxRate = 0.16; // 16%
      const tax = subtotal * taxRate;
      const discount = 0; // افتراضي
      const shipping = 0; // افتراضي
      const total = subtotal + tax;
      return { subtotal, tax, discount, shipping, total };
    }
    // إعداد معالجات الأحداث
    function setupEventListeners() {
      console.log('Setting up event listeners...');
      confirmPaymentBtn.removeEventListener('click', confirmPayment);
      confirmPaymentBtn.addEventListener('click', confirmPayment);
      closePopupBtn.removeEventListener('click', closePopup);
      closePopupBtn.addEventListener('click', closePopup);
      closePopupBtnSecondary.removeEventListener('click', closePopup);
      closePopupBtnSecondary.addEventListener('click', closePopup);
      cancelPaymentBtn.removeEventListener('click', closePaymentCompletionPopup);
      cancelPaymentBtn.addEventListener('click', closePaymentCompletionPopup);
      closePaymentPopupBtn.removeEventListener('click', closePaymentCompletionPopup);
      closePaymentPopupBtn.addEventListener('click', closePaymentCompletionPopup);
      saveBtn.removeEventListener('click', savePaymentDetails);
      saveBtn.addEventListener('click', savePaymentDetails);
      document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.removeEventListener('click', showPaymentDetailsPopupHandler);
        btn.addEventListener('click', showPaymentDetailsPopupHandler);
      });
      document.querySelectorAll('.print-invoice-btn').forEach(btn => {
        btn.removeEventListener('click', printInvoiceHandler);
        btn.addEventListener('click', printInvoiceHandler);
      });
      document.querySelectorAll('.complete-payment-btn').forEach(btn => {
        btn.removeEventListener('click', showPaymentCompletionPopupHandler);
        btn.addEventListener('click', showPaymentCompletionPopupHandler);
      });
      // Add event listener for payment terms selection
      paymentTermsSelect.removeEventListener('change', handlePaymentTermsChange);
      paymentTermsSelect.addEventListener('change', handlePaymentTermsChange);
    }
    function handlePaymentTermsChange() {
      const selectedTerms = paymentTermsSelect.value;
      if (selectedTerms && selectedTerms !== 'عند الاستلام') {
        showAlert('هذه الخدمة غير متوفرة حاليًا. يرجى اختيار "عند الاستلام".', 'error', popupAlerts);
        paymentTermsSelect.value = 'عند الاستلام';
      }
    }
    function showPaymentDetailsPopupHandler() {
      if (this.dataset.id) {
        showPaymentDetailsPopup(this.dataset.id);
      } else {
        showAlert('معرف الطلب غير موجود', 'error');
      }
    }
    function printInvoiceHandler() {
      if (this.dataset.id) {
        printInvoice(this.dataset.id);
      } else {
        showAlert('معرف الطلب غير موجود', 'error');
      }
    }
    function showPaymentCompletionPopupHandler() {
      if (this.dataset.id) {
        showPaymentCompletionPopup(this.dataset.id);
      } else {
        showAlert('معرف الطلب غير موجود', 'error');
      }
    }
    // تحسين إدخال PIN
    const paymentPinInput = document.getElementById('payment-pin');
    paymentPinInput.addEventListener('input', function (e) {
      this.value = this.value.replace(/[^0-9]/g, '');
      if (this.value.length > 4) {
        this.value = this.value.slice(0, 4);
      }
    });
    // دالة إغلاق نافذة تفاصيل الدفع
    function closePopup() {
      console.log('Closing details popup');
      popup.style.display = 'none';
      popupAlerts.style.display = 'none';
      popupAlerts.innerHTML = '';
      currentPaymentData = null;
      currentOrderId = null;
    }
    // دالة إغلاق نافذة إتمام الدفع
    function closePaymentCompletionPopup() {
      console.log('Closing payment completion popup');
      paymentCompletionPopup.style.display = 'none';
      const paymentCompletionAlerts = document.getElementById('payment-completion-alerts');
      if (paymentCompletionAlerts) {
        paymentCompletionAlerts.style.display = 'none';
        paymentCompletionAlerts.innerHTML = '';
      }
      paymentPinInput.value = '';
    }
    // جلب جميع الطلبات الموافق عليها
    async function fetchPayments() {
      try {
        console.log('Fetching payments from /api/payments-manage...');
        const response = await fetch('/api/payments-manage', {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'فشل في جلب المدفوعات');
        }
        const data = await response.json();
        console.log('Payments data received:', data);
        if (!data.items || !Array.isArray(data.items)) {
          console.warn('No items or invalid data structure:', data);
          throw new Error('البيانات المستلمة غير صالحة: items غير موجود أو ليس مصفوفة');
        }
        renderPayments(data.items);
      } catch (error) {
        console.error('Error fetching payments:', error);
        showAlert(`حدث خطأ أثناء جلب المدفوعات: ${error.message}`, 'error');
        renderPayments([]); // عرض رسالة "لا توجد طلبات" إذا فشل الطلب
      }
    }
    // عرض الطلبات في الجدول
    function renderPayments(payments) {
      console.log('Rendering payments:', payments.length, 'items', payments);
      paymentTableBody.innerHTML = '';
      if (payments.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="9" style="text-align: center;">لا توجد طلبات</td>`;
        paymentTableBody.appendChild(row);
        return;
      }
      payments.forEach(payment => {
        const { total } = calculateOrderSummary(payment.amount);
        const formattedTotal = isNaN(total) ? '0.00' : total.toFixed(2);
        const manufacturerName = payment.manufacturer_name || 'غير محدد';
        const employeeName = payment.employee_name || 'غير محدد';
        const supplierName = payment.supplier_name || 'غير محدد';
        const paymentTerms = payment.payment_terms || 'غير محدد';
        const paymentStatus = payment.payment_status || 'غير مدفوع';
        const orderDate = payment.order_date
          ? new Date(payment.order_date).toLocaleDateString('ar')
          : 'غير محدد';
        const isPaid = paymentStatus === 'مدفوع';
        const completeButton = isPaid
          ? `<span class="btn btn-disabled">تم الدفع</span>`
          : `<button class="btn btn-complete complete-payment-btn" data-id="${payment.order_id || ''}">إتمام الدفع</button>`;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${payment.order_id || '-'}</td>
          <td>${orderDate}</td>
          <td>${manufacturerName}</td>
          <td>JOD${formattedTotal}</td>
          <td>${paymentStatus}</td>
          <td>${employeeName}</td>
          <td>${supplierName}</td>
          <td>${paymentTerms}</td>
          <td class="action-buttons">
            <button class="btn btn-primary view-details-btn" data-id="${payment.order_id || ''}">عرض التفاصيل</button>
            <button class="btn btn-print print-invoice-btn" data-id="${payment.order_id || ''}">طباعة الفاتورة</button>
            ${completeButton}
          </td>
        `;
        paymentTableBody.appendChild(row);
      });
      setupEventListeners();
    }
    // عرض نافذة إتمام الدفع
    async function showPaymentCompletionPopup(order_id) {
      try {
        console.log('Fetching payment details for order:', order_id);
        const response = await fetch(`/api/payments-manage/${order_id}`, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'فشل في جلب تفاصيل الدفع');
        }
        const data = await response.json();
        console.log('Payment details received:', data);
        if (!data.payment || !data.items) {
          throw new Error('بيانات الطلب أو العناصر غير موجودة');
        }
        // Ensure payment method is "عند الاستلام"
        if (data.payment.payment_terms !== 'عند الاستلام') {
          showAlert('الدفع متاح فقط عند الاستلام حاليًا', 'error');
          return;
        }
        // Store payment data
        currentPaymentData = data.payment;
        document.getElementById('supplier-name').value = data.payment.supplier_name || 'غير محدد';
        // Calculate summary for display only
        const { subtotal, tax, discount, shipping, total } = calculateOrderSummary(data.payment.amount);
        document.getElementById('subtotal-amount').textContent = `JOD${subtotal.toFixed(2)}`;
        document.getElementById('discount-amount').textContent = `-JOD${discount.toFixed(2)}`;
        document.getElementById('tax-amount').textContent = `JOD${tax.toFixed(2)}`;
        document.getElementById('shipping-amount').textContent = `JOD${shipping.toFixed(2)}`;
        document.getElementById('total-amount').textContent = `JOD${total.toFixed(2)}`;
        document.getElementById('payment-pin').value = '';
        paymentCompletionPopup.style.display = 'flex';
        paymentCompletionPopup.dataset.order_id = order_id;
      } catch (error) {
        console.error('Error showing payment completion popup:', error);
        showAlert(`حدث خطأ أثناء تحضير بيانات الدفع: ${error.message}`, 'error');
      }
    }
    // تأكيد الدفع
    async function confirmPayment() {
      const popup = document.getElementById('payment-completion-popup');
      const order_id = popup.dataset.order_id;
      const pin = document.getElementById('payment-pin').value.trim();
      console.log('Confirming payment:', { order_id, pin });
      if (!pin || !/^\d{4}$/.test(pin)) {
        showAlert(
          'يرجى إدخال رمز PIN صحيح مكون من 4 أرقام',
          'error',
          document.getElementById('payment-completion-alerts')
        );
        return;
      }
      try {
        const response = await fetch('/api/payments-comp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId: order_id,
            pin,
            paymentMethod: 'عند الاستلام',
            amount: currentPaymentData?.amount || 0,
          }),
          credentials: 'include',
        });
        if (!response.ok) {
          const errorData = await response.json();
          console.error('API error:', errorData);
          throw new Error(errorData.error || 'فشل في إتمام الدفع');
        }
        const data = await response.json();
        showAlert(data.message, 'success');
        closePaymentCompletionPopup();
        fetchPayments();
      } catch (error) {
        console.error('Error completing payment:', error);
        showAlert(
          `حدث خطأ أثناء إتمام الدفع: ${error.message}`,
          'error',
          document.getElementById('payment-completion-alerts')
        );
      }
    }
    // عرض نافذة تفاصيل الدفع
    async function showPaymentDetailsPopup(order_id) {
      currentOrderId = order_id;
      try {
        console.log('Fetching payment details for order:', order_id);
        const response = await fetch(`/api/payments-manage/${order_id}`, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'فشل في جلب تفاصيل الدفع');
        }
        const data = await response.json();
        console.log('Payment details received:', data);
        if (!data.payment || !data.items) {
          throw new Error('بيانات الطلب أو العناصر غير موجودة');
        }
        currentPaymentData = data.payment;
        renderOrderItems(data.items);
        // عرض ملخص الطلب في نافذة التفاصيل
        const { subtotal, tax, total } = calculateOrderSummary(data.payment.amount);
        document.getElementById('details-subtotal-amount').textContent = `JOD${subtotal.toFixed(2)}`;
        document.getElementById('details-tax-amount').textContent = `JOD${tax.toFixed(2)}`;
        document.getElementById('details-total-amount').textContent = `JOD${total.toFixed(2)}`;
        await populateSuppliers(data.payment.manufacturer_id);
        supplierSelect.value =
          data.payment.supplier_name !== 'غير محدد' ? (data.payment.supplier_id || '') : '';
        paymentTermsSelect.value = data.payment.payment_terms || '';
        popup.style.display = 'flex';
      } catch (error) {
        console.error('Error fetching payment details:', error);
        showAlert(`حدث خطأ أثناء جلب تفاصيل الدفع: ${error.message}`, 'error', popupAlerts);
      }
    }
    // طباعة الفاتورة
    async function printInvoice(order_id) {
      try {
        console.log('Fetching payment details for printing invoice:', order_id);
        const response = await fetch(`/api/payments-manage/${order_id}`, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'فشل في جلب تفاصيل الدفع');
        }
        const data = await response.json();
        console.log('Payment details for invoice:', data);
        if (!data.payment || !data.items) {
          throw new Error('بيانات الطلب أو العناصر غير موجودة');
        }
        const payment = data.payment;
        const items = data.items;
        const { subtotal, tax, total } = calculateOrderSummary(payment.amount);
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
            <p><strong>تاريخ الطلب:</strong> ${
              payment.order_date ? new Date(payment.order_date).toLocaleDateString('ar') : 'غير محدد'
            }</p>
            <p><strong>اسم الشركة المصنعة:</strong> ${payment.manufacturer_name || 'غير محدد'}</p>
            <p><strong>حالة الدفع:</strong> ${payment.payment_status || 'غير مدفوع'}</p>
            <p><strong>اسم الموظف:</strong> ${payment.employee_name || 'غير محدد'}</p>
            <p><strong>اسم المورد:</strong> ${payment.supplier_name || 'غير محدد'}</p>
            <p><strong>طريقة الدفع:</strong> ${payment.payment_terms || 'غير محدد'}</p>
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
              <td>JOD${price}</td>
              <td>JOD${itemTotal.toFixed(2)}</td>
            </tr>
          `;
        });
        invoiceContent += `
              </tbody>
            </table>
            <div class="summary">
              <p><strong>إجمالي المبلغ:</strong> JOD${subtotal.toFixed(2)}</p>
              <p><strong>الضريبة (16%):</strong> JOD${tax.toFixed(2)}</p>
              <p><strong>المجموع النهائي:</strong> JOD${total.toFixed(2)}</p>
            </div>
            <hr>
            <p style="text-align: center;">تم إنشاء هذه الفاتورة بتاريخ: ${new Date().toLocaleDateString(
              'ar'
            )}</p>
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
      } catch (error) {
        console.error('Error printing invoice:', error);
        showAlert(`حدث خطأ أثناء طباعة الفاتورة: ${error.message}`, 'error');
      }
    }
    // تعبئة قائمة الموردين
    async function populateSuppliers(manufacturerId) {
      try {
        console.log('Fetching suppliers for manufacturer:', manufacturerId);
        if (!manufacturerId) {
          throw new Error('معرف الشركة المصنعة غير موجود');
        }
        const response = await fetch(`/api/vendors?manufacturer_id=${manufacturerId}`, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'فشل في جلب الموردين');
        }
        const data = await response.json();
        console.log('Suppliers received:', data);
        supplierSelect.innerHTML = '<option value="">اختر مورد</option>';
        if (data.suppliers && Array.isArray(data.suppliers)) {
          data.suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.user_id || '';
            option.textContent = supplier.username || 'مورد غير محدد';
            supplierSelect.appendChild(option);
          });
        } else {
          console.warn('No suppliers found or invalid data');
          showAlert('لا يوجد موردون متاحون', 'error', popupAlerts);
        }
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        showAlert(`حدث خطأ أثناء جلب الموردين: ${error.message}`, 'error', popupAlerts);
      }
    }
    // عرض عناصر الطلب
    function renderOrderItems(items) {
      console.log('Rendering order items:', items);
      orderItemsTableBody.innerHTML = '';
      if (!items || !Array.isArray(items)) {
        console.warn('No items to render');
        orderItemsTableBody.innerHTML = '<tr><td colspan="3">لا توجد عناصر</td></tr>';
        return;
      }
      items.forEach(item => {
        const row = document.createElement('tr');
        const priceValue = item.price != null ? Number(item.price) : 0;
        const price = isNaN(priceValue) ? '0.00' : priceValue.toFixed(2);
        row.innerHTML = `
          <td>${item.product_name || 'غير محدد'}</td>
          <td>${item.quantity || 0}</td>
          <td>JOD${price}</td>
        `;
        orderItemsTableBody.appendChild(row);
      });
    }
    // حفظ تفاصيل الدفع
    async function savePaymentDetails() {
      const supplierId = supplierSelect.value;
      const paymentTerms = paymentTermsSelect.value;
      console.log('Saving payment details:', { order_id: currentOrderId, supplierId, paymentTerms });
      if (!supplierId || !paymentTerms) {
        console.warn('Missing supplier or payment terms');
        showAlert('يرجى اختيار مورد وطريقة دفع', 'error', popupAlerts);
        return;
      }
      if (paymentTerms !== 'عند الاستلام') {
        showAlert('الدفع متاح فقط عند الاستلام حاليًا', 'error', popupAlerts);
        return;
      }
      try {
        const response = await fetch(`/api/payments-manage/${currentOrderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplier_id: supplierId, payment_terms: paymentTerms }),
          credentials: 'include',
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'فشل في حفظ تفاصيل الدفع');
        }
        console.log('Payment details saved successfully');
        showAlert('تم حفظ تفاصيل الدفع بنجاح', 'success', popupAlerts);
        closePopup();
        fetchPayments();
      } catch (error) {
        console.error('Error saving payment details:', error);
        showAlert(`حدث خطأ أثناء حفظ تفاصيل الدفع: ${error.message}`, 'error', popupAlerts);
      }
    }
    // عرض تنبيه
    function showAlert(message, type, container = alertsContainer) {
      if (lastMessage === message) return; // منع تكرار الرسالة
      lastMessage = message;
      const messageText = container.querySelector('#messageText') || container;
      if (container && messageText) {
        messageText.textContent = message;
        container.style.display = 'flex';
        container.className = `message-header ${type === 'error' ? 'alert-error' : 'alert-success'}`;
        setTimeout(() => {
          hideMessage(container);
          lastMessage = null;
        }, 3000);
      } else {
        console.error('عنصر container أو messageText غير موجود');
      }
    }
    // إخفاء رسالة
    function hideMessage(container = alertsContainer) {
      container.style.display = 'none';
      const messageText = container.querySelector('#messageText') || container;
      messageText.textContent = '';
    }
    // تهيئة الصفحة
    console.log('Initializing payment management page...');
    fetchPayments();
});