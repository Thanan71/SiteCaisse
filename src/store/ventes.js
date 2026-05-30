import { defineStore } from 'pinia'
import axios from 'axios'

export const useVentesStore = defineStore('ventes', {
  state: () => ({
    ventes: [],
    loading: false,
    error: null
  }),

  getters: {
    totalVentes: (state) => state.ventes.length
  },

  actions: {
    async fetchVentes() {
      this.loading = true
      this.error = null
      try {
        const response = await axios.get('/api/ventes')
        this.ventes = response.data
      } catch (error) {
        this.error = error.response?.data?.error || 'Erreur lors du chargement des ventes'
        throw error
      } finally {
        this.loading = false
      }
    },

    async addVente(data) {
      this.loading = true
      this.error = null
      try {
        await axios.post('/api/ventes', data)
        await this.fetchVentes()
      } catch (error) {
        this.error = error.response?.data?.error || "Erreur lors de l'ajout de la vente"
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateVente(id, data) {
      this.loading = true
      this.error = null
      try {
        await axios.put(`/api/ventes/${id}`, data)
        await this.fetchVentes()
      } catch (error) {
        this.error = error.response?.data?.error || 'Erreur lors de la modification'
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteVente(id) {
      this.loading = true
      this.error = null
      try {
        await axios.delete(`/api/ventes/${id}`)
        await this.fetchVentes()
      } catch (error) {
        this.error = error.response?.data?.error || 'Erreur lors de la suppression'
        throw error
      } finally {
        this.loading = false
      }
    }
  }
})