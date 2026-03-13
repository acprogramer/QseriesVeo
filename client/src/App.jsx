import React, { useState, useEffect, useRef } from 'react';
import {
  useFocusable,
  FocusContext,
} from '@noriginmedia/norigin-spatial-navigation';
import { Search, Home, Film, Tv, Settings, X, Star, Calendar, Tag } from 'lucide-react';
import VideoPlayer from './VideoPlayer';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/* ── Skeleton Card ─────────────────────────────────── */
const SkeletonCard = () => (
  <div className="movie-card skeleton">
    <div className="skeleton-img" />
    <div className="skeleton-bar" />
  </div>
);

/* ── Movie Card ────────────────────────────────────── */
const MovieCard = ({ movie, onSelect, disabled }) => {
  const { ref, focused } = useFocusable({
    onEnterPress: () => !disabled && onSelect(movie),
  });

  return (
    <div
      ref={ref}
      className={`movie-card ${focused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && onSelect(movie)}
    >
      {movie.image ? (
        <img src={movie.image} alt={movie.title} loading="lazy" />
      ) : (
        <div className="movie-card-placeholder">
          <Film size={40} />
        </div>
      )}

      <div className="movie-info">
        <h3 className="movie-info-title">{movie.title}</h3>
        <div className="movie-info-meta">
          {movie.year && (
            <span className="meta-tag"><Calendar size={11} />{movie.year}</span>
          )}
          {movie.genre && (
            <span className="meta-tag"><Tag size={11} />{movie.genre}</span>
          )}
          {movie.format && (
            <span className="meta-tag format">{movie.format}</span>
          )}
          {movie.size && (
            <span className="meta-tag size">{movie.size}</span>
          )}
          {movie.healthScore && (
            <span className="meta-tag health" title="Puntuación de salud (semillas)">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={11} fill={i < movie.healthScore ? 'currentColor' : 'none'} color={i < movie.healthScore ? '#fbbf24' : '#6b7280'} />
              ))}
            </span>
          )}
        </div>
        {movie.description && (
          <p className="movie-info-desc">{movie.description.substring(0, 120)}...</p>
        )}
      </div>
    </div>
  );
};

/* ── Search Field ──────────────────────────────────── */
const SearchField = ({ onSearch, onClear, hasResults, disabled }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const { ref, focused, focusSelf } = useFocusable({
    onEnterPress: () => !disabled && onSearch(value),
  });

  useEffect(() => { focusSelf(); }, [focusSelf]);
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !disabled) onSearch(value);
    if (e.key === 'Escape') { setValue(''); onClear(); }
  };

  const handleClear = () => { setValue(''); onClear(); inputRef.current?.focus(); };

  return (
    <div className="search-wrapper">
      <Search size={20} className="search-icon-left" />
      <input
        ref={el => { if (el) { ref.current = el; inputRef.current = el; } }}
        className={`search-bar ${focused ? 'focused' : ''}`}
        type="text"
        placeholder="Buscar películas o series..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus
      />
      {(value || hasResults) && (
        <button className="search-clear-btn" onClick={handleClear} tabIndex={-1}>
          <X size={16} />
        </button>
      )}
    </div>
  );
};

/* ── Sidebar Nav Item ──────────────────────────────── */
const NavItem = ({ icon: Icon, label, active, onClick }) => {
  const { ref, focused } = useFocusable({
    onEnterPress: onClick
  });
  return (
    <div
      ref={ref}
      className={`nav-item ${focused ? 'focused' : ''} ${active ? 'active' : ''}`}
      title={label}
      onClick={onClick}
    >
      <Icon size={20} />
    </div>
  );
};

/* ── Loading Overlay ───────────────────────────────── */
const LoadingOverlay = ({ movie }) => (
  <div className="loading-overlay">
    <div className="loading-card">
      {movie?.image && (
        <img src={movie.image} alt={movie.title} className="loading-poster" />
      )}
      <div className="loading-info">
        <div className="loading-dots">
          <span /><span /><span />
        </div>
        <h2>{movie?.title}</h2>
        {movie?.year && <p className="loading-meta">{movie.year}{movie.genre ? ` · ${movie.genre}` : ''}</p>}
        <p className="loading-sub">Conectando con peers del torrent...</p>
      </div>
    </div>
  </div>
);

/* ── Movie Details View ────────────────────────────── */
const detailsFocusKey = 'DETAILS_VIEW';

const ActionButton = ({ label, onEnterPress, icon: Icon, primary = false }) => {
  const { ref, focused } = useFocusable({ onEnterPress });
  return (
    <button
      ref={ref}
      className={`details-btn ${primary ? 'primary' : ''} ${focused ? 'focused' : ''}`}
      onClick={onEnterPress}
    >
      {Icon && <Icon size={18} />}
      {label}
    </button>
  );
};

const MovieDetailsView = ({ movie, onPlay, onWatchLater, onBack }) => {
  const { ref, focusKey, focusSelf } = useFocusable({
    focusKey: detailsFocusKey,
    isFocusBoundary: true
  });

  useEffect(() => {
    focusSelf();
  }, [focusSelf]);

  if (!movie) return null;

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="details-view">
        <div className="details-backdrop">
          {movie.image && <img src={movie.image} alt={movie.title} />}
          <div className="details-gradient" />
        </div>
        <div className="details-layout">
          {movie.image && (
            <div className="details-poster">
              <img src={movie.image} alt={movie.title} />
            </div>
          )}
          <div className="details-content">
            <h1 className="details-title">{movie.title}</h1>
            <div className="details-meta">
              {movie.year && <span><Calendar size={14} />{movie.year}</span>}
              {movie.genre && <span><Tag size={14} />{movie.genre}</span>}
              {movie.format && <span className="format">{movie.format}</span>}
              {movie.size && <span className="size">{movie.size}</span>}
              {movie.healthScore && (
                <span className="health">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} fill={i < movie.healthScore ? 'currentColor' : 'none'} color={i < movie.healthScore ? '#fbbf24' : '#6b7280'} />
                  ))}
                </span>
              )}
            </div>
            <div className="details-synopsis">
              <h3>Sinopsis</h3>
              <div className="synopsis-text">
                <p>{movie.description || 'No hay descripción disponible para este título.'}</p>
              </div>
            </div>
            <div className="details-actions">
              <ActionButton label="Ver ahora" onEnterPress={onPlay} primary />
              <ActionButton label="Ver después" onEnterPress={() => onWatchLater(movie)} />
              <ActionButton label="Atrás" onEnterPress={onBack} />
            </div>
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
};

/* ── Library View (Mi videoteca) ───────────────────── */
const LibraryView = ({ downloads, onPlay, onRemove }) => {
  return (
    <div className="library-view">
      <h2>Mi videoteca</h2>
      {downloads.length === 0 ? (
        <div className="empty-state mt-8">
          <Film size={48} />
          <h3>Aún no tienes nada aquí</h3>
          <p>Añade películas seleccionando "Ver después" en los detalles de un título.</p>
        </div>
      ) : (
        <div className="movie-grid mt-4">
          {downloads.map((dl, i) => (
            <div key={i} className="movie-card library-card" style={{ cursor: 'default' }}>
              <div className="library-card-img">
                {dl.movieMeta?.image ? (
                  <img src={dl.movieMeta.image} alt={dl.movieMeta.title} />
                ) : (
                  <div className="movie-card-placeholder"><Film size={40} /></div>
                )}
                {!dl.ready && (
                  <div className="download-overlay">
                    <div className="progress-ring">{(dl.progress * 100).toFixed(0)}%</div>
                  </div>
                )}
                {dl.ready && (
                  <div className="ready-badge">Listo</div>
                )}
              </div>
              <div className="movie-info">
                <h3 className="movie-info-title">{dl.movieMeta?.title || 'Descargando...'}</h3>
                {!dl.ready && (
                  <div className="download-stats">
                    <span className="speed">{((dl.downloadSpeed || 0) / 1024 / 1024).toFixed(2)} MB/s</span>
                  </div>
                )}
                <div className="library-card-actions mt-3">
                  <button className="lib-btn play" onClick={(e) => { e.stopPropagation(); onPlay(dl.movieMeta); }}>
                    Ver ahora
                  </button>
                  <button className="lib-btn cancel" onClick={(e) => { e.stopPropagation(); onRemove(dl.magnet); }}>
                    {dl.ready ? 'Borrar' : 'Cancelar descarga'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Settings View ─────────────────────────────────── */
const SettingsView = () => {
  return (
    <div className="settings-view">
      <h2>Ajustes</h2>
      <div className="settings-section mt-4">
        <h3>Reproducción</h3>
        <div className="settings-row">
          <span>Reproducción automática</span>
          <label className="switch">
            <input type="checkbox" defaultChecked />
            <span className="slider round"></span>
          </label>
        </div>
        <div className="settings-row">
          <span>Forzar conversión de audio</span>
          <label className="switch">
            <input type="checkbox" defaultChecked />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="settings-section mt-4">
        <h3>Apariencia</h3>
        <div className="settings-row">
          <span>Tema oscuro</span>
          <label className="switch">
            <input type="checkbox" defaultChecked />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="settings-section mt-4">
        <h3>Almacenamiento</h3>
        <div className="settings-row">
          <span>Borrar caché de imágenes y meta</span>
          <button className="settings-btn">Limpiar Caché</button>
        </div>
      </div>
    </div>
  );
};

/* ── Main App ──────────────────────────────────────── */
function App() {
  const [currentView, setCurrentView] = useState('home');
  const [activeCategory, setActiveCategory] = useState('peliculas');
  const [currentPage, setCurrentPage] = useState(1);
  const [latest, setLatest] = useState([]);
  const [results, setResults] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [streamingUrl, setStreamingUrl] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const { ref, focusKey } = useFocusable();

  // Polling for downloads progress and notifications
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/downloads`);
        const data = await res.json();

        // Check if any download just finished
        data.forEach(dl => {
          const old = downloads.find(d => d.magnet === dl.magnet);
          if (dl.ready && old && !old.ready) {
            setNotification(`¡Listo! ${dl.movieMeta?.title || 'Tu contenido'} ya está disponible.`);
            setTimeout(() => setNotification(null), 5000);
          }
        });

        setDownloads(data);
      } catch (e) {
        console.error('Error fetching downloads:', e);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [downloads]);

  // Fetch movies when category or page changes in Home
  useEffect(() => {
    if (currentView === 'home') {
      const fetchHomeData = async () => {
        setSearching(true);
        setError(null);
        try {
          const res = await fetch(`${API_BASE}/list?category=${activeCategory}&page=${currentPage}`);
          const data = await res.json();
          setLatest(data);
        } catch (err) {
          console.error(err);
          setError('Error al cargar contenido de la Home.');
        } finally {
          setSearching(false);
        }
      };
      fetchHomeData();
    }
  }, [currentView, activeCategory, currentPage]);

  const handleSearch = async (query) => {
    if (!query.trim()) return;
    setCurrentView('search');
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setResults(data);
      if (data.length === 0) setError('No se encontraron resultados para esa búsqueda.');
    } catch (err) {
      setError('No se pudo conectar con el servidor. ¿Está corriendo?');
    } finally {
      setSearching(false);
    }
  };

  const handleClear = () => {
    setResults([]);
    setError(null);
  };

  const handleSelectMovie = (movie) => {
    setSelectedMovie(movie);
    setCurrentView('details');
  };

  const handleWatchLater = async (movie) => {
    try {
      setNotification('Añadido a la videoteca. Empezando descarga...');
      const resp = await fetch(`${API_BASE}/magnet?url=${encodeURIComponent(movie.link)}`);
      const { magnet } = await resp.json();
      if (magnet) {
        await fetch(`${API_BASE}/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ magnet, movie })
        });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveDownload = async (magnet) => {
    try {
      await fetch(`${API_BASE}/download/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnet })
      });
      // Filter out immediately for better UX
      setDownloads(prev => prev.filter(d => d.magnet !== magnet));
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlayMovie = async (movie) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/magnet?url=${encodeURIComponent(movie.link)}`);
      const { magnet } = await resp.json();
      if (magnet) {
        setStreamingUrl(`${API_BASE}/stream?magnet=${encodeURIComponent(magnet)}`);
      } else {
        setError('No se pudo obtener el enlace de reproducción para este título.');
        setLoading(false);
      }
    } catch (err) {
      setError('Error al obtener el enlace. Comprueba el servidor.');
      setLoading(false);
    }
  };

  // If streaming, show full player
  if (streamingUrl) {
    return (
      <VideoPlayer
        src={streamingUrl}
        movie={selectedMovie}
        onBack={() => { setStreamingUrl(null); setLoading(false); setSelectedMovie(null); }}
      />
    );
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="tv-container">
        {loading && <LoadingOverlay movie={selectedMovie} />}

        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-logo">Q</div>
          <NavItem icon={Home} label="Inicio" active={currentView === 'home'} onClick={() => setCurrentView('home')} />
          <NavItem icon={Search} label="Buscar" active={currentView === 'search'} onClick={() => setCurrentView('search')} />
          <NavItem icon={Film} label="Videoteca" active={currentView === 'library'} onClick={() => setCurrentView('library')} />
          <div className="sidebar-spacer" />
          <NavItem icon={Settings} label="Ajustes" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="toast-notification">
            {notification}
          </div>
        )}

        {/* Main Content Area */}
        <div className="main-content" style={{ padding: currentView === 'details' ? 0 : '36px 44px' }}>

          {/* 1. Movie Details View */}
          {currentView === 'details' && selectedMovie && (
            <MovieDetailsView
              movie={selectedMovie}
              onPlay={() => handlePlayMovie(selectedMovie)}
              onWatchLater={handleWatchLater}
              onBack={() => {
                // If we were in search, go back to search, otherwise home
                setCurrentView(results.length > 0 ? 'search' : 'home');
              }}
            />
          )}

          {/* 2. Library View (Mi videoteca) */}
          {currentView === 'library' && (
            <LibraryView
              downloads={downloads}
              onPlay={handlePlayMovie}
              onRemove={handleRemoveDownload}
            />
          )}

          {/* 3. Settings View */}
          {currentView === 'settings' && <SettingsView />}

          {/* 4. Home and Search Views (Common Header + Results) */}
          {(currentView === 'home' || currentView === 'search') && (
            <>
              {/* Header with Search (Only for Home/Search) */}
              <div className="header">
                <div>
                  <h1>{currentView === 'home' ? 'Explorar contenido' : 'Resultados de búsqueda'}</h1>
                  {currentView === 'home' && (
                    <div className="category-tabs">
                      <button
                        className={`tab-btn ${activeCategory === 'peliculas' ? 'active' : ''}`}
                        onClick={() => { setActiveCategory('peliculas'); setCurrentPage(1); }}
                      >
                        Películas
                      </button>
                      <button
                        className={`tab-btn ${activeCategory === 'series' ? 'active' : ''}`}
                        onClick={() => { setActiveCategory('series'); setCurrentPage(1); }}
                      >
                        Series
                      </button>
                      <button
                        className={`tab-btn ${activeCategory === 'documentales' ? 'active' : ''}`}
                        onClick={() => { setActiveCategory('documentales'); setCurrentPage(1); }}
                      >
                        Documentales
                      </button>
                    </div>
                  )}
                </div>
                <div className="search-bar">
                  <Search size={20} />
                  <input
                    type="text"
                    placeholder="Buscar películas o series..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch(e.target.value);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Status Indicators */}
              {(loading || searching) && currentView !== 'library' && (
                <div className="movie-grid">
                  {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              )}
              {error && currentView !== 'library' && <div className="error-message">{error}</div>}

              {/* Home and Search Results */}
              {!searching && !loading && (
                <>
                  <div className="movie-grid">
                    {(currentView === 'home' ? latest : results).map((movie, i) => (
                      <MovieCard key={i} movie={movie} onSelect={handleSelectMovie} />
                    ))}
                  </div>

                  {currentView === 'home' && latest.length > 0 && (
                    <div className="pagination-bar">
                      <button
                        className="page-btn"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      >
                        Anterior
                      </button>
                      <span className="page-indicator">Página {currentPage}</span>
                      <button
                        className="page-btn"
                        onClick={() => setCurrentPage(prev => prev + 1)}
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Search Results */}
              {currentView === 'search' && (
                <div className="movie-grid">
                  {results.length > 0 ? (
                    results.map((movie, i) => (
                      <MovieCard key={i} movie={movie} onSelect={handleSelectMovie} />
                    ))
                  ) : !loading && !error && (
                    <div className="empty-state">
                      <p>Busca algo para empezar (ej: "Matrix")</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="footer-spacing" />
        </div>
      </div>
    </FocusContext.Provider>
  );
}

export default App;
