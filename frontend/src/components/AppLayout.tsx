import { Box, Flex } from '@chakra-ui/react'
import { Outlet } from 'react-router-dom'
import Header from './Header'

export default function AppLayout() {
  return (
    <Flex direction="column" minH="100vh">
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
