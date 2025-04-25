import {
  BaseTypesVisitor,
  DeclarationKind,
  getConfigValue,
  normalizeAvoidOptionals,
  NormalizedAvoidOptionalsConfig,
  ParsedTypesConfig,
} from "@graphql-codegen/visitor-plugin-common";
import autoBind from "auto-bind";
import {
  ArgumentNode,
  DirectiveNode,
  GraphQLSchema,
  isEnumType,
  ObjectTypeDefinitionNode,
} from "graphql";
import { TypeScriptPluginConfig, Directives, ArgumentName } from "./config";
import { TypeScriptOperationVariablesToObject } from "./typescript-variables-to-object";

export interface TypeScriptPluginParsedConfig extends ParsedTypesConfig {
  avoidOptionals: NormalizedAvoidOptionalsConfig;
  constEnums: boolean;
  enumsAsTypes: boolean;
  futureProofEnums: boolean;
  futureProofUnions: boolean;
  enumsAsConst: boolean;
  numericEnums: boolean;
  onlyEnums: boolean;
  onlyOperationTypes: boolean;
  immutableTypes: boolean;
  maybeValue: string;
  inputMaybeValue: string;
  noExport: boolean;
  useImplementingTypes: boolean;
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
      noExport: getConfigValue(pluginConfig.noExport, false),
      avoidOptionals: normalizeAvoidOptionals(
        getConfigValue(pluginConfig.avoidOptionals, false)
      ),
      maybeValue: getConfigValue(pluginConfig.maybeValue, "T | null"),
      inputMaybeValue: getConfigValue(
        pluginConfig.inputMaybeValue,
        getConfigValue(pluginConfig.maybeValue, "Maybe<T>")
      ),
      constEnums: getConfigValue(pluginConfig.constEnums, false),
      enumsAsTypes: getConfigValue(pluginConfig.enumsAsTypes, false),
      futureProofEnums: getConfigValue(pluginConfig.futureProofEnums, false),
      futureProofUnions: getConfigValue(pluginConfig.futureProofUnions, false),
      enumsAsConst: getConfigValue(pluginConfig.enumsAsConst, false),
      numericEnums: getConfigValue(pluginConfig.numericEnums, false),
      onlyEnums: getConfigValue(pluginConfig.onlyEnums, false),
      onlyOperationTypes: getConfigValue(
        pluginConfig.onlyOperationTypes,
        false
      ),
      immutableTypes: getConfigValue(pluginConfig.immutableTypes, false),
      useImplementingTypes: getConfigValue(
        pluginConfig.useImplementingTypes,
        false
      ),
      entireFieldWrapperValue: getConfigValue(
        pluginConfig.entireFieldWrapperValue,
        "T"
      ),
      wrapEntireDefinitions: getConfigValue(
        pluginConfig.wrapEntireFieldDefinitions,
        false
      ),
      ...additionalConfig,
    } as TParsedConfig);

    autoBind(this);
    const enumNames = Object.values(schema.getTypeMap())
      .filter(isEnumType)
      .map((type) => type.name);
    this.setArgumentsTransformer(
      new TypeScriptOperationVariablesToObject(
        this.scalars,
        this.convertName,
        this.config.avoidOptionals,
        this.config.immutableTypes,
        null,
        enumNames,
        pluginConfig.enumPrefix,
        pluginConfig.enumSuffix,
        this.config.enumValues,
        false,
        this.config.directiveArgumentAndInputFieldMappings,
        "InputMaybe"
      )
    );
    this.setDeclarationBlockConfig({
      enumNameValueSeparator: " =",
      ignoreExport: this.config.noExport,
    });
  }

  protected getExportPrefix(): string {
    if (this.config.noExport) {
      return "";
    }

    return super.getExportPrefix();
  }

  ObjectTypeDefinition(node: ObjectTypeDefinitionNode): string | undefined {
    const fields = node.fields;
    console.log("fields", node, fields);
    const fakerDirective = this._getDirectiveFromAstNode(
      node,
      Directives.FAKER
    );

    if (fakerDirective) {
      const [module, method] = [
        this._getArgumentFromDirectiveAstNode(
          fakerDirective,
          ArgumentName.MODULE
        ),
        this._getArgumentFromDirectiveAstNode(
          fakerDirective,
          ArgumentName.METHOD
        ),
      ];

      console.log("node", node.name, module.value, method.value);
      console.log("directives", JSON.stringify(node.directives));

      return ``;
    }

    return undefined;
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
