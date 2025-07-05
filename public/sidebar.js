// sidebar.js
async function loadSidebar() {
    try {
        console.log('جاري تحميل الروابط...');
        const response = await fetch("/api/sidebar");

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error("غير مصرح لك بالوصول إلى الروابط. يرجى تسجيل الدخول.");
            } else {
                throw new Error("فشل في تحميل الروابط من الخادم.");
            }
        }

        const links = await response.json();
        console.log('الروابط المستلمة:', links);

        const sidebar = document.getElementById("nav-links");
        sidebar.innerHTML = "";

        if (links.length === 0) {
            sidebar.innerHTML = "<li>لا توجد روابط متاحة.</li>";
            return;
        }

        links.forEach((link) => {
            const li = document.createElement("li");
            li.innerHTML = `
                <a href="${link.url}" class="sidebar-link">
                    <i class="${link.icon}"></i>
                    <span>${link.name}</span>
                </a>`;
            sidebar.appendChild(li);
        });
    } catch (error) {
        console.error("خطأ أثناء تحميل القائمة الجانبية:", error);
        const sidebar = document.getElementById("nav-links");
        sidebar.innerHTML = "<li>حدث خطأ أثناء تحميل الروابط.</li>";
    }
}

// وظيفة التبديل بين فتح وإغلاق الشريط الجانبي
function toggleSidebar() {
    const container = document.querySelector('.container');
    container.classList.toggle('open');
}

// تحميل القائمة وإعداد زر التبديل عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
    console.log("الصفحة تم تحميلها، جاري تحميل القائمة الجانبية...");
    loadSidebar();

    const toggleBtn = document.getElementById("toggle-btn");
    toggleBtn.addEventListener("click", toggleSidebar);
});