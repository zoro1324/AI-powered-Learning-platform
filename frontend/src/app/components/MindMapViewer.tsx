import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, ChevronDown, Book, Lightbulb } from 'lucide-react';
import { MindMapData, MindMapBranch } from '../../services/api';
import { cn } from './ui/utils';

interface MindMapViewerProps {
    data: MindMapData;
}

export function MindMapViewer({ data }: MindMapViewerProps) {
    return (
        <div className="w-full relative py-8 px-4 flex flex-col items-center min-h-[500px] overflow-x-auto overflow-y-auto">
            <div className="w-full max-w-4xl max-h-[70vh] pb-20">
                <RootNode data={data} />
            </div>
        </div>
    );
}

function RootNode({ data }: { data: MindMapData }) {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="flex flex-col items-center">
            {/* Root Element */}
            <motion.div
                layout
                onClick={() => setIsExpanded(!isExpanded)}
                className="group relative z-10 flex items-center gap-3 px-6 py-4 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-xl cursor-pointer hover:shadow-2xl hover:scale-105 transition-all outline outline-1 outline-white/20"
            >
                <div className="p-2 bg-white/20 rounded-full">
                    <Network className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">{data.title}</h2>
                    <p className="text-xs text-indigo-100 uppercase tracking-widest font-medium mt-0.5">
                        Level: {data.level}
                    </p>
                </div>
                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    className="ml-2 text-white/70 group-hover:text-white"
                >
                    <ChevronDown className="w-5 h-5" />
                </motion.div>
            </motion.div>

            {/* Branches Container */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col items-center mt-6 relative w-full"
                    >
                        {/* Vertical Line from Root */}
                        <div className="absolute top-[-24px] w-px h-[24px] bg-indigo-500/50" />

                        <div className="flex flex-col gap-6 w-full items-center relative">
                            {data.branches.map((branch, idx) => (
                                <BranchNode key={idx} branch={branch} isLast={idx === data.branches.length - 1} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function BranchNode({ branch, isLast }: { branch: MindMapBranch; isLast: boolean }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <motion.div layout className="relative flex flex-col items-center w-full max-w-2xl text-left ml-0 md:ml-12 lg:ml-24">
            {/* Connective lines for tree structure */}
            <div className="absolute -left-6 md:-left-12 top-6 w-6 md:w-12 h-px bg-indigo-500/50" />
            {!isLast && <div className="absolute -left-6 md:-left-12 top-6 w-px h-[calc(100%+24px)] bg-indigo-500/50" />}
            {isLast && <div className="absolute -left-6 md:-left-12 top-[-24px] w-px h-[48px] bg-indigo-500/50" />}

            {/* Branch Card */}
            <motion.div
                layout
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    "w-full z-10 flex items-center justify-between p-4 bg-gray-800/80 backdrop-blur-md border border-gray-700 rounded-xl cursor-pointer hover:bg-gray-700/80 transition-all",
                    isExpanded ? "ring-1 ring-indigo-500/50" : ""
                )}
            >
                <div className="flex items-center gap-3 w-full">
                    <div className="p-1.5 bg-indigo-500/20 rounded-md text-indigo-400">
                        <Book className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-100">{branch.name}</h3>
                </div>
                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    className="text-gray-500 ml-4"
                >
                    <ChevronDown className="w-4 h-4" />
                </motion.div>
            </motion.div>

            {/* Subtopics Container */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="w-full flex flex-col gap-2 pl-4 md:pl-8 relative overflow-hidden"
                    >
                        {branch.subtopics.map((sub, idx) => {
                            const subIsLast = idx === branch.subtopics.length - 1;
                            return (
                                <motion.div
                                    key={idx}
                                    layout
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="relative flex items-center"
                                >
                                    {/* Subtopic Tree Lines */}
                                    <div className="absolute -left-4 md:-left-8 top-1/2 w-4 md:w-8 h-px bg-gray-600/50" />
                                    {!subIsLast && <div className="absolute -left-4 md:-left-8 top-[-50%] w-px h-[100%] bg-gray-600/50" />}
                                    {subIsLast && <div className="absolute -left-4 md:-left-8 top-[-50%] w-px h-[100%] bg-gray-600/50" />}
                                    {subIsLast && <div className="absolute -left-4 md:-left-8 bottom-1/2 w-px h-1/2 bg-gray-900" style={{ zIndex: 0 }} />}

                                    {/* Subtopic Card */}
                                    <div className="z-10 bg-gray-800/50 border border-gray-700/50 rounded-lg py-2 px-3 flex items-center gap-2 hover:bg-gray-700/50 hover:border-indigo-500/30 transition-colors w-full">
                                        <Lightbulb className="w-3 h-3 text-amber-400/80" />
                                        <span className="text-sm text-gray-300">{sub}</span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
