"use client"

import { useState, useEffect } from "react"
import { Wifi, Menu, X, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { AuthModal } from "@/components/AuthModal"
import { useUserAuth } from "@/hooks/use-user-auth"
import Link from "next/link"

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const { logout } = useUserAuth()

  useEffect(() => {
    const token = localStorage.getItem('user_token')
    const userData = localStorage.getItem('user_data')
    if (token && userData) {
      setIsAuthenticated(true)
      setUser(JSON.parse(userData))
    }
  }, [])

  const handleAuthSuccess = (user: any, token: string) => {
    setShowAuthModal(false)
    setIsAuthenticated(true)
    setUser(user)
  }

  const handleLogout = () => {
    logout()
    setIsAuthenticated(false)
    setUser(null)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/zetu-logo.png" alt="Zetu Business Solutions WiFi" className="h-10 w-auto" />
              <div>
                <h1 className="text-xl font-bold text-foreground">Zetu Business Solutions</h1>
                <p className="text-xs text-muted-foreground">High-Speed Internet</p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {isAuthenticated && (
              <Link
                href="/dashboard"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
            )}
            <Link
              href="/packages"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Packages
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </Link>
            <Link
              href="/support"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Support
            </Link>
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                {user?.username === 'Denis2' && (
                  <Link
                    href="/admin"
                    className="text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
                  >
                    Admin Panel
                  </Link>
                )}
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Login
              </Link>
            )}


            <ThemeToggle />
          </nav>

          {/* Mobile menu button and theme toggle */}
          <div className="flex items-center space-x-2 md:hidden">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-border py-4">
            <nav className="flex flex-col space-y-4">
              {isAuthenticated && (
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>
              )}
              <Link
                href="/packages"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Packages
              </Link>
              <Link
                href="/about"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
              <Link
                href="/support"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Support
              </Link>

              {isAuthenticated ? (
                <div className="flex flex-col space-y-2 pt-2 border-t border-border">
                  {user?.username === 'Denis2' && (
                    <Link
                      href="/admin"
                      className="text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Admin Panel
                    </Link>
                  )}
                  <Button
                    onClick={() => {
                      handleLogout()
                      setIsMenuOpen(false)
                    }}
                    variant="ghost"
                    size="sm"
                    className="justify-start text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Login
                </Link>
              )}

            </nav>
          </div>
        )}

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    </header>
  )
}
