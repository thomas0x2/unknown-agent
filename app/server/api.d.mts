/** Types for server/api.mjs, so the browser build (src/game/directApi.ts) can import it. */
export interface ApiResult { status: number; json: any }
export interface ApiDeps {
  characters: unknown[];
  anthropic: () => Promise<any | null>;
  typesafe: () => Promise<{ client: any; sdk: any } | null>;
  anthropicMissing: () => string | Promise<string>;
  typesafeMissing: () => string | Promise<string>;
  cli?: (system: string, messages: unknown[], started: number) => Promise<ApiResult>;
}
export function createApi(deps: ApiDeps): (kind: string, body: any) => Promise<ApiResult>;
