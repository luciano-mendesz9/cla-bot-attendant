import fs from "fs";
import { BASE_PERSONALITY_MODEL_FILE_PATH } from "../../config.js";
const basicPersonality = fs.readFileSync(BASE_PERSONALITY_MODEL_FILE_PATH, "utf-8");
const conversations = [];
class LargeLanguageModel {
    url = "http://localhost:11434/api/generate";
    async answerQuestion(id, text) {
        let conversation = conversations.find(c => c.id === id);
        if (!conversation) {
            conversation = {
                id,
                messages: []
            };
            conversations.push(conversation);
        }
        // adiciona mensagem do cliente
        conversation.messages.push({
            sender: "client",
            content: text
        });
        // pegar últimas 10 mensagens
        const lastMessages = conversation.messages.slice(-10);
        const history = lastMessages
            .map(m => `${m.sender === "client" ? "Cliente" : "Assistente"}: ${m.content}`)
            .join("\n");
        const prompt = `
${basicPersonality}

Você está conversando com um cliente.

Histórico recente da conversa:
${history}

Cliente: ${text}
Assistente:
`;
        try {
            const response = await fetch(this.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gemma3:1b",
                    prompt,
                    stream: false
                })
            });
            const data = await response.json();
            const answer = data.response?.trim();
            if (!answer)
                return null;
            // salva resposta da IA
            conversation.messages.push({
                sender: "agent",
                content: answer
            });
            // limita memória
            conversation.messages = conversation.messages.slice(-10);
            return answer;
        }
        catch (error) {
            console.error("Erro na IA:", error);
            return null;
        }
    }
    verifyFirstUserMessage(userId) {
        const conversation = conversations.find(c => c.id === userId);
        return !conversation;
    }
    getCacheConversation(id) {
        return conversations.find(c => c.id === id) || null;
    }
}
export default LargeLanguageModel;
