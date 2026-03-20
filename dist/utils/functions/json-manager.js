import { __dirname } from './../../config.js';
import path from "path";
import fs from 'fs';
const jsonFolders = path.resolve(__dirname, 'database');
export function getJsonData(folder, file) {
    const jsonData = JSON.parse(fs.readFileSync(path.resolve(jsonFolders, folder, file)).toString());
    return jsonData;
}
export function getJsonPath(folder, file) {
    const jsonPath = path.resolve(jsonFolders, folder, file);
    return jsonPath;
}
export function updateJson(folder, file, data) {
    const pathFile = getJsonPath(folder, file);
    fs.writeFileSync(pathFile, JSON.stringify(data, null, 2), 'utf-8');
}
