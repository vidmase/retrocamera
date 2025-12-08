import React, { useState, useEffect } from 'react';
import { Album, Photo } from '../types';
import { supabase } from '../services/supabaseClient';
import { APP_ID } from '../constants';

interface AlbumDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  photos: Photo[];
  onPhotoAddedToAlbum: (photoId: string, albumId: string) => void;
}

const COVER_COLORS = [
  { name: 'Burgundy', value: '#722F37' },
  { name: 'Forest', value: '#228B22' },
  { name: 'Navy', value: '#000080' },
  { name: 'Brown', value: '#8B4513' },
  { name: 'Black', value: '#1a1a1a' },
  { name: 'Plum', value: '#4a2040' },
];

const COVER_PATTERNS: { name: string; value: Album['coverPattern']; icon: string }[] = [
  { name: 'Leather', value: 'leather', icon: '🪶' },
  { name: 'Fabric', value: 'fabric', icon: '🧵' },
  { name: 'Vintage', value: 'vintage', icon: '📜' },
  { name: 'Modern', value: 'modern', icon: '✨' },
];

const getPatternStyle = (pattern: Album['coverPattern'], color: string) => {
  const baseStyle = { backgroundColor: color };
  
  switch (pattern) {
    case 'leather':
      return {
        ...baseStyle,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h20v20H0V0zm10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm20 0a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 37a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm10-17h20v20H20V20zm10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14z' fill='%23000' fill-opacity='0.1'/%3E%3C/svg%3E")`,
      };
    case 'fabric':
      return {
        ...baseStyle,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='0.1' fill-rule='evenodd'%3E%3Cpath d='M5 0h1L0 6V5zM6 5v1H5z'/%3E%3C/g%3E%3C/svg%3E")`,
      };
    case 'vintage':
      return {
        ...baseStyle,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4af37' fill-opacity='0.15'%3E%3Cpath d='M50 50c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10s-10-4.477-10-10 4.477-10 10-10zM10 10c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10S0 25.523 0 20s4.477-10 10-10zm10 8c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm40 40c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      };
    case 'modern':
      return {
        ...baseStyle,
        backgroundImage: `linear-gradient(135deg, ${color} 25%, transparent 25%), linear-gradient(225deg, ${color} 25%, transparent 25%), linear-gradient(45deg, ${color} 25%, transparent 25%), linear-gradient(315deg, ${color} 25%, rgba(255,255,255,0.05) 25%)`,
        backgroundSize: '20px 20px',
        backgroundPosition: '10px 0, 10px 0, 0 0, 0 0',
      };
    default:
      return baseStyle;
  }
};

