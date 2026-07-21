import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ThemeMode } from '../hooks/useTheme';
import startupSoundSrc from '../assets/audio/soflia-startup.mp3';

const LOGO_SRC = './assets/Icono.png';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const STARTUP_SOUND_VOLUME = 0.62;
const STARTUP_SOUND_VISUAL_DURATION = 4.05;

let startupIntroAudioStarted = false;
let startupIntroAudioPending = false;

type StartupColorScheme = 'light' | 'dark';
export type StartupLogoExitTarget = 'login' | 'workspace-left' | 'workspace-right' | 'workspace-bottom';

type LogoExitPose = {
  x: number | string;
  y: number | string;
  scale: number;
  duration: number;
};

function getLogoExitPose(exitTarget: StartupLogoExitTarget): LogoExitPose {
  switch (exitTarget) {
    case 'workspace-left':
      return { x: 'calc(-50vw + 33px)', y: 'calc(-50vh + 34px)', scale: 0.13, duration: 1.05 };
    case 'workspace-right':
      return { x: 'calc(50vw - 219px)', y: 'calc(-50vh + 34px)', scale: 0.13, duration: 1.05 };
    case 'workspace-bottom':
      return { x: 'calc(-50vw + 35px)', y: 'calc(50vh - 31px)', scale: 0.105, duration: 1.05 };
    case 'login':
    default:
      return { x: 0, y: '-22vh', scale: 0.29, duration: 0.95 };
  }
}

