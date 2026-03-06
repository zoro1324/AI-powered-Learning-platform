import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, ChevronRight, ChevronLeft, Book, Lightbulb } from 'lucide-react';
import { MindMapData, MindMapBranch } from '../../services/api';
import { cn } from './ui/utils';

interface MindMapViewerProps {
    data: MindMapData;
}

interface Point {
    x: number;
    y: number;
}

// Helper to draw an S-curve (cubic bezier)
function generateBezierPath(start: Point, end: Point) {
    const dx = Math.abs(end.x - start.x);
    // Control points to make the curve horizontal at start and end
    const cp1 = { x: start.x + dx * 0.5, y: start.y };
    const cp2 = { x: end.x - dx * 0.5, y: end.y };
    return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
}

export function MindMapViewer({ data }: MindMapViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [lines, setLines] = useState<string[]>([]);

    // We use a simple counter to force a re-measure of the lines
    const [tick, setTick] = useState(0);

    // Re-measure lines whenever nodes expand/collapse
    useLayoutEffect(() => {
        if (!containerRef.current) return;

        const updateLines = () => {
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const newLines: string[] = [];

            // Find root output port
            const rootPort = document.getElementById('port-root-out');
            if (rootPort) {
                const rootRect = rootPort.getBoundingClientRect();
                const startPoint = {
                    x: rootRect.left + rootRect.width / 2 - containerRect.left + containerRef.current.scrollLeft,
                    y: rootRect.top + rootRect.height / 2 - containerRect.top + containerRef.current.scrollTop
                };

                // Connect to each visible branch
                data.branches.forEach((branch, bIdx) => {
                    const branchInPort = document.getElementById(`port-branch-${bIdx}-in`);
                    if (branchInPort) {
                        const inRect = branchInPort.getBoundingClientRect();
                        const endPoint = {
                            x: inRect.left - containerRect.left + containerRef.current!.scrollLeft,
                            y: inRect.top + inRect.height / 2 - containerRect.top + containerRef.current!.scrollTop
                        };
                        newLines.push(generateBezierPath(startPoint, endPoint));
                    }

                    // Connect branch to subtopics
                    const branchOutPort = document.getElementById(`port-branch-${bIdx}-out`);
                    if (branchOutPort) {
                        const outRect = branchOutPort.getBoundingClientRect();
                        const bStartPoint = {
                            x: outRect.left + outRect.width / 2 - containerRect.left + containerRef.current!.scrollLeft,
                            y: outRect.top + outRect.height / 2 - containerRect.top + containerRef.current!.scrollTop
                        };

                        branch.subtopics.forEach((_, sIdx) => {
                            const subInPort = document.getElementById(`port-sub-${bIdx}-${sIdx}-in`);
                            if (subInPort) {
                                const subInRect = subInPort.getBoundingClientRect();
                                const bEndPoint = {
                                    x: subInRect.left - containerRect.left + containerRef.current!.scrollLeft,
                                    y: subInRect.top + subInRect.height / 2 - containerRect.top + containerRef.current!.scrollTop
                                };
                                newLines.push(generateBezierPath(bStartPoint, bEndPoint));
                            }
                        });
                    }
                });
            }
            setLines(newLines);
        };

        // Small delay to allow framer-motion animations to complete layout
        const timeoutId = setTimeout(updateLines, 50);
        // Also listen to window resize and scroll
        const container = containerRef.current;
        window.addEventListener('resize', updateLines);
        container.addEventListener('scroll', updateLines);
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', updateLines);
            container.removeEventListener('scroll', updateLines);
        };
    }, [data, tick]);

    // Force re-render periodically during animation
    useEffect(() => {
        let animationFrame: number;
        let lastTime = 0;

        const loop = (time: number) => {
            if (time - lastTime > 16) { // ~60fps
                setTick(t => t + 1);
                lastTime = time;
            }
            animationFrame = requestAnimationFrame(loop);
        };

        animationFrame = requestAnimationFrame(loop);

        // Stop the loop after 500ms (duration of expand/collapse animation)
        const timeout = setTimeout(() => cancelAnimationFrame(animationFrame), 600);

        return () => {
            cancelAnimationFrame(animationFrame);
            clearTimeout(timeout);
        };
    }, [data, tick]); // Trigger on data mount or toggle

    const onToggle = () => setTick(t => t + 1);

    return (
        <div className="w-full h-full relative py-16 px-16 flex overflow-auto bg-[#E8EAED]" ref={containerRef}>
            {/* SVG Canvas for Connectors */}
            <svg
                className="absolute inset-0 pointer-events-none z-0 w-full h-full min-w-full min-h-full"
            >
                {lines.map((path, i) => (
                    <path
                        key={i}
                        d={path}
                        fill="none"
                        stroke="#667EEA"
                        strokeWidth="3"
                        className="transition-all duration-300 ease-in-out"
                        opacity="0.6"
                    />
                ))}
            </svg>

            <div className="w-full h-full relative z-10 flex">
                <RootNode data={data} onToggle={onToggle} />
            </div>
        </div>
    );
}

