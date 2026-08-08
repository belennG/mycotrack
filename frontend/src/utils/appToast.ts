import { toaster } from '../components/ui/toaster'

/**
 * Standardized success and error notifications across MycoTrack.
 * Can be used anywhere, even outside of React components.
 */
export const appToast = {
  success: (title: string, description?: string) => {
    toaster.create({
      title,
      description,
      type: 'success',
      duration: 4000,
    })
  },
  error: (title: string, description?: string) => {
    toaster.create({
      title,
      description,
      type: 'error',
      duration: 6000,
    })
  },
  info: (title: string, description?: string) => {
    toaster.create({
      title,
      description,
      type: 'info',
      duration: 4000,
    })
  },
}
