import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Flex,
  SimpleGrid,
  Input,
  Textarea,
  Dialog,
} from '@chakra-ui/react'
import { useTrackings } from '../hooks/useTrackings'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreateTracking } from '../hooks/useCreateTracking'

const trackingSchema = z.object({
  tracking_date: z.string().min(1, 'Date is required'),

  temperature: z
    .number({ message: 'Temperature is required' })
    .min(0, 'Must be at least 0')
    .max(100, 'Cannot exceed 100'),

  humidity: z
    .number({ message: 'Humidity is required' })
    .min(0, 'Must be at least 0')
    .max(100, 'Cannot exceed 100'),

  ph_level: z
    .number({ message: 'pH level is required' })
    .min(0, 'Must be at least 0')
    .max(14, 'Cannot exceed 14'),

  moisture: z
    .number({ message: 'Moisture is required' })
    .min(0, 'Must be at least 0')
    .max(100, 'Cannot exceed 100'),

  notes: z.string().optional(),
})

type TrackingFormValues = z.infer<typeof trackingSchema>

export default function Trackings() {
  const { batchId } = useParams<{ batchId: string }>()
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data, isLoading, isError, refetch } = useTrackings(batchId || '', page)
  const createTracking = useCreateTracking()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TrackingFormValues>({
    resolver: zodResolver(trackingSchema),
    defaultValues: {
      tracking_date: new Date().toISOString().slice(0, 16),
    },
  })

  const onSubmit = async (formData: TrackingFormValues) => {
    if (!batchId) return

    try {
      await createTracking.mutateAsync({
        ...formData,
        batch_id: batchId,
      })
      reset()
      setIsModalOpen(false)
    } catch (error) {
      console.error('Failed to save tracking', error)
    }
  }

  if (!batchId) {
    return <Text color="red.500">Error: No Batch ID provided in the URL.</Text>
  }

  return (
    <Box>
      {/* HEADER & ADD BUTTON */}
      <Flex justify="space-between" align="center" mb={6}>
        <Heading>Trackings</Heading>

        <Dialog.Root open={isModalOpen} onOpenChange={(e) => setIsModalOpen(e.open)}>
          <Dialog.Trigger asChild>
            <Button colorPalette="teal">+ Add New Tracking</Button>
          </Dialog.Trigger>

          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Record Daily Log</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <form id="tracking-form" onSubmit={handleSubmit(onSubmit)}>
                <VStack align="stretch" gap={4}>
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={1}>
                      Tracking Date & Time *
                    </Text>
                    <Input type="datetime-local" {...register('tracking_date')} />
                    {errors.tracking_date && (
                      <Text color="red.500" fontSize="xs" mt={1}>
                        {errors.tracking_date.message}
                      </Text>
                    )}
                  </Box>

                  <SimpleGrid columns={2} gap={4}>
                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={1}>
                        Temperature (°C)
                      </Text>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="24.5"
                        {...register('temperature', { valueAsNumber: true })}
                      />
                      {errors.temperature && (
                        <Text color="red.500" fontSize="xs" mt={1}>
                          {errors.temperature.message}
                        </Text>
                      )}
                    </Box>

                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={1}>
                        Humidity (%)
                      </Text>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="85.0"
                        {...register('humidity', { valueAsNumber: true })}
                      />
                      {errors.humidity && (
                        <Text color="red.500" fontSize="xs" mt={1}>
                          {errors.humidity.message}
                        </Text>
                      )}
                    </Box>

                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={1}>
                        pH Level
                      </Text>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="6.5"
                        {...register('ph_level', { valueAsNumber: true })}
                      />
                      {errors.ph_level && (
                        <Text color="red.500" fontSize="xs" mt={1}>
                          {errors.ph_level.message}
                        </Text>
                      )}
                    </Box>

                    <Box>
                      <Text fontSize="sm" fontWeight="medium" mb={1}>
                        Moisture (%)
                      </Text>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="60.0"
                        {...register('moisture', { valueAsNumber: true })}
                      />
                      {errors.moisture && (
                        <Text color="red.500" fontSize="xs" mt={1}>
                          {errors.moisture.message}
                        </Text>
                      )}
                    </Box>
                  </SimpleGrid>

                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={1}>
                      Notes
                    </Text>
                    <Textarea placeholder="Any observations?" {...register('notes')} />
                  </Box>
                </VStack>
              </form>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" mr={3}>
                  Cancel
                </Button>
              </Dialog.CloseTrigger>
              <Button type="submit" form="tracking-form" colorPalette="teal" loading={isSubmitting}>
                Save Log
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>

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
          <Button colorPalette="red" onClick={() => refetch()}>
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

                  <SimpleGrid columns={4} gap={4} mt={3}>
                    <Box>
                      <Text fontSize="xs" color="gray.500">
                        Temp
                      </Text>
                      <Text fontWeight="bold">{item.temperature || '--'} °C</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">
                        Humidity
                      </Text>
                      <Text fontWeight="bold">{item.humidity || '--'} %</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">
                        pH Level
                      </Text>
                      <Text fontWeight="bold">{item.ph_level || '--'}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">
                        Moisture
                      </Text>
                      <Text fontWeight="bold">{item.moisture || '--'} %</Text>
                    </Box>
                  </SimpleGrid>

                  {item.notes && (
                    <Text
                      mt={3}
                      fontSize="sm"
                      color="gray.700"
                      bg="gray.50"
                      p={2}
                      borderRadius="md"
                    >
                      {item.notes}
                    </Text>
                  )}
                </Box>
              ))
            )}
          </VStack>

          {/* PAGINATION CONTROLS */}
          <HStack justify="space-between" mt={8}>
            <Button disabled={page === 1} onClick={() => setPage((old) => Math.max(old - 1, 1))}>
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
