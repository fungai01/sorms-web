import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import HomePage from '../page'

// Mock Next.js components
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />
  },
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}))

describe('HomePage', () => {
  it('renders the main heading', () => {
    render(<HomePage />)
    expect(screen.getByText(/Nhà Công Vụ Thông Minh/i)).toBeInTheDocument()
    expect(screen.getByText(/SORMS/i)).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    render(<HomePage />)
    expect(screen.getByText(/Hệ thống quản lý nhà công vụ thông minh/i)).toBeInTheDocument()
  })

  it('renders login button with correct link', () => {
    render(<HomePage />)
    const loginLink = screen.getByRole('link', { name: /đăng nhập ngay/i })
    expect(loginLink).toBeInTheDocument()
    expect(loginLink).toHaveAttribute('href', '/login')
  })

  it('renders footer text', () => {
    render(<HomePage />)
    expect(screen.getByText(/© 2025 SORMS/i)).toBeInTheDocument()
  })

  it('has correct page structure', () => {
    const { container } = render(<HomePage />)
    // Check for main container
    expect(container.querySelector('.min-h-screen')).toBeInTheDocument()
  })
})

