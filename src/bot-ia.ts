import { AdminMenu } from './utils/menus/admin-menu.js';
import path from "path";
import fs from 'fs';
import { AdminConfigType, BOT_NAME, DEVELOPER_PHONE_NUMBER, PREFIX, __dirname, getAdminsPhoneNumbers } from "./config.js";
import ConnectionBot from "./connection.js";
import UserDataFileManager from "./utils/classes/UserDataFileManager.js";
import { delay, removeItemStringArray, validatePhone } from "./utils/functions/index.js";
import { getJsonData, updateJson } from "./utils/functions/json-manager.js";
import { GeminiAI } from './utils/services/gemini.service.js';

const cacheUserData: { lid: string, username: string }[] = [];
let waitingList: string[] = [];

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

        if (waitingList.includes(fromLid as string)) return;
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

        const sendReact = async (emoji: string) => {
            await bot.sendMessage(fromLid as string, {
                react: {
                    key: msg.key,
                    text: emoji
                }
            });
        }


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
                text: 'Como posso te ajudar?\n\n> *Obs:* Envie somente mensagem de texto para interagir com o ' + BOT_NAME + ' e 1 por vez.'
            });
            return;
        }

        const firstName = user.username?.split(' ')[0];
        async function askAttendant() {
            sendTextMessage({ text: 'Estou te redirecionando para um atendente humano...\n\n> *Atenção:* isso pode levar alguns minutos. Aguarde a mensagem de um atendente.' });

            const randomAttendant = attendants_list[Math.floor(Math.random() * attendants_list.length)];
            cacheUserData.push({ lid: fromLid as string, username: firstName as string });

            await bot.sendMessage(`${randomAttendant}@s.whatsapp.net`, { text: `*🗃️ PEDIDO DE ATENDIMENTO*\n\nNome: ${firstName as string}\nNúmero: ${fromJid?.split('@')[0]}\n\n> *Atenção:* Abra este contato no número do *${BOT_NAME}* e responda-o.\n\n> ⚠️ *IMPORTANTE:* Ao finalizar o atendimento, envie: *"Atendimento finalizado"* (exatamente assim) no privado do cliente, para que o Bot saiba.` })
            DATA_CLIENTS.updateUserData(fromLid as string, { step: 'HUMAN_SERVICE', username: firstName as string });
        }

        const sendResponseRule = async () => {
            await sendTextMessage({ text: '> Envie 1 mensagem e aguarde pela resposta.' });
        }

        const priceInquiryMessage = async () => {
            await sendTextMessage({ text: `Se precisar consultar preços, posso solicitar uma assistêcia humana para você, ${firstName}, basta enviar *"Quero um atendente"*` })
        }

        await bot.readMessages([msg.key]);
        await delay(500);
        await sendReact('⏳')

        waitingList.push(fromLid as string);
        const userIntent = await ia.response(message);

        await delay(500);
        await sendReact('');


        switch (userIntent) {
            case 'mensagem_inicial':
                await sendImageMessage({
                    caption: `Olá, Eu sou *${BOT_NAME}*, o mais novo assistente virtual do Colégio Leonel Amorim 😉`,
                    filename: 'banner.png'
                });
                await sendTextMessage({ text: 'Como posso te ajudar?' });
                break;
            case 'matricula':
                await sendTextMessage({ text: 'Nossas turmas são do fundamental, sendo:' });
                await sendTextMessage({ text: '- 1° ano ao 5° ano (Matutino)\n- 6° ano ao 9° ano (Vespertino)' });
                await sendTextMessage({ text: 'Quer saber sobre alguma turma específica? Se sim, qual delas?' });
                await sendResponseRule();
                break;
            case 'paceiros':
                await sendTextMessage({
                    text: `${user.username?.split(' ')[0] || 'Bom'}, aqui no Colégio Leonel Amorim, temos parceirias incríveis 😲!`
                });
                await sendTextMessage({
                    text: `*FTD:*\n- Nos proporciona livros didáticos para imergir nossos alunos no mundo do conhecimento\n\n*Árvore:*\n- Estímulo ao mundo literário! Seu filho autor e escritor\n\n*Zoom Education:*\n- O futuro chegou e nós do CLA estamos acompanhando de perto essas incríveis mudanças. Por isso, agora, seu filho terá acesso a aulas de *ROBÓTICA!*`
                });

                await sendTextMessage({ text: 'Inovação e Desenvolvimento em um só lugar!' });
                await sendTextMessage({
                    text: `> Envie *"quero um atendente"* a qualquer momento, que te redireciono para um atendente humano. 😉`
                });
                break;
            case 'reclamacao':
                await sendTextMessage({
                    text: `🥵 Entendo...`
                });
                await sendTextMessage({
                    text: `Acalme-se... Para ajudar você, posso te sugerir a pedir um assistência humana.\nQue tal?`
                });
                await sendTextMessage({
                    text: `Basta enviar *"Preciso de um atendente"* que te redireciono para esse suporte humano 😊`
                });
                break;
            case 'primeiro_ano':
                await sendTextMessage({ text: 'Temo o 1° ano no turno *Matutino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Robótica Infantil' });
                await priceInquiryMessage();
                break;
            case 'segundo_ano':
                await sendTextMessage({ text: 'Temo o 2° ano no turno *Matutino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Robótica Infantil' });
                await priceInquiryMessage();
                break;
            case 'terceiro_ano':
                await sendTextMessage({ text: 'Temo o 3° ano no turno *Matutino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Robótica Infantil' });
                await priceInquiryMessage();
                break;
            case 'quarto_ano':
                await sendTextMessage({ text: 'Temo o 4° ano no turno *Matutino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Robótica Infantil' });
                await priceInquiryMessage();
                break;
            case 'quinto_ano':
                await sendTextMessage({ text: 'Temo o 5° ano no turno *Matutino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Robótica Infantil' });
                await priceInquiryMessage();
                break;
            case 'sexto_ano':
                await sendTextMessage({ text: 'Temo o 6° ano no turno *Vespertino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Inglês' });
                await priceInquiryMessage();
                break;
            case 'setimo_ano':
                await sendTextMessage({ text: 'Temo o 7° ano no turno *Vespertino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Inglês' });
                await priceInquiryMessage();
                break;
            case 'oitavo_ano':
                await sendTextMessage({ text: 'Temo o 8° ano no turno *Vespertino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Inglês' });
                await priceInquiryMessage();
                break;
            case 'nono_ano':
                await sendTextMessage({ text: 'Temo o 9° ano no turno *Vespertino*, com exelentes professores.\n\n*ATIVIDADES INCLUÍDAS:*\n- Inglês' });
                await priceInquiryMessage();
                break;
            case 'agradecimento':
                await sendTextMessage({ text: 'Foi um prazer ajudar você, se precisar de mim, é só avisar, ta? 😊' })
                break
            case 'confirmacao':
                await sendReact('😊');
                break;
            case 'horarios':
                await sendTextMessage({ text: 'Funcionamos de Segunda à Sexta, das 8h às 17h30' })
                break
            case 'localizacao':
                await sendTextMessage({ text: 'Estamos localizado na:' });
                await sendTextMessage({ text: 'RUA CORONEL CATÃO, 00 CENTRO. 65485-000 Itapecuru Mirim - MA' });
                await sendTextMessage({ text: 'Acesse: https://share.google/UPikuzTRsT9VXBksM' });
                break;
            case 'atendimento':
                await askAttendant();
                break;
            case 'status_matriculas':
                await sendTextMessage({ text: 'Sim!! Estamos com matrículas abertas. Para saber mais, posso sugerir uma assistência humana para você.' })
                await sendTextMessage({ text: 'Se quiser uma assistência humana, basta enviar *"Quero uma assistência humana."*' })
                break;
            case 'limit_exceeded':
                await sendTextMessage({ text: `O *${BOT_NAME}* teve um erro ao processar sua mesnagem, aguarde enquanto lhe redirecionamos para um atendimento humano.` })
                await askAttendant();
                await bot.sendMessage(`${DEVELOPER_PHONE_NUMBER}@s.whatsapp.net`, {
                    text: `⚠️ *PROBLEMAS NO ${BOT_NAME.toUpperCase()}:*\n- Limite de requisições atingido`
                });
                break
            case 'api_key_invalid':
                await sendTextMessage({ text: `O *${BOT_NAME}* teve um erro ao processar sua mesnagem, aguarde enquanto lhe redirecionamos para um atendimento humano.` })
                await askAttendant();
                await bot.sendMessage(`${DEVELOPER_PHONE_NUMBER}@s.whatsapp.net`, {
                    text: `⚠️ *PROBLEMAS NO ${BOT_NAME.toUpperCase()}:*\n- Chave API-KEy invalidada`
                });
                break
            default:
                await sendTextMessage({ text: userIntent })
                return
        }

        const list = removeItemStringArray(waitingList, fromLid as string);
        waitingList = list
    });
}

start();
