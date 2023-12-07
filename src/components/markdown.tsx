"use client";
import ReactMarkdown from "react-markdown";

const Markdown = ({ description }: { description: string }) => {
  return (
    <ReactMarkdown className="react-markdown">{description}</ReactMarkdown>
  );
};

export default Markdown;
