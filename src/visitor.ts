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
  Kind,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
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


  fieldsToKeyValueString(fields: object) {
    return Object.entries(fields).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : Array.isArray(value) ? '[' + value.map(val => '{' + this.fieldsToKeyValueString(val) + '}') + ']' : '{' + this.fieldsToKeyValueString(value) + '}'}`);
  }

  getMockFieldsFromNode(node: ObjectTypeDefinitionNode) {
    const result = [];

    for (const field of node.fields) {
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

        result[field.name.value] = `faker.${module.value}.${method.value}(${Object.values(props).length > 0 ? JSON.stringify(props) : ''})`;
      }

      if (fakerNested) {
        const isListType = (field.type as NonNullTypeNode | ListTypeNode).type.kind === Kind.LIST_TYPE;
        const typeName = ((field.type as NonNullTypeNode).type as NamedTypeNode)?.name?.value || (((field.type as NonNullTypeNode).type as ListTypeNode)?.type as NamedTypeNode).name?.value;

        const refType = this._schema.getTypeMap()[typeName];
        const refTypeMockFields = this.getMockFieldsFromNode((refType.astNode as ObjectTypeDefinitionNode));

        result[field.name.value] = isListType ? [{}] : {};

        for (const [key, value] of Object.entries(refTypeMockFields)) {
          if (isListType) {
            // TODO: Add in configurable amount of items.
            result[field.name.value][0][key] = value;
          } else {
            result[field.name.value][key] = value;
          }
        }
      }
    }
    return result;
  }

  ObjectTypeDefinition(node: ObjectTypeDefinitionNode): string | undefined {
    const fields = this.getMockFieldsFromNode(node)

    if (Object.keys(fields).length === 0) {
      return ''
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typeName = node.name.value || ((node as any).name as string);

    const fakerListDirective = this._getDirectiveFromAstNode(
      node,
      Directives.FAKER_LIST
    );

    const [items] = [
      this._getArgumentFromDirectiveAstNode(
        fakerListDirective,
        ArgumentName.ITEMS
      )?.value as IntValueNode,
    ];


    let fakerResult = [];

    fakerResult = [
      `export const ${this.config.mockPrefix
      }${typeName} = {${this.fieldsToKeyValueString(fields)}};`,
    ];

    if (fakerListDirective) {
      fakerResult = [
        ...fakerResult,
        `export const ${this.config.mockPrefix}${typeName}List = Array.from({ length: ${items.value} }, () => ({...${this.config.mockPrefix}${typeName}}));`,
      ];
    }

    return fakerResult.join('\n');
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d.name as any) === argumentName ||
        (d.name.value && d.name.value === argumentName)
    );

    if (!foundArgument) {
      return null;
    }

    return foundArgument;
  }
}
