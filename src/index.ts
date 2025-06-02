import {
  oldVisit,
  PluginFunction,
  Types,
} from '@graphql-codegen/plugin-helpers';
import { transformSchemaAST } from '@graphql-codegen/schema-ast';
import { GraphQLSchema } from 'graphql';
import { FakerPluginConfig } from './config';
import { FakerVisitor } from './visitor';

export * from './config';
export * from './introspection-visitor';
export * from './visitor';

export const plugin: PluginFunction<
  FakerPluginConfig,
  Types.ComplexPluginOutput
> = (
  schema: GraphQLSchema,
  _documents: Types.DocumentFile[],
  config: FakerPluginConfig
) => {
  const { schema: _schema, ast } = transformSchemaAST(schema, config);

  const visitor = new FakerVisitor(_schema, config);

  const visitorResult = oldVisit(ast, { leave: visitor });

  return {
    prepend: ["import { fakerEN as faker } from '@faker-js/faker';"].filter(
      Boolean
    ),
    content: visitorResult.definitions
      .filter((def) => def.length > 0)
      .join('\n'),
  };
};
