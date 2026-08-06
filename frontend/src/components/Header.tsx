import { useState, useEffect } from 'react'
import { Flex, Button, Heading, HStack } from '@chakra-ui/react'
import { NavLink } from 'react-router-dom'

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
          to="/batches/:batchId/trackings"
          end
          style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}
        >
          Trackings
        </NavLink>
        <NavLink
          to="/batches/new"
          style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}
        >
          New Entry
        </NavLink>
        <NavLink
          to="/settings"
          style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}
        >
          Settings
        </NavLink>
      </HStack>

      <Button onClick={toggleTheme} variant="outline" size="sm">
        {isDark ? '☀️ Light' : '🌙 Dark'}
      </Button>
    </Flex>
  )
}
