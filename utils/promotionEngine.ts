import { PromotionRule, OrderItem } from '../types';
import { getElSalvadorDateString } from './dates';

export interface AppliedDiscount {
    promotionId: number;
    promotionName: string;
    amount: number;
    description: string;
}

const SV_TIMEZONE = 'America/El_Salvador';

// Promo types that apply a per-item discount (handled identically in getItemPromoInfo and calculatePromotions)
const DISCOUNTABLE_TYPES = ['HAPPY_HOUR', 'EVENT', 'CATEGORY', 'GLOBAL', 'BIRTHDAY', 'COMBO'];

export const isPromoActive = (p: PromotionRule, now: Date = new Date()): boolean => {
    if (!p.isActive) return false;

    // Use El Salvador date string YYYY-MM-DD
    const currentDateStr = getElSalvadorDateString();

    if (p.start_date) {
        const startDateStr = String(p.start_date).split(' ')[0].split('T')[0];
        if (startDateStr > currentDateStr) return false;
    }
    if (p.end_date) {
        const endDateStr = String(p.end_date).split(' ')[0].split('T')[0];
        if (endDateStr < currentDateStr) return false;
    }

    if (p.days_of_week && p.days_of_week.length > 0 && !p.days_of_week.includes(now.getDay())) return false;

    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: SV_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
    });
    const currentTimeStr = timeFormatter.format(now); // "14:30"
    if (p.start_time) {
        if (p.end_time && p.end_time < p.start_time) {
            // Overnight window (crosses midnight): active from start_time to 23:59 OR 00:00 to end_time
            const insideOvernight = currentTimeStr >= p.start_time || currentTimeStr <= p.end_time;
            if (!insideOvernight) return false;
        } else if (currentTimeStr < p.start_time) {
            return false;
        }
    }
    if (p.end_time && !(p.end_time < p.start_time) && currentTimeStr > p.end_time) return false;

    return true;
};

export const matchesItem = (p: PromotionRule, item: OrderItem): boolean => {
    if (p.target_type === 'GLOBAL') return true;
    if (p.target_type === 'PRODUCT') return (p.target_ids || []).includes(item.product.id);
    if (p.target_type === 'CATEGORY') return (p.target_ids || []).includes(item.product.categoryId);
    return false;
};

export interface ItemPromoInfo {
    promoName: string;
    promoId: number;
    unitPrice: number;
    quantity: number;
}

export const getItemPromoInfo = (item: OrderItem, promotions: PromotionRule[]): ItemPromoInfo | null => {
    const unitPrice = item.quantity > 0 ? item.total / item.quantity : 0;
    const active = promotions
        .filter(p => isPromoActive(p) && DISCOUNTABLE_TYPES.includes(p.type))
        .sort((a, b) => b.priority - a.priority);

    for (const promo of active) {
        if (!matchesItem(promo, item)) continue;

        const effective = promo.discount_type === 'PERCENTAGE'
            ? unitPrice * (1 - Number(promo.discount_value) / 100)
            : promo.discount_type === 'FIXED_PRICE'
                ? Math.min(unitPrice, Number(promo.discount_value))
                : Math.max(0, unitPrice - Number(promo.discount_value));

        return {
            promoName: promo.name,
            promoId: promo.id,
            unitPrice: effective,
            quantity: item.quantity,
        };
    }
    return null;
};

export const calculatePromotions = (items: OrderItem[], promotions: PromotionRule[]): AppliedDiscount[] => {
    const discounts: AppliedDiscount[] = [];
    const now = new Date();

    // 1. Filter active promotions based on rules
    const activePromos = promotions.filter(p => isPromoActive(p, now)).sort((a, b) => b.priority - a.priority);

    // 2. Track consumed quantity per item
    const consumedMap = new Map<string, number>(); // itemId -> consumedQuantity
    items.forEach(i => consumedMap.set(i.id, 0));

    // Helper to get eligible items that have remaining quantity
    const getEligibleItems = (rule: PromotionRule) => {
        return items.filter(i => {
            const match = matchesItem(rule, i);

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
                        : promo.discount_type === 'FIXED_PRICE'
                            ? Math.max(0, targetUnit.price - Number(promo.discount_value))
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

        } else if (DISCOUNTABLE_TYPES.includes(promo.type)) {
            const eligible = getEligibleItems(promo);
            let promoDiscount = 0;

            eligible.forEach(i => {
                const consumed = consumedMap.get(i.id) || 0;
                const available = i.quantity - consumed;

                if (available > 0) {
                    const unitPrice = i.total / i.quantity;
                    const val = promo.discount_type === 'PERCENTAGE'
                        ? (unitPrice * Number(promo.discount_value) / 100)
                        : promo.discount_type === 'FIXED_PRICE'
                            ? Math.max(0, unitPrice - Number(promo.discount_value))
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
