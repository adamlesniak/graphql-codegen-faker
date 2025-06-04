# graphql-codegen-faker

GraphQL Code Generator Plugin to define mock data factory.

## Getting started

```sh
npm run prepare
```

## Installation

```sh
npm install -D @alesniak/graphql-codegen-faker @graphql-codegen/cli @graphql-codegen/typescript
npm install -S graphql
```

## Requirements

- `graphql` >= 16.0.0
- `typescript` >= 5.0.0
  - `--moduleResolution Bundler`, `--moduleResolution Node16` or `--moduleResolution NodeNext` is required

## Usage

```ts
// codegen.ts
import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './schema.graphql',
  generates: {
    './__generated__/mocks.ts': {
      plugins: ['@alesniak/graphql-codegen-faker'],
      config: {
        locality: 'EN',
        mockPrefix: 'mock',
      },
    },
  },
};

export default config;
```

```graphql
type User @fakerList(items: 20, name: user) {
  id: String @faker(module: string, method: uuid)
  name: String @faker(module: person, method: firstName)
  email: String @faker(module: internet, method: email)
  password: String @faker(module: internet, method: password)
  createdAt: String @faker(module: date, method: past)
  updatedAt: String @faker(module: date, method: past)
}
```

```sh
npx graphql-codegen
```

```ts
import { mockUserList } from '../__generated__/mocks';

const user = mockUserList[0];
```

## License

This library is licensed under the MIT license.
