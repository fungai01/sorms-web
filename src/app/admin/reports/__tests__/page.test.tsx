import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ReportsPage from '../page'

describe('AdminReportsPage', () => {
  it('renders reports page title', async () => {
    render(<ReportsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Báo cáo/i) || screen.getByText(/Reports/i)).toBeInTheDocument()
    })
  })
})

