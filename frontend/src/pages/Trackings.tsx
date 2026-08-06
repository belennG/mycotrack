import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Heading, Text, Button, VStack, HStack, Flex, SimpleGrid } from '@chakra-ui/react'
import { useTrackings } from '../hooks/useTrackings'

export default function Trackings() {
  const { batchId } = useParams<{ batchId: string }>()
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, refetch } = useTrackings(batchId || '', page)

  if (!batchId) {
    return <Text color="red.500">Error: No Batch ID provided in the URL.</Text>
  }

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
              <Text color="gray.500">No logs found for this batch.</Text>
            ) : (
              data.items.map((item) => (
                <Box key={item.id} p={4} borderWidth="1px" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={2}>
                    <Heading size="sm">
                      Log Date: {new Date(item.tracking_date).toLocaleDateString()}
                    </Heading>
                    <Text fontSize="xs" color="gray.500">
                      Added: {new Date(item.created_at).toLocaleTimeString()}
                    </Text>
                  </Flex>

                  {/* Displaying actual Tracking data */}
                  <SimpleGrid columns={4} gap={4} mt={3}>
                    <Box>
                      <Text fontSize="xs" color="gray.500">Temp</Text>
                      <Text fontWeight="bold">{item.temperature || '--'} °C</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">Humidity</Text>
                      <Text fontWeight="bold">{item.humidity || '--'} %</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">pH Level</Text>
                      <Text fontWeight="bold">{item.ph_level || '--'}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">Moisture</Text>
                      <Text fontWeight="bold">{item.moisture || '--'} %</Text>
                    </Box>
                  </SimpleGrid>

                  {item.notes && (
                    <Text mt={3} fontSize="sm" color="gray.700" bg="gray.50" p={2} borderRadius="md">
                      {item.notes}
                    </Text>
                  )}
                </Box>
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
              Page {page} of {Math.ceil((data.total || 1) / 10)}
            </Text>
            <Button
              disabled={page >= Math.ceil((data.total || 1) / 10)}
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
