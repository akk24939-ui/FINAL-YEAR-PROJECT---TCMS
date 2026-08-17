/**
 * ForgotPasswordPage — 3-step password reset wizard for Consumer portal.
 * Route: /forgot-password  (public)
 *
 * Step 1: Enter mobile number → request OTP
 * Step 2: Enter 6-digit OTP   → get reset_token
 * Step 3: Enter new password  → reset and redirect to /login
 */
import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
    Loader2, AlertCircle, CheckCircle2, ArrowLeft,
    Smartphone, KeyRound, Lock,
} from 'lucide-react'
import { authApi } from '../../api/auth.api'
import { getErrorMessage } from '../../utils/getErrorMessage'

// ─── Schemas ──────────────────────────────────────────────────────────────────
const mobileSchema = z.object({
    mobile_number: z.string().regex(/^\d{10}$/, 'Enter your 10-digit mobile number'),
})
const otpSchema = z.object({
    otp_code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP'),
})
const passwordSchema = z.object({
    new_password: z
        .string()
        .min(8, 'Minimum 8 characters')
        .regex(/[A-Z]/, 'Must include an uppercase letter')
        .regex(/[a-z]/, 'Must include a lowercase letter')
        .regex(/\d/, 'Must include a digit')
        .regex(/[!@#$%^&*()_+\-=\[\]{};:'",.<>?]/, 'Must include a special character'),
    confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
})

type MobileForm = z.infer<typeof mobileSchema>
type OtpForm = z.infer<typeof otpSchema>
type PasswordForm = z.infer<typeof passwordSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inputCls = (err: boolean) =>
    [
        'w-full bg-gray-50 dark:bg-gray-800 border rounded-xl px-4 py-3',
        'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500',
        'text-sm outline-none transition-all',
        err
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
            : 'border-gray-200 dark:border-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
    ].join(' ')

// ─── Step indicator ───────────────────────────────────────────────────────────
const StepDot: React.FC<{ n: number; current: number; label: string }> = ({ n, current, label }) => {
    const done = n < current
    const active = n === current
    return (
        <div className="flex flex-col items-center gap-1">
            <div className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                done ? 'bg-emerald-600 border-emerald-600 text-white' : '',
                active ? 'bg-white dark:bg-gray-900 border-emerald-600 text-emerald-600' : '',
                !done && !active ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400' : '',
            ].join(' ')}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : n}
            </div>
            <span className={[
                'text-[10px] font-medium hidden sm:block',
                active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400',
            ].join(' ')}>{label}</span>
        </div>
    )
}

const StepLine: React.FC<{ done: boolean }> = ({ done }) => (
    <div className={[
        'flex-1 h-0.5 mx-1 rounded transition-all',
        done ? 'bg-emerald-600' : 'bg-gray-200 dark:bg-gray-700',
    ].join(' ')} />
)

