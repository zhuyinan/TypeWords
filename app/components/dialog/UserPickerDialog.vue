<script setup lang="ts">
import { scopedKey, setActiveUser } from '@/core/utils/userScope'

const emit = defineEmits<{ chosen: [name: string] }>()

const users = [
  { id: 'duoduo', name: '朵朵', emoji: '🐰', desc: '四选一练习' },
  { id: 'miaomiao', name: '苗苗', emoji: '🐯', desc: '拼写 + 听写' },
]

function pick(id: string) {
  setActiveUser(id)
  // 家用版：跳过上游新手引导（所有页面共用此标记）
  localStorage.setItem(scopedKey('tour-guide'), '1')
  emit('chosen', id)
  location.reload()
}
</script>

<template>
  <div class="user-picker-mask">
    <h1 class="title">今天谁来背单词？</h1>
    <div class="cards">
      <button v-for="u in users" :key="u.id" class="card" @click="pick(u.id)">
        <span class="emoji">{{ u.emoji }}</span>
        <span class="name">{{ u.name }}</span>
        <span class="desc">{{ u.desc }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.user-picker-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  background: var(--bg-card-primary);
}

.title {
  font-size: 2rem;
  font-weight: bold;
}

.cards {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2.5rem;
  padding: 0 1rem;
}

.card {
  display: flex;
  width: 13rem;
  cursor: pointer;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  border: 4px solid var(--color-line);
  border-radius: 1.5rem;
  padding: 2rem 0;
  background: transparent;
  color: inherit;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.card:hover {
  transform: scale(1.05);
  border-color: #6ea8fe;
}

.emoji {
  font-size: 4.5rem;
  line-height: 1;
}

.name {
  font-size: 1.5rem;
  font-weight: bold;
}

.desc {
  font-size: 0.875rem;
  opacity: 0.6;
}
</style>
