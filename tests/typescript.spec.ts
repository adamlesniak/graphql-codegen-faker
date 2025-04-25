import { buildSchema } from "graphql";
import { plugin } from "../src/index";

describe("TypeScript", () => {
  it("should expose Maybe", async () => {
    const schema = buildSchema(/* GraphQL */ `
      scalar A
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
