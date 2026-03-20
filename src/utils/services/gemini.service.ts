const context = `
Você é um classificador de intenção de mensagens de usuários em um sistema de atendimento escolar.

Sua tarefa é analisar a mensagem do usuário e responder EXATAMENTE com UMA ÚNICA PALAVRA, seguindo as regras abaixo.

REGRAS OBRIGATÓRIAS:
- Responda apenas com 1 palavra
- Use apenas letras minúsculas
- NÃO use acentos
- NÃO use pontuação
- NÃO explique
- NÃO escreva frases
- NÃO invente categorias
- Se estiver em dúvida, responda: generico

CATEGORIAS PERMITIDAS (responda exatamente uma delas):

mensagem_inicial -> quando o usuário apenas cumprimenta ou inicia conversa (ex: oi, olá, bom dia, boa tarde, boa noite, tudo bem [ou qualquer coisa que remeta ao início de uma conversa])

reclamacao -> quando o usuário demonstra insatisfação, reclama ou expressa raiva
matricula -> quando pergunta sobre cursos, turmas ou séries disponíveis
parceiros -> quando pergunta sobre parcerias, diferenciais ou inovação

primeiro_ano
segundo_ano
terceiro_ano
quarto_ano
quinto_ano
sexto_ano
setimo_ano
oitavo_ano
nono_ano

agradecimento -> quando é algum tipo de agradecimento

status_matriculas -> quando pergunta se matrículas estão abertas ou fechadas
atendimento -> quando quer falar com humano ou suporte direto
horarios -> quando pergunta sobre horário de funcionamento
localizacao -> quando pergunta endereço ou localização

generico -> quando não tem relação com escola ou não é possível identificar

IMPORTANTE:
- Se o usuário mencionar um ano específico, priorize o ano (ex: "tem vaga no 3º ano?" -> terceiro_ano)
- Cumprimentos simples SEM outra intenção devem retornar: mensagem_inicial
- Se houver cumprimento + pergunta, priorize a intenção principal (ex: "oi, quais cursos vocês têm?" -> matricula)
- Nunca responda algo fora da lista
- Nunca escreva mais de uma palavra

EXEMPLOS:

Mensagem: "Oi"
Resposta: mensagem_inicial

Mensagem: "Bom dia"
Resposta: mensagem_inicial

Mensagem: "Oi, tudo bem?"
Resposta: mensagem_inicial

Mensagem: "Oi, quais cursos vocês têm?"
Resposta: matricula

Mensagem: "Quero reclamar do atendimento"
Resposta: reclamacao

Mensagem: "Onde fica a escola?"
Resposta: localizacao

Mensagem: "Vocês têm 2º ano?"
Resposta: segundo_ano

Mensagem: "Qual o horário?"
Resposta: horarios

Mensagem: "asdfgh"
Resposta: generico

Mensagem: "Ah, ok, obg"
Resposta: agradecimento

Mensagem: "obreigada"
Resposta: agradecimento

---

MENSAGEM DO USUÁRIO:
`;

import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

export class GeminiAI {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        const apiKey = process.env.GEMINI_APIKEY as string;

        if (!apiKey) {
            throw new Error("GEMINI_APIKEY não definida");
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-2.5-flash"
        });
    }

    async response(text: string): Promise<string> {
        try {
            const result = await this.model.generateContent(
                `${context}\n${text}`
            );

            const raw = result.response.text().trim();

            const normalized = raw
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // remove acento
                .replace(/[^a-z_]/g, ""); // remove qualquer coisa fora padrão

            // 🔒 lista permitida (garantia final)
            const allowed = [
                "reclamacao",
                "matricula",
                "parceiros",
                "primeiro_ano",
                "segundo_ano",
                "terceiro_ano",
                "quarto_ano",
                "quinto_ano",
                "sexto_ano",
                "setimo_ano",
                "oitavo_ano",
                "nono_ano",
                "status_matriculas",
                "atendimento",
                "horarios",
                "localizacao",
                "mensagem_inicial",
                "agradecimento",
                "generico",
                "api_key_invalid"
            ];

            if (!allowed.includes(normalized)) {
                return "generico";
            }

            return normalized;

        } catch (error: any) {
            console.error("Erro Gemini:", error);

            const message = (error?.message || "").toLowerCase();

            // 🔒 detecta erro de API KEY
            if (
                message.includes("api key") ||
                message.includes("invalid api key") ||
                message.includes("permission denied") ||
                message.includes("unauthorized") ||
                error?.status === 401 ||
                error?.status === 403
            ) {
                return "api_key_invalid";
            }

            return "generico";
        }
    }

}