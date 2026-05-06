import { AdminMenu } from './utils/menus/admin-menu.js';
import path from "path";
import fs from 'fs';
import { BOT_NAME, DEVELOPER_PHONE_NUMBER, PREFIX, __dirname, getAdminsPhoneNumbers } from "./config.js";
import ConnectionBot from "./connection.js";
import UserDataFileManager from "./utils/classes/UserDataFileManager.js";
import { delay, getGreeting, removeItemStringArray, validatePhone } from "./utils/functions/index.js";
import { getJsonData, updateJson } from "./utils/functions/json-manager.js";
import { GeminiAI } from './utils/services/gemini.service.js';
const cacheUserData = [];
let waitingList = [];
async function start() {
    const bot = await ConnectionBot();
    const DATA_CLIENTS = new UserDataFileManager();
    const ia = new GeminiAI();
    bot.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message)
            return;
        const isGroup = !msg.key.remoteJid?.endsWith('@lid');
        if (isGroup)
            return;
        const fromLid = msg.key.remoteJid;
        const fromJid = msg.key.remoteJidAlt;
        const message = msg.message.extendedTextMessage?.text || msg.message.conversation;
        if (waitingList.includes(fromLid))
            return console.log('Usuário em espera...');
        if (!fromJid && !fromLid || !message)
            return;
        if (msg.key.fromMe && (message?.toLocaleLowerCase() === 'bom dia' || message?.toLocaleLowerCase() === 'boa tarde' || message?.toLocaleLowerCase() === 'boa noite')) {
            const userCache = cacheUserData.find(u => u.lid === fromLid);
            DATA_CLIENTS.updateUserData(fromLid, { step: 'HUMAN_SERVING', username: userCache?.username || '' });
        }
        if (msg.key.fromMe && message?.toLocaleLowerCase() === 'atendimento finalizado') {
            const userCache = cacheUserData.find(u => u.lid === fromLid);
            DATA_CLIENTS.updateUserData(fromLid, { step: 'USER_REVIEW', username: userCache?.username || '' });
            delay(5000);
            await bot.sendMessage(fromLid, {
                text: 'Por favor, avalie o atendimento:'
            });
            await bot.sendMessage(fromLid, {
                text: '- *1 -* Muito Ruim 🫠\n- *2 -* Ruim 😥\n- *3 -* Neutro 😐\n- *4 -* Bom 😊\n- *5 -* Excelente 😄'
            });
            const list = removeItemStringArray(waitingList, fromLid);
            waitingList = list;
            return;
        }
        if (msg.key.fromMe)
            return;
        const admins_list = getAdminsPhoneNumbers();
        const attendants_list = getJsonData('admin', 'attendants_list.json');
        const isAdmin = admins_list.includes(fromJid?.split('@')[0]);
        const isAdminCommand = isAdmin && message.startsWith(PREFIX);
        const typing = async (ms = 2500) => {
            await delay(500);
            await bot.sendPresenceUpdate("composing", fromLid);
            await delay(ms);
            await bot.sendPresenceUpdate("paused", fromLid);
            await delay(500);
        };
        const sendTextMessage = async ({ text, reply }) => {
            await typing();
            const options = { text };
            if (reply) {
                options.quoted = msg;
            }
            return bot.sendMessage(fromLid, options);
        };
        const sendImageMessage = async ({ caption, filename }) => {
            const filepath = path.resolve(__dirname, '..', 'assets', 'images', filename);
            try {
                await typing(3500);
                await bot.sendMessage(fromLid, {
                    image: fs.readFileSync(filepath),
                    caption: caption ?? undefined
                });
            }
            catch (error) {
                console.log(error);
            }
        };
        const sendReact = async (emoji) => {
            await bot.sendMessage(fromLid, {
                react: {
                    key: msg.key,
                    text: emoji
                }
            });
        };
        console.log(`----------------------------\n> Mensagem: ${message}\n> Id: ${fromLid}\n----------------------------`);
        if (isAdminCommand) {
            const command = message.replace(PREFIX, '').split(' ')[0].trim().toLowerCase();
            const args = message.replace(`${PREFIX}${command}`, '').trim() || null;
            switch (command) {
                case 'ping':
                    await sendTextMessage({ text: 'Pong! Bot online.' });
                    break;
                case 'adicionar-admin':
                case 'add-admin':
                    if (!args)
                        return await sendTextMessage({
                            text: 'Para usar esse comando, por favor, envie um número de WhatsApp junto com o comando:\n\n> *Exemplo:* ' + PREFIX + 'adicionar-admin 559812345678.'
                        });
                    try {
                        if (!validatePhone(args)) {
                            throw new Error('Args NoN');
                        }
                        const dataAdminConfig = getJsonData('admin', 'config.json');
                        dataAdminConfig.admins_phone_numbers.push(args);
                        updateJson('admin', 'config.json', dataAdminConfig);
                        await sendTextMessage({ text: `O número _${args}_ foi adicionado como administrador do *${BOT_NAME}* ✅` });
                    }
                    catch (error) {
                        console.log(error);
                        await sendTextMessage({ text: `O complemento *${args}* do comando enviado não é um número válido.\n\n> *OBS:* Use somente números, deve haver 12 dígitos!\n\n> *Exemplo:* ${PREFIX}adicionar-admin 559812345678.` });
                    }
                    break;
                case 'adicionar-atendente':
                case 'add-atendente':
                    if (!args)
                        return await sendTextMessage({
                            text: 'Para usar esse comando, por favor, envie um número de WhatsApp junto com o comando:\n\n> *Exemplo:* ' + PREFIX + 'adicionar-atendente 559812345678.'
                        });
                    try {
                        if (!validatePhone(args)) {
                            throw new Error('Args NoN');
                        }
                        const dataAttendants = getJsonData('admin', 'attendants_list.json');
                        dataAttendants.push(args);
                        updateJson('admin', 'attendants_list.json', dataAttendants);
                        await sendTextMessage({ text: `O número _${args}_ foi adicionado como um "ATENDENTE" do *${BOT_NAME}* ✅` });
                    }
                    catch {
                        await sendTextMessage({ text: `O complemento *${args}* do comando enviado não é um número válido.\n\n> *OBS:* Use somente números, deve haver 12 dígitos!\n\n> *Exemplo:* ${PREFIX}adicionar-atendente 559812345678.` });
                    }
                    break;
                case 'menu':
                    await sendTextMessage({ text: AdminMenu() });
                    break;
                default:
                    await sendTextMessage({ text: `O comando *${command.toUpperCase()}* não existe nas opções de comandos administrativo.\n\n> *Use:* _${PREFIX}menu_ para verificar possíveis comandos.` });
            }
            const list = removeItemStringArray(waitingList, fromLid);
            waitingList = list;
            return;
        }
        const isFirstMessage = !DATA_CLIENTS.userFileExists(fromLid);
        if (isFirstMessage) {
            DATA_CLIENTS.createUserFile(fromLid, {
                step: 'COLLECT_NAME',
                username: null
            });
            await sendImageMessage({
                caption: `${getGreeting()}! Eu sou *${BOT_NAME}*, o mais novo assistente virtual do Colégio Leonel Amorim 😉`,
                filename: 'banner.png'
            });
            await sendTextMessage({
                text: `Antes de começarmos, qual é o seu nome? 😊`,
            });
            return;
        }
        const user = DATA_CLIENTS.readUserData(fromLid);
        if (!user)
            return;
        if (user?.step === 'USER_REVIEW') {
            let reviewed = false;
            const reviewsData = getJsonData('lists', 'reviews.json');
            switch (message.toLowerCase()) {
                case '1':
                case 'muito ruim':
                case 'péssimo':
                    reviewsData.push({ lid: fromLid, review: 'MUITO RUIM' });
                    reviewed = true;
                    break;
                case '2':
                case 'ruim':
                    reviewsData.push({ lid: fromLid, review: 'RUIM' });
                    reviewed = true;
                    break;
                case '3':
                case 'neutro':
                    reviewsData.push({ lid: fromLid, review: 'NEUTRO' });
                    reviewed = true;
                    break;
                case '4':
                case 'bom':
                case 'boa':
                    reviewsData.push({ lid: fromLid, review: 'BOM' });
                    reviewed = true;
                    break;
                case '5':
                case 'muito boa':
                case 'excelente':
                    reviewsData.push({ lid: fromLid, review: 'EXCELENTE' });
                    reviewed = true;
                    break;
                default:
                    await sendTextMessage({ text: 'Não entendi sua avaliação, por favor, use números ou escreva a palavra de sua opção. 😉' });
            }
            if (reviewed) {
                await sendTextMessage({ text: 'Muito obrigado pela sua avalição ❤️' });
                await sendTextMessage({ text: 'Se precisar de algo a mais é só falar. 😊' });
                DATA_CLIENTS.updateUserData(fromLid, { step: 'CHAT_OPEN', username: user.username || '' });
                updateJson('lists', 'reviews.json', reviewsData);
            }
            return;
        }
        if (user.step === 'HUMAN_SERVING')
            return;
        if (user.step === 'HUMAN_SERVICE') {
            await sendTextMessage({ text: 'No momento, você está em aguardo ao atendimento humano. Aguarde. 😊' });
            await sendTextMessage({ text: '> Isso pode levar alguns minutos.' });
            return;
        }
        if (user.step === 'COLLECT_NAME') {
            const username = message;
            DATA_CLIENTS.updateUserData(fromLid, {
                step: 'CHAT_OPEN',
                username: username
            });
            await sendTextMessage({
                text: `Prazer em conhecer você, *` + username.split(' ')[0] + '* 😄',
            });
            await sendTextMessage({
                text: 'Como posso te ajudar?\n\n> *Dica:* Envie uma mensagem por vez para facilitar o atendimento 😉'
            });
            const list = removeItemStringArray(waitingList, fromLid);
            waitingList = list;
            return;
        }
        const firstName = user.username?.split(' ')[0];
        async function askAttendant() {
            sendTextMessage({ text: 'Estou te encaminhando para um atendente humano 👨‍💼👩‍💼\n\n> *Aguarde*, isso pode levar alguns minutos.' });
            const randomAttendant = attendants_list[Math.floor(Math.random() * attendants_list.length)];
            cacheUserData.push({ lid: fromLid, username: firstName });
            await bot.sendMessage(`${randomAttendant}@s.whatsapp.net`, { text: `*🗃️ PEDIDO DE ATENDIMENTO*\n\nNome: ${firstName}\nNúmero: ${fromJid?.split('@')[0]}\n\n> *Atenção:* Abra este contato no número do *${BOT_NAME}* e responda-o.\n\n> ⚠️ *IMPORTANTE:* Ao finalizar o atendimento, envie: *"Atendimento finalizado"* (exatamente assim) no privado do cliente, para que o Bot saiba.` });
            DATA_CLIENTS.updateUserData(fromLid, { step: 'HUMAN_SERVICE', username: firstName });
        }
        const sendResponseRule = async () => {
            await sendTextMessage({ text: '> Envie 1 mensagem e aguarde pela resposta.' });
        };
        const priceInquiryMessage = async () => {
            await sendTextMessage({ text: `Se quiser informações sobre valores, posso te encaminhar para um atendente, ${firstName} 😊\n\nBasta enviar *"Quero um atendente"*` });
        };
        await bot.readMessages([msg.key]);
        await delay(500);
        try {
            waitingList.push(fromLid);
            const userIntent = await ia.response(message);
            await delay(500);
            await sendReact('');
            switch (userIntent) {
                case 'mensagem_inicial':
                    await sendImageMessage({
                        caption: `${getGreeting()}! Eu sou *${BOT_NAME}*, o mais novo assistente virtual do Colégio Leonel Amorim 😉`,
                        filename: 'banner.png'
                    });
                    await sendTextMessage({ text: 'Como posso te ajudar?' });
                    break;
                case 'matricula':
                    await sendTextMessage({ text: '*Temos turmas do Ensino Fundamental:*' });
                    await sendTextMessage({ text: '- 🐣 *Educação Infantil*\n- 📚 *Anos Iniciais (1º ao 5º ano)* — Turno Matutino\n- 📘 *Anos Finais (6º ao 9º ano)* — Turno Vespertino' });
                    await sendTextMessage({
                        text: `*Nossos Parceiros*\n\n📘 *FTD Educação*\n- Material didático de alta qualidade\n\n🌳 *Árvore*\n- Incentivo à leitura e produção literária com Inteligêcia Artificial\n\n🤖 *Zoom Education*\n - Aulas de robótica preparando seu filho para o futuro\n\n🧠 *Socioemocional*\n- Trabalhando gestão emocional, empatia, autoconhecimento, habilidades socioais e tomada de decisões responsáveis`
                    });
                    await sendTextMessage({ text: 'Gostaria de saber mais sobre alguma turma específica? Se sim, qual? 😊' });
                    await sendResponseRule();
                    break;
                case 'parceiros':
                    await sendTextMessage({
                        text: `${firstName}, aqui no Colégio Leonel Amorim contamos com parceiros incríveis 🚀`
                    });
                    await sendTextMessage({
                        text: `📘 *FTD Educação*\n- Material didático de alta qualidade\n\n🌳 *Árvore*\n- Incentivo à leitura e produção literária\n\n🤖 *Zoom Education*\n - Aulas de robótica para preparar seu filho para o futuro`
                    });
                    await sendTextMessage({ text: 'Inovação e Desenvolvimento em um só lugar!' });
                    await sendTextMessage({
                        text: `> Envie *"quero um atendente"* a qualquer momento, que te redireciono para um atendente humano. 😉`
                    });
                    break;
                case 'reclamacao':
                    await sendTextMessage({
                        text: `Entendo sua situação 😥`
                    });
                    await sendTextMessage({
                        text: `Para te ajudar melhor, posso encaminhar você para um atendente humano.`
                    });
                    await sendTextMessage({
                        text: `Se quiser, basta enviar *"Quero um atendente"* 😉`
                    });
                    break;
                case 'primeiro_ano':
                    await sendTextMessage({ text: 'Temos o 1° ano no turno *Matutino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Robótica Infantil' });
                    await priceInquiryMessage();
                    break;
                case 'segundo_ano':
                    await sendTextMessage({ text: 'Temos o 2° ano no turno *Matutino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Robótica Infantil' });
                    await priceInquiryMessage();
                    break;
                case 'terceiro_ano':
                    await sendTextMessage({ text: 'Temos o 3° ano no turno *Matutino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Robótica Infantil' });
                    await priceInquiryMessage();
                    break;
                case 'quarto_ano':
                    await sendTextMessage({ text: 'Temos o 4° ano no turno *Matutino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Robótica Infantil' });
                    await priceInquiryMessage();
                    break;
                case 'quinto_ano':
                    await sendTextMessage({ text: 'Temos o 5° ano no turno *Matutino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Robótica Infantil' });
                    await priceInquiryMessage();
                    break;
                case 'sexto_ano':
                    await sendTextMessage({ text: 'Temos o 6° ano no turno *Vespertino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Inglês' });
                    await priceInquiryMessage();
                    break;
                case 'setimo_ano':
                    await sendTextMessage({ text: 'Temos o 7° ano no turno *Vespertino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Inglês' });
                    await priceInquiryMessage();
                    break;
                case 'oitavo_ano':
                    await sendTextMessage({ text: 'Temos o 8° ano no turno *Vespertino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Inglês' });
                    await priceInquiryMessage();
                    break;
                case 'nono_ano':
                    await sendTextMessage({ text: 'Temos o 9° ano no turno *Vespertino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Inglês' });
                    await priceInquiryMessage();
                    break;
                case 'agradecimento':
                    await sendTextMessage({ text: 'Foi um prazer ajudar você, se precisar de mim, é só avisar, ta? 😊' });
                    break;
                case 'confirmacao':
                    await sendReact('😊');
                    break;
                case 'horarios':
                    await sendTextMessage({ text: '🕒 Funcionamos de segunda a sexta, das 8h às 17h30.' });
                    break;
                case 'localizacao':
                    await sendTextMessage({ text: '📍 Estamos localizados em:' });
                    await sendTextMessage({ text: 'RUA CORONEL CATÃO, 00 CENTRO. 65485-000 Itapecuru Mirim - MA' });
                    await sendTextMessage({ text: 'Acesse: https://share.google/UPikuzTRsT9VXBksM' });
                    break;
                case 'atendimento':
                    await askAttendant();
                    break;
                case 'status_matriculas':
                    await sendTextMessage({ text: 'Sim!! Estamos com matrículas abertas. Para saber mais, posso sugerir uma assistência humana para você.' });
                    await sendTextMessage({ text: 'Se quiser uma assistência humana, basta enviar *"Quero uma assistência humana."*' });
                    break;
                case 'limit_exceeded':
                    await sendTextMessage({ text: `O *${BOT_NAME}* teve um erro ao processar sua mesnagem, aguarde enquanto lhe redirecionamos para um atendimento humano.` });
                    await askAttendant();
                    await bot.sendMessage(`${DEVELOPER_PHONE_NUMBER}@s.whatsapp.net`, {
                        text: `⚠️ *PROBLEMAS NO ${BOT_NAME.toUpperCase()}:*\n- Limite de requisições atingido`
                    });
                    break;
                case 'api_key_invalid':
                    await sendTextMessage({ text: `O *${BOT_NAME}* teve um erro ao processar sua mesnagem, aguarde enquanto lhe redirecionamos para um atendimento humano.` });
                    await askAttendant();
                    await bot.sendMessage(`${DEVELOPER_PHONE_NUMBER}@s.whatsapp.net`, {
                        text: `⚠️ *PROBLEMAS NO ${BOT_NAME.toUpperCase()}:*\n- Chave API-KEy invalidada`
                    });
                    break;
                default:
                    console.log(userIntent);
                    await sendTextMessage({ text: 'Não consegui entender o seu pedido. Se precisar de ajuda mais profunda, envie *"Quero um atendente"*, que te redireciono para uma assistência humana.' });
            }
        }
        catch (error) {
            const list = removeItemStringArray(waitingList, fromLid);
            waitingList = list;
            console.log(error);
        }
        finally {
            const list = removeItemStringArray(waitingList, fromLid);
            waitingList = list;
        }
    });
}
start();
