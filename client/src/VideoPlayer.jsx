import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import {
    Play, Pause, SkipBack, SkipForward, ArrowLeft,
    Volume2, VolumeX, Volume1, Maximize2
} from 'lucide-react';

const ControlButton = ({ children, onEnter, focusKey, title }) => {
    const { ref, focused } = useFocusable({
        onEnterPress: onEnter,
        focusKey
    });

    return (
        <button
            ref={ref}
            className={`control-btn ${focused ? 'focused' : ''}`}
            onClick={onEnter}
            title={title}
        >
            {children}
        </button>
    );
};

const VideoPlayer = ({ src, movie, onBack }) => {
    const videoRef = useRef(null);
    const volumeSliderRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [currentTime, setCurrentTime] = useState('00:00');
    const [duration, setDuration] = useState('--:--');
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isBuffering, setIsBuffering] = useState(true);
    const [fileName, setFileName] = useState('');
    const [torrentStatus, setTorrentStatus] = useState(null);
    const controlsTimeout = useRef(null);
    const isDraggingVolume = useRef(false);

    const { ref, focusKey, focusSelf } = useFocusable();

    // Connect to SSE for torrent status
    useEffect(() => {
        if (!movie || !movie.link) return;

        let evtSource;
        // We first need the magnet link again or pass it directly.
        // Assuming we have the src url, we can extract the magnet from it or pass it as prop
        let magnetUrl = new URL(src).searchParams.get('magnet');

        if (magnetUrl) {
            evtSource = new EventSource(`http://localhost:3001/api/stream-status?magnet=${encodeURIComponent(magnetUrl)}`);
            evtSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.status !== 'starting') {
                        setTorrentStatus(data);
                    }
                } catch (e) { }
            };
        }

        return () => {
            if (evtSource) evtSource.close();
        }
    }, [src, movie]);

    const resetControlsTimeout = useCallback(() => {
        setShowControls(true);
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        controlsTimeout.current = setTimeout(() => setShowControls(false), 5000);
    }, []);

    useEffect(() => {
        focusSelf();
        resetControlsTimeout();
        return () => {
            if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        };
    }, [focusSelf, resetControlsTimeout]);

    // Extract filename from src URL to show info
    useEffect(() => {
        try {
            const url = new URL(src);
            setFileName('Cargando metadatos...');
        } catch (e) { }
    }, [src]);

    const applyVolume = useCallback((newVol) => {
        const clamped = Math.max(0, Math.min(1, newVol));
        setVolume(clamped);
        setIsMuted(clamped === 0);
        if (videoRef.current) {
            videoRef.current.volume = clamped;
            videoRef.current.muted = clamped === 0;
        }
    }, []);

    const changeVolume = (delta) => {
        applyVolume(volume + delta);
        resetControlsTimeout();
    };

    const toggleMute = () => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        if (videoRef.current) {
            videoRef.current.muted = newMuted;
        }
        resetControlsTimeout();
    };

    // Volume slider interaction
    const handleVolumeSliderClick = (e) => {
        const rect = volumeSliderRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, x / rect.width));
        applyVolume(ratio);
        resetControlsTimeout();
    };

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '--:--';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const parts = [m, s].map(v => String(v).padStart(2, '0'));
        if (h > 0) parts.unshift(String(h).padStart(2, '0'));
        return parts.join(':');
    };

    const handleTimeUpdate = () => {
        const video = videoRef.current;
        if (!video || isNaN(video.duration)) return;
        const cur = video.currentTime;
        const tot = video.duration;
        setProgress((cur / tot) * 100);
        setCurrentTime(formatTime(cur));
        setDuration(formatTime(tot));

        // Buffered range
        if (video.buffered.length > 0) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            setBuffered((bufferedEnd / tot) * 100);
        }
    };

    const handleProgressClick = (e) => {
        const video = videoRef.current;
        if (!video || isNaN(video.duration)) return;
        const bar = e.currentTarget;
        const rect = bar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, x / rect.width));
        video.currentTime = ratio * video.duration;
        resetControlsTimeout();
    };

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(console.error);
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
        resetControlsTimeout();
    };

    const skip = (amount) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime += amount;
        resetControlsTimeout();
    };

    const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

    return (
        <FocusContext.Provider value={focusKey}>
            <div
                ref={ref}
                className={`player-container ${showControls ? 'controls-visible' : ''}`}
                onMouseMove={resetControlsTimeout}
                onKeyDown={(e) => {
                    if (e.key === ' ') { togglePlay(); e.preventDefault(); }
                    if (e.key === 'ArrowLeft') skip(-10);
                    if (e.key === 'ArrowRight') skip(10);
                    if (e.key === 'ArrowUp') changeVolume(0.1);
                    if (e.key === 'ArrowDown') changeVolume(-0.1);
                    if (e.key === 'm' || e.key === 'M') toggleMute();
                }}
                tabIndex={0}
            >
                <video
                    ref={videoRef}
                    src={src}
                    autoPlay
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => { setIsPlaying(true); setIsBuffering(false); }}
                    onPause={() => setIsPlaying(false)}
                    onWaiting={() => setIsBuffering(true)}
                    onCanPlay={() => setIsBuffering(false)}
                    onClick={togglePlay}
                    onError={(e) => console.error('Video error:', e.target.error)}
                    onLoadedMetadata={() => {
                        const video = videoRef.current;
                        if (video) setDuration(formatTime(video.duration));
                    }}
                />

                {/* Buffering spinner */}
                {isBuffering && (
                    <div className="buffering-overlay">
                        <div className="buffering-spinner" />
                    </div>
                )}

                {/* Top bar */}
                <div className={`player-top-bar ${showControls ? 'visible' : ''}`}>
                    <button className="back-btn" onClick={onBack}>
                        <ArrowLeft size={18} /> Volver
                    </button>

                    {movie && (
                        <div className="player-title-bar">
                            <span className="title-main">{movie.title}</span>
                            <span className="title-meta">
                                {[
                                    movie.year,
                                    movie.genre,
                                    movie.format,
                                    torrentStatus ? `👇 ${(torrentStatus.progress * 100).toFixed(1)}%` : null,
                                    torrentStatus ? `🌱 ${torrentStatus.numPeers} peers` : null,
                                    torrentStatus ? `🚀 ${(torrentStatus.downloadSpeed / 1024 / 1024).toFixed(2)} MB/s` : null
                                ].filter(Boolean).join(' · ')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Bottom controls */}
                <div className="player-controls">
                    {/* Progress bar */}
                    <div className="progress-container" onClick={handleProgressClick}>
                        <div className="progress-bar">
                            <div className="progress-buffered" style={{ width: `${buffered}%` }} />
                            <div className="progress-filled" style={{ width: `${progress}%` }}>
                                <div className="progress-thumb" />
                            </div>
                        </div>
                    </div>

                    <div className="controls-bottom">
                        {/* Left controls */}
                        <div className="controls-left">
                            <ControlButton onEnter={togglePlay} title={isPlaying ? 'Pausa' : 'Reproducir'}>
                                {isPlaying ? <Pause size={28} /> : <Play size={28} />}
                            </ControlButton>

                            <ControlButton onEnter={() => skip(-10)} title="-10s">
                                <SkipBack size={22} />
                            </ControlButton>

                            <ControlButton onEnter={() => skip(10)} title="+10s">
                                <SkipForward size={22} />
                            </ControlButton>

                            {/* Volume controls */}
                            <div className="volume-group">
                                <ControlButton onEnter={toggleMute} title="Silenciar">
                                    <VolumeIcon size={22} />
                                </ControlButton>
                                <div
                                    ref={volumeSliderRef}
                                    className="volume-slider"
                                    onClick={handleVolumeSliderClick}
                                >
                                    <div className="volume-track">
                                        <div className="volume-filled" style={{ width: `${isMuted ? 0 : volume * 100}%` }} />
                                        <div className="volume-thumb" style={{ left: `${isMuted ? 0 : volume * 100}%` }} />
                                    </div>
                                </div>
                            </div>

                            <span className="time-info">{currentTime} / {duration}</span>
                        </div>

                        {/* Right controls */}
                        <div className="controls-right">
                            <ControlButton onEnter={() => {
                                if (document.fullscreenElement) document.exitFullscreen();
                                else document.documentElement.requestFullscreen();
                            }} title="Pantalla completa">
                                <Maximize2 size={22} />
                            </ControlButton>
                        </div>
                    </div>
                </div>
            </div>
        </FocusContext.Provider>
    );
};

export default VideoPlayer;
