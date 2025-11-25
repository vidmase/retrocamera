import React from 'react';

interface Cursor {
    x: number;
    y: number;
    lastUpdate: number;
    color: string;
}

interface CursorOverlayProps {
    cursors: Record<string, Cursor>;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ cursors }) => {
    return (
        <div className="absolute inset-0 pointer-events-none z-[60] overflow-hidden">
            {Object.entries(cursors).map(([userId, cursor]) => (
                <div
                    key={userId}
                    className="absolute w-8 h-8 -ml-4 -mt-4 transition-all duration-100 ease-linear"
                    style={{
                        left: `${cursor.x * 100}%`,
                        top: `${cursor.y * 100}%`,
                        opacity: Math.max(0, 1 - (Date.now() - cursor.lastUpdate) / 2000) // Fade out after 2s
                    }}
                >
                    {/* Core Orb */}
                    <div
                        className="w-full h-full rounded-full blur-[2px] animate-pulse"
                        style={{ backgroundColor: cursor.color, boxShadow: `0 0 10px 2px ${cursor.color}` }}
                    />
                    {/* Outer Glow */}
                    <div
                        className="absolute inset-0 w-full h-full rounded-full blur-md opacity-50"
                        style={{ backgroundColor: cursor.color }}
                    />
                </div>
            ))}
        </div>
    );
};
