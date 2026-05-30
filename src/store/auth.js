import { defineStore } from 'pinia'
import axios from 'axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token') || ''
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    isPermanent: (state) => state.user?.role === 'permanent',
    userName: (state) => state.user?.nom || ''
  },

  actions: {
    async login(email, password) {
      const response = await axios.post('/api/auth/login', { email, password })
      const { token, user } = response.data

      this.token = token
      this.user = user

      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))

      return user
    },

    async fetchUser() {
      try {
        const response = await axios.get('/api/auth/me')
        this.user = response.data
        localStorage.setItem('user', JSON.stringify(this.user))
      } catch (error) {
        this.logout()
        throw error
      }
    },

    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }
})