import fs from 'fs';
import path from 'path';
import { __dirname } from '../../config.js';


type UserDataType = {
    step: string;
    username: string | null;
}

class UserDataFileManager {
    private DATA_FOLDER_PATH: string = path.resolve(__dirname, 'database', 'users');

    constructor() {
        this.ensureDataFolderExists();
    }

    private ensureDataFolderExists() {
        if (!fs.existsSync(this.DATA_FOLDER_PATH)) {
            fs.mkdirSync(this.DATA_FOLDER_PATH, { recursive: true });
        }
    }

    private buildFilePath(userLid: string): string {
        const filename = userLid.split('@')[0] + '.json';
        return path.resolve(this.DATA_FOLDER_PATH, filename);
    }

    userFileExists(userLid: string): boolean {
        const filePath = this.buildFilePath(userLid);
        return fs.existsSync(filePath);
    }

    createUserFile(userLid: string, initialData: UserDataType) {
        const filePath = this.buildFilePath(userLid);

        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), 'utf-8');
        }

        return filePath;
    }

    deleteUserFile(userLid: string) {
        const filePath = this.buildFilePath(userLid);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    readUserData<T = UserDataType>(userLid: string): T | null {
        const filePath = this.buildFilePath(userLid);

        if (!fs.existsSync(filePath)) {
            return null;
        }

        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    }

    updateUserData(userLid: string, data: UserDataType) {
        const filePath = this.buildFilePath(userLid);

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
}

export default UserDataFileManager;