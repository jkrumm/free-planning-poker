'use client';

import ReactMarkdown from 'react-markdown';

const Markdown = ({ description }: { description: string }) => {
  return (
    <div className="react-markdown">
      <ReactMarkdown>{description}</ReactMarkdown>
    </div>
  );
};

export default Markdown;
