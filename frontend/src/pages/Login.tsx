import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Heading, HStack, Separator, Text, VStack } from '@chakra-ui/react'
import { useAppAuth } from '../auth/AppAuthContext'
import { FullPageSpinner } from '../components/FullPageSpinner'

export default function Login() {
  const { status, auth0Available, loginWithAuth0, startDemo } = useAppAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/dashboard'

  if (status === 'loading') return <FullPageSpinner label="Checking your session…" />
  if (status === 'authenticated') return <Navigate to={returnTo} replace />

  const handleDemo = () => {
    startDemo()
    navigate(returnTo, { replace: true })
  }

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" p={6}>
      <VStack
        gap={6}
        p={{ base: 6, md: 10 }}
        maxW="md"
        w="full"
        borderWidth="1px"
        rounded="xl"
        shadow="md"
        textAlign="center"
      >
        <VStack gap={1}>
          <Heading size="2xl" color="teal.500">
            🍄 MycoTrack
          </Heading>
          <Text color="gray.500">Environmental monitoring for mushroom cultivation batches.</Text>
        </VStack>

        <VStack gap={3} w="full">
          <Button
            colorPalette="teal"
            size="lg"
            w="full"
            disabled={!auth0Available}
            onClick={() => loginWithAuth0(returnTo)}
          >
            Log in
          </Button>
          {!auth0Available && (
            <Text fontSize="xs" color="gray.500">
              Login is not configured in this environment.
            </Text>
          )}
        </VStack>

        <HStack w="full">
          <Separator flex="1" />
          <Text fontSize="sm" color="gray.500">
            or
          </Text>
          <Separator flex="1" />
        </HStack>

        <VStack gap={2} w="full">
          <Button variant="outline" size="lg" w="full" onClick={handleDemo}>
            Try the demo
          </Button>
          <Text fontSize="xs" color="gray.500">
            No account needed. Explore with sample data — changes stay in your browser and disappear
            when you close the tab.
          </Text>
        </VStack>
      </VStack>
    </Box>
  )
}
