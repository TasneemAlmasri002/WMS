const express = require("express"); 
const session = require("express-session"); // عشان المصادقة والسيشن لكل تسجيل دخول 
const path = require('path'); // لتتعامل مع المسارات 
const db = require("./warehouse"); // ملف الاتصال بقاعدة البيانات
const bcrypt = require("bcrypt"); // لتشفير الباس
const multer = require('multer'); // لرفع الملفات والمرفقات 
const fs = require("fs"); // لتتعامل مع الملفات
const nodemailer = require("nodemailer"); //otp
const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: "uploads/" });

bcrypt.hash("Admin@123", 10).then(hash => {
    console.log("Password Hash:", hash);
});
// === المعالجات الوسيطة العامة ===
// إعداد الجلسة
app.use(
  session({
    secret: "warehouse_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      expires: false, // جلسة مؤقتة
      sameSite: "strict",
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const uploads = multer({ storage: storage });
// إعداد nodemailer لإرسال البريد الإلكتروني
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "grad.proj32025@gmail.com",
    pass: "mvxz ltpv zqij ezgj",
  },
});
// تخزين رموز OTP مؤقتًا
const otpStore = {};
const loginAttempts = {};
const checkLoginAttempts = (username) => {
  if (!loginAttempts[username]) {
    loginAttempts[username] = { count: 0, lockUntil: null };
  }
  const { count, lockUntil } = loginAttempts[username];
  if (lockUntil && lockUntil > Date.now()) return true;
  if (count >= 3) {
    loginAttempts[username].lockUntil = Date.now() + 5 * 60 * 1000; // قفل لمدة 5 دقائق
    return true;
  }
  return false;
};
// خريطة الأدوار
const roleMapping = {
    admin: "مسؤول النظام",
    manager: "مدير",
    supplier: "مورد",
    "inventory employee": "موظف المستودع",
    "billing employee": "موظف التتبع و الفواتير",
  };
  // Middleware للتحقق من تسجيل الدخول
function isAuthenticated(req, res, next) {
    if (req.session.user) {
      req.user = req.session.user; // نقل بيانات المستخدم إلى req.user
      return next();
    }
    res.status(401).json({ message: "يرجى تسجيل الدخول أولاً" });
    console.log(req.session);
  }
function isSystemAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'مسؤول النظام') {
      return next();
    }
    res.status(403).json({ message: 'فقط مسؤول النظام يمكنه الوصول إلى هذه البيانات' });
  }
  // دالة مساعدة للتحقق من الصلاحيات
function restrictToAdminAndManager(req, res, next) {
    const role = req.user?.role;
    if (!role || (role !== "مسؤول النظام" && role !== "مدير")) {
      return res.status(403).json({ message: "غير مصرح لك بإجراء هذا الإجراء" });
    }
    next();
  }
  // دالة مساعدة للتحقق من الصلاحيات للمسؤول والمدير والمورد
function restrictToAdminManagerSupplier(req, res, next) {
    const role = req.user?.role;
    if (!role || (role !== 'مسؤول النظام' && role !== 'مدير' && role !== 'مورد')) {
      return res.status(403).json({ message: 'غير مصرح لك بإجراء هذا الإجراء' });
    }
    next();
  }
  const restrictToSupplier = (req, res, next) => {
    if (req.user.role !== 'مورد') {
      return res.status(403).json({ message: 'غير مصرح لك، هذه العملية متاحة للمورد فقط' });
    }
    next();
  };
  // الشريط الجانبي
const sidebarLinks = {
    "مسؤول النظام": [
      { name: "لوحة التحكم", url: "/dashboard", icon: "fas fa-tachometer-alt" },
      {name: "إدارة المجموعات", url:"/teams.html",icon:"fas fa-user-cog"},
      {name: "إدارة المستخدمين",url: "/Admin_pages/Users_management.html",icon: "fas fa-users",},
      { name: "إدارة الموردين",url: "/Admin_pages/Suppliers_management.html",icon: "fas fa-truck",},
      {name: "قائمة الطلبات", url: "/Order_Product/Manufacturers.html",icon: "fas fa-list",},
      { name: "إدارة الطلبات",url: "/Admin_pages/Order_management.html",icon: "fas fa-shopping-cart",},
      { name: "إدارة المخزون",   url: "/Admin_pages/Inventory_management.html",icon: "fas fa-warehouse",},
      {name:"طلباتي", url:"/Order_Product/My_orders.html",icon: "fas fa-clipboard-list"},
      { name: "تسجيل الخروج", url: "/logout", icon: "fas fa-sign-out-alt" ,},
    ],
    "مدير": [
      { name: "لوحة التحكم", url: "/dashboard", icon: "fas fa-tachometer-alt" },
      { name: "قائمة الطلبات", url: "/Order_Product/Manufacturers.html",icon: "fas fa-list" },
      { name: "إدارة الطلبات",url: "/Admin_pages/Order_management.html",icon: "fas fa-shopping-cart",},
      {name:"إدارة المرتجعات", url:"/Order_Product/return_mang.html", icon :"fas fa-undo"},
      {name:"طلباتي", url:"/Order_Product/My_orders.html",icon: "fas fa-clipboard-list"},
      {name:" المخزون ", url:"/inventory/inventory.html",icon: "fas fa-warehouse",},
      { name: "تسجيل الخروج", url: "/logout", icon: "fas fa-sign-out-alt" },
    ],
    "موظف المستودع": [
      { name: "لوحة التحكم", url: "/dashboard", icon: "fas fa-tachometer-alt" },
      {name: "قائمة الطلبات",url: "/Order_Product/Manufacturers.html",icon: "fas fa-list"},
      {name:"طلباتي", url:"/Order_Product/My_orders.html",icon: "fas fa-clipboard-list"},
      {name:"إدارة المرتجعات", url:"/Order_Product/return_mang.html", icon :"fas fa-undo"},
      {name:" المخزون ", url:"/inventory/inventory.html",icon: "fas fa-warehouse",},
      { name: "تسجيل الخروج", url: "/logout", icon: "fas fa-sign-out-alt" },
    ],
    "مورد":[
         { name: "لوحة التحكم", url: "/dashboard", icon: "fas fa-tachometer-alt" },
         {name: "قائمة الطلبات",url: "/Order_Product/Manufacturers.html",icon: "fas fa-list"},
         {name:"طلباتي", url:"/Order_Product/My_orders.html",icon: "fas fa-clipboard-list",},
         {name:"إدارة المرتجعات", url:"/Order_Product/return_mang.html", icon :"fas fa-undo"},
         { name: "تسجيل الخروج", url: "/logout", icon: "fas fa-sign-out-alt" },
        ],
    "موظف التتبع و الفواتير":[
      { name: "لوحة التحكم", url: "/dashboard", icon: "fas fa-tachometer-alt" },
      {"name": "إدارة المدفوعات","url": "/Order_Product/payment-mang.html", "icon": "fas fa-credit-card"},
      {name:"طلباتي", url:"/Order_Product/My_orders.html",icon: "fas fa-clipboard-list",},
      { name: "تسجيل الخروج", url: "/logout", icon: "fas fa-sign-out-alt" },
    ],
  };
  // ملفات ثابتة
  app.use("/sidebar.js", express.static(path.join(__dirname, "public", "sidebar.js")));
  app.use("/users.js", express.static(path.join(__dirname, "public", "js", "users.js")));
  app.use(express.static(path.join(__dirname, "public")));
  app.use("/Admin_pages", express.static(path.join(__dirname, "public", "Admin_pages")));
  app.use("/styles.css", express.static(path.join(__dirname, "public", "css", "styles.css")));
  app.use("/sidebar.css", express.static(path.join(__dirname, "public", "css", "sidebar.css")));
  // === المسارات الثابتة ===
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Login", "login.html"));
  });
  app.get("/login.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Login", "login.html"));
  });
  app.get("/forgot-password.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Login", "forgot-password.html"));
  });
  app.get("/dashboard", isAuthenticated, (req, res) => {
    const userRole = req.session.user.role.trim();
    let dashboardFile;
    switch (userRole) {
      case roleMapping["admin"]:
        dashboardFile = "admin.html";
        break;
      case roleMapping["manager"]:
        dashboardFile = "manager.html";
        break;
      case roleMapping["supplier"]:
        dashboardFile = "supplier.html";
        break;
      case roleMapping["inventory employee"]:
        dashboardFile  = "inventoryemp.html";
        break;
      case roleMapping["billing employee"]:
        dashboardFile = "billing.html";
        break;
      default:
        return res.status(403).json({ message: "ليس لديك صلاحية." });
    }
    res.sendFile(path.join(__dirname, "public", "Dashboard", dashboardFile));
  });
  // === المسارات المحددة ===
  app.get("/check-auth", (req, res) => {
    if (req.session.user) {
      res.status(200).json({ message: "تم تسجيل الدخول" });
    } else {
    }
  });
  app.post("/login", (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ message: "يجب إدخال جميع الحقول." });
    }
    if (!Object.values(roleMapping).includes(role)) {
        return res.status(400).json({ message: "الدور غير صالح." });
    }
    if (checkLoginAttempts(username)) {
        return res.status(403).json({ message: "تم قفل الحساب مؤقتًا. حاول بعد 5 دقائق." });
    }
    const query = `
        SELECT * FROM Users 
        WHERE TRIM(LOWER(username)) = TRIM(LOWER(?)) 
        AND TRIM(LOWER(role)) = TRIM(LOWER(?))
    `;
    db.query(
        query,
        [username.trim().toLowerCase(), role.trim().toLowerCase()],
        async (err, results) => {
            if (err) {
                console.error("خطأ في قاعدة البيانات:", err);
                return res.status(500).json({ message: "حدث خطأ في الخادم." });
            }
            if (results.length === 0) {
                loginAttempts[username].count = (loginAttempts[username].count || 0) + 1;
                return res
                    .status(401)
                    .json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة." });
            }
            const user = results[0];
            // التحقق من أن المستخدم نشط
            if (user.status !== 'Active') {
                return res.status(403).json({ message: "حسابك غير نشط. يرجى التواصل مع مسؤول النظام." });
            }
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                loginAttempts[username].count = (loginAttempts[username].count || 0) + 1;
                return res
                    .status(401)
                    .json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة." });
            }
            delete loginAttempts[username];
            req.session.user = {
                id: user.user_id,
                username: user.username,
                role: user.role,
                email: user.email,
                 phone: user.phone_number,
            };
            db.query("UPDATE Users SET last_login = NOW() WHERE user_id = ?", [
                user.user_id,
            ]);
            return res.status(200).json({ message: "تم تسجيل الدخول بنجاح." });
        }
    );
});
  app.post("/forgot-password", (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "البريد الإلكتروني مطلوب." });
    }
    const query = "SELECT * FROM Users WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))";
    db.query(query, [email.trim().toLowerCase()], (err, results) => {
      if (err) {
        console.error("خطأ في قاعدة البيانات:", err);
        return res.status(500).json({ message: "حدث خطأ في الخادم." });
      }
      if (results.length === 0) {
        return res.status(404).json({ message: "البريد الإلكتروني غير مسجل." });
      }
      const user = results[0];
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore[user.user_id] = {
        code: otp,
        expires: Date.now() + 5 * 60 * 1000, // صالح لمدة 5 دقائق
      };
      const mailOptions = {
        from: "grad.proj32025@gmail.com",
        to: user.email,
        subject: "رمز إعادة تعيين كلمة المرور",
        text: `رمز OTP الخاص بك هو: ${otp}. هذا الرمز صالح لمدة 5 دقائق.`,
      };
      transporter.sendMail(mailOptions, (error) => {
        if (error) {
          console.error("خطأ في إرسال البريد الإلكتروني:", error);
          return res
            .status(500)
            .json({ message: "خطأ أثناء إرسال رمز OTP." });
        }
        res
          .status(200)
          .json({ message: "تم إرسال رمز OTP إلى بريدك الإلكتروني." });
      });
    });
  });
  app.post("/verify-otp", (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res
        .status(400)
        .json({ message: "البريد الإلكتروني ورمز OTP مطلوبان." });
    }
    const query = "SELECT user_id FROM Users WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))";
    db.query(query, [email.trim().toLowerCase()], (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ message: "البريد الإلكتروني غير مسجل." });
      }
      const userId = results[0].user_id;
      const storedOtp = otpStore[userId];
      if (!storedOtp || storedOtp.code !== otp || storedOtp.expires < Date.now()) {
        return res
          .status(400)
          .json({ message: "رمز OTP غير صحيح أو منتهي الصلاحية." });
      }
      req.session.resetUserId = userId;
      delete otpStore[userId];
      res.status(200).json({ message: "تم التحقق من رمز OTP بنجاح." });
    });
  });
  app.post("/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res
        .status(400)
        .json({ message: "البريد الإلكتروني وكلمة المرور الجديدة مطلوبان." });
    }
    if (!req.session.resetUserId) {
      return res.status(403).json({ message: "يجب التحقق من OTP أولاً." });
    }
    const query = "SELECT user_id FROM Users WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))";
    db.query(query, [email.trim().toLowerCase()], async (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ message: "البريد الإلكتروني غير مسجل." });
      }
      const userId = results[0].user_id;
      if (userId !== req.session.resetUserId) {
        return res.status(403).json({ message: "خطأ في التحقق من الهوية." });
      }
      try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updateQuery = "UPDATE Users SET password_hash = ? WHERE user_id = ?";
        db.query(updateQuery, [hashedPassword, userId], (err) => {
          if (err) {
            console.error("خطأ في تحديث كلمة المرور:", err);
            return res
              .status(500)
              .json({ message: "خطأ أثناء إعادة تعيين كلمة المرور." });
          }
          delete req.session.resetUserId;
          res
            .status(200)
            .json({ message: "تم إعادة تعيين كلمة المرور بنجاح." });
        });
      } catch (error) {
        console.error("خطأ في تشفير كلمة المرور:", error);
        return res
          .status(500)
          .json({ message: "خطأ في الخادم أثناء تشفير كلمة المرور." });
      }
    });
  });
  app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("خطأ أثناء تسجيل الخروج:", err);
        return res
          .status(500)
          .json({ message: "خطأ أثناء تسجيل الخروج." });
      }
      res.redirect("/");
    });
  });
  app.get("/api/user", isAuthenticated, (req, res) => {
    const user = req.session.user;
    console.log('بيانات المستخدم في /api/user:', user); // تسجيل للتحقق
    res.status(200).json({
        user_id: user.id, 
        username: user.username,
        role: user.role
    });
  });
  app.get("/api/user-dash", isAuthenticated, (req, res) => {
    const user = req.session.user;
    console.log('بيانات المستخدم في /api/user-dash:', user); // تسجيل للتحقق
    if (!user) {
        return res.status(401).json({ error: "المستخدم غير مصرح له" });
    }
    res.status(200).json({
        user_id: user.id,
        username: user.username,
        role: user.role,
        email: user.email || "غير متوفر",
        phone: user.phone || "غير متوفر"
    });
});
app.get('/api/user-stats', isAuthenticated, (req, res) => {
    // Query for user status counts
    db.query(
        'SELECT status, COUNT(*) as count FROM Users GROUP BY status',
        (userErr, userRows) => {
            if (userErr) {
                console.error('خطأ في استعلام إحصائيات المستخدمين:', {
                    error: userErr.message,
                    sqlMessage: userErr.sqlMessage,
                    sql: userErr.sql
                });
                return res.status(500).json({ error: 'خطأ في جلب إحصائيات المستخدمين' });
            }

            // Query for order status counts
            db.query(
                'SELECT status, COUNT(*) as count FROM orders GROUP BY status',
                (orderErr, orderRows) => {
                    if (orderErr) {
                        console.error('خطأ في استعلام إحصائيات الطلبات:', {
                            error: orderErr.message,
                            sqlMessage: orderErr.sqlMessage,
                            sql: orderErr.sql
                        });
                        return res.status(500).json({ error: 'خطأ في جلب إحصائيات الطلبات' });
                    }

                    // Format user stats
                    const userStats = {
                        Active: 0,
                        Inactive: 0
                    };
                    userRows.forEach(row => {
                        userStats[row.status] = row.count;
                    });

                    // Format order stats
                    const orderStats = {
                        'قيد الانتظار': 0,
                        'موافق عليه': 0,
                        'مرفوض': 0,
                        'مكتمل': 0
                    };
                    orderRows.forEach(row => {
                        orderStats[row.status] = row.count;
                    });

                    // Send response
                    res.status(200).json({
                        userStats,
                        orderStats
                    });
                }
            );
        }
    );
});
app.get('/api/warehouse-stats', isAuthenticated, (req, res) => {
    // Verify user role
    const user = req.session.user;
    if (!user) {
        return res.status(403).json({ error: 'غير مصرح لهذا المستخدم' });
    }

    // Query for stock quantities
    db.query(
        'SELECT p.product_name AS product_name, SUM(sp.quantity) AS quantity FROM StockProducts sp JOIN Products p ON sp.product_id = p.product_id GROUP BY p.product_id, p.product_name',
        (stockErr, stockRows) => {
            if (stockErr) {
                console.error('خطأ في استعلام إحصائيات المخزون:', {
                    error: stockErr.message,
                    sqlMessage: stockErr.sqlMessage,
                    sql: stockErr.sql
                });
                return res.status(500).json({ error: 'خطأ في جلب إحصائيات المخزون' });
            }

            // Query for order status counts
            db.query(
                'SELECT status, COUNT(*) AS count FROM Orders GROUP BY status',
                (orderErr, orderRows) => {
                    if (orderErr) {
                        console.error('خطأ في استعلام إحصائيات الطلبات:', {
                            error: orderErr.message,
                            sqlMessage: orderErr.sqlMessage,
                            sql: orderErr.sql
                        });
                        return res.status(500).json({ error: 'خطأ في جلب إحصائيات الطلبات' });
                    }

                    // Query for return status counts
                    db.query(
                        'SELECT status, COUNT(*) AS count FROM Returns GROUP BY status',
                        (returnErr, returnRows) => {
                            if (returnErr) {
                                console.error('خطأ في استعلام إحصائيات المرتجعات:', {
                                    error: returnErr.message,
                                    sqlMessage: returnErr.sqlMessage,
                                    sql: returnErr.sql
                                });
                                return res.status(500).json({ error: 'خطأ في جلب إحصائيات المرتجعات' });
                            }

                            // Format stock stats
                            const stockStats = stockRows.map(row => ({
                                product_name: row.product_name,
                                quantity: row.quantity
                            }));

                            // Format order stats
                            const orderStats = {
                                'قيد الانتظار': 0,
                                'موافق عليه': 0,
                                'مرفوض': 0,
                                'مكتمل': 0
                            };
                            orderRows.forEach(row => {
                                orderStats[row.status] = row.count;
                            });

                            // Format return stats
                            const returnStats = {
                                'قيد الانتظار': 0,
                                'موافق عليه': 0,
                                'مرفوض': 0,
                                'تمت المعالجة': 0
                            };
                            returnRows.forEach(row => {
                                returnStats[row.status] = row.count;
                            });

                            // Send response
                            res.status(200).json({
                                stockStats,
                                orderStats,
                                returnStats
                            });
                        }
                    );
                }
            );
        }
    );
});
app.get('/api/tracking-billing-stats', isAuthenticated, (req, res) => {
    // Verify user role
    const user = req.session.user;
    if (!user ) {
        return res.status(403).json({ error: 'غير مصرح لهذا المستخدم' });
    }

    // Query for payment status counts
    db.query(
        'SELECT payment_status, COUNT(*) AS count FROM Orders GROUP BY payment_status',
        (paymentErr, paymentRows) => {
            if (paymentErr) {
                console.error('خطأ في استعلام إحصائيات حالة الدفع:', {
                    error: paymentErr.message,
                    sqlMessage: paymentErr.sqlMessage,
                    sql: paymentErr.sql
                });
                return res.status(500).json({ error: 'خطأ في جلب إحصائيات حالة الدفع' });
            }

            // Query for order status counts
            db.query(
                'SELECT status, COUNT(*) AS count FROM Orders GROUP BY status',
                (orderErr, orderRows) => {
                    if (orderErr) {
                        console.error('خطأ في استعلام إحصائيات الطلبات:', {
                            error: orderErr.message,
                            sqlMessage: orderErr.sqlMessage,
                            sql: orderErr.sql
                        });
                        return res.status(500).json({ error: 'خطأ في جلب إحصائيات الطلبات' });
                    }

                    // Format payment stats
                    const paymentStats = {
                        'مدفوع': 0,
                        'غير مدفوع': 0
                    };
                    paymentRows.forEach(row => {
                        paymentStats[row.payment_status] = row.count;
                    });

                    // Format order stats
                    const orderStats = {
                        'قيد الانتظار': 0,
                        'موافق عليه': 0,
                        'مرفوض': 0,
                        'تفاصيل إضافية': 0,
                        'مكتمل': 0
                    };
                    orderRows.forEach(row => {
                        orderStats[row.status] = row.count;
                    });

                    // Send response
                    res.status(200).json({
                        paymentStats,
                        orderStats
                    });
                }
            );
        }
    );
});
app.get('/api/supplier-stats', isAuthenticated, (req, res) => {
    const user = req.session.user;
    console.log('جلسة المستخدم الكاملة:', JSON.stringify(req.session.user, null, 2));

    if (!user || user.role !== 'مورد') {
        console.error('غير مصرح: المستخدم ليس مورد:', user);
        return res.status(403).json({ error: 'غير مصرح لهذا المستخدم' });
    }

    const userId = user.id; // Changed from user.user_id to user.id
    console.log('معرف المستخدم (id):', userId);

    if (!userId) {
        console.error('معرف المستخدم غير موجود أو غير معرف');
        return res.status(400).json({ error: 'معرف المستخدم غير موجود' });
    }

    db.query(
        `SELECT o.order_id, o.order_date, o.status, 
                COALESCE(SUM(oi.quantity * p.price), 0) AS amount
         FROM Orders o
         LEFT JOIN OrderItems oi ON o.order_id = oi.order_id 
         LEFT JOIN Products p ON oi.product_id = p.product_id 
         WHERE o.supplier_id = ?
         GROUP BY o.order_id, o.order_date, o.status
         ORDER BY o.order_date DESC`,
        [userId],
        (orderErr, orderRows) => {
            if (orderErr) {
                console.error('خطأ في استعلام الطلبات:', orderErr.message);
                return res.status(500).json({ error: 'خطأ في جلب الطلبات' });
            }
            console.log('نتائج استعلام الطلبات:', JSON.stringify(orderRows, null, 2));

            db.query(
                `SELECT r.status, COUNT(*) AS count 
                 FROM Returns r 
                 JOIN Orders o ON r.order_id = o.order_id 
                 WHERE o.supplier_id = ? 
                 GROUP BY r.status`,
                [userId],
                (returnErr, returnRows) => {
                    if (returnErr) {
                        console.error('خطأ في استعلام المرتجعات:', returnErr.message);
                        return res.status(500).json({ error: 'خطأ في جلب إحصائيات المرتجعات' });
                    }
                    console.log('نتائج استعلام المرتجعات:', JSON.stringify(returnRows, null, 2));

                    const returnStats = {
                        'قيد الانتظار': 0,
                        'موافق عليه': 0,
                        'مرفوض': 0,
                        'تمت المعالجة': 0
                    };
                    returnRows.forEach(row => {
                        if (row.status in returnStats) {
                            returnStats[row.status] = row.count;
                        }
                    });

                    const orders = orderRows.map(row => ({
                        order_id: row.order_id,
                        order_date: row.order_date,
                        status: row.status,
                        amount: parseFloat(row.amount) || 0
                    }));

                    res.status(200).json({
                        orders,
                        returnStats
                    });
                }
            );
        }
    );
});
  app.get("/api/sidebar", isAuthenticated, (req, res) => {
    const userRole = req.session.user.role.trim();
    res.json(sidebarLinks[userRole] || []);
  });
  app.post("/users", isAuthenticated, isSystemAdmin, async (req, res) => {
    const { username, email, phone_number, password, role, status, address, suppliername } = req.body;
    // التحقق من الحقول المطلوبة
    if (!username || !email || !phone_number || !password || !role) {
      return res.status(400).json({ 
        field: !username ? 'userName' : !email ? 'userEmail' : !phone_number ? 'userPhone' : 'userPassword',
        message: "جميع الحقول المطلوبة يجب ملؤها" 
      });
    }
    // التحقق من طول كلمة المرور
    if (password.length <= 6) {
      return res.status(400).json({ 
        field: 'userPassword', 
        message: "كلمة المرور يجب أن تكون أكثر من 6 أحرف أو أرقام" 
      });
    }
    if (!Object.values(roleMapping).includes(role)) {
      return res.status(400).json({ field: 'userRole', message: "الدور غير صالح." });
    }
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userQuery = `
        INSERT INTO Users (username, email, phone_number, password_hash, role, status) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      db.query(
        userQuery,
        [username, email, phone_number, hashedPassword, role, status || 'Active'],
        (err, result) => {
          if (err) {
            console.error("خطأ في إضافة المستخدم:", err);
            if (err.code === 'ER_DUP_ENTRY') {
              return res.status(400).json({ 
                field: 'userEmail', 
                message: "البريد الإلكتروني مستخدم بالفعل" 
              });
            }
            return res.status(500).json({ 
              field: 'addForm', 
              message: "خطأ أثناء إضافة المستخدم" 
            });
          }
          const newUserId = result.insertId;
          if (role === "مورد") {
            const supplierQuery = `
              INSERT INTO Suppliers (supplier_id, suppliername, email, phone_number, address, status) 
              VALUES (?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE 
                suppliername = VALUES(suppliername),
                email = VALUES(email), 
                phone_number = VALUES(phone_number),
                address = VALUES(address),
                status = VALUES(status)
            `;
            const supplierAddress = address || null;
            const supplierName = suppliername || username; // استخدام username كـ suppliername
            db.query(
              supplierQuery,
              [newUserId, supplierName, email, phone_number, supplierAddress, status || 'Active'],
              (err) => {
                if (err) {
                  console.error("خطأ في إضافة المورد:", err);
                  return res.status(500).json({ 
                    field: 'addForm', 
                    message: "خطأ أثناء إضافة المورد" 
                  });
                }
                res.status(201).json({
                  message: "تمت إضافة المستخدم والمورد بنجاح",
                  user_id: newUserId,
                  supplier_id: newUserId,
                });
              }
            );
          } else {
            res.status(201).json({
              message: "تمت إضافة المستخدم بنجاح",
              user_id: newUserId,
            });
          }
        }
      );
    } catch (error) {
      console.error("خطأ في تشفير كلمة المرور:", error);
      return res.status(500).json({ 
        field: 'addForm', 
        message: "خطأ في الخادم أثناء تشفير كلمة المرور" 
      });
    }
  });
  app.get("/users", isAuthenticated,isSystemAdmin, (req, res) => {
    const { role, status } = req.query;
    let query =
      "SELECT user_id, username, email, phone_number, role, status, last_login, created_at, updated_at FROM Users";
    const params = [];
    if (role) {
      query += " WHERE role = ?";
      params.push(role);
    }
    if (status) {
      query += role ? " AND status = ?" : " WHERE status = ?";
      params.push(status);
    }
    db.query(query, params, (err, results) => {
      if (err) {
        console.error("خطأ في قاعدة البيانات:", err);
        return res.status(500).json({ message: "خطأ أثناء جلب المستخدمين" });
      }
      res.json(results);
    });
  });
  app.get('/api/suppliers', isAuthenticated, (req, res) => {
    const { status } = req.query;
    let query = `
      SELECT 
        s.supplier_id, 
        s.suppliername,  
        s.email, 
        s.phone_number, 
        s.address,
        s.status, 
        COUNT(o.order_id) AS order_count 
      FROM Suppliers s
      INNER JOIN Users u ON s.supplier_id = u.user_id
      LEFT JOIN Orders o ON s.supplier_id = o.supplier_id 
      WHERE u.role = 'مورد'
    `;
    const params = [];
    if (status) {
      query += " AND s.status = ?";
      params.push(status);
    }
    query +=
      " GROUP BY s.supplier_id, s.suppliername, s.email, s.phone_number, s.address, s.status";
    db.query(query, params, (err, results) => {
      if (err) {
        console.error("خطأ في قاعدة البيانات:", err);
        return res.status(500).json({ message: "خطأ أثناء جلب الموردين" });
      }
      res.json(results);
    });
  });
  // إنشاء مجموعة جديدة
// جلب جميع المجموعات
app.get('/api/teams', isAuthenticated, (req, res) => {
  const selectQuery = `
    SELECT 
      t.team_id, t.team_name, t.description, t.status,
      GROUP_CONCAT(DISTINCT u.username) AS members,
      GROUP_CONCAT(DISTINCT m.manufacturer_name) AS manufacturers
    FROM Teams t
    LEFT JOIN UserTeams ut ON t.team_id = ut.team_id
    LEFT JOIN Users u ON ut.user_id = u.user_id
    LEFT JOIN TeamManufacturers tm ON t.team_id = tm.team_id
    LEFT JOIN Manufacturers m ON tm.manufacturer_id = m.manufacturer_id
    GROUP BY t.team_id, t.team_name, t.description, t.status
  `;
  db.query(selectQuery, (err, results) => {
    if (err) {
      console.error('خطأ في جلب الفرق:', err);
      return res.status(500).json({ message: 'خطأ في الخادم', error: err.message });
    }
    const teams = results.map(team => ({
      ...team,
      members: team.members ? team.members.split(',') : [],
      manufacturers: team.manufacturers ? team.manufacturers.split(',') : [],
    }));
    res.status(200).json(teams);
  });
});
// إضافة مجموعة جديدة
app.post('/api/teams', isAuthenticated, isSystemAdmin, (req, res) => {
  const { team_name, description, status } = req.body;
  if (!team_name) {
    return res.status(400).json({ message: 'اسم المجموعة مطلوب' });
  }
  const insertTeamQuery = 'INSERT INTO Teams (team_name, description, status) VALUES (?, ?, ?)';
  const statusValue = status && ['Active', 'Inactive'].includes(status) ? status : 'Active';
  db.query(insertTeamQuery, [team_name, description || null, statusValue], (err, result) => {
    if (err) {
      console.error('خطأ في إضافة المجموعة:', {
        message: err.message,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState,
        code: err.code,
      });
      return res.status(500).json({ 
        message: 'خطأ أثناء إضافة المجموعة', 
        error: err.message, 
        sqlMessage: err.sqlMessage 
      });
    }
    res.status(201).json({ message: 'تم إضافة المجموعة بنجاح', team_id: result.insertId });
  });
});
app.get("/api/manufacturers", isAuthenticated, (req, res) => {
  const userRole = req.user.role; // دور المستخدم (مثل 'مسؤول النظام'، 'مدير'، 'مورد'، إلخ)
  const userId = req.user.id; // معرف المستخدم
  let manufacturersQuery;
  let queryParams = [];
  if (userRole === 'مسؤول النظام') {
    // مسؤول النظام يرى جميع الشركات
    manufacturersQuery = `
      SELECT 
        m.manufacturer_id, 
        m.manufacturer_name, 
        m.contact_info, 
        COUNT(p.product_id) AS product_count
      FROM Manufacturers m
      LEFT JOIN Products p ON m.manufacturer_id = p.manufacturer_id
      GROUP BY m.manufacturer_id, m.manufacturer_name, m.contact_info
    `;
  } else if (userRole === 'مورد') {
    // المورد يرى فقط الشركات المرتبطة به
    manufacturersQuery = `
      SELECT 
        m.manufacturer_id, 
        m.manufacturer_name, 
        m.contact_info, 
        COUNT(p.product_id) AS product_count
      FROM Manufacturers m
      INNER JOIN Supplier_Manufacturers sm ON m.manufacturer_id = sm.manufacturer_id
      LEFT JOIN Products p ON m.manufacturer_id = p.manufacturer_id
      WHERE sm.supplier_id = ?
      GROUP BY m.manufacturer_id, m.manufacturer_name, m.contact_info
    `;
    queryParams = [userId];
  } else {
    // الأدوار الأخرى (مثل مدير، موظف المستودع) ترى الشركات المرتبطة بفريقها
    manufacturersQuery = `
      SELECT 
        m.manufacturer_id, 
        m.manufacturer_name, 
        m.contact_info, 
        COUNT(p.product_id) AS product_count
      FROM Manufacturers m
      INNER JOIN TeamManufacturers tm ON m.manufacturer_id = tm.manufacturer_id
      INNER JOIN UserTeams ut ON tm.team_id = ut.team_id
      LEFT JOIN Products p ON m.manufacturer_id = p.manufacturer_id
      WHERE ut.user_id = ?
      GROUP BY m.manufacturer_id, m.manufacturer_name, m.contact_info
    `;
    queryParams = [userId];
  }
  db.query(manufacturersQuery, queryParams, (err, manufacturers) => {
    if (err) {
      console.error("خطأ في جلب الشركات:", err);
      return res
        .status(500)
        .json({ message: "خطأ أثناء جلب الشركات", error: err.message });
    }
    const suppliersQuery = `
      SELECT 
        sm.manufacturer_id, 
        sm.supplier_id, 
        s.suppliername
      FROM Supplier_Manufacturers sm
      LEFT JOIN Suppliers s ON sm.supplier_id = s.supplier_id
    `;
    db.query(suppliersQuery, (err, suppliers) => {
      if (err) {
        console.error("خطأ في جلب الموردين:", err);
        return res
          .status(500)
          .json({ message: "خطأ أثناء جلب الموردين", error: err.message });
      }
      const result = manufacturers.map((manufacturer) => {
        const relatedSuppliers = suppliers
          .filter((sup) => sup.manufacturer_id === manufacturer.manufacturer_id)
          .map((sup) => ({
            supplier_id: sup.supplier_id,
            suppliername: sup.suppliername,
          }));
        return {
          ...manufacturer,
          suppliers: relatedSuppliers,
        };
      });
      res.json(result);
    });
  });
});
  app.post("/api/manufacturers", isAuthenticated, restrictToAdminAndManager, (req, res) => {
    const { manufacturer_name, contact_info } = req.body;
    if (!manufacturer_name) {
      return res
        .status(400)
        .json({ field: "manufacturer_name", message: "اسم الشركة مطلوب" });
    }
    const query = "INSERT INTO Manufacturers (manufacturer_name, contact_info) VALUES (?, ?)";
    db.query(query, [manufacturer_name, contact_info || null], (err, result) => {
      if (err) {
        console.error("خطأ في إضافة الشركة:", err);
        return res
          .status(500)
          .json({ message: "خطأ أثناء إضافة الشركة", error: err.message });
      }
      res.status(201).json({
        message: "تمت إضافة الشركة بنجاح",
        manufacturer_id: result.insertId,
      });
    });
  });
// Get categories
app.get('/api/categories', isAuthenticated, (req, res) => {
  const { manufacturer_id } = req.query;
  if (!manufacturer_id) {
    return res.status(400).json({ message: 'معرف الشركة مطلوب' });
  }
  const query = `
    SELECT c.category_id, c.category_name 
    FROM Categories c
    INNER JOIN ManufacturerCategories mc ON c.category_id = mc.category_id
    WHERE mc.manufacturer_id = ?
    ORDER BY c.category_name ASC
  `;
  db.query(query, [manufacturer_id], (err, results) => {
    if (err) {
      console.error('خطأ في جلب الأصناف:', err);
      return res.status(500).json({ message: 'خطأ أثناء جلب الأصناف', error: err.message });
    }
    res.json(results);
  });
});
// Add category
app.post('/api/categories', isAuthenticated, restrictToSupplier, (req, res) => {
  const { category_name, manufacturer_id } = req.body;
  if (!category_name || !manufacturer_id) {
    return res.status(400).json({ message: 'اسم الصنف ومعرف الشركة المصنعة مطلوبان' });
  }
  const insertCategoryQuery = 'INSERT INTO Categories (category_name) VALUES (?)';
  db.query(insertCategoryQuery, [category_name], (err, result) => {
    if (err) {
      console.error('خطأ في إضافة الصنف:', err);
      return res.status(500).json({ message: 'خطأ أثناء إضافة الصنف', error: err.message });
    }
    const category_id = result.insertId;
    const insertManufacturerCategoryQuery = `
      INSERT INTO ManufacturerCategories (manufacturer_id, category_id) 
      VALUES (?, ?)
    `;
    db.query(insertManufacturerCategoryQuery, [manufacturer_id, category_id], (err) => {
      if (err) {
        console.error('خطأ في ربط الصنف بالشركة المصنعة:', err);
        return res.status(500).json({ message: 'خطأ أثناء ربط الصنف', error: err.message });
      }
      res.status(201).json({ message: 'تم إضافة الصنف بنجاح', category_id });
    });
  });
});
// Get products
app.get('/api/products', isAuthenticated, (req, res) => {
  const { manufacturer_id, category, quantity } = req.query;
  if (!manufacturer_id) {
    return res.status(400).json({ message: 'معرف الشركة المصنعة مطلوب' });
  }
  let query = `
    SELECT p.*, c.category_name 
    FROM Products p
    LEFT JOIN Categories c ON p.category_id = c.category_id
    WHERE p.manufacturer_id = ?
  `;
  const params = [manufacturer_id];
  if (category && category !== 'all') {
    query += ' AND p.category_id = ?';
    params.push(category);
  }
  if (quantity && quantity !== 'all') {
    if (quantity === 'available') {
      query += ' AND p.quantity > 0';
    } else if (quantity === 'unavailable') {
      query += ' AND p.quantity = 0';
    }
  }
  query += ' ORDER BY COALESCE(c.category_name, ""), p.product_name ASC';
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('خطأ في جلب المنتجات:', err);
      return res.status(500).json({ message: 'خطأ أثناء جلب المنتجات', error: err.message });
    }
    // Map results to include availability status based on quantity
    const products = results.map(product => ({
      ...product,
      availability: product.quantity > 0 ? 'available' : 'unavailable'
    }));
    res.json(products);
  });
});
// Add product
app.post('/api/products', isAuthenticated, restrictToSupplier, (req, res) => {
  const { product_name, description, barcode, manufacturer_id, category_id, unit, price, quantity } = req.body;
  if (!product_name || !manufacturer_id || quantity == null) {
    return res.status(400).json({ message: 'اسم المنتج، معرف الشركة المصنعة، والكمية مطلوبة' });
  }
  const query = `
    INSERT INTO Products (product_name, description, barcode, manufacturer_id, category_id, unit, price, quantity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(query, [
    product_name,
    description || null,
    barcode || null,
    manufacturer_id,
    category_id || null,
    unit || null,
    price || null,
    quantity
  ], (err, result) => {
    if (err) {
      console.error('خطأ في إضافة المنتج:', err);
      return res.status(500).json({ message: 'خطأ أثناء إضافة المنتج', error: err.message });
    }
    res.status(201).json({ message: 'تم إضافة المنتج بنجاح', product_id: result.insertId });
  });
});
app.get('/api/export-products', isAuthenticated, restrictToAdminManagerSupplier, (req, res) => {
  const { manufacturer_id, category } = req.query;
  if (!manufacturer_id) {
    return res.status(400).json({ message: 'معرف الشركة المصنعة مطلوب' });
  }
  let query = `
    SELECT p.*, c.category_name 
    FROM Products p
    LEFT JOIN Categories c ON p.category_id = c.category_id
    WHERE p.manufacturer_id = ?
  `;
  const params = [manufacturer_id];
  if (category && category !== 'all') {
    query += ' AND p.category_id = ?';
    params.push(category);
  }
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('خطأ في تصدير المنتجات:', err);
      return res.status(500).json({ message: 'خطأ أثناء تصدير المنتجات', error: err.message });
    }
    res.setHeader('Content-Disposition', 'attachment; filename="products.json"');
    res.json(results);
  });
});