function getResolvedStartupScheme(themeMode: ThemeMode): StartupColorScheme {
  if (themeMode === 'light' || themeMode === 'dark') return themeMode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function useResolvedStartupScheme(themeMode: ThemeMode): StartupColorScheme {
  const [colorScheme, setColorScheme] = useState<StartupColorScheme>(() => getResolvedStartupScheme(themeMode));

  useEffect(() => {
    setColorScheme(getResolvedStartupScheme(themeMode));

    if (themeMode !== 'system' || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      setColorScheme(mediaQuery.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [themeMode]);

  return colorScheme;
}

function useStartupIntroAudio(enabled: boolean): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled || startupIntroAudioStarted || startupIntroAudioPending || typeof Audio === 'undefined') return undefined;

    let cancelled = false;
    startupIntroAudioPending = true;
    const audio = new Audio(startupSoundSrc);
    audioRef.current = audio;
    audio.preload = 'auto';
    audio.muted = false;
    audio.volume = STARTUP_SOUND_VOLUME;
    audio.currentTime = 0;
    audio.setAttribute('playsinline', 'true');
    audio.load();

    const releaseAudio = () => {
      if (audioRef.current === audio) audioRef.current = null;
    };

    audio.addEventListener('ended', releaseAudio, { once: true });
    audio.addEventListener('error', releaseAudio, { once: true });

    const playTimer = window.setTimeout(() => {
      if (cancelled) return;
      void audio.play()
        .then(() => {
          startupIntroAudioStarted = true;
          startupIntroAudioPending = false;
        })
        .catch((error) => {
          startupIntroAudioPending = false;
          console.info('[Startup] El audio de intro no se pudo reproducir automaticamente:', error);
          releaseAudio();
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(playTimer);
      if (!startupIntroAudioStarted) {
        startupIntroAudioPending = false;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        releaseAudio();
      }
    };
  }, [enabled]);
}

function StartupStage({ colorScheme, isExiting, reducedMotion }: { colorScheme: StartupColorScheme; isExiting: boolean; reducedMotion: boolean }) {
  const isDark = colorScheme === 'dark';
  const stageExitTransition = { duration: reducedMotion ? 0.16 : 0.42, delay: reducedMotion ? 0 : 0.48, ease: 'easeOut' } as const;
  const background = isDark
    ? [
      'radial-gradient(circle at 50% 42%, rgba(0,212,179,0.18) 0%, rgba(3,22,25,0.92) 36%, rgba(7,10,16,0.98) 74%, #06080d 100%)',
      'linear-gradient(135deg, #111820 0%, #080b11 48%, #030508 100%)',
    ].join(', ')
    : [
      'radial-gradient(circle at 50% 42%, rgba(255,255,255,0.98) 0%, rgba(247,252,251,0.96) 30%, rgba(226,238,237,0.9) 68%, rgba(206,221,221,0.88) 100%)',
      'linear-gradient(135deg, #fbfdfc 0%, #edf5f4 48%, #dbe8e8 100%)',
    ].join(', ');
  const brandGlow = isDark
    ? 'radial-gradient(circle, rgba(0,212,179,0.28) 0%, rgba(0,109,130,0.16) 34%, transparent 72%)'
    : 'radial-gradient(circle, rgba(0,212,179,0.18) 0%, rgba(0,212,179,0.08) 34%, transparent 70%)';
  const ringShadow = isDark ? '0 28px 120px rgba(0, 212, 179, 0.12)' : '0 28px 120px rgba(0, 43, 68, 0.16)';
  const ringBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.70)';
  const sweep = isDark
    ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)'
    : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)';

  return (
    <>
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background }}
        animate={{ opacity: isExiting ? 0 : 1 }}
        transition={isExiting ? stageExitTransition : { duration: 0.2, ease: 'easeOut' }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: brandGlow }}
        initial={{ opacity: 0, scale: 0.78 }}
        animate={isExiting ? { opacity: 0, scale: 1 } : reducedMotion ? { opacity: 0.44, scale: 1 } : { opacity: [0, 0.58, 0.36], scale: [0.78, 1.08, 1] }}
        transition={isExiting ? stageExitTransition : { duration: reducedMotion ? 0.45 : 1.85, ease: EASE_OUT_EXPO }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[18rem] w-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: ringBorder, boxShadow: ringShadow }}
        initial={{ opacity: 0, scale: 0.72 }}
        animate={isExiting ? { opacity: 0, scale: 1.32 } : reducedMotion ? { opacity: 0.34, scale: 1 } : { opacity: [0, 0.42, 0], scale: [0.72, 1.22, 1.38] }}
        transition={isExiting ? stageExitTransition : { duration: reducedMotion ? 0.45 : 2.2, delay: 0.16, ease: EASE_OUT_EXPO }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-24 -translate-x-1/2 blur-2xl"
        style={{ background: sweep }}
        initial={{ opacity: 0, x: '-38vw', skewX: -12 }}
        animate={isExiting ? { opacity: 0, x: '38vw', skewX: -12 } : reducedMotion ? { opacity: 0 } : { opacity: [0, 0.52, 0], x: '38vw', skewX: -12 }}
        transition={isExiting ? stageExitTransition : { duration: 1.9, delay: 0.22, ease: 'easeInOut' }}
      />
    </>
  );
}

