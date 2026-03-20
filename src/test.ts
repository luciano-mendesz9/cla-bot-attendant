import { GeminiAI } from "./utils/services/gemini.service.js";

const ia = new GeminiAI();

const res = await ia.response('matric');
console.log(res)