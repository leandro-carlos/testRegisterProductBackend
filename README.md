# Product Management API

API REST construída com NestJS para cadastro de usuários, autenticação com JWT e gerenciamento de produtos com PostgreSQL e Prisma.

## Visão Geral

O projeto expõe uma API com:

- cadastro e login de usuários
- consulta do usuário autenticado
- CRUD de produtos
- filtros públicos por nome, descrição e faixa de preço
- documentação Swagger
- testes unitários e e2e

## Stack

- Node.js 22+
- NestJS 11
- PostgreSQL 16
- Prisma ORM
- JWT
- Swagger / OpenAPI
- Jest + Supertest
- Docker Compose

## Funcionalidades

- autenticação com e-mail e senha
- tokens configurados como sem expiração
- listagem pública de produtos
- criação, edição e remoção de produtos apenas por usuários autenticados
- proteção para que apenas o dono do produto possa alterá-lo ou removê-lo

## Estrutura Base

```text
src/
  auth/
  common/
  config/
  database/
  products/
  users/
prisma/
  migrations/
docs/
test/
scripts/
```

## Requisitos

- Node.js 22 ou superior
- npm
- Docker Desktop em execução

## Variáveis de Ambiente

Crie o arquivo `.env` com base no `.env.example`.

Exemplo:

```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/product_manager?schema=public"
JWT_ACCESS_SECRET="replace-with-a-secure-access-secret"
JWT_REFRESH_SECRET="replace-with-a-secure-refresh-secret"
JWT_ACCESS_EXPIRES_IN="never"
JWT_REFRESH_EXPIRES_IN="never"
```

## Instalação

```bash
npm install
```

## Inicialização Rápida

Para subir o banco, gerar o Prisma Client, aplicar as migrations existentes, iniciar o Prisma Studio, subir o backend em modo watch e abrir o Swagger automaticamente:

```bash
npm run dev:workspace
```

Esse comando:

- executa `docker compose up -d`
- aguarda o PostgreSQL ficar pronto
- roda `prisma generate`
- roda `prisma migrate deploy`
- inicia o Prisma Studio
- inicia a API com watch
- abre `http://localhost:3000/docs`

## Inicialização Manual

1. Suba o banco:

```bash
docker compose up -d
```

2. Gere o client do Prisma:

```bash
npm run prisma:generate
```

3. Aplique as migrations:

```bash
npx prisma migrate deploy
```

4. Inicie o backend:

```bash
npm run start:dev
```

5. Opcionalmente, abra o Prisma Studio:

```bash
npm run prisma:studio
```

## URLs Importantes

- Swagger UI: `http://localhost:3000/docs`
- API base: `http://localhost:3000/api`
- PostgreSQL: `localhost:5433`

## Rotas

Prefixo global: `/api`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

### Users

- `GET /api/users/me`

### Products

- `POST /api/products`
- `GET /api/products`
- `GET /api/products/:id`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`

## Filtros de Produtos

`GET /api/products` aceita os seguintes parâmetros de query:

- `name`
- `description`
- `minPrice`
- `maxPrice`

Exemplo:

```http
GET /api/products?name=mouse&minPrice=50&maxPrice=300
```

## Regras de Negócio

- e-mails são únicos
- senhas são armazenadas com hash `bcrypt`
- produtos podem ser listados e consultados publicamente
- apenas usuários autenticados podem criar produtos
- apenas o proprietário pode editar ou remover o produto
- o refresh token é armazenado com hash no banco

O schema Prisma está em [prisma/schema.prisma](c:/workspace/testRegisterProductBackend/prisma/schema.prisma).

## Documentação e Coleções

- Swagger: `http://localhost:3000/docs`
- Postman Collection: [docs/postman.collection.json](c:/workspace/testRegisterProductBackend/docs/postman.collection.json)
- Postman Environment: [docs/postman.environment.json](c:/workspace/testRegisterProductBackend/docs/postman.environment.json)

## Observações

- o script `npm run prisma:migrate` usa `prisma migrate dev`, indicado para desenvolvimento local
- o script `npm run dev:workspace` usa `prisma migrate deploy`, mais seguro para inicialização automática
- se o `prisma generate` falhar no Windows com erro de arquivo travado, normalmente há algum processo Node mantendo o engine do Prisma em uso
