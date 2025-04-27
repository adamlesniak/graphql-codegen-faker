import { buildSchema } from "graphql";
import { plugin } from "../src/index";

describe("Faker", () => {
  it("should pass with sample decorators", async () => {
    const schema = buildSchema(/* GraphQL */ `
      scalar FakerArgs

      directive @faker(
        module: String!
        method: String!
        args: FakerArgs
      ) on FIELD_DEFINITION
      directive @fakerResolvers on OBJECT
      directive @fakerList(items: Int!, name: String!) on OBJECT
      directive @fakerResolve(resolve: String!, type: String!, by: String) on FIELD_DEFINITION

      type User @fakerList(items: 20, name: user) {
        id: String @faker(module: string, method: uuid, args: { sex: "male" })
        name: String @faker(module: person, method: firstName)
        email: String
        password: String
        createdAt: String
        updatedAt: String
      }

      type Query @fakerResolvers {
        user(id: String): User @fakerResolve(resolve: user, type: single, by: id)
        users: [User] @fakerResolve(resolve: user, type: list)
      }

      type Mutation @fakerResolvers {
        createUser(name: String, email: String, password: String): User @fakerResolve(resolve: user, type: add, by: id)
        updateUser(
          id: String
          name: String
          email: String
          password: String
        ): User @fakerResolve(resolve: user, type: update, by: id)
        deleteUser(id: String): User @fakerResolve(resolve: user, type: delete, by: id)
      }
    `);
    const result = await plugin(schema, [], {}, { outputFile: "" });

    expect(result.prepend).toEqual([
      "import { fakerEN as faker } from '@faker-js/faker';",
    ]);
    expect(result.content).toEqual(
      [
        'export const mockUser = {id: faker.string.uuid({"sex":"male"}),name: faker.person.firstName()};',
        "export const mockUserList = Array.from({ length: 20 }, () => ({...mockUser}));",
      ].join("\n")
    );
  });
});
