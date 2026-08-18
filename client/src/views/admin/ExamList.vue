<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  listExams,
  deleteExam,
  duplicateExam,
  invalidateCachedExams,
  listAccommodations,
  setAccommodation,
  deleteAccommodation,
  listUsers,
  listEnrollments,
  resetCandidateExit,
  type ExamAccommodationEntry,
  type ExamEnrollmentEntry,
} from '../../services/adminApi';
import { getExamStatus } from '../../types/admin';
import type { ExamWithProblems, AdminUser } from '../../types/admin';
import ConfirmModal from '../../components/shared/ConfirmModal.vue';
import ProctoringModal from '../../components/admin/ProctoringModal.vue';
import TablePagination from '../../components/shared/TablePagination.vue';
import RegalButton from '../../components/admin/RegalButton.vue';
import { usePagination } from '../../composables/usePagination';
import { PAGE_LIMIT } from '../../constants';

const router = useRouter();

const {
  items: exams,
  page,
  total,
  loading,
  error,
  load,
} = usePagination<ExamWithProblems>({
  fetcher: (params) => listExams(params),
});

const confirmDelete = ref<ExamWithProblems | null>(null);
const deleting = ref(false);
const proctoringExam = ref<ExamWithProblems | null>(null);

const duplicateTarget = ref<ExamWithProblems | null>(null);
const duplicateTitle = ref('');
const duplicateStartTime = ref('');
const duplicateEndTime = ref('');
const duplicating = ref(false);

const accomExam = ref<ExamWithProblems | null>(null);
const accommodations = ref<ExamAccommodationEntry[]>([]);
const enrollments = ref<ExamEnrollmentEntry[]>([]);
const userOptions = ref<AdminUser[]>([]);
const accomUserId = ref<number | null>(null);
const accomExtraMinutes = ref<number>(15);
const accomReason = ref('');
const loadingAccom = ref(false);
const savingAccom = ref(false);
const accomError = ref('');

async function openAccommodations(exam: ExamWithProblems) {
  accomExam.value = exam;
  loadingAccom.value = true;
  accomError.value = '';
  accommodations.value = [];
  enrollments.value = [];
  userOptions.value = [];
  try {
    const [accRes, uRes, enrRes] = await Promise.allSettled([
      listAccommodations(exam.id),
      listUsers({ limit: 100 }),
      listEnrollments(exam.id),
    ]);

    if (accRes.status === 'fulfilled') {
      accommodations.value = accRes.value || [];
    } else {
      console.warn('[Accommodations] Failed to load accommodations:', accRes.reason);
    }

    if (uRes.status === 'fulfilled') {
      userOptions.value = uRes.value?.data || [];
    } else {
      console.warn('[Accommodations] Failed to load user options:', uRes.reason);
    }

    if (enrRes.status === 'fulfilled') {
      enrollments.value = enrRes.value || [];
    } else {
      console.warn('[Accommodations] Failed to load enrollments:', enrRes.reason);
    }

    if (accRes.status === 'rejected' && enrRes.status === 'rejected' && uRes.status === 'rejected') {
      const err = (accRes as PromiseRejectedResult).reason || (enrRes as PromiseRejectedResult).reason;
      accomError.value = err?.response?.data?.message || err?.message || 'Failed to load accommodations & enrollments.';
    }
  } catch (err: any) {
    console.error('Failed to open accommodations:', err);
    accomError.value = err?.response?.data?.message || err?.message || 'Failed to load accommodations & enrollments.';
  } finally {
    loadingAccom.value = false;
  }
}

async function onResetExit(userId: number) {
  if (!accomExam.value) return;
  try {
    await resetCandidateExit(accomExam.value.id, userId);
    const enr = enrollments.value.find((e) => e.userId === userId);
    if (enr) {
      enr.hasExited = false;
      enr.exitReason = undefined;
    }
  } catch (err: any) {
    console.error('Failed to reset candidate exit status:', err);
    accomError.value = err?.response?.data?.message || err?.message || 'Failed to reset candidate exit status.';
  }
}

