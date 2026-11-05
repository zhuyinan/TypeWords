<script setup lang="ts">
import { Toast } from '@/base'
import { computed, ref } from 'vue'
import { useWordOptions } from '@/core/hooks/dict.ts'
import { useBaseStore } from '@/core/stores/base.ts'
import { buildWordsFromParsed, parseWordList } from '@/core/utils/importWords'

const emit = defineEmits<{ close: []; imported: [name: string] }>()
const { createCustomDict, addWordToDict } = useWordOptions()
const store = useBaseStore()

const text = ref('')
const bookName = ref('')
const importing = ref(false)
const importMode = ref<'new' | 'append'>('new')
const appendDictId = ref('')

const customDicts = computed(() => store.word.bookList.filter(d => d.custom))
const appendTarget = computed(() => customDicts.value.find(d => d.id === appendDictId.value) ?? null)

const entries = computed(() => parseWordList(text.value))
const validCount = computed(() => entries.value.filter(e => e.valid).length)
const invalidCount = computed(() => entries.value.filter(e => !e.valid).length)
const preview = computed(() => entries.value.slice(0, 200))

const fileInput = ref<HTMLInputElement | null>(null)

function onPickFile() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const content = String(reader.result ?? '')
    text.value = content
    // 词书名未填时用文件名做默认名
    if (!bookName.value.trim()) {
      bookName.value = file.name.replace(/\.txt$/i, '')
    }
    Toast.success(`已读取 ${file.name}（${content.split('\n').filter(l => l.trim()).length} 行）`)
  }
  reader.readAsText(file)
  input.value = '' // 允许重复选择同一文件
}

async function doImport() {
  if (importMode.value === 'append') return doAppend()
  const name = bookName.value.trim()
  if (!name) return Toast.warning('请填写词书名')
  if (!validCount.value) return Toast.warning('没有可导入的有效单词')
  importing.value = true
  const res = await createCustomDict(name)
  if (!res.ok) {
    importing.value = false
    return Toast.warning(res.reason === 'duplicate' ? '已有同名词书，换个名字' : '创建词书失败')
  }
  for (const w of buildWordsFromParsed(entries.value)) addWordToDict(w, res.dict)
  importing.value = false
  Toast.success(`已导入 ${validCount.value} 个单词到「${name}」`)
  emit('imported', name)
}

async function doAppend() {
  const dict = appendTarget.value
  if (!dict) return Toast.warning('请选择要追加到的词书')
  if (!validCount.value) return Toast.warning('没有可导入的有效单词')
  importing.value = true
  let added = 0
  let skipped = 0
  for (const w of buildWordsFromParsed(entries.value)) {
    const r = addWordToDict(w, dict)
    r.ok ? added++ : skipped++
  }
  importing.value = false
  Toast.success(`已追加 ${added} 词到「${dict.name}」${skipped ? `，跳过已有 ${skipped} 词` : ''}`)
  emit('imported', dict.name)
}
</script>

<template>
  <div class="import-mask" @click.self="emit('close')">
    <div class="import-panel">
      <h2 class="mb-4 text-xl font-bold">导入词表</h2>

      <!-- 导入到：新建 / 追加 -->
      <label class="mb-1 block text-sm opacity-70">导入到</label>
      <div class="mb-3 flex gap-4 text-sm">
        <label class="flex cursor-pointer items-center gap-1.5">
          <input v-model="importMode" type="radio" value="new" />
          新建词书
        </label>
        <label class="flex cursor-pointer items-center gap-1.5" :class="{ 'opacity-40': !customDicts.length }">
          <input v-model="importMode" type="radio" value="append" :disabled="!customDicts.length" />
          追加到已有词书
        </label>
      </div>

      <template v-if="importMode === 'new'">
        <label class="mb-1 block text-sm opacity-70">词书名</label>
        <input
          v-model="bookName"
          placeholder="例：二年级下 Unit 1-4"
          class="mb-3 w-full rounded border px-3 py-2"
          style="border-color: var(--color-line); background: var(--bg-card-secend)"
        />
      </template>
      <template v-else>
        <label class="mb-1 block text-sm opacity-70">选择词书</label>
        <select
          v-model="appendDictId"
          class="mb-3 w-full rounded border px-3 py-2"
          style="border-color: var(--color-line); background: var(--bg-card-secend)"
        >
          <option value="" disabled>请选择…</option>
          <option v-for="d in customDicts" :key="d.id" :value="d.id">{{ d.name }}（{{ d.length }}词）</option>
        </select>
      </template>

      <label class="mb-1 block text-sm opacity-70">
        粘贴词表，每行一条（支持「单词 音标 词性 释义」「1. 单词 释义」等格式）
      </label>
      <textarea
        v-model="text"
        rows="8"
        placeholder="apple	苹果&#10;1. go /ɡəʊ/ vi. 去；进行"
        class="mb-2 w-full rounded border p-2 font-mono text-sm"
        style="border-color: var(--color-line); background: var(--bg-card-secend)"
      />

      <!-- txt 文件上传 -->
      <div class="mb-2 flex items-center gap-2 text-sm">
        <button
          class="cursor-pointer rounded px-3 py-1.5 text-sm"
          style="border: 1px solid var(--color-line)"
          @click="onPickFile"
        >
          📄 上传 .txt 文件
        </button>
        <span class="opacity-60">读入后填入上方文本框，词书名自动取文件名</span>
        <input ref="fileInput" type="file" accept=".txt" class="hidden" @change="onFileChange" />
      </div>

      <div v-if="entries.length" class="mb-3 text-sm">
        共 {{ entries.length }} 行：
        <span class="text-green-600">有效 {{ validCount }}</span> /
        <span :class="invalidCount ? 'text-red-500' : 'opacity-50'">无效 {{ invalidCount }}</span>
      </div>

      <div v-if="preview.length" class="mb-4 max-h-56 overflow-auto rounded border" style="border-color: var(--color-line)">
        <table class="w-full text-sm">
          <thead class="sticky top-0" style="background: var(--bg-card-secend)">
            <tr>
              <th class="p-1.5 text-left">单词</th>
              <th class="p-1.5 text-left">音标</th>
              <th class="p-1.5 text-left">释义</th>
              <th class="p-1.5 text-left">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(e, i) in preview" :key="i" :class="e.valid ? '' : 'text-red-400'">
              <td class="p-1.5 font-mono">{{ e.word || '—' }}</td>
              <td class="p-1.5 font-mono text-xs opacity-70">{{ e.phonetic }}</td>
              <td class="p-1.5">{{ e.cn || '—' }}</td>
              <td class="p-1.5 text-xs">{{ e.valid ? '✓' : (e.reason ?? '') }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="entries.length > 200" class="p-1.5 text-center text-xs opacity-60">
          仅预览前 200 条，共 {{ entries.length }} 条
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <button class="cursor-pointer rounded px-4 py-2" style="border: 1px solid var(--color-line)" @click="emit('close')">
          取消
        </button>
        <button
          class="cursor-pointer rounded px-4 py-2 text-white disabled:opacity-50"
          style="background: var(--color-primary, #6ea8fe)"
          :disabled="importing || !validCount || (importMode === 'append' && !appendDictId)"
          @click="doImport"
        >
          {{ importing ? '导入中…' : importMode === 'append' ? `追加 ${validCount} 词` : `导入 ${validCount} 词` }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.import-mask {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
}

.import-panel {
  max-height: 85vh;
  width: 45rem;
  max-width: 100%;
  overflow: auto;
  border-radius: 0.75rem;
  padding: 1.5rem;
  background: var(--bg-card-primary);
}
</style>