app.post('/api/orders', isAuthenticated, async (req, res) => {
  const { manufacturer_id, reservation_id, order_id, items } = req.body;
  // التحقق من صحة البيانات
  if (!manufacturer_id || !reservation_id || !order_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'بيانات غير صالحة: معرف الشركة المصنعة، معرف الحجز، معرف الطلب، والعناصر مطلوبة' });
  }
  // بدء معاملة
  db.beginTransaction(err => {
    if (err) {
      console.error('خطأ في بدء المعاملة:', err);
      return res.status(500).json({ error: 'فشل بدء المعاملة' });
    }
    // التحقق من وجود الطلب وصلاحية المستخدم
    db.query(
      `
      SELECT order_id FROM Orders WHERE order_id = ? AND employee_id = ?
      `,
      [order_id, req.user.id],
      (err, order) => {
        if (err) {
          return db.rollback(() => {
            console.error('خطأ في التحقق من الطلب:', err);
            res.status(500).json({ error: `فشل التحقق من الطلب: ${err.message}` });
          });
        }
        if (!order[0]) {
          return db.rollback(() => {
            res.status(403).json({ error: 'الطلب غير موجود أو غير مصرح' });
          });
        }
        // إضافة عناصر الطلب وجمع المبلغ الإجمالي
        let processedItems = 0;
        const totalItems = items.length;
        let totalAmount = 0;
        const processItem = (index) => {
          if (index >= totalItems) {
            // خصم الكميات من جدول Products لكل عنصر
            let updatedItems = 0;
            items.forEach((item, idx) => {
              const { id: product_id, quantity } = item;
              db.query(
                `
                UPDATE Products
                SET quantity = quantity - ?
                WHERE product_id = ?
                `,
                [quantity, product_id],
                (err, updateResult) => {
                  if (err) {
                    return db.rollback(() => {
                      console.error('خطأ في خصم الكمية للمنتج:', product_id, err);
                      res.status(500).json({ error: `فشل خصم الكمية للمنتج ${product_id}: ${err.message}` });
                    });
                  }
                  if (updateResult.affectedRows === 0) {
                    return db.rollback(() => {
                      res.status(400).json({ error: `المنتج ${product_id} غير موجود` });
                    });
                  }
                  updatedItems++;
                  if (updatedItems === items.length) {
                    // تحديث Orders.amount
                    db.query(
                      `
                      UPDATE Orders
                      SET amount = ?
                      WHERE order_id = ?
                      `,
                      [totalAmount, order_id],
                      (err) => {
                        if (err) {
                          return db.rollback(() => {
                            console.error('خطأ في تحديث المبلغ الإجمالي:', err);
                            res.status(500).json({ error: `فشل تحديث المبلغ الإجمالي: ${err.message}` });
                          });
                        }
                        // إتمام المعاملة
                        db.commit(err => {
                          if (err) {
                            return db.rollback(() => {
                              console.error('خطأ في إتمام المعاملة:', err);
                              res.status(500).json({ error: 'فشل إتمام المعاملة' });
                            });
                          }
                          res.status(201).json({
                            message: 'تم إنشاء الطلب بنجاح',
                            order_id: order_id,
                            amount: totalAmount,
                          });
                        });
                      }
                    );
                  }
                }
              );
            });
            return;
          }
          const item = items[index];
          const { id: product_id, quantity, notes } = item;
          if (!product_id || !quantity || quantity <= 0) {
            return db.rollback(() => {
              res.status(400).json({ error: 'بيانات العنصر غير صالحة' });
            });
          }
          // جلب سعر المنتج
          db.query(
            `
            SELECT price FROM Products WHERE product_id = ?
            `,
            [product_id],
            (err, product) => {
              if (err) {
                return db.rollback(() => {
                  console.error('خطأ في جلب سعر المنتج:', err);
                  res.status(500).json({ error: `فشل جلب سعر المنتج: ${err.message}` });
                });
              }
              if (!product[0]) {
                return db.rollback(() => {
                  res.status(400).json({ error: `المنتج ${product_id} غير موجود` });
                });
              }
              const price = product[0].price;
              if (price <= 0) {
                return db.rollback(() => {
                  res.status(400).json({ error: `المنتج ${product_id} له سعر غير صالح` });
                });
              }
              totalAmount += price * quantity;
              // إضافة العنصر إلى OrderItems مع السعر
              db.query(
                `
                INSERT INTO OrderItems (order_id, product_id, quantity, price, notes)
                VALUES (?, ?, ?, ?, ?)
                `,
                [order_id, product_id, quantity, price, notes],
                (err) => {
                  if (err) {
                    return db.rollback(() => {
                      console.error('خطأ في إضافة العنصر:', err);
                      res.status(500).json({ error: `فشل إضافة العنصر: ${err.message}` });
                    });
                  }
                  processedItems++;
                  processItem(index + 1); // معالجة العنصر التالي
                }
              );
            }
          );
        };
        // بدء معالجة العناصر
        processItem(0);
      }
    );
  });
});

