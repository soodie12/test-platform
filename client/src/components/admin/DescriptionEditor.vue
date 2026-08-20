<script setup lang="ts">
import { ref, computed } from 'vue';
import { renderMarkdown } from '../../utils/markdown';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label?: string;
    placeholder?: string;
    required?: boolean;
    error?: string;
    rows?: number;
  }>(),
  {
    label: 'Description',
    placeholder: 'Problem statement and table schema...',
    required: false,
    error: '',
    rows: 8,
  },
);

const emit = defineEmits<{
  'update:modelValue': [val: string];
}>();

const mode = ref<'write' | 'preview'>('write');
const showTableModal = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// ── Table Builder State ───────────────────────────────────────────────────────
const tableType = ref<'schema' | 'data' | 'custom'>('schema');
const tableName = ref('users');
const colCount = ref(3);
const rowCount = ref(2);

interface CustomTableState {
  columns: string[];
  rows: string[][];
}

const customTable = ref<CustomTableState>({
  columns: ['Column Name', 'Type', 'Description'],
  rows: [
    ['id', 'INTEGER', 'Primary Key, auto-increment'],
    ['name', 'VARCHAR(100)', 'Full name of the user'],
    ['department_id', 'INTEGER', 'Foreign key referencing departments(id)'],
  ],
});

function applyPreset(type: 'schema' | 'data') {
  tableType.value = type;
  if (type === 'schema') {
    tableName.value = tableName.value || 'users';
    customTable.value = {
      columns: ['Column Name', 'Type', 'Description'],
      rows: [
        ['id', 'INT', 'Primary Key'],
        ['name', 'VARCHAR', 'User Name'],
        ['department_id', 'INT', 'Foreign Key'],
      ],
    };
    colCount.value = 3;
    rowCount.value = 3;
  } else if (type === 'data') {
    tableName.value = tableName.value || 'users';
    customTable.value = {
      columns: ['id', 'name', 'salary'],
      rows: [
        ['1', 'Alice', '60000'],
        ['2', 'Bob', '45000'],
        ['3', 'Charlie', '70000'],
      ],
    };
    colCount.value = 3;
    rowCount.value = 3;
  }
}

function updateColCount(count: number) {
  const c = Math.max(1, Math.min(10, count));
  colCount.value = c;
  while (customTable.value.columns.length < c) {
    customTable.value.columns.push(`Col ${customTable.value.columns.length + 1}`);
  }
  customTable.value.columns = customTable.value.columns.slice(0, c);

  customTable.value.rows = customTable.value.rows.map((row) => {
    const next = [...row];
    while (next.length < c) next.push('');
    return next.slice(0, c);
  });
}

function updateRowCount(count: number) {
  const r = Math.max(1, Math.min(20, count));
  rowCount.value = r;
  while (customTable.value.rows.length < r) {
    customTable.value.rows.push(Array(customTable.value.columns.length).fill(''));
  }
  customTable.value.rows = customTable.value.rows.slice(0, r);
}

function addTableRow() {
  customTable.value.rows.push(Array(customTable.value.columns.length).fill(''));
  rowCount.value = customTable.value.rows.length;
}

function removeTableRow(idx: number) {
  if (customTable.value.rows.length <= 1) return;
  customTable.value.rows.splice(idx, 1);
  rowCount.value = customTable.value.rows.length;
}

const generatedMarkdownTable = computed(() => {
  const cols = customTable.value.columns.map((c) => c.trim() || 'Column');
  const divider = cols.map(() => ':---');
  const rows = customTable.value.rows.map((row) =>
    row.map((cell) => cell.trim()).join(' | '),
  );

  let md = '';
  if (tableName.value.trim()) {
    md += `### Table: \`${tableName.value.trim()}\`\n\n`;
  }
  md += `| ${cols.join(' | ')} |\n`;
  md += `| ${divider.join(' | ')} |\n`;
  for (const row of rows) {
    md += `| ${row} |\n`;
  }
  return md;
});

function insertGeneratedTable() {
  insertText(`\n\n${generatedMarkdownTable.value}\n`);
  showTableModal.value = false;
}

// ── Text Manipulation ─────────────────────────────────────────────────────────
function insertText(text: string) {
  const ta = textareaRef.value;
  if (!ta) {
    emit('update:modelValue', (props.modelValue ? props.modelValue + '\n' : '') + text);
    return;
  }

  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const val = props.modelValue || '';
  const next = val.substring(0, start) + text + val.substring(end);
  emit('update:modelValue', next);

  requestAnimationFrame(() => {
    ta.focus();
    ta.selectionStart = ta.selectionEnd = start + text.length;
  });
}

