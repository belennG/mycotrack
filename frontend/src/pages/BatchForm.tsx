import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Box, Button, Flex, Heading, Input, Textarea, VStack, Text, Image, createListCollection } from '@chakra-ui/react'
import { useBatch, useCreateBatch, useUpdateBatch } from '../hooks/useBatches'
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

export default function BatchForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = Boolean(id)

  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const { data: existingData, isLoading: isLoadingExisting } = useBatch(id)
  const createMutation = useCreateBatch()
  const updateMutation = useUpdateBatch()

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

  useEffect(() => {
    if (isEditMode && existingData) {
      reset({
        batch_name: existingData.batch_name,
        crop_type: existingData.crop_type,
        start_date: existingData.start_date.split('T')[0],
        expected_harvest_date: existingData.expected_harvest_date.split('T')[0],
        status: existingData.status,
        location: existingData.location,
        notes: existingData.notes || '',
      })
    }
  }, [isEditMode, existingData, reset])

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
      if (isEditMode && id) {
        await updateMutation.mutateAsync({ id, payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      navigate('/dashboard')
    } catch (error) {
      alert('An error occurred while saving.')
    }
  }

  if (isEditMode && isLoadingExisting) {
    return <Text>Loading existing tracking data...</Text>
  }

  return (
    <Box maxW="600px" mx="auto">
      <Heading mb={6}>{isEditMode ? 'Edit Entry' : 'New Entry'}</Heading>

      <form onSubmit={handleSubmit(onSubmit)}>
        <VStack align="stretch" gap={4}>

          <Box>
            <Text fontWeight="bold" mb={1}>Batch Name *</Text>
            <Input {...register('batch_name')} placeholder="e.g., Golden Teacher Batch #1" />
            {errors.batch_name && <Text color="red.500" fontSize="sm">{errors.batch_name.message}</Text>}
          </Box>

          <Box>
            <Text fontWeight="bold" mb={1}>Species</Text>
            <Input {...register('crop_type')} placeholder="e.g., Psilocybe cubensis" />
          </Box>

          <Flex gap={4}>
            <Box flex={1}>
              <Text fontWeight="bold" mb={1}>Start Date *</Text>
              <Input type="date" {...register('start_date')} />
              {errors.start_date && <Text color="red.500" fontSize="sm">{errors.start_date.message}</Text>}
            </Box>
            <Box flex={1}>
                <Text fontWeight="bold" mb={1}>Expected Harvest *</Text>
                <Input type="date" {...register('expected_harvest_date')} />
                {errors.expected_harvest_date && <Text color="red.500" fontSize="sm">{errors.expected_harvest_date.message}</Text>}
            </Box>
          </Flex>

          <Flex gap={4}>
            <Box flex={1}>
              <Text fontWeight="bold" mb={1}>Status *</Text>
              <ControlledSelect
                name="status"
                control={control}
                collection={statusCollection}
                placeholder="Select status"
                error={errors.status?.message}
              />
              {errors.status && <Text color="red.500" fontSize="sm">{errors.status.message}</Text>}
            </Box>
            <Box flex={1}>
              <Text fontWeight="bold" mb={1}>Location *</Text>
              <Input {...register('location')} placeholder="e.g., Greenhouse Room A" />
              {errors.location && <Text color="red.500" fontSize="sm">{errors.location.message}</Text>}
            </Box>
          </Flex>

          <Box>
            <Text fontWeight="bold" mb={1}>Notes</Text>
            <Textarea {...register('notes')} placeholder="Log substrate, temps, humidity..." />
          </Box>

          {/* Optional Image Upload UI */}
          <Box p={4} borderWidth="1px" borderRadius="md" borderStyle="dashed">
            <Text fontWeight="bold" mb={2}>Upload Image (Optional)</Text>
            <Input type="file" accept="image/*" onChange={handleImageChange} p={1} />
            {imagePreview && (
              <Box mt={4}>
                <Text fontSize="sm" mb={1}>Preview:</Text>
                <Image src={imagePreview} alt="Preview" maxH="200px" borderRadius="md" />
              </Box>
            )}
          </Box>

          <Flex justify="flex-end" gap={4} mt={4}>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Cancel
            </Button>
            <Button colorScheme="teal" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Entry'}
            </Button>
          </Flex>

        </VStack>
      </form>
    </Box>
  )
}