export const AlbumDrawer: React.FC<AlbumDrawerProps> = ({
  isOpen,
  onClose,
  user,
  photos,
  onPhotoAddedToAlbum
}) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COVER_COLORS[3].value);
  const [selectedPattern, setSelectedPattern] = useState<Album['coverPattern']>('leather');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([]);
  const [showPhotoSelector, setShowPhotoSelector] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch albums for current user
  useEffect(() => {
    if (!isOpen || !user) return;

    const fetchAlbums = async () => {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .eq('user_id', user.id)
        .eq('app_id', APP_ID)
        .order('created_at', { ascending: false });

      if (data && !error) {
        const mapped: Album[] = data.map((a: any) => ({
          id: a.id,
          name: a.name,
          coverColor: a.cover_color,
          coverPattern: a.cover_pattern as Album['coverPattern'],
          createdAt: new Date(a.created_at).getTime(),
          photoCount: 0,
          coverPhotoUrl: a.cover_photo_url
        }));
        setAlbums(mapped);
      }
    };

    fetchAlbums();
  }, [isOpen, user]);

  // Fetch photos for selected album
  useEffect(() => {
    if (!selectedAlbum) {
      setAlbumPhotos([]);
      return;
    }

    const fetchAlbumPhotos = async () => {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('album_id', selectedAlbum.id)
        .order('created_at', { ascending: false });

      if (data && !error) {
        const mapped: Photo[] = data.map((p: any) => ({
          id: p.id,
          dataUrl: p.data_url,
          timestamp: new Date(p.created_at).getTime(),
          caption: p.caption,
          isDeveloping: false,
          isStaticNegative: false,
          x: 0,
          y: 0,
          rotation: 0,
          zIndex: 0,
          albumId: p.album_id,
          mediaType: p.data_url.startsWith('data:video') ? 'video' : 'photo'
        }));
        setAlbumPhotos(mapped);
      }
    };

    fetchAlbumPhotos();
  }, [selectedAlbum]);

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim() || !user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('albums')
      .insert({
        user_id: user.id,
        app_id: APP_ID,
        name: newAlbumName.trim(),
        cover_color: selectedColor,
        cover_pattern: selectedPattern
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating album:', error);
      setLoading(false);
      return;
    }

    if (data) {
      const newAlbum: Album = {
        id: data.id,
        name: data.name,
        coverColor: data.cover_color,
        coverPattern: data.cover_pattern as Album['coverPattern'],
        createdAt: new Date(data.created_at).getTime(),
        photoCount: 0
      };
      setAlbums(prev => [newAlbum, ...prev]);
      setNewAlbumName('');
      setIsCreating(false);
    }
    setLoading(false);
  };

  const handleAddPhotoToAlbum = async (photoId: string) => {
    if (!selectedAlbum) return;

    const { error } = await supabase
      .from('photos')
      .update({ album_id: selectedAlbum.id })
      .eq('id', photoId);

    if (!error) {
      // Update cover photo if this is the first photo
      if (albumPhotos.length === 0) {
        const photo = photos.find(p => p.id === photoId);
        if (photo) {
          await supabase
            .from('albums')
            .update({ cover_photo_url: photo.dataUrl })
            .eq('id', selectedAlbum.id);

          setAlbums(prev => prev.map(a =>
            a.id === selectedAlbum.id ? { ...a, coverPhotoUrl: photo.dataUrl } : a
          ));
        }
      }

      const addedPhoto = photos.find(p => p.id === photoId);
      if (addedPhoto) {
        setAlbumPhotos(prev => [{ ...addedPhoto, albumId: selectedAlbum.id }, ...prev]);
      }
      onPhotoAddedToAlbum(photoId, selectedAlbum.id);
      setShowPhotoSelector(false);
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    const { error } = await supabase
      .from('albums')
      .delete()
      .eq('id', albumId);

    if (!error) {
      setAlbums(prev => prev.filter(a => a.id !== albumId));
      if (selectedAlbum?.id === albumId) {
        setSelectedAlbum(null);
      }
    }
  };

  const availablePhotos = photos.filter(p => !p.albumId && !albumPhotos.find(ap => ap.id === p.id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end lg:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-[#2a2a2a] w-full max-w-2xl h-[80vh] lg:h-[70vh] rounded-t-3xl lg:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10 animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a]">
          <div className="flex items-center gap-3">
            {selectedAlbum && (
              <button
                onClick={() => {
                  setSelectedAlbum(null);
                  setShowPhotoSelector(false);
                }}
                className="text-white/60 hover:text-white transition-colors"
              >
                <i className="fas fa-arrow-left" />
              </button>
            )}
            <i className="fas fa-book-open text-accent text-xl" />
            <h2 className="font-fredericka text-xl text-white tracking-widest">
              {selectedAlbum ? selectedAlbum.name : 'My Albums'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedAlbum ? (
            // Album Detail View
            <div className="space-y-4">
              {/* Add Photo Button */}
              <button
                onClick={() => setShowPhotoSelector(true)}
                className="w-full py-3 border-2 border-dashed border-white/20 rounded-xl text-white/60 hover:text-white hover:border-accent/50 transition-all flex items-center justify-center gap-2 group"
              >
                <i className="fas fa-plus group-hover:rotate-90 transition-transform" />
                <span className="font-mono text-sm tracking-wider">ADD PHOTOS</span>
              </button>

              {/* Photo Grid */}
              {albumPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/40">
                  <i className="fas fa-images text-5xl mb-4" />
                  <p className="font-mono text-sm">No photos yet</p>
                  <p className="font-hand text-lg mt-1">Add your first memory!</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {albumPhotos.map(photo => (
                    <div
                      key={photo.id}
                      className="aspect-square bg-black rounded-lg overflow-hidden relative group"
                    >
                      {photo.mediaType === 'video' ? (
                        <video
                          src={photo.dataUrl}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={photo.dataUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {photo.caption && (
                          <span className="font-hand text-white text-sm text-center px-2">{photo.caption}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Photo Selector Modal */}
              {showPhotoSelector && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
                  <div className="bg-[#2a2a2a] w-full max-w-md max-h-[70vh] rounded-xl overflow-hidden border border-white/10">
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                      <h3 className="font-mono text-white text-sm tracking-wider">SELECT PHOTO</h3>
                      <button
                        onClick={() => setShowPhotoSelector(false)}
                        className="text-white/60 hover:text-white"
                      >
                        <i className="fas fa-times" />
                      </button>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[50vh]">
                      {availablePhotos.length === 0 ? (
                        <p className="text-center text-white/40 font-mono text-sm py-8">
                          No available photos
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {availablePhotos.map(photo => (
                            <button
                              key={photo.id}
                              onClick={() => handleAddPhotoToAlbum(photo.id)}
                              className="aspect-square bg-black rounded-lg overflow-hidden hover:ring-2 hover:ring-accent transition-all"
                            >
                              {photo.mediaType === 'video' ? (
                                <video
                                  src={photo.dataUrl}
                                  className="w-full h-full object-cover"
                                  muted
                                />
                              ) : (
                                <img
                                  src={photo.dataUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : isCreating ? (
            // Create Album View
            <div className="space-y-6">
              {/* Album Preview */}
              <div className="flex justify-center">
                <div
                  className="w-48 h-56 rounded-lg shadow-2xl relative overflow-hidden transition-all duration-300"
                  style={getPatternStyle(selectedPattern, selectedColor)}
                >
                  {/* Spine */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                  />
                  {/* Gold Label */}
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 w-32 h-10 bg-gradient-to-b from-yellow-200 to-yellow-400 rounded-sm flex items-center justify-center shadow-md">
                    <span className="font-mono text-xs text-yellow-900 tracking-wider truncate px-2">
                      {newAlbumName || 'ALBUM'}
                    </span>
                  </div>
                  {/* Corner Decorations */}
                  <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-yellow-400/50" />
                  <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-yellow-400/50" />
                </div>
              </div>

              {/* Album Name Input */}
              <div>
                <label className="block text-white/60 font-mono text-xs tracking-wider mb-2">ALBUM NAME</label>
                <input
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  placeholder="Summer Memories..."
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white font-hand text-xl focus:outline-none focus:border-accent transition-colors"
                  maxLength={30}
                />
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-white/60 font-mono text-xs tracking-wider mb-2">COVER COLOR</label>
                <div className="flex gap-2 flex-wrap">
                  {COVER_COLORS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => setSelectedColor(color.value)}
                      className={`w-10 h-10 rounded-full transition-all ${selectedColor === color.value ? 'ring-2 ring-accent ring-offset-2 ring-offset-[#2a2a2a] scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* Pattern Selection */}
              <div>
                <label className="block text-white/60 font-mono text-xs tracking-wider mb-2">COVER STYLE</label>
                <div className="grid grid-cols-4 gap-2">
                  {COVER_PATTERNS.map(pattern => (
                    <button
                      key={pattern.value}
                      onClick={() => setSelectedPattern(pattern.value)}
                      className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${selectedPattern === pattern.value
                        ? 'border-accent bg-accent/20 text-white'
                        : 'border-white/10 text-white/60 hover:border-white/30'
                        }`}
                    >
                      <span className="text-xl">{pattern.icon}</span>
                      <span className="font-mono text-[10px] tracking-wider">{pattern.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setIsCreating(false)}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-mono tracking-wider rounded-lg transition-all"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleCreateAlbum}
                  disabled={!newAlbumName.trim() || loading}
                  className="flex-1 py-3 bg-accent hover:bg-accent/90 text-white font-mono tracking-wider rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'CREATING...' : 'CREATE'}
                </button>
              </div>
            </div>
          ) : (
            // Albums Grid
            <div className="space-y-4">
              {/* Create Album Button */}
              <button
                onClick={() => setIsCreating(true)}
                className="w-full py-4 border-2 border-dashed border-white/20 rounded-xl text-white/60 hover:text-white hover:border-accent/50 transition-all flex items-center justify-center gap-3 group"
              >
                <i className="fas fa-plus-circle text-xl group-hover:rotate-90 transition-transform" />
                <span className="font-fredericka text-lg tracking-widest">Create New Album</span>
              </button>

              {/* Albums List */}
              {albums.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/40">
                  <i className="fas fa-book text-5xl mb-4" />
                  <p className="font-mono text-sm">No albums yet</p>
                  <p className="font-hand text-lg mt-1">Create your first album!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {albums.map(album => (
                    <button
                      key={album.id}
                      onClick={() => setSelectedAlbum(album)}
                      className="group relative"
                    >
                      {/* Album Cover */}
                      <div
                        className="w-full aspect-[3/4] rounded-lg shadow-xl relative overflow-hidden transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl"
                        style={getPatternStyle(album.coverPattern, album.coverColor)}
                      >
                        {/* Spine */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-3"
                          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                        />
                        
                        {/* Cover Photo or Label */}
                        {album.coverPhotoUrl ? (
                          <div className="absolute inset-4 left-6 rounded overflow-hidden border-4 border-white/20 shadow-inner">
                            <img
                              src={album.coverPhotoUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[70%] h-8 bg-gradient-to-b from-yellow-200 to-yellow-400 rounded-sm flex items-center justify-center shadow-md">
                            <span className="font-mono text-[10px] text-yellow-900 tracking-wider truncate px-1">
                              {album.name.toUpperCase()}
                            </span>
                          </div>
                        )}

                        {/* Corner Decorations */}
                        <div className="absolute top-1 right-1 w-4 h-4 border-t border-r border-yellow-400/30" />
                        <div className="absolute bottom-1 right-1 w-4 h-4 border-b border-r border-yellow-400/30" />

                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this album?')) {
                              handleDeleteAlbum(album.id);
                            }
                          }}
                          className="absolute top-1 left-4 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <i className="fas fa-trash text-white text-xs" />
                        </button>
                      </div>

                      {/* Album Name */}
                      <p className="mt-2 font-hand text-white text-center truncate">
                        {album.name}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

