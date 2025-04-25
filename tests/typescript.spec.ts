import { buildSchema } from "graphql";
import { plugin } from "../src/index";

describe("TypeScript", () => {
  it("should expose Maybe", async () => {
    const schema = buildSchema(/* GraphQL */ `
      directive @faker(
        module: String!
        method: String!
        args: String
      ) on FIELD_DEFINITION
      directive @fakerResolvers on OBJECT
      directive @fakerList(items: Int!) on OBJECT

      type User @fakerList(items: 20) {
        id: String @faker(module: string, method: uuid, args: "{sex: 'male'}")
        name: String @faker(module: person, method: firstName)
        email: String
        password: String
        createdAt: String
        updatedAt: String
      }

      type Query @fakerResolvers {
        user(id: String): User
        users: [User]
      }

      type Mutation @fakerResolvers {
        createUser(name: String, email: String, password: String): User
        updateUser(
          id: String
          name: String
          email: String
          password: String
        ): User
        deleteUser(id: String): User
      }
    `);
    const result = await plugin(schema, [], {}, { outputFile: "" });
    expect(result.prepend).toEqual([
      "export type Maybe<T> = T | null;",
      "export type InputMaybe<T> = Maybe<T>;",
      "export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };",
      "export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };",
      "export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };",
      "export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };",
      "export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };",
    ]);
  });
});
