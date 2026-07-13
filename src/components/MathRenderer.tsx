import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  text: string;
  className?: string;
}

export default function MathRenderer({ text, className = '' }: MathRendererProps) {
  if (!text) return null;

  // Split text by $$...$$ (block math) and $...$ (inline math)
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

  return (
    <span className={className} id="math-renderer-span">
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2);
          try {
            const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
            return (
              <span
                key={index}
                className="block my-2 overflow-x-auto text-center"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return <code key={index}>{part}</code>;
          }
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          try {
            const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
            return (
              <span
                key={index}
                className="inline-block px-1 align-middle"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return <code key={index}>{part}</code>;
          }
        } else {
          return <React.Fragment key={index}>{part}</React.Fragment>;
        }
      })}
    </span>
  );
}