app.get('/api/orders', isAuthenticated, (req, res) => {
  if (!req.user || !req.user.id || req.user.role !== 'موظف المستودع') {
    console.error('محاولة وصول غير مصرح بها:', { user: req.user });
    return res.status(403).json({ message: 'فقط موظف المستودع يمكنه عرض الطلبات' });
  }
  const query = `
    SELECT 
      order_id, 
      manufacturer_id, 
      order_date, 
      status, 
      payment_status, 
      delivery_status, 
      amount
    FROM Orders 
    WHERE employee_id = ?
  `;
  db.query(query, [req.user.id], (err, results) => {
    if (err) {
      console.error('خطأ في جلب الطلبات:', {
        message: err.message,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState,
        code: err.code
      });
      return res.status(500).json({ message: 'خطأ أثناء جلب الطلبات', error: err.message, sqlMessage: err.sqlMessage });
    }
    res.status(200).json({ orders: results });
  });
});
// Get cart items
app.get('/api/cart', isAuthenticated, (req, res) => {
  const { manufacturer_id } = req.query;
  const userId = req.user.id; // Changed from user_id to id to match /api/orders
  if (!manufacturer_id) {
    return res.status(400).json({ message: 'معرف الشركة المصنعة مطلوب' });
  }
  const query = `
    SELECT 
      c.cart_id,
      c.user_id,
      c.product_id,
      c.quantity,
      c.notes,
      c.manufacturer_id,
      p.product_name,
      p.description,
      p.barcode,
      p.price,
      p.quantity AS product_quantity,
      p.unit,
      c.created_at,
      COALESCE(cat.category_name, '-') AS category_name,
      CASE WHEN p.quantity > 0 THEN 'available' ELSE 'unavailable' END AS availability
    FROM Cart c
    JOIN Products p ON c.product_id = p.product_id
    LEFT JOIN Categories cat ON p.category_id = cat.category_id
    WHERE c.user_id = ? AND c.manufacturer_id = ?
  `;
  db.query(query, [userId, manufacturer_id], (err, results) => {
    if (err) {
      console.error('خطأ في جلب عناصر العربة:', err);
      return res.status(500).json({ message: 'خطأ أثناء جلب العربة', error: err.message });
    }
    res.json(results);
  });
});
// تفريغ العربة بالكامل للمستخدم
app.delete('/api/cart/clear', isAuthenticated, (req, res) => {
  const userId = req.user.id;
  console.log(`Attempting to clear cart for user ID: ${userId}, Role: ${req.user.role}`);
  if (req.user.role !== 'موظف المستودع') {
    console.error('محاولة وصول غير مصرح بها:', req.user.role);
    return res.status(403).json({ message: 'فقط موظف المستودع يمكنه تفريغ العربة' });
  }
  const query = 'DELETE FROM Cart WHERE user_id = ?';
  db.query(query, [userId], (err, result) => {
    if (err) {
      console.error('خطأ في تفريغ العربة:', {
        userId,
        message: err.message,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState,
        code: err.code
      });
      return res.status(500).json({ 
        message: 'خطأ أثناء تفريغ العربة', 
        error: err.message, 
        sqlMessage: err.sqlMessage 
      });
    }
    console.log(`تم تفريغ العربة للمستخدم ${userId}, العناصر المحذوفة: ${result.affectedRows}`);
    res.json({ 
      message: 'تم تفريغ العربة بنجاح', 
      affectedRows: result.affectedRows 
    });
  });
});
app.get('/api/cart/count', isAuthenticated, (req, res) => {
  if (req.user.role !== 'موظف المستودع') {
    console.error('محاولة وصول غير مصرح بها:', req.user.role);
    return res.status(403).json({ message: 'فقط موظف المستودع يمكنه الوصول إلى العربة' });
  }
  const manufacturerId = req.query.manufacturer_id;
  if (!manufacturerId) {
    console.error('معرف الشركة المصنعة مفقود');
    return res.status(400).json({ message: 'معرف الشركة المصنعة مطلوب' });
  }
  const query = 'SELECT COUNT(*) as count FROM Cart WHERE user_id = ? AND manufacturer_id = ?';
  db.query(query, [req.user.id, manufacturerId], (err, results) => {
    if (err) {
      console.error('خطأ في جلب عدد العناصر:', {
        message: err.message,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState,
        code: err.code
      });
      return res.status(500).json({ message: 'خطأ أثناء جلب عدد العناصر', error: err.message, sqlMessage: err.sqlMessage });
    }
    console.log(`عدد العناصر في العربة للمستخدم ${req.user.id}: ${results[0].count}`);
    res.json({ count: results[0].count });
  });
});
app.post('/api/cart', isAuthenticated, (req, res) => {
  if (req.session.user.role !== 'موظف المستودع') {
    return res.status(403).json({ message: 'غير مصرح لإضافة عناصر إلى العربة' });
  }
  const { product_id, quantity, notes, manufacturer_id } = req.body;
  const user_id = req.session.user.id;
  if (!product_id || !quantity || !manufacturer_id) {
    return res.status(400).json({ message: 'البيانات المطلوبة مفقودة' });
  }
  // إدراج العنصر في جدول Cart
  const query = `
    INSERT INTO Cart (user_id, product_id, quantity, notes, manufacturer_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(query, [user_id, product_id, quantity, notes || null, manufacturer_id], (err, result) => {
    if (err) {
      console.error('خطأ في إدراج العنصر في العربة:', err);
      return res.status(500).json({ message: 'حدث خطأ أثناء إضافة العنصر' });
    }
    console.log('تم إضافة العنصر إلى العربة:', { insertId: result.insertId });
    res.status(201).json({ message: 'تمت إضافة العنصر بنجاح', cart_id: result.insertId });
  });
});
app.post('/api/order-reservations', isAuthenticated, async (req, res) => {
  const { manufacturer_id, items } = req.body;
  // التحقق من صحة البيانات
  if (!manufacturer_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'بيانات غير صالحة: معرف الشركة المصنعة والعناصر مطلوبة' });
  }
  // بدء معاملة
  db.beginTransaction(err => {
    if (err) {
      console.error('خطأ في بدء المعاملة:', err);
      return res.status(500).json({ error: 'فشل بدء المعاملة' });
    }
    // إنشاء طلب مؤقت
    db.query(
      `
      INSERT INTO Orders (manufacturer_id, employee_id, order_date, status)
      VALUES (?, ?, NOW(), 'قيد الانتظار')
      `,
      [manufacturer_id, req.user.id],
      (err, orderResult) => {
        if (err) {
          return db.rollback(() => {
            console.error('خطأ في إنشاء الطلب المؤقت:', err);
            res.status(500).json({ error: `فشل إنشاء الطلب المؤقت: ${err.message}` });
          });
        }
        const orderId = orderResult.insertId;
        // معالجة العناصر بشكل تسلسلي
        let processedItems = 0;
        const totalItems = items.length;
        let reservationId = null;
        const processItem = (index) => {
          if (index >= totalItems) {
            // إتمام المعاملة
            db.commit(err => {
              if (err) {
                return db.rollback(() => {
                  console.error('خطأ في إتمام المعاملة:', err);
                  res.status(500).json({ error: 'فشل إتمام المعاملة' });
                });
              }
              res.status(201).json({
                message: 'تم إنشاء حجز الطلب بنجاح',
                reservation_id: reservationId,
                order_id: orderId,
              });
            });
            return;
          }
          const item = items[index];
          const { product_id, quantity } = item;
          if (!product_id || !quantity || quantity <= 0) {
            return db.rollback(() => {
              res.status(400).json({ error: 'بيانات العنصر غير صالحة' });
            });
          }
          // التحقق من توفر الكمية وانتماء المنتج للشركة المصنعة
          db.query(
            `
            SELECT p.quantity, COALESCE(SUM(res.reserved_quantity), 0) as reserved
            FROM Products p
            LEFT JOIN OrderReservations res 
              ON p.product_id = res.product_id 
              AND res.reservation_expiry > NOW()
            WHERE p.product_id = ? AND p.manufacturer_id = ?
            GROUP BY p.quantity
            `,
            [product_id, manufacturer_id],
            (err, product) => {
              if (err) {
                return db.rollback(() => {
                  console.error('خطأ في جلب المنتج:', err);
                  res.status(500).json({ error: `فشل جلب المنتج: ${err.message}` });
                });
              }
              if (!product[0]) {
                return db.rollback(() => {
                  res.status(400).json({ error: `المنتج ${product_id} غير موجود أو لا ينتمي إلى الشركة المصنعة` });
                });
              }
             
              // إنشاء الحجز
              db.query(
                `
                INSERT INTO OrderReservations (order_id, product_id, reserved_quantity, reservation_expiry, created_at)
                VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 75 MINUTE), NOW())
                `,
                [orderId, product_id, quantity],
                (err, result) => {
                  if (err) {
                    return db.rollback(() => {
                      console.error('خطأ في إنشاء الحجز:', err);
                      res.status(500).json({ error: `فشل إنشاء الحجز: ${err.message}` });
                    });
                  }
                  // حفظ معرف الحجز الأول
                  if (index === 0) {
                    reservationId = result.insertId;
                  }
                  console.log(`تم حجز ${quantity} من المنتج ${product_id} للطلب ${orderId}`);
                  processedItems++;
                  processItem(index + 1); // معالجة العنصر التالي
                }
              );
            }
          );
        };
        // بدء معالجة العناصر
        processItem(0);
      }
    );
  });
});
app.get('/api/orders-manage', isAuthenticated, restrictToAdminAndManager, (req, res) => {
  console.log('GET /api/orders-manage', { user: req.user });
  let query;
  let queryParams = [];
  if (req.user.role === 'مدير') {
    query = `
      SELECT 
          o.order_id, 
          o.order_date, 
          o.status, 
          o.payment_status, 
          o.delivery_status, 
          COALESCE(o.amount, 0) AS amount, 
          COALESCE(u.username, 'غير محدد') AS employee_name, 
          COALESCE(s.username, 'غير محدد') AS supplier_name, 
          m.manufacturer_name,
          COALESCE(u.status, 'Active') AS user_status,
          o.rejection_reason,
          MIN(r.reservation_expiry) AS reservation_expiry
      FROM Orders o
      LEFT JOIN Users u ON o.employee_id = u.user_id
      LEFT JOIN Users s ON o.supplier_id = s.user_id
      LEFT JOIN Manufacturers m ON o.manufacturer_id = m.manufacturer_id
      JOIN TeamManufacturers tm ON m.manufacturer_id = tm.manufacturer_id
      JOIN UserTeams ut ON tm.team_id = ut.team_id
      LEFT JOIN OrderReservations r ON o.order_id = r.order_id
      WHERE ut.user_id = ?
      GROUP BY o.order_id
      ORDER BY o.order_date DESC
    `;
    queryParams = [req.user.id];
  } else {
    query = `
      SELECT 
          o.order_id, 
          o.order_date, 
          o.status, 
          o.payment_status, 
          o.delivery_status, 
          COALESCE(o.amount, 0) AS amount, 
          COALESCE(u.username, 'غير محدد') AS employee_name, 
          COALESCE(s.username, 'غير محدد') AS supplier_name, 
          m.manufacturer_name,
          COALESCE(u.status, 'Active') AS user_status,
          o.rejection_reason,
          MIN(r.reservation_expiry) AS reservation_expiry
      FROM Orders o
      LEFT JOIN Users u ON o.employee_id = u.user_id
      LEFT JOIN Users s ON o.supplier_id = s.user_id
      LEFT JOIN Manufacturers m ON o.manufacturer_id = m.manufacturer_id
      LEFT JOIN OrderReservations r ON o.order_id = r.order_id
      GROUP BY o.order_id
      ORDER BY o.order_date DESC
    `;
  }
  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('خطأ في جلب الطلبات:', {
        message: err.message,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState,
        code: err.code
      });
      return res.status(500).json({ 
        message: 'خطأ أثناء جلب الطلبات', 
        error: err.message, 
        sqlMessage: err.sqlMessage 
      });
    }
    console.log('الطلبات المجلوبة:', results.length, 'سجل');
    res.status(200).json({ items: results });
  });
app.get('/api/payments-manage/:id', isAuthenticated, (req, res) => {
  console.log('GET /api/payments-manage/:id', { id: req.params.id, user: req.user });
  if (req.user.role !== 'موظف التتبع و الفواتير') {
      console.error('Unauthorized access attempt:', req.user.role);
      return res.status(403).json({ message: 'فقط موظف التتبع والفواتير يمكنه الوصول إلى المدفوعات' });
  }
  const { id } = req.params;
  const paymentQuery = `
      SELECT 
          o.order_id, 
          o.order_date, 
          m.manufacturer_name, 
          COALESCE(o.amount, 0) AS amount, 
          o.payment_status, 
          COALESCE(u.username, 'غير محدد') AS employee_name, 
          COALESCE(s.username, 'غير محدد') AS supplier_name, 
          COALESCE(s.user_id, '') AS supplier_id,
          o.payment_terms, 
          o.manufacturer_id
      FROM Orders o
      LEFT JOIN Manufacturers m ON o.manufacturer_id = m.manufacturer_id
      LEFT JOIN Users u ON o.employee_id = u.user_id
      LEFT JOIN Users s ON o.supplier_id = s.user_id
      WHERE o.order_id = ? AND o.status = 'موافق عليه'
  `;
  const itemsQuery = `
      SELECT 
          oi.order_item_id, 
          oi.quantity, 
          p.product_name, 
          COALESCE(p.price, 0) AS price
      FROM OrderItems oi
      LEFT JOIN Products p ON oi.product_id = p.product_id
      WHERE oi.order_id = ?
  `;
  db.query(paymentQuery, [id], (err, paymentResults) => {
      if (err) {
          console.error('Error fetching payment details:', err);
          return res.status(500).json({ message: 'خطأ أثناء جلب تفاصيل الدفع', error: err.message, sqlMessage: err.sqlMessage });
      }
      if (paymentResults.length === 0) {
          console.warn('Payment or approved order not found:', id);
          return res.status(404).json({ message: 'الطلب غير موجود أو غير موافق عليه' });
      }
      console.log('Payment details fetched:', paymentResults[0]);
      db.query(itemsQuery, [id], (err, itemsResults) => {
          if (err) {
              console.error('Error fetching order items:', err);
              return res.status(500).json({ message: 'خطأ أثناء جلب عناصر الطلب', error: err.message, sqlMessage: err.sqlMessage });
          }
          console.log('Order items fetched:', itemsResults.length, 'items');
          res.status(200).json({
              payment: paymentResults[0],
              items: itemsResults
          });
      });
  });
});
// Update supplier and payment terms for an order
app.put('/api/payments-manage/:id', isAuthenticated, (req, res) => {
  console.log('PUT /api/payments-manage/:id', { id: req.params.id, body: req.body, user: req.user });
  if (req.user.role !== 'موظف التتبع و الفواتير') {
      console.error('Unauthorized access attempt:', req.user.role);
      return res.status(403).json({ message: 'فقط موظف التتبع والفواتير يمكنه تحديث المدفوعات' });
  }
  const { id } = req.params;
  const { supplier_id, payment_terms } = req.body;
  const validPaymentTerms = ['عند الاستلام', 'تحويل بنكي', 'بطاقة ائتمان'];
  if (!payment_terms || !validPaymentTerms.includes(payment_terms)) {
      console.error('Invalid payment terms:', payment_terms);
      return res.status(400).json({ message: 'شروط الدفع غير صالحة' });
  }
  if (!supplier_id) {
      console.error('Supplier ID is required');
      return res.status(400).json({ message: 'يجب اختيار مورد' });
  }
  const checkOrderQuery = `
      SELECT order_id
      FROM Orders
      WHERE order_id = ? AND status = 'موافق عليه'
  `;
  db.query(checkOrderQuery, [id], (err, results) => {
      if (err) {
          console.error('Error checking order:', err);
          return res.status(500).json({ message: 'خطأ أثناء التحقق من الطلب', error: err.message, sqlMessage: err.sqlMessage });
      }
      if (results.length === 0) {
          console.warn('Approved order not found:', id);
          return res.status(404).json({ message: 'الطلب غير موجود أو غير موافق عليه' });
      }
      const updateQuery = `
          UPDATE Orders
          SET supplier_id = ?, payment_terms = ?
          WHERE order_id = ?
      `;
      db.query(updateQuery, [supplier_id, payment_terms, id], (err, result) => {
          if (err) {
              console.error('Error updating order:', err);
              return res.status(500).json({ message: 'خطأ أثناء تحديث الطلب', error: err.message, sqlMessage: err.sqlMessage });
          }
          if (result.affectedRows === 0) {
              console.warn('No rows updated for order:', id);
              return res.status(404).json({ message: 'الطلب غير موجود' });
          }
          console.log('Order updated successfully:', { order_id: id, supplier_id, payment_terms });
          res.status(200).json({ message: 'تم تحديث المورد وشروط الدفع بنجاح' });
      });
  });
});
});
// مسار جلب قائمة الطلبات
app.get('/api/My_orders', isAuthenticated, (req, res) => {
  console.log('GET /api/My_orders', { user: req.user });
  const userId = req.user.id;
  const userRole = req.user.role;
  let query;
  let queryParams = [];
  if (userRole === 'مسؤول النظام') {
      // مسؤول النظام يرى جميع الطلبات
      query = `
          SELECT 
              o.order_id, 
              o.order_date, 
              o.status, 
              o.payment_status, 
              o.delivery_status, 
              COALESCE(o.amount, 0) AS amount, 
              COALESCE(u.username, 'غير محدد') AS employee_name, 
              COALESCE(s.username, 'غير محدد') AS supplier_name, 
              m.manufacturer_name,
              COALESCE(u.status, 'Active') AS user_status,
              o.rejection_reason,
              MIN(r.reservation_expiry) AS reservation_expiry
          FROM Orders o
          LEFT JOIN Users u ON o.employee_id = u.user_id
          LEFT JOIN Users s ON o.supplier_id = s.user_id
          LEFT JOIN Manufacturers m ON o.manufacturer_id = m.manufacturer_id
          LEFT JOIN OrderReservations r ON o.order_id = r.order_id
          GROUP BY o.order_id
          ORDER BY o.order_date DESC
      `;
  } else if (userRole === 'مورد') {
      // المورد يرى الطلبات التي يكون هو المورد فيها مع حالة "موافق عليه"
      query = `
          SELECT 
              o.order_id, 
              o.order_date, 
              o.status, 
              o.payment_status, 
              o.delivery_status, 
              COALESCE(o.amount, 0) AS amount, 
              COALESCE(u.username, 'غير محدد') AS employee_name, 
              COALESCE(s.username, 'غير محدد') AS supplier_name, 
              m.manufacturer_name,
              COALESCE(u.status, 'Active') AS user_status,
              o.rejection_reason,
              MIN(r.reservation_expiry) AS reservation_expiry
          FROM Orders o
          LEFT JOIN Users u ON o.employee_id = u.user_id
          LEFT JOIN Users s ON o.supplier_id = s.user_id
          LEFT JOIN Manufacturers m ON o.manufacturer_id = m.manufacturer_id
          LEFT JOIN OrderReservations r ON o.order_id = r.order_id
          WHERE o.status = 'موافق عليه' AND o.supplier_id = ?
          GROUP BY o.order_id
          ORDER BY o.order_date DESC
      `;
      queryParams = [userId];
  } else {
      // الأدوار الأخرى (مدير، موظف المستودع، موظف التتبع والفواتير)
      query = `
          SELECT 
              o.order_id, 
              o.order_date, 
              o.status, 
              o.payment_status, 
              o.delivery_status, 
              COALESCE(o.amount, 0) AS amount, 
              COALESCE(u.username, 'غير محدد') AS employee_name, 
              COALESCE(s.username, 'غير محدد') AS supplier_name, 
              m.manufacturer_name,
              COALESCE(u.status, 'Active') AS user_status,
              o.rejection_reason,
              MIN(r.reservation_expiry) AS reservation_expiry
          FROM Orders o
          LEFT JOIN Users u ON o.employee_id = u.user_id
          LEFT JOIN Users s ON o.supplier_id = s.user_id
          LEFT JOIN Manufacturers m ON o.manufacturer_id = m.manufacturer_id
          LEFT JOIN OrderReservations r ON o.order_id = r.order_id
          LEFT JOIN TeamManufacturers tm ON m.manufacturer_id = tm.manufacturer_id
          LEFT JOIN UserTeams ut ON tm.team_id = ut.team_id
          WHERE ut.user_id = ? OR ut.user_id IS NULL
          GROUP BY o.order_id
          ORDER BY o.order_date DESC
      `;
      queryParams = [userId];
  }
  db.query(query, queryParams, (err, results) => {
      if (err) {
          console.error('خطأ في جلب الطلبات:', {
              message: err.message,
              sqlMessage: err.sqlMessage,
              sqlState: err.sqlState,
              code: err.code
          });
          return res.status(500).json({ 
              message: 'خطأ أثناء جلب الطلبات', 
              error: err.message, 
              sqlMessage: err.sqlMessage 
          });
      }
      console.log('الطلبات المجلوبة:', results.length, 'سجل');
      if (results.length === 0) {
          let message = 'لا توجد طلبات لعرضها';
          if (userRole === 'مورد') {
              message = 'لا توجد طلبات موافق عليها مرتبطة بك';
          } else if (userRole !== 'مسؤول النظام') {
              message = 'لا توجد طلبات مرتبطة بمجموعاتك أو أنت غير مرتبط بأي مجموعة';
          }
          return res.status(200).json({ items: [], message });
      }
      res.status(200).json({ items: results });
  });
});
// جلب جميع الطلبات الموافق عليها لإدارة المدفوعات
app.get('/api/payments-manage', isAuthenticated, (req, res) => {
  console.log('GET /api/payments-manage', { user: req.user });
  if (req.user.role !== 'موظف التتبع و الفواتير') {
    console.error('Unauthorized access attempt:', req.user.role);
    return res.status(403).json({ message: 'فقط موظف التتبع والفواتير يمكنه الوصول إلى المدفوعات' });
  }
  const query = `
    SELECT 
      o.order_id, 
      o.order_date, 
      m.manufacturer_name, 
      COALESCE(o.amount, 0) AS amount, 
      o.payment_status, 
      COALESCE(u.username, 'غير محدد') AS employee_name, 
      COALESCE(s.username, 'غير محدد') AS supplier_name, 
      o.payment_terms, 
      o.manufacturer_id
    FROM Orders o
    LEFT JOIN Manufacturers m ON o.manufacturer_id = m.manufacturer_id
    JOIN TeamManufacturers tm ON m.manufacturer_id = tm.manufacturer_id
    JOIN UserTeams ut ON tm.team_id = ut.team_id
    LEFT JOIN Users u ON o.employee_id = u.user_id
    LEFT JOIN Users s ON o.supplier_id = s.user_id
    WHERE o.status = 'موافق عليه' 
    AND ut.user_id = ?
  `;
  db.query(query, [req.user.id], (err, results) => {
    if (err) {
      console.error('Error fetching payments:', err);
      return res.status(500).json({ 
        message: 'خطأ أثناء جلب المدفوعات', 
        error: err.message, 
        sqlMessage: err.sqlMessage 
      });
    }
    console.log('Payments fetched:', results.length, 'records');
    res.status(200).json({ items: results });
  });
});
// API لمعالجة الدفع
// Process payment
app.post('/api/payments-comp', isAuthenticated, (req, res) => {
  console.log('POST /api/payments-comp', { body: req.body, user: req.user });
  if (req.user.role !== 'موظف التتبع و الفواتير') {
    console.error('Unauthorized access attempt:', req.user.role);
    return res.status(403).json({ error: 'فقط موظف التتبع والفواتير يمكنه معالجة الدفع' });
  }
  const { orderId, paymentMethod, amount, cardNumber, expiryDate, cvv, pin } = req.body;
  const validPaymentMethods = ['عند الاستلام', 'تحويل بنكي', 'بطاقة ائتمان'];
  if (!validPaymentMethods.includes(paymentMethod)) {
    console.error('Invalid payment method:', paymentMethod);
    return res.status(400).json({ error: 'طريقة الدفع غير صالحة' });
  }
  if (!pin || !/^\d{4}$/.test(pin)) {
    console.error('Invalid PIN format:', pin);
    return res.status(400).json({ error: 'رمز PIN يجب أن يتكون من 4 أرقام' });
  }
  const checkOrderQuery = `
    SELECT status, supplier_id, payment_terms, COALESCE(amount, 0) AS amount, sales_rep_pin
    FROM Orders
    WHERE order_id = ?
  `;
  db.query(checkOrderQuery, [orderId], (err, orderResults) => {
    if (err) {
      console.error('Error checking order:', err);
      return res.status(500).json({ error: 'حدث خطأ أثناء التحقق من الطلب', sqlMessage: err.sqlMessage });
    }
    if (orderResults.length === 0) {
      console.warn('Order not found:', orderId);
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }
    if (orderResults[0].status !== 'موافق عليه') {
      console.warn('Order not approved:', orderId);
      return res.status(400).json({ error: 'لا يمكن الدفع إلا للطلبات الموافق عليها' });
    }
    if (!orderResults[0].supplier_id || !orderResults[0].payment_terms) {
      console.warn('Order missing supplier or payment terms:', orderId);
      return res.status(400).json({ error: 'يجب تحديد المورد وطريقة الدفع أولاً' });
    }
    if (orderResults[0].payment_terms !== paymentMethod) {
      console.warn('Payment method mismatch:', { expected: orderResults[0].payment_terms, received: paymentMethod });
      return res.status(400).json({ error: `طريقة الدفع يجب أن تتطابق مع ${orderResults[0].payment_terms}` });
    }
    if (!orderResults[0].sales_rep_pin) {
      console.warn('No PIN set for order:', orderId);
      return res.status(400).json({ error: 'لم يتم تعيين رمز PIN من المورد بعد' });
    }
    if (orderResults[0].sales_rep_pin !== pin) {
      console.warn('PIN mismatch:', { expected: orderResults[0].sales_rep_pin, received: pin });
      return res.status(400).json({ error: 'رمز PIN غير صحيح' });
    }
    // Handle amount comparison
    const baseAmount = Number(orderResults[0].amount);
    const taxRate = 0.16; // Same as frontend
    const totalAmountWithTax = baseAmount * (1 + taxRate);
    // Accept either base amount or total amount with tax
    if (Number(amount).toFixed(2) !== baseAmount.toFixed(2) && Number(amount).toFixed(2) !== totalAmountWithTax.toFixed(2)) {
      console.warn('Amount mismatch:', {
        expectedBase: baseAmount.toFixed(2),
        expectedTotal: totalAmountWithTax.toFixed(2),
        received: Number(amount).toFixed(2),
      });
      return res.status(400).json({ error: 'المبلغ لا يتطابق مع مبلغ الطلب (مع أو بدون الضريبة)' });
    }
    // In production, integrate with a payment gateway for credit card validation
    if (paymentMethod === 'بطاقة ائتمان' && (!cardNumber || !expiryDate || !cvv)) {
      console.error('Missing credit card details');
      return res.status(400).json({ error: 'بيانات البطاقة غير كاملة' });
    }
    const updateOrderQuery = `
      UPDATE Orders 
      SET payment_status = 'مدفوع', 
          status = 'مكتمل',
          delivery_status="تم التوصيل",
          payment_date = NOW()

      WHERE order_id = ?
    `;
    db.query(updateOrderQuery, [orderId], (err, updateResult) => {
      if (err) {
        console.error('Error updating order:', err);
        return res.status(500).json({ error: 'حدث خطأ أثناء تحديث الطلب', sqlMessage: err.sqlMessage });
      }
      if (updateResult.affectedRows === 0) {
        console.warn('No rows updated for order:', orderId);
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }
      res.status(200).json({
        success: true,
        message: 'تمت عملية الدفع بنجاح',
        orderId: orderId,
      });
    });
  });
});
// Get list of vendors for a specific manufacturer
// جلب قائمة الموردين لشركة مصنعة معينة
app.get('/api/vendors', isAuthenticated, (req, res) => {
  console.log('GET /api/vendors', { user: req.user, query: req.query });
  if (req.user.role !== 'موظف التتبع و الفواتير') {
    console.error('Unauthorized access attempt:', req.user.role);
    return res.status(403).json({ message: 'فقط موظف التتبع والفواتير يمكنه الوصول إلى الموردين' });
  }
  const { manufacturer_id } = req.query;
  if (!manufacturer_id) {
    console.error('Manufacturer ID is required');
    return res.status(400).json({ message: 'يجب تحديد معرف الشركة المصنعة' });
  }
  const query = `
    SELECT u.user_id, COALESCE(u.username, 'مورد غير محدد') AS username
    FROM Users u
    JOIN Supplier_Manufacturers sm ON u.user_id = sm.supplier_id
    WHERE u.role = 'مورد' 
    AND u.status = 'Active'
    AND sm.manufacturer_id = ?
  `;
  db.query(query, [manufacturer_id], (err, results) => {
    if (err) {
      console.error('Error fetching vendors:', err);
      return res.status(500).json({ 
        message: 'خطأ أثناء جلب الموردين', 
        error: err.message, 
        sqlMessage: err.sqlMessage 
      });
    }
    console.log('Vendors fetched:', results.length, 'suppliers');
    res.status(200).json({ suppliers: results });
  });
});
app.post("/api/import", isAuthenticated, restrictToAdminAndManager,upload.single("file"),(req, res) => {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(req.file.path));
    } catch (error) {
      console.error("خطأ في تحليل ملف JSON:", error);
      return res.status(400).json({ message: "ملف JSON غير صالح" });
    }
    const query = `
    INSERT INTO Manufacturers (manufacturer_id, manufacturer_name, contact_info) 
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      manufacturer_name = VALUES(manufacturer_name), 
      contact_info = VALUES(contact_info)
  `;
    const promises = data.map((manufacturer) => {
      return new Promise((resolve, reject) => {
        db.query(
          query,
          [
            manufacturer.manufacturer_id,
            manufacturer.manufacturer_name,
            manufacturer.contact_info || null,
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });
    Promise.all(promises)
      .then(() => {
        fs.unlinkSync(req.file.path);
        res.status(200).json({ message: "تم استيراد الشركات بنجاح" });
      })
      .catch((err) => {
        console.error("خطأ في استيراد الشركات:", err);
        fs.unlinkSync(req.file.path);
        res
          .status(500)
          .json({ message: "خطأ أثناء استيراد الشركات", error: err.message });
      });
  }
);
// مسار جلب قائمة الطلبات
app.get('/api/My_orders', isAuthenticated, (req, res) => {
  console.log('GET /api/My_orders - Request received', {
    user_id: req.user.user_id,
    role: req.user.role,
    timestamp: new Date().toISOString(),
  });

  const userId = req.user.user_id;
  const userRole = req.user.role;

  function executeMainQuery() {
    let query = `
      SELECT 
        o.order_id, 
        o.order_date, 
        o.status, 
        COALESCE(o.amount, 0) AS amount, 
        COALESCE(s.username, 'غير محدد') AS supplier_name, 
        m.manufacturer_name
      FROM Orders o
      LEFT JOIN Users s ON o.supplier_id = s.user_id
      LEFT JOIN Manufacturers m ON o.manufacturer_id = m.manufacturer_id
    `;
    const queryParams = [];

    if (userRole === 'مسؤول النظام') {
      console.log('Fetching all orders for System Admin');
    } else if (userRole === 'مورد') {
      query += `
        WHERE o.supplier_id = ?
        AND o.supplier_id IS NOT NULL
        GROUP BY o.order_id
      `;
      queryParams.push(userId);
      console.log('Fetching orders for Supplier', { supplier_id: userId });
    } else {
      query += `
        LEFT JOIN TeamManufacturers tm ON m.manufacturer_id = tm.manufacturer_id
        LEFT JOIN UserTeams ut ON tm.team_id = ut.team_id
        WHERE ut.user_id = ? OR ut.user_id IS NULL
        GROUP BY o.order_id
      `;
      queryParams.push(userId);
      console.log('Fetching orders for other roles', { user_id: userId });
    }
    query += ` ORDER BY o.order_date DESC`;

    db.query(query, queryParams, (err, results) => {
      if (err) {
        console.error('Error executing query for /api/My_orders:', {
          message: err.message,
          sqlMessage: err.sqlMessage,
          sqlState: err.sqlState,
          code: err.code,
          query: query,
          params: queryParams,
        });
        return res.status(500).json({
          success: false,
          message: 'خطأ أثناء جلب الطلبات',
          error: err.message,
          sqlMessage: err.sqlMessage,
        });
      }

      console.log('Orders fetched:', {
        count: results.length,
        results: results.map(r => ({
          order_id: r.order_id,
          status: r.status,
          supplier_name: r.supplier_name,
        })),
      });

      if (results.length === 0) {
        let message = 'لا توجد طلبات لعرضها';
        if (userRole === 'مورد') {
          message = 'لا توجد طلبات مرتبطة بك كمورد';
        } else if (userRole !== 'مسؤول النظام') {
          message = 'لا توجد طلبات مرتبطة بمجموعاتك';
        }
        return res.status(200).json({
          success: true,
          items: [],
          message,
        });
      }

      const formattedResults = results.map((order) => ({
        order_id: order.order_id,
        order_date: order.order_date,
        status: order.status || 'قيد الانتظار',
        amount: order.amount,
        supplier_name: order.supplier_name,
        manufacturer_name: order.manufacturer_name
      }));

      res.status(200).json({
        success: true,
        items: formattedResults,
      });
    });
  }

  if (userRole !== 'مورد' && userRole !== 'مسؤول النظام') {
    db.query(
      `SELECT team_id FROM UserTeams WHERE user_id = ?`,
      [userId],
      (err, userTeams) => {
        if (err) {
          console.error('Error checking UserTeams:', {
            message: err.message,
            sqlMessage: err.sqlMessage,
            sqlState: err.sqlState,
            code: err.code,
          });
          return res.status(500).json({
            success: false,
            message: 'خطأ أثناء التحقق من المجموعات',
            error: err.message,
            sqlMessage: err.sqlMessage,
          });
        }
        console.log('User teams:', userTeams);

        const teamIds = userTeams.map((team) => team.team_id);

        if (teamIds.length === 0) {
          executeMainQuery();
        } else {
          db.query(
            `SELECT manufacturer_id FROM TeamManufacturers WHERE team_id IN (?)`,
            [teamIds],
            (err, teamManufacturers) => {
              if (err) {
                console.error('Error checking TeamManufacturers:', {
                  message: err.message,
                  sqlMessage: err.sqlMessage,
                  sqlState: err.sqlState,
                  code: err.code,
                });
                return res.status(500).json({
                  success: false,
                  message: 'خطأ أثناء التحقق من الشركات المصنعة',
                  error: err.message,
                  sqlMessage: err.sqlMessage,
                });
              }
              console.log('Team manufacturers:', teamManufacturers);
              executeMainQuery();
            }
          );
        }
      }
    );
  } else {
    executeMainQuery();
  }
});
// مسار جلب جميع المرتجعات
app.get('/api/returns', isAuthenticated, (req, res) => {
    console.log('GET /api/returns - User:', req.user);
    // التحقق من وجود req.user
    if (!req.user || !req.user.id || !req.user.role) {
        console.error('بيانات المستخدم غير صالحة:', req.user);
        return res.status(401).json({ message: 'بيانات المستخدم غير صالحة أو لم يتم تسجيل الدخول' });
    }
    let returnsQuery;
    let queryParams = [];
    try {
        if (req.user.role === 'مسؤول النظام' || req.user.role === 'مدير') {
            returnsQuery = `
                SELECT 
                    r.return_id,
                    r.order_id,
                    r.return_date,
                    r.status,
                    r.category,
                    r.attachment,
                    r.notes,
                    r.rejection_reason,
                    COALESCE(u.username, 'غير محدد') AS user_name
                FROM Returns r
                LEFT JOIN Orders o ON r.order_id = o.order_id
                LEFT JOIN Users u ON r.user_id = u.user_id
            `;
        } else if (req.user.role === 'مورد') {
            returnsQuery = `
                SELECT 
                    r.return_id,
                    r.order_id,
                    r.return_date,
                    r.status,
                    r.category,
                    r.attachment,
                    r.notes,
                    r.rejection_reason,
                    COALESCE(u.username, 'غير محدد') AS user_name
                FROM Returns r
                LEFT JOIN Orders o ON r.order_id = o.order_id
                LEFT JOIN Users u ON r.user_id = u.user_id
                WHERE o.supplier_id = ?
            `;
            queryParams = [req.user.id];
        } else if (req.user.role === 'موظف مستودع') {
            returnsQuery = `
                SELECT 
                    r.return_id,
                    r.order_id,
                    r.return_date,
                    r.status,
                    r.category,
                    r.attachment,
                    r.notes,
                    r.rejection_reason,
                    COALESCE(u.username, 'غير محدد') AS user_name
                FROM Returns r
                LEFT JOIN Orders o ON r.order_id = o.order_id
                LEFT JOIN Users u ON r.user_id = u.user_id
                WHERE r.status = 'موافق عليه'
            `;
        } else {
            returnsQuery = `
                SELECT 
                    r.return_id,
                    r.order_id,
                    r.return_date,
                    r.status,
                    r.category,
                    r.attachment,
                    r.notes,
                    r.rejection_reason,
                    COALESCE(u.username, 'غير محدد') AS user_name
                FROM Returns r
                LEFT JOIN Orders o ON r.order_id = o.order_id
                LEFT JOIN Users u ON r.user_id = u.user_id
                WHERE r.user_id = ?
            `;
            queryParams = [req.user.id];
        }
        console.log('تنفيذ استعلام جلب المرتجعات:', { query: returnsQuery, params: queryParams });
        db.query(returnsQuery, queryParams, (err, results) => {
            if (err) {
                console.error('خطأ في جلب المرتجعات:', {
                    message: err.message,
                    sqlMessage: err.sqlMessage || 'غير متوفر',
                    sqlState: err.sqlState || 'غير متوفر',
                    code: err.code || 'غير متوفر'
                });
                return res.status(500).json({
                    message: 'خطأ أثناء جلب المرتجعات',
                    error: err.message,
                    sqlMessage: err.sqlMessage || 'غير متوفر'
                });
            }
            console.log('تم جلب المرتجعات بنجاح:', { count: results.length });
            res.status(200).json(results);
        });
    } catch (error) {
        console.error('خطأ غير متوقع في معالجة المرتجعات:', error);
        res.status(500).json({ message: 'خطأ غير متوقع في الخادم', error: error.message });
    }
});
app.get('/api/inventory', isAuthenticated, (req, res) => {
    console.log('بيانات الجلسة في /api/inventory:', req.session);
    const user = req.session.user;

    // التحقق من وجود بيانات المستخدم
    if (!user || !user.id) {
        console.error('بيانات المستخدم مفقودة أو id غير موجود:', user);
        return res.status(401).json({ success: false, error: 'يرجى تسجيل الدخول للوصول إلى بيانات المخزون' });
    }

    // الاستعلام عن دور المستخدم من جدول Users
    db.query(`
        SELECT role 
        FROM Users 
        WHERE user_id = ?
    `, [user.id], (err, roleResults) => {
        if (err) {
            console.error('Error fetching user role:', err.message);
            return res.status(500).json({ success: false, error: 'فشل في جلب بيانات دور المستخدم' });
        }

        // التحقق مما إذا كان هناك دور للمستخدم
        if (roleResults.length === 0) {
            console.error('لا يوجد دور للمستخدم:', user);
            return res.status(400).json({ success: false, error: 'لا يوجد دور مرتبط بالمستخدم' });
        }

        const userRole = roleResults[0].role;
        const isAdmin = userRole === 'مسؤول النظام';

        if (isAdmin) {
            db.query(`
                SELECT 
                    a.aisle_id, a.aisle_name, a.team_id,
                    sh.shelf_id, sh.shelf_name,
                    sec.section_id, sec.section_name,
                    s.stock_id,
                    sp.stock_product_id, sp.product_id, sp.quantity, sp.initial_quantity, 
                    sp.expiration_date, sp.alert_entry_date
                FROM Aisles a
                LEFT JOIN Shelves sh ON a.aisle_id = sh.aisle_id
                LEFT JOIN Sections sec ON sh.shelf_id = sec.shelf_id
                LEFT JOIN Stock s ON sec.section_id = s.section_id
                LEFT JOIN StockProducts sp ON s.stock_id = sp.stock_id
            `, (err, results) => {
                if (err) {
                    console.error('Error fetching inventory:', err.message);
                    return res.status(500).json({ success: false, error: 'فشل جلب بيانات المخزون' });
                }

                const aisles = [];
                const aisleMap = new Map();

                results.forEach(row => {
                    let aisle = aisleMap.get(row.aisle_id);
                    if (!aisle) {
                        aisle = {
                            aisle_id: row.aisle_id,
                            aisle_name: row.aisle_name,
                            team_id: row.team_id,
                            shelves: [],
                        };
                        aisleMap.set(row.aisle_id, aisle);
                        aisles.push(aisle);
                    }

                    let shelf = aisle.shelves.find(s => s.shelf_id === row.shelf_id);
                    if (!shelf && row.shelf_id) {
                        shelf = {
                            shelf_id: row.shelf_id,
                            shelf_name: row.shelf_name,
                            sections: [],
                        };
                        aisle.shelves.push(shelf);
                    }

                    let section = shelf?.sections.find(sec => sec.section_id === row.section_id);
                    if (!section && row.section_id) {
                        section = {
                            section_id: row.section_id,
                            section_name: row.section_name,
                            stock: null,
                        };
                        shelf.sections.push(section);
                    }

                    if (section && row.stock_id) {
                        if (!section.stock) {
                            section.stock = {
                                stock_id: row.stock_id,
                                products: [],
                                lowStock: false,
                            };
                        }
                        if (row.stock_product_id) {
                            const product = {
                                stock_product_id: row.stock_product_id,
                                product_id: row.product_id,
                                quantity: row.quantity,
                                initial_quantity: row.initial_quantity,
                                expiration_date: row.expiration_date,
                                alert_entry_date: row.alert_entry_date,
                            };
                            section.stock.products.push(product);

                            // التحقق من المخزون المنخفض
                            const initial = Number(row.initial_quantity) || 0;
                            const quantity = Number(row.quantity) || 0;
                            const isLowStock = initial > 0 && quantity > 0 && quantity <= initial * 0.15;
                            console.log(`Product ${row.product_id}: initial=${initial}, quantity=${quantity}, lowStock=${isLowStock}`);
                            if (isLowStock) {
                                section.stock.lowStock = true;
                            }
                        }
                    }
                });

                res.json({ success: true, aisles });
            });
        } else {
            db.query(`
                SELECT team_id 
                FROM UserTeams 
                WHERE user_id = ?
            `, [user.id], (err, teamResults) => {
                if (err) {
                    console.error('Error fetching user teams:', err.message);
                    return res.status(500).json({ success: false, error: 'فشل في جلب بيانات الفريق' });
                }

                if (teamResults.length === 0) {
                    console.error('لا يوجد فريق مرتبط بالمستخدم:', user);
                    return res.status(400).json({ success: false, error: 'المستخدم غير مرتبط بأي فريق' });
                }

                const teamIds = teamResults.map(row => row.team_id);

                db.query(`
                    SELECT 
                        a.aisle_id, a.aisle_name, a.team_id,
                        sh.shelf_id, sh.shelf_name,
                        sec.section_id, sec.section_name,
                        s.stock_id,
                        sp.stock_product_id, sp.product_id, sp.quantity, sp.initial_quantity, 
                        sp.expiration_date, sp.alert_entry_date
                    FROM Aisles a
                    LEFT JOIN Shelves sh ON a.aisle_id = sh.aisle_id
                    LEFT JOIN Sections sec ON sh.shelf_id = sec.shelf_id
                    LEFT JOIN Stock s ON sec.section_id = s.section_id
                    LEFT JOIN StockProducts sp ON s.stock_id = sp.stock_id
                    WHERE a.team_id IN (?)
                `, [teamIds], (err, results) => {
                    if (err) {
                        console.error('Error fetching inventory:', err.message);
                        return res.status(500).json({ success: false, error: 'فشل جلب المخزون' });
                    }

                    const aisles = [];
                    const aisleMap = new Map();

                    results.forEach(row => {
                        let aisle = aisleMap.get(row.aisle_id);
                        if (!aisle) {
                            aisle = {
                                aisle_id: row.aisle_id,
                                aisle_name: row.aisle_name,
                                team_id: row.team_id,
                                shelves: [],
                            };
                            aisleMap.set(row.aisle_id, aisle);
                            aisles.push(aisle);
                        }

                        let shelf = aisle.shelves.find(s => s.shelf_id === row.shelf_id);
                        if (!shelf && row.shelf_id) {
                            shelf = {
                                shelf_id: row.shelf_id,
                                shelf_name: row.shelf_name,
                                sections: [],
                            };
                            aisle.shelves.push(shelf);
                        }

                        let section = shelf?.sections.find(sec => sec.section_id === row.section_id);
                        if (!section && row.section_id) {
                            section = {
                                section_id: row.section_id,
                                section_name: row.section_name,
                                stock: null,
                            };
                            shelf.sections.push(section);
                        }

                        if (section && row.stock_id) {
                            if (!section.stock) {
                                section.stock = {
                                    stock_id: row.stock_id,
                                    products: [],
                                    lowStock: false,
                                };
                            }
                            if (row.stock_product_id) {
                                const product = {
                                    stock_product_id: row.stock_product_id,
                                    product_id: row.product_id,
                                    quantity: row.quantity,
                                    initial_quantity: row.initial_quantity,
                                    expiration_date: row.expiration_date,
                                    alert_entry_date: row.alert_entry_date,
                                };
                                section.stock.products.push(product);

                                // التحقق من المخزون المنخفض
                                const initial = Number(row.initial_quantity) || 0;
                                const quantity = Number(row.quantity) || 0;
                                const isLowStock = initial > 0 && quantity > 0 && quantity <= initial * 0.15;
                                console.log(` ${row.product_id}: ${initial}, ${quantity}, ${isLowStock}`);
                                if (isLowStock) {
                                    section.stock.lowStock = true;
                                }
                            }
                        }
                    });

                    res.json({ success: true, aisles });
                });
            });
        }
    });
});

// New endpoint to fetch damaged items
app.get('/api/damaged-items', (_req, res) => {
    db.query(`
        SELECT di.damage_id, di.product_id, di.section_id, di.quantity, di.damage_type, di.damage_reason, di.damage_date,
               p.product_name, sec.section_name
        FROM DamagedItems di
        LEFT JOIN Products p ON di.product_id = p.product_id
        LEFT JOIN Sections sec ON di.section_id = sec.section_id
    `, (err, results) => {
        if (err) {
            console.error('Error fetching damaged items:', err.message);
            return res.status(500).json({ success: false, error: 'فشل جلب بيانات المنتجات المتلفة' });
        }
        res.json({ success: true, damagedItems: results });
    });
});
// New endpoint to move product to damaged items
app.post('/api/damaged-items', isAuthenticated, (req, res) => {
  const {
    stock_product_id,
    product_id,
    section_id,
    quantity,
    damage_type,
    damage_reason,
    reported_by,
    price = 0 // قيمة افتراضية لـ price
  } = req.body;

  // التحقق من الحقول المطلوبة
  if (!stock_product_id || !product_id || !section_id || !quantity || !damage_type || !reported_by) {
    return res.status(400).json({ success: false, error: 'جميع الحقول المطلوبة يجب أن تكون موجودة' });
  }

  // التحقق من أن الكمية صحيحة
  if (quantity <= 0) {
    return res.status(400).json({ success: false, error: 'الكمية يجب أن تكون أكبر من الصفر' });
  }

  // بدء المعاملة
  db.beginTransaction(err => {
    if (err) {
      console.error('خطأ في بدء المعاملة:', err);
      return res.status(500).json({ success: false, error: 'خطأ في بدء معاملة قاعدة البيانات' });
    }

    // 1. جلب سعر المنتج والتحقق من المخزون
    const getProductQuery = `
      SELECT p.price, sp.quantity 
      FROM Products p
      JOIN StockProducts sp ON p.product_id = sp.product_id
      WHERE sp.stock_product_id = ? AND sp.product_id = ? AND sp.quantity >= ?
      FOR UPDATE
    `;

    db.query(getProductQuery, [stock_product_id, product_id, quantity], (err, results) => {
      if (err) {
        return db.rollback(() => {
          console.error('خطأ في جلب بيانات المنتج:', err);
          res.status(500).json({ success: false, error: 'خطأ في جلب بيانات المنتج', sqlError: err.sqlMessage });
        });
      }

      if (results.length === 0) {
        return db.rollback(() => {
          res.status(404).json({ success: false, error: 'المنتج غير موجود أو الكمية غير كافية' });
        });
      }

      const productPrice = results[0].price || price; // استخدام price من الـ frontend إذا السعر من الـ DB ما لقيته
      const currentQuantity = results[0].quantity;

      // 2. تسجيل الإتلاف باستخدام استعلام كامل
      const insertDamageQuery = `
        INSERT INTO DamagedItems (
          stock_product_id,
          product_id,
          section_id,
          quantity,
          damage_type,
          damage_reason,
          reported_by,
          price,
          damage_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      db.query(insertDamageQuery, [
        stock_product_id,
        product_id,
        section_id,
        quantity,
        damage_type,
        damage_reason || null,
        reported_by,
        productPrice,
      ], (err, result) => {
        if (err) {
          return db.rollback(() => {
            console.error('خطأ في تسجيل الإتلاف:', {
              message: err.message,
              sqlMessage: err.sqlMessage,
              sqlState: err.sqlState,
              code: err.code
            });
            res.status(500).json({ success: false, error: 'خطأ في تسجيل الإتلاف', sqlError: err.sqlMessage });
          });
        }

        // 3. تحديث المخزون
        const newQuantity = currentQuantity - quantity;
        if (newQuantity > 0) {
          const updateStockQuery = 'UPDATE StockProducts SET quantity = ? WHERE stock_product_id = ?';
          db.query(updateStockQuery, [newQuantity, stock_product_id], (err) => {
            if (err) {
              return db.rollback(() => {
                console.error('خطأ في تحديث المخزون:', err);
                res.status(500).json({ success: false, error: 'تم تسجيل الإتلاف ولكن حدث خطأ في تحديث المخزون', sqlError: err.sqlMessage });
              });
            }
            
            db.commit(err => {
              if (err) {
                return db.rollback(() => {
                  console.error('خطأ في تأكيد المعاملة:', err);
                  res.status(500).json({ success: false, error: 'خطأ في تأكيد المعاملة' });
                });
              }
              res.json({ success: true, message: 'تم تسجيل الإتلاف وتحديث المخزون بنجاح', damage_id: result.insertId });
            });
          });
        } else {
          const deleteStockQuery = 'DELETE FROM StockProducts WHERE stock_product_id = ?';
          db.query(deleteStockQuery, [stock_product_id], (err) => {
            if (err) {
              return db.rollback(() => {
                console.error('خطأ في حذف المنتج من المخزون:', err);
                res.status(500).json({ success: false, error: 'تم تسجيل الإتلاف ولكن حدث خطأ في حذف المنتج من المخزون', sqlError: err.sqlMessage });
              });
            }
            
            db.commit(err => {
              if (err) {
                return db.rollback(() => {
                  console.error('خطأ في تأكيد المعاملة:', err);
                  res.status(500).json({ success: false, error: 'خطأ في تأكيد المعاملة' });
                });
              }
              res.json({ success: true, message: 'تم تسجيل الإتلاف وحذف المنتج من المخزون بنجاح', damage_id: result.insertId });
            });
          });
        }
      });
    });
  });
});
app.post('/api/transfer-to-store', isAuthenticated, (req, res) => {
    const {
        stock_product_id,
        product_id,
        from_section_id,
        quantity,
        transfer_date,
        notes,
        transferred_by
    } = req.body;

    // التحقق من الحقول المطلوبة
    if (!stock_product_id || !product_id || !from_section_id || !quantity || !transfer_date || !transferred_by) {
        return res.status(400).json({ success: false, error: 'جميع الحقول المطلوبة يجب أن تكون موجودة' });
    }

    // التحقق من أن الكمية صحيحة
    if (quantity <= 0) {
        return res.status(400).json({ success: false, error: 'الكمية يجب أن تكون أكبر من الصفر' });
    }

    // بدء المعاملة
    db.beginTransaction(err => {
        if (err) {
            console.error('خطأ في بدء المعاملة:', err);
            return res.status(500).json({ success: false, error: 'خطأ في بدء معاملة قاعدة البيانات' });
        }

        // 1. التحقق من توفر الكمية في المخزون
        const getStockQuery = `
            SELECT sp.quantity, sp.stock_id
            FROM StockProducts sp
            WHERE sp.stock_product_id = ? AND sp.product_id = ? AND sp.quantity >= ?
            FOR UPDATE
        `;

        db.query(getStockQuery, [stock_product_id, product_id, quantity], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    console.error('خطأ في جلب بيانات المخزون:', err);
                    res.status(500).json({ success: false, error: 'خطأ في جلب بيانات المخزون', sqlError: err.sqlMessage });
                });
            }

            if (results.length === 0) {
                return db.rollback(() => {
                    res.status(404).json({ success: false, error: 'المنتج غير موجود أو الكمية غير كافية' });
                });
            }

            const currentQuantity = results[0].quantity;
            const stockId = results[0].stock_id;

            // 2. تسجيل النقل
            const insertTransferQuery = `
                INSERT INTO StoreTransfers (
                    stock_product_id,
                    product_id,
                    from_section_id,
                    quantity,
                    transfer_date,
                    notes,
                    transferred_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(insertTransferQuery, [
                stock_product_id,
                product_id,
                from_section_id,
                quantity,
                transfer_date,
                notes || null,
                transferred_by
            ], (err, result) => {
                if (err) {
                    return db.rollback(() => {
                        console.error('خطأ في تسجيل النقل:', {
                            message: err.message,
                            sqlMessage: err.sqlMessage,
                            sqlState: err.sqlState,
                            code: err.code
                        });
                        res.status(500).json({ success: false, error: 'خطأ في تسجيل النقل', sqlError: err.sqlMessage });
                    });
                }

                // 3. تحديث أو حذف المخزون
                const newQuantity = currentQuantity - quantity;
                if (newQuantity > 0) {
                    const updateStockQuery = `
                        UPDATE StockProducts 
                        SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
                        WHERE stock_product_id = ?
                    `;
                    db.query(updateStockQuery, [newQuantity, stock_product_id], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('خطأ في تحديث المخزون:', err);
                                res.status(500).json({ success: false, error: 'تم تسجيل النقل ولكن حدث خطأ في تحديث المخزون', sqlError: err.sqlMessage });
                            });
                        }
                        updateStockTotal();
                    });
                } else {
                    const deleteStockQuery = 'DELETE FROM StockProducts WHERE stock_product_id = ?';
                    db.query(deleteStockQuery, [stock_product_id], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('خطأ في حذف المنتج من المخزون:', err);
                                res.status(500).json({ success: false, error: 'تم تسجيل النقل ولكن حدث خطأ في حذف المنتج من المخزون', sqlError: err.sqlMessage });
                            });
                        }
                        updateStockTotal();
                    });
                }

                // 4. تحديث إجمالي المخزون في جدول Stock
                function updateStockTotal() {
                    const updateStockTotalQuery = `
                        UPDATE Stock 
                        SET total_quantity = total_quantity - ?, last_updated = CURRENT_TIMESTAMP 
                        WHERE stock_id = ?
                    `;
                    db.query(updateStockTotalQuery, [quantity, stockId], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('خطأ في تحديث إجمالي المخزون:', err);
                                res.status(500).json({ success: false, error: 'تم تسجيل النقل ولكن حدث خطأ في تحديث إجمالي المخزون', sqlError: err.sqlMessage });
                            });
                        }

                        // تأكيد المعاملة
                        db.commit(err => {
                            if (err) {
                                return db.rollback(() => {
                                    console.error('خطأ في تأكيد المعاملة:', err);
                                    res.status(500).json({ success: false, error: 'خطأ في تأكيد المعاملة' });
                                });
                            }
                            res.json({ success: true, message: 'تم النقل إلى المتجر وتحديث المخزون بنجاح', transfer_id: result.insertId });
                        });
                    });
                }
            });
        });
    });
});
app.get('/api/transfer-to-store', isAuthenticated, (req, res) => {
    const { section_id, product_id } = req.query;

    let query = `
        SELECT st.transfer_id, st.stock_product_id, st.product_id, st.from_section_id, st.quantity, 
               st.transfer_date, st.notes, st.transferred_by, st.created_at,
               p.product_name, sec.section_name, u.username AS transferred_by_name
        FROM StoreTransfers st
        LEFT JOIN Products p ON st.product_id = p.product_id
        LEFT JOIN Sections sec ON st.from_section_id = sec.section_id
        LEFT JOIN Users u ON st.transferred_by = u.user_id
    `;
    const queryParams = [];

    // إضافة شروط التصفية إذا وجدت
    const conditions = [];
    if (section_id) {
        conditions.push('st.from_section_id = ?');
        queryParams.push(section_id);
    }
    if (product_id) {
        conditions.push('st.product_id = ?');
        queryParams.push(product_id);
    }
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching transfers:', err.message);
            return res.status(500).json({ success: false, error: 'فشل جلب سجلات النقل' });
        }
        res.json({ success: true, transfers: results });
    });
});
// لصفحة ادارة المخازن 
app.get('/api/team', (_req, res) => {
    db.query('SELECT team_id, team_name FROM Teams WHERE status = "Active"', (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, teams: rows });
    });
});
// POST /api/aisles
app.post('/api/aisles', (req, res) => {
    const { aisle_name, team_id } = req.body;
    if (!aisle_name || !team_id) {
        return res.status(400).json({ success: false, error: 'اسم الممر ومعرف الفريق مطلوبان' });
    }
    db.query('INSERT INTO Aisles (aisle_name, team_id) VALUES (?, ?)', [aisle_name, team_id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true });
    });
});
app.post('/api/shelves', (req, res) => {
    const { shelf_name, aisle_id } = req.body;
    if (!shelf_name || !aisle_id) {
        return res.status(400).json({ success: false, error: 'اسم الرف ومعرف الممر مطلوبان' });
    }
    db.query('INSERT INTO Shelves (shelf_name, aisle_id) VALUES (?, ?)', [shelf_name, aisle_id], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, shelf_id: result.insertId });
    });
});
// Add section
app.post('/api/sections', (req, res) => {
    const { section_name, shelf_id } = req.body;
    if (!section_name || !shelf_id) {
        return res.status(400).json({ success: false, error: 'اسم القسم ومعرف الرف مطلوبان' });
    }
    db.query('INSERT INTO Sections (section_name, shelf_id) VALUES (?, ?)', [section_name, shelf_id], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, section_id: result.insertId });
    });
});
app.get('/api/orders-stock', (req, res) => {
  db.query(
    `SELECT DISTINCT o.order_id, o.status 
     FROM Orders o
     LEFT JOIN Returns r ON o.order_id = r.order_id
     LEFT JOIN OrderItems oi ON o.order_id = oi.order_id
     LEFT JOIN ReturnItems ri ON oi.order_item_id = ri.order_item_id AND ri.return_id = r.return_id
     WHERE o.status = 'مكتمل' 
     AND (r.order_id IS NULL OR r.status = 'مرفوض' OR (
       r.return_type = 'partial' 
       AND EXISTS (
         SELECT 1 
         FROM OrderItems oi2 
         WHERE oi2.order_id = o.order_id 
         AND (oi2.order_item_id NOT IN (
           SELECT ri2.order_item_id 
           FROM ReturnItems ri2 
           JOIN Returns r2 ON ri2.return_id = r2.return_id 
           WHERE r2.order_id = o.order_id 
           AND r2.status != 'مرفوض'
         ) OR (
           SELECT COALESCE(SUM(ri2.quantity), 0)
           FROM ReturnItems ri2 
           JOIN Returns r2 ON ri2.return_id = r2.return_id 
           WHERE ri2.order_item_id = oi2.order_item_id 
           AND r2.order_id = o.order_id 
           AND r2.status != 'مرفوض'
         ) < oi2.quantity)
       )
     ))`,
    [],
    (err, results) => {
      if (err) {
        console.error('Error fetching orders:', err);
        return res.status(500).json({ success: false, error: 'فشل جلب الطلبات' });
      }
      res.json({ success: true, orders: results });
    }
  );
});
app.get('/api/stock-products', (req, res) => {
    const section_id = req.query.section_id;
    // Validate section_id
    if (!section_id) {
        console.error('Missing section_id in query parameters');
        return res.status(400).json({ success: false, error: 'معرف القسم مطلوب' });
    }
    const sectionIdNum = parseInt(section_id);
    if (isNaN(sectionIdNum)) {
        console.error('Invalid section_id:', section_id);
        return res.status(400).json({ success: false, error: 'معرف القسم يجب أن يكون رقمًا' });
    }
    db.query(
        `SELECT sp.*, p.product_name, s.initial_quantity, s.total_quantity
         FROM StockProducts sp
         JOIN Products p ON sp.product_id = p.product_id
         JOIN Stock s ON sp.stock_id = s.stock_id
         WHERE s.section_id = ?`,
        [sectionIdNum],
        (err, results) => {
            if (err) {
                console.error('Database error on SELECT StockProducts:', err);
                return res.status(500).json({ success: false, error: 'خطأ في قاعدة البيانات: ' + err.message });
            }
            console.log('Fetched stock products:', results);
            res.json({ success: true, stockProducts: results });
        }
    );
});
// Add a stock product
app.post('/api/stock-products', isAuthenticated,  (req, res) => {
    const { section_id, order_id, product_id, quantity, manufacturing_date, expiration_date, alert_entry_date, stock_entry_date } = req.body;

    // التحقق من الحقول المطلوبة
    if (!section_id || isNaN(parseInt(section_id)) || !order_id || !product_id || !quantity || quantity <= 0) {
        return res.status(400).json({ success: false, error: 'جميع الحقول المطلوبة يجب أن تكون موجودة وصالحة' });
    }

    // بدء المعاملة
    db.beginTransaction(err => {
        if (err) {
            console.error('خطأ في بدء المعاملة:', err);
            return res.status(500).json({ success: false, error: 'خطأ في بدء معاملة قاعدة البيانات' });
        }

        // 1. التحقق من وجود القسم
        db.query(
            'SELECT section_id FROM Sections WHERE section_id = ?',
            [section_id],
            (err, sectionRows) => {
                if (err) {
                    return db.rollback(() => {
                        console.error('خطأ في التحقق من القسم:', err);
                        res.status(500).json({ success: false, error: 'خطأ في التحقق من القسم', sqlError: err.sqlMessage });
                    });
                }
                if (sectionRows.length === 0) {
                    return db.rollback(() => {
                        res.status(404).json({ success: false, error: 'القسم غير موجود' });
                    });
                }

                // 2. التحقق من وجود المخزون أو إنشاؤه
                db.query(
                    'SELECT stock_id FROM Stock WHERE section_id = ?',
                    [section_id],
                    (err, stockRows) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('خطأ في جلب المخزون:', err);
                                res.status(500).json({ success: false, error: 'خطأ في جلب المخزون', sqlError: err.sqlMessage });
                            });
                        }

                        let stockId;

                        if (stockRows.length === 0) {
                            // إنشاء سجل مخزون جديد
                            db.query(
                                'INSERT INTO Stock (section_id, total_quantity, initial_quantity) VALUES (?, ?, ?)',
                                [section_id, quantity, quantity],
                                (err, result) => {
                                    if (err) {
                                        return db.rollback(() => {
                                            console.error('خطأ في إنشاء المخزون:', err);
                                            res.status(500).json({ success: false, error: 'فشل إنشاء المخزون', sqlError: err.sqlMessage });
                                        });
                                    }
                                    stockId = result.insertId;
                                    proceedWithStockProduct(stockId);
                                }
                            );
                        } else {
                            stockId = stockRows[0].stock_id;
                            proceedWithStockProduct(stockId);
                        }

                        function proceedWithStockProduct(stockId) {
                            // 3. التحقق من الكمية المتبقية في OrderItems
                            db.query(
                                'SELECT quantity, COALESCE(stocked_quantity, 0) AS stocked_quantity FROM OrderItems WHERE order_id = ? AND product_id = ?',
                                [order_id, product_id],
                                (err, orderItemRows) => {
                                    if (err) {
                                        return db.rollback(() => {
                                            console.error('خطأ في جلب عنصر الطلب:', err);
                                            res.status(500).json({ success: false, error: 'خطأ في جلب عنصر الطلب', sqlError: err.sqlMessage });
                                        });
                                    }
                                    if (orderItemRows.length === 0) {
                                        return db.rollback(() => {
                                            res.status(404).json({ success: false, error: 'عنصر الطلب غير موجود' });
                                        });
                                    }
                                    const { quantity: totalQuantity, stocked_quantity } = orderItemRows[0];
                                    const remainingQuantity = totalQuantity - stocked_quantity;
                                    if (quantity > remainingQuantity) {
                                        return db.rollback(() => {
                                            res.status(400).json({ success: false, error: `الكمية تتجاوز المتبقي (${remainingQuantity})` });
                                        });
                                    }

                                    // 4. إدراج المنتج في StockProducts مع initial_quantity
                                    db.query(
                                     `INSERT INTO StockProducts (
        stock_id, product_id, order_id, quantity, initial_quantity,
        manufacturing_date, expiration_date, alert_entry_date, stock_entry_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        stockId,
        product_id,
        order_id,
        quantity,
        quantity,// initial_quantity = quantity
        manufacturing_date || null,
        expiration_date || null,
        alert_entry_date || null,
        stock_entry_date || null
    ],
                                        (err, result) => {
                                            if (err) {
                                                return db.rollback(() => {
                                                    console.error('خطأ في إدراج المنتج في المخزون:', err);
                                                    res.status(500).json({ success: false, error: 'فشل إدراج المنتج في المخزون', sqlError: err.sqlMessage });
                                                });
                                            }

                                            // 5. تحديث stocked_quantity في OrderItems
                                            const newStockedQuantity = stocked_quantity + quantity;
                                            db.query(
                                                'UPDATE OrderItems SET stocked_quantity = ? WHERE order_id = ? AND product_id = ?',
                                                [newStockedQuantity, order_id, product_id],
                                                (err) => {
                                                    if (err) {
                                                        return db.rollback(() => {
                                                            console.error('خطأ في تحديث الكمية المخزنة:', err);
                                                            res.status(500).json({ success: false, error: 'فشل تحديث الكمية المخزنة', sqlError: err.sqlMessage });
                                                        });
                                                    }

                                                    // 6. تحديث total_quantity و initial_quantity في Stock
                                                    db.query(
                                                        `UPDATE Stock 
                                                         SET total_quantity = total_quantity + ?, 
                                                             initial_quantity = initial_quantity + ? 
                                                         WHERE stock_id = ?`,
                                                        [quantity, quantity, stockId],
                                                        (err) => {
                                                            if (err) {
                                                                return db.rollback(() => {
                                                                    console.error('خطأ في تحديث إجمالي المخزون:', err);
                                                                    res.status(500).json({ success: false, error: 'فشل تحديث إجمالي المخزون', sqlError: err.sqlMessage });
                                                                });
                                                            }

                                                            // تأكيد المعاملة
                                                            db.commit(err => {
                                                                if (err) {
                                                                    return db.rollback(() => {
                                                                        console.error('خطأ في تأكيد المعاملة:', err);
                                                                        res.status(500).json({ success: false, error: 'خطأ في تأكيد المعاملة' });
                                                                    });
                                                                }
                                                                res.status(201).json({ success: true, stock_product_id: result.insertId });
                                                            });
                                                        }
                                                    );
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    }
                );
            }
        );
    });
});

  // === المسارات الديناميكية ===
