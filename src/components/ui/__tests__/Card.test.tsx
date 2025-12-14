import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Card, CardHeader, CardBody } from '../Card'

describe('Card Components', () => {
  describe('Card', () => {
    it('renders card with children', () => {
      render(<Card>Card content</Card>)
      expect(screen.getByText('Card content')).toBeInTheDocument()
    })

    it('applies default styling classes', () => {
      const { container } = render(<Card>Content</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('rounded-md')
      expect(card).toHaveClass('border')
      expect(card).toHaveClass('bg-white')
    })

    it('applies custom className', () => {
      const { container } = render(<Card className="custom-card">Content</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('custom-card')
    })
  })

  describe('CardHeader', () => {
    it('renders card header with children', () => {
      render(
        <Card>
          <CardHeader>Header Content</CardHeader>
        </Card>
      )
      expect(screen.getByText('Header Content')).toBeInTheDocument()
    })

    it('applies default styling classes', () => {
      const { container } = render(
        <Card>
          <CardHeader>Header</CardHeader>
        </Card>
      )
      const header = container.querySelector('div')
      expect(header).toHaveClass('border-b')
      expect(header).toHaveClass('px-3')
    })

    it('applies custom className', () => {
      const { container } = render(
        <Card>
          <CardHeader className="custom-header">Header</CardHeader>
        </Card>
      )
      const header = container.querySelector('div')
      expect(header).toHaveClass('custom-header')
    })
  })

  describe('CardBody', () => {
    it('renders card body with children', () => {
      render(
        <Card>
          <CardBody>Body Content</CardBody>
        </Card>
      )
      expect(screen.getByText('Body Content')).toBeInTheDocument()
    })

    it('applies default styling classes', () => {
      const { container } = render(
        <Card>
          <CardBody>Body</CardBody>
        </Card>
      )
      const body = container.querySelector('div')
      expect(body).toHaveClass('p-3')
    })

    it('applies custom className', () => {
      const { container } = render(
        <Card>
          <CardBody className="custom-body">Body</CardBody>
        </Card>
      )
      const body = container.querySelector('div')
      expect(body).toHaveClass('custom-body')
    })
  })

  describe('Card Composition', () => {
    it('renders complete card structure', () => {
      render(
        <Card>
          <CardHeader>Title</CardHeader>
          <CardBody>Content</CardBody>
        </Card>
      )
      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Content')).toBeInTheDocument()
    })
  })
})

