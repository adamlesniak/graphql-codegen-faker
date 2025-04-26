import {
  BaseTypesVisitor,
  DeclarationKind,
  getConfigValue,
  ParsedTypesConfig,
} from "@graphql-codegen/visitor-plugin-common";
import autoBind from "auto-bind";
import {
  ArgumentNode,
  DirectiveNode,
  EnumValueNode,
  GraphQLSchema,
  IntValueNode,
  ObjectTypeDefinitionNode,
  ObjectValueNode,
  StringValueNode,
} from "graphql";
import { ArgumentName, Directives, TypeScriptPluginConfig } from "./config";

export interface TypeScriptPluginParsedConfig extends ParsedTypesConfig {
  mockPrefix: string;
}

export const EXACT_SIGNATURE = `type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };`;
export const MAKE_OPTIONAL_SIGNATURE = `type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };`;
export const MAKE_MAYBE_SIGNATURE = `type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };`;
export const MAKE_EMPTY_SIGNATURE = `type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };`;
export const MAKE_INCREMENTAL_SIGNATURE = `type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };`;

type Directivable = { directives?: ReadonlyArray<DirectiveNode> };
type Argumentable = { arguments?: ReadonlyArray<ArgumentNode> };

export class TsVisitor<
  TRawConfig extends TypeScriptPluginConfig = TypeScriptPluginConfig,
  TParsedConfig extends TypeScriptPluginParsedConfig = TypeScriptPluginParsedConfig
> extends BaseTypesVisitor<TRawConfig, TParsedConfig> {
  constructor(
    schema: GraphQLSchema,
    pluginConfig: TRawConfig,
    additionalConfig: Partial<TParsedConfig> = {}
  ) {
    super(schema, pluginConfig, {
      mockPrefix: getConfigValue(pluginConfig.mockPrefix, "mock"),
      ...additionalConfig,
    } as TParsedConfig);

    autoBind(this);
  }

  ObjectTypeDefinition(node: ObjectTypeDefinitionNode): string | undefined {
    const typeName = (node.name as unknown as string) || node.name.value;

    const result = {
      name: typeName,
      fields: [],
    };

    const type = this._schema.getTypeMap()[typeName]
      .astNode as ObjectTypeDefinitionNode;

    for (const field of type.fields) {
      const fakerDirective = this._getDirectiveFromAstNode(
        field,
        Directives.FAKER
      );

      if (fakerDirective) {
        const [module, method, args] = [
          this._getArgumentFromDirectiveAstNode(
            fakerDirective,
            ArgumentName.MODULE
          ).value as EnumValueNode,
          this._getArgumentFromDirectiveAstNode(
            fakerDirective,
            ArgumentName.METHOD
          ).value as EnumValueNode,
          this._getArgumentFromDirectiveAstNode(
            fakerDirective,
            ArgumentName.ARGS
          )?.value as ObjectValueNode,
        ];

        const props = {};

        if (args?.fields) {
          for (const fakerField of args.fields) {
            props[fakerField.name.value] = (
              fakerField.value as StringValueNode
            ).value;
          }
        }

        result.fields = [
          ...result.fields,
          `${field.name.value}: faker.${module.value}().${method.value}(${
            Object.values(props).length > 0 ? JSON.stringify(props) : ""
          })`,
        ];
      }
    }

    const fakerListDirective = this._getDirectiveFromAstNode(
      node,
      Directives.FAKER_LIST
    );

    let fakerResult = [];

    if (result.fields.length > 0) {
      fakerResult = [
        `export const ${
          this.config.mockPrefix
        }${typeName} = {${result.fields.join(",")}};`,
      ];

      if (fakerListDirective) {
        const [items] = [
          this._getArgumentFromDirectiveAstNode(
            fakerListDirective,
            ArgumentName.ITEMS
          ).value as IntValueNode,
        ];

        fakerResult = [
          ...fakerResult,
          `export const ${this.config.mockPrefix}${typeName}List = Array.from({ length: ${items.value} }, () => ({...${this.config.mockPrefix}${typeName}}));`,
        ];
      }

      return fakerResult.join("\n");
    }

    return "";
  }

  private _getDirectiveFromAstNode(
    node: Directivable,
    directiveName: Directives
  ): DirectiveNode | null {
    if (!node || !node.directives || node.directives.length === 0) {
      return null;
    }

    const foundDirective = node.directives.find(
      (d) =>
        (d.name as any) === directiveName ||
        (d.name.value && d.name.value === directiveName)
    );

    if (!foundDirective) {
      return null;
    }

    return foundDirective;
  }

  private _getArgumentFromDirectiveAstNode(
    node: Argumentable,
    argumentName: ArgumentName
  ): ArgumentNode | null {
    if (!node || !node.arguments || node.arguments.length === 0) {
      return null;
    }

    const foundArgument = node.arguments.find(
      (d) =>
        (d.name as any) === argumentName ||
        (d.name.value && d.name.value === argumentName)
    );

    if (!foundArgument) {
      return null;
    }

    return foundArgument;
  }

  protected getPunctuation(_declarationKind: DeclarationKind): string {
    return ";";
  }
}
