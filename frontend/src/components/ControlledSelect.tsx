import { Portal, Select, Box, Text } from '@chakra-ui/react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'

interface ControlledSelectProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  collection: any
  placeholder?: string
  error?: string
}

export default function ControlledSelect<T extends FieldValues>({
  name,
  control,
  collection,
  placeholder = 'Select option',
  error,
}: ControlledSelectProps<T>) {
  return (
    <Box>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select.Root
            collection={collection}
            name={field.name}
            value={field.value ? [field.value] : []}
            onValueChange={({ value }) => field.onChange(value[0])}
            onInteractOutside={() => field.onBlur()}
          >
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger>
                <Select.ValueText placeholder={placeholder} />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content>
                  {collection.items.map((item: any) => (
                    <Select.Item item={item} key={item.value}>
                      {item.label}
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>
        )}
      />
      {error && (
        <Text color="red.500" fontSize="sm" mt={1}>
          {error}
        </Text>
      )}
    </Box>
  )
}
