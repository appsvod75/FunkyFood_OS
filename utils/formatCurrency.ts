export const formatCurrency = (amount: number | string | undefined | null) => {
    return '$' + Number(amount || 0).toFixed(2);
};
