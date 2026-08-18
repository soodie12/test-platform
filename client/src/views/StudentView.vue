<script setup lang="ts">
import {
  provide,
  onMounted,
  onUnmounted,
  ref,
  computed,
  watch,
  nextTick,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppHeader from '../components/layout/AppHeader.vue';
import WorkspaceSidebar from '../components/layout/WorkspaceSidebar.vue';
import Sidebar from '../components/layout/Sidebar.vue';
import BottomPanel from '../components/layout/BottomPanel.vue';
import WelcomeBanner from '../components/shared/WelcomeBanner.vue';
import Toast from '../components/shared/Toast.vue';
import SuccessModal from '../components/shared/SuccessModal.vue';
import FullscreenOverlay from '../components/shared/FullscreenOverlay.vue';
import ApiDocs from '../components/tabs/ApiDocs.vue';
import ApiClient from '../components/tabs/ApiClient.vue';
import CodeEditor from '../components/tabs/CodeEditor.vue';
import McqSection from '../components/student/McqSection.vue';
import api from '../services/api';
import type { Problem } from '../types';
import { useUiStore } from '../stores/ui';
import { useExamStore } from '../stores/exam';
import { useRunSubmitStore } from '../stores/runSubmit';
import { useEditorStore } from '../stores/editor';
import { useProblemsStore } from '../stores/problems';
import { useResizable } from '../composables/useResizable';
import { useProctoring } from '../composables/useProctoring';
import { useAutosave } from '../composables/useAutosave';
import { useTimer } from '../composables/useTimer';
import { useCelebration } from '../composables/useCelebration';

const route = useRoute();
const router = useRouter();
const uiStore = useUiStore();
const examStore = useExamStore();
const runSubmit = useRunSubmitStore();
const editorStore = useEditorStore();
const problemsStore = useProblemsStore();

const successModal = ref<{
  mode: 'submit' | 'run';
  problemTitle: string;
  score: number;
  passedTests: number;
  totalTests: number;
  language: string;
} | null>(null);

watch(
  () => runSubmit.submission,
  (s) => {
    if (
      s?.verdict === 'accepted' &&
      editorStore.activeProblem?.questionType !== 'mcq'
    ) {
      successModal.value = {
        mode: 'submit',
        problemTitle: editorStore.activeProblem?.title ?? '',
        score: s.score,
        passedTests: s.passedTestCases ?? s.passedTests ?? 0,
        totalTests: s.totalTestCases ?? s.totalTests ?? 0,
        language: editorStore.language.name,
      };
    }
  },
);

watch(
  () => runSubmit.runResult,
  (r) => {
    if (
      r &&
      !runSubmit.lastRunHadCustomInput &&
      r.results.length > 0 &&
      r.results.every((x) => x.passed)
    ) {
      successModal.value = {
        mode: 'run',
        problemTitle: editorStore.activeProblem?.title ?? '',
        score: 0,
        passedTests: r.results.length,
        totalTests: r.results.length,
        language: editorStore.language.name,
      };
    }
  },
);

const {
  start: startAutosave,
  stop: stopAutosave,
  forceSave,
  saveStatus,
} = useAutosave();
provide('saveStatus', saveStatus);
provide('forceSave', forceSave);

const {
  remaining,
  isWarning,
  isCritical,
  isExpired,
  start: startTimer,
} = useTimer();
provide('timerState', { remaining, isWarning, isCritical, isExpired });

const celebration = useCelebration();

const activeExamId = computed(() => examStore.activeExam?.id);
const { isFullscreen, requestFullscreen, disarmProctoring } = useProctoring(activeExamId);

const autoSubmitted = ref(false);

watch(isExpired, async (expired) => {
  if (expired) {
    disarmProctoring();
    if (!autoSubmitted.value) {
      autoSubmitted.value = true;
      try {
        if (editorStore.activeProblem?.questionType === 'coding') {
          await runSubmit.submit();
        }
      } catch {
        /* ignore */
      }
      try {
        const routeExamId = Number(route.params.id);
        const examId = examStore.activeExam?.id ?? (isNaN(routeExamId) ? undefined : routeExamId);
        if (examId) {
          await api.post(`/exams/${examId}/exit`, { reason: 'TIME_EXPIRED' });
        }
      } catch {
        /* ignore */
      }
      if (examStore.examStatus) {
        examStore.examStatus.hasExited = true;
      }
    }
  }
});

watch(
  () => examStore.examStatus?.hasExited,
  (exited) => {
    if (exited) {
      disarmProctoring();
    }
  },
  { immediate: true },
);

async function handleExitToHome() {
  disarmProctoring();
  try {
    const routeExamId = Number(route.params.id);
    const examId = examStore.activeExam?.id ?? (isNaN(routeExamId) ? undefined : routeExamId);
    if (examId) {
      await api.post(`/exams/${examId}/exit`, { reason: 'MANUAL_EXIT' });
    }
  } catch {
    /* ignore */
  }
  if (examStore.examStatus) {
    examStore.examStatus.hasExited = true;
  } else {
    examStore.examStatus = { hasExited: true } as any;
  }
  router.push('/');
}

const loading = ref(true);

onMounted(async () => {
  uiStore.setActiveTab('code-editor');
  void editorStore.fetchLanguages();
  await examStore.fetchActiveExam();

  // Ensure selectedExam matches the route param
  const routeExamId = Number(route.params.id);
  if (routeExamId && examStore.selectedExam?.id !== routeExamId) {
    const match = examStore.activeExams.find((e) => e.id === routeExamId);
    if (match) examStore.selectExam(match);
  }

  const examId = examStore.activeExam?.id ?? (isNaN(routeExamId) ? undefined : routeExamId);
  if (examId) {
    await examStore.fetchExamStatus(examId);
    if (examStore.examStatus?.hasExited) {
      loading.value = false;
      return;
    }

    try {
      try {
        await api.post(`/exams/${examId}/enroll`);
      } catch (err: any) {
        if (err?.response?.status === 403) {
          if (examStore.examStatus) {
            examStore.examStatus.hasExited = true;
          }
          loading.value = false;
          return;
        }
        /* already enrolled or other error */
      }

      const { data: list } = await api.get<Problem[]>(
        `/exams/${examId}/problems`,
      );
      if (Array.isArray(list) && list.length > 0) {
        problemsStore.setProblems(list);
        for (const p of list) {
          try {
            const { data: detail } = await api.get<Problem>(
              `/exams/${examId}/problems/${p.id}`,
            );
            problemsStore.cacheProblemDetail(detail);
          } catch {
            /* ignore individual fetch error */
          }
        }
        if (!editorStore.activeProblemId) {
          const first = list[0];
          editorStore.setActiveProblem(
            first.id,
            problemsStore.getProblemDetail(first.id) ?? first,
          );
        }
      }
    } catch (e: any) {
      if (e?.response?.status === 403) {
        if (examStore.examStatus) {
          examStore.examStatus.hasExited = true;
        } else {
          examStore.examStatus = { hasExited: true } as any;
        }
        loading.value = false;
        return;
      }
      console.warn('[workspace] Auto fetch problems failed', e);
    }

    await examStore.fetchMyProgress(examId);
    loading.value = false;
    void startAutosave();
    void startTimer(examId);
  } else {
    loading.value = false;
  }

  // Auto-launch guided tour once per exam
  const tourKey = `tourShown:${examId}`;
  if (examId && !localStorage.getItem(tourKey)) {
    await nextTick();
    setTimeout(async () => {
      const { startTour } = await import('../composables/useTour');
      void startTour();
      localStorage.setItem(tourKey, 'true');
    }, 1000);
  }
});

onUnmounted(() => {
  stopAutosave();
});

const examState = computed(() => {
  if (loading.value) return 'loading';
  if (!examStore.activeExam) return 'no-exam';
  if (examStore.examStatus?.hasExited) return 'exited';
  if (examStore.myProgress?.allSolved) return 'completed';
  if (isExpired.value) return 'ended';
  return 'active';
});

const { onMouseDown: onSidebarDrag } = useResizable('vertical', (delta) => {
  if (uiStore.sidebarCollapsed) return;
  const next = uiStore.sidebarWidth + delta;
  if (next < 40) {
    uiStore.setSidebarCollapsed(true);
  } else {
    uiStore.setSidebarWidth(
      Math.min(Math.max(next, 280), window.innerWidth * 0.6),
    );
  }
});

const { onMouseDown: onBottomDrag } = useResizable('horizontal', (delta) => {
  const next = uiStore.bottomPanelHeight - delta;
  if (next >= 40 && next <= window.innerHeight * 0.7)
    uiStore.setBottomPanelHeight(next);
});
</script>

<template>
  <div
    class="flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark select-none"
    @contextmenu.prevent
  >
    <!-- Shared header -->
    <AppHeader />

    <!-- Loading state -->
    <div
      v-if="examState === 'loading'"
      class="flex flex-1 items-center justify-center state-screen-enter"
    >
      <span
        class="material-symbols-outlined text-4xl text-slate-400 animate-spin"
        >progress_activity</span
      >
    </div>

    <!-- No active exam -->
    <div
      v-else-if="examState === 'no-exam'"
      class="flex flex-1 items-center justify-center state-screen-enter"
    >
      <div class="text-center max-w-sm px-6">
        <span
          class="material-symbols-outlined text-5xl text-slate-400 mb-4 block"
          >event_busy</span
        >
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          No active exam right now
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Check back when an exam is scheduled. You'll be notified when it goes
          live.
        </p>
      </div>
    </div>

    <!-- All problems solved -->
    <div
      v-else-if="examState === 'completed'"
      class="flex flex-1 items-center justify-center state-screen-enter"
    >
      <div class="text-center max-w-sm px-6">
        <span
          class="material-symbols-outlined text-5xl text-emerald-400 mb-4 block trophy-bounce"
          >emoji_events</span
        >
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          You've completed the exam!
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {{ examStore.myProgress?.solvedProblems }} /
          {{ examStore.myProgress?.totalProblems }} problems solved
        </p>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Sit tight, results will be announced after the exam closes.
        </p>
      </div>
      <!-- Celebration toggle button -->
      <button
        class="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 dark:bg-slate-800 border border-white/[0.10] text-white text-sm font-semibold shadow-xl hover:bg-slate-700 transition-colors z-50"
        :title="`Current: ${celebration.mode.value} - click to change`"
        @click="celebration.toggleMode()"
      >
        <span v-if="celebration.mode.value === 'snow'">❄️ Snow</span>
        <span v-else-if="celebration.mode.value === 'fireworks'"
          >🎆 Fireworks</span
        >
        <span v-else-if="celebration.mode.value === 'realistic'"
          >🎊 Realistic</span
        >
        <span v-else-if="celebration.mode.value === 'stars'">⭐ Stars</span>
        <span v-else-if="celebration.mode.value === 'cannon'">🎯 Cannon</span>
        <span v-else-if="celebration.mode.value === 'continuous'"
          >🎉 Continuous</span
        >
        <span v-else-if="celebration.mode.value === 'emoji'">😄 Emoji</span>
      </button>
    </div>

    <!-- Exam exited or ended (timer expired) -->
    <div
      v-else-if="examState === 'ended' || examState === 'exited'"
      class="flex flex-1 items-center justify-center state-screen-enter"
    >
      <div class="text-center max-w-md px-6 py-8 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-surface-dark shadow-2xl">
        <span class="material-symbols-outlined text-6xl text-rose-400 mb-4 block"
          >lock</span
        >
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {{ examState === 'exited' ? 'Exam Exited' : 'Exam Time Expired' }}
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Your exam session has ended and your final submissions have been recorded. Re-entry into this exam is restricted unless granted by an administrator.
        </p>
        <button
          class="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-lg active:scale-95"
          @click="handleExitToHome"
        >
          Exit Workspace
        </button>
      </div>
    </div>

    <!-- Active exam workspace -->
    <template v-else>
      <!-- Banner + body -->
      <WelcomeBanner />

      <div class="flex flex-1 min-h-0 overflow-hidden">
        <!-- Left icon sidebar for tab navigation -->
        <WorkspaceSidebar v-if="!uiStore.editorExpanded" />

        <!-- Tab content area -->
        <div class="flex-1 min-w-0 overflow-hidden">
          <!-- API Docs -->
          <div
            v-show="uiStore.activeTab === 'api-docs'"
            class="h-full overflow-hidden"
          >
            <ApiDocs />
          </div>

          <!-- API Client -->
          <div
            v-show="uiStore.activeTab === 'api-client'"
            class="h-full overflow-hidden"
          >
            <ApiClient />
          </div>

          <!-- Code Editor -->
          <div
            v-show="uiStore.activeTab === 'code-editor'"
            class="h-full overflow-hidden"
          >
            <div class="flex h-full relative">
              <template v-if="!uiStore.editorExpanded">
                <div
                  class="flex-shrink-0 overflow-hidden"
                  :style="{
                    width: uiStore.sidebarCollapsed
                      ? '0px'
                      : uiStore.sidebarWidth + 'px',
                  }"
                >
                  <Sidebar />
                </div>

                <div
                  v-if="!uiStore.sidebarCollapsed"
                  class="w-3 flex-shrink-0 flex items-stretch justify-center cursor-col-resize group"
                  @mousedown="onSidebarDrag"
                >
                  <div
                    class="w-px bg-slate-200 dark:bg-white/[0.06] group-hover:bg-primary/40 transition-colors duration-150"
                  />
                </div>

                <button
                  v-if="uiStore.sidebarCollapsed"
                  class="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1 px-2.5 py-2 bg-slate-900 text-white text-xs font-bold rounded-r-lg shadow-xl border border-l-0 border-slate-700 hover:bg-primary transition-all cursor-pointer"
                  title="Show Question & Problems Panel"
                  @click="uiStore.setSidebarCollapsed(false)"
                >
                  <span class="material-symbols-outlined text-[16px]">chevron_right</span>
                  <span class="hidden sm:inline font-semibold">Question</span>
                </button>
              </template>

              <div
                class="flex-1 flex flex-col min-w-0 overflow-hidden"
                :style="{
                  paddingLeft:
                    !uiStore.editorExpanded && uiStore.sidebarCollapsed
                      ? '18px'
                      : '0',
                }"
              >
                <div class="flex-1 min-h-0 overflow-hidden">
                  <McqSection
                    v-if="editorStore.activeMcqSection"
                    :exam-id="examStore.activeExam?.id ?? 0"
                  />
                  <CodeEditor v-else />
                </div>
                <template
                  v-if="
                    !uiStore.editorExpanded && !editorStore.activeMcqSection
                  "
                >
                  <div
                    class="h-px flex-shrink-0 bg-slate-200 dark:bg-white/[0.06] cursor-row-resize transition-colors hover:bg-primary/40"
                    @mousedown="onBottomDrag"
                  />
                  <div
                    class="flex-shrink-0 overflow-hidden"
                    :style="{ height: uiStore.bottomPanelHeight + 'px' }"
                  >
                    <BottomPanel />
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <SuccessModal
      v-if="successModal"
      v-bind="successModal"
      @close="successModal = null"
      @go-submit="
        successModal = null;
        runSubmit.submit();
      "
    />

    <FullscreenOverlay
      :show="!isFullscreen"
      @enter-fullscreen="requestFullscreen"
    />

    <Toast />
  </div>
</template>

<style scoped>
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.state-screen-enter {
  animation: fade-up 0.25s ease-out both;
}

@keyframes trophy-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-4px);
  }
}
.trophy-bounce {
  animation: trophy-bounce 0.7s ease-out 0.15s both;
}
</style>
