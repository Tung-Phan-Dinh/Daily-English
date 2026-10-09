export type DictEntry = {
  id: number | null;
  lemma: string;
  pos: string;
  ipa: string;
  gloss_vi: string[];
  definition_en: string;
  examples: string[];
  collocations: string[];
  word_family: Record<string, string>;
  ai_generated: boolean;
  source?: string;
};

export type LookupContext = { block?: string; item?: string; page?: string };
