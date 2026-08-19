import { defineStore } from 'pinia';
import { ref } from 'vue';
import { saveMcqAnswer, fetchMyMcqAnswers } from '../services/api';

function storageKey(examId: number) {
  return `mcqDrafts_${examId}`;
}

function loadDrafts(examId: number): Record<number, string[]> {
  try {
    const raw = sessionStorage.getItem(storageKey(examId));
    return raw ? (JSON.parse(raw) as Record<number, string[]>) : {};
  } catch {
    return {};
  }
}

function saveDrafts(examId: number, drafts: Record<number, string[]>) {
  try {
    sessionStorage.setItem(storageKey(examId), JSON.stringify(drafts));
  } catch {
    /* quota exceeded – silently ignore */
  }
}

function loadSubmitted(examId: number): boolean {
  return sessionStorage.getItem(`mcqSubmitted_${examId}`) === 'true';
}

function saveSubmitted(examId: number) {
  sessionStorage.setItem(`mcqSubmitted_${examId}`, 'true');
}

export const useMcqStore = defineStore('mcq', () => {
  const currentExamId = ref<number | null>(null);
  const mcqDrafts = ref<Record<number, string[]>>({});
  const mcqSectionSubmitted = ref(false);
  const mcqTotalScore = ref<number | null>(null);
  const savingStates = ref<Record<number, 'saved' | 'saving' | 'error'>>({});

  /** Call once when the exam is known (e.g. after fetchActiveExam). */
  async function init(examId: number) {
    if (currentExamId.value === examId) return;
    currentExamId.value = examId;
    mcqDrafts.value = loadDrafts(examId);
    mcqSectionSubmitted.value = loadSubmitted(examId);
    mcqTotalScore.value = null;

    // Hydrate from server database
    try {
      const { answers } = await fetchMyMcqAnswers(examId);
      if (answers && Object.keys(answers).length > 0) {
        mcqDrafts.value = { ...mcqDrafts.value, ...answers };
        saveDrafts(examId, mcqDrafts.value);
        for (const pid of Object.keys(answers)) {
          savingStates.value[Number(pid)] = 'saved';
        }
      }
    } catch {
      /* ignore offline / network errors */
    }
  }

  async function setDraft(problemId: number, selectedOptionIds: string[]) {
    mcqDrafts.value[problemId] = selectedOptionIds;
    if (currentExamId.value !== null) {
      saveDrafts(currentExamId.value, mcqDrafts.value);
      const examId = currentExamId.value;
      savingStates.value[problemId] = 'saving';
      try {
        await saveMcqAnswer({
          examId,
          problemId,
          selectedOptionIds,
        });
        savingStates.value[problemId] = 'saved';
      } catch (err) {
        console.warn(`[mcq] Auto-save failed for problem ${problemId}`, err);
        savingStates.value[problemId] = 'error';
      }
    }
  }

  function markSubmitted(totalScore: number) {
    mcqSectionSubmitted.value = true;
    mcqTotalScore.value = totalScore;
    if (currentExamId.value !== null) {
      saveSubmitted(currentExamId.value);
    }
  }

  return {
    currentExamId,
    mcqDrafts,
    mcqSectionSubmitted,
    mcqTotalScore,
    savingStates,
    init,
    setDraft,
    markSubmitted,
  };
});