app.get("/users/:id", isAuthenticated, (req, res) => {
  const userId = req.params.id;
  db.query(
    "SELECT user_id, username, email, phone_number, role, status FROM Users WHERE user_id = ?",
    [userId],
    (err, results) => {
      if (err || results.length === 0)
        return res.status(404).json({ message: "المستخدم غير موجود" });
      res.json(results[0]);
    }
  );
});
app.put("/users/:id", isAuthenticated, (req, res) => {
  const userId = req.params.id;
  const { username, email, phone_number, role, status, suppliername, address } = req.body;
  db.query(
    "SELECT * FROM Users WHERE user_id = ?",
    [userId],
    (err, results) => {
      if (err || results.length === 0)
        return res.status(404).json({ message: "المستخدم غير موجود" });
      const current = results[0];
      const updates = {};
      if (username && username !== current.username) updates.username = username;
      if (email && email !== current.email) updates.email = email;
      if (phone_number && phone_number !== current.phone_number)
        updates.phone_number = phone_number;
      if (role && role !== current.role) updates.role = role;
      if (status && status !== current.status) updates.status = status;
      if (Object.keys(updates).length === 0) {
        return res.json({ message: "لا توجد تغييرات لتحديثها" });
      }
      let query = "UPDATE Users SET ";
      const params = [];
      Object.keys(updates).forEach((key, index) => {
        query += `${key} = ?${index < Object.keys(updates).length - 1 ? ", " : ""}`;
        params.push(updates[key]);
      });
      query += " WHERE user_id = ?";
      params.push(userId);
      db.query(query, params, (err) => {
        if (err) {
          console.error("خطأ في تعديل المستخدم:", err);
          return res
            .status(500)
            .json({ message: "خطأ أثناء تعديل المستخدم" });
        }
        const finalUsername = username || current.username;
        const finalEmail = email || current.email;
        const finalPhone = phone_number || current.phone_number;
        const finalStatus = status || current.status;
        const finalRole = role || current.role; // استخدام الدور الحالي إذا لم يتم إرسال دور جديد
        if (finalRole === "مورد") {
          const supplierUpdateQuery = `
            INSERT INTO Suppliers (supplier_id, suppliername, email, phone_number, address, status) 
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
              suppliername = VALUES(suppliername),
              email = VALUES(email), 
              phone_number = VALUES(phone_number),
              address = VALUES(address),
              status = VALUES(status)
          `;
          db.query(
            supplierUpdateQuery,
            [userId, suppliername || finalUsername, finalEmail, finalPhone, address || null, finalStatus],
            (err) => {
              if (err) {
                console.error("خطأ في تحديث المورد:", err);
                return res.status(500).json({
                  message: "خطأ أثناء تحديث المورد",
                  error: err.message,
                });
              }
              res.json({ message: "تم تعديل المستخدم وبيانات المورد بنجاح" });
            }
          );
        } else if (current.role === "مورد" && role && role !== "مورد") {
          db.query(
            "SELECT COUNT(*) AS order_count FROM Orders WHERE supplier_id = ?",
            [userId],
            (err, results) => {
              if (err) {
                console.error("خطأ في التحقق من الطلبات:", err);
                return res.status(500).json({ message: "خطأ أثناء التحقق من الطلبات" });
              }
              if (results[0].order_count > 0) {
                return res.status(400).json({ 
                  message: "لا يمكن حذف بيانات المورد لوجود طلبات مرتبطة" 
                });
              }
              db.query(
                "DELETE FROM Suppliers WHERE supplier_id = ?",
                [userId],
                (err) => {
                  if (err) {
                    console.error("خطأ في حذف المورد:", err);
                    return res.status(500).json({
                      message: "خطأ أثناء حذف المورد",
                      error: err.message,
                    });
                  }
                  res.json({ message: "تم تعديل المستخدم وحذف بيانات المورد بنجاح" });
                }
              );
            }
          );
        } else {
          res.json({ message: "تم تعديل المستخدم بنجاح" });
        }
      });
    }
  );
});
app.delete("/users/:id", isAuthenticated, (req, res) => {
  const userId = req.params.id;
  db.query("DELETE FROM Users WHERE user_id = ?", [userId], (err) => {
    if (err)
      return res.status(500).json({ message: "خطأ أثناء حذف المستخدم" });
    res.json({ message: "تم حذف المستخدم بنجاح" });
  });
});
app.post("/reset-password/:id", isAuthenticated, async (req, res) => {
  const userId = req.params.id;
  const { newPassword } = req.body;
  if (!newPassword)
    return res
      .status(400)
      .json({ message: "كلمة المرور الجديدة مطلوبة" });
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.query(
      "UPDATE Users SET password_hash = ? WHERE user_id = ?",
      [hashedPassword, userId],
      (err) => {
        if (err) {
          console.error("خطأ في إعادة تعيين كلمة المرور:", err);
          return res
            .status(500)
            .json({ message: "خطأ أثناء إعادة تعيين كلمة المرور" });
        }
        res.json({ message: "تم إعادة تعيين كلمة المرور بنجاح" });
      }
    );
  } catch (error) {
    console.error("خطأ في تشفير كلمة المرور:", error);
    return res
      .status(500)
      .json({ message: "خطأ في الخادم أثناء تشفير كلمة المرور" });
  }
});
app.put("/api/suppliers/:id", isAuthenticated, (req, res) => {
    const supplierId = req.params.id;
    const { address } = req.body;
    const query = "UPDATE Suppliers SET address = ? WHERE supplier_id = ?";
    db.query(query, [address, supplierId], (err) => {
      if (err) {
        console.error("خطأ في تعديل العنوان:", err);
        return res.status(500).json({ message: "خطأ أثناء تعديل العنوان" });
      }
      res.json({ message: "تم تعديل العنوان بنجاح" });
    });
  });
  app.get("/api/suppliers/:id/orders", isAuthenticated, (req, res) => {
    const supplierId = req.params.id;
    const query = `
      SELECT 
        order_id, 
        supplier_id, 
        order_date, 
        amount, 
        payment_status, 
        payment_terms,
        delivery_status 
      FROM Orders 
      WHERE supplier_id = ?
    `;
    db.query(query, [supplierId], (err, results) => {
      if (err) {
        console.error("خطأ في جلب الطلبات:", err);
        return res.status(500).json({ message: "خطأ أثناء جلب الطلبات" });
      }
      res.json(results);
    });
  });
