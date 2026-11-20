# Ligar a sincronização (Supabase, plano grátis)

Leva uns 10 minutos e só precisa ser feito uma vez.

## 1. Criar o projeto

1. Entre em https://supabase.com e crie uma conta (pode usar o GitHub).
2. Clique em **New project**, escolha um nome (ex.: `caderno-digital`), crie uma senha para o banco e escolha a região **South America (São Paulo)**.
3. Espere o projeto terminar de ser criado (1 a 2 minutos).

## 2. Criar as tabelas e o armazenamento

1. No menu da esquerda, abra **SQL Editor** → **New query**.
2. Copie todo o conteúdo do arquivo [`supabase/setup.sql`](../supabase/setup.sql), cole e clique em **Run**.
3. Deve aparecer "Success. No rows returned".

## 3. Facilitar o login (opcional, recomendado)

Em **Authentication → Sign In / Providers → Email**, desligue **Confirm email**.
Assim a conta já funciona ao ser criada, sem precisar abrir o e-mail de confirmação.

## 4. Copiar a conexão

Em **Project Settings → API** (ou **Data API**), copie:

- **Project URL** (algo como `https://abcd1234.supabase.co`)
- **anon public** key (um texto longo que começa com `eyJ`)

A chave *anon* é pública por natureza: quem protege os dados são as regras do `setup.sql`,
que deixam cada pessoa ver só o próprio caderno. **Nunca** use a chave `service_role` no site.

## 5. Conectar o caderno

No caderno: **Capa → Sincronização e backup**.

1. Cole a URL e a chave e clique em **Salvar conexão**.
2. Digite seu e-mail e uma senha e clique em **Criar conta** (na primeira vez) ou **Entrar**.
3. Repita o passo 5 em cada aparelho (computador, tablet, celular), com o mesmo e-mail e senha.

Para não precisar colar a URL e a chave em cada aparelho, elas podem ficar fixas no site:
crie os *secrets* `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no repositório
(Settings → Secrets and variables → Actions). O deploy já lê esses valores.

## Como funciona

- O caderno continua salvando tudo no aparelho e funciona sem internet.
- As alterações sobem para a nuvem alguns segundos depois; os outros aparelhos baixam a cada 30 segundos, ao voltar para a aba ou quando a internet volta.
- Se a mesma coisa for editada em dois aparelhos ao mesmo tempo, vale a última edição.
- A nuvenzinha na barra de cima mostra o estado: verde = sincronizado, amarela = sincronizando, vermelha = erro.

## Limites do plano grátis

- 500 MB de banco e 1 GB de arquivos (PDFs e imagens).
- Se o projeto ficar 7 dias sem nenhum acesso, o Supabase pausa. É só entrar no painel e clicar em **Restore**; nada é perdido.
