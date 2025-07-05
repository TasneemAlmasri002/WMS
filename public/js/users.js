// يتم استدعاؤها عند تحميل الصفحة، تتحقق من دور المستخدم وتبدأ جلب البيانات وإعداد الفلاتر إذا وجدت جدول البيانات
document.addEventListener('DOMContentLoaded', async () => {
    try {
      await checkUserRole();
      if (document.querySelector('#dataTable')) {
        fetchAndDisplayUsers();
        setupFilters();
      }
    } catch (error) {
      // الأخطاء يتم التعامل معها داخل checkUserRole
    }
  });
// تتحقق من دور المستخدم عبر طلب GET إلى /api/user، وتتأكد أن المستخدم هو مسؤول النظام، وإلا تعيد توجيهه إلى الصفحة الرئيسية
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
      console.log('بيانات المستخدم من /api/user:', data);
      if (data.role !== 'مسؤول النظام') {
        showMessage('فقط مسؤول النظام يمكنه الوصول إلى هذه الصفحة', 'error');
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
// فلتره حسب الدور والحاله
async function fetchUsers(roleFilter = '', statusFilter = '') {
    try {
        let url = '/users';
        const params = new URLSearchParams();
        if (roleFilter) params.append('role', roleFilter);
        if (statusFilter) params.append('status', statusFilter);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('خطأ أثناء جلب المستخدمين:', error);
        showMessage('حدث خطأ أثناء تحميل المستخدمين.');
        return [];
    }
}
// تعرض قائمة المستخدمين في جدول البيانات، وتُنشئ صفًا لكل مستخدم مع أزرار التعديل والحذف
function displayUsers(users) {
    const tableBody = document.querySelector('#dataTable tbody');
    tableBody.innerHTML = ''; // بمنع يعطيني null بعطيني بس row فاضي 
    users.forEach(user => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${user.user_id}</td>
            <td>${user.username}</td>
            <td>${user.role}</td>
            <td>${user.email}</td>
            <td>${user.phone_number}</td>
            <td>${user.status === 'Active' ? 'نشط' : 'غير نشط'}</td>
            <td class="action-buttons">
                <button class="edit-btn" onclick="editUser(${user.user_id})">تعديل</button>
                <button class="delete-btn" onclick="deleteUser(${user.user_id})">حذف</button>
            </td>
        `;
        tableBody.appendChild(row); 
    });
}
// فلتره حسب الرول 
function setupFilters() {
    const roleButtons = document.querySelectorAll('.role-btn');
    const activityFilter = document.getElementById('activityFilter');
    let currentRole = '';
    let currentStatus = '';

    roleButtons.forEach(button => {
        button.addEventListener('click', () => {
            roleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentRole = button.dataset.role;
            fetchAndDisplayUsers(currentRole, currentStatus);
        });
    });

    activityFilter.addEventListener('change', () => {
        currentStatus = activityFilter.value;
        fetchAndDisplayUsers(currentRole, currentStatus);
    });
}
// فنكشن لتجلب المستخدمين 
async function fetchAndDisplayUsers(roleFilter = '', statusFilter = '') {
    const users = await fetchUsers(roleFilter, statusFilter);
    displayUsers(users);
}

async function searchUsers() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const roleFilter = document.querySelector('.role-btn.active').dataset.role;
    const statusFilter = document.getElementById('activityFilter').value;

    const users = await fetchUsers(roleFilter, statusFilter);
    const filteredUsers = users.filter(user => {
        return (
            user.user_id.toString().includes(searchTerm) ||
            user.username.toLowerCase().includes(searchTerm) ||
            user.role.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            user.phone_number.toLowerCase().includes(searchTerm) ||
            (user.status === 'Active' ? 'نشط' : 'غير نشط').toLowerCase().includes(searchTerm)
        );
    });

    displayUsers(filteredUsers);
    document.getElementById('searchResultsCount').textContent = `عدد النتائج: ${filteredUsers.length}`;
}

function resetSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResultsCount').textContent = '';
    document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.role-btn[data-role=""]').classList.add('active');
    document.getElementById('activityFilter').value = '';
    fetchAndDisplayUsers();
}

async function exportToCSV() {
    const roleFilter = document.querySelector('.role-btn.active').dataset.role;
    const statusFilter = document.getElementById('activityFilter').value;
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();

    let users = await fetchUsers(roleFilter, statusFilter);
    
    if (searchTerm) {
        users = users.filter(user => {
            return (
                user.user_id.toString().includes(searchTerm) ||
                user.username.toLowerCase().includes(searchTerm) ||
                user.role.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm) ||
                user.phone_number.toLowerCase().includes(searchTerm) ||
                (user.status === 'Active' ? 'نشط' : 'غير نشط').toLowerCase().includes(searchTerm)
            );
        });
    }

    if (users.length === 0) {
        showMessage('لا توجد بيانات للتصدير!');
        return;
    }

    // تحديد رؤوس الأعمدة
    const headers = ['معرف المستخدم', 'اسم المستخدم', 'الدور', 'البريد الإلكتروني', 'رقم الهاتف', 'الحالة'];

    // تنسيق البيانات
    const rows = users.map(user => {
        return [
            user.user_id,
            `"${user.username.replace(/"/g, '""')}"`, // حماية اسم المستخدم
            `"${user.role.replace(/"/g, '""')}"`, // حماية الدور
            `"${user.email.replace(/"/g, '""')}"`, // حماية البريد الإلكتروني
            `="${user.phone_number}"""`, 
            user.status === 'Active' ? 'نشط' : 'غير نشط'
        ];
    });

    // إنشاء محتوى CSV
    let csvContent = '\ufeff'; // BOM لدعم النصوص العربية
    csvContent += headers.join(',') + '\n';
    csvContent += rows.map(row => row.join(',')).join('\n');

    // إنشاء وتنزيل الملف
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showAddUserPopup() {
    document.getElementById('addPopup').style.display = 'flex';
    document.getElementById('userName').value = '';
    document.getElementById('userEmail').value = '';
    document.getElementById('userPhone').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userRole').value = 'مسؤول النظام';
    clearErrors();
}

