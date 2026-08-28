type TMatchSegment = {
  text: string;
  matched: boolean;
};

type TMatch = {
  score: number;
  spread: number;
  segments: TMatchSegment[];
};

// Score, du plus fort au plus faible : 4 nom exact, 3 préfixe, 2 occurrence
// contiguë interne, 1 sous-séquence dispersée, 0 requête vide.
const SCORE_EXACT = 4;
const SCORE_PREFIX = 3;
const SCORE_CONTIGUOUS = 2;
const SCORE_SUBSEQUENCE = 1;
const SCORE_EMPTY = 0;

// Le serveur est francophone et le client parle 7 langues : « general » doit
// trouver « général ». La décomposition NFD sépare la lettre de son accent, la
// plage ̀-ͯ retire les accents ainsi isolés.
const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const toSegments = (name: string, indexes: number[]): TMatchSegment[] => {
  const segments: TMatchSegment[] = [];
  const matchedIndexes = new Set(indexes);

  for (let index = 0; index < name.length; index++) {
    const matched = matchedIndexes.has(index);
    const last = segments[segments.length - 1];

    if (last && last.matched === matched) {
      last.text += name[index];

      continue;
    }

    segments.push({ text: name[index]!, matched });
  }

  return segments;
};

const scoreOf = (name: string, query: string) => {
  if (name === query) return SCORE_EXACT;
  if (name.startsWith(query)) return SCORE_PREFIX;
  if (name.includes(query)) return SCORE_CONTIGUOUS;

  return SCORE_SUBSEQUENCE;
};

const matchName = (name: string, query: string): TMatch | null => {
  if (query.trim() === '') {
    return {
      score: SCORE_EMPTY,
      spread: 0,
      segments: [{ text: name, matched: false }]
    };
  }

  const normalizedName = normalize(name);
  const normalizedQuery = normalize(query.trim());
  const indexes: number[] = [];

  let cursor = 0;

  // La normalisation NFD peut allonger la chaîne ; on avance donc sur le nom
  // normalisé et on retient des index qui n'ont de sens que sur lui. Ils sont
  // reprojetés sur le nom d'origine plus bas, caractère par caractère.
  for (let index = 0; index < normalizedName.length; index++) {
    if (
      cursor < normalizedQuery.length &&
      normalizedName[index] === normalizedQuery[cursor]
    ) {
      indexes.push(index);
      cursor++;
    }
  }

  if (cursor < normalizedQuery.length) return null;

  const first = indexes[0]!;
  const last = indexes[indexes.length - 1]!;
  const spread = last - first - (normalizedQuery.length - 1);

  return {
    score: scoreOf(normalizedName, normalizedQuery),
    spread,
    segments: toSegments(name, indexes)
  };
};

const compareMatches = (a: TMatch, b: TMatch) =>
  b.score - a.score || a.spread - b.spread;

export { compareMatches, matchName };
export type { TMatch, TMatchSegment };