function wrapSelection(prefix: string, suffix: string, placeholder = 'text') {
  const ta = textareaRef.value;
  if (!ta) return;

  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const val = props.modelValue || '';
  const selected = val.substring(start, end) || placeholder;
  const next = val.substring(0, start) + prefix + selected + suffix + val.substring(end);
  emit('update:modelValue', next);

  requestAnimationFrame(() => {
    ta.focus();
    ta.selectionStart = start + prefix.length;
    ta.selectionEnd = start + prefix.length + selected.length;
  });
}

const renderedHtml = computed(() => renderMarkdown(props.modelValue));
</script>

<template>
  <div class="flex flex-col gap-1.5 w-full">
    <!-- Header with Label & Tabs -->
    <div class="flex items-center justify-between">
      <label class="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
        {{ label }}
        <span v-if="required" class="text-primary ml-0.5">*</span>
      </label>

      <div class="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.04] p-0.5 rounded-lg border border-slate-200 dark:border-white/[0.06]">
        <button
          type="button"
          class="px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1"
          :class="
            mode === 'write'
              ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          "
          @click="mode = 'write'"
        >
          <span class="material-symbols-outlined text-[14px]">edit_note</span>
          Write
        </button>
        <button
          type="button"
          class="px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1"
          :class="
            mode === 'preview'
              ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          "
          @click="mode = 'preview'"
        >
          <span class="material-symbols-outlined text-[14px]">visibility</span>
          Preview
        </button>
      </div>
    </div>

    <!-- Editor Wrapper -->
    <div class="border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden bg-white dark:bg-background-dark focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
      <!-- Toolbar (Write Mode Only) -->
      <div
        v-if="mode === 'write'"
        class="flex flex-wrap items-center gap-1 px-2.5 py-1.5 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.02]"
      >
        <!-- Text Styles -->
        <button
          type="button"
          class="toolbar-btn"
          title="Bold (Ctrl+B)"
          @click="wrapSelection('**', '**', 'bold text')"
        >
          <span class="font-bold text-xs font-serif">B</span>
        </button>
        <button
          type="button"
          class="toolbar-btn"
          title="Italic (Ctrl+I)"
          @click="wrapSelection('*', '*', 'italic text')"
        >
          <span class="italic text-xs font-serif">I</span>
        </button>
        <button
          type="button"
          class="toolbar-btn"
          title="Heading"
          @click="insertText('\n### Heading\n')"
        >
          <span class="font-bold text-xs font-mono">H3</span>
        </button>

        <div class="w-px h-4 bg-slate-200 dark:bg-white/[0.08] mx-0.5" />

        <!-- Code & Lists -->
        <button
          type="button"
          class="toolbar-btn"
          title="Inline Code"
          @click="wrapSelection('`', '`', 'code')"
        >
          <span class="material-symbols-outlined text-[15px]">code</span>
        </button>
        <button
          type="button"
          class="toolbar-btn"
          title="SQL Code Block"
          @click="insertText('\n```sql\n-- SQL statements here\nSELECT * FROM users;\n```\n')"
        >
          <span class="material-symbols-outlined text-[15px]">terminal</span>
        </button>
        <button
          type="button"
          class="toolbar-btn"
          title="Bullet List"
          @click="insertText('\n- Item 1\n- Item 2\n')"
        >
          <span class="material-symbols-outlined text-[15px]">format_list_bulleted</span>
        </button>

        <div class="w-px h-4 bg-slate-200 dark:bg-white/[0.08] mx-0.5" />

        <!-- Table Builder Button -->
        <button
          type="button"
          class="toolbar-btn table-action-btn"
          title="Create & Insert Table Structure"
          @click="showTableModal = true"
        >
          <span class="material-symbols-outlined text-[15px] text-amber-500">table_chart</span>
          <span class="text-xs font-bold text-amber-600 dark:text-amber-400">+ Insert Table</span>
        </button>
      </div>

      <!-- Write Area -->
      <div v-show="mode === 'write'">
        <textarea
          ref="textareaRef"
          :value="modelValue"
          class="w-full bg-transparent px-3.5 py-3 text-[13px] text-slate-900 dark:text-white font-mono placeholder:text-slate-400 focus:outline-none resize-y min-h-[160px] leading-relaxed"
          :placeholder="placeholder"
          :rows="rows"
          spellcheck="false"
          @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>

      <!-- Preview Area -->
      <div v-show="mode === 'preview'" class="p-4 min-h-[160px] bg-slate-50/50 dark:bg-surface-dark/40 overflow-x-auto">
        <div
          v-if="modelValue.trim()"
          class="markdown-rendered-view"
          v-html="renderedHtml"
        />
        <div v-else class="text-xs text-slate-400 italic py-8 text-center">
          Nothing to preview yet. Switch to Write mode to add text and tables.
        </div>
      </div>
    </div>

    <!-- Error message -->
    <span v-if="error" class="text-xs text-red-400">{{ error }}</span>

    <!-- ── Table Builder Modal ─────────────────────────────────────────────── -->
    <Teleport to="body">
      <div
        v-if="showTableModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm state-modal-enter"
      >
        <div
          class="bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02]">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                <span class="material-symbols-outlined text-[18px]">table_chart</span>
              </div>
              <div>
                <h3 class="text-base font-bold text-slate-900 dark:text-white">Create Table Structure</h3>
                <p class="text-xs text-slate-500">Easily define database tables and candidate sample data</p>
              </div>
            </div>
            <button
              type="button"
              class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              @click="showTableModal = false"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto flex flex-col gap-5">
            <!-- Preset Selector -->
            <div>
              <label class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Table Template</label>
              <div class="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  class="flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
                  :class="
                    tableType === 'schema'
                      ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-white ring-1 ring-amber-500/30'
                      : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  "
                  @click="applyPreset('schema')"
                >
                  <span class="material-symbols-outlined text-[20px] text-amber-500">schema</span>
                  <div>
                    <div class="text-xs font-bold">SQL Schema Table</div>
                    <div class="text-[11px] text-slate-500">Column Name, Type, Description</div>
                  </div>
                </button>

                <button
                  type="button"
                  class="flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
                  :class="
                    tableType === 'data'
                      ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-white ring-1 ring-amber-500/30'
                      : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  "
                  @click="applyPreset('data')"
                >
                  <span class="material-symbols-outlined text-[20px] text-emerald-500">table_rows</span>
                  <div>
                    <div class="text-xs font-bold">Sample Records Table</div>
                    <div class="text-[11px] text-slate-500">Sample data rows for candidates</div>
                  </div>
                </button>
              </div>
            </div>

            <!-- Table Config -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500">Table Name</label>
                <input
                  v-model="tableName"
                  type="text"
                  placeholder="e.g. employees"
                  class="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-background-dark font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500">Columns ({{ colCount }})</label>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="w-7 h-7 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 flex items-center justify-center"
                    @click="updateColCount(colCount - 1)"
                  >
                    -
                  </button>
                  <span class="text-xs font-mono font-bold w-6 text-center text-slate-800 dark:text-slate-200">{{ colCount }}</span>
                  <button
                    type="button"
                    class="w-7 h-7 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 flex items-center justify-center"
                    @click="updateColCount(colCount + 1)"
                  >
                    +
                  </button>
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500">Rows ({{ rowCount }})</label>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="w-7 h-7 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 flex items-center justify-center"
                    @click="updateRowCount(rowCount - 1)"
                  >
                    -
                  </button>
                  <span class="text-xs font-mono font-bold w-6 text-center text-slate-800 dark:text-slate-200">{{ rowCount }}</span>
                  <button
                    type="button"
                    class="w-7 h-7 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 flex items-center justify-center"
                    @click="updateRowCount(rowCount + 1)"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <!-- Editable Table Grid -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Table Cells</label>
                <button
                  type="button"
                  class="text-xs text-amber-500 hover:text-amber-400 font-semibold flex items-center gap-1"
                  @click="addTableRow"
                >
                  + Add Row
                </button>
              </div>

              <div class="overflow-x-auto border border-slate-200 dark:border-white/[0.08] rounded-xl">
                <table class="w-full text-xs">
                  <thead class="bg-slate-100 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.08]">
                    <tr>
                      <th
                        v-for="(_, colIdx) in customTable.columns"
                        :key="colIdx"
                        class="p-2 text-left font-semibold text-slate-700 dark:text-slate-300"
                      >
                        <input
                          v-model="customTable.columns[colIdx]"
                          type="text"
                          class="w-full bg-white dark:bg-background-dark px-2 py-1 rounded border border-slate-200 dark:border-white/[0.1] font-semibold text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                          :placeholder="`Header ${colIdx + 1}`"
                        />
                      </th>
                      <th class="w-8 p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(_, rowIdx) in customTable.rows"
                      :key="rowIdx"
                      class="border-b border-slate-100 dark:border-white/[0.04] last:border-b-0"
                    >
                      <td
                        v-for="(_, colIdx) in customTable.columns"
                        :key="colIdx"
                        class="p-2"
                      >
                        <input
                          v-model="customTable.rows[rowIdx][colIdx]"
                          type="text"
                          class="w-full bg-slate-50 dark:bg-background-dark/50 px-2 py-1 rounded border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                          :placeholder="`Value`"
                        />
                      </td>
                      <td class="p-2 text-center">
                        <button
                          type="button"
                          class="text-slate-400 hover:text-red-400 p-1"
                          title="Remove Row"
                          @click="removeTableRow(rowIdx)"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Live Preview -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold uppercase tracking-wider text-slate-400">Generated Markdown Preview</label>
              <pre class="p-3 bg-slate-900 text-slate-200 text-xs font-mono rounded-xl overflow-x-auto max-h-36">{{ generatedMarkdownTable }}</pre>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02]">
            <button
              type="button"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              @click="showTableModal = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
              @click="insertGeneratedTable"
            >
              <span class="material-symbols-outlined text-[16px]">add_circle</span>
              Insert Table into Description
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.toolbar-btn {
  @apply flex items-center justify-center h-7 px-2 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.08] transition-colors cursor-pointer;
}

