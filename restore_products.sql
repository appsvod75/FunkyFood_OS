-- Restaurar productos completos
-- Ejecutar este script completo en DBeaver

-- 1. Respaldar productos actuales
DROP TABLE IF EXISTS products_backup;
CREATE TABLE products_backup AS SELECT * FROM products;

-- 2. Limpiar tabla products
DELETE FROM products;

-- 3. Insertar todos los productos (en un solo INSERT múltiple)
INSERT INTO `products` (`id`, `name`, `price`, `cost`, `category_id`, `requires_meat`, `is_active`, `available_extras`) VALUES
(101, 'Pan con Ajo', 3.00, NULL, 1, 0, 1, NULL),
(102, 'Nachos', 5.00, NULL, 1, 0, 1, NULL),
(103, 'Jalapeño Relleno', 1.00, NULL, 1, 0, 1, NULL),
(104, 'Jalapeño Especial', 1.50, NULL, 1, 0, 1, NULL),
(105, 'Sopa de Tortilla', 3.00, NULL, 1, 0, 1, NULL),
(106, 'Sopa de Tortilla XL', 5.00, NULL, 1, 0, 1, NULL),
(201, '3 Tacos', 3.75, NULL, 2, 1, 1, NULL),
(202, '4 Tacos', 4.50, NULL, 2, 1, 1, NULL),
(203, '5 Tacos', 5.50, NULL, 2, 1, 1, NULL),
(204, '6 Tacos', 7.00, NULL, 2, 1, 1, NULL),
(205, '3 Tacos Dorados', 4.50, NULL, 2, 1, 1, NULL),
(206, '4 Tacos Dorados', 5.50, NULL, 2, 1, 1, NULL),
(207, '5 Tacos Dorados', 6.50, NULL, 2, 1, 1, NULL),
(301, 'Burrito', 4.50, NULL, 3, 1, 1, NULL),
(302, 'Burrito 3 Quesos', 6.00, NULL, 3, 1, 1, NULL),
(303, 'Burrito Pizza', 6.00, NULL, 3, 1, 1, NULL),
(304, 'Burrito XL', 6.50, NULL, 3, 1, 1, NULL),
(401, 'Torta', 4.50, NULL, 4, 1, 1, NULL),
(402, 'Torta de Jamon', 4.50, NULL, 4, 0, 1, NULL),
(403, 'Torta de Tocino', 5.00, NULL, 4, 0, 1, NULL),
(404, 'Torta Pizza', 6.00, NULL, 4, 1, 1, NULL),
(405, 'Torta Cubana', 6.00, NULL, 4, 0, 1, NULL),
(406, 'Torta 3 Quesos', 6.00, NULL, 4, 1, 1, NULL),
(407, 'Torta Tapa Arterias', 10.00, NULL, 4, 0, 1, NULL),
(501, 'Gringas', 3.75, NULL, 5, 1, 1, NULL),
(502, 'Alambre', 5.75, NULL, 5, 1, 1, NULL),
(503, 'Pizza Mexicana', 9.00, NULL, 5, 0, 1, NULL),
(504, 'Hamburguesa (sin papas)', 3.50, NULL, 5, 0, 1, NULL),
(505, 'Quesadillas XL', 6.00, NULL, 5, 1, 1, NULL),
(506, 'Burrito 3 Quesos XL', 9.50, NULL, 5, 1, 1, NULL),
(507, 'Taquiza', 20.00, NULL, 5, 0, 1, NULL),
(508, 'Taquiza de Res', 22.00, NULL, 5, 0, 1, NULL),
(601, 'Carne Asada', 5.50, NULL, 6, 0, 1, NULL),
(602, 'Pechuga Asada', 5.50, NULL, 6, 0, 1, NULL),
(603, 'Lomito Asado', 5.50, NULL, 6, 0, 1, NULL),
(604, 'Camarones', 6.50, NULL, 6, 0, 1, NULL),
(605, 'Costilla Ahumada', 6.50, NULL, 6, 0, 1, NULL),
(606, 'Mar y Tierra', 8.00, NULL, 6, 0, 1, NULL),
(701, '3 Tacos Birria', 4.25, NULL, 7, 0, 1, NULL),
(702, '4 Tacos Birria', 5.25, NULL, 7, 0, 1, NULL),
(703, '5 Tacos Birria', 6.25, NULL, 7, 0, 1, NULL),
(704, '6 Tacos Birria', 8.50, NULL, 7, 0, 1, NULL),
(705, '3 Tacos Dorados Birria', 5.25, NULL, 7, 0, 1, NULL),
(706, '4 Tacos Dorados Birria', 6.50, NULL, 7, 0, 1, NULL),
(707, '5 Tacos Dorados Birria', 7.25, NULL, 7, 0, 1, NULL),
(708, 'Burrito Birria', 5.50, NULL, 7, 0, 1, NULL),
(709, 'Burrito 3 Quesos (Birria)', 7.00, NULL, 7, 0, 1, NULL),
(710, 'Burrito XL (Birria)', 8.00, NULL, 7, 0, 1, NULL),
(711, 'Torta Birria', 5.50, NULL, 7, 0, 1, NULL),
(712, 'Torta Pizza (Birria)', 7.25, NULL, 7, 0, 1, NULL),
(713, 'Torta 3 Quesos (Birria)', 7.00, NULL, 7, 0, 1, NULL),
(714, 'Nachos (Birria)', 6.00, NULL, 7, 0, 1, NULL),
(715, 'Alambre (Birria)', 6.75, NULL, 7, 0, 1, NULL),
(716, 'Pizza Birria', 10.50, NULL, 7, 0, 1, NULL),
(717, 'Quesabirria', 4.25, NULL, 7, 0, 1, NULL),
(718, 'Quesabirria XL', 8.00, NULL, 7, 0, 1, NULL),
(719, 'Taquiza de Birria', 25.00, NULL, 7, 0, 1, NULL),
(801, 'Refresco', 1.50, NULL, 8, 0, 1, NULL),
(802, 'Agua Fresca', 1.25, NULL, 8, 0, 1, NULL),
(803, 'Cerveza', 2.50, NULL, 8, 0, 1, NULL);

-- Verificar que se insertaron correctamente
SELECT COUNT(*) as total_productos FROM products;
SELECT * FROM products ORDER BY id;
