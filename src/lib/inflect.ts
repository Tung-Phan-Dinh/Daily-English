// Lightweight inflection generator used in the browser to detect target words
// "in any inflection" (writing chips) without shipping a full lemmatiser.
// Server-side dictionary lookups use wink-lemmatizer instead.

const IRREGULAR: Record<string, string[]> = {
  be: ["am", "is", "are", "was", "were", "been", "being"],
  have: ["has", "had", "having"],
  do: ["does", "did", "done", "doing"],
  go: ["goes", "went", "gone", "going"],
  make: ["made"], take: ["took", "taken"], give: ["gave", "given"], get: ["got", "gotten"],
  come: ["came"], become: ["became"], see: ["saw", "seen"], know: ["knew", "known"],
  think: ["thought"], bring: ["brought"], buy: ["bought"], teach: ["taught"], catch: ["caught"],
  find: ["found"], keep: ["kept"], leave: ["left"], feel: ["felt"], meet: ["met"],
  pay: ["paid"], say: ["said"], lay: ["laid"], sell: ["sold"], tell: ["told"],
  spend: ["spent"], build: ["built"], send: ["sent"], lend: ["lent"], lose: ["lost"],
  hold: ["held"], stand: ["stood"], understand: ["understood"], write: ["wrote", "written"],
  drive: ["drove", "driven"], rise: ["rose", "risen"], arise: ["arose", "arisen"],
  choose: ["chose", "chosen"], speak: ["spoke", "spoken"], break: ["broke", "broken"],
  grow: ["grew", "grown"], throw: ["threw", "thrown"], show: ["showed", "shown"],
  begin: ["began", "begun"], drink: ["drank", "drunk"], swim: ["swam", "swum"],
  run: ["ran"], eat: ["ate", "eaten"], fall: ["fell", "fallen"], forget: ["forgot", "forgotten"],
  freeze: ["froze", "frozen"], hide: ["hid", "hidden"], ride: ["rode", "ridden"],
  wear: ["wore", "worn"], steal: ["stole", "stolen"], fly: ["flew", "flown", "flies"],
  draw: ["drew", "drawn"], lead: ["led"], read: ["read"], feed: ["fed"], fight: ["fought"],
  seek: ["sought"], deal: ["dealt"], mean: ["meant"], sleep: ["slept"], win: ["won"],
  sit: ["sat"], hear: ["heard"], light: ["lit"], shoot: ["shot"], strike: ["struck"],
  undertake: ["undertook", "undertaken"], overcome: ["overcame"], withdraw: ["withdrew", "withdrawn"],
  child: ["children"], person: ["people"], man: ["men"], woman: ["women"], foot: ["feet"],
  tooth: ["teeth"], mouse: ["mice"], criterion: ["criteria"], phenomenon: ["phenomena"],
  analysis: ["analyses"], crisis: ["crises"], hypothesis: ["hypotheses"], medium: ["media"],
  good: ["better", "best"], bad: ["worse", "worst"], far: ["further", "farther", "furthest"],
  many: ["more", "most"], much: ["more", "most"], little: ["less", "least"],
};

const VOWEL = /[aeiou]/;

function doubles(w: string): boolean {
  // CVC ending, short words: stop → stopped, plan → planned (not "visit")
  return /^[^aeiou]*[aeiou][bcdfgklmnprstvz]$/.test(w) && w.length <= 4;
}

export function inflections(lemma: string): Set<string> {
  const w = lemma.toLowerCase().trim();
  const out = new Set<string>([w]);
  for (const f of IRREGULAR[w] ?? []) out.add(f);
  if (!w || w.includes(" ")) return out;
  const last = w[w.length - 1];
  const prev = w[w.length - 2] ?? "";
  // plural / 3rd person
  if (/(s|x|z|ch|sh)$/.test(w)) out.add(w + "es");
  else if (last === "y" && !VOWEL.test(prev)) out.add(w.slice(0, -1) + "ies");
  else if (last === "f") out.add(w.slice(0, -1) + "ves");
  else if (w.endsWith("fe")) out.add(w.slice(0, -2) + "ves");
  else out.add(w + "s");
  if (last === "o") out.add(w + "es");
  // past / participle
  if (last === "e") out.add(w + "d");
  else if (last === "y" && !VOWEL.test(prev)) out.add(w.slice(0, -1) + "ied");
  else if (doubles(w)) out.add(w + last + "ed");
  else out.add(w + "ed");
  out.add(w + "ed");
  // -ing
  if (w.endsWith("ie")) out.add(w.slice(0, -2) + "ying");
  else if (last === "e" && !w.endsWith("ee")) out.add(w.slice(0, -1) + "ing");
  else if (doubles(w)) out.add(w + last + "ing");
  else out.add(w + "ing");
  // comparatives
  if (last === "e") {
    out.add(w + "r");
    out.add(w + "st");
  } else if (last === "y" && !VOWEL.test(prev)) {
    out.add(w.slice(0, -1) + "ier");
    out.add(w.slice(0, -1) + "iest");
  } else {
    out.add(w + "er");
    out.add(w + "est");
  }
  return out;
}

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+(?:['’-][a-z]+)*/g) ?? []).map((t) => t.replace(/’/g, "'"));
}

/** Does `text` contain `target` in any inflection? Phrases match with an inflected head word. */
export function containsTarget(text: string, target: string): boolean {
  const toks = tokens(text);
  const parts = target.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;
  const forms = parts.map((p) => inflections(p));
  outer: for (let i = 0; i + parts.length <= toks.length; i++) {
    for (let j = 0; j < parts.length; j++) {
      if (!forms[j].has(toks[i + j])) continue outer;
    }
    return true;
  }
  return false;
}

/** Character span of `target` (any inflection) inside `text`, or null. */
export function findTargetSpan(text: string, target: string): { start: number; end: number } | null {
  const parts = target.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const forms = parts.map((p) => inflections(p));
  const re = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
  const toks: { w: string; s: number; e: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) toks.push({ w: m[0].toLowerCase().replace(/’/g, "'"), s: m.index, e: m.index + m[0].length });
  outer: for (let i = 0; i + parts.length <= toks.length; i++) {
    for (let j = 0; j < parts.length; j++) if (!forms[j].has(toks[i + j].w)) continue outer;
    return { start: toks[i].s, end: toks[i + parts.length - 1].e };
  }
  return null;
}
