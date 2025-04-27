import autoBind from 'auto-bind';
import { GraphQLNamedType, GraphQLSchema, ObjectTypeDefinitionNode } from 'graphql';
import { FakerPluginConfig } from './config';
import { FakerVisitor } from './visitor';

export class FakerIntrospectionVisitor extends FakerVisitor {
  private typesToInclude: GraphQLNamedType[] = [];

  constructor(schema: GraphQLSchema, pluginConfig: FakerPluginConfig = {}, typesToInclude: GraphQLNamedType[]) {
    super(schema, pluginConfig);

    this.typesToInclude = typesToInclude;
    autoBind(this);
  }

  DirectiveDefinition() {
    return null;
  }

  ObjectTypeDefinition(node: ObjectTypeDefinitionNode) {
    const name: string = node.name as any;

    if (this.typesToInclude.some(type => type.name === name)) {
      return super.ObjectTypeDefinition(node);
    }

    return null;
  }
}
