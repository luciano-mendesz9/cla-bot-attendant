import { PREFIX } from "../../config.js";
export const AdminMenu = () => {
    return `⚙️ *MENU ADMINISTRATIVO*
> Por favor, envie um número correspondente à sua necessidade e aguarde a resposta.

*Prefixo:* ${PREFIX}
 
- ${PREFIX}menu
- ${PREFIX}ping
- ${PREFIX}adicionar-atendente + número
- ${PREFIX}adicionar-admin + número

> Envie um desses comandos com o profixo!
`;
};
