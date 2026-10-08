import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react'

/**
 * Shown when Auth0 reports an error (e.g. the login redirect failed). A full page load of
 * /login is deliberate: it clears the failed Auth0 state, which a client-side navigation
 * would keep.
 */
export function AuthErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" p={6}>
      <VStack gap={4} maxW="md" textAlign="center" role="alert">
        <Heading size="lg" color="red.500">
          {title}
        </Heading>
        <Text color="gray.600">{message}</Text>
        <Button colorPalette="teal" onClick={() => window.location.assign('/login')}>
          Back to login
        </Button>
      </VStack>
    </Box>
  )
}
