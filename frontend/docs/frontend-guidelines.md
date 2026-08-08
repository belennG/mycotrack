## Toast Notifications

MycoTrack uses a unified custom hook (`useAppToast`) for all user feedback.

**How to trigger toasts:**
1. Import the hook into your component or custom hook:
   ```typescript
   import { useAppToast } from '../hooks/useAppToast'

2. Initilise it:
    ```typescript
    const toast = useAppToast()

3. Call the appropriate method:
    ```typescript
    // Success
    toast.success('Action Successful', 'Your data was saved.')
    // Error
    toast.error('Submission Failed', 'Please check your inputs and try again.')
    // Info
    toast.info('Update Available', 'A new version of the dashboard is ready.')
