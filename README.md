# Product Management API

API NestJS para cadastro de usuarios, autenticacao JWT e gerenciamento de produtos com PostgreSQL + Prisma.

## Stack

- NestJS
- Prisma ORM
- PostgreSQL
- JWT com access token e refresh token
- Swagger/OpenAPI
- Postman
- Jest + Supertest

## Requisitos

- Node.js 22+
- Docker opcional para subir o PostgreSQL

## Configuracao

1. Copie `.env.example` para `.env`.
2. Suba o banco:

```bash
docker compose up -d
```

O PostgreSQL deste projeto fica exposto em `localhost:5433` para evitar conflito com outras instancias locais.

3. Gere o client Prisma e aplique a migration:

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Inicie a API:

```bash
npm run start:dev
```

## Documentacao

- Swagger UI: `http://localhost:3000/docs`
- Prefixo da API: `http://localhost:3000/api`
- Colecao Postman: [docs/postman.collection.json](/c:/workspace/testRegisterProductBackend/docs/postman.collection.json)
- Environment Postman: [docs/postman.environment.json](/c:/workspace/testRegisterProductBackend/docs/postman.environment.json)

## Rotas

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

## Filtros de produtos

`GET /api/products` aceita:

- `name`
- `description`
- `minPrice`
- `maxPrice`

## Regras de negocio

- Apenas usuarios autenticados criam, editam e removem produtos.
- O usuario autenticado so pode editar e remover produtos do proprio cadastro.
- Listagem e detalhamento de produtos sao publicos.
- Emails sao unicos.
- Senhas sao armazenadas com hash bcrypt.
- Refresh tokens sao persistidos com hash no banco e rotacionados no refresh.

## Testes

```bash
npm test
npm run test:e2e
```
