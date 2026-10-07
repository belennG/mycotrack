import { Flex, Spinner, Text, VStack } from '@chakra-ui/react'

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <Flex minH="100vh" align="center" justify="center">
      <VStack gap={3}>
        <Spinner size="xl" color="teal.500" />
        <Text color="gray.500">{label}</Text>
      </VStack>
    </Flex>
  )
}
