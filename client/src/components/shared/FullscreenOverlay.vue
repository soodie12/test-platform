<script setup lang="ts">
defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'enter-fullscreen'): void;
}>();
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="overlay">
      <div class="card">
        <div class="icon-ring">
          <span class="material-symbols-outlined text-[32px]">fullscreen</span>
        </div>

        <h2 class="title">Fullscreen Mode Required</h2>
        <p class="description">
          To maintain contest integrity, this coding exam must be taken in Fullscreen mode. Leaving fullscreen is recorded as a proctoring violation.
        </p>

        <button class="action-btn" @click="emit('enter-fullscreen')">
          <span class="material-symbols-outlined text-[18px]">open_in_full</span>
          Re-Enter Fullscreen Mode
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(11, 15, 25, 0.94);
  backdrop-filter: blur(16px);
  padding: 24px;
}

.card {
  max-width: 440px;
  width: 100%;
  background: #0d1117;
  border: 1px solid rgba(0, 214, 108, 0.3);
  border-radius: 20px;
  padding: 32px 28px;
  text-align: center;
  box-shadow: 0 0 50px rgba(0, 214, 108, 0.15);
}

.icon-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(0, 214, 108, 0.12);
  color: #00d66c;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 18px;
  border: 1px solid rgba(0, 214, 108, 0.25);
}

.title {
  font-size: 20px;
  font-weight: 800;
  color: #f1f5f9;
  margin: 0 0 10px;
}

.description {
  font-size: 13px;
  line-height: 1.6;
  color: #94a3b8;
  margin: 0 0 24px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 20px;
  background: #00d66c;
  color: #0b0f19;
  font-weight: 700;
  font-size: 14px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 20px rgba(0, 214, 108, 0.3);
}

.action-btn:hover {
  transform: translateY(-1px);
  background: #00e676;
  box-shadow: 0 6px 28px rgba(0, 214, 108, 0.45);
}
</style>
