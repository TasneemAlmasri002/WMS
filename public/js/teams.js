const API_CONFIG = {
    TEAMS: '/api/teams',
    TEAMS_WITH_ID: (teamId) => `/api/teams/${teamId}`,
    TEAM_USERS: (teamId) => `/api/teams/${teamId}/users`,
    MANUFACTURERS: '/api/manufacturers',
    MANUFACTURERS_WITH_ID: (manufacturerId) => `/api/manufacturers/${manufacturerId}`,
    TEAM_MANUFACTURERS: '/api/team-manufacturers',
    USERS: '/users',
  };
  
  // Utility function to show messages
  function showMessage(message, isError = false) {
    const messageHeader = document.getElementById('messageHeader');
    const messageText = document.getElementById('messageText');
    messageText.textContent = message;
    messageHeader.className = `message-header ${isError ? 'error' : 'success'}`;
    messageHeader.style.display = 'block';
    setTimeout(hideMessage, 3000);
  }
  
  function hideMessage() {
    document.getElementById('messageHeader').style.display = 'none';
  }
  
  // Utility function for API requests
  async function fetchAPI(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });
        if (response.status === 401) {
            window.location.href = '/login.html';
            return null;
        }
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    } catch (error) {
        showMessage(`خطأ: ${error.message}`, true);
        throw error;
    }
  }
  
  // Store teams data for search
  let teamsData = [];
  
  // Fetch and display teams
  async function fetchTeams() {
    try {
        teamsData = await fetchAPI(API_CONFIG.TEAMS);
        renderTeams(teamsData);
    } catch (error) {
        // Error already handled in fetchAPI
    }
  }
  
  // Render teams table
  function renderTeams(teams) {
    const tbody = document.querySelector('#teamsTable tbody');
    tbody.innerHTML = '';
    if (!teams || !Array.isArray(teams)) {
        showMessage('لا توجد فرق متاحة', true);
        return;
    }
    teams.forEach(team => {
        const statusText = team.status === 'Active' ? 'نشط' : 'غير نشط';
        const membersText = Array.isArray(team.members) && team.members.length > 0 ? team.members.join(', ') : 'لا أعضاء';
        const manufacturersText = Array.isArray(team.manufacturers) && team.manufacturers.length > 0 ? team.manufacturers.join(', ') : 'لا شركات';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${team.team_id}</td>
            <td>${team.team_name}</td>
            <td>${team.description || ''}</td>
            <td>${statusText}</td>
            <td>${membersText}</td>
            <td>${manufacturersText}</td>
            <td style="display: flex; flex-direction: column; gap: 5px; justify-content: center; align-items: center;">
                <button class="btn btn-sm btn-primary" style="min-width: 80px; padding: 8px 12px;" onclick="showEditTeamPopup(${team.team_id}, '${team.team_name}', '${team.description || ''}', '${team.status}')">تعديل</button>
                <button class="btn btn-sm btn-danger" style="min-width: 80px; padding: 8px 12px;" onclick="deleteTeam(${team.team_id})">حذف</button>
            </td>
        `;
        tbody.appendChild(row);
    });
  }
  
  // Client-side search for teams
  function searchTeams() {
    const searchInput = document.getElementById('searchTeams').value.toLowerCase();
    const filteredTeams = teamsData.filter(team => {
        const teamName = team.team_name.toLowerCase();
        const description = (team.description || '').toLowerCase();
        const statusText = team.status === 'Active' ? 'نشط' : 'غير نشط';
        return teamName.includes(searchInput) || description.includes(searchInput) || statusText.toLowerCase().includes(searchInput);
    });
    renderTeams(filteredTeams);
  }
  
  // Add search event listener
  document.getElementById('searchTeams').addEventListener('input', searchTeams);
  
  // Fetch users
  async function fetchUsers() {
    try {
        const users = await fetchAPI(API_CONFIG.USERS);
        return users || [];
    } catch (error) {
        return [];
    }
  }
  
  // Add team
  async function addTeam() {
    const teamName = document.getElementById('teamName').value;
    const teamDescription = document.getElementById('teamDescription').value;
    const teamStatus = document.getElementById('teamStatus').value;
  
    if (!teamName) {
        document.getElementById('addTeamError').textContent = 'اسم المجموعة مطلوب';
        return;
    }
  
    try {
        await fetchAPI(API_CONFIG.TEAMS, {
            method: 'POST',
            body: JSON.stringify({ team_name: teamName, description: teamDescription, status: teamStatus }),
        });
        showMessage('تم إضافة المجموعة بنجاح');
        closeAddTeamPopup();
        fetchTeams();
    } catch (error) {
        // Error already handled in fetchAPI
    }
  }
  
  // Edit team
  async function updateTeam() {
    const teamId = document.getElementById('editTeamId').value;
    const teamName = document.getElementById('editTeamName').value;
    const teamDescription = document.getElementById('editTeamDescription').value;
    const teamStatus = document.getElementById('editTeamStatus').value;
  
    if (!teamName) {
        document.getElementById('editTeamError').textContent = 'اسم المجموعة مطلوب';
        return;
    }
  
    try {
        await fetchAPI(API_CONFIG.TEAMS_WITH_ID(teamId), {
            method: 'PUT',
            body: JSON.stringify({ team_name: teamName, description: teamDescription, status: teamStatus }),
        });
        showMessage('تم تحديث المجموعة بنجاح');
        closeEditTeamPopup();
        fetchTeams();
    } catch (error) {
        // Error already handled in fetchAPI
    }
  }
  
  // Delete team
  async function deleteTeam(teamId) {
    if (!confirm('هل أنت متأكد من حذف المجموعة؟')) return;
    try {
        await fetchAPI(API_CONFIG.TEAMS_WITH_ID(teamId), { method: 'DELETE' });
        showMessage('تم حذف المجموعة بنجاح');
        fetchTeams();
        closeEditTeamPopup(); // إغلاق نافذة التعديل بعد الحذف
    } catch (error) {
        // Error already handled in fetchAPI
    }
  }
  
  // Assign user to team
  async function assignUserTeam() {
    const userId = document.getElementById('userId').value;
    const teamId = document.getElementById('teamId').value;
  
    if (!userId || !teamId) {
        document.getElementById('assignUserTeamError').textContent = 'يرجى اختيار مستخدم ومجموعة';
        return;
    }
  
    try {
        await fetchAPI(API_CONFIG.TEAM_USERS(teamId), {
            method: 'POST',
            body: JSON.stringify({ user_id: userId }),
        });
        showMessage('تم ربط المستخدم بالمجموعة بنجاح');
        closeAssignUserTeamPopup();
        fetchTeams();
    } catch (error) {
        // Error already handled in fetchAPI
    }
  }
  
  // Delete user-team association
  async function deleteUserTeam() {
    const userId = document.getElementById('userId').value;
    const teamId = document.getElementById('teamId').value;
  
    if (!userId || !teamId) {
        document.getElementById('assignUserTeamError').textContent = 'يرجى اختيار مستخدم ومجموعة';
        return;
    }
  
    if (!confirm('هل أنت متأكد من حذف ربط المستخدم بالمجموعة؟')) return;
  
    try {
        await fetchAPI(`${API_CONFIG.TEAM_USERS(teamId)}/${userId}`, {
            method: 'DELETE',
        });
        showMessage('تم حذف ربط المستخدم بالمجموعة بنجاح');
        closeAssignUserTeamPopup();
        fetchTeams();
    } catch (error) {
        // Error already handled in fetchAPI
    }
  }
  
  // Assign team to manufacturer
  async function assignTeamCompany() {
    const teamId = document.getElementById('teamIdCompany').value;
    const companyId = document.getElementById('companyId').value;
  
    if (!teamId || !companyId) {
        document.getElementById('assignTeamCompanyError').textContent = 'يرجى اختيار فريق وشركة';
        return;
    }
  
    try {
        await fetchAPI(API_CONFIG.TEAM_MANUFACTURERS, {
            method: 'POST',
            body: JSON.stringify({ team_id: teamId, manufacturer_id: companyId }),
        });
        showMessage('تم ربط الفريق بالشركة بنجاح');
        closeAssignTeamCompanyPopup();
        fetchTeams();
    } catch (error) {
        // Error already handled in fetchAPI
    }
  }
  
  // Delete team-manufacturer association
  async function deleteTeamCompany() {
    const teamId = document.getElementById('teamIdCompany').value;
    const companyId = document.getElementById('companyId').value;
  
    if (!teamId || !companyId) {
        document.getElementById('assignTeamCompanyError').textContent = 'يرجى اختيار فريق وشركة';
        return;
    }
  
    if (!confirm('هل أنت متأكد من حذف ربط الفريق بالشركة؟')) return;
  
    try {
        await fetchAPI(`${API_CONFIG.TEAM_MANUFACTURERS}/${teamId}/${companyId}`, {
            method: 'DELETE',
        });
        showMessage('تم حذف ربط الفريق بالشركة بنجاح');
        closeAssignTeamCompanyPopup();
        fetchTeams();
    } catch (error) {
        // Error already handled in fetchAPI
    }
  }
  
  // Popup functions
  function showAddTeamPopup() {
    document.getElementById('addTeamPopup').style.display = 'flex';
  }
  
  function closeAddTeamPopup() {
    document.getElementById('addTeamPopup').style.display = 'none';
    document.getElementById('addTeamForm').reset();
    document.getElementById('addTeamError').textContent = '';
  }
  
  function showEditTeamPopup(id, name, description, status) {
    document.getElementById('editTeamId').value = id;
    document.getElementById('editTeamName').value = name;
    document.getElementById('editTeamDescription').value = description || '';
    document.getElementById('editTeamStatus').value = status;
    document.getElementById('editTeamPopup').style.display = 'flex';
  }
  
  function closeEditTeamPopup() {
    document.getElementById('editTeamPopup').style.display = 'none';
    document.getElementById('editTeamForm').reset();
    document.getElementById('editTeamError').textContent = '';
  }
  
  async function showAssignUserTeamPopup() {
    const userSelect = document.getElementById('userId');
    const teamSelect = document.getElementById('teamId');
  
    try {
        const [users, teams] = await Promise.all([
            fetchAPI(API_CONFIG.USERS),
            fetchAPI(API_CONFIG.TEAMS),
        ]);
  
        // Populate users
        userSelect.innerHTML = '<option value="">اختر مستخدم</option>';
        if (Array.isArray(users) && users.length > 0) {
            users.forEach(user => {
                if (['مدير', 'موظف المستودع', 'موظف التتبع و الفواتير'].includes(user.role)) {
                    userSelect.innerHTML += `<option value="${user.user_id}">${user.username} (${user.role})</option>`;
                }
            });
        } else {
            userSelect.innerHTML = '<option value="">لا يوجد مستخدمين متاحين</option>';
            showMessage('لا يوجد مستخدمين متاحين', true);
        }
  
        // Populate teams
        teamSelect.innerHTML = '<option value="">اختر مجموعة</option>';
        if (Array.isArray(teams) && teams.length > 0) {
            teams.forEach(team => {
                teamSelect.innerHTML += `<option value="${team.team_id}">${team.team_name}</option>`;
            });
        } else {
            teamSelect.innerHTML = '<option value="">لا يوجد مجموعات متاحة</option>';
            showMessage('لا يوجد مجموعات متاحة', true);
        }
  
        document.getElementById('assignUserTeamPopup').style.display = 'flex';
    } catch (error) {
        userSelect.innerHTML = '<option value="">لا يوجد مستخدمين</option>';
        teamSelect.innerHTML = '<option value="">لا يوجد مجموعات</option>';
        // Error already handled in fetchAPI
    }
  }
  
  function closeAssignUserTeamPopup() {
    document.getElementById('assignUserTeamPopup').style.display = 'none';
    document.getElementById('assignUserTeamForm').reset();
    document.getElementById('assignUserTeamError').textContent = '';
  }
  
  async function showAssignTeamCompanyPopup() {
    const teamSelect = document.getElementById('teamIdCompany');
    const companySelect = document.getElementById('companyId');
  
    try {
        const [teams, manufacturers] = await Promise.all([
            fetchAPI(API_CONFIG.TEAMS),
            fetchAPI(API_CONFIG.MANUFACTURERS),
        ]);
  
        // Populate teams
        teamSelect.innerHTML = '<option value="">اختر فريق</option>';
        if (Array.isArray(teams) && teams.length > 0) {
            teams.forEach(team => {
                teamSelect.innerHTML += `<option value="${team.team_id}">${team.team_name}</option>`;
            });
        } else {
            teamSelect.innerHTML = '<option value="">لا يوجد فرق متاحة</option>';
            showMessage('لا يوجد فرق متاحة', true);
        }
  
        // Populate manufacturers
        companySelect.innerHTML = '<option value="">اختر شركة</option>';
        if (Array.isArray(manufacturers) && manufacturers.length > 0) {
            manufacturers.forEach(manufacturer => {
                companySelect.innerHTML += `<option value="${manufacturer.manufacturer_id}">${manufacturer.manufacturer_name}</option>`;
            });
        } else {
            companySelect.innerHTML = '<option value="">لا يوجد شركات متاحة</option>';
            showMessage('لا يوجد شركات متاحة', true);
        }
  
        document.getElementById('assignTeamCompanyPopup').style.display = 'flex';
    } catch (error) {
        teamSelect.innerHTML = '<option value="">لا يوجد فرق</option>';
        companySelect.innerHTML = '<option value="">لا يوجد شركات</option>';
        // Error already handled in fetchAPI
    }
  }
  
  function closeAssignTeamCompanyPopup() {
    document.getElementById('assignTeamCompanyPopup').style.display = 'none';
    document.getElementById('assignTeamCompanyForm').reset();
    document.getElementById('assignTeamCompanyError').textContent = '';
  }
  
  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    fetchTeams();
  });