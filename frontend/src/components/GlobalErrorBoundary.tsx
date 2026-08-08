import { Box, Heading, Text, Button, VStack } from '@chakra-ui/react'
import { type FallbackProps } from 'react-error-boundary'

export function GlobalErrorBoundary({ error, resetErrorBoundary }: FallbackProps) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  return (
    <Box
      h="100vh"
      w="100vw"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="gray.50"
    >
      <VStack gap={6} p={8} bg="white" shadow="lg" rounded="md" maxW="md" textAlign="center">
        <Heading size="lg" color="red.500">
          Something went wrong
        </Heading>
        <Text color="gray.600">MycoTrack encountered an unexpected error.</Text>

        {/* Optional: Show snippet of the error for easier debugging */}
        <Box p={3} bg="gray.100" rounded="md" w="full" overflowX="auto">
          <Text fontSize="sm" color="red.800" fontFamily="monospace">
            {errorMessage}
          </Text>
        </Box>

        <VStack w="full" gap={3}>
          <Button colorScheme="blue" w="full" onClick={resetErrorBoundary}>
            Reload Application
          </Button>
          <Button
            variant="outline"
            w="full"
            onClick={() =>
              window.open('https://github.com/your-repo/mycotrack/issues/new', '_blank')
            }
          >
            Report Issue
          </Button>
        </VStack>
      </VStack>
    </Box>
  )
}
