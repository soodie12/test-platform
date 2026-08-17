<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { bulkCreateTestCases } from '../../services/adminApi';
import { useToastStore } from '../../stores/toast';

const props = defineProps<{
  show: boolean;
  problemId?: number;
  problems?: Array<{ id: number; title: string; examTitle?: string }>;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'imported', items?: Array<{ input: string; expectedOutput: string; isVisible: boolean }>): void;
}>();

const toastStore = useToastStore();

const currentStep = ref<1 | 2 | 3>(1);
const fileName = ref('');
const rawCsvContent = ref('');
const headers = ref<string[]>([]);
const parsedRows = ref<Record<string, string>[]>([]);

// Mapping state
const selectedProblemId = ref<number | undefined>(props.problemId);
const selectedInputCols = ref<string[]>([]);
const selectedOutputCol = ref<string>('');
const selectedVisibleCol = ref<string>('');
const defaultVisibility = ref<boolean>(false);
const inputSeparator = ref<'\n' | ' ' | ',' | '\t'>('\n');
const trimValues = ref<boolean>(true);
const unescapeNewlines = ref<boolean>(true);

const importing = ref(false);

watch(
  () => props.problemId,
  (newId) => {
    selectedProblemId.value = newId;
  },
  { immediate: true },
);

function resetModal() {
  currentStep.value = 1;
  fileName.value = '';
  rawCsvContent.value = '';
  headers.value = [];
  parsedRows.value = [];
  selectedInputCols.value = [];
  selectedOutputCol.value = '';
  selectedVisibleCol.value = '';
  importing.value = false;
}

function handleClose() {
  resetModal();
  emit('close');
}

// ── Robust CSV Parsing Function ─────────────────────────────────────────────
function parseCSV(text: string) {
  const lines: string[][] = [];
  let curRow: string[] = [];
  let curVal = '';
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        curVal += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      curRow.push(curVal);
      curVal = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      curRow.push(curVal);
      if (curRow.some((c) => c.trim().length > 0)) {
        lines.push(curRow);
      }
      curRow = [];
      curVal = '';
    } else {
      curVal += char;
    }
  }

  if (curVal || curRow.length > 0) {
    curRow.push(curVal);
    if (curRow.some((c) => c.trim().length > 0)) {
      lines.push(curRow);
    }
  }

  if (lines.length === 0) return;

  const rawHeaders = lines[0].map((h, idx) => h.trim() || `Column_${idx + 1}`);
  headers.value = rawHeaders;

  const dataRows: Record<string, string>[] = [];
  for (let r = 1; r < lines.length; r++) {
    const rowObj: Record<string, string> = {};
    const row = lines[r];
    for (let c = 0; c < rawHeaders.length; c++) {
      rowObj[rawHeaders[c]] = row[c] ?? '';
    }
    dataRows.push(rowObj);
  }

  parsedRows.value = dataRows;

  // Auto-detect columns
  const lowerHeaders = rawHeaders.map((h) => h.toLowerCase());
  const inputMatches = rawHeaders.filter((_, idx) =>
    ['input', 'in', 'testcase', 'test_case', 'args', 'param'].some((k) =>
      lowerHeaders[idx].includes(k),
    ),
  );
  selectedInputCols.value = inputMatches.length > 0 ? [inputMatches[0]] : [rawHeaders[0]];

  const outputMatch = rawHeaders.find((_, idx) =>
    ['output', 'out', 'expected', 'expected_output', 'target', 'result'].some((k) =>
      lowerHeaders[idx].includes(k),
    ),
  );
  selectedOutputCol.value = outputMatch || (rawHeaders.length > 1 ? rawHeaders[1] : rawHeaders[0]);

  const visibleMatch = rawHeaders.find((_, idx) =>
    ['visible', 'is_visible', 'sample'].some((k) => lowerHeaders[idx].includes(k)),
  );
  if (visibleMatch) {
    selectedVisibleCol.value = visibleMatch;
  }
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    processFile(target.files[0]);
  }
}

function onDrop(e: DragEvent) {
  if (e.dataTransfer && e.dataTransfer.files[0]) {
    processFile(e.dataTransfer.files[0]);
  }
}

function processFile(file: File) {
  fileName.value = file.name;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const content = evt.target?.result as string;
    if (content) {
      rawCsvContent.value = content;
      parseCSV(content);
      currentStep.value = 2;
    }
  };
  reader.readAsText(file);
}

function toggleInputCol(colName: string) {
  if (selectedInputCols.value.includes(colName)) {
    if (selectedInputCols.value.length > 1) {
      selectedInputCols.value = selectedInputCols.value.filter((c) => c !== colName);
    }
  } else {
    selectedInputCols.value.push(colName);
  }
}