// جلب تفاصيل مجموعة معينة
  app.get('/api/teams/:id', isAuthenticated, isSystemAdmin, (req, res) => {
  const teamId = req.params.id;
  const query = `
    SELECT 
      team_id, 
      team_name, 
      description, 
      status, 
      created_at, 
      updated_at
    FROM Teams
    WHERE team_id = ?
  `;
  db.query(query, [teamId], (err, results) => {
    if (err) {
      console.error('خطأ في جلب تفاصيل المجموعة:', {
        message: err.message,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState,
        code: err.code,
      });
      return res.status(500).json({ 
        message: 'خطأ أثناء جلب تفاصيل المجموعة', 
        error: err.message, 
        sqlMessage: err.sqlMessage 
      });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'المجموعة غير موجودة' });
    }
    res.json(results[0]);
  });
});
// تعديل مجموعة
app.put('/api/teams/:id', isAuthenticated, isSystemAdmin, (req, res) => {
  const teamId = req.params.id;
  const { team_name, description, status } = req.body;
  if (!team_name) {
    return res.status(400).json({ message: 'اسم المجموعة مطلوب' });
  }
  const query = 'UPDATE Teams SET team_name = ?, description = ?, status = ? WHERE team_id = ?';
  const statusValue = status && ['Active', 'Inactive'].includes(status) ? status : 'Active';
  db.query(query, [team_name, description || null, statusValue, teamId], (err, result) => {
    if (err) {
      console.error('خطأ في تعديل المجموعة:', {
        message: err.message,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState,
        code: err.code,
      });
      return res.status(500).json({ 
        message: 'خطأ أثناء تعديل المجموعة', 
        error: err.message, 
        sqlMessage: err.sqlMessage 
      });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'المجموعة غير موجودة' });
    }
    res.json({ message: 'تم تعديل المجموعة بنجاح' });
  });
});
app.delete('/api/teams/:id', isAuthenticated, isSystemAdmin, (req, res) => {
  const teamId = req.params.id;
  const query = 'DELETE FROM Teams WHERE team_id = ?';
  db.query(query, [teamId], (err, result) => {
    if (err) {
      console.error('خطأ في حذف المجموعة:', {
        message: err.message,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState,
        code: err.code,
      });
      return res.status(500).json({ 
        message: 'خطأ أثناء حذف المجموعة', 
        error: err.message, 
        sqlMessage: err.sqlMessage 
      });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'المجموعة غير موجودة' });
    }
    res.json({ message: 'تم حذف المجموعة بنجاح' });
  });
});
// إضافة أو تعديل أعضاء المجموعة
app.get('/api/teams/:team_id/members', isAuthenticated, (req, res) => {
  const teamId = req.params.team_id;
  const query = `
    SELECT u.user_id, u.username 
    FROM Users u
    INNER JOIN UserTeams ut ON u.user_id = ut.user_id
    WHERE ut.team_id = ?
  `;
  db.query(query, [teamId], (err, results) => {
    if (err) {
      console.error('خطأ في جلب أعضاء المجموعة:', err);
      return res.status(500).json({ 
        message: 'فشل في جلب أعضاء المجموعة', 
        error: err.message 
      });
    }
    res.json(results);
  });
});
// جلب أعضاء المجموعة
app.get('/api/teams/:id/members', isAuthenticated, isSystemAdmin, (req, res) => {
  const teamId = req.params.id;
  const query = `
    SELECT 
      u.user_id, 
      u.username, 
      u.email, 
      u.role
    FROM Users u
    JOIN UserTeams ut ON u.user_id = ut.user_id
    WHERE ut.team_id = ?
  `;
  db.query(query, [teamId], (err, results) => {
    if (err) {
      console.error('خطأ في جلب أعضاء المجموعة:', {
        message: err.message,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState,
        code: err.code,
      });
      return res.status(500).json({ 
        message: 'خطأ أثناء جلب أعضاء المجموعة', 
        error: err.message, 
        sqlMessage: err.sqlMessage 
      });
    }
    res.json(results);
  });
});
app.post('/api/teams/:teamId/users', isAuthenticated, isSystemAdmin, (req, res) => {
  const teamId = req.params.teamId;
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ message: 'معرف المستخدم مطلوب' });
  }
  // التحقق من وجود المجموعة
  const checkTeamQuery = 'SELECT team_id FROM Teams WHERE team_id = ?';
  db.query(checkTeamQuery, [teamId], (err, teamResults) => {
    if (err) {
      console.error('خطأ في التحقق من المجموعة:', err);
      return res.status(500).json({ message: 'خطأ في الخادم', error: err.message });
    }
    if (teamResults.length === 0) {
      return res.status(404).json({ message: 'المجموعة غير موجودة' });
    }
    // التحقق من وجود المستخدم
    const checkUserQuery = 'SELECT user_id FROM Users WHERE user_id = ?';
    db.query(checkUserQuery, [user_id], (err, userResults) => {
      if (err) {
        console.error('خطأ في التحقق من المستخدم:', err);
        return res.status(500).json({ message: 'خطأ في الخادم', error: err.message });
      }
      if (userResults.length === 0) {
        return res.status(404).json({ message: 'المستخدم غير موجود' });
      }
      // إضافة المستخدم إلى المجموعة
      const insertQuery = 'INSERT INTO UserTeams (user_id, team_id) VALUES (?, ?)';
      db.query(insertQuery, [user_id, teamId], (err, result) => {
        if (err) {
          console.error('خطأ في ربط المستخدم بالمجموعة:', err);
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'المستخدم موجود بالفعل في المجموعة' });
          }
          return res.status(500).json({ message: 'خطأ في الخادم', error: err.message });
        }
        res.status(201).json({ message: 'تم ربط المستخدم بالمجموعة بنجاح' });
      });
    });
  });
});
app.post('/api/team-manufacturers', isAuthenticated, restrictToAdminAndManager, (req, res) => {
  const { team_id, manufacturer_id } = req.body;
  const insertQuery = 'INSERT INTO TeamManufacturers (team_id, manufacturer_id) VALUES (?, ?)';
  db.query(insertQuery, [team_id, manufacturer_id], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'الفريق مرتبط بالفعل بالشركة' });
      }
      return res.status(500).json({ message: 'خطأ في الخادم', error: err.message });
    }
    res.status(201).json({ message: 'تم ربط الفريق بالشركة بنجاح' });
  });
});
// Delete user-team association endpoint
app.delete('/api/teams/:teamId/users/:userId', (req, res) => {
  const { teamId, userId } = req.params;
  try {
      db.query(
          'DELETE FROM UserTeams WHERE team_id = ? AND user_id = ?',
          [teamId, userId],
          (error, result) => {
              if (error) {
                  console.error('Error deleting user-team association:', error);
                  return res.status(500).json({ message: 'خطأ في الخادم أثناء حذف ربط المستخدم بالمجموعة' });
              }
              if (result.affectedRows === 0) {
                  return res.status(404).json({ message: 'ربط المستخدم بالمجموعة غير موجود' });
              }
              res.status(200).json({ message: 'تم حذف ربط المستخدم بالمجموعة بنجاح' });
          }
      );
  } catch (error) {
      console.error('Error deleting user-team association:', error);
      res.status(500).json({ message: 'خطأ في الخادم أثناء حذف ربط المستخدم بالمجموعة' });
  }
});
// Delete team-manufacturer association endpoint
app.delete('/api/team-manufacturers/:teamId/:manufacturerId', (req, res) => {
  const { teamId, manufacturerId } = req.params;
  try {
      db.query(
          'DELETE FROM TeamManufacturers WHERE team_id = ? AND manufacturer_id = ?',
          [teamId, manufacturerId],
          (error, result) => {
              if (error) {
                  console.error('Error deleting team-manufacturer association:', error);
                  return res.status(500).json({ message: 'خطأ في الخادم أثناء حذف ربط الفريق بالشركة' });
              }
              if (result.affectedRows === 0) {
                  return res.status(404).json({ message: 'ربط الفريق بالشركة غير موجود' });
              }
              res.status(200).json({ message: 'تم حذف ربط الفريق بالشركة بنجاح' });
          }
      );
  } catch (error) {
      console.error('Error deleting team-manufacturer association:', error);
      res.status(500).json({ message: 'خطأ في الخادم أثناء حذف ربط الفريق بالشركة' });
  }
});
app.put("/api/manufacturers/:id", isAuthenticated, restrictToAdminAndManager, (req, res) => {
  const manufacturerId = req.params.id;
  const { manufacturer_name, contact_info } = req.body;
  if (!manufacturer_name) {
    return res
      .status(400)
      .json({ field: "manufacturer_name", message: "اسم الشركة مطلوب" });
  }
 const  query =
    "UPDATE Manufacturers SET manufacturer_name = ?, contact_info = ? WHERE manufacturer_id = ?";
  db.query(
    query,
    [manufacturer_name, contact_info || null, manufacturerId],
    (err, result) => {
      if (err) {
        console.error("خطأ في تعديل الشركة:", err);
        return res
          .status(500)
          .json({ message: "خطأ أثناء تعديل الشركة", error: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "الشركة غير موجودة" });
      }
      res.json({ message: "تم تعديل الشركة بنجاح" });
    }
  );
});
app.delete("/api/manufacturers/:id", isAuthenticated, restrictToAdminAndManager, (req, res) => {
    const manufacturerId = req.params.id;
    const query = "DELETE FROM Manufacturers WHERE manufacturer_id = ?";
    db.query(query, [manufacturerId], (err, result) => {
      if (err) {
        console.error("خطأ في حذف الشركة:", err);
        return res
          .status(500)
          .json({ message: "خطأ أثناء حذف الشركة", error: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "الشركة غير موجودة" });
      }
      res.json({ message: "تم حذف الشركة بنجاح" });
    });
  }
);
app.get('/api/manufacturers/:id/suppliers', isAuthenticated, (req, res) => {
  const manufacturerId = req.params.id;
  const userRole = req.user.role;
  const userId = req.user.id;
  // التحقق من صلاحية المستخدم لرؤية الشركة
  let accessQuery;
  let accessParams = [manufacturerId, userId];
  if (userRole === 'مسؤول النظام') {
    // مسؤول النظام لديه صلاحية تلقائية
    accessQuery = `SELECT manufacturer_id FROM Manufacturers WHERE manufacturer_id = ?`;
    accessParams = [manufacturerId];
  } else if (userRole === 'مورد') {
    // المورد يرى الشركة إذا كانت مرتبطة به
    accessQuery = `
      SELECT m.manufacturer_id 
      FROM Manufacturers m
      JOIN Supplier_Manufacturers sm ON m.manufacturer_id = sm.manufacturer_id
      WHERE m.manufacturer_id = ? AND sm.supplier_id = ?
    `;
  } else {
    // الأدوار الأخرى (مثل مدير، موظف المستودع) ترى الشركة إذا كانت مرتبطة بفريقها
    accessQuery = `
      SELECT m.manufacturer_id 
      FROM Manufacturers m
      JOIN TeamManufacturers tm ON m.manufacturer_id = tm.manufacturer_id
      JOIN UserTeams ut ON tm.team_id = ut.team_id
      WHERE m.manufacturer_id = ? AND ut.user_id = ?
    `;
  }
  db.query(accessQuery, accessParams, (err, accessResults) => {
    if (err) {
      console.error('خطأ في التحقق من صلاحية الشركة:', err);
      return res.status(500).json({ message: 'خطأ في التحقق من الصلاحية', error: err.message });
    }
    if (accessResults.length === 0) {
      return res.status(403).json({ message: 'غير مصرح لك برؤية هذه الشركة' });
    }
    // جلب الموردين المرتبطين بالشركة
    const suppliersQuery = `
      SELECT 
        s.supplier_id, 
        s.suppliername
      FROM Suppliers s
      JOIN Supplier_Manufacturers sm ON s.supplier_id = sm.supplier_id
      WHERE sm.manufacturer_id = ?
    `;
    db.query(suppliersQuery, [manufacturerId], (err, suppliers) => {
      if (err) {
        console.error('خطأ في جلب الموردين:', err);
        return res.status(500).json({ message: 'خطأ في جلب الموردين', error: err.message });
      }
      res.json(suppliers);
    });
  });
});
app.post("/api/manufacturers/:manufacturerId/suppliers",isAuthenticated, restrictToAdminAndManager,(req, res) => {
    const { manufacturerId } = req.params;
    const { supplier_ids } = req.body;
    if (!Array.isArray(supplier_ids)) {
      return res
        .status(400)
        .json({ message: "يجب أن تكون supplier_ids مصفوفة" });
    }
    const checkManufacturerQuery =
      "SELECT manufacturer_id FROM Manufacturers WHERE manufacturer_id = ?";
    db.query(checkManufacturerQuery, [manufacturerId], (err, result) => {
      if (err) {
        console.error("خطأ في التحقق من الشركة:", err);
        return res
          .status(500)
          .json({ message: "خطأ أثناء التحقق من الشركة", error: err.message });
      }
      if (result.length === 0) {
        return res.status(404).json({ message: "الشركة غير موجودة" });
      }
      const deleteQuery =
        "DELETE FROM Supplier_Manufacturers WHERE manufacturer_id = ?";
      db.query(deleteQuery, [manufacturerId], (err) => {
        if (err) {
          console.error("خطأ في حذف العلاقات الحالية:", err);
          return res.status(500).json({
            message: "خطأ أثناء حذف العلاقات الحالية",
            error: err.message,
          });
        }
        if (supplier_ids.length === 0) {
          return res.json({
            message: "تم تحديث الموردين بنجاح (لا يوجد موردون مرتبطون)",
          });
        }
        const insertQuery =
          "INSERT INTO Supplier_Manufacturers (supplier_id, manufacturer_id) VALUES ?";
        const values = supplier_ids.map((supplierId) => [supplierId, manufacturerId]);
        db.query(insertQuery, [values], (err) => {
          if (err) {
            console.error("خطأ في إضافة العلاقات الجديدة:", err);
            return res.status(500).json({
              message: "خطأ أثناء إضافة العلاقات الجديدة",
              error: err.message,
            });
          }
          res.json({ message: "تم تحديث الموردين بنجاح" });
        });
      });
    });
  }
);
// Delete category
app.delete('/api/categories/:id', isAuthenticated, restrictToSupplier, (req, res) => {
  const categoryId = req.params.id;
  const { manufacturer_id } = req.query;
  if (!manufacturer_id) {
    return res.status(400).json({ message: 'معرف الشركة المصنعة مطلوب' });
  }
  const deleteManufacturerCategoryQuery = `
    DELETE FROM ManufacturerCategories 
    WHERE category_id = ? AND manufacturer_id = ?
  `;
  db.query(deleteManufacturerCategoryQuery, [categoryId, manufacturer_id], (err) => {
    if (err) {
      console.error('خطأ في حذف العلاقة:', err);
      return res.status(500).json({ message: 'خطأ أثناء حذف العلاقة', error: err.message });
    }
    const deleteCategoryQuery = 'DELETE FROM Categories WHERE category_id = ?';
    db.query(deleteCategoryQuery, [categoryId], (err) => {
      if (err) {
        console.error('خطأ في حذف الصنف:', err);
        return res.status(500).json({ message: 'خطأ أثناء حذف الصنف', error: err.message });
      }
      res.json({ message: 'تم حذف الصنف بنجاح' });
    });
  });
});
// Update product
app.put('/api/products/:id', isAuthenticated, restrictToSupplier, (req, res) => {
  const productId = req.params.id;
  const { product_name, description, barcode, manufacturer_id, category_id, unit, price, quantity } = req.body;
  if (!product_name || !manufacturer_id || quantity == null) {
    return res.status(400).json({ message: 'اسم المنتج، معرف الشركة المصنعة، والكمية مطلوبة' });
  }
  const query = `
    UPDATE Products 
    SET product_name = ?, description = ?, barcode = ?, manufacturer_id = ?, category_id = ?, unit = ?, price = ?, quantity = ?
    WHERE product_id = ?
  `;
  db.query(query, [
    product_name,
    description || null,
    barcode || null,
    manufacturer_id,
    category_id || null,
    unit || null,
    price || null,
    quantity,
    productId
  ], (err, result) => {
    if (err) {
      console.error('خطأ في تعديل المنتج:', err);
      return res.status(500).json({ message: 'خطأ أثناء تعديل المنتج', error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }
    res.json({ message: 'تم تعديل المنتج بنجاح' });
  });
});
// Delete product
app.delete('/api/products/:id', isAuthenticated, restrictToSupplier, (req, res) => {
  const productId = req.params.id;
  const query = 'DELETE FROM Products WHERE product_id = ?';
  db.query(query, [productId], (err) => {
    if (err) {
      console.error('خطأ في حذف المنتج:', err);
      return res.status(500).json({ message: 'خطأ أثناء حذف المنتج', error: err.message });
    }
    res.json({ message: 'تم حذف المنتج بنجاح' });
  });
});
app.put('/api/cart/:cart_id', isAuthenticated, (req, res) => {
  const cartId = parseInt(req.params.cart_id);
  const { quantity } = req.body;
  if (!quantity || quantity < 1) {
    console.error('الكمية غير صالحة:', quantity);
    return res.status(400).json({ message: 'الكمية مطلوبة ويجب أن تكون أكبر من صفر' });
  }
  if (req.user.role !== 'موظف المستودع') {
    console.error('محاولة وصول غير مصرح بها:', req.user.role);
    return res.status(403).json({ message: 'فقط موظف المستودع يمكنه تحديث العربة' });
  }
  const query = `
    UPDATE Cart 
    SET quantity = ?
    WHERE cart_id = ? AND user_id = ?
  `;
  db.query(query, [quantity, cartId, req.user.id], (err, result) => {
    if (err) {
      console.error('خطأ في تحديث الكمية:', {
        message: err.message,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState,
        code: err.code
      });
      return res.status(500).json({ message: 'خطأ أثناء تحديث الكمية', error: err.message, sqlMessage: err.sqlMessage });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'العنصر غير موجود في العربة' });
    }
    res.json({ message: 'تحديث الكمية بنجاح' });
  });
});
app.delete('/api/cart/:cart_id', isAuthenticated, (req, res) => {
  const cartId = parseInt(req.params.cart_id);
  const userId = req.user.id;
  if (req.user.role !== 'موظف المستودع') {
    console.error('محاولة وصول غير مصرح بها:', req.user.role);
    return res.status(403).json({ message: 'فقط موظف المستودع يمكنه حذف عناصر العربة' });
  }
  if (!cartId || isNaN(cartId)) {
    console.error('معرف عنصر العربة غير صالح:', cartId);
    return res.status(400).json({ message: 'معرف عنصر العربة غير صالح' });
  }
  const query = 'DELETE FROM Cart WHERE cart_id = ? AND user_id = ?';
  db.query(query, [cartId, userId], (err, result) => {
    if (err) {
      console.error('خطأ في حذف عنصر العربة:', {
        message: err.message,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState,
        code: err.code
      });
      return res.status(500).json({ 
        message: 'خطأ أثناء حذف عنصر العربة', 
        error: err.message, 
        sqlMessage: err.sqlMessage 
      });
    }
    if (result.affectedRows === 0) {
      console.warn('لم يتم العثور على عنصر العربة:', { cartId, userId });
      return res.status(404).json({ message: 'العنصر غير موجود في العربة' });
    }
    console.log(`تم حذف عنصر العربة ${cartId} للمستخدم ${userId}`);
    res.json({ message: 'تم حذف العنصر من العربة بنجاح' });
  });
});
// مسار جلب تفاصيل طلب معين
app.get('/api/orders-manage/:id', isAuthenticated, restrictToAdminAndManager, (req, res) => {
  const orderId = req.params.id;
  console.log('GET /api/orders-manage/:id', { orderId, user: req.user });
  const orderQuery = `
      SELECT 
          o.order_id, 
          o.order_date, 
          o.status, 
          o.payment_status, 
          o.delivery_status, 
          COALESCE(o.amount, 0) AS amount, 
          COALESCE(u.username, 'غير محدد') AS employee_name, 
          COALESCE(s.username, 'غير محدد') AS supplier_name, 
          m.manufacturer_name,
          COALESCE(u.status, 'Active') AS user_status,
          o.rejection_reason
      FROM Orders o
      LEFT JOIN Users u ON o.employee_id = u.user_id
      LEFT JOIN Users s ON o.supplier_id = s.user_id
      LEFT JOIN Manufacturers m ON o.manufacturer_id = m.manufacturer_id
      WHERE o.order_id = ? AND o.status != 'تفاصيل إضافية'
  `;
  const itemsQuery = `
      SELECT 
          oi.order_item_id, 
          oi.quantity, 
          p.product_name, 
          COALESCE(oi.price, 0) AS price
      FROM OrderItems oi
      LEFT JOIN Products p ON oi.product_id = p.product_id
      WHERE oi.order_id = ?
  `;
  db.query(orderQuery, [orderId], (err, orderResults) => {
      if (err) {
          console.error('خطأ في جلب تفاصيل الطلب:', {
              message: err.message,
              sqlMessage: err.sqlMessage,
              sqlState: err.sqlState,
              code: err.code
          });
          return res.status(500).json({ 
              message: 'خطأ أثناء جلب تفاصيل الطلب', 
              error: err.message, 
              sqlMessage: err.sqlMessage 
          });
      }
      if (orderResults.length === 0) {
          console.warn('الطلب غير موجود:', orderId);
          return res.status(404).json({ message: 'الطلب غير موجود' });
      }
      db.query(itemsQuery, [orderId], (err, itemsResults) => {
          if (err) {
              console.error('خطأ في جلب عناصر الطلب:', {
                  message: err.message,
                  sqlMessage: err.sqlMessage,
                  sqlState: err.sqlState,
                  code: err.code
              });
              return res.status(500).json({ 
                  message: 'خطأ أثناء جلب عناصر الطلب', 
                  error: err.message, 
                  sqlMessage: err.sqlMessage 
              });
          }
          console.log('تفاصيل الطلب المجلوبة:', { order: orderResults[0], items: itemsResults.length });
          res.status(200).json({
              order: orderResults[0],
              items: itemsResults
          });
      });
  });
});
// مسار تحديث حالة الطلب
// مسار تحديث حالة الطلب
app.put('/api/orders-manage/:id', isAuthenticated, restrictToAdminAndManager, (req, res) => {
  const orderId = req.params.id;
  let { status, rejection_reason } = req.body;
  console.log('PUT /api/orders-manage/:id', { orderId, status, rejection_reason, user: req.user });
  if (!status) {
    console.error('حالة الطلب مطلوبة');
    return res.status(400).json({ message: 'حالة الطلب مطلوبة' });
  }
  const validStatuses = ['موافق عليه', 'مرفوض', 'قيد الانتظار', 'مكتمل'];
  if (!validStatuses.includes(status)) {
    console.error('حالة غير صالحة:', status);
    return res.status(400).json({ message: 'حالة الطلب غير صالحة' });
  }
  // التحقق من الحجوزات للطلب بحالة "قيد الانتظار"
  db.query(`
    SELECT 
      r.reservation_id,
      r.product_id,
      r.reserved_quantity,
      r.reservation_expiry,
      o.status
    FROM OrderReservations r
    JOIN Orders o ON r.order_id = o.order_id
    WHERE r.order_id = ? AND o.status = 'قيد الانتظار'
  `, [orderId], (err, reservations) => {
    if (err) {
      console.error('خطأ في جلب الحجوزات:', {
        message: err.message,
        sqlMessage: err.sqlMessage || 'N/A',
        sqlState: err.sqlState || 'N/A',
        code: err.code || 'N/A'
      });
      return res.status(500).json({ 
        message: 'خطأ أثناء جلب الحجوزات', 
        error: err.message, 
        sqlMessage: err.sqlMessage 
      });
    }
    // مقارنة الوقت في JavaScript
    const now = new Date();
    const expiredReservations = reservations.filter(r => new Date(r.reservation_expiry) <= now);
    console.log(`Found ${reservations.length} reservations for order ${orderId} with pending status`, reservations);
    console.log(`Filtered ${expiredReservations.length} expired reservations`, expiredReservations);
    // إذا كان هناك حجوزات منتهية
    if (expiredReservations.length > 0) {
      console.log(`Order ${orderId} has expired reservations and is pending, rejecting automatically`);
      // تحديث الطلب إلى "مرفوض"
      db.query(`
        UPDATE Orders 
        SET 
          status = 'مرفوض', 
          rejection_reason = 'انتهت مدة الحجز'
        WHERE order_id = ?
      `, [orderId], (err, updateResult) => {
        if (err) {
          console.error('خطأ في تحديث الطلب:', {
            message: err.message,
            sqlMessage: err.sqlMessage || 'N/A',
            sqlState: err.sqlState || 'N/A',
            code: err.code || 'N/A'
          });
          return res.status(500).json({ 
            message: 'خطأ أثناء تحديث الطلب', 
            error: err.message, 
            sqlMessage: err.sqlMessage 
          });
        }
        if (updateResult.affectedRows === 0) {
          console.warn('الطلب غير موجود:', orderId);
          return res.status(404).json({ message: 'الطلب غير موجود' });
        }
        // استعادة الكميات وحذف الحجوزات
        let remainingReservations = expiredReservations.length;
        if (remainingReservations === 0) {
          console.log('تم رفض الطلب بنجاح بسبب انتهاء الحجز:', { orderId });
          return res.status(200).json({ message: 'تم رفض الطلب بسبب انتهاء مدة الحجز' });
        }
        expiredReservations.forEach((reservation) => {
          // استعادة الكمية
          db.query(`
            UPDATE Products 
            SET quantity = quantity + ? 
            WHERE product_id = ?
          `, [reservation.reserved_quantity, reservation.product_id], (err, productResult) => {
            if (err) {
              console.error('خطأ في استعادة الكمية:', {
                message: err.message,
                sqlMessage: err.sqlMessage || 'N/A',
                sqlState: err.sqlState || 'N/A',
                code: err.code || 'N/A'
              });
            }
            if (productResult && productResult.affectedRows === 0) {
              console.warn(`Failed to restore quantity for product ${reservation.product_id}`);
            }
            // حذف الحجز
            db.query(`
              DELETE FROM OrderReservations 
              WHERE reservation_id = ?
            `, [reservation.reservation_id], (err, deleteResult) => {
              if (err) {
                console.error('خطأ في حذف الحجز:', {
                  message: err.message,
                  sqlMessage: err.sqlMessage || 'N/A',
                  sqlState: err.sqlState || 'N/A',
                  code: err.code || 'N/A'
                });
              }
              if (deleteResult && deleteResult.affectedRows > 0) {
                console.log(`Restored ${reservation.reserved_quantity} to product ${reservation.product_id} and deleted reservation ${reservation.reservation_id}`);
              } else {
                console.warn(`Failed to delete reservation ${reservation.reservation_id}`);
              }
              // التحقق من اكتمال معالجة جميع الحجوزات
              remainingReservations--;
              if (remainingReservations === 0) {
                console.log('تم رفض الطلب بنجاح بسبب انتهاء الحجز:', { orderId });
                res.status(200).json({ message: 'تم رفض الطلب بسبب انتهاء مدة الحجز' });
              }
            });
          });
        });
      });
    } else if (status === 'مرفوض') {
      // جلب كميات الحجوزات لاستعادة الكمية عند الرفض اليدوي
      db.query(`
        SELECT r.product_id, r.reserved_quantity
        FROM OrderReservations r
        WHERE r.order_id = ?
      `, [orderId], (err, reservations) => {
        if (err) {
          console.error('خطأ في جلب الحجوزات لاستعادة الكمية:', err);
          return res.status(500).json({ message: 'خطأ أثناء جلب الحجوزات', error: err.message });
        }
        // تحديث الطلب إلى "مرفوض"
        db.query(`
          UPDATE Orders 
          SET 
            status = ?, 
            rejection_reason = ?
          WHERE order_id = ?
        `, [status, rejection_reason || null, orderId], (err, updateResult) => {
          if (err) {
            console.error('خطأ في تحديث الطلب:', {
              message: err.message,
              sqlMessage: err.sqlMessage || 'N/A',
              sqlState: err.sqlState || 'N/A',
              code: err.code || 'N/A'
            });
            return res.status(500).json({ 
              message: 'خطأ أثناء تحديث الطلب', 
              error: err.message, 
              sqlMessage: err.sqlMessage 
            });
          }
          if (updateResult.affectedRows === 0) {
            console.warn('الطلب غير موجود:', orderId);
            return res.status(404).json({ message: 'الطلب غير موجود' });
          }
          // استعادة الكميات إذا كان الطلب مرفوض
          let remainingUpdates = reservations.length;
          if (remainingUpdates === 0) {
            console.log('تم تحديث الطلب بنجاح:', { orderId, status });
            return res.status(200).json({ message: 'تم تحديث حالة الطلب بنجاح' });
          }
          reservations.forEach((reservation) => {
            db.query(`
              UPDATE Products 
              SET quantity = quantity + ?
              WHERE product_id = ?
            `, [reservation.reserved_quantity, reservation.product_id], (err, productResult) => {
              if (err) {
                console.error('خطأ في استعادة الكمية:', {
                  message: err.message,
                  sqlMessage: err.sqlMessage || 'N/A',
                  sqlState: err.sqlState || 'N/A',
                  code: err.code || 'N/A'
                });
              }
              if (productResult && productResult.affectedRows === 0) {
                console.warn(`Failed to restore quantity for product ${reservation.product_id}`);
              }
              remainingUpdates--;
              if (remainingUpdates === 0) {
                // حذف الحجوزات بعد استعادة الكميات
                db.query(`
                  DELETE FROM OrderReservations 
                  WHERE order_id = ?
                `, [orderId], (err, deleteResult) => {
                  if (err) {
                    console.error('خطأ في حذف الحجوزات:', err);
                  }
                  console.log('تم تحديث الطلب بنجاح واستعادة الكميات:', { orderId, status });
                  res.status(200).json({ message: 'تم تحديث حالة الطلب بنجاح واستعادة الكميات' });
                });
              }
            });
          });
        });
      });
    } else {
      // تحديث الطلب بدون استعادة الكمية للحالات الأخرى
      db.query(`
        UPDATE Orders 
        SET 
          status = ?, 
          rejection_reason = ?
        WHERE order_id = ?
      `, [status, rejection_reason || null, orderId], (err, updateResult) => {
        if (err) {
          console.error('خطأ في تحديث الطلب:', {
            message: err.message,
            sqlMessage: err.sqlMessage || 'N/A',
            sqlState: err.sqlState || 'N/A',
            code: err.code || 'N/A'
          });
          return res.status(500).json({ 
            message: 'خطأ أثناء تحديث الطلب', 
            error: err.message, 
            sqlMessage: err.sqlMessage 
          });
        }
        if (updateResult.affectedRows === 0) {
          console.warn('الطلب غير موجود:', orderId);
          return res.status(404).json({ message: 'الطلب غير موجود' });
        }
        console.log('تم تحديث الطلب بنجاح:', { orderId, status });
        res.status(200).json({ message: 'تم تحديث حالة الطلب بنجاح' });
      });
    }
  });
});
// مسار جلب تفاصيل الحجوزات للطلب
app.get('/api/orders-manage/:id/reservations', isAuthenticated, restrictToAdminAndManager, (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  console.log(`جلب الحجوزات للطلب ${orderId}`);
  if (isNaN(orderId)) {
    return res.status(400).json({ message: 'معرف الطلب غير صالح' });
  }

  // التحقق من وجود الطلب وحالته
  db.query(
    'SELECT order_id, status FROM Orders WHERE order_id = ?',
    [orderId],
    (err, orderResults) => {
      if (err) {
        console.error('خطأ في التحقق من الطلب:', err);
        return res.status(500).json({ message: 'خطأ أثناء التحقق من الطلب', error: err.message });
      }
      if (!orderResults[0]) {
        console.log(`الطلب ${orderId} غير موجود`);
        return res.status(404).json({ message: 'الطلب غير موجود' });
      }
      const order = orderResults[0];
      console.log(`الطلب ${orderId} موجود، الحالة: ${order.status}`);

      // إذا كانت حالة الطلب "موافق عليه"، "مرفوض"، أو "مكتمل"، أرجع قائمة حجوزات فارغة
      if (['موافق عليه', 'مرفوض', 'مكتمل'].includes(order.status)) {
        console.log(`الطلب ${orderId} بحالة ${order.status}، لا توجد حجوزات`);
        return res.status(200).json({ 
          reservations: [],
          order: {
            order_id: order.order_id,
            status: order.status
          }
        });
      }

      // جلب تفاصيل الحجوزات
      const query = `
        SELECT 
          r.reservation_id,
          r.order_id,
          r.product_id,
          r.reserved_quantity,
          r.reservation_expiry,
          r.created_at,
          p.product_name,
          p.quantity AS available_quantity
        FROM OrderReservations r
        LEFT JOIN Products p ON r.product_id = p.product_id
        WHERE r.order_id = ?
      `;
      db.query(query, [orderId], (err, results) => {
        if (err) {
          console.error('خطأ في جلب تفاصيل الحجوزات:', err);
          return res.status(500).json({ message: 'خطأ أثناء جلب تفاصيل الحجوزات', error: err.message });
        }
        console.log(`عدد الحجوزات المسترجعة للطلب ${orderId}: ${results.length}`);

        // إرجاع قائمة الحجوزات (حتى لو كانت فارغة)
        const now = new Date();
        const expiredReservations = results.filter(r => r.reservation_expiry && new Date(r.reservation_expiry) < now);
        if (expiredReservations.length > 0) {
          db.query(
            'UPDATE Orders SET status = ? WHERE order_id = ? AND status = ?',
            ['مرفوض', orderId, 'قيد الانتظار'],
            (err, updateResult) => {
              if (err) {
                console.error('خطأ في تحديث حالة الطلب:', err);
              } else if (updateResult.affectedRows > 0) {
                console.log(`تم تحديث حالة الطلب ${orderId} إلى مرفوض بسبب انتهاء الحجوزات`);
              }
            }
          );
        }

        res.status(200).json({ 
          reservations: results,
          order: {
            order_id: order.order_id,
            status: order.status
          }
        });
      });
    }
  );
});
app.delete('/api/orders-manage/:id/reservations', isAuthenticated, restrictToAdminAndManager, (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  console.log(`محاولة إلغاء الحجوزات للطلب ${orderId}`);
  if (isNaN(orderId)) {
    return res.status(400).json({ message: 'معرف الطلب غير صالح' });
  }

  // التحقق من وجود الطلب
  db.query(
    'SELECT order_id, status FROM Orders WHERE order_id = ?',
    [orderId],
    (err, orderResults) => {
      if (err) {
        console.error('خطأ في التحقق من الطلب:', err);
        return res.status(500).json({ message: 'خطأ أثناء التحقق من الطلب', error: err.message });
      }
      

      // حذف الحجوزات
      db.query(
        'DELETE FROM OrderReservations WHERE order_id = ?',
        [orderId],
        (err, deleteResult) => {
          if (err) {
            console.error('خطأ في حذف الحجوزات:', err);
            return res.status(500).json({ message: 'خطأ أثناء حذف الحجوزات', error: err.message });
          }
          console.log(`تم حذف ${deleteResult.affectedRows} حجز للطلب ${orderId}`);
          res.status(200).json({ message: 'تم إلغاء الحجوزات بنجاح' });
        }
      );
    }
  );
});
// جلب تفاصيل طلب معين
app.get('/api/payments-manage/:id', isAuthenticated, (req, res) => {
  console.log('GET /api/payments-manage/:id', { id: req.params.id, user: req.user });
  if (req.user.role !== 'موظف التتبع و الفواتير') {
    console.error('Unauthorized access attempt:', req.user.role);
    return res.status(403).json({ message: 'فقط موظف التتبع والفواتير يمكنه الوصول إلى المدفوعات' });
  }
  const { id } = req.params;
  const paymentQuery = `
    SELECT 
      o.order_id, 
      o.order_date, 
      m.manufacturer_name, 
      COALESCE(o.amount, 0) AS amount, 
      o.payment_status, 
      COALESCE(u.username, 'غير محدد') AS employee_name, 
      COALESCE(s.username, 'غير محدد') AS supplier_name, 
      COALESCE(s.user_id, '') AS supplier_id,
      o.payment_terms, 
      o.manufacturer_id
    FROM Orders o
    LEFT JOIN Manufacturers m ON o.manufacturer_id = m.manufacturer_id
    LEFT JOIN Users u ON o.employee_id = u.user_id
    LEFT JOIN Users s ON o.supplier_id = s.user_id
    WHERE o.order_id = ? AND o.status = 'موافق عليه'
  `;
  const itemsQuery = `
    SELECT 
      oi.order_item_id, 
      oi.quantity, 
      p.product_name, 
      COALESCE(oi.price, 0) AS price
    FROM OrderItems oi
    LEFT JOIN Products p ON oi.product_id = p.product_id
    WHERE oi.order_id = ?
  `;
  db.query(paymentQuery, [id], (err, paymentResults) => {
    if (err) {
      console.error('Error fetching payment details:', err);
      return res.status(500).json({ message: 'خطأ أثناء جلب تفاصيل الدفع', error: err.message });
    }
    if (paymentResults.length === 0) {
      console.warn('Payment or approved order not found:', id);
      return res.status(404).json({ message: 'الطلب غير موجود أو غير موافق عليه' });
    }
    console.log('Payment details fetched:', paymentResults[0]);
    db.query(itemsQuery, [id], (err, itemsResults) => {
      if (err) {
        console.error('Error fetching order items:', err);
        return res.status(500).json({ message: 'خطأ أثناء جلب عناصر الطلب', error: err.message });
      }
      console.log('Order items fetched:', itemsResults.length, 'items');
      res.status(200).json({
        payment: paymentResults[0],
        items: itemsResults,
      });
    });
  });
});
// تحديث المورد وشروط الدفع
app.put('/api/payments-manage/:id', isAuthenticated, (req, res) => {
  console.log('PUT /api/payments-manage/:id', { id: req.params.id, body: req.body, user: req.user });
  if (req.user.role !== 'موظف التتبع و الفواتير') {
    console.error('Unauthorized access attempt:', req.user.role);
    return res.status(403).json({ message: 'فقط موظف التتبع والفواتير يمكنه تحديث المدفوعات' });
  }
  const { id } = req.params;
  const { supplier_id, payment_terms } = req.body;
  const validPaymentTerms = ['عند الاستلام', 'تحويل بنكي', 'بطاقة ائتمان'];
  if (!payment_terms || !validPaymentTerms.includes(payment_terms)) {
    console.error('Invalid payment terms:', payment_terms);
    return res.status(400).json({ message: 'شروط الدفع غير صالحة' });
  }
  if (!supplier_id) {
    console.error('Supplier ID is required');
    return res.status(400).json({ message: 'يجب اختيار مورد' });
  }
  const checkOrderQuery = `
    SELECT order_id
    FROM Orders
    WHERE order_id = ? AND status = 'موافق عليه'
  `;
  db.query(checkOrderQuery, [id], (err, results) => {
    if (err) {
      console.error('Error checking order:', err);
      return res.status(500).json({ message: 'خطأ أثناء التحقق من الطلب', error: err.message });
    }
    if (results.length === 0) {
      console.warn('Approved order not found:', id);
      return res.status(404).json({ message: 'الطلب غير موجود أو غير موافق عليه' });
    }
    const updateQuery = `
      UPDATE Orders
      SET supplier_id = ?, payment_terms = ?
      WHERE order_id = ?
    `;
    db.query(updateQuery, [supplier_id, payment_terms, id], (err, result) => {
      if (err) {
        console.error('Error updating order:', err);
        return res.status(500).json({ message: 'خطأ أثناء تحديث الطلب', error: err.message });
      }
      if (result.affectedRows === 0) {
        console.warn('No rows updated for order:', id);
        return res.status(404).json({ message: 'الطلب غير موجود' });
      }
      console.log('Order updated successfully:', { order_id: id, supplier_id, payment_terms });
      res.status(200).json({ message: 'تم تحديث المورد وشروط الدفع بنجاح' });
    });
  });
});
// تعيين PIN من المورد
app.post('/api/orders/:order_id/set-pin', isAuthenticated, (req, res) => {
  console.log('POST /api/orders/:order_id/set-pin', { params: req.params, body: req.body, user: req.session.user });
  if (req.session.user.role !== 'مورد') {
    console.error('Unauthorized access attempt:', req.session.user.role);
    return res.status(403).json({
      success: false,
      message: 'فقط المورد يمكنه تعيين بيانات مندوب المبيعات',
    });
  }
  const { order_id } = req.params;
  const { pin, sales_rep_name, sales_rep_phone } = req.body;
  // Validate PIN
  if (!pin || !/^\d{4}$/.test(pin)) {
    console.error('Invalid PIN format:', pin);
    return res.status(400).json({
      success: false,
      message: 'رمز PIN يجب أن يتكون من 4 أرقام',
    });
  }
  // Validate sales_rep_name
  if (!sales_rep_name || sales_rep_name.trim().length === 0 || sales_rep_name.length > 100) {
    console.error('Invalid sales representative name:', sales_rep_name);
    return res.status(400).json({
      success: false,
      message: 'اسم مندوب المبيعات مطلوب ويجب ألا يتجاوز 100 حرف',
    });
  }
  // Validate sales_rep_phone
  if (!sales_rep_phone || !/^\+?\d{7,20}$/.test(sales_rep_phone)) {
    console.error('Invalid sales representative phone:', sales_rep_phone);
    return res.status(400).json({
      success: false,
      message: 'رقم هاتف مندوب المبيعات غير صالح (يجب أن يكون بين 7 و20 رقمًا)',
    });
  }
  const checkOrderQuery = `
    SELECT order_id, supplier_id
    FROM Orders
    WHERE order_id = ? AND supplier_id = ?
  `;
  db.query(checkOrderQuery, [order_id, req.session.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        success: false,
        message: 'خطأ في قاعدة البيانات',
        error: err.message,
      });
    }
    if (results.length === 0) {
      console.warn('Order not found or not associated with this supplier:', order_id);
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود أو ليس مرتبطًا بهذا المورد',
      });
    }
    const updateQuery = `
      UPDATE Orders
      SET sales_rep_pin = ?, sales_rep_name = ?, sales_rep_phone = ?
      WHERE order_id = ?
    `;
    db.query(updateQuery, [pin, sales_rep_name.trim(), sales_rep_phone, order_id], (err, result) => {
      if (err) {
        console.error('Update error:', err);
        return res.status(500).json({
          success: false,
          message: 'خطأ أثناء تعيين بيانات مندوب المبيعات',
          error: err.message,
        });
      }
      console.log('Sales representative details set successfully for order:', order_id);
      res.json({
        success: true,
        message: 'تم تعيين بيانات مندوب المبيعات بنجاح',
      });
    });
  });
});
app.get('/:order_id', isAuthenticated, (req, res) => {
  const { order_id } = req.params;
  // Fetch order details
  db.query(
      `SELECT o.*, m.manufacturer_name
       FROM Orders o
       LEFT JOIN Manufacturers m ON o.manufacturer_id = m.manufacturer_id
       WHERE o.order_id = ?`,
      [order_id],
      (err, orderRows) => {
          if (err) {
              console.error('Error fetching order details:', err.message);
              return res.status(500).json({ message: 'خطأ في السيرفر' });
          }
          if (orderRows.length === 0) {
              return res.status(404).json({ message: 'الطلب غير موجود' });
          }
          const order = orderRows[0];
          // Fetch order items with product details (including price from OrderItems)
          db.query(
              `SELECT oi.order_item_id, oi.quantity, oi.notes, oi.price, p.product_name, p.barcode
               FROM OrderItems oi
               LEFT JOIN Products p ON oi.product_id = p.product_id
               WHERE oi.order_id = ?`,
              [order_id],
              (err, itemsRows) => {
                  if (err) {
                      console.error('Error fetching order items:', err.message);
                      return res.status(500).json({ message: 'خطأ في السيرفر' });
                  }
                  // تسجيل البيانات المسترجعة للتحقق
                  console.log('Items fetched:', itemsRows);
                  // تحويل السعر والكمية إلى أرقام
                  const items = itemsRows.map(item => ({
                      ...item,
                      price: parseFloat(item.price) || 0,
                      quantity: parseInt(item.quantity) || 0
                  }));
                  // تسجيل البيانات بعد التحويل
                  console.log('Items after conversion:', items);
                  // Fetch supplier details
                  db.query(
                      `SELECT u.user_id, u.username
                       FROM Users u
                       WHERE u.user_id = ?`,
                      [order.supplier_id],
                      (err, supplierRows) => {
                          if (err) {
                              console.error('Error fetching supplier:', err.message);
                              return res.status(500).json({ message: 'خطأ في السيرفر' });
                          }
                          const supplier = supplierRows.length > 0 ? supplierRows[0] : null;
                          // Fetch employee details
                          db.query(
                              `SELECT u.user_id, u.username
                               FROM Users u
                               WHERE u.user_id = ?`,
                              [order.employee_id],
                              (err, employeeRows) => {
                                  if (err) {
                                      console.error('Error fetching employee:', err.message);
                                      return res.status(500).json({ message: 'خطأ في السيرفر' });
                                  }
                                  const employee = employeeRows.length > 0 ? employeeRows[0] : null;
                                  // Send response
                                  res.status(200).json({
                                      order,
                                      items,
                                      supplier,
                                      employee
                                  });
                              }
                          );
                      }
                  );
              }
          );
      }
  );
});
//  لإنشاء طلب إرجاع
app.post('/api/returns', uploads.single('attachment'), (req, res) => {
  const { order_id, user_id, return_date, category, details, return_type, items } = req.body;
  const attachment = req.file ? req.file.path : null;

  // Validate required fields
  if (!order_id || !user_id || !return_date || !category || !return_type) {
    return res.status(400).json({ error: 'بيانات الإرجاع ناقصة' });
  }

  // Validate return_type
  if (!['full', 'partial'].includes(return_type)) {
    return res.status(400).json({ error: 'نوع الإرجاع غير صالح' });
  }

  // Validate return_date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!dateRegex.test(return_date)) {
    return res.status(400).json({ error: 'تاريخ الإرجاع غير صالح، يجب أن يكون بصيغة YYYY-MM-DDTHH:mm' });
  }

  const checkOrderQuery = "SELECT status FROM Orders WHERE order_id = ?";
  db.query(checkOrderQuery, [order_id], (err, orderRows) => {
    if (err) {
      console.error('خطأ في التحقق من الطلب:', err);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }

    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (orderRows[0].status !== 'مكتمل') {
      return res.status(400).json({ error: 'لا يمكن إرجاع الطلب إلا بعد اكتماله' });
    }

    const checkReturnsQuery = "SELECT COUNT(*) as count FROM Returns WHERE order_id = ?";
    db.query(checkReturnsQuery, [order_id], (err, existingReturns) => {
      if (err) {
        console.error('خطأ في التحقق من المرتجعات:', err);
        return res.status(500).json({ error: 'خطأ في الخادم' });
      }

      if (existingReturns[0].count > 0) {
        return res.status(400).json({ error: 'هذا الطلب لديه طلب إرجاع مسجل بالفعل' });
      }

      // Function to insert return and items
      function insertReturn(itemsToInsert) {
        const insertReturnQuery =
          "INSERT INTO Returns (order_id, user_id, return_date, category, notes, attachment, status, return_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        db.query(insertReturnQuery, [order_id, user_id, return_date, category, details || null, attachment, 'قيد الانتظار', return_type], (err, returnResult) => {
          if (err) {
            console.error('خطأ في إدراج المرتجع:', err);
            return res.status(500).json({ error: 'خطأ في الخادم' });
          }

          const returnId = returnResult.insertId;

          if (itemsToInsert.length > 0) {
            let itemsInserted = 0;

            for (const item of itemsToInsert) {
              const updateStockQuery = "UPDATE OrderItems SET stocked_quantity = stocked_quantity + ? WHERE order_item_id = ? AND order_id = ?";
              db.query(updateStockQuery, [item.quantity, item.order_item_id, order_id], (restoreErr) => {
                if (restoreErr) {
                  console.error('خطأ في استعادة الكمية المخزنة:', restoreErr);
                  db.query("DELETE FROM Returns WHERE return_id = ?", [returnId], (deleteErr) => {
                    if (deleteErr) console.error('خطأ في حذف المرتجع:', deleteErr);
                    return res.status(500).json({ error: 'خطأ في إدراج عنصر المرتجع' });
                  });
                  return;
                }

                const insertItemQuery = "INSERT INTO ReturnItems (return_id, order_item_id, quantity) VALUES (?, ?, ?)";
                db.query(insertItemQuery, [returnId, item.order_item_id, item.quantity], (err) => {
                  if (err) {
                    console.error('خطأ في إدراج عنصر المرتجع:', err);

                    // Rollback
                    db.query("DELETE FROM Returns WHERE return_id = ?", [returnId], (deleteErr) => {
                      if (deleteErr) console.error('خطأ في حذف المرتجع:', deleteErr);
                      db.query(updateStockQuery, [item.quantity, item.order_item_id, order_id], (restoreErr) => {
                        if (restoreErr) console.error('خطأ في استعادة الكمية المخزنة:', restoreErr);
                        return res.status(500).json({ error: 'خطأ في إدراج عنصر المرتجع' });
                      });
                    });
                    return;
                  }

                  itemsInserted++;
                  if (itemsInserted === itemsToInsert.length) {
                    return res.status(200).json({ return_id: returnId });
                  }
                });
              });
            }
          } else {
            return res.status(200).json({ return_id: returnId });
          }
        });
      }

      // Handle partial return
      if (return_type === 'partial' && items) {
        let parsedItems = [];

        try {
          parsedItems = JSON.parse(items);
        } catch (e) {
          return res.status(400).json({ error: 'تنسيق العناصر غير صالح' });
        }

        if (parsedItems.length === 0) {
          return res.status(400).json({ error: 'يجب تحديد عناصر للإرجاع الجزئي' });
        }

        let itemsChecked = 0;

        for (const item of parsedItems) {
          if (!item.order_item_id || !item.quantity || item.quantity <= 0) {
            return res.status(400).json({ error: 'بيانات العنصر غير صالحة' });
          }

          const checkItemQuery = "SELECT quantity FROM OrderItems WHERE order_item_id = ? AND order_id = ?";
          db.query(checkItemQuery, [item.order_item_id, order_id], (err, itemRows) => {
            if (err) {
              console.error('خطأ في التحقق من العنصر:', err);
              return res.status(500).json({ error: 'خطأ في الخادم' });
            }

            if (itemRows.length === 0) {
              return res.status(404).json({ error: `العنصر ${item.order_item_id} غير موجود في الطلب` });
            }

            if (item.quantity > itemRows[0].quantity) {
              return res.status(400).json({ error: `الكمية المطلوبة للإرجاع (${item.quantity}) أكبر من الكمية الأصلية (${itemRows[0].quantity})` });
            }

            itemsChecked++;
            if (itemsChecked === parsedItems.length) {
              insertReturn(parsedItems);
            }
          });
        }

      } else if (return_type === 'full') {
        const fetchItemsQuery = "SELECT order_item_id, quantity FROM OrderItems WHERE order_id = ?";
        db.query(fetchItemsQuery, [order_id], (err, itemRows) => {
          if (err) {
            console.error('خطأ في جلب عناصر الطلب:', err);
            return res.status(500).json({ error: 'خطأ في الخادم' });
          }

          if (itemRows.length === 0) {
            return res.status(400).json({ error: 'لا توجد عناصر في الطلب للإرجاع' });
          }

          const parsedItems = itemRows.map(item => ({
            order_item_id: item.order_item_id,
            quantity: item.quantity
          }));

          insertReturn(parsedItems);
        });
      } else {
        return res.status(400).json({ error: 'نوع الإرجاع غير صالح' });
      }
    });
  });
});

