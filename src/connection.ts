import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";

import pino from "pino";
import { BOT_PHONE_NUMBER } from "./config.js";
import { Boom } from "@hapi/boom";
import { delay } from "./utils/functions/index.js";


async function ConnectionBot() {

    const { state, saveCreds } = await useMultiFileAuthState("./assets/session");

    const { version } = await fetchLatestBaileysVersion();

    const bot = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false
    });

    bot.ev.on("creds.update", saveCreds);

    bot.ev.on("connection.update", async ({ connection, lastDisconnect }) => {

        if (connection === "connecting") {
            console.log("Conectando...");
        }

        if (connection === "open") {
            console.log("Bot conectado");
        }

        // 🔑 pedir código só depois de esperar socket iniciar
        if (!bot.authState.creds.registered && connection === "connecting") {

            await delay(3000);

            const code = await bot.requestPairingCode(BOT_PHONE_NUMBER);

            console.log("\nCódigo de conexão:");
            console.log(code);
            console.log("\nDigite no WhatsApp → Aparelhos conectados → Conectar dispositivo");
        }

        if (connection === "close") {

            const statusCode =
                (lastDisconnect?.error as Boom)?.output?.statusCode;

            const shouldReconnect =
                statusCode !== DisconnectReason.loggedOut;

            console.log("Conexão fechada");

            if (shouldReconnect) ConnectionBot();
        }

    });

    return bot;
}

export default ConnectionBot;