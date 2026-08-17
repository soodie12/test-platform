import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import api from '../services/api';
import { useToastStore } from '../stores/toast';
import { useAuthStore } from '../stores/auth';

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
  const authStore = useAuthStore();
  const isFullscreen = ref(true);
  const violationCount = ref(0);
  const isAway = ref(false);
  const requireFullscreen = ref(options.requireFullscreen ?? true);
  const trackTabSwitches = ref(options.trackTabSwitches ?? true);
  const blockCopyPaste = ref(options.blockCopyPaste ?? true);

  let isArmed = false;

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

const lastGlobalViolationMap: Record<string, number> = {};

  function logViolation(type: ProctoringEventType, metadata?: Record<string, unknown>) {
    if (!isArmed) return;

    const now = Date.now();
    const lastTypeTime = lastGlobalViolationMap[type] || 0;
    if (now - lastTypeTime < 1500) return;
    lastGlobalViolationMap[type] = now;

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

  function clearClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        void navigator.clipboard.writeText('');
      }
    } catch {
      /* ignore */
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!isArmed || authStore.user?.role === 'ADMIN') return;
    // Intercept Windows Clipboard History (Win+V / Ctrl+V with Alt) and Mac Paste Stack
    if (e.code === 'KeyV' && (e.altKey || e.metaKey || e.ctrlKey)) {
      if (e.altKey || e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        clearClipboard();
        logViolation(ProctoringEventType.PASTE_ATTEMPT, {
          reason: 'Attempted to open OS clipboard history',
        });
      }
    }
  }

  function onMonacoPasteBlocked() {
    if (!blockCopyPaste.value || !isArmed) return;
    clearClipboard();
    logViolation(ProctoringEventType.PASTE_ATTEMPT, {
      reason: 'Attempted to paste content in editor',
    });
  }

  function onMonacoCopyBlocked() {
    if (!blockCopyPaste.value || !isArmed) return;
    clearClipboard();
    logViolation(ProctoringEventType.COPY_ATTEMPT, {
      reason: 'Attempted to copy content from editor',
    });
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', checkFullscreenState);
    document.addEventListener('webkitfullscreenchange', checkFullscreenState);
    document.addEventListener('mozfullscreenchange', checkFullscreenState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('proctoring-paste-blocked', onMonacoPasteBlocked);
    window.addEventListener('proctoring-copy-blocked', onMonacoCopyBlocked);

    void requestFullscreen().then(() => {
      setTimeout(() => {
        isArmed = true;
        clearClipboard();
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
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('proctoring-paste-blocked', onMonacoPasteBlocked);
    window.removeEventListener('proctoring-copy-blocked', onMonacoCopyBlocked);
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
