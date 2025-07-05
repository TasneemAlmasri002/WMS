// public/js/forgot-password.js
document.addEventListener("DOMContentLoaded", () => {
    const forgotPasswordForm = document.getElementById("forgotPasswordForm");
    const verifyOtpForm = document.getElementById("verifyOtpForm");
    const resetPasswordForm = document.getElementById("resetPasswordForm");
    const forgotErrorMessage = document.getElementById("forgotErrorMessage");
    const otpErrorMessage = document.getElementById("otpErrorMessage");
    const resetErrorMessage = document.getElementById("resetErrorMessage");
    const toggleNewPassword = document.getElementById("toggleNewPassword");
    const newPasswordInput = document.getElementById("newPassword");
    let currentEmail = "";
  
    // عرض/إخفاء كلمة المرور الجديدة
    toggleNewPassword.addEventListener("click", () => {
      const type = newPasswordInput.getAttribute("type") === "password" ? "text" : "password";
      newPasswordInput.setAttribute("type", type);
      toggleNewPassword.innerHTML = type === "password" ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });
  
    // إرسال رمز OTP
    forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("forgotEmail").value.trim();
  
      try {
        const response = await fetch("/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await response.json();
  
        if (response.ok) {
          currentEmail = email;
          forgotPasswordForm.classList.add("d-none");
          verifyOtpForm.classList.remove("d-none");
          forgotErrorMessage.classList.add("d-none");
        } else {
          forgotErrorMessage.textContent = data.message;
          forgotErrorMessage.classList.remove("d-none");
        }
      } catch (error) {
        forgotErrorMessage.textContent = "حدث خطأ أثناء الاتصال بالخادم.";
        forgotErrorMessage.classList.remove("d-none");
        console.error("خطأ:", error);
      }
    });
  
    // التحقق من OTP
    verifyOtpForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const otp = document.getElementById("otp").value.trim();
  
      try {
        const response = await fetch("/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: currentEmail, otp }),
        });
        const data = await response.json();
  
        if (response.ok) {
          verifyOtpForm.classList.add("d-none");
          resetPasswordForm.classList.remove("d-none");
          otpErrorMessage.classList.add("d-none");
        } else {
          otpErrorMessage.textContent = data.message;
          otpErrorMessage.classList.remove("d-none");
        }
      } catch (error) {
        otpErrorMessage.textContent = "حدث خطأ أثناء الاتصال بالخادم.";
        otpErrorMessage.classList.remove("d-none");
        console.error("خطأ:", error);
      }
    });
  
    // إعادة تعيين كلمة المرور
    resetPasswordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById("newPassword").value.trim();
      
        try {
          const response = await fetch("/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: currentEmail, newPassword }),
          });
          const data = await response.json();
      
          if (response.ok) {
            window.location.href = "/"; 
          } else {
            resetErrorMessage.textContent = data.message;
            resetErrorMessage.classList.remove("d-none");
          }
        } catch (error) {
          resetErrorMessage.textContent = "حدث خطأ أثناء الاتصال بالخادم.";
          resetErrorMessage.classList.remove("d-none");
          console.error("خطأ:", error);
        }
      });
  });