function closeAddUserPopup() {
    document.getElementById('addPopup').style.display = 'none';
}

async function addUser() {
    clearErrors();
    const userName = document.getElementById('userName').value;
    const userEmail = document.getElementById('userEmail').value;
    const userPhone = document.getElementById('userPhone').value;
    const userPassword = document.getElementById('userPassword').value;
    const userRole = document.getElementById('userRole').value;
    const countryCode = document.getElementById('countryCode').value;

    // التحقق من الحقول
    let errors = [];
    if (!userName) {
        errors.push({ field: 'userNameError', message: 'اسم المستخدم مطلوب' });
    }
    if (!userEmail) {
        errors.push({ field: 'userEmailError', message: 'البريد الإلكتروني مطلوب' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
        errors.push({ field: 'userEmailError', message: 'تنسيق البريد الإلكتروني غير صالح' });
    }
    if (!userPhone) {
        errors.push({ field: 'userPhoneError', message: 'رقم الهاتف مطلوب' });
    }
    if (!userPassword) {
        errors.push({ field: 'userPasswordError', message: 'كلمة المرور مطلوبة' });
    } else if (userPassword.length <= 6) {
        errors.push({ field: 'userPasswordError', message: 'كلمة المرور يجب أن تكون أكثر من 6 أحرف أو أرقام' });
    }

    const phoneNumber = countryCode + userPhone;
    if (!/^\+9627\d{8}$/.test(phoneNumber)) {
        errors.push({ field: 'userPhoneError', message: 'تنسيق رقم الهاتف غير صالح' });
    }

    // إظهار جميع الأخطاء
    if (errors.length > 0) {
        errors.forEach(error => showError(error.field, error.message));
        return;
    }

    const userData = {
        username: userName,
        email: userEmail,
        phone_number: phoneNumber,
        password: userPassword,
        role: userRole,
        status: 'Active'
    };

    if (userRole === 'مورد') {
        userData.suppliername = userName; // إضافة suppliername لجدول الموردين
        userData.address = null;
    }

    try {
        const response = await fetch('/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (response.ok) {
            showMessage(data.message);
            closeAddUserPopup();
            fetchAndDisplayUsers();
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        showError('addFormError', `حدث خطأ: ${error.message}`);
    }
}

async function editUser(userId) {
    try {
        const response = await fetch(`/users/${userId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const user = await response.json();
        showEditUserPopup(user);
    } catch (error) {
        showMessage('حدث خطأ أثناء جلب المستخدم.');
    }
}

function showEditUserPopup(user) {
    if (!user || !user.user_id) {
        showError('editFormError', 'لا يمكن تحميل بيانات المستخدم.');
        return;
    }
    let phoneNumber = user.phone_number.startsWith('+962') ? user.phone_number.substring(4) : user.phone_number;
    document.getElementById('editUserId').value = user.user_id;
    document.getElementById('editUserName').value = user.username || '';
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editPhoneNumber').value = phoneNumber || '';
    document.getElementById('editRole').value = user.role || 'مسؤول النظام';
    document.getElementById('editStatus').value = user.status || 'Active';
    document.getElementById('editPopup').style.display = 'flex';
    clearErrors();
}

async function updateUser(userId) {
    clearErrors();
    const userName = document.getElementById('editUserName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const phoneNumber = document.getElementById('editPhoneNumber').value.trim();
    const countryCode = document.getElementById('editCountryCode').value;
    const role = document.getElementById('editRole').value;
    const status = document.getElementById('editStatus').value;

    let errors = [];
    if (!userName) {
        errors.push({ field: 'editUserNameError', message: 'اسم المستخدم مطلوب' });
    } else if (userName.length > 50) {
        errors.push({ field: 'editUserNameError', message: 'اسم المستخدم يجب ألا يتجاوز 50 حرفًا' });
    }
    if (!email) {
        errors.push({ field: 'editEmailError', message: 'البريد الإلكتروني مطلوب' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ field: 'editEmailError', message: 'تنسيق البريد الإلكتروني غير صالح' });
    }
    const fullPhoneNumber = countryCode + phoneNumber;
    if (!phoneNumber) {
        errors.push({ field: 'editPhoneError', message: 'رقم الهاتف مطلوب' });
    } else if (!/^\+9627\d{8}$/.test(fullPhoneNumber)) {
        errors.push({ field: 'editPhoneError', message: 'تنسيق رقم الهاتف غير صالح' });
    }

    if (errors.length > 0) {
        errors.forEach(error => showError(error.field, error.message));
        return;
    }

    try {
        const currentUserResponse = await fetch(`/users/${userId}`);
        const currentUser = await currentUserResponse.json();

        const userData = {};
        if (userName !== currentUser.username) userData.username = userName;
        if (email !== currentUser.email) userData.email = email;
        if (fullPhoneNumber !== currentUser.phone_number) userData.phone_number = fullPhoneNumber;
        if (role !== currentUser.role) userData.role = role;
        if (status !== currentUser.status) userData.status = status;

        if (role === 'مورد') {
            userData.suppliername = userName; // إرسال suppliername بناءً على username
            if (currentUser.role !== 'مورد') {
                userData.address = null;
            }
        }

        if (Object.keys(userData).length === 0) {
            showMessage('لا توجد تغييرات للحفظ');
            closeEditUserPopup();
            return;
        }

        const response = await fetch(`/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        if (response.ok) {
            showMessage(data.message);
            closeEditUserPopup();
            fetchAndDisplayUsers();
        } else {
            if (data.field) {
                showError(data.field + 'Error', data.message);
            } else {
                showError('editFormError', `حدث خطأ: ${data.message}`);
            }
        }
    } catch (error) {
        showError('editFormError', `حدث خطأ: ${error.message}`);
    }
}

function resetPassword(userId) {
    document.getElementById('resetUserId').value = userId;
    document.getElementById('newPassword').value = '';
    document.getElementById('resetPasswordPopup').style.display = 'flex';
    clearErrors();
}

async function submitResetPassword() {
    clearErrors();
    const userId = document.getElementById('resetUserId').value;
    const newPassword = document.getElementById('newPassword').value;

    if (!newPassword) return showError('newPasswordError', 'كلمة المرور الجديدة مطلوبة');

    try {
        const response = await fetch(`/reset-password/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword })
        });
        
        if (!response.ok) throw new Error('فشل في إعادة تعيين كلمة المرور');
        const data = await response.json();
        showMessage(data.message);
        closeResetPasswordPopup();
    } catch (error) {
        showError('resetFormError', `حدث خطأ: ${error.message}`);
    }
}

async function deleteUser(userId) {
    if (confirm('هل أنت متأكد أنك تريد حذف هذا المستخدم؟')) {
        try {
            const response = await fetch(`/users/${userId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('فشل في حذف المستخدم');
            showMessage('تم حذف المستخدم بنجاح.');
            fetchAndDisplayUsers();
        } catch (error) {
            showMessage('حدث خطأ أثناء حذف المستخدم.');
        }
    }
}

function closeEditUserPopup() {
    document.getElementById('editPopup').style.display = 'none';
}

function closeResetPasswordPopup() {
    document.getElementById('resetPasswordPopup').style.display = 'none';
}

function showMessage(message) {
    const messageHeader = document.getElementById('messageHeader');
    document.getElementById('messageText').textContent = message;
    messageHeader.style.display = 'flex';
    setTimeout(() => messageHeader.style.display = 'none', 3000);
}

function hideMessage() {
    document.getElementById('messageHeader').style.display = 'none';
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
    });
}
