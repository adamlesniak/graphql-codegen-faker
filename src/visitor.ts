import {
  getConfigValue,
  ParsedTypesConfig,
} from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import {
  ArgumentNode,
  DirectiveNode,
  EnumValueNode,
  GraphQLSchema,
  IntValueNode,
  ObjectTypeDefinitionNode,
  ObjectValueNode,
  StringValueNode,
} from 'graphql';
import { ArgumentName, Directives, FakerPluginConfig } from './config';

export interface FakerPluginParsedConfig extends ParsedTypesConfig {
  mockPrefix: string;
  locality: string;
}

type Directivable = { directives?: ReadonlyArray<DirectiveNode> };
type Argumentable = { arguments?: ReadonlyArray<ArgumentNode> };

export class FakerVisitor<
  TRawConfig extends FakerPluginConfig = FakerPluginConfig,
> {
  protected _parsedConfig: FakerPluginConfig;
  private _schema: GraphQLSchema;
  private data = {
    fields: new Map(),
  }

  constructor(
    schema: GraphQLSchema,
    pluginConfig: TRawConfig,
    additionalConfig: Partial<FakerPluginConfig> = {}
  ) {
    this._parsedConfig = {
      mockPrefix: getConfigValue(pluginConfig.mockPrefix, 'mock'),
      locality: getConfigValue(pluginConfig.locality, 'EN'),
      ...additionalConfig,
    };
    this._schema = schema;

    autoBind(this);
  }

  get config() {
    return this._parsedConfig;
  }

  ObjectTypeDefinition(node: ObjectTypeDefinitionNode): string | undefined {
    const typeName = node.name.value || ((node as any).name as string);

    const result = {
      name: typeName,
      fields: [],
    };

    const type = this._schema.getTypeMap()[typeName]
      .astNode as ObjectTypeDefinitionNode;

    const fakerListDirective = this._getDirectiveFromAstNode(
      node,
      Directives.FAKER_LIST
    );

    const [items] = [
      this._getArgumentFromDirectiveAstNode(
        fakerListDirective,
        ArgumentName.ITEMS
      ).value as IntValueNode,
    ];

    for (const field of type.fields) {
      const [fakerDirective, fakerNested] = [
        this._getDirectiveFromAstNode(
          field,
          Directives.FAKER
        ),
        this._getDirectiveFromAstNode(
          field,
          Directives.FAKER_NESTED
        )
      ];

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
          `${field.name.value}: faker.${module.value}.${method.value}(${Object.values(props).length > 0 ? JSON.stringify(props) : ''
          })`,
        ];

        this.data.fields.set(`${typeName}${field.name.value}`, `${Object.values(props).length > 0 ? JSON.stringify(props) : ''})`)
      }

      if (fakerNested) {
        result.fields = [
          ...result.fields,
          `${field.name.value}: ${this.config.mockPrefix}${typeName}List[faker.number.int({ min: 0, max: ${items.value} })]`,
        ];
      }
    }

    let fakerResult = [];

    if (result.fields.length > 0) {
      fakerResult = [
        `export const ${this.config.mockPrefix
        }${typeName} = {${result.fields.join(',')}};`,
      ];

      if (fakerListDirective) {
        fakerResult = [
          ...fakerResult,
          `export const ${this.config.mockPrefix}${typeName}List = Array.from({ length: ${items.value} }, () => ({...${this.config.mockPrefix}${typeName}}));`,
        ];
      }

      return fakerResult.join('\n');
    }

    return '';
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
}
