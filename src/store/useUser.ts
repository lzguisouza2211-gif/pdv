import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

interface UserStore {
  user: User | null
  setUser: (u: User | null) => void
}

export const useUser = create<UserStore>((set) => ({
  user: null,
  setUser: (u) => set({ user: u }),
}))