app.get('/api/orders/:orderId/items', (req, res) => {
  const { orderId } = req.params;
  if (isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }
  db.query(
    `
    SELECT oi.order_item_id, oi.product_id, oi.quantity, p.product_name
    FROM OrderItems oi
    JOIN Products p ON oi.product_id = p.product_id
    WHERE oi.order_id = ?
    `,
    [orderId],
    (error, results) => {
      if (error) {
        console.error('Error fetching order items:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: 'No items found for this order' });
      }
      res.json(results);
    }
  );
});
// مسار جلب عناصر مرتجع معين
app.get('/api/returns/:id/items', isAuthenticated, (req, res) => {
    const returnId = parseInt(req.params.id);
    console.log('GET /api/returns/:id/items - Return ID:', returnId, 'User:', req.user);
    if (isNaN(returnId)) {
        console.error('معرف المرتجع غير صالح:', returnId);
        return res.status(400).json({ message: 'معرف المرتجع غير صالح' });
    }
    if (!req.user || !req.user.id || !req.user.role) {
        console.error('بيانات المستخدم غير صالحة:', req.user);
        return res.status(401).json({ message: 'بيانات المستخدم غير صالحة أو لم يتم تسجيل الدخول' });
    }
    let accessQuery;
    let accessParams = [returnId];
    if (req.user.role === 'مسؤول النظام' || req.user.role === 'مدير') {
        accessQuery = `
            SELECT r.return_id
            FROM Returns r
            WHERE r.return_id = ?
        `;
    } else if (req.user.role === 'مورد') {
        accessQuery = `
            SELECT r.return_id
            FROM Returns r
            JOIN Orders o ON r.order_id = o.order_id
            WHERE r.return_id = ? AND o.supplier_id = ?
        `;
        accessParams = [returnId, req.user.id];
    } else {
        accessQuery = `
            SELECT r.return_id
            FROM Returns r
            WHERE r.return_id = ? AND r.user_id = ?
        `;
        accessParams = [returnId, req.user.id];
    }
    console.log('تنفيذ استعلام التحقق من الصلاحية:', { query: accessQuery, params: accessParams });
    db.query(accessQuery, accessParams, (err, accessResults) => {
        if (err) {
            console.error('خطأ في التحقق من صلاحية المرتجع:', {
                message: err.message,
                sqlMessage: err.sqlMessage || 'غير متوفر',
                sqlState: err.sqlState || 'غير متوفر',
                code: err.code || 'غير متوفر'
            });
            return res.status(500).json({
                message: 'خطأ أثناء التحقق من صلاحية المرتجع',
                error: err.message,
                sqlMessage: err.sqlMessage || 'غير متوفر'
            });
        }
        if (accessResults.length === 0) {
            console.warn('المرتجع غير موجود أو غير مصرح:', returnId);
            return res.status(403).json({ message: 'غير مصرح لك برؤية هذا المرتجع' });
        }
        const itemsQuery = `
            SELECT 
                ri.return_item_id,
                ri.order_item_id,
                ri.quantity,
                COALESCE(p.product_name, 'غير محدد') AS product_name
            FROM ReturnItems ri
            LEFT JOIN OrderItems oi ON ri.order_item_id = oi.order_item_id
            LEFT JOIN Products p ON oi.product_id = p.product_id
            WHERE ri.return_id = ?
        `;
        console.log('تنفيذ استعلام جلب عناصر المرتجع:', { query: itemsQuery, params: [returnId] });
        db.query(itemsQuery, [returnId], (err, itemsResults) => {
            if (err) {
                console.error('خطأ في جلب عناصر المرتجع:', {
                    message: err.message,
                    sqlMessage: err.sqlMessage || 'غير متوفر',
                    sqlState: err.sqlState || 'غير متوفر',
                    code: err.code || 'غير متوفر'
                });
                return res.status(500).json({
                    message: 'خطأ أثناء جلب عناصر المرتجع',
                    error: err.message,
                    sqlMessage: err.sqlMessage || 'غير متوفر'
                });
            }
            console.log('تم جلب عناصر المرتجع بنجاح:', { returnId, count: itemsResults.length });
            res.status(200).json(itemsResults);
        });
    });
});
app.get('/api/returns/:id/attachment', (req, res) => {
  const returnId = req.params.id;
  db.query('SELECT attachment FROM Returns WHERE return_id = ?', [returnId], (err, results) => {
    if (err || results.length === 0 || !results[0].attachment) {
      return res.status(404).json({ error: 'المرفق غير موجود' });
    }
    const filePath = path.join(__dirname, results[0].attachment);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'الملف غير موجود على الخادم' });
    }
  });
});
app.put('/api/returns/:id/process', isAuthenticated, (req, res) => {
    const returnId = parseInt(req.params.id); // Fix: Use req.params.id to match route
    if (!req.user || !req.user.id || !req.user.role) {
        return res.status(401).json({ message: 'بيانات المستخدم غير صالحة' });
    }
    if (req.user.role !== 'موظف المستودع') {
        return res.status(403).json({ message: 'غير مصرح لك بتنفيذ هذا الإجراء' });
    }
    // Check if return exists and is approved
    db.query(
        `SELECT return_id FROM Returns WHERE return_id = ? AND status = 'موافق عليه'`,
        [returnId],
        (err, results) => {
            if (err) {
                console.error('خطأ في التحقق من المرتجع:', err);
                return res.status(500).json({ message: 'خطأ في الخادم' });
            }
            if (results.length === 0) {
                return res.status(403).json({ message: 'المرتجع غير موجود أو لم يتم الموافقة عليه بعد' });
            }
            // Update return status
            db.query(
                `UPDATE Returns SET status = 'تمت المعالجة' WHERE return_id = ?`,
                [returnId],
                (err) => {
                    if (err) {
                        console.error('خطأ في معالجة المرتجع:', err);
                        return res.status(500).json({ message: 'خطأ في الخادم' });
                    }
                    res.status(200).json({ message: 'تمت معالجة المرتجع بنجاح' });
                }
            );
        }
    );
});
// نقطة النهاية للموافقة أو الرفض على مرتجع
app.put('/api/returns/:returnId/approve-reject', isAuthenticated, (req, res) => {
  const returnId = parseInt(req.params.returnId);
  const { action, rejection_reason } = req.body;

  // التحقق من أن action موجودة
  if (!action) {
    return res.status(400).json({ error: 'الإجراء مطلوب' });
  }

  // التحقق من أن action صحيحة
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'الإجراء غير صالح' });
  }

  // في حالة الرفض، يجب وجود سبب
  if (action === 'reject' && !rejection_reason) {
    return res.status(400).json({ error: 'يجب تقديم سبب الرفض' });
  }

  // التحقق من صلاحية المستخدم
  if (!req.user || !req.user.id || !req.user.role || req.user.role !== 'مورد') {
    return res.status(403).json({ error: 'غير مصرح لك بتنفيذ هذا الإجراء' });
  }

  // التحقق من وجود المرتجع وحالته "قيد الانتظار"
  const checkReturnQuery = "SELECT order_id, status FROM Returns WHERE return_id = ?";
  db.query(checkReturnQuery, [returnId], (err, returnRows) => {
    if (err) {
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
    if (returnRows.length === 0) {
      return res.status(404).json({ error: 'المرتجع غير موجود' });
    }
    if (returnRows[0].status !== 'قيد الانتظار') {
      return res.status(400).json({ error: 'المرتجع ليس في حالة قيد الانتظار' });
    }

    const orderId = returnRows[0].order_id;

    // تحديث حالة المرتجع
    const updateReturnQuery =
      action === 'approve'
        ? "UPDATE Returns SET status = ? WHERE return_id = ?"
        : "UPDATE Returns SET status = ?, rejection_reason = ? WHERE return_id = ?";
    const updateParams =
      action === 'approve'
        ? ['موافق عليه', returnId]
        : ['مرفوض', rejection_reason, returnId];

    db.query(updateReturnQuery, updateParams, (err) => {
      if (err) {
        return res.status(500).json({ error: 'خطأ في تحديث حالة المرتجع' });
      }

      if (action === 'approve') {
        return res.status(200).json({ message: 'تمت الموافقة على المرتجع بنجاح' });
      }

      // في حالة الرفض: إعادة الكمية إلى OrderItems.stocked_quantity
      const fetchReturnItemsQuery = "SELECT order_item_id, quantity FROM ReturnItems WHERE return_id = ?";
      db.query(fetchReturnItemsQuery, [returnId], (err, returnItems) => {
        if (err) {
          return res.status(500).json({ error: 'خطأ في جلب عناصر المرتجع' });
        }

        if (returnItems.length === 0) {
          return res.status(200).json({ message: 'تم رفض المرتجع بنجاح، لا توجد كميات لإرجاعها' });
        }

        let itemsRestored = 0;
        for (const item of returnItems) {
          const updateStockQuery =
            "UPDATE OrderItems SET stocked_quantity = stocked_quantity - ? WHERE order_item_id = ? AND order_id = ?";
          db.query(updateStockQuery, [item.quantity, item.order_item_id, orderId], (err) => {
            if (err) {
              // محاولة التراجع في حال الخطأ
              db.query("UPDATE Returns SET status = ?, rejection_reason = NULL WHERE return_id = ?", ['قيد الانتظار', returnId], (revertErr) => {
                if (revertErr) {
                  console.error('خطأ في إعادة الحالة إلى قيد الانتظار:', revertErr);
                }
                return res.status(500).json({ error: 'حدث خطأ أثناء إعادة الكمية إلى المخزون' });
              });
              return;
            }

            itemsRestored++;
            if (itemsRestored === returnItems.length) {
              return res.status(200).json({ message: 'تم رفض المرتجع وتمت إعادة الكمية إلى المخزون بنجاح' });
            }
          });
        }
      });
    });
  });
});


