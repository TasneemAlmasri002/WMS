function discretizedDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkUserRole();
        fetchAisles();
        fetchDamagedItems();
        fetchStoreTransfers();
        handleHashNavigation();
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

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
        if (!['موظف المستودع', 'مدير'].includes(data.role)) {
            window.alert('غير مصرح بالوصول إلى هذه الصفحة');
            window.location.href = '/';
            throw new Error('غير مصرح');
        }
    } catch (error) {
        console.error('خطأ في التحقق من دور المستخدم:', error);
        window.alert('حدث خطأ أثناء جلب بيانات المستخدم');
        window.location.href = '/';
        throw error;
    }
}

function showMessage(message, type) {
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');
    messageText.textContent = message;
    messageBox.className = `message-header ${type === 'error' ? 'error' : 'success'}`;
    messageBox.style.display = 'block';
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 3000);
}

async function fetchAisles() {
    try {
        const response = await fetch('/api/inventory', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('فشل جلب الممرات');
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'فشل جلب بيانات المخزون');
        }
        displayAisles(data.aisles);
        updateTeamHeader(data.aisles[0]?.team_id || 'غير محدد');
    } catch (error) {
        console.error('Error fetching aisles:', error);
        showMessage('حدث خطأ أثناء جلب الممرات', 'error');
    }
}

async function fetchDamagedItems() {
    try {
        const response = await fetch('/api/damaged-items', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('فشل جلب المنتجات المتلفة');
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'فشل جلب بيانات المنتجات المتلفة');
        }
        displayDamagedItems(data.damagedItems);
    } catch (error) {
        console.error('Error fetching damaged items:', error);
        showMessage('حدث خطأ أثناء جلب المنتجات المتلفة', 'error');
    }
}

async function fetchStoreTransfers() {
    try {
        console.log('Fetching store transfers...');
        const response = await fetch('/api/transfer-to-store', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error(`فشل جلب سجلات النقل إلى المتجر: ${response.status}`);
        }
        const data = await response.json();
        console.log('Store transfers data:', data);
        if (!data.success) {
            throw new Error(data.error || 'فشل جلب بيانات النقل');
        }
        displayStoreTransfers(data.transfers);
    } catch (error) {
        console.error('Error fetching store transfers:', error);
        showMessage('حدث خطأ أثناء جلب سجلات النقل إلى المتجر', 'error');
    }
}

function displayAisles(aisles) {
    const aisleList = document.getElementById('aisleList');
    aisleList.innerHTML = '';
    aisles.forEach(aisle => {
        const aisleDiv = document.createElement('div');
        aisleDiv.className = 'aisle-item section-background padding-4 rounded shadow';
        aisleDiv.setAttribute('aria-label', `ممر ${aisle.aisle_name}`);
        aisleDiv.setAttribute('tabindex', '0');
        const header = document.createElement('div');
        header.className = 'team-label';
        header.textContent = `${aisle.aisle_name} (مجموعة: ${aisle.team_id})`;
        const shelvesDiv = document.createElement('div');
        shelvesDiv.className = 'shelves-container';
        const sortedShelves = aisle.shelves.sort((a, b) => a.shelf_id - b.shelf_id);
        sortedShelves.forEach(shelf => {
            const shelfDiv = document.createElement('div');
            shelfDiv.className = 'shelf-item section-background padding-4 rounded';
            shelfDiv.setAttribute('aria-label', `رف ${shelf.shelf_name}`);
            shelfDiv.setAttribute('tabindex', '0');
            const shelfHeader = document.createElement('div');
            shelfHeader.textContent = `رف ${shelf.shelf_name}`;
            shelfHeader.className = 'shelf-header';
            const sectionsContainer = document.createElement('div');
            sectionsContainer.className = 'sections-container';
            const sortedSections = shelf.sections.sort((a, b) => a.section_id - b.section_id);
            sortedSections.forEach(section => {
                const sectionDiv = document.createElement('div');
                sectionDiv.className = 'section-item';
                sectionDiv.setAttribute('aria-label', `قسم ${section.section_name}`);
                sectionDiv.setAttribute('tabindex', '0');
                const statuses = calculateSectionStatus(section);
                if (statuses.length === 1 && statuses[0] !== 'normal') {
                    sectionDiv.classList.add(statuses[0]);
                } else if (statuses.length > 1) {
                    sectionDiv.classList.add('multi-status');
                    sectionDiv.setAttribute('data-statuses', statuses.join(','));
                }
                sectionDiv.textContent = section.section_name;
                sectionDiv.addEventListener('click', () => {
                    window.location.href = `/inventory/stock_products.html?section_id=${section.section_id}`;
                });
                sectionDiv.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        window.location.href = `/inventory/stock_products.html?section_id=${section.section_id}`;
                    }
                });
                sectionsContainer.appendChild(sectionDiv);
            });
            shelfDiv.appendChild(shelfHeader);
            shelfDiv.appendChild(sectionsContainer);
            shelvesDiv.appendChild(shelfDiv);
        });
        aisleDiv.appendChild(header);
        aisleDiv.appendChild(shelvesDiv);
        aisleList.appendChild(aisleDiv);
    });
}

