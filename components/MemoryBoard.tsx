import React, { useState, useRef, useEffect } from 'react';
import { Photo } from '../types';
import { PhotoDetailsModal } from './PhotoDetailsModal';
import { downloadBoardAsImage, openPrintableMemoryBook, generatePDF } from '../utils/exportUtils';

interface MemoryBoardProps {
  isOpen: boolean;
  onClose: () => void;
  sharedPhotos: Photo[];
  onPhotoDrop: (photo: Photo) => void;
  onPhotoClick: (photo: Photo) => void;
}

interface PinnedPhoto {
  photo: Photo;
  x: number;
  y: number;
  rotation: number;
  pinColor: string;
}

const PIN_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

export const MemoryBoard: React.FC<MemoryBoardProps> = ({
  isOpen,
  onClose,
  sharedPhotos,
  onPhotoDrop,
  onPhotoClick
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [pinnedPhotos, setPinnedPhotos] = useState<PinnedPhoto[]>([]);
  const [showSparkle, setShowSparkle] = useState<{ x: number; y: number } | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  // Generate pinned photo positions
  useEffect(() => {
    if (!isOpen) return;

    const pinned = sharedPhotos.map((photo, index) => ({
      photo,
      x: 5 + (index % 4) * 23 + Math.random() * 5,
      y: 5 + Math.floor(index / 4) * 28 + Math.random() * 5,
      rotation: (Math.random() * 16) - 8,
      pinColor: PIN_COLORS[index % PIN_COLORS.length]
    }));
    setPinnedPhotos(pinned);
  }, [sharedPhotos, isOpen]);

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

    const rect = boardRef.current?.getBoundingClientRect();
    if (rect) {
      setShowSparkle({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setTimeout(() => setShowSparkle(null), 600);
    }

    const photoData = e.dataTransfer.getData('application/json');
    if (photoData) {
      try {
        const photo = JSON.parse(photoData);
        onPhotoDrop(photo);
      } catch (err) {
        console.error('Error parsing photo data:', err);
      }
    }
  };

  const handleDownloadImage = async () => {
    if (!boardRef.current || isExporting) return;
    setIsExporting(true);
    try {
      await downloadBoardAsImage(boardRef.current);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintBook = () => {
    if (sharedPhotos.length === 0) {
      alert('No memories to print!');
      return;
    }
    openPrintableMemoryBook(sharedPhotos);
  };

  const handleGeneratePDF = async () => {
    if (sharedPhotos.length === 0) {
      alert('No memories to export!');
      return;
    }
    if (isExporting) return;
    setIsExporting(true);
    try {
      await generatePDF(sharedPhotos);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <i className="fas fa-thumbtack text-red-400 text-2xl rotate-45" />
          <h2 className="font-fredericka text-2xl text-white tracking-widest drop-shadow-lg">
            Memory Board
          </h2>
          <span className="bg-amber-900/50 border border-amber-700/50 px-3 py-1 rounded-full font-mono text-xs text-amber-200">
            {sharedPhotos.length} shared
          </span>
        </div>
        
        {/* Export & Print Buttons */}
        {sharedPhotos.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="px-4 py-2 bg-amber-700/80 hover:bg-amber-600/90 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-mono"
              title="Download board as image"
            >
              <i className="fas fa-download" />
              <span className="hidden sm:inline">Export Image</span>
            </button>
            <button
              onClick={handlePrintBook}
              disabled={isExporting}
              className="px-4 py-2 bg-amber-700/80 hover:bg-amber-600/90 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-mono"
              title="Create printable memory book"
            >
              <i className="fas fa-book" />
              <span className="hidden sm:inline">Print Book</span>
            </button>
            <button
              onClick={handleGeneratePDF}
              disabled={isExporting}
              className="px-4 py-2 bg-amber-700/80 hover:bg-amber-600/90 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-mono"
              title="Generate PDF of memories"
            >
              <i className="fas fa-file-pdf" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
          </div>
        )}
        
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all"
        >
          <i className="fas fa-times" />
        </button>
      </div>

      {/* Cork Board Container */}
      <div
        ref={boardRef}
        className={`relative w-full max-w-5xl h-[75vh] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 ${
          isDragOver ? 'scale-[1.02] ring-4 ring-amber-400' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Cork Background */}
        <div className="absolute inset-0 bg-amber-800">
          {/* Cork texture */}
          <div 
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundSize: '150px 150px'
            }}
          />
          {/* Cork grain overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-700/30 via-transparent to-amber-900/40" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,_rgba(255,200,100,0.15)_0%,transparent_50%)]" />
        </div>

        {/* Wooden Frame */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 border-[12px] border-amber-950 rounded-lg shadow-[inset_0_0_30px_rgba(0,0,0,0.4)]" />
          {/* Frame highlights */}
          <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-amber-800/50 to-transparent" />
          <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-amber-800/50 to-transparent" />
        </div>

        {/* Drop Zone Indicator */}
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20 backdrop-blur-sm z-20">
            <div className="text-center animate-bounce">
              <i className="fas fa-thumbtack text-6xl text-amber-200 drop-shadow-lg mb-4 rotate-45" />
              <p className="font-fredericka text-2xl text-white tracking-widest">
                Pin Your Memory!
              </p>
            </div>
          </div>
        )}

        {/* Sparkle Effect on Drop */}
        {showSparkle && (
          <div
            className="absolute pointer-events-none z-30"
            style={{ left: showSparkle.x, top: showSparkle.y }}
          >
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-yellow-300 rounded-full animate-ping"
                style={{
                  transform: `rotate(${i * 45}deg) translateY(-20px)`,
                  animationDelay: `${i * 50}ms`,
                  animationDuration: '0.5s'
                }}
              />
            ))}
          </div>
        )}

        {/* Pinned Photos */}
        {pinnedPhotos.map(({ photo, x, y, rotation, pinColor }, index) => (
          <div
            key={photo.id}
            className="absolute cursor-pointer transition-all duration-300 hover:scale-110 hover:z-50 group"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: `rotate(${rotation}deg)`,
              zIndex: index + 1
            }}
            onClick={() => {
              setSelectedPhoto(photo);
              setIsModalOpen(true);
            }}
          >
            {/* Push Pin */}
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full shadow-lg z-10 transition-transform group-hover:scale-125"
              style={{ backgroundColor: pinColor }}
            >
              <div className="absolute inset-1 rounded-full bg-white/30" />
              <div className="absolute top-1 left-1 w-1 h-1 rounded-full bg-white/60" />
            </div>

            {/* Polaroid */}
            <div className="bg-white p-2 pb-10 shadow-xl transform transition-all group-hover:shadow-2xl group-hover:-rotate-2">
              {/* Photo */}
              <div className="w-28 h-28 sm:w-36 sm:h-36 overflow-hidden bg-gray-900">
                {photo.mediaType === 'video' ? (
                  <video
                    src={photo.dataUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                ) : (
                  <img
                    src={photo.dataUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Caption */}
              <div className="absolute bottom-2 left-0 right-0 text-center">
                <p className="font-hand text-sm text-gray-600 truncate px-2">
                  {photo.caption || 'Memory'}
                </p>
              </div>
            </div>

            {/* Shadow on cork */}
            <div className="absolute -bottom-2 left-2 right-2 h-4 bg-black/20 blur-md rounded-full -z-10 group-hover:bg-black/30" />
          </div>
        ))}

        {/* Empty State */}
        {sharedPhotos.length === 0 && !isDragOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-200/60">
            <div className="relative">
              <i className="fas fa-image text-7xl mb-4" />
              <i className="fas fa-thumbtack text-2xl text-red-400 absolute -top-2 -right-2 rotate-45" />
            </div>
            <p className="font-fredericka text-2xl tracking-widest mb-2">
              No memories shared yet
            </p>
            <p className="font-mono text-sm text-amber-200/40">
              Drag & drop photos here to share with everyone!
            </p>
          </div>
        )}

        {/* Decorative Elements */}
        <div className="absolute top-8 right-8 opacity-20 pointer-events-none">
          <i className="fas fa-heart text-red-400 text-3xl" />
        </div>
        <div className="absolute bottom-12 left-8 opacity-20 pointer-events-none rotate-12">
          <i className="fas fa-star text-yellow-400 text-2xl" />
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-amber-950/80 backdrop-blur-md px-6 py-3 rounded-full border border-amber-800/50">
        <p className="font-mono text-sm text-amber-200/80">
          <i className="fas fa-hand-pointer mr-2 text-amber-400" />
          Drag photos here to share memories with everyone
        </p>
      </div>

      {/* Photo Details Modal */}
      <PhotoDetailsModal
        photo={selectedPhoto}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPhoto(null);
        }}
      />
    </div>
  );
};

