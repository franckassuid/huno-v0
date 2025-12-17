import { InfoTooltip } from './InfoTooltip';

interface MetricCardProps {
    title: string;
    value: string | number;
    unit?: string;
    icon?: React.ComponentType<{ className?: string }>;
    subtitle?: React.ReactNode;
    colorClass?: string;
    bgGradient?: string;
    trend?: string;
    tooltip?: string;
    graph?: React.ReactNode;
}

export const MetricCard = ({
    title,
    value,
    unit = '',
    icon: Icon,
    subtitle,
    colorClass = 'text-white',
    bgGradient = '',
    trend,
    tooltip,
    graph
}: MetricCardProps) => (
    <div className={`glass-card flex flex-col justify-between group h-full overflow-visible ${bgGradient ? 'bg-gradient-to-br ' + bgGradient : ''}`}>
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-wider">
                    {Icon && <Icon className="w-4 h-4" />}
                    <span>{title}</span>
                    {tooltip && <InfoTooltip text={tooltip} />}
                </div>
                {trend && (
                    <div className="bg-white/5 rounded-full px-2 py-0.5 text-xs text-green-400 border border-white/5 font-mono">
                        {trend}
                    </div>
                )}
            </div>
            <div className="flex items-baseline gap-1">
                <span className={`text-4xl lg:text-5xl font-black tracking-tight ${colorClass}`}>
                    {value}
                </span>
                {unit && <span className="text-lg text-gray-500 font-medium">{unit}</span>}
            </div>
        </div>

        {graph && <div className="mt-2 text-white">{graph}</div>}

        {subtitle && (
            <div className="mt-4 pt-4 border-t border-white/5 text-sm text-gray-400">
                {subtitle}
            </div>
        )}
    </div>
);
