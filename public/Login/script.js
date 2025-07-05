// server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// تحديد المجلد الذي يحتوي على الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));

// توجيه إلى صفحة تسجيل الدخول
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Login', 'login.html'));
});

// بدء تشغيل الخادم
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");

    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const role = document.getElementById("role").value;
        const user_name = document.getElementById("user_name").value;
        const password = document.getElementById("password").value;

        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ role, user_name, password })
        });

        const data = await response.json();

        if (data.success) {
            alert("تم تسجيل الدخول بنجاح!");
            window.location.href = data.dashboardUrl; // الانتقال إلى لوحة التحكم
        } else {
            alert("خطأ: " + data.message);
        }
    });
});
document.addEventListener("DOMContentLoaded", function () {
    const forgotPasswordForm = document.getElementById("forgotPasswordForm");

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const username = document.getElementById("username").value;
            const email = document.getElementById("email").value;

            const response = await fetch("/forgot-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, email })
            });

            const data = await response.json();

            if (data.success) {
                alert("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.");
            } else {
                alert("خطأ: " + data.message);
            }
        });
    }
});
