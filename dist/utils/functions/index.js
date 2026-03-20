export const delay = (ms) => new Promise(res => setTimeout(res, ms));
export function validatePhone(number) {
    return /^\d{12}$/.test(number);
}
