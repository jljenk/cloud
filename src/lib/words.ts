const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'if',
  'then',
  'else',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'at',
  'by',
  'from',
  'as',
  'is',
  'it',
  'be',
  'are',
  'was',
  'were',
  'been',
  'being',
  'am',
  'this',
  'that',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'me',
  'my',
  'your',
  'our',
  'their',
  'what',
  'which',
  'who',
  'whom',
  'so',
  'not',
  'no',
  'yes',
  'do',
  'did',
  'does',
  'done',
  'have',
  'has',
  'had',
  'will',
  'just',
  'about',
  'into',
  'over',
  'after',
  'before',
  'than',
  'too',
  'very',
  'can',
  'could',
  'would',
  'should',
  'there',
  'here',
  'out',
  'up',
  'down',
  'off',
  'own',
  'same',
  'such',
  'only',
  'also',
  'how',
  'when',
  'where',
  'why',
  'all',
  'any',
  'some',
  'more',
  'most',
  'other',
  'its',
  'ok',
  'okay',
  'please',
  'thanks',
  'thank',
]);

export type CountedWord = {
  text: string;
  count: number;
};

export function countWords(texts: string[]): CountedWord[] {
  const counts = new Map<string, number>();

  for (const text of texts) {
    const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    for (const token of tokens) {
      if (token.length < 2 || STOP_WORDS.has(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, 80);
}

export function fontSizes(words: CountedWord[], width: number): { text: string; size: number }[] {
  const max = words[0]?.count ?? 1;
  const maxSize = Math.max(28, Math.min(92, width / 10));
  const minSize = 16;
  const span = Math.sqrt(max);

  return words.map((word) => ({
    text: word.text,
    size: minSize + ((maxSize - minSize) * Math.sqrt(word.count)) / span,
  }));
}
