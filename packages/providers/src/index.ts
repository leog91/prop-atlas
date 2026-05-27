import type { ProviderParser, ParsedProperty, Provider } from "@prop-atlas/types";
import { DaftParser } from "./parsers/daft";
import { IdealistaParser } from "./parsers/idealista";
import { KamernetParser } from "./parsers/kamernet";
import { ZonapropParser } from "./parsers/zonaprop";

export type { ProviderParser, ParsedProperty, Provider };

export { DaftParser, IdealistaParser, KamernetParser, ZonapropParser };

export const defaultParsers: ProviderParser[] = [
  new DaftParser(),
  new IdealistaParser(),
  new KamernetParser(),
  new ZonapropParser(),
];

export function detectProvider(url: string, parsers: ProviderParser[] = defaultParsers): ProviderParser | null {
  for (const parser of parsers) {
    if (parser.canHandle(url)) {
      return parser;
    }
  }
  return null;
}
