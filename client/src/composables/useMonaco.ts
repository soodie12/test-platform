import {
  shallowRef,
  markRaw,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
  type Ref,
} from 'vue';

import { themeColors } from '../config/theme';
import { useAuthStore } from '../stores/auth';

// Use the minimal editor API entry - avoids pulling in all 100+ language servers
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// Import only the 5 language syntax contributions we actually use
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'; // registers both 'c' and 'cpp'
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';

// Only the base editor worker - no IntelliSense or language servers needed
declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker(_moduleId: string, _label: string): Worker;
    };
  }
}

self.MonacoEnvironment = {
  getWorker() {
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' },
    );
  },
};

let themeRegistered = false;

function registerTheme() {
  if (themeRegistered) return;
  themeRegistered = true;

  monaco.editor.defineTheme('exam-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      {
        token: 'keyword',
        foreground: themeColors.primary.replace('#', ''),
        fontStyle: 'bold',
      },
      { token: 'string', foreground: themeColors.accent.replace('#', '') },
      { token: 'comment', foreground: '5f6368', fontStyle: 'italic' },
      { token: 'number', foreground: 'e4a526' },
      { token: 'type', foreground: '5b8def' },
      { token: 'function', foreground: 'dcdcaa' },
      { token: 'variable', foreground: 'e8eaed' },
      { token: 'operator', foreground: 'e8eaed' },
    ],
    colors: {
      'editor.background': '#0d1011',
      'editor.foreground': '#e8eaed',
      'editor.lineHighlightBackground': '#1a1e1f',
      'editor.selectionBackground': `${themeColors.accent}40`,
      'editorCursor.foreground': themeColors.accent,
      'editorLineNumber.foreground': '#5f6368',
      'editorLineNumber.activeForeground': '#e8eaed',
      'editor.inactiveSelectionBackground': `${themeColors.accent}20`,
      'editorWidget.background': '#141718',
      'editorWidget.border': '#2d3234',
      'input.background': '#0d1011',
      'input.border': '#2d3234',
      'dropdown.background': '#141718',
    },
  });
}

export function useMonaco(
  containerRef: Ref<HTMLElement | null>,
  language: Ref<string>,
  code: Ref<string>,
) {
  const editor = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Tracks the last value we pushed INTO Monaco programmatically.
  // When watch(code) fires, if newVal === lastSetValue the change came FROM
  // Monaco (user typed), so we skip setValue to avoid a cursor-reset loop.
  let lastSetValue = '';

  // Guard: true while we are programmatically calling setValue, so the
  // onDidChangeModelContent listener ignores the resulting event.
  let updatingFromExternal = false;

  let contentDisposable: monaco.IDisposable | null = null;

  onMounted(() => {
    if (!containerRef.value) return;
    registerTheme();

    const authStore = useAuthStore();
    const isAdmin = authStore.user?.role === 'ADMIN';

    lastSetValue = code.value;
    editor.value = markRaw(
      monaco.editor.create(containerRef.value, {
        value: code.value,
        language: language.value,
        theme: 'exam-dark',
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
        padding: { top: 12 },
        lineNumbers: 'on',
        wordWrap: 'off',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        contextmenu: isAdmin,
      }),
    );

    // Only restrict copy/paste & contextmenu for non-admin users (students during exams)
    if (!isAdmin) {
      const handleDomPaste = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('proctoring-paste-blocked'));
      };

      const handleDomCopy = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('proctoring-copy-blocked'));
      };

      const domElem = containerRef.value;
      domElem.addEventListener('paste', handleDomPaste, true);
      domElem.addEventListener('copy', handleDomCopy, true);
      domElem.addEventListener('cut', handleDomCopy, true);
      domElem.addEventListener('contextmenu', (e) => e.preventDefault(), true);

      // Intercept keyboard commands (Ctrl+V, Cmd+V, Ctrl+C, Cmd+C) in Monaco for students
      editor.value.onKeyDown((e) => {
        const isMod = e.ctrlKey || e.metaKey;
        if (isMod && (e.code === 'KeyV' || e.code === 'KeyC' || e.code === 'KeyX')) {
          e.preventDefault();
          e.stopPropagation();
          if (e.code === 'KeyV') {
            window.dispatchEvent(new CustomEvent('proctoring-paste-blocked'));
          } else {
            window.dispatchEvent(new CustomEvent('proctoring-copy-blocked'));
          }
        }
      });
    }

    // Monaco → Vue: user typed something.
    contentDisposable = editor.value.onDidChangeModelContent(() => {
      if (updatingFromExternal) return;
      const val = editor.value!.getValue();
      lastSetValue = val;
      code.value = val;
    });
  });

  // Vue → Monaco: code changed from outside (language switch, problem change,
  // autosave restore). Only sync when the new value is different from what
  // Monaco already has - i.e. not a change that originated from Monaco itself.
  watch(code, (newVal) => {
    if (!editor.value) return;
    // Skip if this change originated from Monaco (user typing)
    if (newVal === lastSetValue) return;
    // Also skip if Monaco already has this exact content
    if (editor.value.getValue() === newVal) {
      lastSetValue = newVal;
      return;
    }
    updatingFromExternal = true;
    lastSetValue = newVal;
    editor.value.setValue(newVal);
    updatingFromExternal = false;
  });

  // Defer setModelLanguage to the next tick so it never runs in the same
  // synchronous batch as setValue - running both together in one tick causes
  // Monaco to process two model mutations without yielding to the browser.
  watch(language, (newLang) => {
    void nextTick(() => {
      if (editor.value) {
        const model = editor.value.getModel();
        if (model) monaco.editor.setModelLanguage(model, newLang);
      }
    });
  });

  onBeforeUnmount(() => {
    contentDisposable?.dispose();
    editor.value?.dispose();
    editor.value = null;
  });

  return { editor };
}
