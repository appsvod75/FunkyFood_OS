-- Database Schema for RestauranteOS.V1

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for branches
-- ----------------------------
DROP TABLE IF EXISTS `branches`;
CREATE TABLE `branches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `gas_webhook_url` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Records of branches
-- ----------------------------
INSERT INTO `branches` VALUES (1, 'Sucursal Principal', 'Central', NULL, 1, NULL);

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `username` varchar(100) DEFAULT NULL,
  `pin` varchar(10) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `branch_id` int DEFAULT NULL,
  `roles` json DEFAULT NULL COMMENT 'JSON array of roles',
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  CONSTRAINT `fk_users_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Records of users
-- ----------------------------
INSERT INTO `users` VALUES (1, 'Super Admin', 'superadmin', '020518', 1, 1, '["SuperAdmin"]');
INSERT INTO `users` VALUES (2, 'Administrador', 'admin', '222222', 1, 1, '["Administrador"]');
INSERT INTO `users` VALUES (3, 'Carlos', 'mesero', '333333', 1, 1, '["Mesero"]');
INSERT INTO `users` VALUES (4, 'Ana', 'ana', '444444', 1, 1, '["Mesero"]');
INSERT INTO `users` VALUES (5, 'Luis', 'luis', '555555', 1, 1, '["Mesero", "Cocinero"]');
INSERT INTO `users` VALUES (6, 'Parrilla 1', 'cocinero', '666666', 1, 1, '["Cocinero"]');

-- ----------------------------
-- Table structure for tables
-- ----------------------------
DROP TABLE IF EXISTS `tables`;
CREATE TABLE `tables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `branch_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  CONSTRAINT `fk_tables_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Records of tables
-- ----------------------------
INSERT INTO `tables` VALUES (1, 'Mesa 1', 1);
INSERT INTO `tables` VALUES (2, 'Mesa 2', 1);
INSERT INTO `tables` VALUES (3, 'Mesa 3', 1);
INSERT INTO `tables` VALUES (4, 'Mesa 4', 1);
INSERT INTO `tables` VALUES (5, 'Mesa 5', 1);
INSERT INTO `tables` VALUES (6, 'Mesa 6', 1);
INSERT INTO `tables` VALUES (7, 'Mesa 7', 1);
INSERT INTO `tables` VALUES (8, 'Mesa 8', 1);
INSERT INTO `tables` VALUES (9, 'Mesa 9', 1);
INSERT INTO `tables` VALUES (10, 'Mesa 10', 1);
INSERT INTO `tables` VALUES (11, 'Mesa 11', 1);
INSERT INTO `tables` VALUES (12, 'Mesa 12', 1);

-- ----------------------------
-- Table structure for categories
-- ----------------------------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Records of categories
-- ----------------------------
INSERT INTO `categories` VALUES (1, 'Entradas');
INSERT INTO `categories` VALUES (2, 'Tacos');
INSERT INTO `categories` VALUES (3, 'Burritos');
INSERT INTO `categories` VALUES (4, 'Tortas');
INSERT INTO `categories` VALUES (5, 'Especiales');
INSERT INTO `categories` VALUES (6, 'Asados');
INSERT INTO `categories` VALUES (7, 'Birria');
INSERT INTO `categories` VALUES (8, 'Bebidas');

-- ----------------------------
-- Table structure for meats
-- ----------------------------
DROP TABLE IF EXISTS `meats`;
CREATE TABLE `meats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Records of meats
-- ----------------------------
INSERT INTO `meats` VALUES (1, 'Res');
INSERT INTO `meats` VALUES (2, 'Pollo');
INSERT INTO `meats` VALUES (3, 'Pastor');
INSERT INTO `meats` VALUES (4, 'Mixta');
INSERT INTO `meats` VALUES (5, 'Chorizo');

