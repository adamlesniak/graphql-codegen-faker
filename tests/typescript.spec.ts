import { buildSchema } from "graphql";
import { plugin } from "../src/index";

describe("TypeScript", () => {
  it("should expose Maybe", async () => {
    const schema = buildSchema(/* GraphQL */ `
      scalar FakerArgs

      directive @faker(
        module: String!
        method: String!
        args: FakerArgs
      ) on FIELD_DEFINITION
      directive @fakerResolvers on OBJECT
      directive @fakerList(items: Int!) on OBJECT

      type User @fakerList(items: 20) {
        id: String @faker(module: string, method: uuid, args: { sex: "male" })
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
      "import { fakerEN as faker } from '@faker-js/faker';",
    ]);
    expect(result.content).toEqual(
      [
        'export const mockUser = {id: faker.string().uuid({"sex":"male"}),name: faker.person().firstName()};',
        "export const mockUserList = Array.from({ length: 20 }, () => ({...mockUser}));",
      ].join("\n")
    );
  });
});
