import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('project scaffold', () => {
  it('renders the starter page without sale behavior', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'High-Concurrency Flash-Sale Engine' }),
    ).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain(
      'Countdown, giữ hàng và checkout chưa được triển khai trong milestone này.',
    )
  })
})
