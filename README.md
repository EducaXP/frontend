# EducaXP — frontend PWA

Aplicação React + TypeScript + Vite integrada à API Fastify. Usa os assets originais de `../stitch_educaxp`, com interface responsiva, missões colaborativas e acesso offline previamente preparado.

## Executar

Requisito: Node.js 22.13+ e npm. Primeiro prepare e execute o backend conforme [seu README](../backend/README.md). Use o login docente, código da turma e PINs impressos pelo `seed:demo`; não existem credenciais fixas na interface.

Em outro terminal, dentro de `frontend`:

```powershell
npm ci
npm run dev
```

Abra `http://127.0.0.1:5173`. O proxy encaminha `/api` ao backend em `http://127.0.0.1:3333`. Para outro endereço, copie `.env.example` para `.env` e ajuste `API_PROXY_TARGET`. Preserve um `.env` já existente.

Para verificar instalação e funcionamento offline, use a compilação de produção:

```powershell
npm run build
npm run preview
```

Abra `http://127.0.0.1:4173`. O service worker fica ativo na compilação, não no servidor de desenvolvimento. Desenvolvimento e preview têm armazenamentos separados, pois usam portas diferentes.

O botão de instalação aparece quando o navegador oferece essa opção; também é possível instalar pelo menu do navegador. Em celulares, service worker e criptografia exigem HTTPS. Acesso por IP local via HTTP não substitui esse requisito. Não há hospedagem configurada. Para publicar, sirva `dist` por HTTPS e encaminhe `/api` à API na mesma origem; `vite preview` serve apenas à verificação local.

## Fluxos implementados

| Pessoa e necessidade            | Fluxo verificável                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Maria: preparar uma atividade   | Criar/adaptar missão com objetivo, etapas, alternativa em papel e rubrica; revisar e publicar   |
| Maria: organizar colaboração    | Cadastrar estudantes, entregar PIN individual, formar equipes e alternar papéis                 |
| Enzo: aprender em equipe        | Consultar missões, marcar etapas e registrar produção e reflexão do grupo                       |
| Enzo: continuar sem rede        | Preparar o acesso, abrir missão, editar offline, recarregar e recuperar o rascunho              |
| Equipe: preservar contribuições | Fila de envio com tentativas idempotentes e comparação explícita quando outra cópia foi enviada |
| Maria: mediar e avaliar         | Consultar entregas, revisar critérios, publicar devolutiva e reconhecer participação com XP     |
| Participação sem aparelho       | Professor registra produção em papel/oral pelo mesmo fluxo e com reconhecimento equivalente     |
| Enzo: personalizar              | Equipar itens cosméticos liberados por participação; imagem original do avatar e modo econômico |
| Turma: pedir apoio              | Pedido de orientação, resposta docente e combinado de pausa                                     |

Não há medição de atenção, troca de abas, tempo conectado ou ranking individual. O planejamento inclui um painel de conversa, proposta separada para revisão e modelo local editável. O backend pode usar OpenRouter ou uma API compatível, conforme sua configuração. Sem chave, o painel informa que aguarda ativação. Geração requer conexão e clique do professor; a reconexão não envia pedidos de IA automaticamente. Os testes simulam somente o transporte do provedor, sem chamadas a modelos reais. Veja o [contrato e o envio de dados](../docs/decisions/0003-assistente-ia.md). Referências à BNCC permanecem pendentes de validação docente.

## Uso offline e aparelhos compartilhados

1. Entre com conexão e a opção **Preparar acesso offline neste aparelho** marcada. Aguarde a indicação de que o aplicativo está preparado para abrir offline e confira as missões da turma.
2. Use sempre **Entrar e continuar**, com as mesmas credenciais. Sem internet, ou se o servidor estiver indisponível, o conteúdo local previamente preparado abre automaticamente. É possível consultar missões, preparar planejamento e guardar produção/reflexão textual.
3. **Guardar para enviar** coloca a produção na fila. Com o aplicativo aberto, a conexão voltar é suficiente: o acesso é confirmado/renovado em memória e as entregas são sincronizadas automaticamente, inclusive após recarregar e entrar offline. Não é necessário sair, entrar novamente ou apertar um botão de sincronização. Rascunhos que ainda não foram enviados para a fila continuam privados no aparelho.
4. Antes de trocar de pessoa, use **Sair ou trocar perfil**. A aplicação informa pendências e protege o conteúdo local. Não compartilhe PINs; a produção é compartilhada apenas entre os integrantes do grupo e o professor.

O retorno da rede dispara uma tentativa e a fila é reavaliada a cada cinco segundos enquanto o aplicativo estiver aberto. Falhas de transporte/servidor usam espera progressiva (até 60 segundos); limites de requisição respeitam Retry-After. Credenciais recusadas ou identidade diferente interrompem as tentativas automáticas e exibem uma mensagem, preservando os rascunhos. O aplicativo não envia com a página fechada.

Publicação, cadastro, ajuda, avaliação e personalização exigem conexão. Novos conteúdos não ficam disponíveis offline até uma atualização online. Não há colaboração em tempo real sem rede.

O IndexedDB guarda dados cifrados separados por identidade (AES-GCM; chave derivada da credencial com PBKDF2). Tokens e as credenciais digitadas permanecem somente em memória durante o acesso ativo, para permitir reconexão e renovação automática; não entram no cache nem no IndexedDB. Ao encerrar, esse acesso é descartado. Depois de fechar/recarregar o aplicativo, desbloqueie o conteúdo pelo mesmo formulário. Uma trava entre abas evita gravações concorrentes do mesmo perfil no mesmo navegador. Sem suporte ao armazenamento/criptografia/trava, desmarque a preparação offline para usar o acesso online temporário, que perde rascunhos ao fechar.

