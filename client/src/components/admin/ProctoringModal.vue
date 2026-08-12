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
const filterUserId = ref<number | ''>('');

onMounted(async () => {
  try {
    logs.value = await getProctoringLogs(props.examId);
  } catch {
    /* error loading proctoring logs */
  } finally {
    loading.value = false;
  }
});

const filteredLogs = computed(() => {
  if (!filterUserId.value) return logs.value;
  return logs.value.filter((l) => l.userId === filterUserId.value);
});

const userIds = computed(() => {
  const set = new Set<number>();
  for (const l of logs.value) set.add(l.userId);
  return [...set].sort((a, b) => a - b);
});

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
        <div class="header">
          <div class="title-group">
            <span class="material-symbols-outlined icon">security</span>
            <div>
              <h3 class="title">Proctoring Violation Audit Log</h3>
              <p class="subtitle">{{ examTitle || `Exam #${examId}` }} · {{ logs.length }} Total Violations</p>
            </div>
          </div>
          <button class="close-btn" @click="emit('close')">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div v-if="userIds.length > 1" class="filter-bar">
          <label class="filter-label">Filter Student User ID:</label>
          <select v-model="filterUserId" class="filter-select">
            <option :value="''">All Students</option>
            <option v-for="u in userIds" :key="u" :value="u">Student ID #{{ u }}</option>
          </select>
        </div>

        <div class="body">
          <div v-if="loading" class="empty">
            <span class="spinner"></span> Loading proctoring logs...
          </div>

          <div v-else-if="filteredLogs.length === 0" class="empty">
            <span class="material-symbols-outlined text-[36px] text-emerald-400 mb-2">verified_user</span>
            <p>No proctoring violations recorded for this exam!</p>
          </div>

          <div v-else class="log-list">
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
                <span class="user-tag">Student #{{ item.userId }}</span>
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
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  color: #00d66c;
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

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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

.body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
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
  letter-spacing: 0.05em;
}

.badge-red {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.badge-yellow {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.badge-orange {
  background: rgba(249, 115, 22, 0.15);
  color: #fb923c;
  border: 1px solid rgba(249, 115, 22, 0.3);
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
  border-top-color: #00d66c;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
