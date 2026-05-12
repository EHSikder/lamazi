/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
        extend: {
                fontFamily: {
                        display: ['"Fraunces"', 'serif'],
                        script: ['"Pinyon Script"', 'cursive'],
                        body: ['"Outfit"', 'sans-serif'],
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                },
                colors: {
                        lamazi: {
                                primary: '#58000e',
                                secondary: '#e7d2a5',
                                tertiary: '#2d0007',
                                neutral: '#fdf8f1',
                                'secondary-soft': '#f3e6c8',
                                'secondary-deep': '#c9a96e',
                                ink: '#2b1812',
                                muted: '#7a5a4e',
                        },
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        card: {
                                DEFAULT: 'hsl(var(--card))',
                                foreground: 'hsl(var(--card-foreground))'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover))',
                                foreground: 'hsl(var(--popover-foreground))'
                        },
                        primary: {
                                DEFAULT: 'hsl(var(--primary))',
                                foreground: 'hsl(var(--primary-foreground))'
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--secondary))',
                                foreground: 'hsl(var(--secondary-foreground))'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted))',
                                foreground: 'hsl(var(--muted-foreground))'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--accent))',
                                foreground: 'hsl(var(--accent-foreground))'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive))',
                                foreground: 'hsl(var(--destructive-foreground))'
                        },
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        chart: {
                                '1': 'hsl(var(--chart-1))',
                                '2': 'hsl(var(--chart-2))',
                                '3': 'hsl(var(--chart-3))',
                                '4': 'hsl(var(--chart-4))',
                                '5': 'hsl(var(--chart-5))'
                        }
                },
                keyframes: {
                        'accordion-down': {
                                from: { height: '0' },
                                to: { height: 'var(--radix-accordion-content-height)' }
                        },
                        'accordion-up': {
                                from: { height: 'var(--radix-accordion-content-height)' },
                                to: { height: '0' }
                        },
                        'fade-up': {
                                '0%': { opacity: '0', transform: 'translateY(12px)' },
                                '100%': { opacity: '1', transform: 'translateY(0)' }
                        },
                        'pulse-ring': {
                                '0%': { boxShadow: '0 0 0 0 rgba(88, 0, 14, 0.5)' },
                                '70%': { boxShadow: '0 0 0 18px rgba(88, 0, 14, 0)' },
                                '100%': { boxShadow: '0 0 0 0 rgba(88, 0, 14, 0)' }
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                        'fade-up': 'fade-up 0.6s ease-out both',
                        'pulse-ring': 'pulse-ring 1.8s ease-out infinite'
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
};