function displayDamagedItems(damagedItems) {
    const damagedItemsList = document.getElementById('damagedItemsList');
    damagedItemsList.innerHTML = '';
    if (damagedItems.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="no-data">لا توجد منتجات متلفة</td>';
        damagedItemsList.appendChild(row);
        return;
    }
    damagedItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.product_name || 'غير معروف'}</td>
            <td>${item.section_name || 'غير معروف'}</td>
            <td>${item.quantity}</td>
            <td>${item.damage_type}</td>
            <td>${item.damage_reason || 'غير محدد'}</td>
            <td>${new Date(item.damage_date).toLocaleDateString('ar-EG')}</td>
        `;
        damagedItemsList.appendChild(row);
    });
}

function displayStoreTransfers(transfers) {
    console.log('Displaying store transfers:', transfers);
    const transfersList = document.getElementById('storeTransfersList');
    transfersList.innerHTML = '';
    if (transfers.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="no-data">لا توجد سجلات نقل إلى المتجر</td>';
        transfersList.appendChild(row);
        return;
    }
    transfers.forEach(transfer => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${transfer.product_name || 'غير معروف'}</td>
            <td>${transfer.section_name || 'غير معروف'}</td>
            <td>${transfer.quantity}</td>
            <td>${transfer.transfer_type || 'نقل إلى المتجر'}</td>
            <td>${transfer.notes || 'غير محدد'}</td>
            <td>${new Date(transfer.transfer_date).toLocaleDateString('ar-EG')}</td>
        `;
        transfersList.appendChild(row);
    });
}

async function moveToDamaged(stockProductId, productId, sectionId, quantity, damageType, damageReason) {
    try {
        const response = await fetch('/api/damaged-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                stock_product_id: stockProductId,
                product_id: productId,
                section_id: sectionId,
                quantity: quantity,
                damage_type: damageType,
                damage_reason: damageReason,
                reported_by: (await (await fetch('/api/user')).json()).user_id
            }),
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'فشل نقل المنتج إلى المتلفات');
        }
        showMessage('تم نقل المنتج إلى المتلفات بنجاح', 'success');
        fetchAisles();
        fetchDamagedItems();
    } catch (error) {
        console.error('Error moving to damaged:', error);
        showMessage('حدث خطأ أثناء نقل المنتج إلى المتلفات', 'error');
    }
}

function updateTeamHeader(teamName) {
    document.getElementById('teamName').textContent = teamName;
}

