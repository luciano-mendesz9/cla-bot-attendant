import fs from 'fs';
import path from 'path';
import { __dirname } from '../../config.js';
class UserDataFileManager {
    DATA_FOLDER_PATH = path.resolve(__dirname, 'database', 'users');
    constructor() {
        this.ensureDataFolderExists();
    }
    ensureDataFolderExists() {
        if (!fs.existsSync(this.DATA_FOLDER_PATH)) {
            fs.mkdirSync(this.DATA_FOLDER_PATH, { recursive: true });
        }
    }
    buildFilePath(userLid) {
        const filename = userLid.split('@')[0] + '.json';
        return path.resolve(this.DATA_FOLDER_PATH, filename);
    }
    userFileExists(userLid) {
        const filePath = this.buildFilePath(userLid);
        return fs.existsSync(filePath);
    }
    createUserFile(userLid, initialData) {
        const filePath = this.buildFilePath(userLid);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), 'utf-8');
        }
        return filePath;
    }
    deleteUserFile(userLid) {
        const filePath = this.buildFilePath(userLid);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    readUserData(userLid) {
        const filePath = this.buildFilePath(userLid);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    }
    updateUserData(userLid, data) {
        const filePath = this.buildFilePath(userLid);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
}
export default UserDataFileManager;
