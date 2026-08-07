import { useNavigate } from 'react-router-dom'
import { Box, Heading, Text, VStack, HStack, SimpleGrid, Badge, Flex } from '@chakra-ui/react'
import { useDashboard } from '../hooks/useBatches'
import type { DashboardBatch } from '../types/batch'
import BatchTrackingModal from '../components/BatchTrackingModal'
import BatchDrawer from '../components/BatchDrawer'

const STATUSES = ['ACTIVE', 'COMPLETED', 'FAILED', 'ARCHIVED'] as const

const statusColors: Record<string, string> = {
  ACTIVE: 'teal',
  COMPLETED: 'blue',
  FAILED: 'red',
  ARCHIVED: 'gray',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useDashboard()

  const totalBatches = data ? Object.values(data).reduce((acc, group) => acc + group.length, 0) : 0

  if (isLoading) return <Text p={6}>Loading your cultivation dashboard...</Text>
  if (isError)
    return (
      <Text p={6} color="red.500">
        Failed to load dashboard data.
      </Text>
    )

  return (
    <Box>
      {/* HEADER ACTIONS */}
      <Flex justify="space-between" align="center" mb={8} wrap="wrap" gap={4}>
        <Heading>Cultivation Dashboard</Heading>
        <HStack gap={4}>
          {totalBatches > 0 && <BatchTrackingModal activeBatches={data?.ACTIVE || []} />}

          <BatchDrawer />
        </HStack>
      </Flex>

      {/* KANBAN BOARD (4 COLUMNS) */}
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap={6} alignItems="start">
        {STATUSES.map((status) => (
          <VStack key={status} align="stretch" p={4} bg="gray.50" borderRadius="lg" minH="500px">
            {/* COLUMN HEADER */}
            <Flex justify="space-between" align="center" mb={2}>
              <Heading size="md" color={`${statusColors[status]}.700`}>
                {status}
              </Heading>
              <Badge colorPalette={statusColors[status]} borderRadius="full">
                {data?.[status]?.length || 0}
              </Badge>
            </Flex>
            <Box h="2px" bg={`${statusColors[status]}.200`} w="100%" mb={2} />

            {/* BATCH CARDS */}
            {data?.[status]?.length === 0 ? (
              <Text color="gray.400" fontSize="sm" textAlign="center" mt={4}>
                No batches
              </Text>
            ) : (
              data?.[status]?.map((batch: DashboardBatch) => (
                <Box
                  key={batch.id}
                  p={4}
                  bg="white"
                  borderRadius="md"
                  shadow="sm"
                  borderWidth="1px"
                  borderColor="gray.200"
                  cursor="pointer"
                  _hover={{ shadow: 'md', borderColor: 'teal.300', transform: 'translateY(-2px)' }}
                  transition="all 0.2s"
                  onClick={() => navigate(`/batches/${batch.id}/trackings`)}
                >
                  <Heading size="sm" mb={1} lineClamp={1} color={'black'}>
                    {batch.batch_name}
                  </Heading>

                  {batch.notes && (
                    <Text fontSize="xs" color="gray.500" mb={3} lineClamp={2}>
                      {batch.notes}
                    </Text>
                  )}

                  {/* LATEST TRACKING SUMMARY */}
                  <Box mt={3} p={2} bg="gray.50" borderRadius="sm" borderWidth="1px">
                    <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={1}>
                      Latest Log
                    </Text>
                    {batch.latest_tracking ? (
                      <HStack justify="space-between" fontSize="xs">
                        <Text color={'black'}>
                          🌡️ {batch.latest_tracking.temperature || '--'} °C
                        </Text>
                        <Text color={'black'}>💧 {batch.latest_tracking.humidity || '--'} %</Text>
                        <Text color={'black'}>🧪 {batch.latest_tracking.ph_level || '--'} </Text>
                      </HStack>
                    ) : (
                      <Text fontSize="xs" color="gray.400">
                        No logs yet.
                      </Text>
                    )}
                  </Box>
                </Box>
              ))
            )}
          </VStack>
        ))}
      </SimpleGrid>
    </Box>
  )
}
