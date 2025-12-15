import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
    text: string;
    align?: 'center' | 'right';
}

export const InfoTooltip = ({ text, align = 'center' }: InfoTooltipProps) => (
    <div className="relative group/tooltip ml-2 cursor-help z-50">
        <HelpCircle className="w-4 h-4 text-gray-500/70 hover:text-white transition-colors" />
        <div className={`absolute bottom-full mb-3 w-56 p-4 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl text-xs text-gray-300 opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none text-center leading-relaxed ${align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
            {text}
            <div className={`absolute top-full -mt-1 border-4 border-transparent border-t-[#18181b] ${align === 'right' ? 'right-1.5' : 'left-1/2 -translate-x-1/2'}`} />
        </div>
    </div>
);
