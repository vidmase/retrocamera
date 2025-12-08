import React, { useEffect, useState } from 'react';
import { Photo } from '../types';
import { supabase } from '../services/supabaseClient';

interface PhotoDetailsModalProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PhotoDetailsModal: React.FC<PhotoDetailsModalProps> = ({
  photo,
  isOpen,
  onClose
}) => {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Fetch username when photo is opened
  useEffect(() => {
    if (!photo || !isOpen || !photo.userId) {
      setUsername(null);
      return;
    }

    const fetchUsername = async () => {
      setLoading(true);
      try {
        // Try to get from profiles table first
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, full_name, first_name, last_name')
          .eq('id', photo.userId)
          .single();

        if (!profileError && profileData) {
          // Prefer username, then full_name, then first_name + last_name
          if (profileData.username) {
            setUsername(profileData.username);
            setLoading(false);
            return;
          } else if (profileData.full_name) {
            setUsername(profileData.full_name);
            setLoading(false);
            return;
          } else if (profileData.first_name || profileData.last_name) {
            const name = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
            if (name) {
              setUsername(name);
              setLoading(false);
              return;
            }
          }
        }

        // If no profile data, check if it's the current user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser && currentUser.id === photo.userId) {
          // If it's the current user, use their email username
          setUsername(currentUser.email?.split('@')[0] || 'You');
        } else {
          // For other users without profile data, show Anonymous
          setUsername('Anonymous');
        }
      } catch (err) {
        console.error('Error fetching username:', err);
        setUsername('Anonymous');
      } finally {
        setLoading(false);
      }
    };

    fetchUsername();
  }, [photo, isOpen]);

  if (!isOpen || !photo) return null;

  const formattedDate = new Date(photo.timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handleDownload = () => {
    if (photo.mediaType === 'video') {
      const link = document.createElement('a');
      link.href = photo.dataUrl;
      link.download = `memory-${photo.id}.webm`;
      link.click();
    } else {
      const link = document.createElement('a');
      link.href = photo.dataUrl;
      link.download = `memory-${photo.id}.png`;
      link.click();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      {/* Modal Content */}
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-gradient-to-br from-amber-50 to-white rounded-lg shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Vintage Polaroid Frame Effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
          <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
          <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-gray-400 rotate-45" />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 hover:text-red-600 flex items-center justify-center shadow-lg transition-all hover:scale-110"
        >
          <i className="fas fa-times text-xl" />
        </button>

        {/* Photo/Video Display */}
        <div className="relative w-full bg-black flex items-center justify-center" style={{ minHeight: '60vh' }}>
          {photo.mediaType === 'video' ? (
            <video
              src={photo.dataUrl}
              className="w-full h-full max-h-[60vh] object-contain"
              controls
              autoPlay
              loop
              muted={false}
            />
          ) : (
            <img
              src={photo.dataUrl}
              alt={photo.caption || 'Memory'}
              className="w-full h-full max-h-[60vh] object-contain"
            />
          )}

          {/* Vintage Film Grain Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-10 mix-blend-overlay">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E")`,
                backgroundSize: '200px 200px'
              }}
            />
          </div>
        </div>

        {/* Details Section */}
        <div className="bg-white p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-fredericka text-3xl text-gray-800 tracking-wider mb-2">
                {photo.caption || 'Untitled Memory'}
              </h2>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <i className="fas fa-calendar-alt text-amber-600" />
                <span className="font-mono">{formattedDate}</span>
              </div>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-lg"
              title="Download"
            >
              <i className="fas fa-download" />
              <span className="hidden sm:inline font-mono text-sm">Download</span>
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-amber-200 my-6" />

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Shared By */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-user text-amber-600" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-mono mb-1">
                  Shared By
                </p>
                <p className="font-hand text-lg text-gray-800">
                  {loading ? (
                    <span className="text-gray-400 animate-pulse">Loading...</span>
                  ) : (
                    username || 'Anonymous'
                  )}
                </p>
              </div>
            </div>

            {/* Media Type */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <i className={`fas ${photo.mediaType === 'video' ? 'fa-video' : 'fa-camera'} text-blue-600`} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-mono mb-1">
                  Type
                </p>
                <p className="font-hand text-lg text-gray-800 capitalize">
                  {photo.mediaType || 'Photo'}
                </p>
              </div>
            </div>

            {/* Date Captured */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-clock text-green-600" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-mono mb-1">
                  Captured
                </p>
                <p className="font-hand text-lg text-gray-800">
                  {new Date(photo.timestamp).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            {/* Memory ID */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-hashtag text-purple-600" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-mono mb-1">
                  Memory ID
                </p>
                <p className="font-mono text-sm text-gray-600 break-all">
                  {photo.id.substring(0, 8)}...
                </p>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {photo.backNote && (
            <>
              <div className="border-t border-amber-200 my-6" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-mono mb-3">
                  Notes
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="font-hand text-lg text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {photo.backNote}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Custom Text */}
          {photo.customText && (
            <>
              <div className="border-t border-amber-200 my-6" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-mono mb-3">
                  Caption
                </p>
                <p className="font-hand text-xl text-gray-800 italic">
                  "{photo.customText}"
                </p>
              </div>
            </>
          )}
        </div>

        {/* Vintage Bottom Border */}
        <div className="h-2 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600" />
      </div>
    </div>
  );
};

