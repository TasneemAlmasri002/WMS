-- إنشاء قاعدة البيانات
CREATE DATABASE IF NOT EXISTS WMS_db;
USE WMS_db;

-- جدول المستخدمين
CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL ,
    
    email VARCHAR(100) NOT NULL UNIQUE CHECK (email LIKE '%@%.%'),
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(13) NOT NULL,
    role ENUM('مسؤول النظام', 'مدير', 'مورد', 'موظف المستودع', 'موظف التتبع و الفواتير') NOT NULL,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- جدول الموردين
CREATE TABLE Suppliers (
    supplier_id INT PRIMARY KEY,
    suppliername VARCHAR(50) NOT NULL ,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    address VARCHAR(255),
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    FOREIGN KEY (supplier_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE Teams (
    team_id INT AUTO_INCREMENT PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL,
    description TEXT,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE UserTeams (
    user_id INT,
    team_id INT,
    PRIMARY KEY (user_id, team_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES Teams(team_id) ON DELETE CASCADE
);

-- جدول الشركات المصنعة
CREATE TABLE Manufacturers (
    manufacturer_id INT AUTO_INCREMENT PRIMARY KEY,
    manufacturer_name VARCHAR(100) NOT NULL,
    contact_info VARCHAR(255)
);
CREATE TABLE TeamManufacturers (
  team_id INT,
  manufacturer_id INT,
  PRIMARY KEY (team_id, manufacturer_id),
  FOREIGN KEY (team_id) REFERENCES Teams(team_id) ON DELETE CASCADE,
  FOREIGN KEY (manufacturer_id) REFERENCES Manufacturers(manufacturer_id) ON DELETE CASCADE
);

-- جدول الأصناف
CREATE TABLE Categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL
);

-- جدول ربط الأصناف بالشركات المصنعة
CREATE TABLE ManufacturerCategories (
    manufacturer_id INT,
    category_id INT,
    PRIMARY KEY (manufacturer_id, category_id),
    FOREIGN KEY (manufacturer_id) REFERENCES Manufacturers(manufacturer_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES Categories(category_id) ON DELETE CASCADE
);

-- جدول المنتجات
CREATE TABLE Products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    description TEXT,
    barcode VARCHAR(50),
    manufacturer_id INT,
    category_id INT,
    unit VARCHAR(20) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
	quantity INT NOT NULL DEFAULT 0,
    FOREIGN KEY (manufacturer_id) REFERENCES Manufacturers(manufacturer_id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES Categories(category_id) ON DELETE SET NULL
);

-- جدول الطلبات
CREATE TABLE Orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT,
    employee_id INT,
    manufacturer_id INT, -- إضافة حقل لربط الطلب بالشركة المصنعة
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('قيد الانتظار', 'موافق عليه', 'مرفوض', 'تفاصيل إضافية', 'مكتمل') DEFAULT 'قيد الانتظار',
    payment_status ENUM('مدفوع', 'غير مدفوع') DEFAULT 'غير مدفوع',
	payment_terms ENUM('عند الاستلام', 'تحويل بنكي', 'بطاقة ائتمان') NULL,
    delivery_status ENUM('قيد الشحن', 'تم التوصيل', 'تم الإلغاء') DEFAULT 'قيد الشحن',
    amount DECIMAL(10, 2),
    rejection_reason TEXT,
    payment_date datetime,
    notes TEXT,
    sales_rep_name VARCHAR(100),
    sales_rep_phone VARCHAR(20),
	sales_rep_pin CHAR(4),
    FOREIGN KEY (employee_id) REFERENCES Users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES Users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (manufacturer_id) REFERENCES Manufacturers(manufacturer_id) ON DELETE SET NULL
);

-- جدول تفاصيل الطلبات (OrderItems)
CREATE TABLE OrderItems (
    order_item_id INT  AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT NOT NULL CHECK (quantity > 0),
	price DECIMAL(10, 2) NOT NULL DEFAULT 0.00  ,
    stocked_quantity INT DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE
);

-- جدول المرتجعات
CREATE TABLE Returns (
    return_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('قيد الانتظار', 'موافق عليه', 'مرفوض', 'تمت المعالجة') DEFAULT 'قيد الانتظار',
	rejection_reason TEXT ,
	user_id INT,
    category ENUM('تالف', 'غير مطابق', 'أخرى'),
    return_type ENUM('full', 'partial') DEFAULT 'full',
    notes Text,
    attachment VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE
);

CREATE TABLE ReturnItems (
    return_item_id INT AUTO_INCREMENT PRIMARY KEY,
    return_id INT,
    order_item_id INT,
    quantity INT NOT NULL CHECK (quantity > 0),
    FOREIGN KEY (return_id) REFERENCES Returns(return_id) ON DELETE CASCADE,
    FOREIGN KEY (order_item_id) REFERENCES OrderItems(order_item_id) ON DELETE CASCADE
);

-- جدول ربط الموردين بالشركات المصنعة
CREATE TABLE Supplier_Manufacturers (
    supplier_id INT,
    manufacturer_id INT,
    purchase_terms VARCHAR(255), -- شروط الشراء (اختياري)
    PRIMARY KEY (supplier_id, manufacturer_id),
    FOREIGN KEY (supplier_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (manufacturer_id) REFERENCES Manufacturers(manufacturer_id) ON DELETE CASCADE
);


CREATE TABLE Cart (
    cart_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    notes TEXT,
    manufacturer_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (manufacturer_id) REFERENCES Manufacturers(manufacturer_id) ON DELETE CASCADE
);

-- إنشاء جدول OrderReservations لتتبع الكميات المحجوزة عند إرسال الطلب
CREATE TABLE OrderReservations (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    reserved_quantity INT NOT NULL CHECK (reserved_quantity > 0),
    reservation_expiry DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE
);

--  الممرات (جديد)
CREATE TABLE Aisles (
    aisle_id INT AUTO_INCREMENT PRIMARY KEY,
    aisle_name VARCHAR(100) NOT NULL,
    team_id INT, -- الجروب (الفريق) المسؤول عن الممر
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES Teams(team_id) ON DELETE SET NULL
);

--   رفوف 
CREATE TABLE Shelves (
    shelf_id INT AUTO_INCREMENT PRIMARY KEY,
    aisle_id INT NOT NULL,
    shelf_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (aisle_id) REFERENCES Aisles(aisle_id) ON DELETE CASCADE
);

-- الأقسام 
CREATE TABLE Sections (
    section_id INT AUTO_INCREMENT PRIMARY KEY,
    shelf_id INT NOT NULL,
    section_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shelf_id) REFERENCES Shelves(shelf_id) ON DELETE CASCADE
);

-- جدول المخزون
CREATE TABLE Stock (
    stock_id INT AUTO_INCREMENT PRIMARY KEY,
    section_id INT NOT NULL,
    total_quantity INT NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
    initial_quantity INT NOT NULL DEFAULT 0 CHECK (initial_quantity >= 0),--  Stock لإضافة حقل initial_quantity
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES Sections(section_id) ON DELETE CASCADE
);

-- جدول منتجات المخزون
CREATE TABLE StockProducts (
    stock_product_id INT AUTO_INCREMENT PRIMARY KEY,
    stock_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    manufacturing_date DATE,
    expiration_date DATE,
    stock_entry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    alert_entry_date DATE,
    initial_quantity INT NOT NULL DEFAULT 0 CHECK (initial_quantity >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES Stock(stock_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE
);
-- جدول المواد المتلفة/المنتهية المعدل 
CREATE TABLE DamagedItems (
    damage_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    section_id INT NOT NULL,
    stock_product_id INT, 
    order_id INT, 
    quantity INT NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL, -- سعر المنتج وقت التلف
    damage_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    reported_by INT NOT NULL, -- المستخدم الذي أبلغ عن التلف
    processed_by INT, -- المستخدم الذي قام بالمعالجة (إضافة جديدة)
    damage_type varchar(50),
    damage_reason TEXT, -- سبب التلف الرئيسي
    notes TEXT, -- ملاحظات إضافية
    attachment VARCHAR(255), 
    
    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES Sections(section_id) ON DELETE CASCADE,
    FOREIGN KEY (stock_product_id) REFERENCES StockProducts(stock_product_id) ON DELETE SET NULL,
 FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE SET NULL,
    FOREIGN KEY (reported_by) REFERENCES Users(user_id) ON DELETE CASCADE,
FOREIGN KEY (processed_by) REFERENCES Users(user_id) ON DELETE SET NULL
);

-- جدول عمليات النقل إلى المتجر
CREATE TABLE StoreTransfers (
    transfer_id INT AUTO_INCREMENT PRIMARY KEY,
     stock_product_id INT ,
    product_id INT NOT NULL,
    from_section_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    transfer_date DATE NOT NULL,
    notes TEXT,
    transferred_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_product_id) REFERENCES StockProducts(stock_product_id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (from_section_id) REFERENCES Sections(section_id) ON DELETE CASCADE,
    FOREIGN KEY (transferred_by) REFERENCES Users(user_id) ON DELETE CASCADE
);

ALTER TABLE StockProducts
ADD COLUMN order_id INT,
ADD CONSTRAINT fk_stockproducts_order_id FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE SET NULL;