// ── Computed Mapped Test Cases Preview ──────────────────────────────────────
const mappedTestCases = computed(() => {
  return parsedRows.value.map((row) => {
    let inputParts = selectedInputCols.value.map((col) => row[col] || '');
    if (trimValues.value) {
      inputParts = inputParts.map((p) => p.trim());
    }

    let inputStr = inputParts.join(inputSeparator.value);
    let outputStr = row[selectedOutputCol.value] || '';

    if (trimValues.value) {
      outputStr = outputStr.trim();
    }

    if (unescapeNewlines.value) {
      inputStr = inputStr.replace(/\\n/g, '\n');
      outputStr = outputStr.replace(/\\n/g, '\n');
    }

    let isVisible = defaultVisibility.value;
    if (selectedVisibleCol.value && row[selectedVisibleCol.value]) {
      const val = row[selectedVisibleCol.value].trim().toLowerCase();
      isVisible = ['true', '1', 'yes', 'visible', 'sample'].includes(val);
    }

    return {
      input: inputStr,
      expectedOutput: outputStr,
      isVisible,
    };
  });
});



async function confirmImport() {
  if (mappedTestCases.value.length === 0) {
    toastStore.add('error', 'No valid test cases found in CSV to import.');
    return;
  }

  const targetId = selectedProblemId.value ?? props.problemId;
  if (!targetId) {
    // Local mode (e.g. creating new problem in ProblemForm before saving)
    toastStore.add(
      'success',
      `Loaded ${mappedTestCases.value.length} test cases into form!`,
    );
    emit('imported', mappedTestCases.value);
    handleClose();
    return;
  }

  importing.value = true;
  try {
    await bulkCreateTestCases(targetId, mappedTestCases.value);
    toastStore.add(
      'success',
      `Successfully imported ${mappedTestCases.value.length} test cases!`,
    );
    emit('imported', mappedTestCases.value);
    handleClose();
  } catch (err: unknown) {
    const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    toastStore.add('error', message || 'Failed to import test cases from CSV.');
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="handleClose">
      <div class="modal-card">
        <!-- Header -->
        <div class="header">
          <div class="title-group">
            <span class="material-symbols-outlined icon">upload_file</span>
            <div>
              <h3 class="title">Import Test Cases via CSV</h3>
              <p class="subtitle">Upload CSV and define layout mapping for automated test cases</p>
            </div>
          </div>
          <button class="close-btn" @click="handleClose">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Wizard Step Indicator -->
        <div class="step-bar">
          <div class="step-item" :class="{ active: currentStep >= 1 }">
            <span class="step-num">1</span> Upload CSV
          </div>
          <div class="step-divider"></div>
          <div class="step-item" :class="{ active: currentStep >= 2 }">
            <span class="step-num">2</span> Define Layout
          </div>
          <div class="step-divider"></div>
          <div class="step-item" :class="{ active: currentStep >= 3 }">
            <span class="step-num">3</span> Preview & Import
          </div>
        </div>

        <!-- Body -->
        <div class="body">
          <!-- Step 1: File Dropzone -->
          <div v-if="currentStep === 1" class="step-container">
            <div
              class="dropzone"
              @dragover.prevent
              @drop.prevent="onDrop"
            >
              <span class="material-symbols-outlined text-[48px] text-primary mb-3">cloud_upload</span>
              <h4 class="text-sm font-bold text-slate-200">Drag & Drop CSV File Here</h4>
              <p class="text-xs text-slate-400 mt-1 mb-4">Supports .csv or .txt files with column headers</p>

              <label class="btn-select-file">
                <span class="material-symbols-outlined text-[16px]">folder_open</span>
                Browse File
                <input type="file" accept=".csv,.txt" class="hidden" @change="onFileSelect" />
              </label>
            </div>
          </div>

          <!-- Step 2: Define Layout Mapping -->
          <div v-else-if="currentStep === 2" class="step-container">
            <div class="file-summary">
              <span class="material-symbols-outlined text-primary text-[18px]">description</span>
              <span class="font-mono text-xs text-slate-200">{{ fileName }}</span>
              <span class="badge">{{ parsedRows.length }} rows detected</span>
            </div>

            <!-- Problem selector if not pre-bound -->
            <div v-if="!props.problemId && props.problems" class="form-group mt-4">
              <label class="form-label">Target Problem *</label>
              <select v-model="selectedProblemId" class="form-select">
                <option :value="undefined" disabled>-- Select Target Problem --</option>
                <option v-for="p in props.problems" :key="p.id" :value="p.id">
                  {{ p.examTitle ? `[${p.examTitle}] ` : '' }}{{ p.title }}
                </option>
              </select>
            </div>

            <div class="mapping-grid mt-4">
              <!-- Input Columns -->
              <div class="form-group">
                <label class="form-label">
                  Input Column(s)
                  <span class="text-[11px] text-slate-400 font-normal">(Pick 1 or multiple)</span>
                </label>
                <div class="checkbox-group">
                  <label v-for="h in headers" :key="h" class="checkbox-item">
                    <input
                      type="checkbox"
                      :checked="selectedInputCols.includes(h)"
                      @change="toggleInputCol(h)"
                    />
                    <span>{{ h }}</span>
                  </label>
                </div>
              </div>

              <!-- Input Separator -->
              <div class="form-group">
                <label class="form-label">Join Separator (for multi-col input)</label>
                <select v-model="inputSeparator" class="form-select">
                  <option value="\n">Newline (\n)</option>
                  <option value=" ">Space (" ")</option>
                  <option value=",">Comma (",")</option>
                  <option value="\t">Tab (\t)</option>
                </select>
              </div>

              <!-- Output Column -->
              <div class="form-group">
                <label class="form-label">Expected Output Column *</label>
                <select v-model="selectedOutputCol" class="form-select">
                  <option v-for="h in headers" :key="h" :value="h">{{ h }}</option>
                </select>
              </div>

              <!-- Visibility Column -->
              <div class="form-group">
                <label class="form-label">Visibility Column (Optional)</label>
                <select v-model="selectedVisibleCol" class="form-select">
                  <option value="">-- None (Use Default Below) --</option>
                  <option v-for="h in headers" :key="h" :value="h">{{ h }}</option>
                </select>
              </div>
            </div>

            <!-- Additional Format Controls -->
            <div class="format-controls mt-4">
              <label class="toggle-item">
                <input type="checkbox" v-model="defaultVisibility" />
                <span>Default Visibility: <strong>{{ defaultVisibility ? 'Visible (Sample)' : 'Hidden (Grading)' }}</strong></span>
              </label>
              <label class="toggle-item">
                <input type="checkbox" v-model="trimValues" />
                <span>Trim Whitespace</span>
              </label>
              <label class="toggle-item">
                <input type="checkbox" v-model="unescapeNewlines" />
                <span>Unescape <code>\n</code> literal strings into real linebreaks</span>
              </label>
            </div>
          </div>

          <!-- Step 3: Preview Grid -->
          <div v-else-if="currentStep === 3" class="step-container">
            <div class="preview-header">
              <span class="text-xs text-slate-300">Previewing first 10 of <strong>{{ mappedTestCases.length }}</strong> test cases:</span>
            </div>

            <div class="preview-table-container">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th style="width: 40px">#</th>
                    <th>Input</th>
                    <th>Expected Output</th>
                    <th style="width: 90px">Visible</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(tc, i) in mappedTestCases.slice(0, 10)" :key="i">
                    <td class="font-mono text-slate-500 text-[11px]">{{ i + 1 }}</td>
                    <td class="code-cell">{{ tc.input || '(Empty)' }}</td>
                    <td class="code-cell">{{ tc.expectedOutput || '(Empty)' }}</td>
                    <td>
                      <span class="pill" :class="tc.isVisible ? 'pill-visible' : 'pill-hidden'">
                        {{ tc.isVisible ? 'Visible' : 'Hidden' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="footer">
          <button v-if="currentStep > 1" class="btn-secondary" @click="currentStep--">
            ← Back
          </button>
          <div class="flex-1"></div>
          <button v-if="currentStep === 2" class="btn-primary" @click="currentStep = 3">
            Preview Layout →
          </button>
          <button
            v-else-if="currentStep === 3"
            class="btn-primary flex items-center gap-2"
            :disabled="importing"
            @click="confirmImport"
          >
            <span v-if="importing" class="spinner"></span>
            <span v-else class="material-symbols-outlined text-[16px]">task_alt</span>
            Import {{ mappedTestCases.length }} Test Cases
          </button>
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
  max-width: 760px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border: 1px solid rgba(0, 214, 108, 0.3);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.9);
  color: #f1f5f9;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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

.step-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.step-item.active {
  color: #00d66c;
}

.step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

.step-item.active .step-num {
  background: #00d66c;
  color: #0d1117;
  font-weight: 800;
}

.step-divider {
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 12px;
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.dropzone {
  border: 2px dashed rgba(0, 214, 108, 0.3);
  border-radius: 12px;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 214, 108, 0.02);
  transition: all 0.2s ease;
}

.dropzone:hover {
  border-color: #00d66c;
  background: rgba(0, 214, 108, 0.05);
}

.btn-select-file {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #00d66c;
  color: #0d1117;
  font-weight: 700;
  font-size: 13px;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.btn-select-file:hover { opacity: 0.9; }

.file-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.04);
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.badge {
  font-size: 11px;
  background: rgba(0, 214, 108, 0.15);
  color: #00d66c;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
}

.mapping-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
}

.form-select {
  background: #161b22;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: white;
  padding: 8px 12px;
  font-size: 13px;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: #161b22;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 10px;
  max-height: 120px;
  overflow-y: auto;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #e2e8f0;
  cursor: pointer;
}

.format-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  background: rgba(0, 0, 0, 0.2);
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
}

.preview-table-container {
  overflow-x: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  margin-top: 10px;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
}

.preview-table th {
  background: rgba(255, 255, 255, 0.04);
  padding: 8px 12px;
  color: #94a3b8;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.preview-table td {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.code-cell {
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
  color: #38bdf8;
  max-width: 280px;
}

.pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}
.pill-visible { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.pill-hidden { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }

.footer {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.01);
}

.btn-primary {
  background: #00d66c;
  color: #0d1117;
  font-weight: 700;
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  color: white;
  font-weight: 600;
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 0, 0, 0.3);
  border-top-color: #0d1117;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
