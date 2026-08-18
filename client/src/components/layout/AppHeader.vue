<script setup lang="ts">
import { computed, ref, inject, type Ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useTheme } from '../../composables/useTheme';
import { useUiStore } from '../../stores/ui';
import { useEditorStore } from '../../stores/editor';
import { useRunSubmitStore } from '../../stores/runSubmit';
import { useExamStore } from '../../stores/exam';
import { brand } from '../../config/brand';
import Timer from '../shared/Timer.vue';
import HelpModal from '../shared/HelpModal.vue';
import ConfirmModal from '../shared/ConfirmModal.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { theme, toggleTheme } = useTheme();
const uiStore = useUiStore();
const editorStore = useEditorStore();
const runSubmit = useRunSubmitStore();
const examStore = useExamStore();

function goHome() {
  void router.push('/');
}

const isUpcoming = computed(() => {
  const exam = examStore.activeExam;
  if (!exam) return false;
  return new Date(exam.startTime) > new Date();
});

const emit = defineEmits<{
  (e: 'open-auth'): void;
}>();

function enterContest() {
  if (!examStore.activeExam || isUpcoming.value) return;
  if (!authStore.isAuthenticated) {
    emit('open-auth');
    return;
  }
  void router.push({
    name: 'workspace',
    params: { id: examStore.activeExam.id },
  });
}

function handleLogout() {
  authStore.logout();
  void router.push('/');
}

const timerState = inject<{ isExpired: Ref<boolean> } | null>(
  'timerState',
  null,
);
const isExamExpired = computed(() => timerState?.isExpired.value ?? false);

const canRunSubmit = computed(
  () =>
    route.name === 'workspace' &&
    authStore.isAuthenticated &&
    editorStore.activeProblemId !== null &&
    !isExamExpired.value,
);

// ── Workspace actions ────────────────────────────────────────────────────────
const showSubmitConfirm = ref(false);

function confirmAndSubmit() {
  showSubmitConfirm.value = false;
  runSubmit.submit();
}

async function handleExitExam() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch {
    /* ignore */
  }
  router.push('/');
}
</script>

<template>
  <header class="header">
    <!-- Left: Logo + exam context -->
    <div class="flex items-center gap-3 min-w-0">
      <button class="logo-btn" @click="goHome">
        <img
          :src="brand.logoPath"
          :alt="brand.appName"
          class="h-7 object-contain"
          style="filter: drop-shadow(0 0 6px rgb(var(--color-primary) / 0.5))"
        />
      </button>

      <!-- Workspace context: divider + exam title + timer -->
      <template v-if="route.name === 'workspace'">
        <div class="hidden md:flex items-center gap-3 min-w-0">
          <div class="w-px h-5 bg-slate-200 dark:bg-white/[0.08]" />
          <span
            class="text-[13px] font-semibold text-slate-800 dark:text-white truncate max-w-[200px]"
          >
            {{ examStore.activeExam?.title ?? '&mdash;' }}
          </span>
          <Timer />
        </div>
      </template>

      <!-- Landing nav -->
      <nav
        v-if="route.path === '/'"
        class="hidden md:flex items-center gap-8 ml-4"
      >
        <slot name="nav"></slot>
      </nav>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-1.5">
      <!-- Enter Contest button (home only, when exam is active and started) -->
      <button
        v-if="route.path === '/' && examStore.activeExam && !isUpcoming"
        class="hidden md:flex items-center px-5 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all active:scale-95"
        @click="enterContest"
      >
        Enter Contest
      </button>

      <!-- Run / Submit (workspace + code editor tab + problem selected) -->
      <div
        v-if="route.name === 'workspace'"
        data-tour="run-submit-area"
        class="flex items-center gap-1.5"
      >
        <button
          data-tour="btn-run"
          class="action-btn"
          :class="
            runSubmit.running
              ? 'action-btn--disabled'
              : canRunSubmit && uiStore.activeTab === 'code-editor'
                ? 'action-btn--run'
                : 'action-btn--disabled'
          "
          :disabled="
            !canRunSubmit ||
            uiStore.activeTab !== 'code-editor' ||
            runSubmit.running ||
            runSubmit.submitting ||
            runSubmit.alreadySolved ||
            !authStore.isAuthenticated
          "
          @click="runSubmit.run()"
        >
          <span
            class="material-symbols-outlined text-[15px]"
            :class="{ 'animate-pulse': runSubmit.running }"
            >play_arrow</span
          >
          {{ runSubmit.running ? 'Running…' : 'Run' }}
        </button>
        <span
          v-if="runSubmit.alreadySolved"
          class="action-btn action-btn--solved"
        >
          <span class="material-symbols-outlined text-[15px]"
            >check_circle</span
          >
          Solved
        </span>
        <button
          v-else
          data-tour="btn-submit"
          class="action-btn"
          :class="
            runSubmit.submitting
              ? 'action-btn--disabled'
              : canRunSubmit && uiStore.activeTab === 'code-editor'
                ? 'action-btn--submit'
                : 'action-btn--disabled'
          "
          :disabled="
            !canRunSubmit ||
            uiStore.activeTab !== 'code-editor' ||
            runSubmit.running ||
            runSubmit.submitting ||
            !authStore.isAuthenticated
          "
          @click="showSubmitConfirm = true"
        >
          <span
            class="material-symbols-outlined text-[15px]"
            :class="{ 'animate-pulse': runSubmit.submitting }"
            >upload</span
          >
          {{ runSubmit.submitting ? 'Submitting…' : 'Submit' }}
        </button>
        <div class="w-px h-5 bg-slate-200 dark:bg-white/[0.08] mx-0.5"></div>
      </div>



      <!-- Exit Exam button (workspace only) -->
      <button
        v-if="route.name === 'workspace'"
        class="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-all cursor-pointer"
        title="Exit exam workspace"
        @click="handleExitExam"
      >
        <span class="material-symbols-outlined text-[15px]">logout</span>
        Exit Exam
      </button>

      <!-- Theme toggle -->
      <button
        class="icon-btn"
        :title="
          theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
        "
        @click="toggleTheme"
      >
        <span class="material-symbols-outlined text-[18px]">{{
          theme === 'dark' ? 'light_mode' : 'dark_mode'
        }}</span>
      </button>

      <!-- User avatar & Logout -->
      <div
        v-if="authStore.user"
        class="flex items-center gap-2 ml-1 pl-2 border-l border-slate-200 dark:border-white/[0.08]"
      >
        <div class="avatar">
          {{ authStore.user.firstName?.charAt(0) || 'U' }}
        </div>
        <span
          class="text-[11px] text-slate-500 dark:text-slate-400 hidden lg:inline font-medium"
        >
          {{ authStore.user.firstName }}
        </span>
        <button
          class="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-red-400 transition-colors ml-1 cursor-pointer"
          title="Log out"
          @click="handleLogout"
        >
          <span class="material-symbols-outlined text-[15px]">logout</span>
          <span class="hidden sm:inline">Logout</span>
        </button>
      </div>

      <!-- Student Sign In button (when unauthenticated on home page) -->
      <button
        v-else-if="route.path === '/'"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 text-primary text-xs font-bold hover:bg-primary/10 transition-all cursor-pointer ml-1"
        @click="emit('open-auth')"
      >
        <span class="material-symbols-outlined text-[15px]">login</span>
        Sign In
      </button>

      <!-- Mobile hamburger (home only) -->
      <slot name="mobile-toggle"></slot>
    </div>
  </header>
  <HelpModal v-if="uiStore.helpModalVisible" />

  <ConfirmModal
    v-if="showSubmitConfirm"
    title="Submit Solution?"
    message="Every wrong submission costs you penalty points. Make sure you've tested your code with Run first."
    confirm-label="Submit"
    :danger="true"
    @confirm="confirmAndSubmit"
    @cancel="showSubmitConfirm = false"
  />
