export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
export function validatePhone(number: string) {
    return /^\d{12}$/.test(number);
}

export const removeItemStringArray = (arr: string[], item: string) => {
    return arr.filter(i => i !== item);
};
