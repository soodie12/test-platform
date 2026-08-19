import axios, { type AxiosError } from 'axios';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import type { RunResult, Submission, McqSubmitResult } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  if (authStore.accessToken) {
    config.headers.Authorization = `Bearer ${authStore.accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(err: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (err) {
      prom.reject(err);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & {
      _retry?: boolean;
    };
    const authStore = useAuthStore();

    if (
      error.response?.status === 401 &&
      authStore.accessToken &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<{ accessToken: string }>(
          '/api/auth/refresh',
          { token: authStore.accessToken },
        );
        authStore.setToken(data.accessToken);
        processQueue(null, data.accessToken);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        authStore.logout();
        useToastStore().add('error', 'Session expired. Please log in again.');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error as Error);
  },
);

export default api;

export async function runCode(payload: {
  examId: number;
  problemId: number;
  sourceCode: string;
  languageId: number;
  customInput?: string;
}): Promise<RunResult> {
  const { examId, problemId, ...body } = payload;
  const { data } = await api.post<RunResult>(
    `/exams/${examId}/problems/${problemId}/run`,
    body,
  );
  return data;
}

export async function submitCode(payload: {
  examId: number;
  problemId: number;
  sourceCode: string;
  languageId: number;
}): Promise<Submission> {
  const { examId, problemId, ...body } = payload;
  const { data } = await api.post<Submission>(
    `/exams/${examId}/problems/${problemId}/submissions`,
    body,
  );
  return data;
}

export async function listSubmissions(
  examId: number,
  problemId: number,
): Promise<Submission[]> {
  const { data } = await api.get<Submission[]>(
    `/exams/${examId}/problems/${problemId}/submissions`,
  );
  return data;
}

export async function getSubmissionById(
  examId: number,
  problemId: number,
  submissionId: number,
): Promise<Submission> {
  const { data } = await api.get<Submission>(
    `/exams/${examId}/problems/${problemId}/submissions/${submissionId}`,
  );
  return data;
}

export async function saveMcqAnswer(payload: {
  examId: number;
  problemId: number;
  selectedOptionIds: string[];
}): Promise<{ saved: boolean; problemId: number; selectedOptionIds: string[]; isAnswered: boolean }> {
  const { examId, problemId, selectedOptionIds } = payload;
  const { data } = await api.post(
    `/exams/${examId}/mcq-section/answer`,
    { problemId, selectedOptionIds },
  );
  return data;
}

export async function fetchMyMcqAnswers(
  examId: number,
): Promise<{ answers: Record<number, string[]> }> {
  const { data } = await api.get<{ answers: Record<number, string[]> }>(
    `/exams/${examId}/mcq-section/my-answers`,
  );
  return data;
}

export async function submitMcqSection(payload: {
  examId: number;
  answers: Array<{ problemId: number; selectedOptionIds: string[] }>;
}): Promise<McqSubmitResult> {
  const { examId, answers } = payload;
  const { data } = await api.post<McqSubmitResult>(
    `/exams/${examId}/mcq-section/submit`,
    {
      answers,
    },
  );
  return data;
}
