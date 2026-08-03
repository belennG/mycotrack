import { createSystem, defaultConfig } from "@chakra-ui/react"

export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#e3f9e5" },
          500: { value: "#319795" },
          900: { value: "#1a202c" },
        },
      },
    },
  },
})