</template>

<style scoped>
/* ── Header shell ── */
.header {
  @apply flex items-center justify-between h-12 px-4
         border-b border-slate-200 dark:border-white/[0.06]
         bg-white dark:bg-[#0d1117] flex-shrink-0 z-50;
}

/* ── Logo ── */
.logo-btn {
  @apply flex items-center cursor-pointer flex-shrink-0
         opacity-90 hover:opacity-100 transition-opacity;
}

/* ── Action buttons (Run / Submit) ── */
.action-btn {
  @apply flex items-center gap-1.5 px-3 py-1.5 rounded-md
         text-[12px] font-semibold transition-all;
}
.action-btn--run {
  @apply bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20
         border border-emerald-500/[0.15];
}
.action-btn--submit {
  @apply bg-primary/10 text-primary hover:bg-primary/20
         border border-primary/[0.15];
}
.action-btn--solved {
  @apply bg-emerald-500/10 text-emerald-400 border border-emerald-500/[0.15] cursor-default;
}
.action-btn--disabled {
  @apply bg-slate-100 dark:bg-white/[0.03] text-slate-400 dark:text-slate-500
         cursor-not-allowed border border-slate-200 dark:border-white/[0.04];
}

/* ── Icon buttons ── */
.icon-btn {
  @apply relative flex items-center justify-center w-8 h-8 rounded-md
         text-slate-400 dark:text-slate-500
         hover:text-slate-700 dark:hover:text-slate-300
         hover:bg-slate-100 dark:hover:bg-white/[0.06]
         transition-all cursor-pointer;
}
.icon-btn--active {
  @apply bg-primary/10 text-primary;
}

/* ── User avatar ── */
.avatar {
  @apply w-7 h-7 rounded-md bg-primary/15 text-primary
         flex items-center justify-center text-[11px] font-bold;
}

/* ── Clipboard dropdown ── */
.clipboard-dropdown {
  @apply absolute right-0 top-full mt-2 w-72
         bg-white dark:bg-[#161b22]
         border border-slate-200 dark:border-white/[0.08] rounded-lg
         shadow-2xl z-50 overflow-hidden;
}

/* ── Dropdown animation ── */
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
