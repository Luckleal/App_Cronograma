# Meu Cronograma

Um aplicativo de agenda para gerenciar plantões, aulas e estágios com suporte a módulos, locais e lembretes automáticos.

## O que o app faz

- **Registre plantões, aulas e estágios** com data, horário e detalhes
- **Organize por módulos** para categorizar suas atividades
- **Registre locais** de cada compromisso
- **Receba lembretes** automáticos via notificações
- **Salvamento automático** no próprio aparelho
- **Exportação em CSV** do cronograma
- **Interface responsiva** (mobile, tablet e web)

## Privacidade

Todos os seus dados são armazenados **exclusivamente no seu aparelho**. Não há sincronização com servidores. Ao limpar dados do app, todas as informações são completamente removidas, inclusive a foto de perfil.

No Android, o backup automático do sistema fica ativo: os dados do app podem ser incluídos no backup da conta Google do próprio usuário, o que permite recuperar o cronograma ao trocar de aparelho.

## Requisitos

- **Node.js** 20 ou superior
- **Expo Go** (para testar no celular)

## Como começar

1. **Instale as dependências:**

   ```bash
   npm install
   ```

2. **Inicie o aplicativo:**

   ```bash
   npx expo start
   ```

3. **Escolha uma plataforma:**
   - **Android/iOS:** Abra o Expo Go no seu celular e escaneie o QR code
   - **Web:** Pressione `w` ou acesse `http://localhost:8081`

## Scripts disponíveis

- `npm start` — Inicia o Expo em modo desenvolvimento
- `npm run web` — Executa a versão web
- `npm run android` — Executa no Android
- `npm run ios` — Executa no iOS
- `npm test` — Executa testes
- `npm run test:coverage` — Testes com relatório de cobertura
- `npm run lint` — Verifica qualidade do código
- `npm run lint:fix` — Corrige problemas de linting automaticamente
- `npm run format` — Formata o código com Prettier
- `npm run format:check` — Verifica formatação
- `npm run typecheck` — Verifica tipos TypeScript

## Estrutura do projeto

```
.
├── app/                    # Rotas e telas (expo-router)
├── src/
│   ├── components/         # Componentes reutilizáveis
│   ├── store/              # Estado global (Zustand)
│   ├── utils/              # Funções utilitárias
│   └── notifications.ts    # Configuração de notificações
├── __tests__/              # Testes
├── assets/                 # Ícones e imagens
└── package.json            # Dependências e scripts
```

## Integração contínua

O projeto usa **GitHub Actions** para validação automática em cada push e pull request. O workflow inclui:

- Verificação de formatação (Prettier)
- Linting (ESLint)
- Type checking (TypeScript)
- Testes com cobertura (Jest)
- Auditoria de dependências

## Stack tecnológico

- **Expo SDK 54** — Framework mobile
- **expo-router 6** — Roteamento
- **React Native** — Framework UI
- **TypeScript** — Tipagem
- **Zustand** — Gerenciamento de estado
- **AsyncStorage** — Persistência de dados
- **expo-notifications** — Lembretes
- **Jest** — Testes

## Licença

Copyright (c) 2026 Luckleal. Todos os direitos reservados. O código está público apenas para visualização; veja [LICENSE](LICENSE).