O acesso local expira após sete dias da última autenticação online. Limpeza de dados, falta de espaço, navegação privada ou remoção automática pelo navegador podem apagar o conteúdo. A interface informa falhas de gravação; mantenha a página aberta e copie o texto se isso acontecer. Atualizações da PWA aguardam a resolução de trabalho pendente.

**Limite do MVP:** um PIN de seis dígitos tem baixa entropia; a cifragem não representa proteção contra um atacante com cópia dos dados e capacidade de tentar PINs offline. A revogação no servidor só é percebida após conexão. Com conexão, o servidor valida as credenciais antes de abrir os dados locais. Se o PIN/senha mudou ou o login corresponde a uma conta recriada, o aplicativo prepara uma nova cópia offline e preserva a anterior, sem misturar rascunhos ou filas. Sem servidor, somente uma cópia já preparada com a credencial digitada pode abrir. Para recuperar rascunhos protegidos por um PIN/senha antigo, entre sem conexão com essa credencial e copie o trabalho enquanto o acesso local ainda estiver válido. Não limpe os dados do site: isso apagaria todas as cópias. Não há recifragem automática, recuperação de credenciais nem interface de seleção de arquivos antigos para contas recriadas com a mesma credencial. Esses limites precisam ser resolvidos antes de um piloto com dados reais.

## Assets e orçamento

Veja [origem dos assets](docs/assets.md). Logo e avatar são servidos localmente; fontes usam a família do sistema, sem downloads externos. A imagem do avatar (~1,29 MB) só é solicitada ao abrir sua tela e então fica em cache público. O avatar possui alternativa visual sem imagem se ela não estiver disponível.

Orçamento inicial: precache estático inferior a 600 KiB e JavaScript principal inferior a 100 kB gzip. Na compilação validada: ~471 KiB de precache, ~83 kB gzip no JavaScript principal e ~9,5 kB gzip no CSS. Telas de aluno, professor e produção são divididas em módulos. Esses números não são medições de velocidade em aparelhos de entrada.

## Verificação

```powershell
npm run check
```

Executa testes unitários do armazenamento/fila, verificação TypeScript e build. Para testes de navegador com API real e mecanismo PostgreSQL embarcado, compile o backend primeiro e então execute:

```powershell
npm run test:e2e
```

A suíte inicia servidores exclusivos nas portas 4319 e 4185 e cria dados fictícios isolados em `.test-data`; não usa o banco de desenvolvimento. No Windows usa o Edge instalado. Em outros ambientes instale o Chromium do Playwright com `npx playwright install chromium`; é possível escolher um navegador instalado via `PLAYWRIGHT_CHANNEL`.

Os testes cobrem recarga offline, reconexão sem novo login, renovação de sessão expirada, servidor indisponível mesmo com rede ativa, troca de perfil, proteção entre abas, envio, revisão, XP, avatar, publicação, organização e conflito entre duas cópias. O fluxo do assistente também é testado com respostas locais simuladas, incluindo refinamento, revisão e recuperação offline. O axe verifica regras WCAG A/AA no login, início do estudante e painel do assistente; há verificação de largura de 320 px. Isso não substitui validação manual com leitores de tela ou em aparelhos reais. No host de desenvolvimento, o antivírus injeta requisições próprias no Edge; o teste de dependências externas as identifica separadamente.

Limites adicionais: evidências textuais, composição fixa dos grupos, ausência de upload de mídia, push e gestão escolar. A qualidade das propostas de IA ainda precisa de validação com modelo real e revisão pedagógica. Ainda é necessário validar iOS/Safari, Android de entrada, persistência sob pressão de espaço e uso em escola real.
`overrides.vitest.vite` mantém o executor de testes na mesma versão compatível de Vite da aplicação, evitando uma segunda cadeia de ferramentas durante a resolução das dependências.


## Investigações e feedback

Informe os tópicos no assistente, revise as questões propostas e aplique ao editor. Também é possível criar perguntas manualmente em **Pontos-chave da investigação**. Estudantes respondem cada pergunta, com rascunhos offline e envio somente quando todas têm resposta. Missões sem questões mantêm a produção em texto livre.

Na correção, marque os níveis da rubrica e use **Sugerir feedback**. A sugestão é local, baseada nos níveis escolhidos; não é análise automática das respostas por IA. Revise, acrescente exemplos e aplique ao campo de devolutiva antes de publicar. Veja [contratos e compatibilidade](../docs/decisions/0004-investigacao-e-feedback.md).


## Foco e atualização online

O combinado e a reflexão da equipe concedem 25 XP por integrante, uma vez por missão, inclusive por registro mediado. O cronômetro é opcional e não mede atenção. Com conexão, mudanças chegam por SSE após a confirmação no PostgreSQL e aparecem sem recarregar a página, preservando rascunhos. Veja [regras, persistência, implantação e limites](../docs/decisions/0006-foco-e-atualizacoes.md).


A atualização online atual usa [SSE e LISTEN/NOTIFY](../docs/decisions/0007-sse.md), com reconexão automática. Publique o backend (migração 3) antes de atualizar o frontend/PWA. Não é necessário configurar webhook ou WebSocket.
