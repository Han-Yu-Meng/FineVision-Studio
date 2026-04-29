import React, { useEffect, useRef } from 'react';
import { AnsiUp } from 'ansi_up';
import DOMPurify from 'dompurify';
import { useSystem } from '../context/SystemContext';

interface LogViewerProps {
    logs: string;
    className?: string;
    maxHeight?: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({ 
    logs, 
    className = "",
    maxHeight = "none"
}) => {
    const { theme } = useSystem();
    const ansi = useRef(new AnsiUp());
    const logContainerRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef<boolean>(true);

    // Initialize ANSI colors immediately when component mounts
    const ansiInstance = ansi.current as any;
    ansiInstance.use_classes = false;
    ansiInstance.escape_for_html = true;
    ansiInstance.ansi_colors = [
        [
            { rgb: [30, 41, 59], class_name: 'ansi-black' },
            { rgb: [220, 38, 38], class_name: 'ansi-red' },
            { rgb: [22, 163, 74], class_name: 'ansi-green' },
            { rgb: [202, 138, 4], class_name: 'ansi-yellow' },
            { rgb: [37, 99, 235], class_name: 'ansi-blue' },
            { rgb: [147, 51, 234], class_name: 'ansi-magenta' },
            { rgb: [8, 145, 178], class_name: 'ansi-cyan' },
            { rgb: [71, 85, 105], class_name: 'ansi-white' }
        ],
        [
            { rgb: [100, 116, 139], class_name: 'ansi-bright-black' },
            { rgb: [239, 68, 68], class_name: 'ansi-bright-red' },
            { rgb: [34, 197, 94], class_name: 'ansi-bright-green' },
            { rgb: [234, 179, 8], class_name: 'ansi-bright-yellow' },
            { rgb: [59, 130, 246], class_name: 'ansi-bright-blue' },
            { rgb: [168, 85, 247], class_name: 'ansi-bright-magenta' },
            { rgb: [6, 182, 212], class_name: 'ansi-bright-cyan' },
            { rgb: [30, 41, 59], class_name: 'ansi-bright-white' }
        ]
    ];

    // Re-apply colors when theme changes (in case theme-specific colors are needed in future)
    useEffect(() => {
        // Colors are already set above, but this hook ensures theme changes are handled
        // if theme-specific color schemes are implemented later
    }, [theme]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
        shouldAutoScrollRef.current = isAtBottom;
    };

    useEffect(() => {
        if (shouldAutoScrollRef.current && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    const formattedLogs = DOMPurify.sanitize(ansi.current.ansi_to_html(logs));

    return (
        <div className={`flex-1 bg-white dark:bg-[#1e1e1e] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col shadow-inner ${className}`}>
            <div 
                ref={logContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-auto p-4 font-mono text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed custom-scrollbar"
                style={{ maxHeight }}
            >
                {logs ? (
                    <div className="whitespace-pre-wrap break-all" dangerouslySetInnerHTML={{ __html: formattedLogs }} />
                ) : (
                    <div className="text-slate-500 italic">No output available...</div>
                )}
            </div>
        </div>
    );
};
