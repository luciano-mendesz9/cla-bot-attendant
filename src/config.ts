import { fileURLToPath } from "url";
import path from "path";
import fs from 'fs';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

export const BOT_NAME = 'Leo-Bot';
export const BOT_PHONE_NUMBER = '559885742985'; 
export const DEVELOPER_PHONE_NUMBER = '559883528062'; 
export const PREFIX = '!';

export const BASE_PERSONALITY_MODEL_FILE_PATH = path.resolve(__dirname, 'utils', 'large-language-model', 'basic-personality.txt');

export type AdminConfigType = {
    admins_phone_numbers: string[];
}
const ADMIN_CONFIG = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'database', 'admin', 'config.json')).toString()) as AdminConfigType;

export const getAdminsPhoneNumbers = () => {
    const admins_list = ADMIN_CONFIG.admins_phone_numbers
    return admins_list;
}