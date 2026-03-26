'use client'

import { useState, useEffect } from 'react'
import type { HocuspocusProvider } from '@hocuspocus/provider'

export interface PresenceUser {
  clientId: number
  name: string
  color: string
  userId: string
}

/**
 * React hook that subscribes to Hocuspocus provider awareness
 * and returns the list of connected users with their presence data.
 *
 * Returns an empty array when provider is null (single-user mode).
 */
export function usePresence(provider: HocuspocusProvider | null): PresenceUser[] {
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!provider) {
      setUsers([])
      return
    }

    const awareness = provider.awareness
    if (!awareness) {
      setUsers([])
      return
    }

    const updateUsers = () => {
      const states = awareness.getStates() as Map<
        number,
        { user?: { name: string; color: string; userId: string } }
      >
      const result: PresenceUser[] = []

      states.forEach((state, clientId) => {
        if (state.user) {
          result.push({
            clientId,
            name: state.user.name,
            color: state.user.color,
            userId: state.user.userId,
          })
        }
      })

      setUsers(result)
    }

    // Initial read
    updateUsers()

    // Subscribe to awareness changes
    awareness.on('change', updateUsers)
    awareness.on('update', updateUsers)

    return () => {
      awareness.off('change', updateUsers)
      awareness.off('update', updateUsers)
    }
  }, [provider])

  return users
}
