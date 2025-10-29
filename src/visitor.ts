import {
  getConfigValue,
  ParsedTypesConfig,
} from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import {
  ArgumentNode,
  DirectiveNode,
  EnumValueNode,
  FloatValueNode,
  GraphQLSchema,
  IntValueNode,
  Kind,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectTypeDefinitionNode,
  ObjectValueNode,
  StringValueNode,
  ValueNode,
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
  private _typeMap: ReturnType<GraphQLSchema['getTypeMap']>;

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
    this._typeMap = schema.getTypeMap();

    autoBind(this);
  }

  get config() {
    return this._parsedConfig;
  }

  private isDangerousPropertyName(name: string): boolean {
    return (
      name === '__proto__' || name === 'constructor' || name === 'prototype'
    );
  }

  argsToProps(node: ValueNode) {
    switch (node.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
      case Kind.ENUM:
      case Kind.FLOAT:
      case Kind.INT:
        return node.value;
      case Kind.LIST:
        return node.values.map(
          (item) =>
            (item as StringValueNode | IntValueNode | FloatValueNode).value
        );
    }

    return undefined;
  }

  fieldsToKeyValueString(fields: object) {
    return Object.entries(fields).map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}: ${value}`;
      }
      if (Array.isArray(value)) {
        const arrayContent = value
          .map((val) => `{${this.fieldsToKeyValueString(val)}}`)
          .join(',');
        return `${key}: [${arrayContent}]`;
      }
      return `${key}: {${this.fieldsToKeyValueString(value)}}`;
    });
  }

  getMockFieldsFromNode(
    node: ObjectTypeDefinitionNode,
    visitedTypes: Set<string> = new Set()
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    const currentTypeName = node.name.value;

    for (const field of node.fields) {
      const [fakerDirective, fakerNested] = [
        this._getDirectiveFromAstNode(field, Directives.FAKER),
        this._getDirectiveFromAstNode(field, Directives.FAKER_NESTED),
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

        let parsedArgs = {};

        if (args && !args.fields) {
          parsedArgs = this.argsToProps(args);
        }

        if (args?.fields) {
          for (const fakerField of args.fields) {
            parsedArgs[fakerField.name.value] = this.argsToProps(
              fakerField.value
            );
          }
        }

        const fieldName = field.name.value;
        // Protect against prototype pollution
        if (!this.isDangerousPropertyName(fieldName)) {
          result[fieldName] =
            `faker.${module.value}.${method.value}(${Object.keys(parsedArgs).length > 0 ? JSON.stringify(parsedArgs) : ''})`;
        }
      }

      if (fakerNested) {
        const fieldName = field.name.value;
        // Protect against prototype pollution
        if (this.isDangerousPropertyName(fieldName)) {
          continue;
        }

        const isListType =
          (field.type as NonNullTypeNode | ListTypeNode).type.kind ===
          Kind.LIST_TYPE;
        const typeName =
          ((field.type as NonNullTypeNode).type as NamedTypeNode)?.name
            ?.value ||
          (
            ((field.type as NonNullTypeNode).type as ListTypeNode)
              ?.type as NamedTypeNode
          ).name?.value;

        // Prevent infinite recursion by detecting circular references
        if (visitedTypes.has(typeName)) {
          // Skip circular nested types to prevent stack overflow
          continue;
        }

        const refType = this._typeMap[typeName];
        const newVisitedTypes = new Set(visitedTypes);
        newVisitedTypes.add(currentTypeName);

        const refTypeMockFields = this.getMockFieldsFromNode(
          refType.astNode as ObjectTypeDefinitionNode,
          newVisitedTypes
        );

        result[fieldName] = isListType ? [{}] : {};

        for (const [key, value] of Object.entries(refTypeMockFields)) {
          // Protect against prototype pollution by filtering dangerous property names
          if (this.isDangerousPropertyName(key)) {
            continue;
          }
          if (isListType) {
            // TODO: Add in configurable amount of items.
            result[fieldName][0][key] = value;
          } else {
            result[fieldName][key] = value;
          }
        }
      }
    }
    return result;
  }

  ObjectTypeDefinition(node: ObjectTypeDefinitionNode): string | undefined {
    const fields = this.getMockFieldsFromNode(node);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typeName = node.name.value || ((node as any).name as string);

    if (Object.keys(fields).length === 0) {
      return '';
    }

    const fakerListDirective = this._getDirectiveFromAstNode(
      node,
      Directives.FAKER_LIST
    );

    const fakerResult = [
      `export const ${
        this.config.mockPrefix
      }${typeName} = () => ({${this.fieldsToKeyValueString(fields)}});`,
    ];

    if (fakerListDirective) {
      const items = this._getArgumentFromDirectiveAstNode(
        fakerListDirective,
        ArgumentName.ITEMS
      )?.value as IntValueNode;

      if (items) {
        fakerResult.push(
          `export const ${this.config.mockPrefix}${typeName}List = Array.from({ length: ${items.value} }, () => ${this.config.mockPrefix}${typeName}());`
        );
      }
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
