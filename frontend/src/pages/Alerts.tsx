import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Badge, Box, Button, Flex, Heading, HStack, Text, VStack } from '@chakra-ui/react'
import { ALERTS_PAGE, useAcknowledgeAlert, useAlerts, type AlertFilter } from '../hooks/useAlerts'
import type { Alert } from '../types/alert'

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

/** "Warning": heading out of range. "Critical": already out of range. */
const severityLabel = (severity: string) => (severity === 'critical' ? 'Critical' : 'Warning')

function AlertCard({
  alert,
  onAcknowledge,
  busy,
}: {
  alert: Alert
  onAcknowledge?: () => void
  busy: boolean
}) {
  const critical = alert.severity === 'critical'
  return (
    <Box
      as="li"
      listStyleType="none"
      borderWidth="1px"
      borderLeftWidth="4px"
      borderLeftColor={critical ? 'red.500' : 'orange.400'}
      rounded="md"
      p={4}
    >
      <Flex justify="space-between" align="start" gap={3} wrap="wrap">
        <VStack align="start" gap={1} flex="1" minW="220px">
          <HStack gap={2}>
            <Badge colorPalette={critical ? 'red' : 'orange'}>
              {severityLabel(alert.severity)}
            </Badge>
            <RouterLink to={`/batches/${alert.batch_id}/trackings`} style={{ fontWeight: 600 }}>
              {alert.batch_name}
            </RouterLink>
          </HStack>
          <Text>{alert.message}</Text>
          <Text fontSize="xs" color="fg.muted">
            Raised {formatTime(alert.created_at)}
            {alert.acknowledged_at ? ` · acknowledged ${formatTime(alert.acknowledged_at)}` : ''}
          </Text>
        </VStack>
        {onAcknowledge && (
          <Button
            size="sm"
            variant="outline"
            aria-label={`Acknowledge the alert for ${alert.batch_name}`}
            disabled={busy}
            onClick={onAcknowledge}
          >
            Acknowledge
          </Button>
        )}
      </Flex>
    </Box>
  )
}

export default function Alerts() {
  const [filter, setFilter] = useState<AlertFilter>('open')
  const open = useAlerts('open')
  const acknowledged = useAlerts('acknowledged')
  const acknowledge = useAcknowledgeAlert()

  const current = filter === 'open' ? open : acknowledged
  const openCount = open.data?.total

  return (
    <Box maxW="3xl" mx="auto">
      <Heading mb={1}>Alerts</Heading>
      <Text color="fg.muted" mb={4}>
        A value outside the safe range for its crop is <strong>critical</strong>. A value still
        inside the range but moving steadily toward a limit is a <strong>warning</strong>, raised
        while there is time to act. Acknowledge an alert once you have dealt with it.
      </Text>

      <HStack mb={4} role="group" aria-label="Show">
        <Button
          size="sm"
          variant={filter === 'open' ? 'solid' : 'outline'}
          colorPalette="teal"
          aria-pressed={filter === 'open'}
          onClick={() => setFilter('open')}
        >
          Open{openCount !== undefined ? ` (${openCount})` : ''}
        </Button>
        <Button
          size="sm"
          variant={filter === 'acknowledged' ? 'solid' : 'outline'}
          colorPalette="teal"
          aria-pressed={filter === 'acknowledged'}
          onClick={() => setFilter('acknowledged')}
        >
          Acknowledged
        </Button>
      </HStack>

      {current.isLoading ? (
        <Text role="status">Loading alerts…</Text>
      ) : current.isError ? (
        <Text role="alert" color="red.500">
          Could not load the alerts.
        </Text>
      ) : current.data && current.data.items.length === 0 ? (
        <Text color="fg.muted">
          {filter === 'open'
            ? 'No open alerts. Every batch is inside its safe ranges and none is heading out of them.'
            : 'No acknowledged alerts yet.'}
        </Text>
      ) : (
        <>
          <VStack as="ul" align="stretch" gap={3} pl={0} aria-label={`${filter} alerts`}>
            {current.data?.items.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                busy={acknowledge.isPending}
                onAcknowledge={filter === 'open' ? () => acknowledge.mutate(alert.id) : undefined}
              />
            ))}
          </VStack>
          {current.data && current.data.total > ALERTS_PAGE && (
            <Text mt={3} fontSize="sm" color="fg.muted">
              Showing the latest {ALERTS_PAGE} of {current.data.total}.
            </Text>
          )}
        </>
      )}
    </Box>
  )
}
