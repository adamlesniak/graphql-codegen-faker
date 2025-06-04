/**
 * @description This plugin generates faker mocks.
 *
 * The mocks are generated based on the directives provided.
 */
export interface FakerPluginConfig {
  /**
   * @description Determines locality of faker mocks.
   * @default 'EN'
   *
   * @exampleMarkdown
   * ```ts filename="codegen.ts"
   * import type { CodegenConfig } from '@graphql-codegen/cli'
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     'path/to/file.ts': {
   *       plugins: ['faker'],
   *       config: {
   *         locality: 'EN'
   *       }
   *     }
   *   }
   * }
   * export default config
   * ```
   */
  locality?: string;
  /**
   * @description Will prefix every generated `const`.
   * @default 'mock'
   *
   * @exampleMarkdown
   * ```ts filename="codegen.ts"
   * import type { CodegenConfig } from '@graphql-codegen/cli'
   *
   * const config: CodegenConfig = {
   *   // ...
   *   generates: {
   *     'path/to/file.ts': {
   *       plugins: ['faker'],
   *       config: {
   *         mockPrefix: 'mock'
   *       }
   *     }
   *   }
   * }
   * export default config
   * ```
   */
  mockPrefix?: string;
}

export enum Directives {
  FAKER = 'faker',
  FAKER_LIST = 'fakerList',
  FAKER_RESOLVER = 'fakerResolver',
  FAKER_NESTED = 'fakerNested',
}

export enum ArgumentName {
  METHOD = 'method',
  MODULE = 'module',
  ARGS = 'args',
  ITEMS = 'items',
}