// PUT /api/aisles/:id
app.put('/api/aisles/:id', (req, res) => {
    const { aisle_name, team_id } = req.body;
    const { id } = req.params;
    if (!aisle_name || !team_id) {
        return res.status(400).json({ success: false, error: 'اسم الممر ومعرف الفريق مطلوبان' });
    }
    db.query('UPDATE Aisles SET aisle_name = ?, team_id = ? WHERE aisle_id = ?', [aisle_name, team_id, id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true });
    });
});
// DELETE /api/aisles/:id
app.delete('/api/aisles/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT COUNT(*) as shelf_count FROM Shelves WHERE aisle_id = ?', [id], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        if (result[0].shelf_count > 0) {
            return res.status(400).json({ success: false, error: 'لا يمكن حذف الممر لوجود رفوف' });
        }
        db.query('DELETE FROM Aisles WHERE aisle_id = ?', [id], (err) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
            res.json({ success: true });
        });
    });
});
// Update shelf
app.put('/api/shelves/:shelfId', (req, res) => {
    const { shelf_name } = req.body;
    const shelfId = req.params.shelfId;
    if (!shelf_name) {
        return res.status(400).json({ success: false, error: 'اسم الرف مطلوب' });
    }
    db.query('UPDATE Shelves SET shelf_name = ? WHERE shelf_id = ?', [shelf_name, shelfId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'الرف غير موجود' });
        }
        res.json({ success: true });
    });
});
// Delete shelf
app.delete('/api/shelves/:shelfId', (req, res) => {
    const shelfId = req.params.shelfId;
    db.query('SELECT COUNT(*) as sectionCount FROM Sections WHERE shelf_id = ?', [shelfId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        if (result[0].sectionCount > 0) {
            return res.status(400).json({ success: false, error: 'لا يمكن حذف الرف لأنه يحتوي على أقسام' });
        }
        db.query('DELETE FROM Shelves WHERE shelf_id = ?', [shelfId], (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'الرف غير موجود' });
            }
            res.json({ success: true });
        });
    });
});
// Update section
app.put('/api/sections/:sectionId', (req, res) => {
    const { section_name } = req.body;
    const sectionId = req.params.sectionId;
    if (!section_name) {
        return res.status(400).json({ success: false, error: 'اسم القسم مطلوب' });
    }
    db.query('UPDATE Sections SET section_name = ? WHERE section_id = ?', [section_name, sectionId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'القسم غير موجود' });
        }
        res.json({ success: true });
    });
});
// Delete section
app.delete('/api/sections/:sectionId', (req, res) => {
    const sectionId = req.params.sectionId;
    db.query('DELETE FROM Sections WHERE section_id = ?', [sectionId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'القسم غير موجود' });
        }
        res.json({ success: true });
    });
});
// Check if section has products
app.get('/api/sections/:sectionId/has-products', (req, res) => {
    const sectionId = req.params.sectionId;
    const query = `
        SELECT COUNT(*) as productCount
        FROM Stock st
        LEFT JOIN StockProducts sp ON st.stock_id = sp.stock_id
        WHERE st.section_id = ?
    `;
    db.query(query, [sectionId], (err, results) => {
        if (err) {
            console.error('Error checking products in section:', err);
            return res.status(500).json({ success: false, error: 'خطأ في قاعدة البيانات: ' + err.message });
        }
        const hasProducts = results[0].productCount > 0;
        res.json({ success: true, hasProducts });
    });
});
// Check if aisle has products
app.get('/api/aisles/:id/has-products', (req, res) => {
    const { id } = req.params;
    db.query(`
        SELECT COUNT(*) as product_count 
        FROM Products p
        JOIN Sections s ON p.section_id = s.section_id
        JOIN Shelves sh ON s.shelf_id = sh.shelf_id
        WHERE sh.aisle_id = ?
    `, [id], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        const hasProducts = result[0].product_count > 0;
        res.json({ success: true, hasProducts });
    });
});

