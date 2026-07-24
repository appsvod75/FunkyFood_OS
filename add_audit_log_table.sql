-- Add order_audit_logs table

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
