import { PromotionRule, OrderItem } from '../types';

export interface AppliedDiscount {
    promotionId: number;
    promotionName: string;
    amount: number;
    description: string;
}

export const calculatePromotions = (items: OrderItem[], promotions: PromotionRule[]): AppliedDiscount[] => {
    const discounts: AppliedDiscount[] = [];
    const now = new Date();

    // 1. Filter active promotions based on rules
    const activePromos = promotions.filter(p => {
        if (!p.isActive) return false;

        // Use local date string YYYY-MM-DD
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const currentDateStr = `${year}-${month}-${day}`;

        if (p.start_date) {
            // p.start_date is likely "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD". 
            // We only care about the date part.
            const startDateStr = String(p.start_date).split(' ')[0].split('T')[0];
            if (startDateStr > currentDateStr) return false;
        }
        if (p.end_date) {
            const endDateStr = String(p.end_date).split(' ')[0].split('T')[0];
            if (endDateStr < currentDateStr) return false;
        }

        if (p.days_of_week && p.days_of_week.length > 0 && !p.days_of_week.includes(now.getDay())) return false;

        const currentTimeStr = now.toTimeString().slice(0, 5); // "14:30"
        if (p.start_time && currentTimeStr < p.start_time) return false;
        if (p.end_time && currentTimeStr > p.end_time) return false;

        return true;
    }).sort((a, b) => b.priority - a.priority);

    // 2. Track consumed quantity per item
    const consumedMap = new Map<string, number>(); // itemId -> consumedQuantity
    items.forEach(i => consumedMap.set(i.id, 0));

    // Helper to get eligible items that have remaining quantity
    const getEligibleItems = (rule: PromotionRule) => {
        return items.filter(i => {
            let match = false;
            if (rule.target_type === 'GLOBAL') match = true;
            else if (rule.target_type === 'PRODUCT') match = (rule.target_ids || []).includes(i.product.id);
            else if (rule.target_type === 'CATEGORY') match = (rule.target_ids || []).includes(i.product.categoryId);

            if (!match) return false;

            const consumed = consumedMap.get(i.id) || 0;
            return (i.quantity - consumed) > 0;
        });
    };

    // 3. Apply promotions
    for (const promo of activePromos) {

        if (promo.type === 'QUANTITY') {
            const trigger = promo.trigger_quantity || 2;
            if (trigger <= 0) continue;

            const eligible = getEligibleItems(promo);

            let pool: { itemId: string, price: number }[] = [];
            eligible.forEach(i => {
                const consumed = consumedMap.get(i.id) || 0;
                const available = i.quantity - consumed;
                for (let k = 0; k < available; k++) {
                    pool.push({ itemId: i.id, price: Number(i.product.price) });
                }
            });

            // Sort by price DESCENDING (Highest price first)
            // We favor the customer by discounting the most expensive items first if strict multiples are found.
            pool.sort((a, b) => b.price - a.price);

            const totalAvailable = pool.length;
            const sets = Math.floor(totalAvailable / trigger);

            if (sets > 0) {
                // Logic Adjustment: Discount applied to ALL items in the set.
                // 3x2 (Buy 3, Pay 2) -> Trigger 3. Sets = 1. UnitsToDiscount = 3.
                // BUT User wants "Discount of 0.50 per unit".
                // If Promo is 2x1 -> Trigger 2. Discount 100%. 
                // If apply 100% to ALL, it is FREE. Not 2x1.

                // WAIT. User said: "si fueran 4 las cuatro aplican el descuento... si fueran 5, 4 si y una no".
                // WITH "descuento de 0.50".
                // This implies "Bulk Pricing" logic.

                const unitsToDiscount = sets * trigger;
                let discountAmount = 0;

                for (let k = 0; k < unitsToDiscount; k++) {
                    const targetUnit = pool[k];
                    const val = promo.discount_type === 'PERCENTAGE'
                        ? (targetUnit.price * Number(promo.discount_value) / 100)
                        : Number(promo.discount_value);
                    discountAmount += val;

                    // Mark as consumed
                    const currentConsumed = consumedMap.get(targetUnit.itemId) || 0;
                    consumedMap.set(targetUnit.itemId, currentConsumed + 1);
                }

                discounts.push({
                    promotionId: promo.id,
                    promotionName: promo.name,
                    amount: discountAmount,
                    description: `${promo.name} (${unitsToDiscount} items)`
                });
            }

        } else if (['HAPPY_HOUR', 'EVENT', 'CATEGORY', 'GLOBAL', 'BIRTHDAY'].includes(promo.type)) {
            const eligible = getEligibleItems(promo);
            let promoDiscount = 0;

            eligible.forEach(i => {
                const consumed = consumedMap.get(i.id) || 0;
                const available = i.quantity - consumed;

                if (available > 0) {
                    const unitPrice = i.total / i.quantity;
                    const val = promo.discount_type === 'PERCENTAGE'
                        ? (unitPrice * Number(promo.discount_value) / 100)
                        : Number(promo.discount_value);
                    const totalVal = val * available;

                    promoDiscount += totalVal;

                    consumedMap.set(i.id, consumed + available);
                }
            });

            if (promoDiscount > 0) {
                discounts.push({
                    promotionId: promo.id,
                    promotionName: promo.name,
                    amount: promoDiscount,
                    description: promo.name
                });
            }
        }
    }

    return discounts;
};
