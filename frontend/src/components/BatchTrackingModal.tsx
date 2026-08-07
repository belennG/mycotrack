import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Box, Button, Dialog, Input, SimpleGrid, Text, Textarea, VStack } from '@chakra-ui/react'
import { useCreateTracking } from '../hooks/useCreateTracking'
import type { DashboardBatch } from '../types/batch'

const trackingSchema = z.object({
  tracking_date: z.string().min(1, 'Date and time are required'),
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

interface BatchTrackingModalProps {
  activeBatches: DashboardBatch[]
}

export default function BatchTrackingModal({ activeBatches }: BatchTrackingModalProps) {
  const navigate = useNavigate()
  const createTracking = useCreateTracking()

  const [isOpen, setIsOpen] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!isOpen) {
      setSelectedBatchId(null)
      reset()
    }
  }, [isOpen, reset])

  const onSubmit = async (formData: TrackingFormValues) => {
    if (!selectedBatchId) return

    try {
      await createTracking.mutateAsync({
        ...formData,
        batch_id: selectedBatchId,
      })

      setIsOpen(false)
      navigate(`/batches/${selectedBatchId}/trackings`)
    } catch (error) {
      console.error('Failed to save tracking', error)
      alert('Failed to save tracking log.')
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
      <Dialog.Trigger asChild>
        <Button variant="outline">+ Create New Tracking</Button>
      </Dialog.Trigger>

      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{!selectedBatchId ? 'Select a Batch' : 'Record Daily Log'}</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body>
            {/* STEP 1: SELECT BATCH */}
            {!selectedBatchId ? (
              <VStack align="stretch" gap={3}>
                <Text fontSize="sm" color="gray.600" mb={2}>
                  Which batch are you recording data for today?
                </Text>
                {activeBatches.length === 0 ? (
                  <Text color="red.500">No active batches available.</Text>
                ) : (
                  activeBatches.map((batch) => (
                    <Button
                      key={batch.id}
                      variant="outline"
                      justifyContent="flex-start"
                      onClick={() => setSelectedBatchId(batch.id)}
                    >
                      {batch.batch_name}
                    </Button>
                  ))
                )}
              </VStack>
            ) : (
              /* STEP 2: TRACKING FORM */
              <form id="global-tracking-form" onSubmit={handleSubmit(onSubmit)}>
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
            )}
          </Dialog.Body>

          <Dialog.Footer>
            {/* If a batch is selected, allow them to go back to the selection screen */}
            {selectedBatchId && (
              <Button variant="ghost" mr="auto" onClick={() => setSelectedBatchId(null)}>
                Back
              </Button>
            )}

            <Dialog.CloseTrigger asChild>
              <Button variant="outline" mr={3}>
                Cancel
              </Button>
            </Dialog.CloseTrigger>

            {/* Only show the Save button if they are actually on the form step */}
            {selectedBatchId && (
              <Button
                type="submit"
                form="global-tracking-form"
                colorPalette="teal"
                loading={isSubmitting}
              >
                Save Log
              </Button>
            )}
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