function LogoIgnition({ colorScheme, exitTarget, isExiting, reducedMotion }: { colorScheme: StartupColorScheme; exitTarget: StartupLogoExitTarget; isExiting: boolean; reducedMotion: boolean }) {
  const exitPose = getLogoExitPose(exitTarget);
  const logoFilter = colorScheme === 'dark'
    ? 'drop-shadow(0 34px 72px rgba(0, 212, 179, 0.18)) drop-shadow(0 18px 42px rgba(0, 0, 0, 0.56))'
    : 'drop-shadow(0 34px 70px rgba(0, 34, 58, 0.24))';

  return (
    <motion.div
      className="relative flex h-64 w-64 items-center justify-center"
      initial={{ opacity: 0, y: 12, scale: 0.82, filter: 'blur(14px)' }}
      animate={
        isExiting
          ? reducedMotion
            ? { opacity: 0, filter: 'blur(0px)' }
            : { opacity: 1, x: exitPose.x, y: exitPose.y, scale: exitPose.scale, filter: 'blur(0px)' }
          : reducedMotion
          ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
          : { opacity: 1, y: 0, scale: [0.82, 1.035, 1], filter: 'blur(0px)' }
      }
      transition={isExiting ? { duration: reducedMotion ? 0.2 : exitPose.duration, ease: EASE_OUT_EXPO } : { duration: reducedMotion ? 0.45 : 1.45, ease: EASE_OUT_EXPO }}
    >
      <motion.div
        aria-hidden="true"
        className="absolute h-48 w-48 rounded-full blur-3xl"
        style={{ background: colorScheme === 'dark' ? 'rgba(0, 212, 179, 0.12)' : 'rgba(255, 255, 255, 0.70)' }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: reducedMotion ? 0.42 : [0, 0.62, 0.42, 0.56, 0.44], scale: reducedMotion ? 1 : [0.8, 1.2, 1, 1.08, 1] }}
        transition={{ duration: reducedMotion ? 0.45 : STARTUP_SOUND_VISUAL_DURATION, delay: 0.12, ease: EASE_OUT_EXPO }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute h-52 w-52 rounded-full border"
        style={{ borderColor: colorScheme === 'dark' ? 'rgba(0, 212, 179, 0.22)' : 'rgba(0, 112, 128, 0.16)' }}
        initial={{ opacity: 0, scale: 0.82 }}
        animate={isExiting || reducedMotion ? { opacity: 0, scale: 1 } : { opacity: [0, 0, 0.26, 0], scale: [0.82, 0.92, 1.18, 1.34] }}
        transition={{ duration: STARTUP_SOUND_VISUAL_DURATION, times: [0, 0.58, 0.8, 1], ease: EASE_OUT_EXPO }}
      />

      <motion.img
        src={LOGO_SRC}
        alt="SofLIA"
        className="relative h-56 w-56 object-contain"
        style={{ filter: logoFilter }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: reducedMotion ? 0.3 : 0.84,
          delay: 0.18,
          ease: 'easeOut',
          layout: { duration: reducedMotion ? 0.2 : 0.95, ease: EASE_OUT_EXPO },
        }}
      />
    </motion.div>
  );
}

export function AppLoadingScreen({
  isExiting = false,
  isOrbWindow,
  logoExitTarget = 'login',
  themeMode = 'system',
  playIntroSound = true,
}: {
  isExiting?: boolean;
  isOrbWindow: boolean;
  logoExitTarget?: StartupLogoExitTarget;
  themeMode?: ThemeMode;
  playIntroSound?: boolean;
}) {
  const reducedMotion = Boolean(useReducedMotion());
  const colorScheme = useResolvedStartupScheme(themeMode);
  const baseBackground = colorScheme === 'dark' ? '#080b11' : '#f4faf9';
  const exitDuration = getLogoExitPose(logoExitTarget).duration;
  useStartupIntroAudio(playIntroSound && !isOrbWindow && !isExiting);

  return (
    <motion.main
      className="fixed inset-0 z-[80] flex h-screen w-screen items-center justify-center overflow-hidden"
      style={{ background: isOrbWindow ? 'transparent' : baseBackground, pointerEvents: isExiting ? 'none' : 'auto' }}
      role="status"
      aria-live="polite"
      initial={false}
      animate={isExiting ? { opacity: 0, scale: 1, filter: 'none' } : { opacity: 1, scale: 1, filter: 'none' }}
      transition={
        isExiting
          ? { duration: reducedMotion ? 0.16 : 0.2, delay: reducedMotion ? 0 : Math.max(0, exitDuration - 0.2), ease: 'easeOut' }
          : { duration: reducedMotion ? 0.2 : exitDuration, ease: EASE_OUT_EXPO }
      }
    >
      {!isOrbWindow && <StartupStage colorScheme={colorScheme} isExiting={isExiting} reducedMotion={reducedMotion} />}

      <motion.section
        className="relative flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 1 }}
        transition={{ duration: reducedMotion ? 0.2 : exitDuration, ease: EASE_OUT_EXPO }}
      >
        <span className="sr-only">Iniciando SofLIA Hub</span>
        <LogoIgnition colorScheme={colorScheme} exitTarget={logoExitTarget} isExiting={isExiting} reducedMotion={reducedMotion} />
      </motion.section>
    </motion.main>
  );
}
