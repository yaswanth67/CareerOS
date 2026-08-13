'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useToast } from '@/components/ui/Toast'
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

const signInSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(1, 'Password is required'),
})

type SignInForm = z.infer<typeof signInSchema>

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  // Preserve an internal callbackUrl as the post-onboarding destination, but
  // never route through the auth or onboarding pages themselves (open-redirect guard).
  const rawCallback = searchParams.get('callbackUrl')
  const isInternal = (p: string | null) =>
    !!p && p.startsWith('/') && !p.startsWith('//') && p !== '/auth/signin' && p !== '/auth/register' && p !== '/onboarding'
  const target = isInternal(rawCallback) ? rawCallback! : '/dashboard'

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      name: '',
      password: '',
    },
  })

  const onSubmit = async (data: SignInForm) => {
    setIsLoading(true)
    try {
      const result = await signIn('credentials', {
        name: data.name,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        toast({ type: 'error', message: result.error })
      } else {
        toast({ type: 'success', message: `Welcome back, ${data.name}!` })
        // Route through onboarding so jobs are refreshed + matches re-scored,
        // then continue to the intended page.
        router.push(`/onboarding?next=${encodeURIComponent(target)}`)
        router.refresh()
      }
    } catch {
      toast({ type: 'error', message: 'Something went wrong' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-100 via-white to-primary-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex justify-center mb-6">
            <Logo size="lg" />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Sign in with your name to see your matches
          </p>
        </div>

        <div className="card p-8 shadow-lg">
          {error && (
            <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-600 text-sm dark:bg-danger-500/20 dark:border-danger-500/30">
              Invalid name or password
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="name" className="label">
                Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('name')}
                  id="name"
                  type="text"
                  autoComplete="username"
                  className="input pl-10"
                  placeholder="e.g., buddy"
                  disabled={isLoading}
                  aria-invalid={errors.name ? 'true' : 'false'}
                />
              </div>
              {errors.name && (
                <p className="mt-1.5 text-sm text-danger-500">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  disabled={isLoading}
                  aria-invalid={errors.password ? 'true' : 'false'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-danger-500">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Don&apos;t have an account?{' '}
              <Link
                href="/auth/register"
                className="text-primary-600 hover:text-primary-500 font-medium"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-500">
          Your data stays on your machine — no tracking.
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  )
}