async function onSaveAccommodation() {
  if (!accomExam.value || !accomUserId.value || accomExtraMinutes.value < 1) return;
  savingAccom.value = true;
  accomError.value = '';
  try {
    await setAccommodation(accomExam.value.id, {
      userId: accomUserId.value,
      extraMinutes: accomExtraMinutes.value,
      reason: accomReason.value.trim() || undefined,
    });
    accommodations.value = await listAccommodations(accomExam.value.id);
    accomUserId.value = null;
    accomReason.value = '';
  } catch (err: any) {
    console.error('Failed to save extra time:', err);
    accomError.value = err?.response?.data?.message || err?.message || 'Failed to save extra time.';
  } finally {
    savingAccom.value = false;
  }
}

async function onDeleteAccommodation(id: number) {
  if (!accomExam.value) return;
  try {
    await deleteAccommodation(id);
    accommodations.value = accommodations.value.filter((a) => a.id !== id);
  } catch (err: any) {
    console.error('Failed to delete extra time:', err);
    accomError.value = err?.response?.data?.message || err?.message || 'Failed to delete extra time.';
  }
}

async function onDelete() {
  if (!confirmDelete.value) return;
  const idToDelete = confirmDelete.value.id; // capture before await - ref may change
  deleting.value = true;
  try {
    await deleteExam(idToDelete);
    exams.value = exams.value.filter((e) => e.id !== idToDelete);
    total.value--;
    confirmDelete.value = null;
  } catch {
    error.value = 'Failed to delete exam. Please try again.';
    confirmDelete.value = null;
  } finally {
    deleting.value = false;
  }
}

function openDuplicate(exam: ExamWithProblems) {
  duplicateTarget.value = exam;
  duplicateTitle.value = `Copy of ${exam.title}`;
  duplicateStartTime.value = '';
  duplicateEndTime.value = '';
}

