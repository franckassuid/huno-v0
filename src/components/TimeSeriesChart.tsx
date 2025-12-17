'use client';

import { useState } from 'react';

interface TimeSeriesChartProps {
    data: [number, number | null][];
    color: string;
    unit: string;
    minY?: number;
    maxY?: number;
    height?: number;
}

export const TimeSeriesChart = ({
    data,
    color,
    unit,
    minY: outputMinY,
    maxY: outputMaxY,
    height = 60
}: TimeSeriesChartProps) => {
    const [hoverData, setHoverData] = useState<{ x: number, y: number, time: string, value: number } | null>(null);

    if (!data || data.length === 0) return null;

    // Filter valid points
    const points = data.filter(p => p[1] !== null) as [number, number][];
    if (points.length < 2) return null;

    const width = 200;

    // Determine Y scale
    const dataMin = Math.min(...points.map(p => p[1]));
    const dataMax = Math.max(...points.map(p => p[1]));

    const minVal = outputMinY !== undefined ? outputMinY : dataMin;
    const maxVal = outputMaxY !== undefined ? outputMaxY : dataMax;

    // Normalize
    const normalizeY = (val: number) => {
        // Clamp value between min and max
        const clamped = Math.max(minVal, Math.min(maxVal, val));
        // Avoid division by zero if flat line
        const range = maxVal - minVal || 1;
        return height - ((clamped - minVal) / range) * height;
    };

    const normalizeX = (idx: number) => (idx / (points.length - 1)) * width;

    const pathD = points.map((p, i) =>
        `${i === 0 ? 'M' : 'L'} ${normalizeX(i)} ${normalizeY(p[1])}`
    ).join(' ');

    // For area chart, close the path
    const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const index = Math.min(Math.max(0, Math.round((x / rect.width) * (points.length - 1))), points.length - 1);
        const point = points[index];

        if (point) {
            setHoverData({
                x: normalizeX(index),
                y: normalizeY(point[1]),
                time: new Date(point[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                value: point[1]
            });
        }
    };

    // Unique ID for gradient to avoid conflicts if multiple charts are on page
    const gradientId = `gradient-${color.replace('#', '')}-${unit}`;

    return (
        <div
            className="w-full mt-4 relative cursor-crosshair group/chart"
            style={{ height }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverData(null)}
        >
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={areaD} fill={`url(#${gradientId})`} />
                <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                {/* Hover Indicator */}
                {hoverData && (
                    <>
                        <line
                            x1={hoverData.x} y1="0"
                            x2={hoverData.x} y2={height}
                            stroke="white" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"
                        />
                        <circle cx={hoverData.x} cy={hoverData.y} r="3" fill="white" stroke={color} strokeWidth="2" />
                    </>
                )}
            </svg>

            {/* Tooltip */}
            {hoverData && (
                <div
                    className="absolute bg-[#18181b] border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white transform -translate-x-1/2 -translate-y-full pointer-events-none whitespace-nowrap z-20 shadow-xl flex flex-col items-center"
                    style={{ left: `${(hoverData.x / width) * 100}%`, top: -8 }}
                >
                    <span className="font-bold text-lg leading-none" style={{ color }}>{hoverData.value} <span className="text-xs font-normal text-gray-400">{unit}</span></span>
                    <span className="font-mono text-[10px] text-gray-500">{hoverData.time}</span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#18181b]" />
                </div>
            )}

            {/* Axis Labels (only visible when not hovering) */}
            <div className={`flex justify-between text-xs text-gray-500 mt-1 font-mono transition-opacity ${hoverData ? 'opacity-20' : 'opacity-100'}`}>
                <span>00:00</span>
                <span>12:00</span>
                <span>23:59</span>
            </div>
        </div>
    );
};
