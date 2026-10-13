import { useEffect, useState } from 'react';
import cloud from 'd3-cloud';
import { countWords, fontSizes } from '../lib/words';

type LaidOutWord = {
  text: string;
  size: number;
  x?: number;
  y?: number;
  rotate?: number;
};

const COLORS = ['#e4b15a', '#f3efe6', '#7eb8da', '#e07a5f', '#8fbf9f', '#f0c9a0', '#d7b4f3'];

function layoutBounds(width: number, height: number) {
  return {
    width: Math.max(280, Math.min(1600, width - 48)),
    height: Math.max(280, Math.min(1000, height - 48)),
  };
}

type WordCloudProps = {
  texts: string[];
};

export function WordCloud({ texts }: WordCloudProps) {
  const [size, setSize] = useState({ width: 960, height: 640 });
  const [words, setWords] = useState<LaidOutWord[]>([]);

  useEffect(() => {
    const measure = () => {
      setSize({
        width: Math.max(320, window.innerWidth),
        height: Math.max(320, window.innerHeight),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const counted = countWords(texts);
    if (counted.length === 0) {
      return;
    }

    let cancelled = false;
    const bounds = layoutBounds(size.width, size.height);
    const layout = cloud<LaidOutWord>()
      .size([bounds.width, bounds.height])
      .words(fontSizes(counted, bounds.width).map((word) => ({ ...word })))
      .padding(6)
      .rotate(() => 0)
      .font('sans-serif')
      .fontWeight(700)
      .fontSize((word) => word.size)
      .on('end', (laidOut) => {
        if (!cancelled) setWords(laidOut);
      });
    layout.start();

    return () => {
      cancelled = true;
      layout.stop();
    };
  }, [texts, size.width, size.height]);

  const counted = countWords(texts);
  if (counted.length === 0) {
    return (
      <div className="cloud-empty">
        <p>Nothing to draw yet. The entries so far were only common words.</p>
      </div>
    );
  }

  const bounds = layoutBounds(size.width, size.height);

  return (
    <svg
      className="cloud-svg"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${bounds.width} ${bounds.height}`}
      role="img"
      aria-label="Word cloud"
    >
      <g transform={`translate(${bounds.width / 2}, ${bounds.height / 2})`}>
        {words.map((word, index) => (
          <text
            key={word.text}
            textAnchor="middle"
            transform={`translate(${word.x ?? 0}, ${word.y ?? 0})`}
            fontSize={word.size}
            fontWeight={700}
            fontFamily="sans-serif"
            fill={COLORS[index % COLORS.length]}
          >
            {word.text}
          </text>
        ))}
      </g>
    </svg>
  );
}