-- ----------------------------
-- Table structure for product_extras
-- ----------------------------
DROP TABLE IF EXISTS `product_extras`;
CREATE TABLE `product_extras` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for products
-- ----------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `cost` decimal(10,2) DEFAULT NULL,
  `category_id` int NOT NULL,
  `requires_meat` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `available_extras` json DEFAULT NULL COMMENT 'Array of extra IDs',
  PRIMARY KEY (`id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=804 DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Records of products
-- ----------------------------
INSERT INTO `products` VALUES (101, 'Pan con Ajo', 3.00, NULL, 1, 0, 1, NULL);
INSERT INTO `products` VALUES (102, 'Nachos', 5.00, NULL, 1, 0, 1, NULL);
INSERT INTO `products` VALUES (103, 'Jalapeño Relleno', 1.00, NULL, 1, 0, 1, NULL);
INSERT INTO `products` VALUES (104, 'Jalapeño Especial', 1.50, NULL, 1, 0, 1, NULL);
INSERT INTO `products` VALUES (105, 'Sopa de Tortilla', 3.00, NULL, 1, 0, 1, NULL);
INSERT INTO `products` VALUES (106, 'Sopa de Tortilla XL', 5.00, NULL, 1, 0, 1, NULL);
INSERT INTO `products` VALUES (201, '3 Tacos', 3.75, NULL, 2, 1, 1, NULL);
INSERT INTO `products` VALUES (202, '4 Tacos', 4.50, NULL, 2, 1, 1, NULL);
INSERT INTO `products` VALUES (203, '5 Tacos', 5.50, NULL, 2, 1, 1, NULL);
INSERT INTO `products` VALUES (204, '6 Tacos', 7.00, NULL, 2, 1, 1, NULL);
INSERT INTO `products` VALUES (205, '3 Tacos Dorados', 4.50, NULL, 2, 1, 1, NULL);
INSERT INTO `products` VALUES (206, '4 Tacos Dorados', 5.50, NULL, 2, 1, 1, NULL);
INSERT INTO `products` VALUES (207, '5 Tacos Dorados', 6.50, NULL, 2, 1, 1, NULL);
INSERT INTO `products` VALUES (301, 'Burrito', 4.50, NULL, 3, 1, 1, NULL);
INSERT INTO `products` VALUES (302, 'Burrito 3 Quesos', 6.00, NULL, 3, 1, 1, NULL);
INSERT INTO `products` VALUES (303, 'Burrito Pizza', 6.00, NULL, 3, 1, 1, NULL);
INSERT INTO `products` VALUES (304, 'Burrito XL', 6.50, NULL, 3, 1, 1, NULL);
INSERT INTO `products` VALUES (401, 'Torta', 4.50, NULL, 4, 1, 1, NULL);
INSERT INTO `products` VALUES (402, 'Torta de Jamon', 4.50, NULL, 4, 0, 1, NULL);
INSERT INTO `products` VALUES (403, 'Torta de Tocino', 5.00, NULL, 4, 0, 1, NULL);
INSERT INTO `products` VALUES (404, 'Torta Pizza', 6.00, NULL, 4, 1, 1, NULL);
INSERT INTO `products` VALUES (405, 'Torta Cubana', 6.00, NULL, 4, 0, 1, NULL);
INSERT INTO `products` VALUES (406, 'Torta 3 Quesos', 6.00, NULL, 4, 1, 1, NULL);
INSERT INTO `products` VALUES (407, 'Torta Tapa Arterias', 10.00, NULL, 4, 0, 1, NULL);
INSERT INTO `products` VALUES (501, 'Gringas', 3.75, NULL, 5, 1, 1, NULL);
INSERT INTO `products` VALUES (502, 'Alambre', 5.75, NULL, 5, 1, 1, NULL);
INSERT INTO `products` VALUES (503, 'Pizza Mexicana', 9.00, NULL, 5, 0, 1, NULL);
INSERT INTO `products` VALUES (504, 'Hamburguesa (sin papas)', 3.50, NULL, 5, 0, 1, NULL);
INSERT INTO `products` VALUES (505, 'Quesadillas XL', 6.00, NULL, 5, 1, 1, NULL);
INSERT INTO `products` VALUES (506, 'Burrito 3 Quesos XL', 9.50, NULL, 5, 1, 1, NULL);
INSERT INTO `products` VALUES (507, 'Taquiza', 20.00, NULL, 5, 0, 1, NULL);
INSERT INTO `products` VALUES (508, 'Taquiza de Res', 22.00, NULL, 5, 0, 1, NULL);
INSERT INTO `products` VALUES (601, 'Carne Asada', 5.50, NULL, 6, 0, 1, NULL);
INSERT INTO `products` VALUES (602, 'Pechuga Asada', 5.50, NULL, 6, 0, 1, NULL);
INSERT INTO `products` VALUES (603, 'Lomito Asado', 5.50, NULL, 6, 0, 1, NULL);
INSERT INTO `products` VALUES (604, 'Camarones', 6.50, NULL, 6, 0, 1, NULL);
INSERT INTO `products` VALUES (605, 'Costilla Ahumada', 6.50, NULL, 6, 0, 1, NULL);
INSERT INTO `products` VALUES (606, 'Mar y Tierra', 8.00, NULL, 6, 0, 1, NULL);
INSERT INTO `products` VALUES (701, '3 Tacos Birria', 4.25, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (702, '4 Tacos Birria', 5.25, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (703, '5 Tacos Birria', 6.25, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (704, '6 Tacos Birria', 8.50, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (705, '3 Tacos Dorados Birria', 5.25, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (706, '4 Tacos Dorados Birria', 6.50, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (707, '5 Tacos Dorados Birria', 7.25, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (708, 'Burrito Birria', 5.50, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (709, 'Burrito 3 Quesos (Birria)', 7.00, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (710, 'Burrito XL (Birria)', 8.00, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (711, 'Torta Birria', 5.50, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (712, 'Torta Pizza (Birria)', 7.25, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (713, 'Torta 3 Quesos (Birria)', 7.00, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (714, 'Nachos (Birria)', 6.00, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (715, 'Alambre (Birria)', 6.75, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (716, 'Pizza Birria', 10.50, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (717, 'Quesabirria', 4.25, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (718, 'Quesabirria XL', 8.00, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (719, 'Taquiza de Birria', 25.00, NULL, 7, 0, 1, NULL);
INSERT INTO `products` VALUES (801, 'Refresco', 1.50, NULL, 8, 0, 1, NULL);
INSERT INTO `products` VALUES (802, 'Agua Fresca', 1.25, NULL, 8, 0, 1, NULL);
INSERT INTO `products` VALUES (803, 'Cerveza', 2.50, NULL, 8, 0, 1, NULL);

-- ----------------------------
-- Table structure for customers
-- ----------------------------
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1000 DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Records of customers
-- ----------------------------
INSERT INTO `customers` VALUES (1, 'Juan Pérez', '77889900', 'juan@example.com');
INSERT INTO `customers` VALUES (2, 'Maria Garcia', '66554433', NULL);
INSERT INTO `customers` VALUES (999, 'Clientes Varios', '00000000', NULL);

-- ----------------------------
-- Table structure for customer_addresses
-- ----------------------------
DROP TABLE IF EXISTS `customer_addresses`;
CREATE TABLE `customer_addresses` (
  `id` varchar(50) NOT NULL,
  `customer_id` int NOT NULL,
  `street` varchar(255) NOT NULL,
  `city` varchar(100) NOT NULL,
  `details` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `fk_addresses_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `customer_addresses` VALUES ('addr1', 1, 'Calle Falsa 123', 'Ciudad', NULL);

-- ----------------------------
-- Table structure for orders
-- ----------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` varchar(50) NOT NULL,
  `branch_id` int NOT NULL,
  `daily_order_number` int NOT NULL,
  `type` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `kitchen_status` varchar(20) DEFAULT 'pending',
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tax` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `delivery_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  `ready_at` datetime DEFAULT NULL,
  `waiter_id` int DEFAULT NULL,
  `chef` varchar(100) DEFAULT NULL,
  `table_id` int DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `delivery_address_id` varchar(50) DEFAULT NULL,
  `amount_paid` decimal(10,2) DEFAULT '0.00',
  `change_given` decimal(10,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  KEY `waiter_id` (`waiter_id`),
  KEY `table_id` (`table_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `fk_orders_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_orders_waiter` FOREIGN KEY (`waiter_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_orders_table` FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`),
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for order_items
-- ----------------------------
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` varchar(50) NOT NULL,
  `order_id` varchar(50) NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `meat_id` int DEFAULT NULL,
  `total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `observations` text,
  `completed` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `fk_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for order_item_extras
-- ----------------------------
DROP TABLE IF EXISTS `order_item_extras`;
CREATE TABLE `order_item_extras` (
  `order_item_id` varchar(50) NOT NULL,
  `extra_id` int NOT NULL,
  PRIMARY KEY (`order_item_id`,`extra_id`),
  CONSTRAINT `fk_itemextras_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_itemextras_extra` FOREIGN KEY (`extra_id`) REFERENCES `product_extras` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for payments
-- ----------------------------
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `method` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for order_audit_logs
-- ----------------------------
DROP TABLE IF EXISTS `order_audit_logs`;
CREATE TABLE `order_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `branch_id` int NOT NULL,
  `order_data` json NOT NULL COMMENT 'Full JSON dump of the deleted order including items',
  `deleted_by_user_id` int DEFAULT NULL,
  `deleted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  KEY `deleted_by_user_id` (`deleted_by_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