.table-action-btn {
  @apply bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2.5 gap-1.5;
}

@keyframes modal-fade {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.state-modal-enter {
  animation: modal-fade 0.15s ease-out both;
}

:deep(.markdown-rendered-view) {
  font-size: 13px;
  line-height: 1.6;
  color: #334155;
}
:global(.dark) :deep(.markdown-rendered-view) {
  color: #cbd5e1;
}
:deep(.markdown-rendered-view p) {
  margin-bottom: 0.75em;
}
:deep(.markdown-rendered-view p:last-child) {
  margin-bottom: 0;
}
:deep(.markdown-rendered-view h1),
:deep(.markdown-rendered-view h2),
:deep(.markdown-rendered-view h3),
:deep(.markdown-rendered-view h4) {
  font-weight: 700;
  color: #0f172a;
  margin-top: 1em;
  margin-bottom: 0.5em;
}
:global(.dark) :deep(.markdown-rendered-view h1),
:global(.dark) :deep(.markdown-rendered-view h2),
:global(.dark) :deep(.markdown-rendered-view h3),
:global(.dark) :deep(.markdown-rendered-view h4) {
  color: #f8fafc;
}
:deep(.markdown-rendered-view h1) { font-size: 1.25em; }
:deep(.markdown-rendered-view h2) { font-size: 1.15em; }
:deep(.markdown-rendered-view h3) { font-size: 1.05em; }
:deep(.markdown-rendered-view code) {
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
  background: rgba(148, 163, 184, 0.15);
  padding: 2px 5px;
  border-radius: 4px;
  color: #00d9b4;
}
:deep(.markdown-rendered-view pre) {
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 0.75em 0;
}
:deep(.markdown-rendered-view pre code) {
  background: transparent;
  padding: 0;
  color: #e2e8f0;
}
:deep(.markdown-rendered-view ul) {
  list-style-type: disc;
  padding-left: 1.25em;
  margin-bottom: 0.75em;
}
:deep(.markdown-rendered-view ol) {
  list-style-type: decimal;
  padding-left: 1.25em;
  margin-bottom: 0.75em;
}
:deep(.markdown-rendered-view table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75em 0;
  font-size: 12px;
  border: 1px solid rgba(226, 232, 240, 1);
  border-radius: 8px;
  overflow: hidden;
}
:global(.dark) :deep(.markdown-rendered-view table) {
  border-color: rgba(255, 255, 255, 0.1);
}
:deep(.markdown-rendered-view th) {
  background: rgba(241, 245, 249, 0.9);
  font-weight: 600;
  text-align: left;
  padding: 8px 12px;
  border: 1px solid rgba(226, 232, 240, 1);
  color: #1e293b;
}
:global(.dark) :deep(.markdown-rendered-view th) {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
}
:deep(.markdown-rendered-view td) {
  padding: 7px 12px;
  border: 1px solid rgba(226, 232, 240, 0.8);
  color: #475569;
}
:global(.dark) :deep(.markdown-rendered-view td) {
  border-color: rgba(255, 255, 255, 0.07);
  color: #cbd5e1;
}
:deep(.markdown-rendered-view tr:nth-child(even) td) {
  background: rgba(248, 250, 252, 0.6);
}
:global(.dark) :deep(.markdown-rendered-view tr:nth-child(even) td) {
  background: rgba(255, 255, 255, 0.02);
}
</style>
