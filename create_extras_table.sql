-- Script to create missing table order_item_extras

CREATE TABLE IF NOT EXISTS `order_item_extras` (
  `order_item_id` varchar(50) NOT NULL,
  `extra_id` int NOT NULL,
  PRIMARY KEY (`order_item_id`,`extra_id`),
  CONSTRAINT `fk_itemextras_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_itemextras_extra` FOREIGN KEY (`extra_id`) REFERENCES `product_extras` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