function calculateSectionStatus(section) {
    const { stock } = section;
    const statuses = {
        outOfStock: false,
        expired: false,
        nearExpiry: false,
        lowStock: false,
    };
    const messages = [];
    let expiredProducts = [];
    const activeStatuses = [];

    console.log(`calculateSectionStatus ${section.section_name}: stock=${JSON.stringify(stock)}`);

    // Check for out-of-stock condition
    if (!stock || !stock.products || stock.products.length === 0 || stock.products.every(p => p.quantity === 0 || p.quantity === null)) {
        statuses.outOfStock = true;
        messages.push(` ${section.section_name}:  `);
        activeStatuses.push('out-of-stock');
    } else {
        // Use lowStock from backend
        if (stock.lowStock) {
            statuses.lowStock = true;
            messages.push(` ${section.section_name}:  `);
            activeStatuses.push('low-stock');
            console.log(`Low stock triggered for ${section.section_name}`);
        } else {
            console.log(`Low stock not triggered for ${section.section_name}`);
        }
    }

    const today = discretizedDate(new Date());
    if (stock?.products && Array.isArray(stock.products) && stock.products.length > 0) {
        stock.products.forEach(product => {
            if (product.expiration_date) {
                const expiryDate = discretizedDate(new Date(product.expiration_date));
                const daysUntilExpiry = (expiryDate - today) / (1000 * 60 * 60 * 24);
                if (daysUntilExpiry < 0) {
                    statuses.expired = true;
                    messages.push(` ${section.section_name}:   `);
                    if (!activeStatuses.includes('expired')) activeStatuses.push('expired');
                    expiredProducts.push({
                        stock_product_id: product.stock_product_id,
                        product_id: product.product_id,
                        quantity: product.quantity
                    });
                }
                const manufacturingDate = product.manufacturing_date ? discretizedDate(new Date(product.manufacturing_date)) : null;
                const alertDate = product.alert_entry_date ? discretizedDate(new Date(product.alert_entry_date)) : null;
                let nearExpiryThreshold = 30;
                if (manufacturingDate && expiryDate) {
                    const initialDays = (expiryDate - manufacturingDate) / (1000 * 60 * 60 * 24);
                    nearExpiryThreshold = initialDays * 0.15;
                }
                const isNearExpiry = alertDate && daysUntilExpiry > 0 && daysUntilExpiry <= nearExpiryThreshold;
                if (isNearExpiry) {
                    statuses.nearExpiry = true;
                    messages.push(` ${section.section_name}:   (${product.alert_entry_date})`);
                    if (!activeStatuses.includes('near-expiry')) activeStatuses.push('near-expiry');
                    console.log(`Near-expiry triggered for product ${product.product_id}: daysUntilExpiry=${daysUntilExpiry}, threshold=${nearExpiryThreshold}`);
                } else {
                    console.log(`Near-expiry not triggered for product ${product.product_id}: daysUntilExpiry=${daysUntilExpiry}, threshold=${nearExpiryThreshold}, alertDate=${alertDate}`);
                }
            }
        });
    }

    messages.forEach(message => {
        showMessage(message, 'error');
    });

    if (expiredProducts.length > 0) {
        const sectionDiv = document.querySelector(`[aria-label=" ${section.section_name}"]`);
        if (sectionDiv) {
            const moveBtn = document.createElement('button');
            moveBtn.className = 'button-red hover-button-red';
            moveBtn.textContent = ' ';
            moveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                expiredProducts.forEach(product => {
                    moveToDamaged(
                        product.stock_product_id,
                        product.product_id,
                        section.section_id,
                        product.quantity,
                        ' ',
                        ' '
                    );
                });
            });
            sectionDiv.appendChild(moveBtn);
        }
    }

    return activeStatuses.length > 0 ? activeStatuses : ['normal'];
}

function discretizedDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function openTab(tabName) {
    const tabs = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }
    const buttons = document.getElementsByClassName('tab-button');
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('active');
    }
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`button[onclick="openTab('${tabName}')"]`).classList.add('active');
    window.location.hash = tabName;
    window.scrollTo(0, 0); // Scroll to the top
}

function handleHashNavigation() {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'inventory' || hash === 'damaged' || hash === 'store') {
        openTab(hash);
    } else {
        openTab('inventory');
    }
}