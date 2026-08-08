import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Box,
  Button,
  Flex,
  Input,
  Textarea,
  VStack,
  Text,
  Image,
  createListCollection,
  Drawer,
} from '@chakra-ui/react'
import { useCreateBatch } from '../hooks/useBatches'
import ControlledSelect from '../components/ControlledSelect'

const STATUS_OPTIONS = ['ACTIVE', 'COMPLETED', 'FAILED', 'ARCHIVED'] as const

const batchesSchema = z.object({
  batch_name: z.string().min(1, 'Batch name is required'),
  crop_type: z.string().min(1, 'Crop type is required'),
  status: z.enum(STATUS_OPTIONS),
  start_date: z.string().min(1, 'Start date is required'),
  expected_harvest_date: z.string().min(1, 'Expected harvest date is required'),
  location: z.string().min(1, 'Location is required'),
  notes: z.string().optional(),
})

type BatchFormData = z.infer<typeof batchesSchema>

const statusCollection = createListCollection({
  items: STATUS_OPTIONS.map((status) => ({
    label: status.charAt(0) + status.slice(1).toLowerCase(),
    value: status,
  })),
})

export default function BatchDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const createMutation = useCreateBatch()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchesSchema),
    defaultValues: {
      status: 'ACTIVE',
      start_date: new Date().toISOString().split('T')[0],
    },
  })

  // Reset form when drawer closes
  useEffect(() => {
    if (!isOpen) {
      reset()
      setImagePreview(null)
    }
  }, [isOpen, reset])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const onSubmit = async (data: BatchFormData) => {
    try {
      const payload = {
        ...data,
        start_date: new Date(data.start_date).toISOString(),
        expected_harvest_date: new Date(data.expected_harvest_date).toISOString(),
      }

      // Submit and let the hook handle the redirect to the new batch!
      await createMutation.mutateAsync(payload)
      setIsOpen(false)
    } catch (error) {
      alert('An error occurred while saving.')
    }
  }

  return (
    <Drawer.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)} size="md">
      <Drawer.Trigger asChild>
        <Button colorPalette="teal">+ Create New Batch</Button>
      </Drawer.Trigger>

      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>New Batch Entry</Drawer.Title>
          </Drawer.Header>

          <Drawer.Body>
            <form id="batch-form" onSubmit={handleSubmit(onSubmit)}>
              <VStack align="stretch" gap={4}>
                <Box>
                  <Text fontWeight="bold" mb={1}>
                    Batch Name *
                  </Text>
                  <Input {...register('batch_name')} placeholder="e.g., Golden Teacher Batch #1" />
                  {errors.batch_name && (
                    <Text color="red.500" fontSize="sm">
                      {errors.batch_name.message}
                    </Text>
                  )}
                </Box>

                <Box>
                  <Text fontWeight="bold" mb={1}>
                    Species
                  </Text>
                  <Input {...register('crop_type')} placeholder="e.g., Psilocybe cubensis" />
                </Box>

                <Flex gap={4}>
                  <Box flex={1}>
                    <Text fontWeight="bold" mb={1}>
                      Start Date *
                    </Text>
                    <Input type="date" {...register('start_date')} />
                    {errors.start_date && (
                      <Text color="red.500" fontSize="sm">
                        {errors.start_date.message}
                      </Text>
                    )}
                  </Box>
                  <Box flex={1}>
                    <Text fontWeight="bold" mb={1}>
                      Expected Harvest *
                    </Text>
                    <Input type="date" {...register('expected_harvest_date')} />
                    {errors.expected_harvest_date && (
                      <Text color="red.500" fontSize="sm">
                        {errors.expected_harvest_date.message}
                      </Text>
                    )}
                  </Box>
                </Flex>

                <Flex gap={4}>
                  <Box flex={1}>
                    <Text fontWeight="bold" mb={1}>
                      Status *
                    </Text>
                    <ControlledSelect
                      name="status"
                      control={control}
                      collection={statusCollection}
                      placeholder="Select status"
                      error={errors.status?.message}
                    />
                  </Box>
                  <Box flex={1}>
                    <Text fontWeight="bold" mb={1}>
                      Location *
                    </Text>
                    <Input {...register('location')} placeholder="e.g., Greenhouse Room A" />
                    {errors.location && (
                      <Text color="red.500" fontSize="sm">
                        {errors.location.message}
                      </Text>
                    )}
                  </Box>
                </Flex>

                <Box>
                  <Text fontWeight="bold" mb={1}>
                    Notes
                  </Text>
                  <Textarea
                    {...register('notes')}
                    placeholder="Log substrate, temps, humidity..."
                  />
                </Box>

                <Box p={4} borderWidth="1px" borderRadius="md" borderStyle="dashed">
                  <Text fontWeight="bold" mb={2}>
                    Upload Image (Optional)
                  </Text>
                  <Input type="file" accept="image/*" onChange={handleImageChange} p={1} />
                  {imagePreview && (
                    <Box mt={4}>
                      <Text fontSize="sm" mb={1}>
                        Preview:
                      </Text>
                      <Image src={imagePreview} alt="Preview" maxH="200px" borderRadius="md" />
                    </Box>
                  )}
                </Box>
              </VStack>
            </form>
          </Drawer.Body>

          <Drawer.Footer>
            <Drawer.CloseTrigger asChild>
              <Button variant="outline" mr={3}>
                Cancel
              </Button>
            </Drawer.CloseTrigger>
            <Button type="submit" form="batch-form" colorPalette="teal" loading={isSubmitting}>
              Save Entry
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  )
}
