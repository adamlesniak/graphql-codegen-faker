import { buildSchema } from 'graphql';
import { plugin } from '../src/index';

describe('Faker', () => {
  it('should pass with sample decorators', async () => {
    const schema = buildSchema(/* GraphQL */ `
      scalar FakerArgs

      directive @faker(
        module: String!
        method: String!
        args: FakerArgs
      ) on FIELD_DEFINITION
      directive @fakerList(items: Int!, name: String!) on OBJECT
      type User @fakerList(items: 20, name: user) {
        id: String @faker(module: string, method: uuid, args: { sex: "male" })
        name: String @faker(module: person, method: firstName)
        email: String
        password: String
        createdAt: String
        updatedAt: String
      }
    `);
    const result = await plugin(schema, [], {}, { outputFile: '' });

    expect(result.prepend).toEqual([
      "import { fakerEN as faker } from '@faker-js/faker';",
    ]);
    expect(result.content).toEqual(
      [
        'export const mockUser = {id: faker.string.uuid({"sex":"male"}),name: faker.person.firstName()};',
        'export const mockUserList = Array.from({ length: 20 }, () => ({...mockUser}));',
      ].join('\n')
    );
  });

  it('should generate nested types', async () => {
    const schema = buildSchema(/* GraphQL */ `
      scalar FakerArgs

      directive @faker(
        module: String!
        method: String!
        args: FakerArgs
      ) on FIELD_DEFINITION
      directive @fakerNested on FIELD_DEFINITION
      directive @fakerList(items: Int!, name: String!) on OBJECT

      type User @fakerList(items: 20, name: user) {
        id: String @faker(module: string, method: uuid)
        name: String @faker(module: person, method: firstName)
        email: String
        password: String
        properties: UserProperties! @fakerNested
        createdAt: String
        updatedAt: String
      }

      type UserProperties @fakerList(items: 20, name: userProperties) {
        id: String @faker(module: string, method: uuid)
        name: String @faker(module: person, method: firstName)
      }
    `);
    const result = await plugin(schema, [], {}, { outputFile: '' });

    expect(result.prepend).toEqual([
      "import { fakerEN as faker } from '@faker-js/faker';",
    ]);
    expect(result.content).toEqual(
      [
        'export const mockUser = {id: faker.string.uuid(),name: faker.person.firstName(),properties: {id: faker.string.uuid(),name: faker.person.firstName()}};',
        'export const mockUserList = Array.from({ length: 20 }, () => ({...mockUser}));',
        'export const mockUserProperties = {id: faker.string.uuid(),name: faker.person.firstName()};',
        'export const mockUserPropertiesList = Array.from({ length: 20 }, () => ({...mockUserProperties}));',
      ].join('\n')
    );
  });


  it('should generate nested types - array', async () => {
    const schema = buildSchema(/* GraphQL */ `
      scalar FakerArgs

      directive @faker(
        module: String!
        method: String!
        args: FakerArgs
      ) on FIELD_DEFINITION
      directive @fakerNested on FIELD_DEFINITION
      directive @fakerList(items: Int!, name: String!) on OBJECT

      type User @fakerList(items: 20, name: user) {
        id: String @faker(module: string, method: uuid)
        name: String @faker(module: person, method: firstName)
        email: String
        password: String
        properties: [UserProperties]! @fakerNested
        createdAt: String
        updatedAt: String
      }

      type UserProperties @fakerList(items: 20, name: userProperties) {
        id: String @faker(module: string, method: uuid)
        name: String @faker(module: person, method: firstName)
      }
    `);
    const result = await plugin(schema, [], {}, { outputFile: '' });

    expect(result.prepend).toEqual([
      "import { fakerEN as faker } from '@faker-js/faker';",
    ]);
    expect(result.content).toEqual(
      [
        'export const mockUser = {id: faker.string.uuid(),name: faker.person.firstName(),properties: [{id: faker.string.uuid(),name: faker.person.firstName()}]};',
        'export const mockUserList = Array.from({ length: 20 }, () => ({...mockUser}));',
        'export const mockUserProperties = {id: faker.string.uuid(),name: faker.person.firstName()};',
        'export const mockUserPropertiesList = Array.from({ length: 20 }, () => ({...mockUserProperties}));',
      ].join('\n')
    );
  });
});
