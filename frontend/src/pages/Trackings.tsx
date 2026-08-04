import { useState } from 'react'
import { Box, Heading, Text, Button, VStack, HStack, Flex } from '@chakra-ui/react'
import { useTrackings } from '../hooks/useTrackings'

export default function Trackings() {
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, refetch } = useTrackings(page)

  return (
    <Box>
      <Heading mb={6}>Trackings</Heading>

      {/* LOADING STATE */}
      {isLoading && (
        <VStack align="stretch" gap={4}>
          {[1, 2, 3].map((skeleton) => (
            <Box
              key={skeleton}
              h="80px"
              bg="gray.100"
              borderRadius="md"
              animation="pulse 1.5s infinite"
            />
          ))}
        </VStack>
      )}

      {/* ERROR STATE */}
      {isError && (
        <Box p={6} bg="red.50" color="red.700" borderRadius="md" textAlign="center">
          <Text mb={4}>Failed to load trackings. The server might be unreachable.</Text>
          <Button colorScheme="red" onClick={() => refetch()}>
            Retry Connection
          </Button>
        </Box>
      )}

      {/* SUCCESS / DATA STATE */}
      {!isLoading && !isError && data && (
        <>
          <VStack align="stretch" gap={4}>
            {data.items.length === 0 ? (
              <Text color="gray.500">No active trackings found.</Text>
            ) : (
              data.items.map((item) => (
                <Flex
                  key={item.id}
                  p={4}
                  borderWidth="1px"
                  borderRadius="md"
                  justify="space-between"
                  align="center"
                  shadow="sm"
                >
                  <Box>
                    <Heading size="md">{item.batch_name}</Heading>
                    <Text fontSize="sm" color="gray.500">
                      Last Updated: {new Date(item.updated_at).toLocaleDateString()}
                    </Text>
                  </Box>
                  <Box px={3} py={1} bg="teal.100" color="teal.800" borderRadius="full" fontSize="sm" fontWeight="bold">
                    {item.status}
                  </Box>
                </Flex>
              ))
            )}
          </VStack>

          {/* PAGINATION CONTROLS */}
          <HStack justify="space-between" mt={8}>
            <Button
              disabled={page === 1}
              onClick={() => setPage((old) => Math.max(old - 1, 1))}
            >
              Previous
            </Button>
            <Text fontSize="sm" color="gray.600">
              Page {page} of {data.total || 1}
            </Text>
            <Button
              disabled={page >= (data.total || 1)}
              onClick={() => setPage((old) => old + 1)}
            >
              Next
            </Button>
          </HStack>
        </>
      )}
    </Box>
  )
}
