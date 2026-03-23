export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
export function validatePhone(number: string) {
    return /^\d{12}$/.test(number);
}

export const removeItemStringArray = (arr: string[], item: string) => {
    return arr.filter(i => i !== item);
};

export const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
};