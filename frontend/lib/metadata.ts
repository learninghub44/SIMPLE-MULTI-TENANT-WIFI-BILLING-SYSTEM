import { Metadata } from 'next'
import { PROJECT_NAME } from './constants'

export interface PageMetadataOptions {
  title?: string
  description?: string
  keywords?: string[]
  image?: string
  noIndex?: boolean
}

export function generateMetadata(options: PageMetadataOptions = {}): Metadata {
  const {
    title = PROJECT_NAME,
    description = 'Zetu Business Solutions - Complete WiFi billing platform for Kenya. Manage your hotspot business with M-Pesa payments, MikroTik integration, and real-time monitoring.',
    keywords = ['WiFi', 'internet', 'billing', 'M-Pesa', 'Kenya', 'Zetu Business Solutions', 'hotspot', 'MikroTik', 'WiFi management', 'internet service provider'],
    image = '/og-image.jpg',
    noIndex = false
  } = options

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      images: [image],
      type: 'website',
      siteName: PROJECT_NAME,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: noIndex ? 'noindex, nofollow' : 'index, follow',
  }
}

export function generatePageMetadata(
  pageTitle: string,
  description?: string,
  options: Partial<PageMetadataOptions> = {}
): Metadata {
  const fullTitle = `${pageTitle} - ${PROJECT_NAME}`
  
  return generateMetadata({
    title: fullTitle,
    description,
    ...options
  })
}

// Predefined metadata for common pages
export const homeMetadata = generatePageMetadata('Home', 'Zetu Business Solutions - Complete WiFi billing platform for Kenya. Manage your hotspot business with M-Pesa payments, MikroTik integration, and real-time monitoring.')
export const aboutMetadata = generatePageMetadata('About Us', 'Learn about Zetu Business Solutions, our mission, team, and commitment to providing quality internet services across Kenya.')
export const adminMetadata = generatePageMetadata('Admin Dashboard', 'Manage users, transactions, and system settings for the WiFi billing system.')
export const supportMetadata = generatePageMetadata('Support', 'Get help with your WiFi connection, billing, or technical issues. Our support team is available 24/7.')
export const packagesMetadata = generatePageMetadata('WiFi Packages', 'Choose from our range of WiFi packages with different speeds and durations. Affordable internet for everyone.')

// Dynamic metadata for product pages
export function generateProductMetadata(productName: string, description?: string): Metadata {
  return generatePageMetadata(
    productName,
    description || `Details and information about ${productName}`,
    { keywords: ['WiFi package', productName, 'internet', 'billing'] }
  )
}

// Loading state metadata
export const loadingMetadata = generatePageMetadata('Loading...', 'Please wait while we load your content.')
