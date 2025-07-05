document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkUserRole();
        fetchTeams();
        fetchAisles();
        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
    }
});
// Check if user is System Administrator
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
        if (data.role !== 'مسؤول النظام') {
            window.alert('فقط مسؤول النظام يمكنه الوصول إلى هذه الصفحة');
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
// Show message in messageBox
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
// Fetch teams for dropdowns
async function fetchTeams() {
    try {
        const response = await fetch('/api/team', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('فشل جلب الفرق');
        }
        const data = await response.json();
        populateTeamDropdowns(data.teams);
    } catch (error) {
        console.error('Error fetching teams:', error);
        showMessage('حدث خطأ أثناء جلب الفرق', 'error');
    }
}
// Populate team dropdowns
function populateTeamDropdowns(teams) {
    const teamSelectPopup = document.getElementById('teamSelectPopup');
    const editTeamSelect = document.getElementById('edit_team_select');
    [teamSelectPopup, editTeamSelect].forEach(select => {
        if (select) {
            select.innerHTML = '<option value="">اختر الفريق</option>';
            teams.forEach(team => {
                const option = document.createElement('option');
                option.value = team.team_id;
                option.textContent = team.team_name;
                select.appendChild(option);
            });
        }
    });
}
// Fetch and display aisles
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
        displayAisles(data.aisles);
    } catch (error) {
        console.error('Error fetching aisles:', error);
        showMessage('حدث خطأ أثناء جلب الممرات', 'error');
    }
}
// Display aisles as rectangles with shelves and sections
function displayAisles(aisles) {
    const aisleList = document.getElementById('aisleList');
    aisleList.innerHTML = '';
    // Sort aisles by aisle_id in ascending order
    aisles.sort((a, b) => a.aisle_id - b.aisle_id);
    aisles.forEach(aisle => {
        const aisleDiv = document.createElement('div');
        aisleDiv.className = 'aisle-item';
        aisleDiv.style.border = '2px solid black';
        aisleDiv.style.padding = '20px';
        aisleDiv.style.marginBottom = '20px';
        aisleDiv.style.position = 'relative';
        // Aisle header
        const header = document.createElement('div');
        header.textContent = `${aisle.aisle_name} (الفريق: ${aisle.team_id})`;
        header.style.fontWeight = 'bold';
        header.style.marginBottom = '10px';
        // Shelves container
        const shelvesDiv = document.createElement('div');
        shelvesDiv.className = 'shelves-container';
        shelvesDiv.style.marginTop = '10px';
        shelvesDiv.style.marginBottom = '50px';
        // Sort shelves by shelf_id in ascending order
        aisle.shelves.sort((a, b) => a.shelf_id - b.shelf_id);
        aisle.shelves.forEach((shelf, index) => {
            const shelfDiv = document.createElement('div');
            shelfDiv.className = 'shelf-item';
            shelfDiv.style.border = '1px solid #ccc';
            shelfDiv.style.padding = '10px';
            shelfDiv.style.marginBottom = '20px';
            shelfDiv.style.position = 'relative';
            const shelfHeader = document.createElement('div');
            shelfHeader.textContent = `رف ${shelf.shelf_name}`;
            shelfHeader.className = 'shelf-header';
            // Sections container (side-by-side squares)
            const sectionsContainer = document.createElement('div');
            sectionsContainer.className = 'sections-container';
            // Sort sections by section_id in ascending order
            shelf.sections.sort((a, b) => a.section_id - b.section_id);
            shelf.sections.forEach(section => {
                const sectionDiv = document.createElement('div');
                sectionDiv.className = 'section-item';
                sectionDiv.style.position = 'relative';
                sectionDiv.textContent = section.section_name;
                // Section action buttons
                const sectionActionDiv = document.createElement('div');
                sectionActionDiv.className = 'section-actionDiv';
                sectionActionDiv.style.position = 'absolute';
                sectionActionDiv.style.bottom = '2px';
                sectionActionDiv.style.right = '2px';
                sectionActionDiv.innerHTML = `
                    <button class="button-blue text-white padding-2 rounded hover-button-blue" style="font-size: 10px; padding: 2px 6px;" onclick="openEditSectionPopup(${section.section_id}, '${section.section_name}')">تعديل</button>
                    <button class="button-red text-white padding-2 rounded hover-button-red" style="font-size: 10px; padding: 2px 6px;" onclick="deleteSection(${section.section_id})">حذف</button>
                `;
                sectionDiv.appendChild(sectionActionDiv);
                sectionsContainer.appendChild(sectionDiv);
            });
            // Shelf action buttons (moved to the left)
            const actionDiv = document.createElement('div');
            actionDiv.className = 'actionDiv';
            actionDiv.style.position = 'absolute';
            actionDiv.style.bottom = '5px';
            actionDiv.style.left = '10px';
            actionDiv.innerHTML = `
                <button class="button-blue text-white padding-2 rounded hover-button-blue" onclick="openEditShelfPopup(${shelf.shelf_id}, '${shelf.shelf_name}')">تعديل</button>
                <button class="button-red text-white padding-2 rounded hover-button-red" onclick="deleteShelf(${shelf.shelf_id}, ${shelf.sections.length})">حذف</button>
                <button class="button-green text-white padding-2 rounded hover-button-green" onclick="openAddSectionPopup(${shelf.shelf_id})">إضافة قسم</button>
            `;
            shelfDiv.appendChild(shelfHeader);
            shelfDiv.appendChild(sectionsContainer);
            shelfDiv.appendChild(actionDiv);
            shelvesDiv.appendChild(shelfDiv);
        });
        // Aisle action buttons
        const aisleActionDiv = document.createElement('div');
        aisleActionDiv.className = 'actionDiv';
        aisleActionDiv.style.position = 'absolute';
        aisleActionDiv.style.bottom = '10px';
        aisleActionDiv.style.left = '10px';
        aisleActionDiv.innerHTML = `
            <button class="button-blue text-white padding-2 rounded hover-button-blue" onclick="openEditAislePopup(${aisle.aisle_id}, '${aisle.aisle_name}', '${aisle.team_id}')">تعديل</button>
            <button class="button-red text-white padding-2 rounded hover-button-red" onclick="deleteAisle(${aisle.aisle_id}, ${aisle.shelves.length})">حذف</button>
            <button class="button-green text-white padding-2 rounded hover-button-green" onclick="openAddShelfPopup(${aisle.aisle_id})">إضافة رف</button>
        `;
        aisleDiv.appendChild(header);
        aisleDiv.appendChild(shelvesDiv);
        aisleDiv.appendChild(aisleActionDiv);
        aisleList.appendChild(aisleDiv);
    });
}
// Setup event listeners for forms and buttons
function setupEventListeners() {
    // Add Aisle Form
    document.getElementById('addAisleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const aisleName = document.getElementById('aisle_name').value.trim();
        const teamId = document.getElementById('teamSelectPopup').value;
        if (!aisleName) {
            document.getElementById('nameError').textContent = 'اسم الممر مطلوب';
            return;
        }
        if (!teamId) {
            document.getElementById('teamError').textContent = 'الفريق مطلوب';
            return;
        }
        try {
            const response = await fetch('/api/aisles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ aisle_name: aisleName, team_id: teamId }),
            });
            const data = await response.json();
            if (response.ok) {
                showMessage('تمت إضافة الممر بنجاح', 'success');
                closePopup('addAislePopup');
                fetchAisles();
            } else {
                showMessage(data.error || 'فشل إضافة الممر', 'error');
            }
        } catch (error) {
            console.error('Error adding aisle:', error);
            showMessage('حدث خطأ أثناء إضافة الممر', 'error');
        }
    });
    // Edit Aisle Form
    document.getElementById('editAisleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const aisleId = document.getElementById('edit_aisle_id').value;
        const aisleName = document.getElementById('edit_aisle_name').value.trim();
        const teamId = document.getElementById('edit_team_select').value;
        if (!aisleName) {
            document.getElementById('editNameError').textContent = 'اسم الممر مطلوب';
            return;
        }
        if (!teamId) {
            document.getElementById('editTeamError').textContent = 'الفريق مطلوب';
            return;
        }
        try {
            const response = await fetch(`/api/aisles/${aisleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ aisle_name: aisleName, team_id: teamId }),
            });
            const data = await response.json();
            if (response.ok) {
                showMessage('تم تعديل الممر بنجاح', 'success');
                closePopup('editAislePopup');
                fetchAisles();
            } else {
                showMessage(data.error || 'فشل تعديل الممر', 'error');
            }
        } catch (error) {
            console.error('Error editing aisle:', error);
            showMessage('حدث خطأ أثناء تعديل الممر', 'error');
        }
    });
    // Add Shelf Form
    document.getElementById('addShelfForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const shelfName = document.getElementById('shelf_name').value.trim();
        const aisleId = document.getElementById('addShelfPopup').dataset.aisleId;
        if (!shelfName) {
            document.getElementById('shelfError').textContent = 'اسم الرف مطلوب';
            return;
        }
        try {
            const response = await fetch(`/api/shelves`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ shelf_name: shelfName, aisle_id: aisleId }),
            });
            const data = await response.json();
            if (response.ok) {
                showMessage('تمت إضافة الرف بنجاح', 'success');
                closePopup('addShelfPopup');
                fetchAisles();
            } else {
                showMessage(data.error || 'فشل إضافة الرف', 'error');
            }
        } catch (error) {
            console.error('Error adding shelf:', error);
            showMessage('حدث خطأ أثناء إضافة الرف', 'error');
        }
    });
    // Edit Shelf Form
    document.getElementById('editShelfForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const shelfId = document.getElementById('edit_shelf_id').value;
        const shelfName = document.getElementById('edit_shelf_name').value.trim();
        if (!shelfName) {
            document.getElementById('editShelfError').textContent = 'اسم الرف مطلوب';
            return;
        }
        try {
            const response = await fetch(`/api/shelves/${shelfId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ shelf_name: shelfName }),
            });
            const data = await response.json();
            if (response.ok) {
                showMessage('تم تعديل الرف بنجاح', 'success');
                closePopup('editShelfPopup');
                fetchAisles();
            } else {
                showMessage(data.error || 'فشل تعديل الرف', 'error');
            }
        } catch (error) {
            console.error('Error editing shelf:', error);
            showMessage('حدث خطأ أثناء تعديل الرف', 'error');
        }
    });
    // Edit Section Form
    document.getElementById('editSectionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const sectionId = document.getElementById('edit_section_id').value;
        const sectionName = document.getElementById('edit_section_name').value.trim();
        if (!sectionName) {
            document.getElementById('editSectionError').textContent = 'اسم القسم مطلوب';
            return;
        }
        try {
            const response = await fetch(`/api/sections/${sectionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ section_name: sectionName }),
            });
            const data = await response.json();
            if (response.ok) {
                showMessage('تم تعديل القسم بنجاح', 'success');
                closePopup('editSectionPopup');
                fetchAisles();
            } else {
                showMessage(data.error || 'فشل تعديل القسم', 'error');
            }
        } catch (error) {
            console.error('Error editing section:', error);
            showMessage('حدث خطأ أثناء تعديل القسم', 'error');
        }
    });
    // Add Section Form
    document.getElementById('addSectionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const sectionName = document.getElementById('section_name').value.trim();
        const shelfId = document.getElementById('addSectionPopup').dataset.shelfId;
        if (!sectionName) {
            document.getElementById('sectionError').textContent = 'اسم القسم مطلوب';
            return;
        }
        try {
            const response = await fetch(`/api/sections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ section_name: sectionName, shelf_id: shelfId }),
            });
            const data = await response.json();
            if (response.ok) {
                showMessage('تمت إضافة القسم بنجاح', 'success');
                closePopup('addSectionPopup');
                fetchAisles();
            } else {
                showMessage(data.error || 'فشل إضافة القسم', 'error');
            }
        } catch (error) {
            console.error('Error adding section:', error);
            showMessage('حدث خطأ أثناء إضافة القسم', 'error');
        }
    });
}
// Open add aisle popup
function openAddAislePopup() {
    document.getElementById('addAislePopup').style.display = 'block';
    document.getElementById('aisle_name').value = '';
    document.getElementById('teamSelectPopup').value = '';
    document.getElementById('nameError').textContent = '';
    document.getElementById('teamError').textContent = '';
}
// Open edit aisle popup
function openEditAislePopup(aisleId, aisleName, teamId) {
    document.getElementById('editAislePopup').style.display = 'block';
    document.getElementById('edit_aisle_id').value = aisleId;
    document.getElementById('edit_aisle_name').value = aisleName;
    document.getElementById('edit_team_select').value = teamId;
    document.getElementById('editNameError').textContent = '';
    document.getElementById('editTeamError').textContent = '';
}
// Open add shelf popup
function openAddShelfPopup(aisleId) {
    const popup = document.getElementById('addShelfPopup');
    popup.style.display = 'block';
    popup.dataset.aisleId = aisleId;
    document.getElementById('shelf_name').value = '';
    document.getElementById('shelfError').textContent = '';
}
// Open edit shelf popup
function openEditShelfPopup(shelfId, shelfName) {
    const popup = document.getElementById('editShelfPopup');
    popup.style.display = 'block';
    document.getElementById('edit_shelf_id').value = shelfId;
    document.getElementById('edit_shelf_name').value = shelfName;
    document.getElementById('editShelfError').textContent = '';
}
// Open add section popup
function openAddSectionPopup(shelfId) {
    const popup = document.getElementById('addSectionPopup');
    popup.style.display = 'block';
    popup.dataset.shelfId = shelfId;
    document.getElementById('section_name').value = '';
    document.getElementById('sectionError').textContent = '';
}
// Open edit section popup
function openEditSectionPopup(sectionId, sectionName) {
    const popup = document.getElementById('editSectionPopup');
    popup.style.display = 'block';
    document.getElementById('edit_section_id').value = sectionId;
    document.getElementById('edit_section_name').value = sectionName;
    document.getElementById('editSectionError').textContent = '';
}
// Close popup
function closePopup(popupId) {
    document.getElementById(popupId).style.display = 'none';
}
// Delete aisle
async function deleteAisle(aisleId, shelfCount) {
    if (shelfCount > 0) {
        showMessage('لا يمكن حذف الممر لأنه يحتوي على رفوف', 'error');
        return;
    }
    try {
        if (!confirm('هل أنت متأكد من حذف هذا الممر؟')) {
            return;
        }
        const response = await fetch(`/api/aisles/${aisleId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        const data = await response.json();
        if (response.ok) {
            showMessage('تم حذف الممر بنجاح', 'success');
            fetchAisles();
        } else {
            showMessage(data.error || 'فشل حذف الممر', 'error');
        }
    } catch (error) {
        console.error('Error deleting aisle:', error);
        showMessage('حدث خطأ أثناء حذف الممر', 'error');
    }
}
// Delete shelf
async function deleteShelf(shelfId, sectionCount) {
    if (sectionCount > 0) {
        showMessage('لا يمكن حذف الرف لأنه يحتوي على أقسام', 'error');
        return;
    }
    try {
        if (!confirm('هل أنت متأكد من حذف هذا الرف؟')) {
            return;
        }
        const response = await fetch(`/api/shelves/${shelfId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        const data = await response.json();
        if (response.ok) {
            showMessage('تم حذف الرف بنجاح', 'success');
            fetchAisles();
        } else {
            showMessage(data.error || 'فشل حذف الرف', 'error');
        }
    } catch (error) {
        console.error('Error deleting shelf:', error);
        showMessage('حدث خطأ أثناء حذف الرف', 'error');
    }
}
// Delete section
async function deleteSection(sectionId) {
    try {
        // Check if section has associated products
        const productCheckResponse = await fetch(`/api/sections/${sectionId}/has-products`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!productCheckResponse.ok) {
            const errorText = await productCheckResponse.text();
            throw new Error(`فشل التحقق من وجود منتجات في القسم: ${productCheckResponse.status} - ${errorText}`);
        }
        const productCheckData = await productCheckResponse.json();
        if (!productCheckData.success) {
            throw new Error(productCheckData.error || 'فشل التحقق من وجود منتجات في القسم');
        }
        if (productCheckData.hasProducts) {
            showMessage('لا يمكن حذف القسم لأنه يحتوي على منتجات', 'error');
            return;
        }
        if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) {
            return;
        }
        const response = await fetch(`/api/sections/${sectionId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `فشل حذف القسم: ${response.status}`);
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'فشل حذف القسم');
        }
        showMessage('تم حذف القسم بنجاح', 'success');
        fetchAisles();
    } catch (error) {
        console.error('Error deleting section:', error);
        showMessage(`حدث خطأ أثناء حذف القسم: ${error.message}`, 'error');
    }
}