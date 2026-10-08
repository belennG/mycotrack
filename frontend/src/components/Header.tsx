import { useState, useEffect } from 'react'
import { Box, Flex, Button, Heading, HStack, Text, Image } from '@chakra-ui/react'
import { NavLink } from 'react-router-dom'
import { useAppAuth } from '../auth/AppAuthContext'
import { useMe } from '../hooks/useMe'

const roleLabel = (role: string) => role.charAt(0) + role.slice(1).toLowerCase()

function AuthControls() {
  const { status, mode, user, logout } = useAppAuth()
  const { data: me } = useMe()

  if (status !== 'authenticated') return null

  return (
    <HStack gap={3}>
      {user?.picture ? (
        <Image src={user.picture} alt={user.name ?? 'User avatar'} boxSize="8" rounded="full" />
      ) : null}
      <Box display={{ base: 'none', md: 'block' }} lineHeight="short">
        <Text fontSize="sm">{user?.name ?? user?.email}</Text>
        {me ? (
          <Text fontSize="xs" color="gray.500" data-testid="organization">
            {me.organization.name} · {roleLabel(me.organization.role)}
          </Text>
        ) : null}
      </Box>
      <Button size="sm" variant="outline" onClick={logout}>
        {mode === 'demo' ? 'Exit demo' : 'Log out'}
      </Button>
    </HStack>
  )
}

export default function Header() {
  const [isDark, setIsDark] = useState(false)

  // 1. Check local storage and apply the 'dark' class on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('theme') === 'dark'
    setIsDark(savedMode)

    if (savedMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // 2. Toggle the 'dark' class when the button is clicked
  const toggleTheme = () => {
    const newMode = !isDark
    setIsDark(newMode)
    localStorage.setItem('theme', newMode ? 'dark' : 'light')

    if (newMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <Flex
      as="header"
      w="100%"
      p={4}
      align="center"
      justify="space-between"
      borderBottom="1px solid"
      borderColor="gray.200"
    >
      <Heading size="lg" color="teal.500">
        MycoTrack
      </Heading>

      <HStack gap={6} display={{ base: 'none', md: 'flex' }}>
        <NavLink
          to="/dashboard"
          style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/settings"
          style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}
        >
          Settings
        </NavLink>
      </HStack>

      <HStack gap={3}>
        <AuthControls />
        <Button onClick={toggleTheme} variant="outline" size="sm">
          {isDark ? '☀️ Light' : '🌙 Dark'}
        </Button>
      </HStack>
    </Flex>
  )
}
