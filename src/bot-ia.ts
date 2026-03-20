import { AdminMenu } from './utils/menus/admin-menu.js';
import path from "path";
import fs from 'fs';
import { AdminConfigType, BOT_NAME, PREFIX, __dirname, getAdminsPhoneNumbers } from "./config.js";
import ConnectionBot from "./connection.js";
import UserDataFileManager from "./utils/classes/UserDataFileManager.js";
import { delay, validatePhone } from "./utils/functions/index.js";
import { getJsonData, updateJson } from "./utils/functions/json-manager.js";
import { InitialMenu } from "./utils/menus/initial-menu.js";
import { GeminiAI } from './utils/services/gemini.service.js';

const cacheUserData: { lid: string, username: string }[] = [];

async function start() {
    const bot = await ConnectionBot();
    const DATA_CLIENTS = new UserDataFileManager();
    const ia = new GeminiAI();


    bot.ev.on("messages.upsert", async ({ messages }) => {

        const msg = messages[0];
        if (!msg.message) return;

        const isGroup = !msg.key.remoteJid?.endsWith('@lid');
        if (isGroup) return;

        const fromLid = msg.key.remoteJid;
        const fromJid = msg.key.remoteJidAlt;

        const message = msg.message.extendedTextMessage?.text || msg.message.conversation;

        if (!fromJid && !fromLid || !message) return;

        if (msg.key.fromMe && (message?.toLocaleLowerCase() === 'bom dia' || message?.toLocaleLowerCase() === 'boa tarde' || message?.toLocaleLowerCase() === 'boa noite')) {
            const userCache = cacheUserData.find(u => u.lid === fromLid);
            DATA_CLIENTS.updateUserData(fromLid as string, { step: 'HUMAN_SERVING', username: userCache?.username || '' });
        }

        if (msg.key.fromMe && message?.toLocaleLowerCase() === 'atendimento finalizado') {
            const userCache = cacheUserData.find(u => u.lid === fromLid);
            DATA_CLIENTS.updateUserData(fromLid as string, { step: 'CHAT_OPEN', username: userCache?.username || '' });
        }

        if (msg.key.fromMe) return;

        const admins_list = getAdminsPhoneNumbers();
        const attendants_list = getJsonData('admin', 'attendants_list.json');
        const isAdmin = admins_list.includes(fromJid?.split('@')[0] as string);
        const isAdminCommand = isAdmin && message.startsWith(PREFIX);

        const typing = async (ms = 2500) => {
            await delay(500)
            await bot.sendPresenceUpdate("composing", fromLid as string);
            await delay(ms)
            await bot.sendPresenceUpdate("paused", fromLid as string);
            await delay(500);
        }

        const sendTextMessage = async ({ text, reply }: { text: string, reply?: boolean }) => {
            await typing();
            const options: any = { text }
            if (reply) {
                options.quoted = msg
            }
            return bot.sendMessage(fromLid as string, options);
        }

        const sendImageMessage = async ({ caption, filename }: { caption?: string, filename: string }) => {

            const filepath = path.resolve(__dirname, '..', 'assets', 'images', filename);

            try {
                await typing(3500);
                await bot.sendMessage(fromLid as string, {
                    image: fs.readFileSync(filepath),
                    caption: caption ?? undefined
                });

            } catch (error) {
                console.log(error);
            }
        };

        if (isAdminCommand) {

            const command = message.replace(PREFIX, '').split(' ')[0].trim().toLowerCase();
            const args = message.replace(`${PREFIX}${command}`, '').trim() || null;

            switch (command) {
                case 'ping':
                    await sendTextMessage({ text: 'Pong! Bot online.' });
                    break
                case 'adicionar-admin': case 'add-admin':
                    if (!args) return await sendTextMessage({
                        text: 'Para usar esse comando, por favor, envie um número de WhatsApp junto com o comando:\n\n> *Exemplo:* ' + PREFIX + 'adicionar-admin 559812345678.'
                    });

                    try {

                        if (!validatePhone(args)) {
                            throw new Error('Args NoN');
                        }

                        const dataAdminConfig = getJsonData('admin', 'config.json') as AdminConfigType;
                        dataAdminConfig.admins_phone_numbers.push(args);

                        updateJson('admin', 'config.json', dataAdminConfig);
                        await sendTextMessage({ text: `O número _${args}_ foi adicionado como administrador do *${BOT_NAME}* ✅` })
                    } catch (error) {
                        console.log(error)
                        await sendTextMessage({ text: `O complemento *${args}* do comando enviado não é um número válido.\n\n> *OBS:* Use somente números, deve haver 12 dígitos!\n\n> *Exemplo:* ${PREFIX}adicionar-admin 559812345678.` });
                    }

                    break
                case 'adicionar-atendente': case 'add-atendente':
                    if (!args) return await sendTextMessage({
                        text: 'Para usar esse comando, por favor, envie um número de WhatsApp junto com o comando:\n\n> *Exemplo:* ' + PREFIX + 'adicionar-atendente 559812345678.'
                    });

                    try {

                        if (!validatePhone(args)) {
                            throw new Error('Args NoN');
                        }

                        const dataAttendants = getJsonData('admin', 'attendants_list.json') as string[];
                        dataAttendants.push(args);

                        updateJson('admin', 'attendants_list.json', dataAttendants);
                        await sendTextMessage({ text: `O número _${args}_ foi adicionado como um "ATENDENTE" do *${BOT_NAME}* ✅` })
                    } catch {
                        await sendTextMessage({ text: `O complemento *${args}* do comando enviado não é um número válido.\n\n> *OBS:* Use somente números, deve haver 12 dígitos!\n\n> *Exemplo:* ${PREFIX}adicionar-atendente 559812345678.` });
                    }
                    break;
                case 'menu':
                    await sendTextMessage({ text: AdminMenu() })
                    break
                default:
                    await sendTextMessage({ text: `O comando *${command.toUpperCase()}* não existe nas opções de comandos administrativo.\n\n> *Use:* _${PREFIX}menu_ para verificar possíveis comandos.` })
            }

            return;
        }

        const isFirstMessage = !DATA_CLIENTS.userFileExists(fromLid as string);

        if (isFirstMessage) {

            DATA_CLIENTS.createUserFile(fromLid as string, {
                step: 'COLLECT_NAME',
                username: null
            })


            await sendImageMessage({
                caption: `Olá, Eu sou *${BOT_NAME}*, o mais novo assistente virtual do Colégio Leonel Amorim 😉`,
                filename: 'banner.png'
            })

            await sendTextMessage({
                text: `Antes de iniciarmos, qual o seu nome? 😊`,
            });

            return;
        }

        const user = DATA_CLIENTS.readUserData(fromLid as string);
        if (!user) return;

        if (user.step === 'HUMAN_SERVING') return;

        if (user.step === 'COLLECT_NAME') {
            const username = message;

            DATA_CLIENTS.updateUserData(fromLid as string, {
                step: 'CHAT_OPEN',
                username: username
            });

            await sendTextMessage({
                text: `Prazer em conhecer você, *` + username.split(' ')[0] + '* 😄',
            });

            await sendTextMessage({
                text: 'Como posso te ajuda?\n> *Obs:* Envie somente mensagem de texto para interagir com o ' + BOT_NAME + ' e 1 por vez.'
            });
            return;
        }

        async function askAttendant() {
            sendTextMessage({ text: 'Entendido!! Estou te redirecionando para um atendente humano...\n\n> *Atenção:* isso pode levar alguns minutos. Aguarde a mensagem de um atendente.' });

            const randomAttendant = attendants_list[Math.floor(Math.random() * attendants_list.length)];
            cacheUserData.push({ lid: fromLid as string, username: user?.username as string });

            await bot.sendMessage(`${randomAttendant}@s.whatsapp.net`, { text: `*🗃️ PEDIDO DE ATENDIMENTO*\n\nNome: ${user?.username as string}\nNúmero: ${fromJid?.split('@')[0]}\n\n> *Atenção:* Abra este contato no número do *${BOT_NAME}* e responda-o.\n\n> ⚠️ *IMPORTANTE:* Ao finalizar o atendimento, envie: *"Atendimento finalizado"* (exatamente assim) no privado do cliente, para que o Bot saiba.` })
            DATA_CLIENTS.updateUserData(fromLid as string, { step: 'HUMAN_SERVICE', username: user?.username as string });
        }

        const userIntent = await ia.response(message);

        switch (userIntent) {
            case 'matricula':
                await sendTextMessage({ text: 'Ah, você quer saber sobre as matrículas' })
                break;
            case 'paceiros':
                await sendTextMessage({ text: 'Ah, você quer saber sobre os parceiros' })
                break;
            default:
                await sendTextMessage({ text: userIntent })
                return
        }


    });
}

start();