// Check if shelf has products
app.get('/api/shelves/:shelfId/has-products', (req, res) => {
    const { shelfId } = req.params;
    db.query(`
        SELECT COUNT(*) as product_count 
        FROM Products p
        JOIN Sections s ON p.section_id = s.section_id
        WHERE s.shelf_id = ?
    `, [shelfId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        const hasProducts = result[0].product_count > 0;
        res.json({ success: true, hasProducts });
    });
});

// Fetch section by ID
app.get('/api/section/:section_id', (req, res) => {
    const section_id = req.params.section_id;
    db.query(
        'SELECT section_name FROM Sections WHERE section_id = ?',
        [section_id],
        (err, results) => {
            if (err) {
                console.error('Error fetching section:', err);
                return res.status(500).json({ success: false, error: err.message });
            }
            if (results.length === 0) {
                return res.status(404).json({ success: false, error: 'القسم غير موجود' });
            }
            res.json({ success: true, section: results[0] });
        }
    );
});
// Fetch order items for a specific order
app.get('/api/order-items-stock/:orderId', (req, res) => {
    const orderId = req.params.orderId;
    db.query(
        `SELECT oi.order_item_id, oi.product_id, p.product_name, oi.quantity, oi.stocked_quantity
         FROM OrderItems oi
         JOIN Products p ON oi.product_id = p.product_id
         WHERE oi.order_id = ?`,
        [orderId],
        (err, results) => {
            if (err) {
                console.error('Error fetching order items:', err);
                return res.status(500).json({ success: false, error: err.message });
            }
            res.json({ success: true, orderItems: results });
        }
    );
});
// Fetch specific order item by orderId and productId
app.get('/api/order-items-stock/:orderId/:productId', (req, res) => {
    const { orderId, productId } = req.params;
    db.query(
        `SELECT oi.order_item_id, oi.product_id, p.product_name, oi.quantity, oi.stocked_quantity
         FROM OrderItems oi
         JOIN Products p ON oi.product_id = p.product_id
         WHERE oi.order_id = ? AND oi.product_id = ?`,
        [orderId, productId],
        (err, results) => {
            if (err) {
                console.error('Error fetching order item:', err);
                return res.status(500).json({ success: false, error: err.message });
            }
            if (results.length === 0) {
                return res.status(404).json({ success: false, error: 'عنصر الطلب غير موجود' });
            }
            res.json({ success: true, orderItem: results[0] });
        }
    );
});

// Route لتحديث الكمية
app.put('/api/stock-products/:stockProductId', (req, res) => {
    const stockProductId = req.params.stockProductId;
    const { quantity } = req.body;

    if (typeof quantity !== 'number' || quantity < 0) {
        return res.status(400).json({ success: false, error: 'الكمية يجب أن تكون رقمًا أكبر من أو يساوي 0' });
    }

    // التحقق من وجود المنتج
    db.query('SELECT * FROM StockProducts WHERE stock_product_id = ?', [stockProductId], (err, rows) => {
        if (err) {
            console.error('Error fetching stock product:', err);
            return res.status(500).json({ success: false, error: 'خطأ في جلب بيانات المنتج' });
        }
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
        }

        // تحديث الكمية
        db.query('UPDATE StockProducts SET quantity = ? WHERE stock_product_id = ?', [quantity, stockProductId], (err) => {
            if (err) {
                console.error('Error updating stock product:', err);
                return res.status(500).json({ success: false, error: 'خطأ في تحديث الكمية' });
            }
            res.json({ success: true, message: 'تم تحديث الكمية بنجاح' });
        });
    });
});

// Route لحذف المنتج
app.delete('/api/stock-products/:stockProductId', (req, res) => {
    const stockProductId = req.params.stockProductId;

    // التحقق من وجود المنتج
    db.query('SELECT * FROM StockProducts WHERE stock_product_id = ?', [stockProductId], (err, rows) => {
        if (err) {
            console.error('Error fetching stock product:', err);
            return res.status(500).json({ success: false, error: 'خطأ في جلب بيانات المنتج' });
        }
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
        }

        // حذف المنتج
        db.query('DELETE FROM StockProducts WHERE stock_product_id = ?', [stockProductId], (err) => {
            if (err) {
                console.error('Error deleting stock product:', err);
                return res.status(500).json({ success: false, error: 'خطأ في حذف المنتج' });
            }
            res.json({ success: true, message: 'تم حذف المنتج بنجاح' });
        });
    });
});
app.get('/api/products/:id', (req, res) => {
  const productId = req.params.id;
  
  db.query('SELECT * FROM Products WHERE product_id = ?', [productId], (err, results) => {
    if (err) {
      console.error('Error fetching product:', err);
      return res.status(500).json({ success: false, error: 'خطأ في جلب بيانات المنتج' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }
    
    res.json({ success: true, product: results[0] });
  });
});


  // === المسارات العامة ===
// معالج الأخطاء العام (تم الاحتفاظ بالنسخة التي تحتوي على تسجيل السجلات وإزالة التكرار)
app.use((req, res) => {
    console.log('معالج الأخطاء العام - المسار غير موجود:', req.method, req.originalUrl);
    res.status(404).json({ message: `الطريق ${req.method} ${req.originalUrl} غير موجود` });
  });
  // تشغيل الخادم
  app.listen(PORT, () => {
    console.log(`الخادم يعمل على http://localhost:${PORT}`);
  });