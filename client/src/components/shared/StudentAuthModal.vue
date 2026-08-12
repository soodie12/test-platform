<script setup lang="ts">
import { ref } from 'vue';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import type { User } from '../../types';

const props = defineProps<{
  show: boolean;
  examId?: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const authStore = useAuthStore();
const mode = ref<'login' | 'register'>('register');

const rollNumber = ref('');
const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleSubmit() {
  error.value = '';
  loading.value = true;

  try {
    if (mode.value === 'register') {
      if (!rollNumber.value || !firstName.value || !lastName.value || !email.value || !password.value) {
        error.value = 'All fields are required.';
        loading.value = false;
        return;
      }

      await api.post('/auth/register', {
        rollNumber: rollNumber.value.trim(),
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        email: email.value.trim(),
        password: password.value,
      });

      // Auto-login after registration
      const { data: loginData } = await api.post<{ accessToken: string; user: User }>('/auth/login', {
        email: email.value.trim(),
        password: password.value,
      });

      authStore.setToken(loginData.accessToken);
      authStore.setUser(loginData.user);
    } else {
      if (!email.value || !password.value) {
        error.value = 'Email and password are required.';
        loading.value = false;
        return;
      }

      const { data: loginData } = await api.post<{ accessToken: string; user: User }>('/auth/login', {
        email: email.value.trim(),
        password: password.value,
      });

      authStore.setToken(loginData.accessToken);
      authStore.setUser(loginData.user);
    }

    // Auto-enroll in the current exam if provided
    if (props.examId) {
      try {
        await api.post(`/exams/${props.examId}/enroll`);
      } catch {
        /* ignore if already enrolled */
      }
    }

    emit('success');
  } catch (err: unknown) {
    const res = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
    if (res?.status === 409) {
      error.value = res.data?.message || 'Account with this email or roll number already exists. Try Signing In.';
    } else if (res?.status === 401) {
      error.value = 'Invalid credentials. Please check your email and password.';
    } else {
      error.value = 'Authentication failed. Please try again.';
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-card">
        <button class="close-btn" @click="emit('close')">
          <span class="material-symbols-outlined">close</span>
        </button>

        <div class="modal-header">
          <div class="icon-wrap">
            <span class="material-symbols-outlined">badge</span>
          </div>
          <h2 class="title">Student Information</h2>
          <p class="subtitle">Please enter your identity details to enter the contest</p>
        </div>

        <div class="tabs">
          <button
            class="tab"
            :class="mode === 'register' ? 'active' : ''"
            @click="mode = 'register'; error = '';"
          >
            New Student
          </button>
          <button
            class="tab"
            :class="mode === 'login' ? 'active' : ''"
            @click="mode = 'login'; error = '';"
          >
            Existing Student
          </button>
        </div>

        <form class="form" @submit.prevent="handleSubmit">
          <template v-if="mode === 'register'">
            <div class="field">
              <label class="label">Roll Number / Student ID *</label>
              <input
                v-model="rollNumber"
                type="text"
                class="input"
                placeholder="e.g. 20CS101"
                required
              />
            </div>

            <div class="grid-2">
              <div class="field">
                <label class="label">First Name *</label>
                <input
                  v-model="firstName"
                  type="text"
                  class="input"
                  placeholder="John"
                  required
                />
              </div>
              <div class="field">
                <label class="label">Last Name *</label>
                <input
                  v-model="lastName"
                  type="text"
                  class="input"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>
          </template>

          <div class="field">
            <label class="label">Email Address *</label>
            <input
              v-model="email"
              type="email"
              class="input"
              placeholder="student@university.edu"
              required
            />
          </div>

          <div class="field">
            <label class="label">Password *</label>
            <input
              v-model="password"
              type="password"
              class="input"
              placeholder="••••••••"
              required
            />
          </div>

          <div v-if="error" class="error-msg">
            <span class="material-symbols-outlined text-[14px]">error</span>
            {{ error }}
          </div>

          <button type="submit" class="submit-btn" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            {{ loading ? 'Authenticating...' : (mode === 'register' ? 'Start Exam' : 'Log In & Start Exam') }}
          </button>
        </form>
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
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  padding: 16px;
}

.modal-card {
  position: relative;
  width: 100%;
  max-width: 440px;
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8);
  font-family: 'Figtree', sans-serif;
  color: #f1f5f9;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}
.close-btn:hover {
  color: #f1f5f9;
}

.modal-header {
  text-align: center;
  margin-bottom: 20px;
}

.icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgb(var(--color-primary) / 0.15);
  color: rgb(var(--color-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px;
}

.subtitle {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

.tabs {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.04);
  padding: 3px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.tab {
  flex: 1;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 600;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.tab.active {
  background: rgb(var(--color-primary));
  color: #0b0f19;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}

.input {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: #f1f5f9;
  outline: none;
}
.input:focus {
  border-color: rgb(var(--color-primary));
  box-shadow: 0 0 0 2px rgb(var(--color-primary) / 0.2);
}

.error-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
  padding: 8px 12px;
  border-radius: 8px;
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgb(var(--color-primary));
  color: #0b0f19;
  font-weight: 700;
  font-size: 14px;
  padding: 12px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 6px;
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
