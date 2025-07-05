document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const errorMessage = document.getElementById("errorMessage");
    const togglePassword = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");
    // التحقق من حالة تسجيل الدخول عند تحميل الصفحة
    fetch("/check-auth")
        .then((response) => response.json())
        .then((data) => {
            if (data.message === "تم تسجيل الدخول بنجاح") {
                console.log("تم التحقق: المستخدم مسجل الدخول، يتم إعادة التوجيه إلى لوحة التحكم");
                window.history.replaceState(null, null, "/dashboard");
                window.location.replace("/dashboard");
            }
        })
        .catch((error) => {
            console.error("خطأ أثناء التحقق من حالة تسجيل الدخول:", error.message);
        });
    // عرض/إخفاء كلمة المرور
    togglePassword.addEventListener("click", () => {
        const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
        passwordInput.setAttribute("type", type);
        togglePassword.innerHTML = type === "password"
            ? '<i class="fas fa-eye"></i>'
            : '<i class="fas fa-eye-slash"></i>';
    });
    // دالة عداد تنازلي
    function startCountdown(duration, display) {
        let timer = duration, minutes, seconds;
        const interval = setInterval(() => {
            minutes = Math.floor(timer / 60);
            seconds = timer % 60;
            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;
            display.textContent = `حسابك مغلق مؤقتًا، حاول بعد ${minutes}:${seconds}`;
            if (--timer < 0) {
                clearInterval(interval);
                display.textContent = "";
                loginForm.querySelector("button").disabled = false; // إعادة تفعيل النموذج
            }
        }, 1000);
    }
    // إرسال بيانات تسجيل الدخول
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("username").value.trim();
        const password = passwordInput.value.trim();
        const role = document.getElementById("role").value;
        if (!role) {
            errorMessage.textContent = "يرجى اختيار دور من القائمة";
            errorMessage.classList.remove("d-none");
            return;
        }
        try {
            const response = await fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password, role }),
            });
            const data = await response.json();
            if (response.ok) {
                console.log("تسجيل الدخول ناجح، يتم إعادة التوجيه إلى لوحة التحكم");
                errorMessage.classList.remove("d-none");
                setTimeout(() => {
                    window.history.replaceState(null, null, "/dashboard");
                    window.location.href = "/dashboard";
                }, 1000); // انتظار ثانية واحدة قبل التوجيه
            } else {
                console.log(`فشل تسجيل الدخول: ${data.message} (الحالة: ${response.status})`);
                if (response.status === 403) {
                    errorMessage.textContent = "حسابك مغلق مؤقتًا، يتم الحساب...";
                    errorMessage.classList.remove("d-none");
                    loginForm.querySelector("button").disabled = true; // تعطيل النموذج أثناء القفل
                    startCountdown(300, errorMessage); // 5 دقائق = 300 ثانية
                } else {
                    errorMessage.textContent = data.message;
                    errorMessage.classList.remove("d-none");
                }
            }
        } catch (error) {
            errorMessage.textContent = "تعذر الاتصال بالخادم، يرجى المحاولة لاحقًا";
            errorMessage.classList.remove("d-none");
            console.error("خطأ أثناء محاولة تسجيل الدخول:", error.message);
        }
    });
    // منع الرجوع إلى صفحة تسجيل الدخول إذا كان المستخدم مسجلاً دخوله
    window.addEventListener("popstate", () => {
        if (document.getElementById("loginForm")) {
            fetch("/check-auth")
                .then((response) => response.json())
                .then((data) => {
                    if (data.message === "تم تسجيل الدخول بنجاح") {
                        console.log("محاولة الرجوع، يتم إعادة التوجيه إلى لوحة التحكم");
                        window.location.replace("/dashboard");
                    }
                })
                .catch((error) => {
                    console.error("خطأ أثناء التحقق من حالة تسجيل الدخول:", error.message);
                });
        }
    });
});