import { AdminMenu } from './utils/menus/admin-menu.js';
import path from "path";
import fs from 'fs';
import { BOT_NAME, PREFIX, __dirname, getAdminsPhoneNumbers } from "./config.js";
import ConnectionBot from "./connection.js";
import UserDataFileManager from "./utils/classes/UserDataFileManager.js";
import { delay, validatePhone } from "./utils/functions/index.js";
import { getJsonData, updateJson } from "./utils/functions/json-manager.js";
import { InitialMenu } from "./utils/menus/initial-menu.js";
const cacheUserData = [];
async function start() {
    const bot = await ConnectionBot();
    const DATA_CLIENTS = new UserDataFileManager();
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
        if (!fromJid && !fromLid || !message)
            return;
        if (msg.key.fromMe && (message?.toLocaleLowerCase() === 'bom dia' || message?.toLocaleLowerCase() === 'boa tarde' || message?.toLocaleLowerCase() === 'boa noite')) {
            const userCache = cacheUserData.find(u => u.lid === fromLid);
            DATA_CLIENTS.updateUserData(fromLid, { step: 'HUMAN_SERVING', username: userCache?.username || '' });
        }
        if (msg.key.fromMe && message?.toLocaleLowerCase() === 'atendimento finalizado') {
            const userCache = cacheUserData.find(u => u.lid === fromLid);
            DATA_CLIENTS.updateUserData(fromLid, { step: 'INITIAL', username: userCache?.username || '' });
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
            return;
        }
        const isFirstMessage = !DATA_CLIENTS.userFileExists(fromLid);
        if (isFirstMessage) {
            DATA_CLIENTS.createUserFile(fromLid, {
                step: 'COLLECT_NAME',
                username: null
            });
            await sendImageMessage({
                caption: `Olá, Eu sou *${BOT_NAME}*, o mais novo assistente virtual do Colégio Leonel Amorim 😉`,
                filename: 'banner.png'
            });
            await sendTextMessage({
                text: `Antes de iniciarmos, qual o seu nome? 😊`,
            });
            return;
        }
        const user = DATA_CLIENTS.readUserData(fromLid);
        if (!user)
            return;
        if (user.step === 'HUMAN_SERVING')
            return;
        async function askAttendant() {
            sendTextMessage({ text: 'Entendido!! Estou te redirecionando para um atendente humano...\n\n> *Atenção:* isso pode levar alguns minutos. Aguarde a mensagem de um atendente.' });
            const randomAttendant = attendants_list[Math.floor(Math.random() * attendants_list.length)];
            cacheUserData.push({ lid: fromLid, username: user?.username });
            await bot.sendMessage(`${randomAttendant}@s.whatsapp.net`, { text: `*🗃️ PEDIDO DE ATENDIMENTO*\n\nNome: ${user?.username}\nNúmero: ${fromJid?.split('@')[0]}\n\n> *Atenção:* Abra este contato no número do *${BOT_NAME}* e responda-o.\n\n> ⚠️ *IMPORTANTE:* Ao finalizar o atendimento, envie: *"Atendimento finalizado"* (exatamente assim) no privado do cliente, para que o Bot saiba.` });
            DATA_CLIENTS.updateUserData(fromLid, { step: 'HUMAN_SERVICE', username: user?.username });
        }
        let isCommand = false;
        if (user.step !== 'COLLECT_NAME' && user.step !== 'HUMAN_SERVICE') {
            switch (message.toLocaleLowerCase()) {
                case 'menu':
                case 'ajuda':
                    sendTextMessage({ text: InitialMenu() });
                    isCommand = true;
                    break;
                case 'quero um atendente':
                case 'atendente':
                case 'humano':
                case 'preciso de ajuda':
                case 'falar com atendente':
                    await askAttendant();
                    isCommand = true;
                    break;
                default:
                    break;
            }
        }
        if (isCommand)
            return;
        switch (user.step.toUpperCase()) {
            case 'INITIAL':
                await sendImageMessage({
                    caption: `Olá, ${user.username?.split(' ')[0] || 'Pessoa'}! Eu sou *${BOT_NAME}*, o mais novo assistente virtual do Colégio Leonel Amorim 😉`,
                    filename: 'banner.png'
                });
                await sendTextMessage({ text: '> Envie *"atendente"* a qualquer momento para solicitar um atendimento humano.' });
                await sendTextMessage({
                    text: InitialMenu()
                });
                DATA_CLIENTS.updateUserData(fromLid, { step: 'MENU', username: user.username });
                break;
            case 'HUMAN_SERVICE':
                await sendTextMessage({ text: 'No momento, você está em aguardo ao atendimento humano. Aguarde. 😊' });
                await sendTextMessage({ text: '> Isso pode levar alguns minutos.' });
                return;
            case 'COLLECT_NAME':
                const username = message;
                if (!username) {
                    await sendTextMessage({
                        text: `Não entendi sua resposta... Qual o seu nome?😊`,
                    });
                    return;
                }
                DATA_CLIENTS.updateUserData(fromLid, { step: 'MENU', username });
                await sendTextMessage({
                    text: `Prazer em conhecer você, *` + username.split(' ')[0] + '* 😄',
                });
                await sendTextMessage({
                    text: InitialMenu()
                });
                await sendTextMessage({
                    text: `> *Obs:* Se precisar deste *MENU* de opções, basta enviar "menu" a qualquer momento 😊`
                });
                break;
            case 'MENU':
                if (message === '1') {
                    await sendTextMessage({
                        text: `Temos turmas do:\n- 1° ao 5° ano (MATUTINO)\n- 6° ao 9° ano (VESPERTINO)`
                    });
                    await sendTextMessage({
                        text: `> Envie *"quero um atendente"* a qualquer momento, que te redireciono para um atendente humano. 😉`
                    });
                    return;
                }
                else if (message === '2') {
                    await sendTextMessage({
                        text: `Aqui no Colégio Leonel Amorim, temos parceirias incríveis 😲!`
                    });
                    await sendTextMessage({
                        text: `*FTD:*\n- Nos proporciona livros didáticos para imergir nossos alunos no mundo do conhecimento\n\n*Árvore:*\n- Estímulo ao mundo literário! Seu filho autor e escritor\n\n*Zoom Education:*\n- O futuro chegou e nós do CLA estamos acompanhando de perto essas incríveis mudanças. Por isso, agora, seu filho terá acesso a aulas de *ROBÓTICA!*`
                    });
                    await sendTextMessage({ text: 'Inovação e Desenvolvimento em um só lugar!' });
                    await sendTextMessage({
                        text: `> Envie *"quero um atendente"* a qualquer momento, que te redireciono para um atendente humano. 😉`
                    });
                    return;
                }
                else if (message === '3') {
                    askAttendant();
                    return;
                }
                await sendTextMessage({
                    text: `Desculpa, mas não há essa opção no *MENU*, tente novamente 😉`
                });
                await sendTextMessage({
                    text: `\n*MENU:*\n> Por favor, envie um número correspondente à sua necessidade e aguarde a resposta.\n\n- 1 - Matrículas\n- 2 - Parceiros\n- 3 - Falar com atendente\n\nComo eu posso ajudá-lo/a?`
                });
                break;
        }
    });
}
start();
