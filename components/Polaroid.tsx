import React, { useState, useEffect, useRef } from 'react';
import { Photo } from '../types';

interface PolaroidProps {
  photo: Photo;
  onFocus: (id: string) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  className?: string;
}

const Polaroid: React.FC<PolaroidProps> = ({ photo, onFocus, onDragEnd, className = '' }) => {
  const dateStr = new Date(photo.timestamp).toLocaleString(undefined, {
    year: '2-digit',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // We initialize state from props, but we don't sync it back to props automatically 
  // unless the key changes (remounting) or we explicitly want to reset.
  const [position, setPosition] = useState({ x: photo.x, y: photo.y });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  const handleStart = (clientX: number, clientY: number) => {
    onFocus(photo.id);
    setIsDragging(true);
    if (elementRef.current) {
      // Calculate exact offset relative to the element's top-left
      const rect = elementRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: clientX - position.x,
        y: clientY - position.y
      };
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
  };

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!isDragging) return;

      const newX = clientX - dragOffset.current.x;
      const newY = clientY - dragOffset.current.y;

      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        if (onDragEnd) {
          onDragEnd(photo.id, position.x, position.y);
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX, e.touches[0].clientY);
    const onMouseUp = () => handleEnd();
    const onTouchEnd = () => handleEnd();

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, position, onDragEnd, photo.id]);

  return (
    <div
      ref={elementRef}
      className={`absolute w-64 select-none transition-shadow duration-300 ${className} ${isDragging ? 'z-[1000] scale-105' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        zIndex: isDragging ? 9999 : photo.zIndex,
        // If ejecting, disable transform so CSS animation takes precedence
        transform: photo.isEjecting ? undefined : `rotate(${photo.rotation}deg)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'box-shadow 0.3s, transform 0.3s'
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className="relative bg-white p-3 pb-8 shadow-xl polaroid-shadow">
        {/* Tape effect - hide if ejecting */}
        {!photo.isEjecting && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-8 bg-white/30 backdrop-blur-sm border-l border-r border-white/50 transform -rotate-1 pointer-events-none" />
        )}

        {/* Image Area */}
        <div className="aspect-square bg-black overflow-hidden relative mb-3 border border-gray-100 pointer-events-none">
          <img
            src={photo.dataUrl}
            alt="Memory"
            className={`w-full h-full object-cover ${photo.isDeveloping ? 'animate-develop-negative' :
              photo.isStaticNegative ? 'invert grayscale contrast-[1.2]' : ''
              }`}
          />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dust.png')] opacity-30 mix-blend-overlay" />
        </div>

        {/* Caption Area */}
        <div className="text-center h-12 flex flex-col justify-center items-center pointer-events-none">
          <p className="font-hand text-2xl text-gray-800 leading-none">
            {photo.caption || ""}
          </p>
          <p className="font-mono text-[10px] text-gray-400 mt-1 uppercase tracking-widest">{photo.customText || dateStr}</p>
        </div>
      </div>
    </div>
  );
};

export default Polaroid;