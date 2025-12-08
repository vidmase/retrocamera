import React, { useState } from 'react';
import { Photo } from '../types';

interface MemoryBoardDropZoneProps {
  isVisible: boolean;
  onDrop: (photo: Photo, position: { x: number; y: number }) => void;
  onOpenBoard: () => void;
  sharedCount: number;
}

export const MemoryBoardDropZone: React.FC<MemoryBoardDropZoneProps> = ({
  isVisible,
  onDrop,
  onOpenBoard,
  sharedCount
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPinDrop, setShowPinDrop] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const photoData = e.dataTransfer.getData('application/json');
    if (photoData) {
      try {
        const photo = JSON.parse(photoData);
        // Get the drop position for the liquid effect
        const dropPosition = { x: e.clientX, y: e.clientY };
        setShowPinDrop(true);
        setTimeout(() => setShowPinDrop(false), 600);
        onDrop(photo, dropPosition);
      } catch (err) {
        console.error('Error parsing photo data:', err);
      }
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-24 right-6 z-[70] transition-all duration-300 ${
        isDragOver ? 'scale-110' : 'scale-100 hover:scale-105'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Cork Board Mini */}
      <div
        className={`relative w-20 h-20 rounded-lg overflow-hidden cursor-pointer shadow-2xl transition-all duration-300 ${
          isDragOver
            ? 'ring-4 ring-amber-400 shadow-amber-500/30'
            : 'ring-2 ring-amber-700/50 hover:ring-amber-600'
        }`}
        onClick={onOpenBoard}
      >
        {/* Cork Background */}
        <div className="absolute inset-0 bg-amber-700">
          <div 
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundSize: '80px 80px'
            }}
          />
        </div>

        {/* Wooden Frame */}
        <div className="absolute inset-0 border-4 border-amber-900 rounded-lg pointer-events-none" />

        {/* Mini Polaroids */}
        {sharedCount > 0 && (
          <>
            <div className="absolute top-2 left-2 w-6 h-7 bg-white shadow-sm transform -rotate-6">
              <div className="w-full h-4 bg-gray-300" />
            </div>
            {sharedCount > 1 && (
              <div className="absolute top-3 right-2 w-6 h-7 bg-white shadow-sm transform rotate-12">
                <div className="w-full h-4 bg-gray-400" />
              </div>
            )}
            {sharedCount > 2 && (
              <div className="absolute bottom-3 left-3 w-6 h-7 bg-white shadow-sm transform rotate-3">
                <div className="w-full h-4 bg-gray-500" />
              </div>
            )}
          </>
        )}

        {/* Push Pin Icon */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
          isDragOver ? 'scale-150 rotate-45' : 'rotate-45'
        }`}>
          <i className={`fas fa-thumbtack text-xl drop-shadow-lg ${
            isDragOver ? 'text-amber-200' : 'text-red-500'
          }`} />
        </div>

        {/* Pin Drop Animation */}
        {showPinDrop && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-red-400 rounded-full animate-ping" />
          </div>
        )}

        {/* Count Badge */}
        {sharedCount > 0 && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <span className="text-white text-xs font-bold">{sharedCount > 9 ? '9+' : sharedCount}</span>
          </div>
        )}
      </div>

      {/* Label */}
      <div className={`absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap transition-all duration-300 ${
        isDragOver ? 'opacity-100 scale-100' : 'opacity-80 scale-95'
      }`}>
        <span className="font-fredericka text-amber-200 text-xs tracking-wider drop-shadow-lg bg-black/40 px-2 py-1 rounded">
          {isDragOver ? 'Drop to Share!' : 'Memory Board'}
        </span>
      </div>
    </div>
  );
};

