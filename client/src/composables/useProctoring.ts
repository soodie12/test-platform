import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import api from '../services/api';
import { useToastStore } from '../stores/toast';

export const ProctoringEventType = {
  FULLSCREEN_EXIT: 'FULLSCREEN_EXIT',
  TAB_SWITCH: 'TAB_SWITCH',
  WINDOW_BLUR: 'WINDOW_BLUR',
  PASTE_ATTEMPT: 'PASTE_ATTEMPT',
  COPY_ATTEMPT: 'COPY_ATTEMPT',
} as const;

export type ProctoringEventType = (typeof ProctoringEventType)[keyof typeof ProctoringEventType];

export function useProctoring(
  examId: Ref<number | undefined>,
  options: {
    requireFullscreen?: boolean;
    trackTabSwitches?: boolean;
    blockCopyPaste?: boolean;
  } = {},
) {
  const toastStore = useToastStore();
  const isFullscreen = ref(true);
  const violationCount = ref(0);
  const isAway = ref(false);
  const requireFullscreen = ref(options.requireFullscreen ?? true);
  const trackTabSwitches = ref(options.trackTabSwitches ?? true);
  const blockCopyPaste = ref(options.blockCopyPaste ?? true);

  let isArmed = false;
  let lastViolationTime = 0;

  function checkFullscreenState() {
    if (!isArmed) return;

    const fsElement =
      document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
      (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement;

    const currentlyFs = !!fsElement;
    isFullscreen.value = currentlyFs;

    if (!currentlyFs && requireFullscreen.value) {
      logViolation(ProctoringEventType.FULLSCREEN_EXIT, {
        reason: 'Student exited fullscreen mode',
      });
    }
  }

  async function requestFullscreen() {
    try {
      const elem = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
      };
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      }
      isFullscreen.value = true;
      isArmed = true;
    } catch (e) {
      console.warn('[proctoring] Failed to enter fullscreen:', e);
    }
  }

  async function exitFullscreen() {
    isArmed = false;
    isFullscreen.value = true;
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }

  function disarmProctoring() {
    isArmed = false;
    isFullscreen.value = true;
  }

  function logViolation(type: ProctoringEventType, metadata?: Record<string, unknown>) {
    if (!isArmed) return;

    const now = Date.now();
    if (now - lastViolationTime < 1500) return;
    lastViolationTime = now;

    violationCount.value++;

    if (type === ProctoringEventType.TAB_SWITCH) {
      toastStore.add(
        'error',
        `Proctoring Warning: Tab switch recorded! (Violation #${violationCount.value})`,
      );
    } else if (type === ProctoringEventType.FULLSCREEN_EXIT) {
      toastStore.add(
        'error',
        `Proctoring Warning: Exited fullscreen mode! (Violation #${violationCount.value})`,
      );
    } else if (type === ProctoringEventType.PASTE_ATTEMPT) {
      toastStore.add(
        'error',
        `Proctoring Warning: External paste is disabled! (Violation #${violationCount.value})`,
      );
    } else if (type === ProctoringEventType.COPY_ATTEMPT) {
      toastStore.add(
        'error',
        `Proctoring Warning: Copying text is disabled! (Violation #${violationCount.value})`,
      );
    }

    if (examId.value) {
      void api.post('/proctoring/log', {
        examId: examId.value,
        eventType: type,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        },
      }).catch((err) => console.warn('[proctoring] Failed to persist log', err));
    }
  }

  function handleVisibilityChange() {
    if (!trackTabSwitches.value || !isArmed) return;

    if (document.hidden) {
      isAway.value = true;
      logViolation(ProctoringEventType.TAB_SWITCH, {
        reason: 'Document hidden (tab switched or window minimized)',
      });
    } else {
      isAway.value = false;
    }
  }

  function handleBlur() {
    if (!trackTabSwitches.value || !isArmed) return;
    logViolation(ProctoringEventType.WINDOW_BLUR, {
      reason: 'Browser window lost focus',
    });
  }

  function handlePaste(e: ClipboardEvent) {
    if (!blockCopyPaste.value || !isArmed) return;
    e.preventDefault();
    logViolation(ProctoringEventType.PASTE_ATTEMPT, {
      reason: 'Attempted to paste content',
    });
  }

  function handleCopy(e: ClipboardEvent) {
    if (!blockCopyPaste.value || !isArmed) return;
    e.preventDefault();
    logViolation(ProctoringEventType.COPY_ATTEMPT, {
      reason: 'Attempted to copy content',
    });
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', checkFullscreenState);
    document.addEventListener('webkitfullscreenchange', checkFullscreenState);
    document.addEventListener('mozfullscreenchange', checkFullscreenState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCopy, true);

    void requestFullscreen().then(() => {
      setTimeout(() => {
        isArmed = true;
        checkFullscreenState();
      }, 500);
    });
  });

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', checkFullscreenState);
    document.removeEventListener('webkitfullscreenchange', checkFullscreenState);
    document.removeEventListener('mozfullscreenchange', checkFullscreenState);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('paste', handlePaste, true);
    document.removeEventListener('copy', handleCopy, true);
    document.removeEventListener('cut', handleCopy, true);
  });

  return {
    isFullscreen,
    violationCount,
    isAway,
    requireFullscreen,
    trackTabSwitches,
    requestFullscreen,
    exitFullscreen,
    disarmProctoring,
  };
}