async function onDuplicate() {
  if (
    !duplicateTarget.value ||
    !duplicateTitle.value.trim() ||
    !duplicateStartTime.value ||
    !duplicateEndTime.value
  )
    return;
  duplicating.value = true;
  try {
    await duplicateExam(
      duplicateTarget.value.id,
      duplicateTitle.value.trim(),
      new Date(duplicateStartTime.value).toISOString(),
      new Date(duplicateEndTime.value).toISOString(),
    );
    invalidateCachedExams();
    duplicateTarget.value = null;
    await load();
  } catch {
    error.value = 'Failed to duplicate exam. Please try again.';
    duplicateTarget.value = null;
  } finally {
    duplicating.value = false;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusLabel(exam: ExamWithProblems) {
  return getExamStatus(exam);
}
</script>

<template>
  <div class="max-w-[1100px]">
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3"
    >
      <h2 class="text-xl font-bold text-slate-900 dark:text-white">Exams</h2>
      <RegalButton
        variant="primary"
        size="sm"
        @click="router.push({ name: 'admin-exam-create' })"
      >
        + Create Exam
      </RegalButton>
    </div>

    <div v-if="loading" class="text-sm text-slate-400">Loading…</div>
    <div v-else-if="error" class="text-sm text-red-400">{{ error }}</div>

    <template v-else>
      <div v-if="exams.length === 0" class="text-sm text-slate-400">
        No exams yet.
      </div>

      <template v-else>
        <!-- Desktop table -->
        <div
          class="hidden sm:block overflow-x-auto border border-slate-200 dark:border-white/[0.06] rounded-xl"
        >
          <table class="w-full text-[13px]">
            <thead>
              <tr>
                <th
                  class="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]"
                >
                  Title
                </th>
                <th
                  class="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]"
                >
                  Start
                </th>
                <th
                  class="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]"
                >
                  End
                </th>
                <th
                  class="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]"
                >
                  Duration
                </th>
                <th
                  class="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]"
                >
                  Problems
                </th>
                <th
                  class="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]"
                >
                  Status
                </th>
                <th
                  class="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="[&>tr:last-child>td]:border-b-0">
              <tr
                v-for="exam in exams"
                :key="exam.id"
                class="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                @click="
                  router.push({
                    name: 'admin-exam-edit',
                    params: { id: exam.id },
                  })
                "
              >
                <td
                  class="px-3.5 py-3 border-b border-slate-200 dark:border-white/[0.06] text-slate-900 dark:text-slate-200 align-middle font-medium"
                >
                  {{ exam.title }}
                </td>
                <td
                  class="px-3.5 py-3 border-b border-slate-200 dark:border-white/[0.06] text-slate-900 dark:text-slate-200 align-middle font-mono text-xs text-slate-500"
                >
                  {{ formatDate(exam.startTime) }}
                </td>
                <td
                  class="px-3.5 py-3 border-b border-slate-200 dark:border-white/[0.06] text-slate-900 dark:text-slate-200 align-middle font-mono text-xs text-slate-500"
                >
                  {{ formatDate(exam.endTime) }}
                </td>
                <td
                  class="px-3.5 py-3 border-b border-slate-200 dark:border-white/[0.06] text-slate-900 dark:text-slate-200 align-middle"
                >
                  {{ exam.durationMinutes }}m
                </td>
                <td
                  class="px-3.5 py-3 border-b border-slate-200 dark:border-white/[0.06] text-slate-900 dark:text-slate-200 align-middle"
                >
                  {{ exam.problems?.length ?? 0 }}
                </td>
                <td
                  class="px-3.5 py-3 border-b border-slate-200 dark:border-white/[0.06] text-slate-900 dark:text-slate-200 align-middle"
                >
                  <span
                    class="inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
                    :class="{
                      'bg-emerald-500/10 text-emerald-500':
                        statusLabel(exam) === 'active',
                      'bg-yellow-500/10 text-yellow-500':
                        statusLabel(exam) === 'upcoming',
                      'bg-slate-500/10 text-slate-400':
                        statusLabel(exam) === 'ended',
                    }"
                  >
                    {{ statusLabel(exam) }}
                  </span>
                </td>
                <td
                  class="px-3.5 py-3 border-b border-slate-200 dark:border-white/[0.06] text-slate-900 dark:text-slate-200 align-middle"
                  @click.stop
                >
                  <div class="flex gap-1.5 items-center">
                    <RegalButton
                      @click="
                        router.push({
                          name: 'admin-problems',
                          params: { examId: exam.id },
                        })
                      "
                    >
                      Problems
                    </RegalButton>
                    <RegalButton
                      @click="
                        router.push({
                          name: 'admin-leaderboard',
                          params: { examId: exam.id },
                        })
                      "
                    >
                      Leaderboard
                    </RegalButton>
                    <RegalButton
                      variant="secondary"
                      @click="proctoringExam = exam"
                    >
                      <span class="material-symbols-outlined text-[14px] text-emerald-400">security</span>
                      Proctoring
                    </RegalButton>
                    <RegalButton
                      variant="secondary"
                      @click="openAccommodations(exam)"
                    >
                      <span class="material-symbols-outlined text-[14px] text-amber-400">more_time</span>
                      Extra Time
                    </RegalButton>
                    <RegalButton variant="accent" @click="openDuplicate(exam)">
                      Duplicate
                    </RegalButton>
                    <RegalButton variant="danger" @click="confirmDelete = exam">
                      Delete
                    </RegalButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="sm:hidden space-y-2">
          <div
            v-for="exam in exams"
            :key="exam.id"
            class="border border-slate-200 dark:border-white/[0.06] rounded-xl p-3.5 bg-white dark:bg-surface-dark cursor-pointer"
            @click="
              router.push({ name: 'admin-exam-edit', params: { id: exam.id } })
            "
          >
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="font-medium text-sm text-slate-900 dark:text-white">
                {{ exam.title }}
              </div>
              <span
                class="inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider flex-shrink-0"
                :class="{
                  'bg-emerald-500/10 text-emerald-500':
                    statusLabel(exam) === 'active',
                  'bg-yellow-500/10 text-yellow-500':
                    statusLabel(exam) === 'upcoming',
                  'bg-slate-500/10 text-slate-400':
                    statusLabel(exam) === 'ended',
                }"
                >{{ statusLabel(exam) }}</span
              >
            </div>
            <div class="text-xs text-slate-500 space-y-0.5 mb-3">
              <div>Start: {{ formatDate(exam.startTime) }}</div>
              <div>End: {{ formatDate(exam.endTime) }}</div>
              <div>
                Duration: {{ exam.durationMinutes }}m &nbsp;·&nbsp; Problems:
                {{ exam.problems?.length ?? 0 }}
              </div>
            </div>
            <div class="flex gap-1.5 flex-wrap" @click.stop>
              <RegalButton
                @click="
                  router.push({
                    name: 'admin-problems',
                    params: { examId: exam.id },
                  })
                "
              >
                Problems
              </RegalButton>
              <RegalButton
                @click="
                  router.push({
                    name: 'admin-leaderboard',
                    params: { examId: exam.id },
                  })
                "
              >
                Leaderboard
              </RegalButton>
              <RegalButton variant="accent" @click="openDuplicate(exam)">
                Duplicate
              </RegalButton>
              <RegalButton variant="danger" @click="confirmDelete = exam">
                Delete
              </RegalButton>
            </div>
          </div>
        </div>
      </template>
    </template>

    <TablePagination
      :page="page"
      :total="total"
      :limit="PAGE_LIMIT"
      @update:page="page = $event"
    />

    <ConfirmModal
      v-if="confirmDelete"
      title="Delete Exam"
      :message="`Delete &quot;${confirmDelete.title}&quot;? This will also remove all problems, test cases, and submissions.`"
      confirm-label="Delete"
      :danger="true"
      @confirm="onDelete"
      @cancel="confirmDelete = null"
    />

    <!-- Duplicate modal -->
    <Teleport to="body">
      <div
        v-if="duplicateTarget"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        @click.self="duplicateTarget = null"
      >
        <div
          class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.08] w-full max-w-md p-6"
        >
          <h3 class="text-base font-bold text-slate-900 dark:text-white mb-1">
            Duplicate Exam
          </h3>
          <p class="text-sm text-slate-500 mb-4">
            Enter a name for the new exam. All problems and test cases will be
            copied. The new exam will be inactive.
          </p>
          <label
            class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
            >New Exam Name</label
          >
          <input
            v-model="duplicateTitle"
            type="text"
            class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50 mb-4"
            placeholder="Exam title"
            autofocus
            @keydown.esc="duplicateTarget = null"
          />
          <div class="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label
                class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
                >Start Time</label
              >
              <input
                v-model="duplicateStartTime"
                type="datetime-local"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
            <div>
              <label
                class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
                >End Time</label
              >
              <input
                v-model="duplicateEndTime"
                type="datetime-local"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <RegalButton size="sm" @click="duplicateTarget = null">
              Cancel
            </RegalButton>
            <RegalButton
              variant="primary"
              size="sm"
              :disabled="
                duplicating ||
                !duplicateTitle.trim() ||
                !duplicateStartTime ||
                !duplicateEndTime
              "
              @click="onDuplicate"
            >
              {{ duplicating ? 'Duplicating…' : 'Duplicate' }}
            </RegalButton>
          </div>
        </div>
      </div>
    </Teleport>

    <ProctoringModal
      v-if="proctoringExam"
      :show="!!proctoringExam"
      :exam-id="proctoringExam.id"
      :exam-title="proctoringExam.title"
      @close="proctoringExam = null"
    />

    <!-- Accommodations / Extra Time Modal -->
    <Teleport to="body">
      <div
        v-if="accomExam"
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      >
        <div class="bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/[0.08] rounded-xl max-w-lg w-full p-5 shadow-2xl">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-amber-400 text-lg">more_time</span>
              Candidate Extra Time — {{ accomExam.title }}
            </h3>
            <button class="text-slate-400 hover:text-white text-lg leading-none" @click="accomExam = null">&times;</button>
          </div>

          <div v-if="accomError" class="mb-3 p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {{ accomError }}
          </div>

          <!-- Existing accommodations list -->
          <div class="mb-4">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Assigned Time Extensions</h4>
            <div v-if="loadingAccom" class="text-xs text-slate-500 py-3 text-center">Loading accommodations...</div>
            <div v-else-if="!accommodations.length" class="text-xs text-slate-500 py-3 text-center border border-dashed border-slate-200 dark:border-white/[0.06] rounded-lg">
              No individual extra time assigned yet.
            </div>
            <div v-else class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              <div
                v-for="a in accommodations"
                :key="a.id"
                class="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-background-dark text-xs"
              >
                <div>
                  <div class="font-semibold text-slate-900 dark:text-white">
                    {{ a.user?.firstName }} {{ a.user?.lastName }} <span class="font-mono text-slate-400">({{ a.user?.rollNumber || a.user?.email }})</span>
                  </div>
                  <div v-if="a.reason" class="text-[11px] text-slate-500 mt-0.5">{{ a.reason }}</div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="font-mono font-bold text-amber-500 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-xs">+{{ a.extraMinutes }}m</span>
                  <button class="text-slate-400 hover:text-rose-400 transition-colors" title="Delete extra time" @click="onDeleteAccommodation(a.id)">
                    <span class="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Candidate Exit Status Management -->
          <div class="mb-4 border-t border-slate-200 dark:border-white/[0.06] pt-3">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Candidate Exit / Re-entry Status</h4>
            <div v-if="!enrollments.length" class="text-xs text-slate-500 py-2 text-center border border-dashed border-slate-200 dark:border-white/[0.06] rounded-lg">
              No students enrolled in this exam yet.
            </div>
            <div v-else class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              <div
                v-for="e in enrollments"
                :key="e.id"
                class="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-background-dark text-xs"
              >
                <div>
                  <span class="font-semibold text-slate-900 dark:text-white">
                    {{ e.user?.firstName }} {{ e.user?.lastName }}
                  </span>
                  <span class="font-mono text-slate-400 ml-1">({{ e.user?.rollNumber || e.user?.email }})</span>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                    :class="e.hasExited ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'"
                  >
                    {{ e.hasExited ? `Exited (${e.exitReason || 'Closed'})` : 'Active' }}
                  </span>
                  <button
                    v-if="e.hasExited"
                    class="px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-primary text-[11px] font-semibold transition-colors flex items-center gap-1"
                    title="Reset exit status and re-enable exam access"
                    @click="onResetExit(e.userId)"
                  >
                    <span class="material-symbols-outlined text-[13px]">lock_reset</span>
                    Allow Re-entry
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Form to add new accommodation -->
          <div class="border-t border-slate-200 dark:border-white/[0.06] pt-3">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Add Candidate Time Extension</h4>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">Select Candidate</label>
                <select
                  v-model="accomUserId"
                  class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-background-dark text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                >
                  <option :value="null" disabled>Choose a student...</option>
                  <option v-for="u in userOptions" :key="u.id" :value="u.id">
                    {{ u.firstName }} {{ u.lastName }} ({{ u.rollNumber || u.email }})
                  </option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-slate-500 mb-1">Extra Minutes</label>
                  <input
                    v-model.number="accomExtraMinutes"
                    type="number"
                    min="1"
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-background-dark text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                    placeholder="e.g. 15"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-500 mb-1">Reason (Optional)</label>
                  <input
                    v-model="accomReason"
                    type="text"
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-background-dark text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                    placeholder="e.g. Accessibility accommodation"
                  />
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-1">
                <RegalButton size="sm" @click="accomExam = null">Close</RegalButton>
                <RegalButton
                  variant="primary"
                  size="sm"
                  :disabled="savingAccom || !accomUserId || accomExtraMinutes < 1"
                  @click="onSaveAccommodation"
                >
                  {{ savingAccom ? 'Saving...' : 'Add Extra Time' }}
                </RegalButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
