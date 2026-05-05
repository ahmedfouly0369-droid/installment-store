import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, UserRole } from '@shared/types'

interface AuthState {
  token: string | null
  user: User | null
  setSession: (token: string, user: User) => void
  clear: () => void
  hasRole: (roles: UserRole[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      clear: () => set({ token: null, user: null }),
      hasRole: roles => {
        const role = get().user?.role
        return role ? roles.includes(role) : false
      }
    }),
    { name: 'installment-store-auth' }
  )
)
