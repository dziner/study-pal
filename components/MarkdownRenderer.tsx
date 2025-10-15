import React from 'react';

const renderLine = (line: string) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ?
        <strong key={i}>{part.slice(2, -2)}</strong> :
        part
    );
};

export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const elements: React.ReactNode[] = [];
    const lines = content.split('\n');
    let currentList: { type: 'ul' | 'ol', items: React.ReactNode[] } | null = null;

    const endList = () => {
        if (currentList) {
            if(currentList.type === 'ul') {
                elements.push(<ul key={elements.length} className="list-disc pl-5 my-2 space-y-1">{currentList.items}</ul>);
            } else {
                elements.push(<ol key={elements.length} className="list-decimal pl-5 my-2 space-y-1">{currentList.items}</ol>);
            }
            currentList = null;
        }
    };

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('## ')) {
            endList();
            elements.push(<h2 key={index} className="text-xl font-bold mt-4 mb-2 text-slate-800">{renderLine(trimmedLine.substring(3))}</h2>);
        } else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
            if (currentList?.type !== 'ul') {
                endList();
                currentList = { type: 'ul', items: [] };
            }
            currentList.items.push(<li key={index}>{renderLine(trimmedLine.substring(2))}</li>);
        } else if (trimmedLine.match(/^\d+\.\s/)) {
            if (currentList?.type !== 'ol') {
                endList();
                currentList = { type: 'ol', items: [] };
            }
            currentList.items.push(<li key={index}>{renderLine(trimmedLine.replace(/^\d+\.\s/, ''))}</li>);
        } else {
            endList();
            if (trimmedLine) {
                elements.push(<p key={index} className="my-2">{renderLine(trimmedLine)}</p>);
            }
        }
    });

    endList(); // Add any remaining list

    return <>{elements}</>;
};