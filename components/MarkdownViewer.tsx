import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'github-markdown-css/github-markdown.css';
import 'katex/dist/katex.min.css';

interface MarkdownViewerProps {
    content: string;
    baseUrl?: string | null;
    className?: string;
}

const resolveImageUrl = (src: string | undefined, baseUrl: string | null | undefined) => {
    if (!src) return "";
    
    if (src.startsWith('data:') || src.includes('failed-image')) return src;

    let cleanSrc = src;

    if (cleanSrc.includes('github.com') && (cleanSrc.includes('/blob/') || cleanSrc.includes('/raw/'))) {
        cleanSrc = cleanSrc
            .replace('github.com', 'cdn.jsdelivr.net/gh')
            .replace('/blob/', '@')
            .replace('/raw/', '@');
        return cleanSrc;
    }

    if (cleanSrc.startsWith('http') || cleanSrc.startsWith('//')) {
        return cleanSrc;
    }

    if (baseUrl) {
        const isRelative = !cleanSrc.startsWith('/') && !cleanSrc.startsWith('http');
        
        if (isRelative) {
            const cleanPath = cleanSrc.replace(/^\.\//, '');
            const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            return `${cleanBase}/${cleanPath}`;
        }
    }

    return cleanSrc;
};

export const MarkdownViewer: React.FC<MarkdownViewerProps> = React.memo(({ content, baseUrl, className = "" }) => {
    const MarkdownComponents = React.useMemo(() => ({
        img: ({ node, ...props }: any) => {
            const { onMouseOver, onMouseOut, ...cleanProps } = props;
            const src = resolveImageUrl(props.src, baseUrl);
            
            return (
                <img 
                    {...cleanProps} 
                    src={src} 
                    style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }} 
                    loading="lazy" 
                    onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (img.dataset.failed) return;
                        img.dataset.failed = "true";
                        
                        if (src.includes('@main')) {
                            img.src = src.replace('@main', '@master');
                        } else {
                            img.style.visibility = 'hidden';
                            img.style.height = '0';
                        }
                    }}
                />
            );
        }
    }), [baseUrl]);

    return (
        <div className={`markdown-body !bg-transparent !text-slate-700 dark:!text-slate-300 ${className}`}>
            <ReactMarkdown 
                remarkPlugins={[remarkGfm, remarkMath]} 
                rehypePlugins={[rehypeKatex, rehypeRaw]} 
                components={MarkdownComponents}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
});
