// warehouse.js
const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "WMS_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.connect((err) => {
    if (err) {
        console.error("خطأ في الاتصال بقاعدة البيانات:", err);
        return;
    }
    console.log("تم الاتصال بقاعدة البيانات بنجاح من warehouse.js");
});

module.exports = db;