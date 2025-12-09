import { useCallback, useRef } from 'react';
import popSoundUrl from '../assets/pop.mp3';

// Sound utility hook for playing audio with modulation
export function usePopSound() {
    const audioPoolRef = useRef<HTMLAudioElement[]>([]);
    const poolIndexRef = useRef(0);
    const poolSize = 8; // Allow up to 8 simultaneous sounds

    // Initialize audio pool lazily
    const getAudio = useCallback(() => {
        if (audioPoolRef.current.length === 0) {
            // Create pool of audio elements
            for (let i = 0; i < poolSize; i++) {
                const audio = new Audio(popSoundUrl);
                audio.preload = 'auto';
                audioPoolRef.current.push(audio);
            }
        }
        
        // Get next audio element from pool (round-robin)
        const audio = audioPoolRef.current[poolIndexRef.current];
        poolIndexRef.current = (poolIndexRef.current + 1) % poolSize;
        return audio;
    }, []);

    // Play the pop sound with random modulation
    const playPop = useCallback(() => {
        try {
            const audio = getAudio();
            if(!audio)return console.error('Failed to get audio element');
            
            // Reset if already playing
            audio.currentTime = 0;
            
            // Random volume (0.5 to 1.0)
            audio.volume = 0.5 + Math.random() * 0.5;
            
            // Random playback rate for pitch (0.9 to 1.1)
            audio.playbackRate = 0.8 + Math.random() * 0.4;
            
            // Play the sound
            audio.play().catch(err => {
                // Ignore autoplay policy errors - will work after first user interaction
                console.debug('Audio play failed:', err);
            });
        } catch (error) {
            console.error('Failed to play pop sound:', error);
        }
    }, [getAudio]);

    return { playPop };
}