// ─── Component ────────────────────────────────────────────────────────────────
const ForgotPasswordPage: React.FC = () => {
    const navigate = useNavigate()
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [mobile, setMobile] = useState('')
    const [resetToken, setResetToken] = useState('')
    const [serverError, setServerError] = useState<string | null>(null)
    const [done, setDone] = useState(false)

    // Step 1 form
    const mobileForm = useForm<MobileForm>({ resolver: zodResolver(mobileSchema) })
    // Step 2 form
    const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) })
    // Step 3 form
    const pwForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

    // ── Step 1: request OTP ───────────────────────────────────────────────────
    const onStep1 = async (values: MobileForm) => {
        setServerError(null)
        try {
            await authApi.forgotPassword(values.mobile_number)
            setMobile(values.mobile_number)
            setStep(2)
        } catch (err) {
            setServerError(getErrorMessage(err, 'Could not send OTP. Please try again.'))
        }
    }

    // ── Step 2: verify OTP ────────────────────────────────────────────────────
    const onStep2 = async (values: OtpForm) => {
        setServerError(null)
        try {
            const res = await authApi.verifyResetOtp(mobile, values.otp_code)
            setResetToken(res.data.reset_token)
            setStep(3)
        } catch (err) {
            setServerError(getErrorMessage(err, 'Invalid or expired OTP.'))
        }
    }

    // ── Step 3: set new password ──────────────────────────────────────────────
    const onStep3 = async (values: PasswordForm) => {
        setServerError(null)
        try {
            await authApi.resetPassword(resetToken, values.new_password)
            setDone(true)
            setTimeout(() => navigate('/login'), 2500)
        } catch (err) {
            setServerError(getErrorMessage(err, 'Password reset failed. Please start over.'))
        }
    }

    // ── Success screen ─────────────────────────────────────────────────────────
    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
                <div className="text-center space-y-4 max-w-sm">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">Password Reset!</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Your password has been updated. Redirecting to login…
                    </p>
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mx-auto" />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors">

            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center shadow-md shadow-emerald-700/30">
                        <span className="text-white text-sm leading-none">🏛️</span>
                    </div>
                    <span className="font-black text-gray-900 dark:text-white text-sm tracking-tight">
                        Smart <span className="text-emerald-700 dark:text-emerald-400">TASMAC</span>
                    </span>
                </div>
                <Link
                    to="/login"
                    className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Login
                </Link>
            </header>

            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-sm">

                    {/* Title */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-700 shadow-lg shadow-emerald-700/25 flex items-center justify-center text-2xl mx-auto mb-4">
                            🔑
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                            Reset Password
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Verify your mobile number to set a new password
                        </p>
                    </div>

                    {/* Step indicator */}
                    <div className="flex items-center mb-8 px-2">
                        <StepDot n={1} current={step} label="Mobile" />
                        <StepLine done={step > 1} />
                        <StepDot n={2} current={step} label="OTP" />
                        <StepLine done={step > 2} />
                        <StepDot n={3} current={step} label="Password" />
                    </div>

                    {/* Card */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-800 p-8">

                        {/* Error banner */}
                        {serverError && (
                            <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3 mb-4">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                {serverError}
                            </div>
                        )}

                        {/* ── Step 1 ── */}
                        {step === 1 && (
                            <form onSubmit={mobileForm.handleSubmit(onStep1)} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Smartphone className="w-3.5 h-3.5" />
                                        Mobile Number
                                    </label>
                                    <input
                                        className={inputCls(!!mobileForm.formState.errors.mobile_number)}
                                        placeholder="10-digit mobile number"
                                        inputMode="numeric"
                                        maxLength={10}
                                        {...mobileForm.register('mobile_number')}
                                    />
                                    {mobileForm.formState.errors.mobile_number && (
                                        <p className="text-red-500 text-xs">{mobileForm.formState.errors.mobile_number.message}</p>
                                    )}
                                    <p className="text-gray-400 dark:text-gray-500 text-[11px]">
                                        A 6-digit OTP will be sent to this number.
                                    </p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={mobileForm.formState.isSubmitting}
                                    className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 transition-all"
                                >
                                    {mobileForm.formState.isSubmitting
                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP…</>
                                        : <><Smartphone className="w-4 h-4" /> Send OTP</>}
                                </button>
                            </form>
                        )}

                        {/* ── Step 2 ── */}
                        {step === 2 && (
                            <form onSubmit={otpForm.handleSubmit(onStep2)} className="space-y-5">
                                <p className="text-sm text-gray-600 dark:text-gray-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30 rounded-xl px-4 py-3">
                                    OTP sent to <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{mobile}</span>.
                                    Check the backend terminal in dev mode.
                                </p>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <KeyRound className="w-3.5 h-3.5" />
                                        One-Time Password
                                    </label>
                                    <input
                                        className={inputCls(!!otpForm.formState.errors.otp_code)}
                                        placeholder="6-digit OTP"
                                        inputMode="numeric"
                                        maxLength={6}
                                        autoFocus
                                        {...otpForm.register('otp_code')}
                                    />
                                    {otpForm.formState.errors.otp_code && (
                                        <p className="text-red-500 text-xs">{otpForm.formState.errors.otp_code.message}</p>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setStep(1); setServerError(null) }}
                                        className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={otpForm.formState.isSubmitting}
                                        className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 transition-all"
                                    >
                                        {otpForm.formState.isSubmitting
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                                            : <><KeyRound className="w-4 h-4" /> Verify OTP</>}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* ── Step 3 ── */}
                        {step === 3 && (
                            <form onSubmit={pwForm.handleSubmit(onStep3)} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Lock className="w-3.5 h-3.5" />
                                        New Password
                                    </label>
                                    <input
                                        type="password"
                                        className={inputCls(!!pwForm.formState.errors.new_password)}
                                        placeholder="Min 8 chars, upper, lower, digit, symbol"
                                        {...pwForm.register('new_password')}
                                    />
                                    {pwForm.formState.errors.new_password && (
                                        <p className="text-red-500 text-xs">{pwForm.formState.errors.new_password.message}</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        className={inputCls(!!pwForm.formState.errors.confirm_password)}
                                        placeholder="Re-enter your new password"
                                        {...pwForm.register('confirm_password')}
                                    />
                                    {pwForm.formState.errors.confirm_password && (
                                        <p className="text-red-500 text-xs">{pwForm.formState.errors.confirm_password.message}</p>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={pwForm.formState.isSubmitting}
                                    className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 transition-all"
                                >
                                    {pwForm.formState.isSubmitting
                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting…</>
                                        : <><Lock className="w-4 h-4" /> Reset Password</>}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </main>

            <footer className="py-3 text-center text-[11px] text-gray-400 dark:text-gray-600 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                Tamil Nadu State Marketing Corporation · Smart TASMAC v1.0
            </footer>
        </div>
    )
}

export default ForgotPasswordPage
