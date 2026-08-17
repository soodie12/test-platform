<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getProctoringLogs, type ProctoringLogEntry } from '../../services/adminApi';

const props = defineProps<{
  show: boolean;
  examId: number;
  examTitle?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const logs = ref<ProctoringLogEntry[]>([]);
const loading = ref(true);
const selectedCandidateId = ref<number | null>(null);
const activeTab = ref<'candidates' | 'timeline'>('candidates');

onMounted(async () => {
  try {
    logs.value = await getProctoringLogs(props.examId);
  } catch {
    /* error loading proctoring logs */
  } finally {
    loading.value = false;
  }
});

interface CandidateSummary {
  userId: number;
  name: string;
  email: string;
  rollNumber: string;
  totalViolations: number;
  fullscreenExits: number;
  tabSwitches: number;
  windowBlurs: number;
  logs: ProctoringLogEntry[];
}

const candidates = computed<CandidateSummary[]>(() => {
  const map = new Map<number, CandidateSummary>();

  for (const log of logs.value) {
    let candidate = map.get(log.userId);
    if (!candidate) {
      const user = log.user as { firstName?: string; lastName?: string; email?: string; rollNumber?: string } | undefined;
      const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || `Student #${log.userId}` : `Student #${log.userId}`;
      const email = user?.email || '';
      const rollNumber = user?.rollNumber || '';

      candidate = {
        userId: log.userId,
        name,
        email,
        rollNumber,
        totalViolations: 0,
        fullscreenExits: 0,
        tabSwitches: 0,
        windowBlurs: 0,
        logs: [],
      };
      map.set(log.userId, candidate);
    }

    candidate.totalViolations++;
    if (log.eventType === 'FULLSCREEN_EXIT') candidate.fullscreenExits++;
    else if (log.eventType === 'TAB_SWITCH') candidate.tabSwitches++;
    else if (log.eventType === 'WINDOW_BLUR') candidate.windowBlurs++;

    candidate.logs.push(log);
  }

  return [...map.values()].sort((a, b) => b.totalViolations - a.totalViolations);
});

const filteredLogs = computed(() => {
  if (!selectedCandidateId.value) return logs.value;
  return logs.value.filter((l) => l.userId === selectedCandidateId.value);
});

function selectCandidate(userId: number) {
  selectedCandidateId.value = userId;
  activeTab.value = 'timeline';
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-card">
        <!-- Header -->
        <div class="header">
          <div class="title-group">
            <span class="material-symbols-outlined icon">security</span>
            <div>
              <h3 class="title">Candidate Proctoring Audit</h3>
              <p class="subtitle">{{ examTitle || `Exam #${examId}` }} · {{ candidates.length }} Candidates Monitored</p>
            </div>
          </div>
          <button class="close-btn" @click="emit('close')">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Navigation Tabs -->
        <div class="tab-bar">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'candidates' }"
            @click="activeTab = 'candidates'"
          >
            <span class="material-symbols-outlined text-[16px]">groups</span>
            Candidate Summary ({{ candidates.length }})
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'timeline' }"
            @click="activeTab = 'timeline'"
          >
            <span class="material-symbols-outlined text-[16px]">history</span>
            Audit Timeline ({{ filteredLogs.length }})
          </button>
        </div>

        <!-- Body -->
        <div class="body">
          <div v-if="loading" class="empty">
            <span class="spinner"></span> Fetching candidate proctoring data...
          </div>

          <div v-else-if="logs.length === 0" class="empty">
            <span class="material-symbols-outlined text-[40px] text-emerald-400 mb-2">verified_user</span>
            <p class="font-semibold text-slate-200">No Proctoring Violations Recorded!</p>
            <p class="text-xs text-slate-400 mt-1">All candidates completed this test cleanly within full-screen mode.</p>
          </div>

          <!-- View 1: Candidate Breakdown Cards -->
          <div v-else-if="activeTab === 'candidates'" class="candidate-grid">
            <div
              v-for="c in candidates"
              :key="c.userId"
              class="candidate-card"
              @click="selectCandidate(c.userId)"
            >
              <div class="card-header">
                <div>
                  <h4 class="candidate-name">{{ c.name }}</h4>
                  <p class="candidate-meta">
                    <span v-if="c.rollNumber" class="font-mono text-slate-300 mr-2">Roll #{{ c.rollNumber }}</span>
                    <span>{{ c.email || `ID #${c.userId}` }}</span>
                  </p>
                </div>
                <span
                  class="status-pill"
                  :class="{
                    'pill-clean': c.totalViolations <= 1,
                    'pill-warning': c.totalViolations >= 2 && c.totalViolations <= 3,
                    'pill-flagged': c.totalViolations >= 4,
                  }"
                >
                  {{ c.totalViolations <= 1 ? 'Clean' : c.totalViolations <= 3 ? 'Warning' : 'Flagged' }}
                </span>
              </div>

              <div class="metric-row">
                <div class="metric">
                  <span class="metric-val text-red-400">{{ c.fullscreenExits }}</span>
                  <span class="metric-lbl">Fullscreen Exits</span>
                </div>
                <div class="metric">
                  <span class="metric-val text-amber-400">{{ c.tabSwitches }}</span>
                  <span class="metric-lbl">Tab Switches</span>
                </div>
                <div class="metric">
                  <span class="metric-val text-orange-400">{{ c.windowBlurs }}</span>
                  <span class="metric-lbl">Window Blurs</span>
                </div>
              </div>

              <div class="card-footer">
                <span class="text-xs text-emerald-400 font-medium">Inspect Timeline →</span>
              </div>
            </div>
          </div>

          <!-- View 2: Detailed Timeline -->
          <div v-else class="timeline-view">
            <div class="filter-bar">
              <label class="filter-label">Filter Candidate:</label>
              <select v-model="selectedCandidateId" class="filter-select">
                <option :value="null">All Candidates ({{ logs.length }})</option>
                <option v-for="c in candidates" :key="c.userId" :value="c.userId">
                  {{ c.name }} ({{ c.totalViolations }} events)
                </option>
              </select>
            </div>

            <div class="log-list mt-3">
              <div v-for="item in filteredLogs" :key="item.id" class="log-item">
                <div class="log-left">
                  <span
                    class="badge"
                    :class="{
                      'badge-red': item.eventType === 'FULLSCREEN_EXIT',
                      'badge-yellow': item.eventType === 'TAB_SWITCH',
                      'badge-orange': item.eventType === 'WINDOW_BLUR',
                    }"
                  >
                    {{ item.eventType.replace('_', ' ') }}
                  </span>
                  <span class="user-tag">
                    {{ (item.user as { firstName?: string; lastName?: string })?.firstName || `Student #${item.userId}` }}
                  </span>
                </div>
                <div class="log-right">
                  <span class="reason">{{ String(item.metadata?.reason || 'Recorded event') }}</span>
                  <span class="time">{{ formatTime(item.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 720px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border: 1px solid rgba(0, 214, 108, 0.25);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.9);
  color: #f1f5f9;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-b: 1px solid rgba(255, 255, 255, 0.08);
}

.title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon {
  font-size: 28px;
  color: #00d9b4;
}

.title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.subtitle {
  font-size: 12px;
  color: #64748b;
  margin: 2px 0 0;
}

.close-btn {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}
.close-btn:hover { color: white; }

.tab-bar {
  display: flex;
  gap: 8px;
  padding: 8px 24px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn.active {
  color: #00d9b4;
  background: rgba(0, 214, 108, 0.1);
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  color: #64748b;
  font-size: 14px;
}

.candidate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.candidate-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.candidate-card:hover {
  border-color: rgba(0, 214, 108, 0.4);
  background: rgba(0, 214, 108, 0.04);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.candidate-name {
  font-size: 14px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
}

.candidate-meta {
  font-size: 11px;
  color: #64748b;
  margin: 2px 0 0;
}

.status-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  text-transform: uppercase;
}

.pill-clean {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.pill-warning {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.pill-flagged {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric-val {
  font-size: 14px;
  font-weight: 800;
}

.metric-lbl {
  font-size: 10px;
  color: #64748b;
}

.card-footer {
  text-align: right;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-label {
  font-size: 12px;
  color: #94a3b8;
}

.filter-select {
  background: #161b22;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: white;
  padding: 4px 8px;
  font-size: 12px;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
}

.log-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}

.badge-red {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.badge-yellow {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.badge-orange {
  background: rgba(249, 115, 22, 0.15);
  color: #fb923c;
}

.user-tag {
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
}

.log-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reason {
  font-size: 12px;
  color: #94a3b8;
}

.time {
  font-size: 11px;
  color: #64748b;
  font-family: monospace;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #00d9b4;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
