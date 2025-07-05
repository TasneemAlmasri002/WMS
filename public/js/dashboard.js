document.addEventListener('DOMContentLoaded', async () => {
    // Helper function to display error messages
    function displayError(canvasId, message) {
        const container = document.getElementById(canvasId)?.parentElement;
        if (container) {
            container.innerHTML += `<p style="color: red;">${message}</p>`;
        }
    }
    // Fetch user data
    let userData = {};
    const userResponse = await fetch('/api/user-dash', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    if (userResponse.ok) {
        userData = await userResponse.json();
        document.getElementById('user-name').textContent = userData.username || 'غير متوفر';
        document.getElementById('user-role').textContent = userData.role || 'غير متوفر';
        document.getElementById('user-email').textContent = userData.email || 'غير متوفر';
        document.getElementById('user-phone').textContent = userData.phone || '';
    } else {
        console.error('خطأ في جلب بيانات المستخدم:', userResponse.status);
        document.getElementById('user-name').textContent = 'خطأ في التحميل';
        document.getElementById('user-role').textContent = 'خطأ في التحميل';
        document.getElementById('user-email').textContent = 'خطأ في التحميل';
        document.getElementById('user-phone').textContent = 'خطأ في التحميل';
        return;
    }
    // Check if Chart.js is loaded
    if (!window.Chart) {
        console.error('Chart.js غير محمل. محاولة تحميل احتياطي...');
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.5/chart.umd.min.js';
        script.onload = () => console.log('Chart.js احتياطي تم تحميله');
        script.onerror = () => {
            console.error('فشل تحميل Chart.js الاحتياطي');
            displayError('orderStatsChart', 'خطأ: فشل تحميل مكتبة Chart.js');
            displayError('returnStatsChart', 'خطأ: فشل تحميل مكتبة Chart.js');
        };
        document.head.appendChild(script);
        if (!window.Chart) {
            displayError('orderStatsChart', 'خطأ: مكتبة Chart.js غير متوفرة');
            displayError('returnStatsChart', 'خطأ: مكتبة Chart.js غير متوفرة');
            return;
        }
    }
    // Fetch stats based on user role
    const role = userData.role;
    let statsEndpoint = role === 'مسؤول النظام' ? '/api/user-stats' :
                       role === 'موظف المستودع' ? '/api/warehouse-stats' :
                       role === 'مدير' ? '/api/warehouse-stats' :
                       role === 'موظف التتبع و الفواتير' ? '/api/tracking-billing-stats' :
                       role === 'مورد' ? '/api/supplier-stats' : null;
    if (!statsEndpoint) {
        console.error('دور المستخدم غير مدعوم:', role);
        displayError('orderStatsChart', 'دور المستخدم غير مدعوم');
        displayError('returnStatsChart', 'دور المستخدم غير مدعوم');
        return;
    }
    const statsResponse = await fetch(statsEndpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    let statsData = {};
    if (statsResponse.ok) {
        statsData = await statsResponse.json();
        console.log('الإحصائيات:', JSON.stringify(statsData, null, 2));
    } else {
        console.error('خطأ في جلب الإحصائيات:', statsResponse.status);
        displayError('orderStatsChart', 'خطأ في تحميل إحصائيات الطلبات');
        displayError('returnStatsChart', 'خطأ في تحميل إحصائيات المرتجعات');
        return;
    }
    if (role === 'مورد') {
    console.log('بيانات الإحصائيات الخام:', JSON.stringify(statsData, null, 2));
    // Order Stats Chart
    const orderCanvas = document.getElementById('orderStatsChart');
    if (!orderCanvas) {
        console.warn('عنصر orderStatsChart غير موجود في DOM');
        displayError('orderStatsChart', 'خطأ: عنصر الرسم البياني للطلبات غير موجود');
    } else if (!statsData.orders || !Array.isArray(statsData.orders)) {
        console.warn('بيانات الطلبات غير صالحة أو مفقودة');
        displayError('orderStatsChart', 'خطأ: بيانات الطلبات غير صالحة');
    } else {
        const orderStatusCounts = {
            'قيد الانتظار': 0,
            'موافق عليه': 0,
            'مرفوض': 0,
            'مكتمل': 0
        };
        statsData.orders.forEach(order => {
            if (order.status in orderStatusCounts) {
                orderStatusCounts[order.status]++;
            }
        });
        console.log('إحصائيات الطلبات:', orderStatusCounts);
        if (Object.values(orderStatusCounts).every(count => count === 0)) {
            console.warn('لا توجد طلبات للمورد');
            displayError('orderStatsChart', 'لا توجد طلبات متاحة');
        }
        new Chart(orderCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['قيد الانتظار', 'موافق عليه', 'مرفوض', 'مكتمل'],
                datasets: [{
                    label: 'إحصائيات الطلبات',
                    data: [
                        orderStatusCounts['قيد الانتظار'],
                        orderStatusCounts['موافق عليه'],
                        orderStatusCounts['مرفوض'],
                        orderStatusCounts['مكتمل']
                    ],
                    backgroundColor: ['#ffca28', '#4caf50', '#ef5350', '#26a69a'],
                    borderColor: ['#1C2526', '#1C2526', '#1C2526', '#1C2526'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 14 } } },
                    title: { display: true, text: 'إحصائيات الطلبات', font: { size: 16 } }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'العدد' } },
                    x: { title: { display: true, text: 'الحالة' } }
                }
            }
        });
    }
    // Return Stats Chart
    const returnCanvas = document.getElementById('returnStatsChart');
    if (!returnCanvas) {
        console.warn('عنصر returnStatsChart غير موجود في DOM');
        displayError('returnStatsChart', 'خطأ: عنصر الرسم البياني للمرتجعات غير موجود');
    } else if (!statsData.returnStats || typeof statsData.returnStats !== 'object') {
        console.warn('بيانات إحصائيات المرتجعات غير صالحة أو مفقودة');
        displayError('returnStatsChart', 'خطأ: بيانات المرتجعات غير صالحة');
    } else {
        console.log('إحصائيات المرتجعات:', statsData.returnStats);
        if (Object.values(statsData.returnStats).every(count => count === 0)) {
            console.warn('لا توجد مرتجعات للمورد');
            displayError('returnStatsChart', 'لا توجد مرتجعات متاحة');
        }
        new Chart(returnCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['قيد الانتظار', 'موافق عليه', 'مرفوض', 'تمت المعالجة'],
                datasets: [{
                    label: 'إحصائيات المرتجعات',
                    data: [
                        statsData.returnStats['قيد الانتظار'] || 0,
                        statsData.returnStats['موافق عليه'] || 0,
                        statsData.returnStats['مرفوض'] || 0,
                        statsData.returnStats['تمت المعالجة'] || 0
                    ],
                    backgroundColor: ['#ffca28', '#4caf50', '#ef5350', '#0288d1'],
                    borderColor: ['#1C2526', '#1C2526', '#1C2526', '#1C2526'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 14 } } },
                    title: { display: true, text: 'إحصائيات المرتجعات', font: { size: 16 } }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'العدد' } },
                    x: { title: { display: true, text: 'الحالة' } }
                }
            }
        });
    }
    } else {
        // Other roles (unchanged for brevity, excluding 'تفاصيل إضافية')
        if (role === 'مسؤول النظام') {
            const userCanvas = document.getElementById('userStatsChart');
            if (userCanvas && statsData.userStats) {
                new Chart(userCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: ['نشط', 'غير نشط'],
                        datasets: [{
                            label: 'إحصائيات المستخدمين',
                            data: [statsData.userStats.Active || 0, statsData.userStats.Inactive || 0],
                            backgroundColor: ['#4b5fbb', '#ff6b6b'],
                            borderColor: ['#1C2526', '#1C2526'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top', labels: { font: { size: 14 } } },
                            title: { display: true, text: 'إحصائيات المستخدمين', font: { size: 16 } }
                        },
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'العدد' } },
                            x: { title: { display: true, text: 'الحالة' } }
                        }
                    }
                });
            }
            const orderCanvas = document.getElementById('orderStatsChart');
            if (orderCanvas && statsData.orderStats) {
                new Chart(orderCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: ['قيد الانتظار', 'موافق عليه', 'مرفوض', 'مكتمل'],
                        datasets: [{
                            label: 'إحصائيات الطلبات',
                            data: [
                                statsData.orderStats['قيد الانتظار'] || 0,
                                statsData.orderStats['موافق عليه'] || 0,
                                statsData.orderStats['مرفوض'] || 0,
                                statsData.orderStats['مكتمل'] || 0
                            ],
                            backgroundColor: ['#ffca28', '#4caf50', '#ef5350', '#26a69a'],
                            borderColor: ['#1C2526', '#1C2526', '#1C2526', '#1C2526'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top', labels: { font: { size: 14 } } },
                            title: { display: true, text: 'إحصائيات الطلبات', font: { size: 16 } }
                        },
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'العدد' } },
                            x: { title: { display: true, text: 'الحالة' } }
                        }
                    }
                });
            }
        } else if (role === 'موظف المستودع') {
            const stockCanvas = document.getElementById('stockChart');
            if (stockCanvas && statsData.stockStats) {
                new Chart(stockCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: statsData.stockStats.map(item => item.product_name) || [],
                        datasets: [{
                            label: 'كميات المخزون',
                            data: statsData.stockStats.map(item => item.quantity) || [],
                            backgroundColor: '#4b5fbb',
                            borderColor: '#1C2526',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top', labels: { font: { size: 14 } } },
                            title: { display: true, text: 'إحصائيات المخزون', font: { size: 16 } }
                        },
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'الكمية' } },
                            x: { title: { display: true, text: 'المنتج' } }
                        }
                    }
                });
            }
            const orderCanvas = document.getElementById('orderStatsChart');
            if (orderCanvas && statsData.orderStats) {
                new Chart(orderCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: ['قيد الانتظار', 'موافق عليه', 'مرفوض', 'مكتمل'],
                        datasets: [{
                            label: 'إحصائيات الطلبات',
                            data: [
                                statsData.orderStats['قيد الانتظار'] || 0,
                                statsData.orderStats['موافق عليه'] || 0,
                                statsData.orderStats['مرفوض'] || 0,
                                statsData.orderStats['مكتمل'] || 0
                            ],
                            backgroundColor: ['#ffca28', '#4caf50', '#ef5350', '#26a69a'],
                            borderColor: ['#1C2526', '#1C2526', '#1C2526', '#1C2526'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top', labels: { font: { size: 14 } } },
                            title: { display: true, text: 'إحصائيات الطلبات', font: { size: 16 } }
                        },
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'العدد' } },
                            x: { title: { display: true, text: 'الحالة' } }
                        }
                    }
                });
            }
            const returnCanvas = document.getElementById('returnStatsChart');
            if (returnCanvas && statsData.returnStats) {
                new Chart(returnCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: ['قيد الانتظار', 'موافق عليه', 'مرفوض', 'تمت المعالجة'],
                        datasets: [{
                            label: 'إحصائيات المرتجعات',
                            data: [
                                statsData.returnStats['قيد الانتظار'] || 0,
                                statsData.returnStats['موافق عليه'] || 0,
                                statsData.returnStats['مرفوض'] || 0,
                                statsData.returnStats['تمت المعالجة'] || 0
                            ],
                            backgroundColor: ['#ffca28', '#4caf50', '#ef5350', '#0288d1'],
                            borderColor: ['#1C2526', '#1C2526', '#1C2526', '#1C2526'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top', labels: { font: { size: 14 } } },
                            title: { display: true, text: 'إحصائيات المرتجعات', font: { size: 16 } }
                        },
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'العدد' } },
                            x: { title: { display: true, text: 'الحالة' } }
                        }
                    }
                });
            }
        } 
        else if (role === 'مدير') {
            const stockCanvas = document.getElementById('stockChart');
            if (stockCanvas && statsData.stockStats) {
                new Chart(stockCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: statsData.stockStats.map(item => item.product_name) || [],
                        datasets: [{
                            label: 'كميات المخزون',
                            data: statsData.stockStats.map(item => item.quantity) || [],
                            backgroundColor: '#4b5fbb',
                            borderColor: '#1C2526',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top', labels: { font: { size: 14 } } },
                            title: { display: true, text: 'إحصائيات المخزون', font: { size: 16 } }
                        },
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'الكمية' } },
                            x: { title: { display: true, text: 'المنتج' } }
                        }
                    }
                });
            }
            const orderCanvas = document.getElementById('orderStatsChart');
            if (orderCanvas && statsData.orderStats) {
                new Chart(orderCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: ['قيد الانتظار', 'موافق عليه', 'مرفوض', 'مكتمل'],
                        datasets: [{
                            label: 'إحصائيات الطلبات',
                            data: [
                                statsData.orderStats['قيد الانتظار'] || 0,
                                statsData.orderStats['موافق عليه'] || 0,
                                statsData.orderStats['مرفوض'] || 0,
                                statsData.orderStats['مكتمل'] || 0
                            ],
                            backgroundColor: ['#ffca28', '#4caf50', '#ef5350', '#26a69a'],
                            borderColor: ['#1C2526', '#1C2526', '#1C2526', '#1C2526'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top', labels: { font: { size: 14 } } },
                            title: { display: true, text: 'إحصائيات الطلبات', font: { size: 16 } }
                        },
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'العدد' } },
                            x: { title: { display: true, text: 'الحالة' } }
                        }
                    }
                });
            }
            const returnCanvas = document.getElementById('returnStatsChart');
            if (returnCanvas && statsData.returnStats) {
                new Chart(returnCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: ['قيد الانتظار', 'موافق عليه', 'مرفوض', 'تمت المعالجة'],
                        datasets: [{
                            label: 'إحصائيات المرتجعات',
                            data: [
                                statsData.returnStats['قيد الانتظار'] || 0,
                                statsData.returnStats['موافق عليه'] || 0,
                                statsData.returnStats['مرفوض'] || 0,
                                statsData.returnStats['تمت المعالجة'] || 0
                            ],
                            backgroundColor: ['#ffca28', '#4caf50', '#ef5350', '#0288d1'],
                            borderColor: ['#1C2526', '#1C2526', '#1C2526', '#1C2526'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top', labels: { font: { size: 14 } } },
                            title: { display: true, text: 'إحصائيات المرتجعات', font: { size: 16 } }
                        },
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'العدد' } },
                            x: { title: { display: true, text: 'الحالة' } }
                        }
                    }
                });
            }
        }else if (role === 'موظف التتبع و الفواتير') {
            const paymentCanvas = document.getElementById('paymentStatusChart');
            if (paymentCanvas && statsData.paymentStats) {
                new Chart(paymentCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: ['مدفوع', 'غير مدفوع'],
                        datasets: [{
                            label: 'إحصائيات حالة الدفع',
                            data: [
                                statsData.paymentStats['مدفوع'] || 0,
                                statsData.paymentStats['غير مدفوع'] || 0
                            ],
                            backgroundColor: ['#4caf50', '#ef5350'],
                            borderColor: ['#1C2526', '#1C2526'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top', labels: { font: { size: 14 } } },
                            title: { display: true, text: 'إحصائيات حالة الدفع', font: { size: 16 } }
                        },
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'العدد' } },
                            x: { title: { display: true, text: 'حالة الدفع' } }
                        }
                    }
                });
            }
            const orderCanvas = document.getElementById('orderStatsChart');
            if (orderCanvas && statsData.orderStats) {
                new Chart(orderCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: ['قيد الانتظار', 'موافق عليه', 'مرفوض', 'مكتمل'],
                        datasets: [{
                            label: 'إحصائيات الطلبات',
                            data: [
                                statsData.orderStats['قيد الانتظار'] || 0,
                                statsData.orderStats['موافق عليه'] || 0,
                                statsData.orderStats['مرفوض'] || 0,
                                statsData.orderStats['مكتمل'] || 0
                            ],
                            backgroundColor: ['#ffca28', '#4caf50', '#ef5350', '#26a69a'],
                            borderColor: ['#1C2526', '#1C2526', '#1C2526', '#1C2526'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top', labels: { font: { size: 14 } } },
                            title: { display: true, text: 'إحصائيات الطلبات', font: { size: 16 } }
                        },
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'العدد' } },
                            x: { title: { display: true, text: 'الحالة' } }
                        }
                    }
                });
            }
        } else {
            console.error('دور المستخدم غير مدعوم:', role);
            displayError('orderStatsChart', 'دور المستخدم غير مدعوم');
            displayError('returnStatsChart', 'دور المستخدم غير مدعوم');
        }
    }
});