function RootNode({ data, onToggle }: { data: MindMapData, onToggle: () => void }) {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggle = () => {
        setIsExpanded(!isExpanded);
        onToggle();
    };

    return (
        <div className="flex flex-row items-center gap-[100px] w-fit">
            {/* Root Element */}
            <div className="relative flex items-center shrink-0">
                <motion.div
                    layout
                    className="group relative z-10 flex items-center gap-4 px-6 py-4 bg-[#444746] rounded-[16px] shadow-md border border-gray-600/50"
                >
                    <div className="p-2 bg-white/10 rounded-full">
                        <Network className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-medium text-white tracking-tight">{data.title}</h2>
                        <p className="text-xs text-indigo-200 uppercase tracking-widest mt-1">
                            {data.level}
                        </p>
                    </div>
                </motion.div>

                {/* Out Port */}
                <button
                    id="port-root-out"
                    onClick={toggle}
                    aria-label={isExpanded ? "Collapse root node" : "Expand root node"}
                    className={cn(
                        "absolute right-[-14px] z-20 w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-all",
                        isExpanded
                            ? "bg-white border border-gray-300 hover:bg-gray-50"
                            : "bg-[#A8C7FA] hover:opacity-90"
                    )}
                >
                    {isExpanded ? (
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-[#444746]" />
                    )}
                </button>
            </div>

            {/* Branches Container */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="flex flex-col gap-6"
                    >
                        {data.branches.map((branch, idx) => (
                            <BranchNode
                                key={idx}
                                branch={branch}
                                bIdx={idx}
                                onToggle={onToggle}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function BranchNode({ branch, bIdx, onToggle }: { branch: MindMapBranch, bIdx: number, onToggle: () => void }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggle = () => {
        setIsExpanded(!isExpanded);
        onToggle();
    };

    return (
        <div className="flex flex-row items-center gap-[100px] shrink-0">
            {/* Branch Card */}
            <div className="relative flex items-center">
                <div id={`port-branch-${bIdx}-in`} className="absolute left-0 w-1 h-1" />

                <motion.div
                    layout
                    className={cn(
                        "z-10 flex items-center justify-between p-4 bg-[#444746] rounded-[12px] shadow-sm border border-gray-600/50 min-w-[220px]",
                        isExpanded ? "ring-2 ring-[#A8C7FA]" : ""
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/10 rounded-md text-[#A8C7FA]">
                            <Book className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-medium text-white">{branch.name}</h3>
                    </div>
                </motion.div>

                {/* Out Port */}
                <button
                    id={`port-branch-${bIdx}-out`}
                    onClick={toggle}
                    aria-label={isExpanded ? `Collapse ${branch.name}` : `Expand ${branch.name}`}
                    className={cn(
                        "absolute right-[-14px] z-20 w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-all",
                        isExpanded
                            ? "bg-white border border-gray-300 hover:bg-gray-50"
                            : "bg-[#A8C7FA] hover:opacity-90"
                    )}
                >
                    {isExpanded ? (
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-[#444746]" />
                    )}
                </button>
            </div>

            {/* Subtopics Container */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="flex flex-col gap-3 py-2"
                    >
                        {branch.subtopics.map((sub, sIdx) => (
                            <motion.div
                                key={sIdx}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: sIdx * 0.05 }}
                                className="relative flex items-center shrink-0 w-max max-w-[300px]"
                            >
                                <div id={`port-sub-${bIdx}-${sIdx}-in`} className="absolute left-0 w-1 h-1" />

                                <div className="z-10 bg-white border border-gray-200 rounded-[12px] p-3 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow w-full whitespace-normal">
                                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <span className="text-[13px] text-gray-800 leading-relaxed font-medium">{sub}</span>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
