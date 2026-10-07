import { Box, Button, Flex, Text } from '@chakra-ui/react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import { useAppAuth } from '../auth/AppAuthContext'

export default function AppLayout() {
  const { mode, logout } = useAppAuth()

  return (
    <Flex direction="column" minH="100vh">
      {mode === 'demo' && (
        <Flex
          bg="teal.600"
          color="white"
          px={4}
          py={2}
          gap={3}
          align="center"
          justify="center"
          wrap="wrap"
          role="status"
        >
          <Text fontSize="sm">
            Demo mode — sample data, stored only in your browser. Changes disappear when you close
            this tab.
          </Text>
          <Button size="xs" variant="outline" color="white" onClick={logout}>
            Exit demo
          </Button>
        </Flex>
      )}
      <Header />
      <Box as="main" flex="1" p={6} maxW="1200px" mx="auto" w="100%">
        <Outlet />
      </Box>
      <Box as="footer" p={4} textAlign="center" borderTop="1px solid" borderColor="gray.200">
        &copy; {new Date().getFullYear()} MycoTrack
      </Box>
    </Flex>
  )
}
